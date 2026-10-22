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
      // Pass actual cover-fit draw rect so MediaPipe lips land on the mouth,
      // not chest (panel coords were wrong when image is cropped/panned).
      drawFaceOverlay(ctx, x, y, w, h, anim, faceOpts.lip, {
        dx,
        dy,
        dw,
        dh,
      });
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
