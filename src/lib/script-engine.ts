import type { Language, MovieDuration, SceneMood } from "./types";

export interface GeneratedCharacter {
  name: string;
  role: string;
  appearance: string;
}

export interface GeneratedScene {
  title: string;
  mood: SceneMood;
  dialogue?: string;
  narration?: string;
  gestureNotes?: string;
  visualPrompt?: string;
  estimatedDurationSec?: number;
}

export interface ScriptOutput {
  title: string;
  logline: string;
  synopsis: string;
  characters: GeneratedCharacter[];
  scenes: GeneratedScene[];
  fullScriptText: string;
}

function sceneCount(duration: MovieDuration): number {
  if (duration === "10sec") return 1;
  return duration === "10min" ? 8 : 5;
}

function secPerScene(duration: MovieDuration, count: number): number {
  if (duration === "10sec") return 10;
  const total = duration === "10min" ? 600 : 300;
  return Math.round(total / count);
}

function isRamayanaStory(text: string): boolean {
  return /राम|सीता|लक्ष्मण|रघुनंदन|हनुमान|रावण|गज|हाथी|हाथिनी|शाप|वनवास|ayodhya|rama|sita|elephant|curse/i.test(
    text,
  );
}

/** Split long prose into ordered story beats for scenes */
function splitBeats(idea: string, n: number): string[] {
  const cleaned = idea.replace(/\s+/g, " ").trim();
  if (!cleaned) return Array.from({ length: n }, (_, i) => `Beat ${i + 1}`);
  const sentences = cleaned.split(/(?<=[।.!?])\s+/).filter(Boolean);
  if (sentences.length >= n) {
    const out: string[] = [];
    const size = Math.ceil(sentences.length / n);
    for (let i = 0; i < n; i++) {
      out.push(sentences.slice(i * size, (i + 1) * size).join(" ") || `Beat ${i + 1}`);
    }
    return out;
  }
  // pad
  const out = [...sentences];
  while (out.length < n) out.push(out[out.length - 1] || cleaned);
  return out.slice(0, n);
}

function defaultCast(language: Language): GeneratedCharacter[] {
  if (language === "hi") {
    return [
      { name: "अरजुन", role: "नायक", appearance: "दृढ़ नज़र, साधारण लेकिन मजबूत कपड़े, भावपूर्ण चेहरा" },
      { name: "मीरा", role: "प्रेमिका", appearance: "कोमल मुस्कान, साफ पहनावा, भावुक आँखें" },
      { name: "विक्रम", role: "प्रतिद्वंद्वी", appearance: "तीखी नज़र, काले कपड़े, आक्रामक हावभाव" },
    ];
  }
  return [
    { name: "Arjun", role: "Hero", appearance: "Steady gaze, simple strong clothes, expressive face" },
    { name: "Meera", role: "Love interest", appearance: "Soft smile, clean attire, emotional eyes" },
    { name: "Vikram", role: "Rival", appearance: "Sharp look, dark clothes, aggressive posture" },
  ];
}

function ramayanaCast(language: Language): GeneratedCharacter[] {
  if (language === "hi") {
    return [
      { name: "श्री राम", role: "नायक", appearance: "नीला वर्ण, पीला धोती, धनुष, शांत किन्तु दृढ़ मुख" },
      { name: "हाथी", role: "गज", appearance: "विशाल हाथी, जंगल में, माथा ऊँचा" },
      { name: "हाथिनी", role: "संगिनी", appearance: "सफेद-धूसर हाथिनी, जल के पास" },
    ];
  }
  return [
    { name: "Lord Rama", role: "Hero", appearance: "Blue skin, yellow dhoti, bow, calm firm face" },
    { name: "Elephant", role: "Gaja", appearance: "Great bull elephant in forest, raised head" },
    { name: "Cow elephant", role: "Companion", appearance: "Grey-white cow elephant near water" },
  ];
}

function moodCycle(i: number, duration: MovieDuration): SceneMood {
  if (duration === "10sec") return "dramatic";
  const cycle: SceneMood[] = ["dialogue", "action", "fight", "romance", "emotional", "romance"];
  return cycle[i % cycle.length]!;
}

function buildFullScript(opts: {
  title: string;
  logline: string;
  characters: GeneratedCharacter[];
  scenes: GeneratedScene[];
  language: Language;
}): string {
  const { title, logline, characters, scenes, language } = opts;
  const hi = language === "hi";
  const lines: string[] = [];
  lines.push(`TITLE: ${title}`);
  lines.push(`LOGLINE: ${logline}`);
  lines.push("");
  lines.push(hi ? "=== पात्र ===" : "=== CAST ===");
  for (const c of characters) {
    lines.push(`• ${c.name} (${c.role}) — ${c.appearance}`);
  }
  lines.push("");
  lines.push(hi ? "=== स्क्रिप्ट ===" : "=== SCRIPT ===");
  scenes.forEach((sc, i) => {
    lines.push("");
    lines.push(`--- SCENE ${i + 1}: ${sc.title} [${sc.mood}] (~${sc.estimatedDurationSec ?? 50}s) ---`);
    if (sc.narration) lines.push(`NARRATION: ${sc.narration}`);
    if (sc.gestureNotes) lines.push(`GESTURE: ${sc.gestureNotes}`);
    if (sc.dialogue) lines.push(sc.dialogue);
    if (sc.visualPrompt) lines.push(`VISUAL: ${sc.visualPrompt}`);
  });
  lines.push("");
  lines.push(hi ? "— समाप्त —" : "— END —");
  return lines.join("\n");
}

