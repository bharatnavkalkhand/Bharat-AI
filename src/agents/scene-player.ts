/**
 * Scene player: dual panel + caption + TTS + motion + accurate lip-sync + export.
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

export interface PlayerScene {
  id: string;
  title: string;
  mood: string;
  dialogue?: string;
  narration?: string;
  visualPrompt?: string;
  imageTop?: string;
  imageBottom?: string;
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
  motionIntensity?: MotionIntensity;
  facePerformance?: boolean;
  useRhubarb?: boolean;
  /** dual = top/bottom panels; single = full-frame */
  layout?: "dual" | "single";
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

type FaceOpts = {
  speaking: boolean;
  textLen: number;
  enabled: boolean;
  cues?: MouthCue[] | null;
  energy?: Float32Array | null;
  durationSec?: number;
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

  if (image && image.complete && image.naturalWidth) {
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    const baseScale = Math.max(w / iw, h / ih);
    const scale = baseScale * mot.zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2 + mot.panX;
    const dy = y + (h - dh) / 2 + mot.panY;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (mot.rot !== 0) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((mot.rot * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    ctx.drawImage(image, dx, dy, dw, dh);

    if (faceOpts?.enabled) {
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
      drawFaceOverlay(ctx, x, y, w, h, anim);
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.font = `600 ${Math.floor(w * 0.042)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = label.slice(0, 80).split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > w * 0.85 && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((ln, i) => {
      ctx.fillText(
        ln,
        x + w / 2 + mot.panX * 0.3,
        y + h / 2 + (i - 1) * 22 + mot.panY * 0.3,
      );
    });
    if (faceOpts?.enabled) {
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
      const cx = x + w / 2;
      const cy = y + h * 0.42;
      ctx.fillStyle = "rgba(255,220,200,0.25)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.18, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      drawFaceOverlay(ctx, x, y, w, h, anim);
    }
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

function speakBrowser(
  text: string,
  language: "en" | "hi",
  speaker: string,
): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !text.trim()) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === "hi" ? "hi-IN" : "en-IN";
    const voices = window.speechSynthesis.getVoices();
    const pool = voices.filter((v) =>
      v.lang.toLowerCase().startsWith(language === "hi" ? "hi" : "en"),
    );
    if (pool.length) {
      let hash = 0;
      for (let i = 0; i < speaker.length; i++) hash += speaker.charCodeAt(i);
      u.voice = pool[hash % pool.length];
    }
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
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
    for (const t of turns) {
      all.push({ ...t, sceneIndex });
    }
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
  };

  if (layout === "single") {
    const captionH = 56;
    const headH = Math.floor(h * 0.1);
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
    drawHeadline(ctx, w, mainH, headH, headline);
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

  const pulse = 0.72 + 0.08 * Math.sin(t * 6);
  ctx.fillStyle = `rgba(0,0,0,${pulse})`;
  ctx.fillRect(0, h - 56, w, 56);
  ctx.fillStyle = "#fff";
  ctx.font = `600 ${Math.max(12, Math.floor(w * 0.035))}px system-ui,sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const sub = caption.length > 90 ? caption.slice(0, 87) + "…" : caption;
  ctx.fillText(sub, w / 2, h - 28);
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

  const intensity: MotionIntensity = options.motionIntensity ?? "medium";
  const facePerformance = options.facePerformance !== false;
  const useRhubarb = options.useRhubarb !== false;
  const layout = options.layout === "single" ? "single" : "dual";
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
  if (facePerformance) {
    options.onRecordProgress?.("Lip-sync: analyzing (Rhubarb + energy)…");
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
    options.onRecordProgress?.(
      usedRhubarb
        ? "Accurate lip-sync ready (visemes + energy)…"
        : "Text/energy lip-sync ready…",
    );
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
      options.onRecordProgress?.(
        `Recording ${extension.toUpperCase()}${usedRhubarb ? " + Rhubarb" : ""}…`,
      );
    }
  }

  let lineCursor = 0;

  for (let si = 0; si < scenes.length; si++) {
    if (signal?.stopped) break;
    const sc = scenes[si];
    options.onScene?.(si, scenes.length);
    const imgTop = await loadImg(sc.imageTop);
    const imgBot = await loadImg(sc.imageBottom);

    const turns = sc.dialogue
      ? parseTurns(sc.dialogue)
      : sc.narration
        ? [{ speaker: "Narrator", text: sc.narration }]
        : [{ speaker: "", text: sc.title }];

    for (const turn of turns) {
      if (signal?.stopped) break;
      const caption = turn.speaker
        ? `${turn.speaker}: ${turn.text}`
        : turn.text;
      options.onCaption?.(caption);

      const line: TimedLine | undefined = timed[lineCursor];
      const cues = lineCues[lineCursor] ?? null;
      const energy = lineEnergy[lineCursor] ?? null;
      const durationSec = lineDur[lineCursor] ?? line?.durationSec ?? 2.5;
      lineCursor += 1;

      const t0 = performance.now();
      let lineDone = false;

      if (line?.buffer && audioCtx && dest) {
        const src = audioCtx.createBufferSource();
        src.buffer = line.buffer;
        src.connect(dest);
        src.connect(audioCtx.destination);
        src.onended = () => {
          lineDone = true;
        };
        src.start();
      } else if (line?.buffer && audioCtx) {
        const src = audioCtx.createBufferSource();
        src.buffer = line.buffer;
        src.connect(audioCtx.destination);
        src.onended = () => {
          lineDone = true;
        };
        src.start();
      } else {
        speakBrowser(turn.text, options.language, turn.speaker || sc.mood).then(
          () => {
            lineDone = true;
          },
        );
      }

      const minHoldMs = Math.max(
        2200,
        ((line?.durationSec ?? 2.5) * 1000) | 0,
      );
      const textLen = turn.text.length;

      while (!signal?.stopped) {
        const elapsed = performance.now() - t0;
        if (lineDone && elapsed >= Math.min(minHoldMs, 500)) break;
        if (elapsed > Math.max(minHoldMs + 500, 20000)) break;

        drawFrame(
          ctx,
          w,
          h,
          sc,
          headline,
          caption,
          imgTop,
          imgBot,
          elapsed / 1000,
          intensity,
          !lineDone,
          textLen,
          facePerformance,
          cues,
          energy,
          durationSec,
          layout,
        );
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  await new Promise((r) => setTimeout(r, 400));

  if (recorder && recorder.state !== "inactive") {
    options.onRecordProgress?.("Finalizing file…");
    const blob = await new Promise<Blob>((resolve) => {
      recorder!.onstop = () => {
        mixedStream?.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: recorder!.mimeType || mimeType }));
      };
      recorder!.stop();
    });
    try {
      await audioCtx?.close();
    } catch {
      /* ignore */
    }
    return {
      blob: blob.size > 0 ? blob : null,
      mimeType,
      extension,
      hadAudioTrack,
      usedRhubarb,
    };
  }

  try {
    await audioCtx?.close();
  } catch {
    /* ignore */
  }

  return { ...empty, usedRhubarb };
}
