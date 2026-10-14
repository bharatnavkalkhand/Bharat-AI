/**
 * A — Free render worker client (HF Space / Colab / any compatible HTTP)
 *
 * Contract (zero paid keys in frontend):
 * POST {workerUrl}/generate
 *   body: { prompt, sceneId, movieId, width?, height? }
 *   → { jobId } or { status:"succeeded", imageUrl | imageBase64 }
 * GET  {workerUrl}/status/:jobId
 *   → { status, imageUrl?, imageBase64?, message? }
 *
 * Ship a free Colab/HF notebook that implements this contract.
 * No API keys in browser code.
 */

import { buildGenerationPrompt, type CinematicPromptInput } from "./cinematic-prompts";

export interface WorkerSceneInput {
  id: string;
  order: number;
  title: string;
  mood: string;
  dialogue?: string;
  narration?: string;
  visualPrompt?: string;
  gestureNotes?: string;
}

export interface WorkerFill {
  sceneId: string;
  imageTop?: string;
  imageBottom?: string;
  source: "worker" | "none";
  message?: string;
}

export interface WorkerRunResult {
  fills: WorkerFill[];
  filledCount: number;
  summary: string;
}

function normalizeBase(url: string) {
  return url.replace(/\/$/, "");
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function requestGenerate(
  base: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${base}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function pollJob(
  base: string,
  jobId: string,
  maxMs = 90_000,
): Promise<Record<string, unknown> | null> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${base}/status/${encodeURIComponent(jobId)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      const st = String(data.status || "");
      if (st === "succeeded" || st === "failed") return data;
    } catch {
      return null;
    }
    await sleep(2500);
  }
  return null;
}

function extractImage(data: Record<string, unknown> | null): string | undefined {
  if (!data) return undefined;
  if (typeof data.imageBase64 === "string" && data.imageBase64.startsWith("data:"))
    return data.imageBase64;
  if (typeof data.imageBase64 === "string" && data.imageBase64.length > 100)
    return `data:image/png;base64,${data.imageBase64}`;
  if (typeof data.imageUrl === "string" && data.imageUrl.startsWith("http"))
    return data.imageUrl;
  if (typeof data.url === "string" && data.url.startsWith("http")) return data.url;
  return undefined;
}

/** Generate one scene image via free worker */
export async function generateSceneViaWorker(
  workerUrl: string,
  movieId: string,
  scene: WorkerSceneInput,
  movieTitle: string,
): Promise<string | null> {
  const base = normalizeBase(workerUrl);
  if (!base.startsWith("http")) return null;

  const promptInput: CinematicPromptInput = {
    title: movieTitle,
    sceneTitle: scene.title,
    mood: scene.mood,
    dialogue: scene.dialogue,
    narration: scene.narration,
    visualPrompt: scene.visualPrompt,
    gestureNotes: scene.gestureNotes,
  };
  const prompt = buildGenerationPrompt(promptInput);

  const first = await requestGenerate(base, {
    prompt,
    sceneId: scene.id,
    movieId,
    width: 576,
    height: 1024,
  });
  if (!first) return null;

  const immediate = extractImage(first);
  if (immediate) return immediate;

  const jobId = first.jobId as string | undefined;
  if (!jobId) return null;
  const done = await pollJob(base, jobId);
  return extractImage(done) || null;
}

export async function runRenderWorker(opts: {
  workerUrl: string;
  movieId: string;
  title: string;
  language: "en" | "hi";
  scenes: WorkerSceneInput[];
  dual?: boolean;
  onProgress?: (msg: string) => void;
}): Promise<WorkerRunResult> {
  const { workerUrl, movieId, title, language, scenes, dual } = opts;
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const fills: WorkerFill[] = [];
  let filledCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const sc = sorted[i];
    opts.onProgress?.(
      language === "hi"
        ? `Worker: सीन ${i + 1}/${sorted.length} generate…`
        : `Worker: scene ${i + 1}/${sorted.length}…`,
    );
    const img = await generateSceneViaWorker(workerUrl, movieId, sc, title);
    const fill: WorkerFill = {
      sceneId: sc.id,
      source: img ? "worker" : "none",
      message: img ? undefined : "Worker unavailable or timed out",
    };
    if (img) {
      fill.imageTop = img;
      if (dual) fill.imageBottom = img;
      filledCount += 1;
    }
    fills.push(fill);
  }

  return {
    fills,
    filledCount,
    summary:
      language === "hi"
        ? `Worker: ${filledCount}/${sorted.length} सीन (HF/Colab free endpoint)`
        : `Worker filled ${filledCount}/${sorted.length} scenes (HF/Colab free endpoint)`,
  };
}

/** Health check — does worker answer? */
export async function pingRenderWorker(workerUrl: string): Promise<boolean> {
  const base = normalizeBase(workerUrl);
  try {
    const res = await fetch(`${base}/health`, { method: "GET" });
    if (res.ok) return true;
  } catch {
    /* try generate with tiny prompt as fallback probe — skip to avoid cost */
  }
  try {
    const res = await fetch(base, { method: "GET" });
    return res.ok || res.status === 404; // space up even if no GET route
  } catch {
    return false;
  }
}
