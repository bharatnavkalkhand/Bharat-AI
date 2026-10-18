import type { Language, MovieDuration, SceneMood } from "./types";

export interface GeneratedCharacter {
  name: string;
  role: string;
  appearance: string;
  personality?: string;
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

function isTajStory(text: string): boolean {
  return /ताज|तज|jamsetji|jamsetjee|जमशेद|taj mahal|hotel|औपनिवेश|colonial|मुंबई|mumbai|guard|गार्ड/i.test(
    text,
  );
}

function splitBeats(idea: string, n: number): string[] {
  const cleaned = idea.replace(/\s+/g, " ").trim();
  if (!cleaned) return Array.from({ length: n }, (_, i) => `Beat ${i + 1}`);
  const sentences = cleaned.split(/(?<=[।.!?])\s+/).filter(Boolean);
  if (sentences.length >= n) {
    const out: string[] = [];
    const size = Math.ceil(sentences.length / n);
    for (let i = 0; i < n; i++) {
      out.push(
        sentences.slice(i * size, (i + 1) * size).join(" ") || `Beat ${i + 1}`,
      );
    }
    return out;
  }
  const out = [...sentences];
  while (out.length < n) out.push(out[out.length - 1] || cleaned);
  return out.slice(0, n);
}

function defaultCast(language: Language): GeneratedCharacter[] {
  if (language === "hi") {
    return [
      {
        name: "अरजुन",
        role: "नायक",
        appearance: "दृढ़ नज़र, साधारण लेकिन मजबूत कपड़े, भावपूर्ण चेहरा",
      },
      {
        name: "मीरा",
        role: "प्रेमिका",
        appearance: "कोमल मुस्कान, साफ पहनावा, भावुक आँखें",
      },
      {
        name: "विक्रम",
        role: "प्रतिद्वंद्वी",
        appearance: "तीखी नज़र, काले कपड़े, आक्रामक हावभाव",
      },
    ];
  }
  return [
    {
      name: "Arjun",
      role: "Hero",
      appearance: "Steady gaze, simple strong clothes, expressive face",
    },
    {
      name: "Meera",
      role: "Love interest",
      appearance: "Soft smile, clean attire, emotional eyes",
    },
    {
      name: "Vikram",
      role: "Rival",
      appearance: "Sharp look, dark clothes, aggressive posture",
    },
  ];
}

function ramayanaCast(language: Language): GeneratedCharacter[] {
  if (language === "hi") {
    return [
      {
        name: "श्री राम",
        role: "नायक",
        appearance: "नीला वर्ण, पीला धोती, धनुष, शांत किन्तु दृढ़ मुख",
      },
      {
        name: "हाथी",
        role: "गज",
        appearance: "विशाल हाथी, जंगल में, माथा ऊँचा",
      },
      {
        name: "हाथिनी",
        role: "संगिनी",
        appearance: "सफेद-धूसर हाथिनी, जल के पास",
      },
    ];
  }
  return [
    {
      name: "Lord Rama",
      role: "Hero",
      appearance: "Blue skin, yellow dhoti, bow, calm firm face",
    },
    {
      name: "Elephant",
      role: "Gaja",
      appearance: "Great bull elephant in forest, raised head",
    },
    {
      name: "Cow elephant",
      role: "Companion",
      appearance: "Grey-white cow elephant near water",
    },
  ];
}

function tajCast(language: Language): GeneratedCharacter[] {
  if (language === "hi") {
    return [
      {
        name: "जमशेदजी",
        role: "उद्योगपति",
        appearance: "शालीन पारसी पोशाक, शांत दृढ़ चेहरा, सम्मान की चाह",
      },
      {
        name: "गार्ड",
        role: "ब्रिटिश गार्ड",
        appearance: "औपनिवेशिक वर्दी, कठोर नज़र, बंद दरवाज़ा",
      },
      {
        name: "वाचक",
        role: "कथावाचक",
        appearance: "गंभीर स्वर, ऐतिहासिक लहजा",
      },
    ];
  }
  return [
    {
      name: "Jamsetji",
      role: "Industrialist",
      appearance: "Dignified Parsi attire, calm firm face, seeking honour",
    },
    {
      name: "Guard",
      role: "British guard",
      appearance: "Colonial uniform, hard eyes, closed hotel door",
    },
    {
      name: "Narrator",
      role: "Storyteller",
      appearance: "Serious voice, historical tone",
    },
  ];
}

function moodCycle(i: number, duration: MovieDuration): SceneMood {
  if (duration === "10sec") return "dramatic";
  const cycle: SceneMood[] = [
    "dialogue",
    "action",
    "fight",
    "romance",
    "emotional",
    "romance",
  ];
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
    lines.push(
      `--- SCENE ${i + 1}: ${sc.title} [${sc.mood}] (~${sc.estimatedDurationSec ?? 50}s) ---`,
    );
    if (sc.narration) lines.push(`NARRATION: ${sc.narration}`);
    if (sc.gestureNotes) lines.push(`GESTURE: ${sc.gestureNotes}`);
    if (sc.dialogue) lines.push(sc.dialogue);
    if (sc.visualPrompt) lines.push(`VISUAL: ${sc.visualPrompt}`);
  });
  lines.push("");
  lines.push(hi ? "— समाप्त —" : "— END —");
  return lines.join("\n");
}

