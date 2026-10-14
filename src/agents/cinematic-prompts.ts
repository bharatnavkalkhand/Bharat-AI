/**
 * B — Cinematic prompt engine
 * Turns raw scene text into strong, consistent search / generation prompts.
 * Aims closer to commercial AI reel look (style anchors, not paid APIs).
 */

export interface CinematicPromptInput {
  title: string;
  sceneTitle: string;
  mood: string;
  dialogue?: string;
  narration?: string;
  visualPrompt?: string;
  gestureNotes?: string;
  language?: "en" | "hi";
}

const STYLE_ANCHOR =
  "cinematic still, highly detailed, dramatic lighting, film composition, consistent characters, 4k concept art";

function detectUniverse(text: string): "ramayana" | "modern" | "generic" {
  if (/राम|सीता|हनुमान|रावण|लक्ष्मण|गज|हाथी|हाथिनी|रघुनंदन|वनवास|ayodhya|rama|sita|elephant|gaj/i.test(text))
    return "ramayana";
  if (/city|hotel|train|phone|car|office|शहर|ट्रेन|होटल/i.test(text)) return "modern";
  return "generic";
}

function ramayanaAnchors(mood: string, beat: string): string[] {
  const m = mood.toLowerCase();
  const base = [
    "Lord Rama blue skin yellow dhoti bow forest",
    "Ramayana epic illustration forest",
    "Indian mythology elephant Rama",
  ];
  if (/शाप|curse|क्षुब्ध|angry|fight/.test(beat + m))
    return [
      "Rama raising hand curse mystical light dark forest",
      "angry Lord Rama elephant mythology art",
      ...base,
    ];
  if (/प्रार्थना|क्षमा|bow|pray|दीन/.test(beat + m))
    return [
      "elephants bowing before Lord Rama forest",
      "devotional Ramayana scene elephants",
      ...base,
    ];
  if (/जल|गजो|water|splash|अचेत/.test(beat + m))
    return [
      "elephant spraying water river mythology",
      "two elephants water shore tropical",
      ...base,
    ];
  if (/घास|तृण|grass|सुख|विहार/.test(beat + m))
    return [
      "two elephants sharing grass sunny meadow",
      "peaceful elephants jungle clearing",
      ...base,
    ];
  if (/सीता|search|पता|खोज/.test(beat + m))
    return [
      "Lord Rama meeting elephants in dense forest",
      "Rama and two elephants jungle path",
      ...base,
    ];
  return base;
}

/**
 * Build ranked English search queries (free image APIs work best in English).
 */
export function buildCinematicQueries(input: CinematicPromptInput): string[] {
  const blob = [
    input.title,
    input.sceneTitle,
    input.visualPrompt,
    input.narration,
    input.dialogue,
    input.gestureNotes,
  ]
    .filter(Boolean)
    .join(" ");

  const universe = detectUniverse(blob);
  const out: string[] = [];

  if (universe === "ramayana") {
    out.push(...ramayanaAnchors(input.mood, blob));
  } else {
    // Mood + situation
    const moodMap: Record<string, string[]> = {
      fight: ["epic duel cinematic", "warrior clash dramatic lighting"],
      action: ["dynamic action film still", "chase sequence concept art"],
      romance: ["romantic cinematic couple soft light", "tender embrace film still"],
      emotional: ["emotional portrait cinematic tears", "dramatic character close-up"],
      dramatic: ["high drama cinematic still", "storm atmosphere character"],
      dialogue: ["two characters conversation cinematic", "film dialogue scene"],
      gesture: ["expressive gesture character art", "body language concept art"],
    };
    out.push(...(moodMap[input.mood.toLowerCase()] || ["cinematic film still"]));
    if (input.sceneTitle) out.push(`${input.sceneTitle} cinematic`);
  }

  if (input.visualPrompt) out.push(input.visualPrompt.slice(0, 80));

  // Style tail for generation workers (HF/Colab)
  out.push(STYLE_ANCHOR);

  const uniq: string[] = [];
  for (const q of out) {
    const t = q.trim().slice(0, 120);
    if (t && !uniq.includes(t)) uniq.push(t);
  }
  return uniq.slice(0, 6);
}

/** Full generation prompt for free worker (HF / Colab) */
export function buildGenerationPrompt(input: CinematicPromptInput): string {
  const queries = buildCinematicQueries(input);
  const subject = queries.slice(0, 3).join(", ");
  return `${subject}, ${STYLE_ANCHOR}, no text, no watermark, vertical 9:16 composition`;
}
