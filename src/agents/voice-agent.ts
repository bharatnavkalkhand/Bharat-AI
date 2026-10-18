import type { AgentRunInput, AgentRunResult } from "./types";
import {
  characterVoiceIdForSpeaker,
  resolveSystemVoice,
  type VoiceGender,
} from "./voice-catalog";

export interface SpokenLine {
  sceneId: string;
  sceneTitle: string;
  speaker: string;
  text: string;
  durationSec: number;
}

/** @deprecated use SpokenLine — kept for orchestrator callback naming */
export type NarrationLine = SpokenLine;

/** Parse dialogue lines like "Name: text" into speaker turns */
export function parseDialogueTurns(
  dialogue: string,
  fallbackSpeaker = "Character",
): Array<{ speaker: string; text: string }> {
  const lines = dialogue
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<{ speaker: string; text: string }> = [];
  for (const line of lines) {
    const m = line.match(/^([^:]{1,40}):\s*(.+)$/);
    if (m) out.push({ speaker: m[1].trim(), text: m[2].trim() });
    else out.push({ speaker: fallbackSpeaker, text: line });
  }
  return out.length ? out : [{ speaker: fallbackSpeaker, text: dialogue }];
}

export function buildSpeakPlan(input: AgentRunInput): SpokenLine[] {
  const plan: SpokenLine[] = [];
  const scenes = (input.scenes || [])
    .slice()
    .sort((a, b) => a.order - b.order);
  for (const sc of scenes) {
    if (sc.narration?.trim()) {
      plan.push({
        sceneId: sc.id,
        sceneTitle: sc.title,
        speaker: "Narrator",
        text: sc.narration.trim(),
        durationSec: Math.min(12, Math.max(2, sc.narration.trim().length / 14)),
      });
    }
    if (sc.dialogue?.trim()) {
      for (const turn of parseDialogueTurns(sc.dialogue)) {
        plan.push({
          sceneId: sc.id,
          sceneTitle: sc.title,
          speaker: turn.speaker,
          text: turn.text,
          durationSec: Math.min(10, Math.max(1.5, turn.text.length / 14)),
        });
      }
    }
  }
  return plan;
}

export interface SpeakOptions {
  language: "en" | "hi";
  voiceGender?: "auto" | VoiceGender;
  narratorVoiceId?: string;
  characterVoiceId?: string;
}

export function speakLine(
  line: SpokenLine,
  opts: SpeakOptions,
): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !line.text.trim()) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(line.text);
    u.lang = opts.language === "hi" ? "hi-IN" : "en-IN";
    const isNarrator = /narrat|कथा|वाचक/i.test(line.speaker);
    const gender: VoiceGender | undefined =
      opts.voiceGender === "male" || opts.voiceGender === "female"
        ? opts.voiceGender
        : undefined;
    const optionId = isNarrator
      ? opts.narratorVoiceId || (gender === "female" ? "nar-f1" : "nar-m1")
      : opts.characterVoiceId ||
        characterVoiceIdForSpeaker(line.speaker, gender);
    const resolved = resolveSystemVoice(
      optionId,
      opts.language,
      gender || "male",
    );
    if (resolved.voice) u.voice = resolved.voice;
    if (gender === "female") {
      u.pitch = Math.max(resolved.pitch, 1.15);
      u.rate = resolved.rate;
    } else if (gender === "male") {
      u.pitch = Math.min(resolved.pitch, 0.9);
      u.rate = resolved.rate;
    } else {
      u.pitch = resolved.pitch;
      u.rate = resolved.rate;
    }
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    window.setTimeout(resolve, Math.min(20000, 800 + line.text.length * 80));
  });
}

export function stopVoice() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export async function runVoiceAgent(
  input: AgentRunInput,
): Promise<AgentRunResult> {
  const plan = buildSpeakPlan(input);
  if (!plan.length) {
    return {
      agentId: "voice",
      status: "skipped",
      message: "No dialogue or narration to speak. Generate a script first.",
      data: { lines: [] },
    };
  }

  if (!("speechSynthesis" in window)) {
    return {
      agentId: "voice",
      status: "needs_upgrade",
      message: "Browser has no speechSynthesis — use device with TTS support.",
      data: { lines: plan },
    };
  }

  await new Promise<void>((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) {
      resolve();
      return;
    }
    const done = () => {
      window.speechSynthesis.onvoiceschanged = null;
      resolve();
    };
    window.speechSynthesis.onvoiceschanged = done;
    window.setTimeout(done, 700);
  });

  const speakOpts: SpeakOptions = {
    language: input.language,
    voiceGender: input.options?.voiceGender ?? "auto",
  };

  const sample = plan.slice(0, 3);
  for (let i = 0; i < sample.length; i++) {
    await speakLine(sample[i]!, speakOpts);
  }

  return {
    agentId: "voice",
    status: "succeeded",
    message: `Voice ready (${plan.length} lines). Gender=${speakOpts.voiceGender}. Full audio plays on Play/Export.`,
    data: {
      lines: plan,
      preview: sample
        .map((l) => `[${l.sceneTitle}] ${l.speaker}: ${l.text}`)
        .join("\n"),
    },
  };
}
