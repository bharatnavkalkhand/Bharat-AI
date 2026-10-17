/**
 * Character Photo Mind
 * Reads script cast + scene dialogue/narration and chooses which character
 * photos belong on each panel. Builds character-specific free-image queries
 * and keeps face continuity across scenes (same character → same preferred look).
 *
 * Zero paid APIs. Works with multi-source free search (Wikimedia, Openverse, etc.).
 */

export interface MindCharacter {
  id?: string;
  name: string;
  role?: string;
  appearance?: string;
  /** Optional existing reference (user upload or previous pick) */
  referenceImageLocal?: string;
  referenceImageUrl?: string;
}

export interface MindScene {
  id: string;
  order: number;
  title: string;
  mood: string;
  dialogue?: string;
  narration?: string;
  visualPrompt?: string;
  gestureNotes?: string;
  characterIds?: string[];
}

export interface CharacterQueryPlan {
  characterName: string;
  role?: string;
  queries: string[];
  /** Why this character is on this scene */
  reason: string;
}

export interface SceneCastPlan {
  sceneId: string;
  order: number;
  /** Lead / top panel character */
  primary: CharacterQueryPlan | null;
  /** Secondary / bottom panel */
  secondary: CharacterQueryPlan | null;
  /** Extra present names (for logging) */
  presentNames: string[];
  situationQueries: string[];
}

export interface CharacterPhotoMindReport {
  generatedAt: string;
  cast: Array<{ name: string; role?: string; appearance?: string; queries: string[] }>;
  scenes: SceneCastPlan[];
  continuityTips: string[];
  summary: string;
}

/** Known mythological / stock visual anchors (English — free APIs rank better) */
const CHARACTER_VISUAL_BANK: Record<string, string[]> = {
  "श्री राम": [
    "Lord Rama blue skin yellow dhoti bow arrow",
    "Ramayana Rama forest illustration",
    "Hindu god Rama archery painting",
  ],
  "श्रीराम": [
    "Lord Rama blue skin yellow dhoti bow arrow",
    "Ramayana Rama forest illustration",
  ],
  राम: [
    "Lord Rama mythology art",
    "Rama with bow Indian epic",
  ],
  "shri ram": [
    "Lord Rama blue skin yellow dhoti bow",
    "Ramayana illustration Rama",
  ],
  rama: [
    "Lord Rama mythology painting",
    "Rama bow forest epic art",
  ],
  सीता: [
    "Goddess Sita traditional Indian painting",
    "Sita Ramayana illustration",
    "Sita in forest exile art",
  ],
  sita: [
    "Goddess Sita Indian mythology art",
    "Sita Ramayana painting",
  ],
  हनुमान: [
    "Hanuman monkey god mythology art",
    "Lord Hanuman flying mountain",
  ],
  hanuman: [
    "Hanuman mythology illustration",
    "Hanuman with mace art",
  ],
  रावण: [
    "Ravana ten heads mythology art",
    "Demon king Ravana illustration",
  ],
  ravana: ["Ravana ten heads epic art"],
  लक्ष्मण: ["Lakshmana brother of Rama mythology art"],
  lakshmana: ["Lakshmana Ramayana illustration"],
  हाथी: [
    "Indian elephant jungle realistic",
    "Asian elephant forest photography",
    "elephant mythology Ramayana art",
  ],
  elephant: [
    "Asian elephant forest",
    "Indian elephant jungle",
  ],
  हाथिनी: [
    "female Asian elephant jungle",
    "two elephants together forest",
  ],
  "elephant-mate": ["female elephant forest", "elephants pair jungle"],
  अरजुन: ["young Indian man determined cinematic portrait"],
  arjun: ["young Indian man determined cinematic portrait"],
  मीरा: ["young Indian woman soft smile portrait cinematic"],
  meera: ["young Indian woman soft smile portrait"],
  विक्रम: ["antagonist Indian man dark clothes sharp eyes portrait"],
  vikram: ["rival Indian man dark cinematic portrait"],
};

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function bankQueriesForName(name: string): string[] {
  const n = normName(name);
  // Exact / partial bank hit
  for (const [key, qs] of Object.entries(CHARACTER_VISUAL_BANK)) {
    if (n === key.toLowerCase() || n.includes(key.toLowerCase()) || key.toLowerCase().includes(n)) {
      return qs.slice(0, 3);
    }
  }
  return [];
}

