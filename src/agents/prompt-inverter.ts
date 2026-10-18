/**
 * Script → scene prompt inversion for Civitai / Roar.art / free stills.
 * Builds image prompt, motion prompt, search tags, and deep-links.
 */

import { moodToPromptHint, type Character, type Scene, type SceneMood } from "@/lib/types";
import {
  buildCinematicQueries,
  buildGenerationPrompt,
  type CinematicPromptInput,
} from "./cinematic-prompts";

export interface InvertedScenePrompt {
  sceneId: string;
  order: number;
  title: string;
  mood: string;
  /** Full image / still generation prompt */
  imagePrompt: string;
  /** Negative prompt for SD-style tools */
  negativePrompt: string;
  /** Roar.art / Img2Vid motion line */
  motionPrompt: string;
  /** Short tags for Civitai search */
  searchTags: string[];
  /** Ranked still search queries */
  searchQueries: string[];
  civitaiImagesUrl: string;
  civitaiVideosUrl: string;
  roarVideoUrl: string;
}

const NEGATIVE =
  "blurry, low quality, watermark, text, logo, extra limbs, deformed face, cropped head, dual heads, bad anatomy, jpeg artifacts";

function moodMotion(mood: string): string {
  const m = mood.toLowerCase();
  if (m === "fight" || m === "action")
    return "dynamic camera push-in, sharp body movement, dust particles, intense energy";
  if (m === "romance")
    return "gentle camera drift, soft fabric movement, warm light flicker, subtle breath";
  if (m === "emotional" || m === "dramatic")
    return "slow dolly in, slight head turn, emotional stillness then small gesture";
  if (m === "gesture")
    return "clear hand and body gestures, slow deliberate motion, hold poses";
  return "subtle parallax, soft ambient motion, natural idle movement";
}

function gestureToMotion(gesture?: string): string {
  if (!gesture?.trim()) return "";
  const g = gesture.toLowerCase();
  const bits: string[] = [];
  if (/लड़|fight|punch|kick|sword|तलवार/.test(g)) bits.push("combat strikes and blocks");
  if (/हाथ|hand|hold|पकड़/.test(g)) bits.push("hands meeting gently");
  if (/मुस्कान|smile|नज़र/.test(g)) bits.push("soft facial expression change");
  if (/चल|walk|step/.test(g)) bits.push("walking steps with weight shift");
  if (/सिर|bow|झुक/.test(g)) bits.push("head bow and rise");
  return bits.join(", ");
}

function tagsFromScene(sc: Scene, chars: Character[]): string[] {
  const tags = new Set<string>();
  const blob = [sc.title, sc.visualPrompt, sc.narration, sc.dialogue, sc.gestureNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/राम|rama|सीता|sita|हनुमान|hanuman|रावण|ayodhya|वन/.test(blob)) {
    tags.add("ramayana");
    tags.add("mythology");
    tags.add("india");
  }
  if (/elephant|हाथी|गज/.test(blob)) {
    tags.add("elephant");
    tags.add("forest");
  }
  if (/city|शहर|office|train/.test(blob)) tags.add("urban");
  if (sc.mood === "fight" || sc.mood === "action") tags.add("action");
  if (sc.mood === "romance") tags.add("romance");
  if (sc.mood === "emotional" || sc.mood === "dramatic") tags.add("drama");

  for (const c of chars.slice(0, 3)) {
    if (c.name) tags.add(c.name.split(/\s+/)[0]!);
  }

  tags.add("cinematic");
  return [...tags].slice(0, 8);
}

function encodeQuery(q: string): string {
  return encodeURIComponent(q.trim().slice(0, 80));
}

/**
 * Invert one scene into studio-ready prompts + deep links.
 */
export function invertScenePrompt(
  sc: Scene,
  opts?: {
    movieTitle?: string;
    characters?: Character[];
    language?: "en" | "hi";
  },
): InvertedScenePrompt {
  const characters = opts?.characters ?? [];
  const assigned = sc.characterIds
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => Boolean(c));
  const castLine = assigned
    .map((c) => [c.name, c.role, c.appearance].filter(Boolean).join(", "))
    .join("; ");

  const input: CinematicPromptInput = {
    title: opts?.movieTitle || "",
    sceneTitle: sc.title,
    mood: sc.mood,
    dialogue: sc.dialogue,
    narration: sc.narration,
    visualPrompt: sc.visualPrompt,
    gestureNotes: sc.gestureNotes,
    language: opts?.language,
  };

  const searchQueries = buildCinematicQueries(input);
  const gen = buildGenerationPrompt(input);
  const moodHint = moodToPromptHint(sc.mood as SceneMood);
  const imagePrompt = [
    gen,
    castLine ? `characters: ${castLine}` : "",
    moodHint,
    "vertical 9:16, film still",
  ]
    .filter(Boolean)
    .join(". ")
    .slice(0, 900);

  const motionFromGesture = gestureToMotion(sc.gestureNotes);
  const motionPrompt = [
    moodMotion(sc.mood),
    motionFromGesture,
    sc.gestureNotes ? `acting: ${sc.gestureNotes.slice(0, 120)}` : "",
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 280);

  const searchTags = tagsFromScene(sc, assigned.length ? assigned : characters);
  const primaryQ = searchQueries[0] || sc.title || "cinematic";

  return {
    sceneId: sc.id,
    order: sc.order,
    title: sc.title,
    mood: sc.mood,
    imagePrompt,
    negativePrompt: NEGATIVE,
    motionPrompt,
    searchTags,
    searchQueries,
    civitaiImagesUrl: `https://civitai.com/images?query=${encodeQuery(primaryQ)}`,
    civitaiVideosUrl: `https://civitai.com/videos?query=${encodeQuery(searchTags.slice(0, 4).join(" ") || primaryQ)}`,
    roarVideoUrl: "https://roar.art/video",
  };
}

export function invertAllScenes(
  scenes: Scene[],
  opts?: {
    movieTitle?: string;
    characters?: Character[];
    language?: "en" | "hi";
  },
): InvertedScenePrompt[] {
  return [...scenes]
    .sort((a, b) => a.order - b.order)
    .map((sc) => invertScenePrompt(sc, opts));
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
