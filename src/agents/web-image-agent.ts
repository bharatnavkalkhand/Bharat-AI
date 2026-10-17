/**
 * Web Image Agent — multi-source free search + cinematic queries (B)
 * + Character Photo Mind: script-aware character selection & continuity
 * Sources: Wikimedia, Openverse, Met Museum, Art Institute of Chicago
 */

import {
  searchPublicImages,
  type DirectorSceneInput,
  type ScreenLayout,
} from "./director-agent";
import { buildCinematicQueries } from "./cinematic-prompts";
import {
  planCharacterPhotos,
  CharacterContinuityMap,
  rankCandidatesForCharacter,
  type MindCharacter,
} from "./character-photo-mind";

export type ImageSourceId =
  | "wikimedia"
  | "openverse"
  | "met"
  | "artic"
  | "mixed"
  | "continuity"
  | "none";

export interface ImageCandidate {
  url: string;
  source: ImageSourceId;
  title?: string;
}

export interface SceneImageFill {
  sceneId: string;
  title: string;
  mood: string;
  queries: string[];
  candidates: ImageCandidate[];
  imageTop?: string;
  imageBottom?: string;
  source: ImageSourceId;
  /** Which characters the mind assigned */
  primaryCharacter?: string;
  secondaryCharacter?: string;
}

export interface WebImageAgentResult {
  fills: SceneImageFill[];
  filledCount: number;
  summary: string;
  mindSummary?: string;
}

function emotionQueries(mood: string, language: "en" | "hi"): string[] {
  const m = (mood || "neutral").toLowerCase();
  const hi = language === "hi";
  switch (m) {
    case "fight":
    case "action":
      return hi
        ? ["sword fight", "warrior sculpture", "storm clouds"]
        : ["dramatic duel", "action silhouette", "stormy sky"];
    case "romance":
      return hi
        ? ["monsoon rain India", "couple umbrella", "Taj Mahal sunset"]
        : ["romantic rain", "soft sunset", "couple silhouette"];
    case "emotional":
    case "dramatic":
      return [
        "lonely landscape",
        "dramatic portrait",
        hi ? "Varanasi ghat" : "misty river",
      ];
    case "comedy":
      return ["marketplace crowd", "theater mask", "bazaar India"];
    case "gesture":
    case "dialogue":
      return ["conversation painting", "portrait face", "classical portrait"];
    default:
      return [hi ? "India heritage" : "cinematic landscape", "film atmosphere"];
  }
}

function situationQueries(sc: DirectorSceneInput, movieTitle: string): string[] {
  const bits = [sc.title, sc.visualPrompt, sc.gestureNotes, movieTitle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const out: string[] = [];
  if (/taj|hotel|palace|महल|ताज/.test(bits)) out.push("Taj Mahal");
  if (/rain|monsoon|बारिश|umbrella/.test(bits)) out.push("monsoon rain");
  if (/train|railway|ट्रेन/.test(bits)) out.push("railway station India");
  if (/street|gali|गली|market/.test(bits)) out.push("Old Delhi street");
  if (/sea|beach|समुद्र|harbour/.test(bits)) out.push("harbour sunset");
  if (/temple|mandir|मंदिर/.test(bits)) out.push("Hindu temple");
  if (/fight|लड़ाई|sword|war/.test(bits)) out.push("battle painting");
  if (/love|romance|प्यार/.test(bits)) out.push("romantic garden");
  if (/राम|rama|elephant|हाथी|सीता/.test(bits))
    out.push("Ramayana forest illustration", "Lord Rama mythology art");
  return out.slice(0, 3);
}

export function buildEmotionSituationQueries(
  sc: DirectorSceneInput,
  movieTitle: string,
  language: "en" | "hi",
): string[] {
  const cinematic = buildCinematicQueries({
    title: movieTitle,
    sceneTitle: sc.title,
    mood: sc.mood,
    dialogue: sc.dialogue,
    narration: sc.narration,
    visualPrompt: sc.visualPrompt,
    gestureNotes: sc.gestureNotes,
    language,
  });
  const ranked = [
    ...cinematic,
    ...situationQueries(sc, movieTitle),
    ...emotionQueries(sc.mood, language),
  ];
  const uniq: string[] = [];
  for (const q of ranked) {
    const t = q.trim().slice(0, 100);
    if (t && !uniq.includes(t)) uniq.push(t);
  }
  return uniq.slice(0, 6);
}

async function searchOpenverse(
  query: string,
  limit = 6,
): Promise<ImageCandidate[]> {
  const q = encodeURIComponent(query.slice(0, 80));
  const url = `https://api.openverse.org/v1/images/?q=${q}&page_size=${limit}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{ url?: string; thumbnail?: string; title?: string }>;
    };
    return (data.results || [])
      .map((r) => ({
        url: r.thumbnail || r.url || "",
        source: "openverse" as const,
        title: r.title,
      }))
      .filter((c) => c.url.startsWith("http"));
  } catch {
    return [];
  }
}

async function searchMetMuseum(
  query: string,
  limit = 4,
): Promise<ImageCandidate[]> {
  try {
    const q = encodeURIComponent(query.slice(0, 60));
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${q}`;
    const res = await fetch(searchUrl);
    if (!res.ok) return [];
    const data = (await res.json()) as { objectIDs?: number[] };
    const ids = (data.objectIDs || []).slice(0, limit);
    const out: ImageCandidate[] = [];
    await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(
            `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
          );
          if (!r.ok) return;
          const obj = (await r.json()) as {
            primaryImageSmall?: string;
            primaryImage?: string;
            title?: string;
          };
          const img = obj.primaryImageSmall || obj.primaryImage;
          if (img) out.push({ url: img, source: "met", title: obj.title });
        } catch {
          /* skip */
        }
      }),
    );
    return out;
  } catch {
    return [];
  }
}

async function searchArtic(
  query: string,
  limit = 4,
): Promise<ImageCandidate[]> {
  try {
    const q = encodeURIComponent(query.slice(0, 60));
    const url =
      `https://api.artic.edu/api/v1/artworks/search?q=${q}` +
      `&fields=id,title,image_id&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{ title?: string; image_id?: string | null }>;
    };
    return (data.data || [])
      .filter((d) => d.image_id)
      .map((d) => ({
        url: `https://www.artic.edu/iiif/2/${d.image_id}/full/400,/0/default.jpg`,
        source: "artic" as const,
        title: d.title,
      }));
  } catch {
    return [];
  }
}

