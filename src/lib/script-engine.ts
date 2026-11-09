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
  // Neutral romantic defaults — not Arjun/Meera (user-requested)
  if (language === "hi") {
    return [
      {
        name: "कबीर",
        role: "नायक",
        appearance: "नरम मुस्कान, आधुनिक कैजुअल कपड़े, भावपूर्ण आँखें",
      },
      {
        name: "रिया",
        role: "नायिका",
        appearance: "चमकदार मुस्कान, स्टाइलिश पहनावा, भावुक नज़र",
      },
      {
        name: "अन्या",
        role: "सह-पात्र",
        appearance: "शांत भाव, साफ कपड़े, दोस्ताना हावभाव",
      },
    ];
  }
  return [
    {
      name: "Kabir",
      role: "Lead",
      appearance: "Soft smile, modern casual clothes, expressive eyes",
    },
    {
      name: "Riya",
      role: "Lead",
      appearance: "Bright smile, stylish look, emotional eyes",
    },
    {
      name: "Anya",
      role: "Supporting",
      appearance: "Calm expression, clean attire, friendly posture",
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
        appearance: "विशाल, शांत नेत्र, वन पृष्ठभूमि",
      },
      {
        name: "हाथिनी",
        role: "गजा",
        appearance: "कोमल, साथ में, वन",
      },
    ];
  }
  return [
    {
      name: "Lord Rama",
      role: "Hero",
      appearance: "Blue-toned skin, yellow dhoti, bow, calm firm face",
    },
    {
      name: "Elephant",
      role: "Elephant",
      appearance: "Vast, calm eyes, forest backdrop",
    },
    {
      name: "Cow elephant",
      role: "Elephant",
      appearance: "Gentle, companion, forest",
    },
  ];
}

function tajCast(language: Language): GeneratedCharacter[] {
  if (language === "hi") {
    return [
      {
        name: "जमशेदजी",
        role: "नायक",
        appearance: "औपनिवेशिक युग, दृढ़ चेहरा, सम्मान",
      },
      {
        name: "गार्ड",
        role: "द्वारपाल",
        appearance: "यूनिफॉर्म, बंद दरवाज़ा",
      },
      {
        name: "वाचक",
        role: "कथावाचक",
        appearance: "कथन स्वर",
      },
    ];
  }
  return [
    {
      name: "Jamsetji",
      role: "Hero",
      appearance: "Colonial era, firm face, dignity",
    },
    {
      name: "Guard",
      role: "Doorman",
      appearance: "Uniform, closed door",
    },
    {
      name: "Narrator",
      role: "Narrator",
      appearance: "Voice-over presence",
    },
  ];
}

function moodCycle(i: number, duration: MovieDuration): SceneMood {
  const moods: SceneMood[] =
    duration === "10sec"
      ? ["dramatic"]
      : ["dialogue", "action", "fight", "romance", "emotional", "dramatic", "dialogue", "emotional"];
  return moods[i % moods.length]!;
}

function dialogueFromBeat(
  beat: string,
  i: number,
  n: number,
  mood: SceneMood,
  hero: string,
  love: string,
  rival: string,
  language: Language,
  story: "modern" | "ram" | "taj",
): { dialogue: string; narration: string; gestureNotes: string } {
  if (story === "ram") {
    if (language === "hi") {
      return {
        dialogue: `${hero}: क्या तुमने सीता को देखा?`,
        narration: beat.slice(0, 80),
        gestureNotes: "धनुष थामे, शांत दृष्टि",
      };
    }
    return {
      dialogue: `${hero}: Have you seen Sita?`,
      narration: beat.slice(0, 80),
      gestureNotes: "bow in hand, calm gaze",
    };
  }
  if (story === "taj") {
    if (language === "hi") {
      return {
        dialogue: `${hero}: यह द्वार एक दिन खुलना चाहिए।`,
        narration: beat.slice(0, 80),
        gestureNotes: "दृढ़ कदम, बंद दरवाज़ा",
      };
    }
    return {
      dialogue: `${hero}: This door must open one day.`,
      narration: beat.slice(0, 80),
      gestureNotes: "firm step, closed door",
    };
  }
  if (language === "hi") {
    if (mood === "romance") {
      return {
        dialogue: `${love}: इस पल को मत छोड़ना।\n${hero}: मैं यहीं हूँ — तुम्हारे साथ।`,
        narration: "",
        gestureNotes: "नज़दीकी, कोमल हावभाव",
      };
    }
    if (mood === "fight" || mood === "action") {
      return {
        dialogue: `${rival}: रुक जा — यह रास्ता तेरा नहीं!\n${hero}: रास्ता मैं खुद बनाता हूँ।`,
        narration: "",
        gestureNotes: "तनाव, दृढ़ कदम",
      };
    }
    if (i === 0) {
      return {
        dialogue: `${hero}: अब हम तैयार हैं।\n${love}: हाँ — साथ में।`,
        narration: beat.slice(0, 60),
        gestureNotes: "आशा भरी नज़र",
      };
    }
    return {
      dialogue: `${hero}: क्या सही रास्ता इतना कठिन होता है?\n${love}: सही रास्ता आसान नहीं होता।`,
      narration: "",
      gestureNotes: "भावनात्मक ठहराव",
    };
  }
  if (mood === "romance") {
    return {
      dialogue: `${love}: Don't let this moment go.\n${hero}: I'm right here — with you.`,
      narration: "",
      gestureNotes: "close, soft gesture",
    };
  }
  if (mood === "fight" || mood === "action") {
    return {
      dialogue: `${rival}: Stop — this path isn't yours!\n${hero}: I make my own path.`,
      narration: "",
      gestureNotes: "tension, firm step",
    };
  }
  if (i === 0) {
    return {
      dialogue: `${hero}: We're ready.\n${love}: Yes — together.`,
      narration: beat.slice(0, 60),
      gestureNotes: "hopeful look",
    };
  }
  return {
    dialogue: `${hero}: Is the right path always this hard?\n${love}: The right path is never easy.`,
    narration: "",
    gestureNotes: "emotional stillness",
  };
}

function buildFullScript(opts: {
  title: string;
  logline: string;
  characters: GeneratedCharacter[];
  scenes: GeneratedScene[];
  language: Language;
}): string {
  const { title, logline, characters, scenes, language } = opts;
  const lines: string[] = [];
  lines.push(title);
  lines.push("");
  lines.push(logline);
  lines.push("");
  lines.push(language === "hi" ? "पात्र:" : "Cast:");
  for (const c of characters) {
    lines.push(`- ${c.name} (${c.role}): ${c.appearance}`);
  }
  lines.push("");
  scenes.forEach((s, i) => {
    lines.push(`=== ${language === "hi" ? "दृश्य" : "Scene"} ${i + 1}: ${s.title} [${s.mood}] ===`);
    if (s.narration) lines.push(s.narration);
    if (s.dialogue) lines.push(s.dialogue);
    if (s.gestureNotes) lines.push(`(${s.gestureNotes})`);
    lines.push("");
  });
  return lines.join("\n");
}

export function generateScript(input: {
  title: string;
  idea: string;
  language: Language;
  targetDuration: MovieDuration;
}): ScriptOutput {
  const title = (input.title || "Untitled").trim();
  const idea = (input.idea || title).trim();
  const language = input.language || "hi";
  const n = sceneCount(input.targetDuration);
  const sec = secPerScene(input.targetDuration, n);

  const ram = isRamayanaStory(idea + " " + title);
  const taj = !ram && isTajStory(idea + " " + title);
  const story: "modern" | "ram" | "taj" = ram ? "ram" : taj ? "taj" : "modern";

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
