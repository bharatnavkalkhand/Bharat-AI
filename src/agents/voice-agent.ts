import type { AgentRunInput, AgentRunResult } from "./types";
import {
  resolveSystemVoice,
  characterVoiceIdForSpeaker,
  type VoiceGender,
} from "./voice-catalog";

export interface NarrationLine {
  sceneId: string;
  sceneTitle: string;
  speaker: string;
  text: string;
  mood: string;
}

/** Parse dialogue lines like "Name: text" into speaker turns */
export function parseDialogueLines(
  dialogue: string,
  fallbackSpeaker = "Narrator",
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

export function buildNarrationPlan(input: AgentRunInput): NarrationLine[] {
  const plan: NarrationLine[] = [];
  const scenes = [...input.scenes].sort((a, b) => a.order - b.order);
  for (const sc of scenes) {
    if (sc.narration?.trim()) {
      plan.push({
        sceneId: sc.id,
        sceneTitle: sc.title,
        speaker: "Narrator",
        text: sc.narration.trim(),
        mood: sc.mood,
      });
    }
    if (sc.dialogue?.trim()) {
      for (const turn of parseDialogueLines(sc.dialogue)) {
        plan.push({
          sceneId: sc.id,
          sceneTitle: sc.title,
          speaker: turn.speaker,
          text: turn.text,
          mood: sc.mood,
        });
      }
    }
  }
  return plan;
}

export interface SpeakOptions {
  language: "en" | "hi";
  /** auto | male | female — coarse filter */
  voiceGender?: "auto" | VoiceGender;
  /** Explicit catalog id for narrator lines */
  narratorVoiceId?: string;
  /** Explicit catalog id for character lines (or per-speaker map later) */
  characterVoiceId?: string;
}

export function speakLine(
  line: NarrationLine,
  opts: SpeakOptions,
): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
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
      ? opts.narratorVoiceId ||
        (gender === "female" ? "nar-f1" : "nar-m1")
      : opts.characterVoiceId ||
        characterVoiceIdForSpeaker(line.speaker, gender);

    const resolved = resolveSystemVoice(
      optionId,
      opts.language,
      gender || (isNarrator ? "male" : "male"),
    );
    if (resolved.voice) u.voice = resolved.voice;
    u.pitch = resolved.pitch;
    u.rate = resolved.rate;

    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export async function runVoiceAgent(
  input: AgentRunInput,
  onLine?: (line: NarrationLine, index: number, total: number) => void,
): Promise<AgentRunResult> {
  const t0 = performance.now();
  const plan = buildNarrationPlan(input);

  if (!plan.length) {
    return {
      agentId: "voice",
      status: "failed",
      message: "No dialogue or narration to speak. Generate a script first.",
      durationMs: performance.now() - t0,
    };
  }

  if (!("speechSynthesis" in window)) {
    return {
      agentId: "voice",
      status: "needs_upgrade",
      message:
        "Browser TTS unavailable. Upgrade path: self-host Piper/Coqui XTTS for real character voices.",
      data: { plan },
      durationMs: performance.now() - t0,
    };
  }

  window.speechSynthesis.getVoices();

  const speakOpts: SpeakOptions = {
    language: input.language,
    voiceGender: input.options?.voiceGender ?? "auto",
    narratorVoiceId: input.options?.narratorVoiceId as string | undefined,
    characterVoiceId: input.options?.characterVoiceId as string | undefined,
  };

  for (let i = 0; i < plan.length; i++) {
    onLine?.(plan[i], i, plan.length);
    await speakLine(plan[i], speakOpts);
    await new Promise((r) => setTimeout(r, 220));
  }

  return {
    agentId: "voice",
    status: "succeeded",
    message: `Narrated ${plan.length} lines (catalog voices — free browser TTS).`,
    outputText: plan
      .map((l) => `[${l.sceneTitle}] ${l.speaker}: ${l.text}`)
      .join("\n"),
    data: { plan, engine: "web-speech-catalog" },
    durationMs: performance.now() - t0,
  };
}

export function stopVoice() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