/** Beat-aware dialogue — never recycle the same stock line across scenes */
function dialogueFromBeat(
  beat: string,
  i: number,
  n: number,
  mood: SceneMood,
  hero: string,
  love: string,
  rival: string,
  language: Language,
  story: "taj" | "ram" | "default",
): { dialogue: string; narration: string; gestureNotes: string } {
  const snippet = beat.replace(/\s+/g, " ").trim().slice(0, 90);

  if (story === "taj") {
    if (language === "hi") {
      const tajScenes = [
        {
          dialogue: `गार्ड: यहाँ भारतीयों का प्रवेश वर्जित है।\nजमशेदजी: यह होटल सबके लिए है — सम्मान का।`,
          narration: "औपनिवेशिक मुंबई। एक दरवाज़े पर अपमान — और एक सपने का जन्म।",
          gestureNotes: "बंद दरवाज़ा, सीधा कंधा, शांत लेकिन दृढ़ नज़र",
        },
        {
          dialogue: `जमशेदजी: एक दिन ऐसा होटल बनेगा जहाँ रंग न पूछा जाए।\nगार्ड: सपने सस्ते होते हैं।`,
          narration: "अपमान आग बनता है — ताज का विचार जन्म लेता है।",
          gestureNotes: "मुट्ठी बंद, आकाश की ओर दृष्टि",
        },
        {
          dialogue: `जमशेदजी: सम्मान माँगा नहीं जाता — बनाया जाता है।`,
          narration: "उसी अपमान से उठता है भारत का गौरव — ताज।",
          gestureNotes: "मजबूत कदम, आगे बढ़ना",
        },
        {
          dialogue: `वाचक: और इस प्रकार एक इनकार ने इतिहास लिख दिया।`,
          narration: "ताज महल होटल — सम्मान का उत्तर।",
          gestureNotes: "स्थापना शॉट, भव्य द्वार",
        },
        {
          dialogue: `जमशेदजी: अब दरवाज़ा सबके लिए खुला रहेगा।`,
          narration: "कहानी यहीं खत्म नहीं — यह भारत के स्वाभिमान की शुरुआत है।",
          gestureNotes: "खुला द्वार, गर्व भरी नज़र",
        },
      ];
      const row = tajScenes[Math.min(i, tajScenes.length - 1)]!;
      return row;
    }
    const en = [
      {
        dialogue: `Guard: Natives are not allowed.\nJamsetji: This hotel should honour every guest.`,
        narration: "Colonial Mumbai. A door refused — a dream begins.",
        gestureNotes: "Closed door, straight shoulders, calm firm gaze",
      },
      {
        dialogue: `Jamsetji: One day a hotel will stand where colour is never asked.\nGuard: Dreams are cheap.`,
        narration: "Insult turns to fire — the idea of the Taj is born.",
        gestureNotes: "Fist tight, eyes to the sky",
      },
    ];
    return en[Math.min(i, en.length - 1)]!;
  }

  if (story === "ram" && language === "hi") {
    if (i === 0) {
      return {
        dialogue: `श्री राम: हे गजराज, क्या तुमने जनकसुता को देखा?`,
        narration: snippet || "वन में श्री राम हाथी से सीता का पता पूछते हैं।",
        gestureNotes: "धनुष कंधे पर, शांत प्रश्न",
      };
    }
    if (mood === "action" || mood === "fight") {
      return {
        dialogue: `श्री राम: हाथिनी के साथ रमण करोगे तो प्राण चले जाएंगे।`,
        narration: "क्षुब्ध होकर श्री राम शाप देते हैं — फिर कृपा भी।",
        gestureNotes: "ऊठा हाथ, गंभीर मुद्रा",
      };
    }
    return {
      dialogue: `श्री राम: जल छिड़केगी तो प्राण बचेंगे — यह है गजोपसेचन।`,
      narration: snippet || "शाप-निवृत्ति और करुणा।",
      gestureNotes: "आशीष मुद्रा, शांत मुस्कान",
    };
  }

  // Default: unique lines per scene index — never identical "aage kya" spam
  if (language === "hi") {
    if (mood === "fight" || mood === "action") {
      return {
        dialogue: `${rival}: रुक जा — यह रास्ता तेरा नहीं!\n${hero}: रास्ता मैं खुद बनाता हूँ।`,
        narration: i === 0 ? `कहानी शुरू: ${snippet}` : "",
        gestureNotes: "मुट्ठी, बचाव, दृढ़ कदम",
      };
    }
    if (mood === "romance") {
      return {
        dialogue: `${love}: इस पल को मत छोड़ना।\n${hero}: मैं यहीं हूँ — तुम्हारे साथ।`,
        narration: "",
        gestureNotes: "हाथ मिलना, कोमल मुस्कान",
      };
    }
    if (mood === "emotional") {
      return {
        dialogue: `${hero}: क्या सही रास्ता इतना कठिन होता है?\n${love}: सही रास्ता आसान नहीं होता।`,
        narration: "",
        gestureNotes: "सिर झुकाना, कंधे पर हाथ",
      };
    }
    if (i === n - 1) {
      return {
        dialogue: `${hero}: अब हम तैयार हैं।\n${love}: हाँ — साथ में।`,
        narration: "कहानी यहीं खत्म नहीं होती — यह एक नई शुरुआत है।",
        gestureNotes: "कंधे से कंधा, आशा भरी नज़र",
      };
    }
    return {
      dialogue: `${hero}: ${snippet ? snippet.slice(0, 48) : "यह पल सब बदल देगा।"}\n${love}: मैं सुन रही हूँ।`,
      narration: i === 0 ? `कहानी शुरू होती है।` : "",
      gestureNotes: "धीरे चलना, एक-दूसरे की ओर देखना",
    };
  }

  // English default
  if (mood === "fight" || mood === "action") {
    return {
      dialogue: `${rival}: Stop — this path isn't yours!\n${hero}: I make my own path.`,
      narration: i === 0 ? `The story begins: ${snippet}` : "",
      gestureNotes: "fists, blocks, firm steps",
    };
  }
  if (mood === "romance") {
    return {
      dialogue: `${love}: Don't let this moment go.\n${hero}: I'm here — with you.`,
      narration: "",
      gestureNotes: "hands meet, soft smile",
    };
  }
  return {
    dialogue: `${hero}: ${snippet ? snippet.slice(0, 48) : "This moment changes everything."}\n${love}: I'm listening.`,
    narration: i === 0 ? "The story begins." : "",
    gestureNotes: "slow walk, looking at each other",
  };
}

