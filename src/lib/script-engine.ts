import type { Language, MovieDuration, SceneMood } from "./types";
import { moodToPromptHint } from "./types";

export interface GeneratedCharacter {
  name: string;
  role: string;
  appearance: string;
  personality?: string;
}

export interface GeneratedScene {
  title: string;
  mood: SceneMood;
  dialogue: string;
  gestureNotes: string;
  visualPrompt: string;
  narration?: string;
  estimatedDurationSec: number;
}

export interface ScriptOutput {
  title: string;
  logline: string;
  synopsis: string;
  characters: GeneratedCharacter[];
  scenes: GeneratedScene[];
  fullScriptText: string;
  language: Language;
  note: string;
}

/** Remove title loops like "ram katha: ram katha: ram katha: …" */
function cleanIdea(raw: string, title: string): string {
  let s = (raw || "").trim();
  if (!s) return "";
  // Collapse repeated "word:" prefixes
  s = s.replace(/(\S{2,40}:\s*)\1+/gi, "$1");
  // Strip repeated title
  const t = title.trim();
  if (t.length >= 3) {
    const re = new RegExp(
      `(${escapeReg(t)}\s*[:\-–—]?\s*)+`,
      "gi",
    );
    s = s.replace(re, "").trim();
  }
  // Collapse any short token repeated 3+ times at start
  s = s.replace(/^((\S{2,30})\s*[:\-]?\s*){3,}/u, "").trim();
  s = s.replace(/\s{2,}/g, " ").trim();
  return s || raw.trim();
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sceneCount(duration: MovieDuration): number {
  return duration === "10min" ? 8 : 5;
}

function secPerScene(duration: MovieDuration, count: number): number {
  const total = duration === "10min" ? 600 : 300;
  return Math.round(total / count);
}

function isRamayanaStory(text: string): boolean {
  return /राम|सीता|लक्ष्मण|रघुनंदन|हनुमान|रावण|गज|हाथी|हाथिनी|शाप|वनवास|ayodhya|rama|sita|elephant|curse/i.test(
    text,
  );
}

/** Split long prose into ordered story beats for scenes */
function splitBeats(idea: string, max: number): string[] {
  const cleaned = idea.replace(/\n+/g, " ").trim();
  if (!cleaned) return [];
  // Prefer sentence boundaries (Hindi danda / Latin)
  let parts = cleaned
    .split(/(?<=[।.!?]\s*)/)
    .map((p) => p.trim())
    .filter((p) => p.length > 12);
  if (parts.length < 2) {
    // Split on commas / then for long single block
    parts = cleaned
      .split(/[,;]\s+|\s+तब\s+|\s+फिर\s+|\s+और\s+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 15);
  }
  if (parts.length === 0) parts = [cleaned];
  // Merge tiny fragments
  const merged: string[] = [];
  for (const p of parts) {
    if (merged.length && merged[merged.length - 1].length < 40) {
      merged[merged.length - 1] += " " + p;
    } else {
      merged.push(p);
    }
  }
  // Cap / expand to max
  if (merged.length > max) {
    const out: string[] = [];
    const chunk = Math.ceil(merged.length / max);
    for (let i = 0; i < merged.length; i += chunk) {
      out.push(merged.slice(i, i + chunk).join(" "));
    }
    return out.slice(0, max);
  }
  return merged.slice(0, max);
}

function moodForBeat(beat: string, index: number, total: number): SceneMood {
  const b = beat.toLowerCase();
  if (/शाप|क्रोध|क्षुब्ध|लड़ाई|युद्ध|मार|fight|curse|angry/.test(b))
    return index === 0 ? "dramatic" : "fight";
  if (/प्रेम|माफी|प्रार्थना|दया|रोमांस|love|forgive|soft/.test(b))
    return "romance";
  if (/दुख|दीन|रोना|emotional|sad/.test(b)) return "emotional";
  if (/क्रिया|क्रीड़ा|खेल|gesture|play/.test(b)) return "gesture";
  if (index === 0) return "dialogue";
  if (index === total - 1) return "emotional";
  if (index % 3 === 1) return "action";
  return "dialogue";
}

function titleForBeat(beat: string, index: number, hi: boolean): string {
  const b = beat;
  if (/शाप/.test(b)) return hi ? `दृश्य ${index + 1} — शाप` : `Scene ${index + 1} — Curse`;
  if (/प्रार्थना|दीन/.test(b))
    return hi ? `दृश्य ${index + 1} — प्रार्थना` : `Scene ${index + 1} — Prayer`;
  if (/निवृत्ति|संतुष्ट|सुख/.test(b))
    return hi ? `दृश्य ${index + 1} — शाप-निवृत्ति` : `Scene ${index + 1} — Relief`;
  if (/सीता|पता/.test(b))
    return hi ? `दृश्य ${index + 1} — सीता की खोज` : `Scene ${index + 1} — Search for Sita`;
  if (/गजोपसेचन|जल|अचेत/.test(b))
    return hi ? `दृश्य ${index + 1} — गजोपसेचन` : `Scene ${index + 1} — Gajopasechan`;
  if (index === 0) return hi ? "दृश्य 1 — आरंभ" : "Scene 1 — Beginning";
  if (index === 0) return hi ? "आरंभ" : "Opening";
  return hi ? `दृश्य ${index + 1}` : `Scene ${index + 1}`;
}

function dialogueFromBeat(
  beat: string,
  chars: GeneratedCharacter[],
  hi: boolean,
  mood: SceneMood,
): string {
  const a = chars[0]?.name || (hi ? "कथावाचक" : "Narrator");
  const b = chars[1]?.name || chars[0]?.name || a;
  const c = chars[2]?.name;

  // Mythic dialogue shaped from the beat text
  if (/राम|श्री राम|रघुनंदन/.test(beat) && /हाथी/.test(beat)) {
    if (/शाप/.test(beat) && !/निवृत्ति/.test(beat)) {
      return hi
        ? `श्री राम: हे गज! सीता माता का समाचार दो।\nहाथी: (मौन — हाथिनी के संग क्रीड़ा)\nश्री राम: हाथिनी के संग रमण करोगे तो प्राण चले जाएंगे!`
        : `Shri Ram: O elephant, tell me of Sita.\nElephant: (silent, plays with mate)\nShri Ram: Sport with her and your life shall leave you!`;
    }
    if (/प्रार्थना|दीन/.test(beat)) {
      return hi
        ? `हाथी: प्रभु, क्षमा करें!\nहाथिनी: हे रघुनंदन, दया कीजिए।\nश्री राम: …`
        : `Elephant: Lord, forgive us!\nMate: O Raghunandan, show mercy.\nShri Ram: …`;
    }
    if (/निवृत्ति|गजोपसेचन|जल/.test(beat)) {
      return hi
        ? `श्री राम: रमण के समय अचेत गिरोगे; हाथिनी जल छिड़के तो प्राण बचेंगे। सात दिन पश्चात वन में विहार। यही गजोपसेचन।\nहाथी: प्रभु की जय हो!`
        : `Shri Ram: When you unite you shall fall senseless; she shall sprinkle water and save you. After seven days roam the forest. This is Gajopasechan.\nElephant: Glory to the Lord!`;
    }
    return hi
      ? `श्री राम: ${beat.slice(0, 90)}\n${b}: …`
      : `Shri Ram: ${beat.slice(0, 100)}\n${b}: …`;
  }

  // Generic: first line paraphrase beat, second reacts
  const short = beat.length > 100 ? beat.slice(0, 97) + "…" : beat;
  if (mood === "fight" || mood === "action") {
    return hi
      ? `${a}: ${short}\n${c || b}: अब क्या होगा?`
      : `${a}: ${short}\n${c || b}: What now?`;
  }
  if (mood === "romance" || mood === "emotional") {
    return hi
      ? `${a}: ${short}\n${b}: हृदय सुन रहा है।`
      : `${a}: ${short}\n${b}: The heart hears.`;
  }
  return hi
    ? `${a}: ${short}\n${b}: आगे क्या?`
    : `${a}: ${short}\n${b}: What follows?`;
}

function charactersForStory(
  idea: string,
  language: Language,
  genres: string[],
): GeneratedCharacter[] {
  const hi = language === "hi";
  if (isRamayanaStory(idea)) {
    return [
      {
        name: hi ? "श्री राम" : "Shri Ram",
        role: hi ? "भगवान / नायक" : "Lord / Protagonist",
        appearance: hi
          ? "धनुष-बाण, पीतांबर, शांत किंतु गंभीर मुख"
          : "Bow and arrow, yellow robe, calm but stern face",
        personality: hi ? "धर्मनिष्ठ, करुणामय" : "Righteous, compassionate",
      },
      {
        name: hi ? "हाथी" : "Elephant",
        role: hi ? "गज" : "Elephant",
        appearance: hi
          ? "विशाल गज, वन में क्रीड़ारत"
          : "Great elephant, playful in the forest",
        personality: hi ? "मोहित, फिर विनीत" : "Entranced, then humble",
      },
      {
        name: hi ? "हाथिनी" : "Elephant-mate",
        role: hi ? "संगिनी" : "Mate",
        appearance: hi ? "हाथिनी, स्नेहपूर्ण" : "She-elephant, affectionate",
        personality: hi ? "भक्त, रक्षक" : "Devoted, protective",
      },
    ];
  }

  const hasFight =
    genres.includes("action") ||
    /fight|battle|sword|war|लड़ाई|युद्ध/i.test(idea);
  const hasRomance =
    genres.includes("romance") ||
    /love|romance|प्रेम|प्यार/i.test(idea);

  // Try extract proper names (2+ Devanagari or Capitalized words)
  const nameHits =
    idea.match(/[A-Z][a-z]{2,}|(?:[\u0900-\u097F]{2,})/g)?.filter(
      (n) =>
        !/^(यह|वह|और|फिर|तब|एक|की|के|को|से|पर|में|है|था|the|and|for|with)$/i.test(
          n,
        ),
    ) || [];
  const uniq: string[] = [];
  for (const n of nameHits) {
    if (!uniq.includes(n) && n.length >= 2) uniq.push(n);
    if (uniq.length >= 3) break;
  }

  if (uniq.length >= 2) {
    return uniq.slice(0, 3).map((name, i) => ({
      name,
      role:
        i === 0
          ? hi
            ? "नायक"
            : "Protagonist"
          : i === 1
            ? hi
              ? "सहपात्र"
              : "Supporting"
            : hi
              ? "अन्य"
              : "Other",
      appearance: hi
        ? "कहानी के अनुरूप वेश"
        : "Costume matching the story",
    }));
  }

  const hero = hi ? (hasFight ? "अरजुन" : "आदित्य") : hasFight ? "Arjun" : "Aditya";
  const love = hi ? (hasRomance ? "मीरा" : "अन्या") : hasRomance ? "Meera" : "Anya";
  const list: GeneratedCharacter[] = [
    {
      name: hero,
      role: hi ? "नायक" : "Protagonist",
      appearance: hi
        ? "दृढ़ नज़र, साधारण कपड़े"
        : "Determined eyes, simple clothes",
    },
    {
      name: love,
      role: hi ? (hasRomance ? "प्रेमिका" : "सहयोगी") : hasRomance ? "Love interest" : "Ally",
      appearance: hi ? "कोमल मुस्कान" : "Soft smile",
    },
  ];
  if (hasFight) {
    list.push({
      name: hi ? "विक्रम" : "Vikram",
      role: hi ? "प्रतिद्वंद्वी" : "Rival",
      appearance: hi ? "तीखी नज़र, काले कपड़े" : "Sharp gaze, dark clothes",
    });
  }
  return list;
}

/**
 * Zero-cost script engine — browser only.
 * MUST follow the user's story text; no forced modern romance template.
 */
export function generateScript(input: {
  title: string;
  idea: string;
  language: Language;
  targetDuration: MovieDuration;
  genres: string[];
}): ScriptOutput {
  const language = input.language ?? "hi";
  const genres = input.genres?.length ? input.genres : ["drama"];
  const title = (input.title || (language === "hi" ? "कथा" : "Story")).trim();
  const idea = cleanIdea(input.idea || input.title || "", title);
  const hi = language === "hi";
  const characters = charactersForStory(idea, language, genres);
  const n = sceneCount(input.targetDuration);
  const sec = secPerScene(input.targetDuration, n);
  const beats = splitBeats(idea, n);

  // Ensure we have enough beats
  while (beats.length < n) {
    beats.push(
      hi
        ? `${idea.slice(0, 60)} — आगे का प्रसंग (${beats.length + 1})`
        : `${idea.slice(0, 60)} — continuation (${beats.length + 1})`,
    );
  }

  const scenes: GeneratedScene[] = beats.slice(0, n).map((beat, i) => {
    const mood = moodForBeat(beat, i, n);
    const narration =
      i === 0 || beat.length > 80
        ? beat.length > 140
          ? beat.slice(0, 137) + "…"
          : beat
        : undefined;
    return {
      title: titleForBeat(beat, i, hi),
      mood,
      dialogue: dialogueFromBeat(beat, characters, hi, mood),
      gestureNotes: hi
        ? mood === "fight"
          ? "क्रोध, हाथ उठाना, गंभीर खड़े होना"
          : mood === "romance" || mood === "emotional"
            ? "प्रणाम, दीन मुद्रा, आशीष"
            : "वन में चलना, एक-दूसरे की ओर देखना"
        : mood === "fight"
          ? "Anger, raised hand, stern stance"
          : "Walk in forest, look toward each other",
      visualPrompt: isRamayanaStory(idea)
        ? `Epic Ramayana forest, ${characters.map((c) => c.name).join(", ")}, ${moodToPromptHint(mood)}, ${beat.slice(0, 50)}`
        : `${moodToPromptHint(mood)}, ${beat.slice(0, 60)}`,
      narration,
      estimatedDurationSec: sec,
    };
  });

  const logline = isRamayanaStory(idea)
    ? hi
      ? `श्री राम, हाथी और शाप की कथा — ${idea.slice(0, 80)}${idea.length > 80 ? "…" : ""}`
      : `The tale of Shri Ram, the elephant, and a curse — ${idea.slice(0, 90)}`
    : hi
      ? `${characters[0]?.name || title}: ${idea.slice(0, 100)}${idea.length > 100 ? "…" : ""}`
      : `${characters[0]?.name || title}: ${idea.slice(0, 110)}`;

  const synopsis = hi
    ? `${title}\n\n${idea}\n\nपात्र: ${characters.map((c) => c.name).join(", ")}। अवधि ~${input.targetDuration === "10min" ? "10" : "5"} मिनट।`
    : `${title}\n\n${idea}\n\nCast: ${characters.map((c) => c.name).join(", ")}. ~${input.targetDuration === "10min" ? "10" : "5"} min.`;

  const fullScriptText = buildFullScript({
    title,
    logline,
    characters,
    scenes,
    language,
  });

  return {
    title,
    logline,
    synopsis,
    characters,
    scenes,
    fullScriptText,
    language,
    note: hi
      ? "स्क्रिप्ट आपकी दी हुई कहानी से बनी है (ब्राउज़र, ₹0)। दृश्य संपादित कर सकते हैं।"
      : "Script built from your story text (browser, ₹0). You can edit every scene.",
  };
}

function buildFullScript(opts: {
  title: string;
  logline: string;
  characters: GeneratedCharacter[];
  scenes: GeneratedScene[];
  language: Language;
}): string {
  const hi = opts.language === "hi";
  const lines: string[] = [];
  lines.push(`TITLE: ${opts.title}`);
  lines.push(`LOGLINE: ${opts.logline}`);
  lines.push("");
  lines.push(hi ? "=== पात्र ===" : "=== CHARACTERS ===");
  for (const c of opts.characters) {
    lines.push(`• ${c.name} (${c.role}) — ${c.appearance}`);
  }
  lines.push("");
  lines.push(hi ? "=== स्क्रिप्ट ===" : "=== SCRIPT ===");
  opts.scenes.forEach((sc, i) => {
    lines.push("");
    lines.push(
      `--- SCENE ${i + 1}: ${sc.title} [${sc.mood}] (~${sc.estimatedDurationSec}s) ---`,
    );
    if (sc.narration) lines.push(`NARRATION: ${sc.narration}`);
    if (sc.gestureNotes) lines.push(`GESTURE: ${sc.gestureNotes}`);
    lines.push(sc.dialogue);
    if (sc.visualPrompt) lines.push(`VISUAL: ${sc.visualPrompt}`);
  });
  lines.push("");
  lines.push(hi ? "— समाप्त —" : "— END —");
  return lines.join("\n");
}

export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
