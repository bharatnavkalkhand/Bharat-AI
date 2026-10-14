/**
 * Web Image Agent
 * Pulls free public images (Wikimedia Commons) by emotion + situation
 * and prepares them for automatic insertion into movie scenes.
 * ₹0 — no paid stock APIs.
 */

import {
  searchPublicImages,
  type DirectorSceneInput,
  type ScreenLayout,
} from "./director-agent";

export interface SceneImageFill {
  sceneId: string;
  title: string;
  mood: string;
  queries: string[];
  imageTop?: string;
  imageBottom?: string;
  source: "wikimedia" | "none";
}

export interface WebImageAgentResult {
  fills: SceneImageFill[];
  filledCount: number;
  summary: string;
}

/** Emotion → visual search vocabulary (public domain friendly) */
function emotionQueries(mood: string, language: "en" | "hi"): string[] {
  const m = (mood || "neutral").toLowerCase();
  const hi = language === "hi";
  switch (m) {
    case "fight":
    case "action":
      return hi
        ? ["sword fight painting", "warrior India sculpture", "dramatic storm clouds"]
        : ["dramatic duel painting", "action silhouette cliff", "stormy sky cinematic"];
    case "romance":
      return hi
        ? ["monsoon rain India street", "couple under umbrella painting", "sunset Taj Mahal"]
        : ["romantic rain street painting", "soft sunset landscape", "couple silhouette dusk"];
    case "emotional":
    case "dramatic":
      return [
        "lonely figure landscape painting",
        "dramatic sky portrait art",
        hi ? "Varanasi ghat dawn" : "misty river morning",
      ];
    case "comedy":
      return ["marketplace crowd painting", "comic theater mask", "bright bazaar India"];
    case "gesture":
    case "dialogue":
      return [
        "two people conversation painting",
        "portrait face classical art",
        hi ? "Mughal court scene" : "classical portrait painting",
      ];
    default:
      return [
        hi ? "India architecture heritage" : "cinematic landscape photography",
        "film still atmosphere",
      ];
  }
}

function situationQueries(sc: DirectorSceneInput, movieTitle: string): string[] {
  const bits = [sc.title, sc.visualPrompt, sc.gestureNotes, movieTitle]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const out: string[] = [];
  if (/taj|hotel|palace|महल|ताज/.test(bits)) out.push("Taj Mahal India");
  if (/rain|monsoon|बारिश|umbrella/.test(bits)) out.push("monsoon rain Mumbai");
  if (/train|railway|ट्रेन/.test(bits)) out.push("Indian railway station");
  if (/street|gali|गली|market/.test(bits)) out.push("Old Delhi street");
  if (/sea|beach|समुद्र|harbour/.test(bits)) out.push("Mumbai harbour sunset");
  if (/temple|mandir|मंदिर/.test(bits)) out.push("Hindu temple India");
  if (/fight|लड़ाई|sword|war/.test(bits)) out.push("historical battle painting");
  if (/love|romance|प्यार|kiss/.test(bits)) out.push("romantic garden painting");
  return out.slice(0, 2);
}

export function buildEmotionSituationQueries(
  sc: DirectorSceneInput,
  movieTitle: string,
  language: "en" | "hi",
): string[] {
  const emo = emotionQueries(sc.mood, language);
  const sit = situationQueries(sc, movieTitle);
  const custom = [sc.visualPrompt, sc.title].filter(Boolean) as string[];
  // Prefer situation + emotion mix for relevance
  const ranked = [...sit, ...custom, ...emo].filter(Boolean);
  const uniq: string[] = [];
  for (const q of ranked) {
    const t = q.trim().slice(0, 90);
    if (t && !uniq.includes(t)) uniq.push(t);
  }
  return uniq.slice(0, 4);
}

/** Fetch remote image → data URL when CORS allows; else return URL */
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

/**
 * Search web spaces (Commons) and return images ready to drop into scenes.
 */
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
        ? `वेब इमेज: सीन ${i + 1}/${sorted.length} (${sc.mood})…`
        : `Web images: scene ${i + 1}/${sorted.length} (${sc.mood})…`,
    );

    const queries = buildEmotionSituationQueries(sc, title, language);
    const need = layout === "dual" ? 2 : 1;
    const found: string[] = [];

    for (const q of queries) {
      if (found.length >= need) break;
      const urls = await searchPublicImages(q, 4);
      for (const u of urls) {
        if (usedUrls.has(u)) continue;
        usedUrls.add(u);
        found.push(u);
        if (found.length >= need) break;
      }
    }

    // Materialize (data URL when possible)
    const material: string[] = [];
    for (const u of found) {
      material.push(await materializeImage(u));
    }

    const fill: SceneImageFill = {
      sceneId: sc.id,
      title: sc.title,
      mood: sc.mood,
      queries,
      source: material.length ? "wikimedia" : "none",
    };

    if (material[0]) {
      fill.imageTop = material[0];
      filledCount += 1;
    }
    if (layout === "dual" && material[1]) {
      fill.imageBottom = material[1];
    } else if (layout === "dual" && material[0]) {
      // second query pass for bottom if only one found
      const more = await searchPublicImages(queries[1] || queries[0] || sc.mood, 3);
      for (const u of more) {
        if (usedUrls.has(u)) continue;
        usedUrls.add(u);
        fill.imageBottom = await materializeImage(u);
        break;
      }
    }

    fills.push(fill);
  }

  return {
    fills,
    filledCount,
    summary:
      language === "hi"
        ? `${filledCount}/${sorted.length} सीन में वेब इमेज डाली (emotion + situation).`
        : `Inserted web images into ${filledCount}/${sorted.length} scenes (emotion + situation).`,
  };
}
