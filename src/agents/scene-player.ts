/**
 * Scene player: layered cinema — BG art + motion + lips + export.
 * Photos preferred; Civitai/Roar video import draws under captions + script voice.
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
  /** Civitai/Roar imported video (data URL) */
  videoUrl?: string;
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
  /** MediaPipe-detected real lip position on the photo (normalized) */
  lip?: import("./face-landmarks").LipRegion | null;
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
  const [c1, c2] = MOOD_COLORS[mood] || MOOD_COLORS.dialogue!;
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
      mood, t, faceOpts.textLen, faceOpts.speaking, smooth?.viseme, smooth,
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
      ctx, x, y, w, h, mood, anim, t,
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
    const sideScale = softMood ? 1 : poseCycle < 1 ? 1 : 0.74 + 0.05 * Math.sin(t * 2.2);
    const posePan = softMood ? 0 : poseCycle < 1 ? 0 : poseCycle < 2 ? w * 0.04 : -w * 0.04;
    ctx.save();
    ctx.translate(posePan, 0);
    const midX = x + w / 2;
    ctx.translate(midX, 0);
    ctx.scale(sideScale, 1);
    ctx.translate(-midX, 0);
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.restore();
    if (faceOpts?.enabled) {
      const e = faceOpts.speaking
        ? energyAt(faceOpts.energy, t, faceOpts.durationSec ?? 1)
        : undefined;
      const smooth = faceOpts.speaking
        ? smoothLipAtTime(faceOpts.cues, t, e)
        : null;
      const anim = faceAnimAt(
        mood, t, faceOpts.textLen, faceOpts.speaking, smooth?.viseme, smooth,
      );
      drawFaceOverlay(ctx, x, y, w, h, anim, faceOpts.lip);
    }
    drawSceneAtmosphere(ctx, x, y, w, h, t);
    applyMoodGrade(ctx, x, y, w, h, mood);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const sweep = 0.5 + 0.5 * Math.sin(t * 0.8);
    const lg = ctx.createLinearGradient(x, y, x + w, y + h);
    lg.addColorStop(0, `rgba(255,255,255,${0.03 + 0.04 * sweep})`);
    lg.addColorStop(0.5, "rgba(255,255,255,0.02)");
    lg.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, h);
    let anim = null as ReturnType<typeof faceAnimAt> | null;
    if (faceOpts?.enabled) {
      const e = faceOpts.speaking
        ? energyAt(faceOpts.energy, t, faceOpts.durationSec ?? 1)
        : undefined;
      const smooth = faceOpts.speaking
        ? smoothLipAtTime(faceOpts.cues, t, e)
        : null;
      anim = faceAnimAt(
        mood, t, faceOpts.textLen, faceOpts.speaking, smooth?.viseme, smooth,
      );
    }
    if (faceOpts?.bodyPerformance === true) {
      drawBodyPerformance(ctx, x, y, w, h, mood, t, !!faceOpts?.speaking, anim);
    } else if (faceOpts?.use3dAvatar === true && faceOpts?.enabled && anim) {
      drawAvatar3D(ctx, x, y, w, h, mood, anim, t, null);
    } else {
      const fs = Math.max(16, Math.floor(w * 0.055));
      ctx.font = `800 ${fs}px "Noto Sans Devanagari",system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const maxW = w * 0.86;
      const words = label.split(/\s+/);
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
      const show = lines.slice(0, 3);
      const startY = y + h * 0.42 - ((show.length - 1) * fs * 1.25) / 2;
      show.forEach((ln, i) => {
        ctx.fillStyle = i === 0 ? "#fffbeb" : "#fde68a";
        ctx.fillText(ln, x + w / 2, startY + i * fs * 1.25);
      });
      ctx.font = `600 ${Math.max(11, Math.floor(w * 0.032))}px system-ui,sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText((mood || "scene").toUpperCase(), x + w / 2, y + h * 0.78);
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

async function playExternalVideoOnCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  videoUrl: string,
  caption: string,
  headline: string,
  mood: string,
  durationHintSec: number,
  signal?: { stopped: boolean },
  onCaption?: (t: string) => void,
): Promise<void> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;
  await new Promise<void>((resolve) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => resolve();
    window.setTimeout(resolve, 2500);
  });
  const dur = Math.max(
    2.5,
    Math.min(20, Number.isFinite(video.duration) ? video.duration : durationHintSec),
  );
  onCaption?.(caption);
  try {
    await video.play();
  } catch {
    /* autoplay may fail */
  }
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (signal?.stopped) {
        try {
          video.pause();
        } catch {
          /* */
        }
        resolve();
        return;
      }
      const elapsed = (performance.now() - t0) / 1000;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      if (video.readyState >= 2) {
        const vw = video.videoWidth || w;
        const vh = video.videoHeight || h;
        const scale = Math.max(w / vw, h / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;
        try {
          ctx.drawImage(video, dx, dy, dw, dh);
        } catch {
          /* decode race */
        }
      }
      const barH = Math.max(64, Math.floor(h * 0.14));
      const g = ctx.createLinearGradient(0, h - barH, 0, h);
      g.addColorStop(0, "rgba(0,0,0,0.1)");
      g.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = g;
      ctx.fillRect(0, h - barH, w, barH);
      ctx.fillStyle = "#fffbeb";
      ctx.font = `600 ${Math.max(13, Math.floor(w * 0.038))}px "Noto Sans Devanagari",system-ui,sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const sub = caption.length > 90 ? caption.slice(0, 87) + "…" : caption;
      ctx.fillText(sub, w / 2, h - barH / 2);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, w, 36);
      ctx.fillStyle = "#f8fafc";
      ctx.font = `700 ${Math.max(12, Math.floor(w * 0.032))}px system-ui,sans-serif`;
      ctx.fillText((headline || mood).slice(0, 48), w / 2, 18);
      if (elapsed >= dur || video.ended) {
        try {
          video.pause();
        } catch {
          /* */
        }
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
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
  bodyPerformance = false,
  lipTop: import("./face-landmarks").LipRegion | null = null,
  lipBot: import("./face-landmarks").LipRegion | null = null,
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
    lip: lipTop,
  };
  if (layout === "single") {
    const captionH = Math.max(64, Math.floor(h * 0.14));
    const headH = Math.floor(h * 0.08);
    const mainH = h - headH - captionH;
    drawPanel(
      ctx, 0, 0, w, mainH, sc.mood, sc.visualPrompt || sc.title,
      imgTop || imgBot, t, intensity, 0, faceOpts,
    );
    drawHeadline(ctx, w, mainH, headH, headline || sc.title);
  } else {
    const midBand = Math.floor(h * 0.14);
    const panelH = Math.floor((h - midBand) / 2);
    drawPanel(
      ctx, 0, 0, w, panelH, sc.mood, sc.visualPrompt || sc.title,
      imgTop, t, intensity, 0, faceOpts,
    );
    drawHeadline(ctx, w, panelH, midBand, headline);
    drawPanel(
      ctx, 0, panelH + midBand, w, panelH, sc.mood, sc.title,
      imgBot || imgTop, t, intensity, 0.7,
      { ...faceOpts, speaking: false, lip: lipBot || lipTop },
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
  const h = options.height ?? 640;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      blob: null,
      mimeType: "video/webm",
      extension: "webm",
      hadAudioTrack: false,
    };
  }

  const intensity = options.motionIntensity ?? "med";
  const facePerformance = options.facePerformance === true;
  const useRhubarb = options.useRhubarb !== false;
  const layout = options.layout ?? "dual";
  const use3dAvatar = options.use3dAvatar === true;
  const bodyPerformance = options.bodyPerformance === true;

  const headline =
    options.headline ||
    (options.language === "hi" ? "कहानी चल रही है…" : "Story in motion…");

  const imageCache = new Map<string, HTMLImageElement>();
  const lipRegionCache = new Map<string, import("./face-landmarks").LipRegion>();

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

  /** Detect real lip position once per unique face image (MediaPipe). */
  async function getLipFor(src?: string | null, img?: HTMLImageElement | null) {
    if (!src || !img || !img.complete || !img.naturalWidth) return null;
    if (lipRegionCache.has(src)) return lipRegionCache.get(src)!;
    try {
      const { detectLipRegion } = await import("./face-landmarks");
      const region = await detectLipRegion(img, src);
      lipRegionCache.set(src, region);
      return region;
    } catch {
      return null;
    }
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
      const line = timed[i]!;
      const dur = line.durationSec || line.buffer?.duration || 2.5;
      lineDur.push(dur);
      if (useRhubarb) {
        const { cues, energy } = await prepareLineLipSync(line.buffer, line.text, dur);
        lineCues.push(cues);
        lineEnergy.push(energy);
        if (cues && cues.length >= 2) usedRhubarb = true;
      } else {
        lineCues.push(null);
        lineEnergy.push(null);
      }
    }
  }

  const { mimeType, extension } = pickRecorderMime();
  const chunks: BlobPart[] = [];
  let recorder: MediaRecorder | null = null;
  let hadAudioTrack = false;

  if (options.record !== false) {
    const stream = canvas.captureStream(25);
    if (audioCtx) {
      try {
        const dest = audioCtx.createMediaStreamDestination();
        const track = dest.stream.getAudioTracks()[0];
        if (track) {
          stream.addTrack(track);
          hadAudioTrack = true;
        }
      } catch {
        /* no audio track */
      }
    }
    try {
      recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.start(250);
    } catch {
      recorder = null;
    }
  }

  let lineCursor = 0;

  for (let si = 0; si < scenes.length; si++) {
    if (signal?.stopped) break;
    const sc = scenes[si]!;
    options.onScene?.(si, scenes.length);
    const imgTop = await loadImg(sc.imageTop);
    const imgBot = await loadImg(sc.imageBottom);
    // Detect real lip positions once (MediaPipe) so overlay matches photo mouth
    const lipTop = await getLipFor(sc.imageTop, imgTop);
    const lipBot = await getLipFor(sc.imageBottom, imgBot);

    if (sc.videoUrl) {
      const sceneLines = dialogueLines.filter((d) => d.sceneIndex === si);
      const caption = sceneLines[0]
        ? sceneLines[0].speaker
          ? `${sceneLines[0].speaker}: ${sceneLines[0].text}`
          : sceneLines[0].text
        : sc.dialogue || sc.narration || sc.title;
      const speakText =
        sceneLines.map((d) => d.text).join(". ") || sc.narration || sc.title;
      const speaker = sceneLines[0]?.speaker || "Narrator";
      void speakBrowser(
        speakText.slice(0, 400),
        options.language,
        speaker,
        options.voiceGender || "auto",
      );
      const durHint = Math.max(3, sceneLines.length * 3.5 || 8);
      await playExternalVideoOnCanvas(
        ctx,
        w,
        h,
        sc.videoUrl,
        caption.slice(0, 120),
        headline,
        sc.mood,
        durHint,
        signal,
        options.onCaption,
      );
      while (
        lineCursor < dialogueLines.length &&
        dialogueLines[lineCursor]?.sceneIndex === si
      ) {
        lineCursor += 1;
      }
      continue;
    }

    // Scene with audio URL
    if (sc.audioUrl) {
      const caption = sc.dialogue || sc.narration || sc.title;
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
            ctx, w, h, sc, headline, caption, imgTop, imgBot, t, intensity,
            true, caption.length, facePerformance,
            lineCues[lineCursor] || null, lineEnergy[lineCursor] || null,
            durSec, layout, use3dAvatar, bodyPerformance,
            lipTop, lipBot,
          );
          if (t < durSec) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      await done.catch(() => undefined);
      while (
        lineCursor < dialogueLines.length &&
        dialogueLines[lineCursor]?.sceneIndex === si
      ) {
        lineCursor += 1;
      }
      continue;
    }

    // Timed dialogue lines for this scene
    const sceneLineIndexes: number[] = [];
    for (let i = 0; i < dialogueLines.length; i++) {
      if (dialogueLines[i]?.sceneIndex === si) sceneLineIndexes.push(i);
    }

    if (sceneLineIndexes.length === 0) {
      const caption = sc.narration || sc.title;
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
            ctx, w, h, sc, headline, caption, imgTop, imgBot, t, intensity,
            false, 0, facePerformance, null, null, durSec, layout, use3dAvatar, bodyPerformance,
            lipTop, lipBot,
          );
          if (t < durSec) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      continue;
    }

    for (const idx of sceneLineIndexes) {
      if (signal?.stopped) break;
      const dline = dialogueLines[idx]!;
      const line = timed[idx] || {
        text: dline.text,
        speaker: dline.speaker,
        buffer: null,
        durationSec: Math.max(2.2, Math.min(12, dline.text.length / 14)),
      };
      const caption = line.speaker
        ? `${line.speaker}: ${line.text}`
        : line.text;
      options.onCaption?.(caption);

      const durSec = lineDur[idx] || line.durationSec || 3;

      if (line.buffer && audioCtx) {
        try {
          const src = audioCtx.createBufferSource();
          src.buffer = line.buffer;
          src.connect(audioCtx.destination);
          src.start();
        } catch {
          void speakBrowser(
            line.text.slice(0, 400),
            options.language,
            line.speaker || "Narrator",
            options.voiceGender || "auto",
          );
        }
      } else {
        void speakBrowser(
          line.text.slice(0, 400),
          options.language,
          line.speaker || "Narrator",
          options.voiceGender || "auto",
        );
      }

      const start = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          if (signal?.stopped) {
            resolve();
            return;
          }
          const t = (performance.now() - start) / 1000;
          drawFrame(
            ctx, w, h, sc, headline, caption, imgTop, imgBot, t, intensity,
            true, line.text.length, facePerformance,
            lineCues[idx] || null, lineEnergy[idx] || null,
            durSec, layout, use3dAvatar, bodyPerformance,
            lipTop, lipBot,
          );
          if (t < durSec) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
    }
    lineCursor = Math.max(lineCursor, Math.max(...sceneLineIndexes, -1) + 1);
  }

  if (recorder && recorder.state !== "inactive") {
    await new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve();
      try {
        recorder!.stop();
      } catch {
        resolve();
      }
      window.setTimeout(resolve, 1500);
    });
  }

  const blob = chunks.length > 0 ? new Blob(chunks, { type: mimeType }) : null;
  return { blob, mimeType, extension, hadAudioTrack, usedRhubarb };
}
