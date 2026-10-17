/**
 * Web Image Agent — multi-source free search + cinematic queries (B)
 * + Character Photo Mind: script-aware character selection & continuity
 * AVG-inspired free stock: Openverse (dual host) + Wikimedia + Met + ArtIC
 * Sources require no API key.
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
  width?: number;
  height?: number;
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
  primaryCharacter?: string;
  secondaryCharacter?: string;
}

export interface WebImageAgentResult {
  fills: SceneImageFill[];
  filledCount: number;
  summary: string;
  mindSummary?: string;
}

const OPENVERSE_UA =
  "BharatAI/1.0 (https://bharat-ai-chi.vercel.app; free educational video studio)";

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

/** Prefer larger / landscape-friendly images (AVG-style quality bias) */
function scoreCandidate(c: ImageCandidate, queryTokens: string[]): number {
  let score = 0;
  const w = c.width || 0;
  const h = c.height || 0;
  if (w >= 800) score += 3;
  else if (w >= 400) score += 1;
  if (h >= 600) score += 2;
  if (w > 0 && h > 0 && w / h >= 0.7 && w / h <= 1.8) score += 1; // usable aspect
  // Prefer full URL over tiny thumbs in path
  if (!/thumb|thumbnail|\/\d+px-/i.test(c.url)) score += 2;
  const hay = `${c.title || ""} ${c.url}`.toLowerCase();
  for (const t of queryTokens) {
    if (t.length >= 3 && hay.includes(t.toLowerCase())) score += 2;
  }
  if (c.source === "openverse") score += 1; // AVG default free path
  if (c.source === "wikimedia") score += 1;
  return score;
}

function rankByQuality(
  candidates: ImageCandidate[],
  query: string,
): ImageCandidate[] {
  const tokens = query
    .toLowerCase()
    .split(/[^\w\u0900-\u097F]+/)
    .filter((t) => t.length >= 3);
  return candidates
    .map((c) => ({ c, s: scoreCandidate(c, tokens) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

/**
 * Openverse — dual host fallback (api.openverse.org + engineering),
 * prefer full `url` over thumbnail (AVG openverse-fetcher pattern).
 */
async function searchOpenverse(
  query: string,
  limit = 6,
): Promise<ImageCandidate[]> {
  const pageSize = Math.min(limit, 20);
  const hosts = [
    "https://api.openverse.org/v1/images/",
    "https://api.openverse.engineering/v1/images/",
  ];

  for (const base of hosts) {
    try {
      const url = `${base}?q=${encodeURIComponent(query.slice(0, 80))}&page_size=${pageSize}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": OPENVERSE_UA,
        },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        results?: Array<{
          url?: string;
          thumbnail?: string;
          title?: string;
          width?: number;
          height?: number;
        }>;
      };
      const mapped = (data.results || [])
        .map((r) => ({
          // AVG: prefer full url over thumbnail for quality
          url: r.url || r.thumbnail || "",
          source: "openverse" as const,
          title: r.title,
          width: r.width,
          height: r.height,
        }))
        .filter((c) => c.url.startsWith("http"));
      if (mapped.length) return mapped.slice(0, limit);
    } catch {
      /* try next host */
    }
  }
  return [];
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
          // Prefer full primary when available
          const img = obj.primaryImage || obj.primaryImageSmall;
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
        // Larger IIIF size for better quality
        url: `https://www.artic.edu/iiif/2/${d.image_id}/full/843,/0/default.jpg`,
        source: "artic" as const,
        title: d.title,
        width: 843,
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
    searchOpenverse(query, 8),
    searchMetMuseum(query, 4),
    searchArtic(query, 4),
  ]);
  const merged: ImageCandidate[] = [];
  const seen = new Set<string>();
  // Openverse first (AVG default free path), then wiki, then museums
  for (const c of [...open, ...wiki, ...met, ...artic]) {
    const key = c.url.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(c);
  }
  return rankByQuality(merged, query).slice(0, target);
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
    const batch = await searchMultiSource(q, target - candidates.length + 4);
    for (const c of batch) {
      const key = c.url.split("?")[0];
      if (usedUrls.has(key)) continue;
      usedUrls.add(key);
      candidates.push(c);
      if (candidates.length >= target) break;
    }
  }
  return rankByQuality(candidates, queries[0] || "");
}

export async function runWebImageAgent(opts: {
  title: string;
  language: "en" | "hi";
  layout: ScreenLayout;
  scenes: DirectorSceneInput[];
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
        ? `AVG stock + mind: सीन ${i + 1}/${sorted.length}…`
        : `AVG stock + mind: scene ${i + 1}/${sorted.length}…`,
    );

    const plan = mind?.scenes.find((p) => p.sceneId === sc.id) || mind?.scenes[i];
    const primaryName = plan?.primary?.characterName;
    const secondaryName = plan?.secondary?.characterName;

    const charQueries = [
      ...(plan?.primary?.queries || []),
      ...(plan?.secondary?.queries || []),
      ...(plan?.situationQueries || []),
    ];
    const moodQueries = buildEmotionSituationQueries(sc, title, language);
    const queries = [...charQueries, ...moodQueries].filter(Boolean);
    const uniqQ: string[] = [];
    for (const q of queries) {
      if (!uniqQ.includes(q)) uniqQ.push(q);
    }

    let candidates: ImageCandidate[] = [];

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
      candidates = rankByQuality(candidates, uniqQ[0] || sc.title);
    }

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
        width: (r as ImageCandidate).width,
        height: (r as ImageCandidate).height,
      }));
    }

    const need = layout === "dual" ? 2 : 1;
    const material: string[] = [];
    let source: ImageSourceId = candidates[0]?.source || "none";

    if (contTop) {
      material.push(contTop);
      source = "continuity";
    } else if (candidates[0]) {
      const img = await materializeImage(candidates[0].url);
      material.push(img);
      if (primaryName) continuity.set(primaryName, img);
    }

    if (layout === "dual") {
      if (contBottom && contBottom !== material[0]) {
        material.push(contBottom);
        source = source === "continuity" ? "continuity" : "mixed";
      } else if (candidates[1]) {
        const img = await materializeImage(candidates[1].url);
        material.push(img);
        if (secondaryName) continuity.set(secondaryName, img);
      } else if (candidates[0] && !material[1]) {
        const img = await materializeImage(candidates[0].url);
        material.push(img);
      }
    }

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
        ? `${filledCount}/${sorted.length} सीन · mind ${withCast} · AVG free stock · ~${Math.round(avg)} विकल्प`
        : `Filled ${filledCount}/${sorted.length} · mind ${withCast} · AVG free stock · ~${Math.round(avg)} options`,
  };
}
