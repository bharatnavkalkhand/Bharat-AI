/**
 * Scene player: layered cinema — BG art + full-body motion + lips + export.
 * Photos animate with poses; cartoon body only when no photo is available.
 * Supports per-scene imported audio (phone VoiceStudio/CapCut files).
 */

import { prepareTimedLines, type TimedLine } from "./tts-engine";
import {
  motionAt,
  type MotionIntensity,
} from "./motion-engine";
import { faceAnimAt, drawFaceOverlay } from "./expression-engine";
import {
  prepareLineLipSync,
  smoothLipAtTime,
  energyAt,
  type MouthCue,
} from "./rhubarb-lipsync";
import { drawAvatar3D } from "./avatar-3d";
import {
  drawBodyPerformance,
  drawSceneAtmosphere,
} from "./body-performance";
import {
  resolveSystemVoice,
  characterVoiceIdForSpeaker,
} from "./voice-catalog";

export interface PlayerScene {
  id: string;
  title: string;
  mood: string;
  dialogue?: string;
  narration?: string;
  visualPrompt?: string;
  imageTop?: string;
  imageBottom?: string;
  audioUrl?: string;
}

export interface PlayerOptions {
  language: "en" | "hi";
  headline?: string;
  width?: number;
  height?: number;
  onCaption?: (text: string) => void;
  onScene?: (index: number, total: number) => void;
  record?: boolean;
  onRecordProgress?: (msg: string) => void;
  embedAudio?: boolean;
  voiceGender?: "auto" | "male" | "female";
  motionIntensity?: MotionIntensity;
  facePerformance?: boolean;
  useRhubarb?: boolean;
  layout?: "dual" | "single";
  use3dAvatar?: boolean;
  bodyPerformance?: boolean;
}

export interface PlayResult {
  blob: Blob | null;
  mimeType: string;
  extension: "webm" | "mp4";
  hadAudioTrack: boolean;
  usedRhubarb?: boolean;
}

function parseTurns(dialogue: string): Array<{ speaker: string; text: string }> {
  const lines = dialogue
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<{ speaker: string; text: string }> = [];
  for (const line of lines) {
    const m = line.match(/^([^:]{1,40}):\s*(.+)$/);
    if (m) out.push({ speaker: m[1].trim(), text: m[2].trim() });
    else out.push({ speaker: "", text: line });
  }
  return out.length ? out : [{ speaker: "", text: dialogue }];
}

const MOOD_COLORS: Record<string, [string, string]> = {
  fight: ["#3f0d12", "#7f1d1d"],
  romance: ["#4a044e", "#9d174d"],
  gesture: ["#164e63", "#0e7490"],
  dialogue: ["#1e293b", "#334155"],
  action: ["#7c2d12", "#c2410c"],
  emotional: ["#312e81", "#4c1d95"],
  dramatic: ["#18181b", "#3f3f46"],
};