export function generateScript(input: {
  title: string;
  idea: string;
  language: Language;
  targetDuration: MovieDuration;
  genres?: string[];
}): ScriptOutput {
  const language = input.language;
  const title =
    input.title.trim() || (language === "hi" ? "नई कहानी" : "New Story");
  const idea = input.idea.trim() || title;
  const n = sceneCount(input.targetDuration);
  const sec = secPerScene(input.targetDuration, n);
  const blob = `${title} ${idea}`;
  const ram = isRamayanaStory(blob);
  const taj = !ram && isTajStory(blob);
  const story = ram ? "ram" : taj ? "taj" : "default";
  const characters = ram
    ? ramayanaCast(language)
    : taj
      ? tajCast(language)
      : defaultCast(language);
  const beats = splitBeats(idea, n);

  const scenes: GeneratedScene[] = beats.map((beat, i) => {
    const mood = moodCycle(i, input.targetDuration);
    const hero = characters[0]?.name || "Hero";
    const love = characters[1]?.name || "Partner";
    const rival = characters[2]?.name || "Rival";
    const { dialogue, narration, gestureNotes } = dialogueFromBeat(
      beat,
      i,
      n,
      mood,
      hero,
      love,
      rival,
      language,
      story,
    );
    const visualPrompt = [
      beat.slice(0, 100),
      `${hero}`,
      mood,
      story === "taj"
        ? "colonial Mumbai hotel door, cinematic historical still, real human faces"
        : "cinematic film still, clear faces, photoreal",
    ].join(", ");

    const titlesHi = [
      "शुरुआत",
      "मोड़",
      "संघर्ष",
      "प्रेम",
      "संकल्प",
      "अंत",
    ];
    const titlesEn = [
      "Opening",
      "Turn",
      "Conflict",
      "Bond",
      "Resolve",
      "Close",
    ];
    if (story === "taj" && language === "hi") {
      titlesHi.splice(
        0,
        6,
        "दरवाज़ा बंद",
        "अपमान",
        "संकल्प",
        "सपना",
        "ताज",
        "सम्मान",
      );
    }

    return {
      title:
        language === "hi"
          ? titlesHi[i] || `दृश्य ${i + 1}`
          : titlesEn[i] || `Scene ${i + 1}`,
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

  return { title, logline, synopsis, characters, scenes, fullScriptText };
}
