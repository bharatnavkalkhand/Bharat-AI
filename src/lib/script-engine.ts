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

function pickNames(language: Language, genres: string[]) {
  const hi = language === "hi";
  const hasFight = genres.includes("action") || genres.some((g) => /fight|action/i.test(g));
  const hasRomance = genres.includes("romance") || genres.some((g) => /romance|love/i.test(g));

  if (hi) {
    return {
      hero: hasFight ? "अरजुन" : "आदित्य",
      love: hasRomance ? "मीरा" : "अन्या",
      rival: "विक्रम",
      mentor: "गुरुदेव",
    };
  }
  return {
    hero: hasFight ? "Arjun" : "Aditya",
    love: hasRomance ? "Meera" : "Anya",
    rival: "Vikram",
    mentor: "Gurudev",
  };
}

function extractKeywords(idea: string): string[] {
  const stop = new Set(
    "the a an and or but in on at to for of with from by is are was were be been being this that these those i you he she it we they a an".split(
      " ",
    ),
  );
  return idea
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w))
    .slice(0, 12);
}

function sceneCount(duration: MovieDuration): number {
  return duration === "10min" ? 10 : 6;
}

function secPerScene(duration: MovieDuration, count: number): number {
  const total = duration === "10min" ? 600 : 300;
  return Math.round(total / count);
}

/**
 * Zero-cost script engine: runs entirely in the browser.
 * Produces structured characters, scenes, dialogue, and a printable full script.
 * Not a cloud LLM — honest template + story-structure generation from the user's idea.
 */