/** Build free-image search queries for one character from script fields */
export function buildCharacterQueries(c: MindCharacter, language: "en" | "hi" = "hi"): string[] {
  const out: string[] = [];
  out.push(...bankQueriesForName(c.name));

  const appearance = (c.appearance || "").trim();
  const role = (c.role || "").trim();

  if (appearance) {
    // Prefer English-ish fragments for APIs; keep original as secondary
    out.push(`${c.name} ${appearance}`.slice(0, 90));
    if (/धनुष|bow|बाण|arrow/.test(appearance))
      out.push("archer warrior Indian mythology art");
    if (/पीतांबर|yellow|dhoti|robe/.test(appearance))
      out.push("yellow robe Indian prince painting");
    if (/गज|elephant|हाथी/.test(appearance + c.name))
      out.push("Asian elephant portrait jungle");
  }

  if (role) {
    if (/नायक|protagonist|lord|भगवान/i.test(role))
      out.push(language === "hi" ? "hero portrait Indian epic" : "epic hero portrait cinematic");
    if (/प्रेम|love|heroine/i.test(role))
      out.push("romantic heroine soft light portrait India");
    if (/प्रतिद्वंद्वी|rival|villain/i.test(role))
      out.push("antagonist dark cinematic portrait");
  }

  // Generic face-friendly fallbacks
  if (out.length < 2) {
    out.push(`${c.name} character portrait cinematic`);
    out.push(`${c.name} illustration`);
  }

  const uniq: string[] = [];
  for (const q of out) {
    const t = q.trim().slice(0, 100);
    if (t && !uniq.includes(t)) uniq.push(t);
  }
  return uniq.slice(0, 5);
}

/** Who is mentioned / speaking in this scene text? */
export function detectPresentCharacters(
  scene: MindScene,
  cast: MindCharacter[],
): MindCharacter[] {
  const blob = [scene.title, scene.dialogue, scene.narration, scene.visualPrompt, scene.gestureNotes]
    .filter(Boolean)
    .join("\n");

  const present: MindCharacter[] = [];
  const seen = new Set<string>();

  // 1) Explicit characterIds
  if (scene.characterIds?.length) {
    for (const id of scene.characterIds) {
      const c = cast.find((x) => x.id === id);
      if (c && !seen.has(normName(c.name))) {
        seen.add(normName(c.name));
        present.push(c);
      }
    }
  }

  // 2) Speaker labels: "Name: line"
  const speakerRe = /^\s*([^:\n]{1,40})\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = speakerRe.exec(blob)) !== null) {
    const label = m[1].trim();
    const hit = cast.find(
      (c) =>
        normName(c.name) === normName(label) ||
        normName(label).includes(normName(c.name)) ||
        normName(c.name).includes(normName(label)),
    );
    if (hit && !seen.has(normName(hit.name))) {
      seen.add(normName(hit.name));
      present.push(hit);
    }
  }

  // 3) Name mention in body text
  for (const c of cast) {
    if (seen.has(normName(c.name))) continue;
    const re = new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(blob)) {
      seen.add(normName(c.name));
      present.push(c);
    }
  }

  // 4) Fallback: full cast order if nobody detected
  if (present.length === 0 && cast.length) {
    return cast.slice(0, Math.min(2, cast.length));
  }

  return present;
}