export function generateScript(input: {
  title: string;
  idea: string;
  language: Language;
  targetDuration: MovieDuration;
  genres?: string[];
}): ScriptOutput {
  const language = input.language;
  const title = input.title.trim() || (language === "hi" ? "नई कहानी" : "New Story");
  const idea = input.idea.trim() || title;
  const n = sceneCount(input.targetDuration);
  const sec = secPerScene(input.targetDuration, n);
  const ram = isRamayanaStory(title + " " + idea);
  const characters = ram ? ramayanaCast(language) : defaultCast(language);
  const beats = splitBeats(idea, n);

  const scenes: GeneratedScene[] = beats.map((beat, i) => {
    const mood = moodCycle(i, input.targetDuration);
    const hero = characters[0]?.name || "Hero";
    const love = characters[1]?.name || "Partner";
    const rival = characters[2]?.name || "Rival";
    let dialogue = "";
    let narration = "";
    let gestureNotes = "";
    if (language === "hi") {
      if (mood === "fight" || mood === "action") {
        dialogue = `${rival}: तुम तैयार नहीं हो!\n${hero}: आज देख लेंगे।`;
        gestureNotes = "तलवार/मुक्का, बचाव, किक, नाटकीय दूरी";
      } else if (mood === "romance") {
        dialogue = `${love}: डर लगता है कभी-कभी।\n${hero}: मैं हूँ ना।`;
        gestureNotes = "हाथ पकड़ना, कोमल मुस्कान, नज़दीकी";
      } else if (mood === "emotional") {
        dialogue = `${hero}: क्या मैं सही रास्ते पर हूँ?\n${love}: सही रास्ता आसान नहीं होता।`;
        gestureNotes = "सिर झुकाना, कंधे पर हाथ";
      } else {
        dialogue = `${hero}: यह जगह मुझे हमेशा कुछ याद दिलाती है...\n${love}: यादें कभी नहीं मरतीं।`;
        gestureNotes = "धीरे चलना, एक-दूसरे की ओर देखना";
      }
      if (i === 0) narration = `कहानी शुरू होती है जहाँ ${beat.slice(0, 80)}`;
      if (i === n - 1) narration = "कहानी यहीं खत्म नहीं होती — यह एक नई शुरुआत है।";
    } else {
      if (mood === "fight" || mood === "action") {
        dialogue = `${rival}: You're not ready!\n${hero}: We'll see today.`;
        gestureNotes = "strikes, blocks, dramatic distance";
      } else if (mood === "romance") {
        dialogue = `${love}: Sometimes I'm afraid.\n${hero}: I'm here.`;
        gestureNotes = "hands meeting, soft smile, closeness";
      } else {
        dialogue = `${hero}: This place always reminds me...\n${love}: Memories don't die.`;
        gestureNotes = "slow walk, looking at each other";
      }
      if (i === 0) narration = `The story begins where ${beat.slice(0, 80)}`;
    }
    const visualPrompt = [
      beat.slice(0, 100),
      `${hero} and ${love}`,
      mood,
      "cinematic film still, clear faces",
    ].join(", ");
    return {
      title:
        language === "hi"
          ? [`शुरुआत`, `मोड़`, `संघर्ष`, `प्रेम`, `संकल्प`, `अंत`][i] || `दृश्य ${i + 1}`
          : [`Opening`, `Turn`, `Conflict`, `Bond`, `Resolve`, `Close`][i] || `Scene ${i + 1}`,
      mood,
      dialogue,
      narration: narration || undefined,
      gestureNotes,
      visualPrompt,
      estimatedDurationSec: sec,
    };
  });

  const logline =
    language === "hi"
      ? `${characters[0]?.name || "नायक"} की कहानी — ${title}: ${idea.slice(0, 60)}`
      : `A story of ${characters[0]?.name || "the hero"} — ${title}: ${idea.slice(0, 60)}`;

  const synopsis =
    language === "hi"
      ? `${title}\n\n${idea}\n\nपात्र: ${characters.map((c) => c.name).join(", ")}। अवधि ~${
          input.targetDuration === "10sec"
            ? "10 सेकंड"
            : input.targetDuration === "10min"
              ? "10 मिनट"
              : "5 मिनट"
        }।`
      : `${title}\n\n${idea}\n\nCast: ${characters.map((c) => c.name).join(", ")}. ~${
          input.targetDuration === "10sec"
            ? "10 sec"
            : input.targetDuration === "10min"
              ? "10 min"
              : "5 min"
        }.`;

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
  };
}
