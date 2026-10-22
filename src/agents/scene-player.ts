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
