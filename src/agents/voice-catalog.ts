/**
 * Free browser TTS voice catalog (Web Speech API).
 * No paid APIs — maps friendly labels to system voice name heuristics.
 */

export type VoiceGender = "male" | "female";

export interface VoiceOption {
  id: string;
  label: string;
  labelHi: string;
  gender: VoiceGender;
  /** Used for narrator vs character defaults */
  role: "narrator" | "character";
  /** Substrings matched against SpeechSynthesisVoice.name */
  match: string[];
  pitch: number;
  rate: number;
}

/** Narration: 4 options (2M + 2F) */
export const NARRATOR_VOICES: VoiceOption[] = [
  {
    id: "nar-m1",
    label: "Narrator Deep (Male)",
    labelHi: "कथावाचक गंभीर (पुरुष)",
    gender: "male",
    role: "narrator",
    match: ["david", "mark", "james", "george", "daniel", "rishi", "hemant", "male"],
    pitch: 0.92,
    rate: 0.92,
  },
  {
    id: "nar-m2",
    label: "Narrator Warm (Male)",
    labelHi: "कथावाचक नरम (पुरुष)",
    gender: "male",
    role: "narrator",
    match: ["guy", "thomas", "fred", "alex", "male"],
    pitch: 1.0,
    rate: 0.95,
  },
  {
    id: "nar-f1",
    label: "Narrator Soft (Female)",
    labelHi: "कथावाचक कोमल (महिला)",
    gender: "female",
    role: "narrator",
    match: ["zira", "susan", "samantha", "karen", "veena", "lekha", "female"],
    pitch: 1.05,
    rate: 0.94,
  },
  {
    id: "nar-f2",
    label: "Narrator Clear (Female)",
    labelHi: "कथावाचक स्पष्ट (महिला)",
    gender: "female",
    role: "narrator",
    match: ["aria", "jenny", "moira", "tessa", "heather", "female"],
    pitch: 1.08,
    rate: 0.96,
  },
];

/** Character dialogue: 6 options (3M + 3F) */
export const CHARACTER_VOICES: VoiceOption[] = [
  {
    id: "ch-m1",
    label: "Hero Strong (Male)",
    labelHi: "नायक मजबूत (पुरुष)",
    gender: "male",
    role: "character",
    match: ["david", "mark", "james", "rishi", "male"],
    pitch: 0.95,
    rate: 1.02,
  },
  {
    id: "ch-m2",
    label: "Young Male",
    labelHi: "युवा पुरुष",
    gender: "male",
    role: "character",
    match: ["guy", "daniel", "george", "male"],
    pitch: 1.08,
    rate: 1.06,
  },
  {
    id: "ch-m3",
    label: "Elder Male",
    labelHi: "वरिष्ठ पुरुष",
    gender: "male",
    role: "character",
    match: ["fred", "thomas", "hemant", "male"],
    pitch: 0.88,
    rate: 0.9,
  },
  {
    id: "ch-f1",
    label: "Heroine Soft (Female)",
    labelHi: "नायिका कोमल (महिला)",
    gender: "female",
    role: "character",
    match: ["zira", "samantha", "veena", "lekha", "female"],
    pitch: 1.12,
    rate: 1.02,
  },
  {
    id: "ch-f2",
    label: "Young Female",
    labelHi: "युवा महिला",
    gender: "female",
    role: "character",
    match: ["aria", "jenny", "karen", "female"],
    pitch: 1.18,
    rate: 1.08,
  },
  {
    id: "ch-f3",
    label: "Warm Female",
    labelHi: "नरम महिला",
    gender: "female",
    role: "character",
    match: ["susan", "moira", "tessa", "heather", "female"],
    pitch: 1.06,
    rate: 0.98,
  },
];

export function listNarratorVoices(language: "en" | "hi"): Array<{ id: string; label: string }> {
  return NARRATOR_VOICES.map((v) => ({
    id: v.id,
    label: language === "hi" ? v.labelHi : v.label,
  }));
}

export function listCharacterVoices(language: "en" | "hi"): Array<{ id: string; label: string }> {
  return CHARACTER_VOICES.map((v) => ({
    id: v.id,
    label: language === "hi" ? v.labelHi : v.label,
  }));
}

function findOption(id: string | undefined): VoiceOption | null {
  if (!id) return null;
  return (
    NARRATOR_VOICES.find((v) => v.id === id) ||
    CHARACTER_VOICES.find((v) => v.id === id) ||
    null
  );
}

/** Pick best system voice for an option + language */
export function resolveSystemVoice(
  optionId: string | undefined,
  language: "en" | "hi",
  fallbackGender: VoiceGender = "male",
): { voice: SpeechSynthesisVoice | null; pitch: number; rate: number } {
  if (!("speechSynthesis" in window)) {
    return { voice: null, pitch: 1, rate: 1 };
  }
  const opt = findOption(optionId);
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = language === "hi" ? "hi" : "en";
  const ranked = voices.filter((v) => v.lang.toLowerCase().startsWith(langPrefix));
  const pool = ranked.length ? ranked : voices;

  if (!pool.length) return { voice: null, pitch: opt?.pitch ?? 1, rate: opt?.rate ?? 1 };

  const gender = opt?.gender ?? fallbackGender;
  const matchList = opt?.match ?? (gender === "female" ? ["female"] : ["male"]);

  // Score by name match
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const v of pool) {
    const name = v.name.toLowerCase();
    let score = 0;
    for (const m of matchList) {
      if (name.includes(m.toLowerCase())) score += 3;
    }
    if (gender === "female" && /female|woman|zira|aria|jenny|samantha|veena|lekha/.test(name))
      score += 2;
    if (gender === "male" && /male|man|david|mark|guy|rishi|hemant|daniel/.test(name))
      score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  if (!best) {
    // Gender heuristic fallback
    const gPool = pool.filter((v) =>
      gender === "female"
        ? /female|woman|zira|susan|aria|jenny|samantha|karen|veena|lekha/i.test(v.name)
        : /male|man|david|mark|guy|daniel|james|rishi|hemant/i.test(v.name),
    );
    best = (gPool[0] || pool[0]) ?? null;
  }

  return {
    voice: best,
    pitch: opt?.pitch ?? 1,
    rate: opt?.rate ?? 1,
  };
}

/** Stable character → voice id mapping from speaker name */
export function characterVoiceIdForSpeaker(
  speaker: string,
  preferredGender?: VoiceGender,
): string {
  const isNarrator = /narrat|कथा|वाचक/i.test(speaker);
  if (isNarrator) return preferredGender === "female" ? "nar-f1" : "nar-m1";

  let hash = 0;
  for (let i = 0; i < speaker.length; i++) hash = (hash + speaker.charCodeAt(i) * (i + 1)) % 1000;

  const pool =
    preferredGender === "female"
      ? CHARACTER_VOICES.filter((v) => v.gender === "female")
      : preferredGender === "male"
        ? CHARACTER_VOICES.filter((v) => v.gender === "male")
        : CHARACTER_VOICES;
  return pool[hash % pool.length]?.id || "ch-m1";
}
