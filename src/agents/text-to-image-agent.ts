/**
 * Free text-to-image for Bharat AI scenes / cast stills.
 *
 * Uses Pollinations public image API — no API key, no HF Space setup.
 * Honest limits: public rate limits, variable quality, not photoreal face ID.
 *
 * Flow: scene visualPrompt / title → image URL → optional blob data-URL for offline store.
 */

export interface TextToImageInput {
  prompt: string;
  /** Default 9:16 portrait for Reels-style scenes */
  width?: number;
  height?: number;
  seed?: number;
  /** Prefer cinematic Indian film still look */
  styleHint?: string;
}

export interface TextToImageResult {
  imageUrl: string;
  /** data:image/... when fetch succeeded (may fail on CORS in some browsers) */
  dataUrl?: string;
  promptUsed: string;
}

function buildPrompt(input: TextToImageInput): string {
  const base = (input.prompt || "cinematic scene").trim().slice(0, 400);
  const style =
    input.styleHint ||
    "cinematic film still, photoreal, dramatic lighting, Indian cinema, clear faces, no text, no watermark";
  return `${base}, ${style}`;
}

/** Public Pollinations image URL (works as <img src> even if fetch is CORS-blocked). */
export function buildPollinationsImageUrl(input: TextToImageInput): string {
  const prompt = buildPrompt(input);
  const width = input.width ?? 720;
  const height = input.height ?? 1280;
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);
  const q = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${q}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;
}

/**
 * Generate a still. Always returns imageUrl; tries to materialize dataUrl for scene store.
 */
export async function generateTextToImage(
  input: TextToImageInput,
): Promise<TextToImageResult> {
  const promptUsed = buildPrompt(input);
  const imageUrl = buildPollinationsImageUrl({ ...input, prompt: input.prompt });

  let dataUrl: string | undefined;
  try {
    const res = await fetch(imageUrl, { mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(blob);
      });
      if (!dataUrl.startsWith("data:")) dataUrl = undefined;
    }
  } catch {
    // CORS or network — UI can still use imageUrl directly
  }

  return { imageUrl, dataUrl, promptUsed };
}

/** Build prompts for each scene from visualPrompt / title / mood */
export function scenePromptsFromMovie(movie: {
  title: string;
  scenes: Array<{
    id: string;
    title: string;
    mood?: string;
    visualPrompt?: string;
    dialogue?: string;
  }>;
}): Array<{ sceneId: string; prompt: string }> {
  return movie.scenes.map((s) => ({
    sceneId: s.id,
    prompt:
      s.visualPrompt ||
      [s.title, s.mood, movie.title, (s.dialogue || "").slice(0, 80)]
        .filter(Boolean)
        .join(", "),
  }));
}