export async function searchMultiSource(
  query: string,
  target = 14,
): Promise<ImageCandidate[]> {
  const [wiki, open, met, artic] = await Promise.all([
    searchPublicImages(query, 5).then((urls) =>
      urls.map((url) => ({ url, source: "wikimedia" as const })),
    ),
    searchOpenverse(query, 6),
    searchMetMuseum(query, 4),
    searchArtic(query, 4),
  ]);
  const merged: ImageCandidate[] = [];
  const seen = new Set<string>();
  for (const c of [...wiki, ...open, ...met, ...artic]) {
    const key = c.url.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
    if (merged.length >= target) break;
  }
  return merged;
}

export async function materializeImage(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return url;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") && blob.size < 500) return url;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("read fail"));
      reader.onerror = () => reject(new Error("read fail"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

async function searchForCharacterQueries(
  queries: string[],
  usedUrls: Set<string>,
  target = 10,
): Promise<ImageCandidate[]> {
  const candidates: ImageCandidate[] = [];
  for (const q of queries) {
    if (candidates.length >= target) break;
    const batch = await searchMultiSource(q, target - candidates.length);
    for (const c of batch) {
      const key = c.url.split("?")[0];
      if (usedUrls.has(key)) continue;
      usedUrls.add(key);
      candidates.push(c);
      if (candidates.length >= target) break;
    }
  }
  return candidates;
}

export async function runWebImageAgent(opts: {
  title: string;
  language: "en" | "hi";
  layout: ScreenLayout;
  scenes: DirectorSceneInput[];
  /** Script cast — enables Character Photo Mind */
  characters?: MindCharacter[];
  onProgress?: (msg: string) => void;
}): Promise<WebImageAgentResult> {
  const { title, language, layout, scenes } = opts;
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const fills: SceneImageFill[] = [];
  let filledCount = 0;
  const usedUrls = new Set<string>();
  const continuity = new CharacterContinuityMap();
  const cast = opts.characters || [];
  continuity.seedFromCast(cast);

  // Mind plan: who appears in which scene + character queries
  const mind =
    cast.length > 0
      ? planCharacterPhotos({
          title,
          language,
          characters: cast,
          scenes: sorted.map((s) => ({
            id: s.id,
            order: s.order,
            title: s.title,
            mood: s.mood,
            dialogue: s.dialogue,
            narration: s.narration,
            visualPrompt: s.visualPrompt,
            gestureNotes: s.gestureNotes,
          })),
          layout,
        })
      : null;

  if (mind) {
    opts.onProgress?.(
      language === "hi"
        ? `Character Mind: ${mind.summary}`
        : `Character Mind: ${mind.summary}`,
    );
  }

  for (let i = 0; i < sorted.length; i++) {
    const sc = sorted[i];
    opts.onProgress?.(
      language === "hi"
        ? `Photo mind: सीन ${i + 1}/${sorted.length}…`
        : `Photo mind: scene ${i + 1}/${sorted.length}…`,
    );

    const plan = mind?.scenes.find((p) => p.sceneId === sc.id) || mind?.scenes[i];
    const primaryName = plan?.primary?.characterName;
    const secondaryName = plan?.secondary?.characterName;

    // 1) Character-specific queries first (mind)
    const charQueries = [
      ...(plan?.primary?.queries || []),
      ...(plan?.secondary?.queries || []),
      ...(plan?.situationQueries || []),
    ];
    // 2) Then cinematic / emotion fallbacks
    const moodQueries = buildEmotionSituationQueries(sc, title, language);
    const queries = [...charQueries, ...moodQueries].filter(Boolean);
    const uniqQ: string[] = [];
    for (const q of queries) {
      if (!uniqQ.includes(q)) uniqQ.push(q);
    }

    let candidates: ImageCandidate[] = [];

    // Continuity: if we already picked a face for this character, prefer it
    const contTop = primaryName ? continuity.get(primaryName) : undefined;
    const contBottom =
      layout === "dual" && secondaryName
        ? continuity.get(secondaryName)
        : undefined;

    if (charQueries.length) {
      candidates = await searchForCharacterQueries(uniqQ.slice(0, 6), usedUrls, 14);
    } else {
      for (const q of uniqQ.slice(0, 6)) {
        if (candidates.length >= 14) break;
        const batch = await searchMultiSource(q, 14 - candidates.length);
        for (const c of batch) {
          const key = c.url.split("?")[0];
          if (usedUrls.has(key)) continue;
          usedUrls.add(key);
          candidates.push(c);
          if (candidates.length >= 14) break;
        }
      }
    }

    // Rank by character name / appearance tokens
    if (primaryName && candidates.length) {
      const ranked = rankCandidatesForCharacter(
        candidates,
        primaryName,
        plan?.primary?.role,
      );
      candidates = ranked.map((r) => ({
        url: r.url,
        source: (r.source as ImageSourceId) || "mixed",
        title: r.title,
      }));
    }

    const need = layout === "dual" ? 2 : 1;
    const material: string[] = [];
    let source: ImageSourceId = candidates[0]?.source || "none";

    // Top panel: continuity first, else best ranked candidate
    if (contTop) {
      material.push(contTop);
      source = "continuity";
    } else if (candidates[0]) {
      const img = await materializeImage(candidates[0].url);
      material.push(img);
      if (primaryName) continuity.set(primaryName, img);
    }

    // Bottom panel
    if (layout === "dual") {
      if (contBottom && contBottom !== material[0]) {
        material.push(contBottom);
        source = source === "continuity" ? "continuity" : "mixed";
      } else if (candidates[1]) {
        const img = await materializeImage(candidates[1].url);
        material.push(img);
        if (secondaryName) continuity.set(secondaryName, img);
      } else if (candidates[0] && !material[1]) {
        // fallback: second materialize of next candidate or same
        const img = await materializeImage(candidates[0].url);
        material.push(img);
      }
    }

    // Ensure we tried at least `need` materials from candidates if continuity empty
    while (material.length < need && candidates[material.length]) {
      const img = await materializeImage(candidates[material.length].url);
      material.push(img);
    }

    const sources = new Set(candidates.map((c) => c.source));
    if (sources.size > 1 && source !== "continuity") source = "mixed";

    const fill: SceneImageFill = {
      sceneId: sc.id,
      title: sc.title,
      mood: sc.mood,
      queries: uniqQ.slice(0, 8),
      candidates,
      source,
      primaryCharacter: primaryName,
      secondaryCharacter: secondaryName,
    };

    if (material[0]) {
      fill.imageTop = material[0];
      filledCount += 1;
    }
    if (layout === "dual" && material[1]) fill.imageBottom = material[1];

    fills.push(fill);
  }

  const avg =
    fills.reduce((a, f) => a + f.candidates.length, 0) / Math.max(fills.length, 1);
  const withCast = fills.filter((f) => f.primaryCharacter).length;

  return {
    fills,
    filledCount,
    mindSummary: mind?.summary,
    summary:
      language === "hi"
        ? `${filledCount}/${sorted.length} सीन · mind: ${withCast} cast-matched · ~${Math.round(avg)} विकल्प`
        : `Filled ${filledCount}/${sorted.length} · mind: ${withCast} cast-matched · ~${Math.round(avg)} options`,
  };
}
