import type { AgentRunInput, AgentRunResult } from "./types";

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

function pickVoice(
  speaker: string,
  language: "en" | "hi",
  gender: "auto" | "male" | "female" = "auto",
): SpeechSynthesisVoice | null {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = language === "hi" ? "hi" : "en";
  const ranked = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(langPrefix),
  );
  const pool = ranked.length ? ranked : voices;
  if (!pool.length) return null;
  const genderMatches = pool.filter((v) => gender === "auto" || (gender === "female"
    ? /female|woman|zira|susan|aria|jenny|samantha|karen|moira|tessa|veena|lekha/i.test(v.name)
    : /male|man|david|mark|guy|daniel|james|george|rishi|hemant/i.test(v.name)));
  const selectedPool = genderMatches.length ? genderMatches : pool;

  // Heuristic: different speakers get different voices
  let hash = 0;
  for (let i = 0; i < speaker.length; i++)
    hash = (hash + speaker.charCodeAt(i) * (i + 1)) % selectedPool.length;
  return selectedPool[hash] ?? selectedPool[0];
}

export function speakLine(
  line: NarrationLine,
  language: "en" | "hi",
  inputVoiceGender: "auto" | "male" | "female" = "auto",
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("Web Speech API not available"));
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(line.text);
    u.lang = language === "hi" ? "hi-IN" : "en-IN";
    const voice = pickVoice(line.speaker, language, inputVoiceGender);
    if (voice) u.voice = voice;

    // Light character differentiation (not real voice clone)
    const isNarrator = /narrat/i.test(line.speaker);
    u.rate = isNarrator ? 0.95 : 1.05;
    u.pitch = isNarrator ? 1.0 : 1.05 + (line.speaker.length % 5) * 0.04;

    u.onend = () => resolve();
    u.onerror = () => resolve(); // don't hard-fail pipeline
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

  // Warm voices list (Chrome loads async)
  window.speechSynthesis.getVoices();

  for (let i = 0; i < plan.length; i++) {
    onLine?.(plan[i], i, plan.length);
    await speakLine(plan[i], input.language, input.options?.voiceGender ?? "auto");
    await new Promise((r) => setTimeout(r, 220));
  }

  return {
    agentId: "voice",
    status: "succeeded",
    message: `Narrated ${plan.length} lines with free browser TTS (system voices — not true character clones).`,
    outputText: plan
      .map((l) => `[${l.sceneTitle}] ${l.speaker}: ${l.text}`)
      .join("\n"),
    data: { plan, engine: "web-speech" },
    durationMs: performance.now() - t0,
  };
}

export function stopVoice() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