export function generateScript(input: {
  title: string;
  idea: string;
  language: Language;
  targetDuration: MovieDuration;
  genres: string[];
}): ScriptOutput {
  const language = input.language ?? "en";
  const genres = input.genres?.length ? input.genres : ["action", "romance"];
  const idea = (input.idea || input.title || "A story of courage and heart").trim();
  const title = (input.title || "Untitled Movie").trim();
  const hi = language === "hi";
  const names = pickNames(language, genres);
  const keywords = extractKeywords(idea);
  const setting =
    keywords.find((k) =>
      /rain|temple|city|village|street|school|market|mountain|river|night|festival|train|stadium|palace|forest/.test(
        k,
      ),
    ) || (hi ? "शहर" : "the city");

  const hasFight =
    genres.includes("action") ||
    /fight|battle|sword|war|ladai|yudh|clash/i.test(idea);
  const hasRomance =
    genres.includes("romance") ||
    /love|romance|heart|pyaar|prem|kiss|embrace/i.test(idea);

  const characters: GeneratedCharacter[] = [
    {
      name: names.hero,
      role: hi ? "नायक" : "Protagonist",
      appearance: hi
        ? "दृढ़ नज़र, साधारण लेकिन मजबूत कपड़े, भावपूर्ण चेहरा"
        : "Determined eyes, simple but strong clothes, expressive face",
      personality: hi ? "बहादुर, वफादार" : "Brave, loyal",
    },
    {
      name: names.love,
      role: hi ? (hasRomance ? "प्रेमिका" : "सहयोगी") : hasRomance ? "Love interest" : "Ally",
      appearance: hi
        ? "कोमल मुस्कान, साफ पहनावा, भावुक आँखें"
        : "Soft smile, clean attire, expressive eyes",
      personality: hi ? "मजबूत दिल, दयालु" : "Strong-hearted, kind",
    },
  ];

  if (hasFight) {
    characters.push({
      name: names.rival,
      role: hi ? "प्रतिद्वंद्वी" : "Rival",
      appearance: hi
        ? "तीखी नज़र, काले कपड़े, आक्रामक हावभाव"
        : "Sharp gaze, dark clothes, aggressive posture",
      personality: hi ? "अभिमानी, शक्तिशाली" : "Proud, powerful",
    });
  }

  const n = sceneCount(input.targetDuration);
  const sec = secPerScene(input.targetDuration, n);
  const scenes: GeneratedScene[] = [];

  // Opening
  scenes.push({
    title: hi ? "शुरुआत — परिचय" : "Opening — Introduction",
    mood: "dialogue",
    dialogue: hi
      ? `${names.hero}: यह जगह मुझे हमेशा कुछ याद दिलाती है...\n${names.love}: यादें कभी नहीं मरतीं, ${names.hero}.`
      : `${names.hero}: This place always reminds me of something unfinished.\n${names.love}: Memories don't die, ${names.hero}. They wait.`,
    gestureNotes: hi
      ? "धीरे चलना, एक-दूसरे की ओर देखना"
      : "Slow walk, glancing at each other",
    visualPrompt: `Cinematic establishing shot of ${setting}, ${names.hero} and ${names.love}, ${moodToPromptHint("dialogue")}`,
    narration: hi
      ? `कहानी शुरू होती है जहाँ ${idea.slice(0, 80)}`
      : `Our story begins where ${idea.slice(0, 100)}`,
    estimatedDurationSec: sec,
  });

  // Inciting
  scenes.push({
    title: hi ? "मोड़ — चुनौती" : "Turning point — Challenge",
    mood: hasFight ? "action" : "dramatic",
    dialogue: hi
      ? `${names.hero}: मुझे रुकना नहीं चाहिए।\n${names.love}: तो फिर मैं भी साथ हूँ।`
      : `${names.hero}: I can't stay still anymore.\n${names.love}: Then I'm coming with you.`,
    gestureNotes: hi ? "मुट्ठी बंद, दृढ़ कदम" : "Clenched fist, firm steps",
    visualPrompt: `${names.hero} faces a decision in ${setting}, ${moodToPromptHint(hasFight ? "action" : "dramatic")}`,
    estimatedDurationSec: sec,
  });

  if (hasFight) {
    scenes.push({
      title: hi ? "लड़ाई — पहला मुकाबला" : "Fight — First clash",
      mood: "fight",
      dialogue: hi
        ? `${names.rival}: तुम तैयार नहीं हो!\n${names.hero}: आज देख लेंगे।`
        : `${names.rival}: You're not ready!\n${names.hero}: Watch me.`,
      gestureNotes: hi
        ? "तलवार/मुक्का, बचाव, किक, नाटकीय दूरी"
        : "Sword or fist clash, dodge, kick, dramatic distance",
      visualPrompt: `Intense fight between ${names.hero} and ${names.rival}, ${moodToPromptHint("fight")}, ${setting}`,
      estimatedDurationSec: Math.round(sec * 1.2),
    });
  }

  if (hasRomance) {
    scenes.push({
      title: hi ? "प्रेम — कोमल क्षण" : "Romance — Soft moment",
      mood: "romance",
      dialogue: hi
        ? `${names.love}: डर लगता है कभी-कभी।\n${names.hero}: मैं हूँ ना।`
        : `${names.love}: Sometimes I'm afraid.\n${names.hero}: I'm right here.`,
      gestureNotes: hi
        ? "हाथ पकड़ना, कोमल मुस्कान, नज़दीकी"
        : "Hand hold, soft smile, close proximity",
      visualPrompt: `Tender moment between ${names.hero} and ${names.love}, ${moodToPromptHint("romance")}`,
      estimatedDurationSec: sec,
    });
  }

  // Mid conflict
  scenes.push({
    title: hi ? "संघर्ष — अंदरूनी" : "Conflict — Inner storm",
    mood: "emotional",
    dialogue: hi
      ? `${names.hero}: क्या मैं सही रास्ते पर हूँ?\n${names.love}: सही रास्ता आसान नहीं होता।`
      : `${names.hero}: Am I on the right path?\n${names.love}: The right path is rarely easy.`,
    gestureNotes: hi ? "सिर झुकाना, कंधे पर हाथ" : "Head down, hand on shoulder",
    visualPrompt: `${names.hero} emotional close-up, ${moodToPromptHint("emotional")}`,
    estimatedDurationSec: sec,
  });

  if (hasFight && n >= 7) {
    scenes.push({
      title: hi ? "लड़ाई — चरम" : "Fight — Climax battle",
      mood: "fight",
      dialogue: hi
        ? `${names.rival}: अब खत्म!\n${names.hero}: अभी तो शुरू हुआ है!`
        : `${names.rival}: This ends now!\n${names.hero}: It has only begun!`,
      gestureNotes: hi
        ? "तेज़ वार, घूमना, अंतिम झटका, साँस फूलना"
        : "Rapid strikes, spin, final blow, heavy breathing",
      visualPrompt: `Climactic duel ${names.hero} vs ${names.rival}, ${moodToPromptHint("fight")}`,
      estimatedDurationSec: Math.round(sec * 1.3),
    });
  }

  if (hasRomance && n >= 8) {
    scenes.push({
      title: hi ? "इशारा — चुपचाप प्यार" : "Gesture — Quiet love",
      mood: "gesture",
      dialogue: hi
        ? `${names.love}: कुछ कहने की ज़रूरत नहीं।\n${names.hero}: ...`
        : `${names.love}: You don't have to say anything.\n${names.hero}: ...`,
      gestureNotes: hi
        ? "माथे पर हाथ, आँखों में आँखें, धीमी मुस्कान"
        : "Hand to forehead, eye contact, slow smile",
      visualPrompt: `Expressive gesture scene, ${names.hero} and ${names.love}, ${moodToPromptHint("gesture")}`,
      estimatedDurationSec: sec,
    });
  }

  // Fill remaining slots with story beats tied to idea
  while (scenes.length < n - 1) {
    const i = scenes.length;
    scenes.push({
      title: hi ? `दृश्य ${i + 1} — आगे बढ़ना` : `Scene ${i + 1} — Rising action`,
      mood: i % 2 === 0 ? "action" : "dialogue",
      dialogue: hi
        ? `${names.hero}: हमें आगे बढ़ना होगा।\n${names.love}: साथ में।`
        : `${names.hero}: We have to keep moving.\n${names.love}: Together.`,
      gestureNotes: hi ? "चलते हुए बात" : "Walking and talking",
      visualPrompt: `${setting}, ${names.hero}, ${moodToPromptHint(i % 2 === 0 ? "action" : "dialogue")}, based on: ${idea.slice(0, 60)}`,
      estimatedDurationSec: sec,
    });
  }

  // Resolution
  scenes.push({
    title: hi ? "अंत — नई सुबह" : "Resolution — New dawn",
    mood: hasRomance ? "romance" : "emotional",
    dialogue: hi
      ? `${names.hero}: अब हम तैयार हैं।\n${names.love}: हाँ — साथ में।`
      : `${names.hero}: We're ready now.\n${names.love}: Yes — together.`,
    gestureNotes: hi
      ? "कंधे से कंधा, आशा भरी नज़रें"
      : "Side by side, hopeful looks",
    visualPrompt: `Closing shot of ${names.hero} and ${names.love}, ${moodToPromptHint(hasRomance ? "romance" : "emotional")}, hopeful light`,
    narration: hi
      ? "कहानी यहीं खत्म नहीं होती — यह एक नई शुरुआत है।"
      : "The story doesn't end here — it becomes a beginning.",
    estimatedDurationSec: sec,
  });

  const logline = hi
    ? `${names.hero} और ${names.love} की कहानी — ${idea.slice(0, 100)}`
    : `${names.hero} and ${names.love} — ${idea.slice(0, 120)}`;

  const synopsis = hi
    ? `${title}: ${idea}\n\nइस फिल्म में ${characters.map((c) => c.name).join(", ")} हैं। अवधि लगभग ${input.targetDuration === "10min" ? "10" : "5"} मिनट। ${hasFight ? "लड़ाई के दृश्य शामिल हैं। " : ""}${hasRomance ? "प्रेम और इशारों के क्षण हैं।" : ""}`
    : `${title}: ${idea}\n\nFeaturing ${characters.map((c) => c.name).join(", ")}. Target length ~${input.targetDuration === "10min" ? "10" : "5"} minutes. ${hasFight ? "Includes fight sequences. " : ""}${hasRomance ? "Includes romance and gesture moments." : ""}`;

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
    scenes: scenes.slice(0, n),
    fullScriptText,
    language,
    note: hi
      ? "यह स्क्रिप्ट ब्राउज़र में मुफ़्त जेनरेट हुई है (कोई पेड API नहीं)। आप हर दृश्य संपादित कर सकते हैं।"
      : "This script was generated free in your browser (no paid API). You can edit every scene.",
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
    lines.push(`--- SCENE ${i + 1}: ${sc.title} [${sc.mood}] (~${sc.estimatedDurationSec}s) ---`);
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