function situationQueries(scene: MindScene, title: string): string[] {
  const bits = [scene.title, scene.visualPrompt, scene.narration, title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const out: string[] = [];
  if (/वन|forest|jungle/.test(bits)) out.push("dense Indian forest path cinematic");
  if (/शाप|curse/.test(bits)) out.push("mystical light dark forest mythology");
  if (/प्रार्थना|pray|bow/.test(bits)) out.push("devotional scene forest mythology art");
  if (/जल|water|गजोपसेचन|splash/.test(bits)) out.push("elephants water river tropical");
  if (/सीता|search/.test(bits)) out.push("Rama searching forest Ramayana art");
  if (/fight|लड़ाई|sword/.test(bits)) out.push("epic duel dramatic lighting");
  if (/romance|प्रेम|rain|monsoon/.test(bits)) out.push("romantic monsoon India cinematic");
  return out.slice(0, 3);
}

/**
 * Core mind: plan which character goes on which panel + search queries.
 */
export function planCharacterPhotos(opts: {
  title: string;
  language: "en" | "hi";
  characters: MindCharacter[];
  scenes: MindScene[];
  layout?: "dual" | "single";
}): CharacterPhotoMindReport {
  const { title, language, characters, scenes } = opts;
  const layout = opts.layout || "dual";
  const sorted = [...scenes].sort((a, b) => a.order - b.order);

  const castPlans = characters.map((c) => ({
    name: c.name,
    role: c.role,
    appearance: c.appearance,
    queries: buildCharacterQueries(c, language),
  }));

  const scenePlans: SceneCastPlan[] = sorted.map((sc) => {
    const present = detectPresentCharacters(sc, characters);
    const primaryChar = present[0] || null;
    const secondaryChar =
      layout === "dual" ? present[1] || present[0] || null : null;

    const toPlan = (c: MindCharacter | null, reason: string): CharacterQueryPlan | null => {
      if (!c) return null;
      return {
        characterName: c.name,
        role: c.role,
        queries: buildCharacterQueries(c, language),
        reason,
      };
    };

    return {
      sceneId: sc.id,
      order: sc.order,
      primary: toPlan(
        primaryChar,
        primaryChar
          ? language === "hi"
            ? `सीन में मुख्य: ${primaryChar.name}`
            : `Lead in scene: ${primaryChar.name}`
          : "",
      ),
      secondary: toPlan(
        secondaryChar,
        secondaryChar
          ? language === "hi"
            ? `द्वितीय पैनल: ${secondaryChar.name}`
            : `Second panel: ${secondaryChar.name}`
          : "",
      ),
      presentNames: present.map((p) => p.name),
      situationQueries: situationQueries(sc, title),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    cast: castPlans,
    scenes: scenePlans,
    continuityTips: [
      language === "hi"
        ? "एक बार चुनी हुई character photo अगले सीनों में reuse करें (continuity)"
        : "Reuse the same character photo across scenes for continuity",
      language === "hi"
        ? "Cast tab में reference photo upload करें — mind usse priority dega"
        : "Upload reference photos in Cast tab — mind prioritizes them",
      language === "hi"
        ? "Dual screen: ऊपर speaker / lead, नीचे world या second character"
        : "Dual: top = speaker/lead, bottom = world or second character",
    ],
    summary:
      language === "hi"
        ? `${characters.length} पात्र · ${scenePlans.length} सीन — script-aware photo plan ready`
        : `${characters.length} characters · ${scenePlans.length} scenes — script-aware photo plan ready`,
  };
}

/**
 * Continuity map: character name → preferred image URL/data already chosen.
 * Call after each successful pick so later scenes stay consistent.
 */
export class CharacterContinuityMap {
  private map = new Map<string, string>();

  get(name: string): string | undefined {
    return this.map.get(normName(name));
  }

  set(name: string, imageDataOrUrl: string) {
    if (name && imageDataOrUrl) this.map.set(normName(name), imageDataOrUrl);
  }

  seedFromCast(characters: MindCharacter[]) {
    for (const c of characters) {
      const img = c.referenceImageLocal || c.referenceImageUrl;
      if (img) this.set(c.name, img);
    }
  }

  entries(): Array<{ name: string; image: string }> {
    return [...this.map.entries()].map(([name, image]) => ({ name, image }));
  }
}

/** Rank candidate URLs: prefer ones whose title/source text matches character tokens */
export function rankCandidatesForCharacter(
  candidates: Array<{ url: string; title?: string; source?: string }>,
  characterName: string,
  appearance?: string,
): Array<{ url: string; title?: string; source?: string; score: number }> {
  const tokens = [characterName, appearance || ""]
    .join(" ")
    .toLowerCase()
    .split(/[^\w\u0900-\u097F]+/)
    .filter((t) => t.length >= 3);

  const mythBoost = /राम|rama|सीता|sita|हाथी|elephant|हनुमान|hanuman/i.test(
    characterName + (appearance || ""),
  );

  return candidates
    .map((c) => {
      const hay = `${c.title || ""} ${c.url} ${c.source || ""}`.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        if (hay.includes(t.toLowerCase())) score += 2;
      }
      if (mythBoost && /rama|ramayana|sita|elephant|mythology|hindu|india/.test(hay))
        score += 3;
      if (/portrait|face|person|character/.test(hay)) score += 1;
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);
}