function applyMoodGrade(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mood: string,
) {
  const m = (mood || "").toLowerCase();
  if (m === "romance" || m === "emotional") {
    ctx.fillStyle = "rgba(255, 120, 80, 0.08)";
    ctx.fillRect(x, y, w, h);
    const g = ctx.createRadialGradient(
      x + w / 2,
      y + h * 0.45,
      w * 0.15,
      x + w / 2,
      y + h * 0.5,
      w * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(20,0,30,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  } else if (m === "fight" || m === "action") {
    ctx.fillStyle = "rgba(255, 40, 20, 0.06)";
    ctx.fillRect(x, y, w, h);
  }
}

function drawCaptionBar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  caption: string,
  t: number,
  layout: "dual" | "single",
) {
  const barH = layout === "single" ? Math.max(64, Math.floor(h * 0.14)) : 56;
  const pulse = 0.78 + 0.06 * Math.sin(t * 4);
  const g = ctx.createLinearGradient(0, h - barH, 0, h);
  g.addColorStop(0, `rgba(0,0,0,${0.15 * pulse})`);
  g.addColorStop(0.35, `rgba(0,0,0,${0.75 * pulse})`);
  g.addColorStop(1, `rgba(0,0,0,${0.92 * pulse})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, h - barH, w, barH);

  const fs = Math.max(13, Math.floor(w * (layout === "single" ? 0.04 : 0.035)));
  ctx.font = `600 ${fs}px "Noto Sans Devanagari",system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxW = w * 0.92;
  const words = caption.split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const show = lines.slice(0, 2);
  const startY = h - barH / 2 - ((show.length - 1) * fs * 1.2) / 2;
  show.forEach((ln, i) => {
    ctx.fillStyle = i === 0 ? "#fffbeb" : "#fde68a";
    ctx.fillText(ln, w / 2, startY + i * fs * 1.2);
  });
}

type FaceOpts = {
  speaking: boolean;
  textLen: number;
  enabled: boolean;
  cues?: MouthCue[] | null;
  energy?: Float32Array | null;
  durationSec?: number;
  use3dAvatar?: boolean;
  bodyPerformance?: boolean;
};

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mood: string,
  label: string,
  image: HTMLImageElement | null,
  t: number,
  intensity: MotionIntensity,
  phase = 0,
  faceOpts?: FaceOpts,
) {
  const [c1, c2] = MOOD_COLORS[mood] || MOOD_COLORS.dialogue;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  const mot = motionAt(mood, t + phase, intensity);

  if (faceOpts?.use3dAvatar && faceOpts.enabled && !faceOpts.bodyPerformance) {
    const e = faceOpts.speaking
      ? energyAt(faceOpts.energy, t, faceOpts.durationSec ?? 1)
      : undefined;
    const smooth = faceOpts.speaking
      ? smoothLipAtTime(faceOpts.cues, t, e)
      : null;
    const anim = faceAnimAt(
      mood,
      t,
      faceOpts.textLen,
      faceOpts.speaking,
      smooth?.viseme,
      smooth,
    );
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(
      mot.panX * 0.5 + (mot.swayX || 0) * 0.6,
      mot.panY * 0.5 + (mot.bobY || 0) * 0.8,
    );
    drawAvatar3D(
      ctx,
      x,
      y,
      w,
      h,
      mood,
      anim,
      t,
      image && image.complete && image.naturalWidth ? image : null,
    );
    applyMoodGrade(ctx, x, y, w, h, mood);
    ctx.restore();
    return;
  }

  if (image && image.complete && image.naturalWidth) {
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    const baseScale = Math.max(w / iw, h / ih);
    const scale = baseScale * mot.zoom * 1.05;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2 + mot.panX * 0.7;
    const dy = y + (h - dh) / 2 + mot.panY * 0.7;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (mot.rot !== 0) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((mot.rot * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    const softMood = /romance|emotional/i.test(mood);
    const poseCycle = (t * (softMood ? 0.12 : 0.35)) % 3;
    const sideScale = softMood
      ? 1
      : poseCycle < 1
        ? 1
        : 0.74 + 0.05 * Math.sin(t * 2.2);
    const posePan = softMood
      ? 0
      : poseCycle < 1
        ? 0
        : poseCycle < 2
          ? w * 0.04
          : -w * 0.04;

    ctx.save();
    ctx.translate(posePan, 0);
    const midX = x + w / 2;
    ctx.translate(midX, 0);
    ctx.scale(sideScale, 1);
    ctx.translate(-midX, 0);
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.restore();

    let anim = null as ReturnType<typeof faceAnimAt> | null;
    if (faceOpts?.enabled) {
      const e = faceOpts.speaking
        ? energyAt(faceOpts.energy, t, faceOpts.durationSec ?? 1)
        : undefined;
      const smooth = faceOpts.speaking
        ? smoothLipAtTime(faceOpts.cues, t, e)
        : null;
      anim = faceAnimAt(
        mood,
        t,
        faceOpts.textLen,
        faceOpts.speaking,
        smooth?.viseme,
        smooth,
      );
      drawFaceOverlay(ctx, x, y, w, h, anim);
    }
    drawSceneAtmosphere(ctx, x, y, w, h, t);
    applyMoodGrade(ctx, x, y, w, h, mood);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    let anim = null as ReturnType<typeof faceAnimAt> | null;
    if (faceOpts?.enabled) {
      const e = faceOpts.speaking
        ? energyAt(faceOpts.energy, t, faceOpts.durationSec ?? 1)
        : undefined;
      const smooth = faceOpts.speaking
        ? smoothLipAtTime(faceOpts.cues, t, e)
        : null;
      anim = faceAnimAt(
        mood,
        t,
        faceOpts.textLen,
        faceOpts.speaking,
        smooth?.viseme,
        smooth,
      );
    }
    if (faceOpts?.bodyPerformance !== false) {
      drawBodyPerformance(
        ctx,
        x,
        y,
        w,
        h,
        mood,
        t,
        !!faceOpts?.speaking,
        anim,
      );
    } else if (faceOpts?.enabled && anim) {
      drawAvatar3D(ctx, x, y, w, h, mood, anim, t, null);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.font = `600 ${Math.floor(w * 0.042)}px system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label.slice(0, 40), x + w / 2, y + h / 2);
    }
    applyMoodGrade(ctx, x, y, w, h, mood);
    ctx.restore();
  }
}

function drawHeadline(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  h: number,
  text: string,
) {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, y, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fs = Math.max(16, Math.floor(w * 0.048));
  ctx.font = `800 ${fs}px "Noto Sans Devanagari",system-ui,sans-serif`;
  const maxW = w * 0.92;
  const words = text.split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const startY = y + h / 2 - ((lines.length - 1) * fs * 1.15) / 2;
  lines.slice(0, 2).forEach((ln, i) => {
    ctx.fillStyle = i === 0 ? "#f8fafc" : "#facc15";
    ctx.fillText(ln, w / 2, startY + i * fs * 1.15);
  });
}

async function ensureVoicesLoaded(): Promise<void> {
  if (!("speechSynthesis" in window)) return;
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve();
    };
    window.speechSynthesis.onvoiceschanged = done;
    window.setTimeout(done, 600);
  });
}

function speakBrowser(
  text: string,
  language: "en" | "hi",
  speaker: string,
  gender: "auto" | "male" | "female" = "auto",
): Promise<void> {
  return (async () => {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    await ensureVoicesLoaded();
    window.speechSynthesis.cancel();
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = language === "hi" ? "hi-IN" : "en-IN";
      const g = gender === "male" || gender === "female" ? gender : undefined;
      const isNar = /narrat|कथा|वाचक/i.test(speaker);
      const optionId = isNar
        ? g === "female"
          ? "nar-f1"
          : "nar-m1"
        : characterVoiceIdForSpeaker(speaker || "Hero", g);
      const resolved = resolveSystemVoice(optionId, language, g || "male");
      if (resolved.voice) u.voice = resolved.voice;
      if (g === "female") {
        u.pitch = Math.max(resolved.pitch, 1.15);
        u.rate = resolved.rate;
      } else if (g === "male") {
        u.pitch = Math.min(resolved.pitch, 0.9);
        u.rate = resolved.rate;
      } else {
        u.pitch = resolved.pitch;
        u.rate = resolved.rate;
      }
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
      window.setTimeout(resolve, Math.min(20000, 800 + text.length * 80));
    });
  })();
}

export function stopScenePlayer() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function pickRecorderMime(): {
  mimeType: string;
  extension: "webm" | "mp4";
} {
  const candidates: Array<{ mimeType: string; extension: "webm" | "mp4" }> = [
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
    { mimeType: "video/mp4", extension: "mp4" },
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c.mimeType)
    ) {
      return c;
    }
  }
  return { mimeType: "video/webm", extension: "webm" };
}

async function decodeAudioUrl(
  url: string,
  ctx: AudioContext,
): Promise<{ buffer: AudioBuffer; durationSec: number } | null> {
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arr.slice(0));
    return { buffer, durationSec: buffer.duration };
  } catch {
    return null;
  }
}

function playHtmlAudio(url: string): {
  el: HTMLAudioElement;
  done: Promise<void>;
} {
  const el = new Audio(url);
  el.preload = "auto";
  const done = new Promise<void>((resolve) => {
    el.onended = () => resolve();
    el.onerror = () => resolve();
    void el.play().catch(() => resolve());
  });
  return { el, done };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function collectDialogueLines(
  scenes: PlayerScene[],
): Array<{ speaker: string; text: string; sceneIndex: number }> {
  const all: Array<{ speaker: string; text: string; sceneIndex: number }> = [];
  scenes.forEach((sc, sceneIndex) => {
    const turns = sc.dialogue
      ? parseTurns(sc.dialogue)
      : sc.narration
        ? [{ speaker: "Narrator", text: sc.narration }]
        : [{ speaker: "", text: sc.title }];
    for (const t of turns) all.push({ ...t, sceneIndex });
  });
  return all;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sc: PlayerScene,
  headline: string,
  caption: string,
  imgTop: HTMLImageElement | null,
  imgBot: HTMLImageElement | null,
  t: number,
  intensity: MotionIntensity,
  speaking: boolean,
  textLen: number,
  facePerformance: boolean,
  cues: MouthCue[] | null,
  energy: Float32Array | null,
  durationSec: number,
  layout: "dual" | "single" = "dual",
  use3dAvatar = false,
  bodyPerformance = true,
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const faceOpts: FaceOpts = {
    speaking,
    textLen,
    enabled: facePerformance,
    cues,
    energy,
    durationSec,
    use3dAvatar,
    bodyPerformance,
  };

  if (layout === "single") {
    const captionH = Math.max(64, Math.floor(h * 0.14));
    const headH = Math.floor(h * 0.08);
    const mainH = h - headH - captionH;
    drawPanel(
      ctx,
      0,
      0,
      w,
      mainH,
      sc.mood,
      sc.visualPrompt || sc.title,
      imgTop || imgBot,
      t,
      intensity,
      0,
      faceOpts,
    );
    drawHeadline(ctx, w, mainH, headH, headline || sc.title);
  } else {
    const midBand = Math.floor(h * 0.14);
    const panelH = Math.floor((h - midBand) / 2);
    drawPanel(
      ctx,
      0,
      0,
      w,
      panelH,
      sc.mood,
      sc.visualPrompt || sc.title,
      imgTop,
      t,
      intensity,
      0,
      faceOpts,
    );
    drawHeadline(ctx, w, panelH, midBand, headline);
    drawPanel(
      ctx,
      0,
      panelH + midBand,
      w,
      panelH,
      sc.mood,
      sc.title,
      imgBot || imgTop,
      t,
      intensity,
      0.7,
      { ...faceOpts, speaking: false },
    );
  }

  drawCaptionBar(ctx, w, h, caption, t, layout);
}

export async function playScenesOnCanvas(
  canvas: HTMLCanvasElement,
  scenes: PlayerScene[],
  options: PlayerOptions,
  signal?: { stopped: boolean },
): Promise<PlayResult> {
  const w = options.width ?? 360;
  const h = options.height ?? 450;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  const empty: PlayResult = {
    blob: null,
    mimeType: "",
    extension: "webm",
    hadAudioTrack: false,
    usedRhubarb: false,
  };
  if (!ctx || !scenes.length) return empty;

  const intensity: MotionIntensity = options.motionIntensity ?? "high";
  const facePerformance = options.facePerformance !== false;
  const useRhubarb = options.useRhubarb !== false;
  const layout = options.layout === "single" ? "single" : "dual";
  const use3dAvatar = options.use3dAvatar === true;
  const bodyPerformance = options.bodyPerformance !== false;
  const headline =
    options.headline ||
    (options.language === "hi" ? "कहानी चल रही है…" : "Story in motion…");

  const imageCache = new Map<string, HTMLImageElement>();
  async function loadImg(src?: string) {
    if (!src) return null;
    if (imageCache.has(src)) return imageCache.get(src)!;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode().catch(() => null);
    imageCache.set(src, img);
    return img;
  }

  const dialogueLines = collectDialogueLines(scenes);
  let timed: TimedLine[] = [];
  let audioCtx: AudioContext | null = null;
  let usedServerTts = false;

  if (options.embedAudio !== false) {
    options.onRecordProgress?.("Preparing dialogue audio…");
    try {
      const prep = await prepareTimedLines(
        dialogueLines.map((d) => ({ speaker: d.speaker, text: d.text })),
        options.language,
        (msg) => options.onRecordProgress?.(msg),
      );
      timed = prep.lines;
      audioCtx = prep.ctx;
      usedServerTts = prep.usedServerTts;
      if (audioCtx.state === "suspended") await audioCtx.resume();
    } catch {
      timed = dialogueLines.map((d) => ({
        text: d.text,
        speaker: d.speaker,
        buffer: null,
        durationSec: Math.max(2.2, Math.min(12, d.text.length / 14)),
      }));
    }
  }

  const lineCues: Array<MouthCue[] | null> = [];
  const lineEnergy: Array<Float32Array | null> = [];
  const lineDur: number[] = [];
  let usedRhubarb = false;
  if (facePerformance || bodyPerformance) {
    options.onRecordProgress?.("Lip-sync + body performance…");
    for (let i = 0; i < timed.length; i++) {
      const line = timed[i];
      const dur = line.durationSec || line.buffer?.duration || 2.5;
      lineDur.push(dur);
      if (useRhubarb) {
        const { cues, energy } = await prepareLineLipSync(
          line.buffer,
          line.text,
          dur,
        );
        lineCues.push(cues);
        lineEnergy.push(energy);
        if (cues && cues.length >= 2) usedRhubarb = true;
      } else {
        lineCues.push(null);
        lineEnergy.push(null);
      }
    }
  } else {
    for (let i = 0; i < timed.length; i++) {
      lineCues.push(null);
      lineEnergy.push(null);
      lineDur.push(timed[i]?.durationSec ?? 2.5);
    }
  }

  let mixedStream: MediaStream | null = null;
  let dest: MediaStreamAudioDestinationNode | null = null;
  let recorder: MediaRecorder | null = null;
  const chunks: BlobPart[] = [];
  let mimeType = "video/webm";
  let extension: "webm" | "mp4" = "webm";
  let hadAudioTrack = false;

  if (options.record && canvas.captureStream) {
    const videoStream = canvas.captureStream(30);
    const picked = pickRecorderMime();
    mimeType = picked.mimeType;
    extension = picked.extension;
    if (audioCtx && usedServerTts) {
      dest = audioCtx.createMediaStreamDestination();
      mixedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      hadAudioTrack = true;
    } else {
      mixedStream = videoStream;
    }
    try {
      recorder = new MediaRecorder(mixedStream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
    } catch {
      try {
        recorder = new MediaRecorder(mixedStream);
      } catch {
        recorder = null;
      }
    }
    if (recorder) {
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.start(250);
    }
  }

  let lineCursor = 0;

  for (let si = 0; si < scenes.length; si++) {
    if (signal?.stopped) break;
    const sc = scenes[si];
    options.onScene?.(si, scenes.length);
    const imgTop = await loadImg(sc.imageTop);
    const imgBot = await loadImg(sc.imageBottom);

    const sceneLines = dialogueLines
      .map((d, idx) => ({ d, idx }))
      .filter(({ d }) => d.sceneIndex === si);

    if (sc.audioUrl) {
      const caption =
        (sc.dialogue || sc.narration || sc.title || "").split("\n")[0].slice(0, 120);
      options.onCaption?.(caption);
      const start = performance.now();
      const { done } = playHtmlAudio(sc.audioUrl);
      const durSec = Math.max(3, lineDur[lineCursor] || 4);
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (signal?.stopped) {
            resolve();
            return;
          }
          const t = (performance.now() - start) / 1000;
          drawFrame(
            ctx,
            w,
            h,
            sc,
            headline,
            caption,
            imgTop,
            imgBot,
            t,
            intensity,
            true,
            caption.length,
            facePerformance,
            lineCues[lineCursor] || null,
            lineEnergy[lineCursor] || null,
            durSec,
            layout,
            use3dAvatar,
            bodyPerformance,
          );
          if (t < durSec) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      await done;
      lineCursor++;
      continue;
    }

    if (!sceneLines.length) {
      const caption = sc.title;
      options.onCaption?.(caption);
      const start = performance.now();
      const durSec = 3.5;
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (signal?.stopped) {
            resolve();
            return;
          }
          const t = (performance.now() - start) / 1000;
          drawFrame(
            ctx,
            w,
            h,
            sc,
            headline,
            caption,
            imgTop,
            imgBot,
            t,
            intensity,
            false,
            0,
            facePerformance,
            null,
            null,
            durSec,
            layout,
            use3dAvatar,
            bodyPerformance,
          );
          if (t < durSec) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      continue;
    }

    for (const { d, idx } of sceneLines) {
      if (signal?.stopped) break;
      const line = timed[idx] || {
        text: d.text,
        speaker: d.speaker,
        buffer: null,
        durationSec: 3,
      };
      const caption = d.speaker ? `${d.speaker}: ${d.text}` : d.text;
      options.onCaption?.(caption);
      const durSec = lineDur[idx] || line.durationSec || 3;
      const start = performance.now();

      if (line.buffer && audioCtx && dest) {
        const src = audioCtx.createBufferSource();
        src.buffer = line.buffer;
        src.connect(dest);
        src.connect(audioCtx.destination);
        src.start();
      } else if (line.buffer && audioCtx) {
        const src = audioCtx.createBufferSource();
        src.buffer = line.buffer;
        src.connect(audioCtx.destination);
        src.start();
      } else {
        void speakBrowser(
          line.text,
          options.language,
          line.speaker || "",
          options.voiceGender || "auto",
        );
      }

      await new Promise<void>((resolve) => {
        const tick = () => {
          if (signal?.stopped) {
            resolve();
            return;
          }
          const t = (performance.now() - start) / 1000;
          drawFrame(
            ctx,
            w,
            h,
            sc,
            headline,
            caption,
            imgTop,
            imgBot,
            t,
            intensity,
            true,
            line.text.length,
            facePerformance,
            lineCues[idx] || null,
            lineEnergy[idx] || null,
            durSec,
            layout,
            use3dAvatar,
            bodyPerformance,
          );
          if (t < durSec) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
    }
  }

  if (recorder && recorder.state !== "inactive") {
    await new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve();
      recorder!.stop();
      window.setTimeout(resolve, 1500);
    });
  }

  if (audioCtx) {
    try {
      await audioCtx.close();
    } catch {
      /* ignore */
    }
  }

  const blob =
    chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null;
  return {
    blob,
    mimeType,
    extension,
    hadAudioTrack,
    usedRhubarb,
  };
}
