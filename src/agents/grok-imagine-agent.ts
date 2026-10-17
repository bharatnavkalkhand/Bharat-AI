/**
 * Grok Imagine client — calls /api/agents/imagine (server holds XAI_API_KEY).
 * Optional paid path. Free default remains web-image-agent.
 */

import type { DirectorSceneInput, ScreenLayout } from "./director-agent";
import type { SceneImageFill, WebImageAgentResult } from "./web-image-agent";

export interface ImagineStatus {
  configured: boolean;
  model?: string;
  note?: string;
}

export async function getImagineStatus(): Promise<ImagineStatus> {
  try {
    const r = await fetch("/api/agents/imagine");
    if (!r.ok) return { configured: false, note: "Imagine API unreachable" };
    return (await r.json()) as ImagineStatus;
  } catch {
    return { configured: false, note: "Imagine API unreachable" };
  }
}

function buildScenePrompt(
  movieTitle: string,
  sc: DirectorSceneInput,
  language: "en" | "hi",
): string {
  const langHint =
    language === "hi"
      ? "Indian cinematic still, culturally authentic details, Hindi epic mood"
      : "cinematic still, photoreal film frame";
  const parts = [
    `Movie: ${movieTitle}`,
    `Scene: ${sc.title}`,
    sc.mood ? `Mood: ${sc.mood}` : "",
    sc.visualPrompt || "",
    sc.gestureNotes || "",
    (sc.dialogue || "").slice(0, 120),
    (sc.narration || "").slice(0, 120),
    `Style: ${langHint}, single clear subject, sharp faces, vertical 9:16 mobile reel frame, no text overlay, no watermark`,
  ].filter(Boolean);
  return parts.join(". ").slice(0, 1800);
}

export async function generateImagineFrame(prompt: string): Promise<{
  ok: boolean;
  imageDataUrl?: string;
  message?: string;
  configured?: boolean;
}> {
  try {
    const r = await fetch("/api/agents/imagine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, aspect_ratio: "9:16", n: 1 }),
    });
    const data = (await r.json()) as {
      ok?: boolean;
      configured?: boolean;
      imageDataUrl?: string;
      imageUrl?: string;
      message?: string;
    };
    if (data.ok && (data.imageDataUrl || data.imageUrl)) {
      return {
        ok: true,
        imageDataUrl: data.imageDataUrl || data.imageUrl,
        configured: data.configured,
      };
    }
    return {
      ok: false,
      configured: data.configured,
      message: data.message || "Imagine failed",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Imagine network error",
    };
  }
}

/** Fill scenes with Grok Imagine (paid if key set). One frame per scene. */
export async function runGrokImagineAgent(opts: {
  title: string;
  language: "en" | "hi";
  layout: ScreenLayout;
  scenes: DirectorSceneInput[];
  maxScenes?: number;
  onProgress?: (msg: string) => void;
}): Promise<WebImageAgentResult> {
  const { title, language, layout, scenes } = opts;
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const limit = Math.min(sorted.length, opts.maxScenes ?? 6);
  const fills: SceneImageFill[] = [];
  let filledCount = 0;

  const status = await getImagineStatus();
  if (!status.configured) {
    opts.onProgress?.(
      language === "hi"
        ? "Grok Imagine: XAI_API_KEY Vercel me set nahi — free B use karein"
        : "Grok Imagine: set XAI_API_KEY in Vercel, or use free B",
    );
    return {
      fills: [],
      filledCount: 0,
      summary:
        language === "hi"
          ? "Imagine off — Vercel env me XAI_API_KEY add karein (paid). Free B available."
          : "Imagine off — add XAI_API_KEY in Vercel (paid). Free B available.",
    };
  }

  for (let i = 0; i < limit; i++) {
    const sc = sorted[i];
    opts.onProgress?.(
      language === "hi"
        ? `Grok Imagine सीन ${i + 1}/${limit}…`
        : `Grok Imagine scene ${i + 1}/${limit}…`,
    );
    const prompt = buildScenePrompt(title, sc, language);
    const result = await generateImagineFrame(prompt);

    const fill: SceneImageFill = {
      sceneId: sc.id,
      title: sc.title,
      mood: sc.mood,
      queries: [prompt.slice(0, 80)],
      candidates: result.imageDataUrl
        ? [
            {
              url: result.imageDataUrl,
              source: "mixed",
              title: "grok-imagine",
            },
          ]
        : [],
      source: result.ok ? "mixed" : "none",
    };

    if (result.ok && result.imageDataUrl) {
      fill.imageTop = result.imageDataUrl;
      if (layout === "dual") fill.imageBottom = result.imageDataUrl;
      filledCount += 1;
    }

    fills.push(fill);

    if (!result.ok && result.message) {
      opts.onProgress?.(result.message);
      // Stop early on billing / auth failures
      if (/key|auth|credit|quota|billing|401|403/i.test(result.message)) break;
    }
  }

  return {
    fills,
    filledCount,
    summary:
      language === "hi"
        ? `Grok Imagine: ${filledCount}/${limit} frames (xAI paid API)`
        : `Grok Imagine: ${filledCount}/${limit} frames (xAI paid API)`,
  };
}
