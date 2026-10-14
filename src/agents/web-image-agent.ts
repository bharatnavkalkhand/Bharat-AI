/**
 * Web Image Agent — multi-source free search
 * Sources: Wikimedia Commons, Openverse, Met Museum API
 * Returns 8–10 candidates per scene for agent/user pick.
 * ₹0 — no paid stock APIs.
 */

import {
  searchPublicImages,
  type DirectorSceneInput,
  type ScreenLayout,
} from "./director-agent";

export type ImageSourceId =
  | "wikimedia"
  | "openverse"
  | "met"
  | "mixed"
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
  /** Up to ~10 options the agent found */
  candidates: ImageCandidate[];
  imageTop?: string;
  imageBottom?: string;
  source: ImageSourceId;
}

export interface WebImageAgentResult {
  fills: SceneImageFill[];
  filledCount: number;
  summary: string;
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
  return out.slice(0, 2);
}

export function buildEmotionSituationQueries(
  sc: DirectorSceneInput,
  movieTitle: string,
  language: "en" | "hi",
): string[] {
  const ranked = [
    ...situationQueries(sc, movieTitle),
    ...([sc.visualPrompt, sc.title].filter(Boolean) as string[]),
    ...emotionQueries(sc.mood, language),
  ];
  const uniq: string[] = [];
  for (const q of ranked) {
    const t = q.trim().slice(0, 90);
    if (t && !uniq.includes(t)) uniq.push(t);
  }
  return uniq.slice(0, 5);
}

async function searchOpenverse(
  query: string,
  limit = 5,
): Promise<ImageCandidate[]> {
  const q = encodeURIComponent(query.slice(0, 80));
  const url = `https://api.openverse.org/v1/images/?q=${q}&page_size=${limit}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
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
          if (img) {
            out.push({ url: img, source: "met", title: obj.title });
          }
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

/** Aggregate 8–10 candidates from multiple free sources */
export async function searchMultiSource(
  query: string,
  target = 10,
): Promise<ImageCandidate[]> {
  const [wiki, open, met] = await Promise.all([
    searchPublicImages(query, 4).then((urls) =>
      urls.map((url) => ({ url, source: "wikimedia" as const })),
    ),
    searchOpenverse(query, 5),
    searchMetMuseum(query, 3),
  ]);
  const merged: ImageCandidate[] = [];
  const seen = new Set<string>();
  for (const c of [...wiki, ...open, ...met]) {
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

export async function runWebImageAgent(opts: {
  title: string;
  language: "en" | "hi";
  layout: ScreenLayout;
  scenes: DirectorSceneInput[];
  onProgress?: (msg: string) => void;
}): Promise<WebImageAgentResult> {
  const { title, language, layout, scenes } = opts;
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const fills: SceneImageFill[] = [];
  let filledCount = 0;
  const usedUrls = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const sc = sorted[i];
    opts.onProgress?.(
      language === "hi"
        ? `मल्टी-सोर्स इमेज: सीन ${i + 1}/${sorted.length}…`
        : `Multi-source images: scene ${i + 1}/${sorted.length}…`,
    );

    const queries = buildEmotionSituationQueries(sc, title, language);
    let candidates: ImageCandidate[] = [];

    for (const q of queries) {
      if (candidates.length >= 10) break;
      const batch = await searchMultiSource(q, 10 - candidates.length);
      for (const c of batch) {
        const key = c.url.split("?")[0];
        if (usedUrls.has(key)) continue;
        usedUrls.add(key);
        candidates.push(c);
        if (candidates.length >= 10) break;
      }
    }

    const need = layout === "dual" ? 2 : 1;
    const picked = candidates.slice(0, need);
    const material: string[] = [];
    for (const c of picked) {
      material.push(await materializeImage(c.url));
    }

    const sources = new Set(candidates.map((c) => c.source));
    const source: ImageSourceId =
      sources.size > 1 ? "mixed" : candidates[0]?.source || "none";

    const fill: SceneImageFill = {
      sceneId: sc.id,
      title: sc.title,
      mood: sc.mood,
      queries,
      candidates,
      source,
    };

    if (material[0]) {
      fill.imageTop = material[0];
      filledCount += 1;
    }
    if (layout === "dual" && material[1]) {
      fill.imageBottom = material[1];
    }

    fills.push(fill);
  }

  return {
    fills,
    filledCount,
    summary:
      language === "hi"
        ? `${filledCount}/${sorted.length} सीन भरी · हर सीन ~${Math.round(
            fills.reduce((a, f) => a + f.candidates.length, 0) /
              Math.max(fills.length, 1),
          )} विकल्प (Commons + Openverse + Met).`
        : `Filled ${filledCount}/${sorted.length} scenes · ~${Math.round(
            fills.reduce((a, f) => a + f.candidates.length, 0) /
              Math.max(fills.length, 1),
          )} options each (Commons + Openverse + Met).`,
  };
}
