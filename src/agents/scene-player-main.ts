/**
 * Scene player orchestration — cinema play/export.
 */
import {
  type PlayerScene,
  type PlayerOptions,
  type PlayResult,
  type FaceOpts,
  parseTurns,
  MOOD_COLORS,
  applyMoodGrade,
  drawCaptionBar,
  drawPanel,
} from "./scene-player-draw";
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

// Re-export public types
export type { PlayerScene, PlayerOptions, PlayResult };

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

// TEMP STUB — full playScenesOnCanvas restored next commit
export async function playScenesOnCanvas(
  _canvas: HTMLCanvasElement,
  _scenes: PlayerScene[],
  _options: PlayerOptions,
  _stopRef?: { stopped: boolean },
): Promise<PlayResult> {
  return { blob: null, mimeType: "video/webm", extension: "webm", hadAudioTrack: false };
}
