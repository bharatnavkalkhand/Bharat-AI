/**
 * Free text-to-image for Bharat AI scenes / cast stills.
 *
 * Uses Pollinations public image API — no API key, no HF Space setup.
 * Honest limits: public rate limits, variable quality, not photoreal face ID.
 * High-resolution friendly: defaults raised for clearer stills.
 *
 * Flow: scene visualPrompt / title → image URL → optional blob data-URL for offline store.
 */

export interface TextToImageInput {
  prompt: string;
  /** Default higher-res for free high-quality stills (Pollinations supports) */
  width?: number;
  height?: number;
  seed?: number;
  /** Prefer cinematic Indian film still look */
  styleHint?: string;
  /** Force high-resolution mode */
  highRes?: boolean;
}

export interface TextToImageResult {
  imageUrl: string;
  /** data:image/... when fetch succeeded (may fail on CORS in some browsers) */
  dataUrl?: string;
  promptUsed: string;
}

function buildPrompt(input: TextToImageInput): string {
  const base = (input.prompt || "cinematic scene").trim().slice(0, 500);
  const style =
    input.styleHint ||
    "cinematic film still, photoreal, dramatic lighting, Indian cinema, clear faces, sharp details, high resolution, no text, no watermark";
  return `${base}, ${style}`;
}

/** Public Pollinations image URL (works as <img src> even if fetch is CORS-blocked). */
export function buildPollinationsImageUrl(input: TextToImageInput): string {
  const prompt = buildPrompt(input);
  // Higher defaults for free high-res path
  const width = input.width ?? (input.highRes ? 1280 : 1024);
  const height = input.height ?? (input.highRes ? 720 : 1024);
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);
  const q = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${q}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true&model=flux`;
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
