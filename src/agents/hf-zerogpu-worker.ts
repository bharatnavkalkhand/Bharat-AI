/**
 * Hugging Face ZeroGPU Gradio adapter — Wan 2.1 T2V 1.3B
 *
 * Public Space (no token in browser):
 *   POST {space}/gradio_api/call/generate
 *   GET  {space}/gradio_api/call/generate/{event_id}
 *
 * Free tier quota is limited and varies by account/Space. Generates short,
 * silent 16:9 clips only; audio is added in a separate stage.
 */

import {
  type GpuWorkerAdapter,
  type RemoteJobStatus,
  type ShotRequest,
  type WorkerQuota,
  QuotaUnavailableError,
} from "./gpu-worker-pool";

/** Map duration → supported frame counts (16 fps in worker) */
export function durationToFrames(durationSec: number): 17 | 33 | 49 {
  if (durationSec <= 1.2) return 17;
  if (durationSec <= 2.5) return 33;
  return 49;
}

function framesToSeconds(frames: number): number {
  return frames / 16;
}

/** Rough GPU-seconds estimate for ranking (empirical headroom) */
export function estimateZeroGpuSeconds(frames: number): number {
  if (frames <= 17) return 45;
  if (frames <= 33) return 75;
  return 110;
}

interface GradioJob {
  eventId: string;
  spaceBase: string;
  startedAt: number;
}

/** In-browser job registry (tab-scoped) */
const jobs = new Map<string, GradioJob>();

function normalizeSpaceUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  const match = trimmed.match(
    /huggingface\.co\/spaces\/([^/]+)\/([^/?#]+)/i,
  );
  if (match) {
    const user = match[1].toLowerCase().replace(/_/g, "-");
    const name = match[2].toLowerCase().replace(/_/g, "-");
    return `https://${user}-${name}.hf.space`;
  }
  return trimmed;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Gradio Video outputs vary by version: string, {url}, {path}, or {video:{...}}. */
function extractVideoUrl(value: unknown, spaceBase: string): string | null {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/gradio_api/file=") || value.startsWith("/file=")) {
      return `${spaceBase}${value}`;
    }
    if (value.startsWith("/")) {
      return `${spaceBase}/gradio_api/file=${value}`;
    }
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractVideoUrl(item, spaceBase);
      if (found) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Prefer a directly supplied URL, then recurse into common Gradio Video fields.
    if (typeof record.url === "string") {
      const direct = extractVideoUrl(record.url, spaceBase);
      if (direct) return direct;
    }
    if (typeof record.path === "string") {
      const fromPath = extractVideoUrl(record.path, spaceBase);
      if (fromPath) return fromPath;
    }
    if ("video" in record) {
      const nested = extractVideoUrl(record.video, spaceBase);
      if (nested) return nested;
    }
    if ("data" in record) {
      const nested = extractVideoUrl(record.data, spaceBase);
      if (nested) return nested;
    }
  }

  return null;
}

/** Submit to Gradio queue API. data = [prompt, num_frames, seed]. */
async function gradioCall(
  spaceBase: string,
  prompt: string,
  numFrames: number,
  seed: number,
): Promise<string> {
  const res = await fetch(`${spaceBase}/gradio_api/call/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [prompt, numFrames, seed] }),
  });

  if (res.status === 429 || res.status === 503) {
    throw new QuotaUnavailableError("HF ZeroGPU busy or daily quota exhausted");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (/quota|limit|gpu|busy|429/i.test(body)) {
      throw new QuotaUnavailableError(body.slice(0, 200));
    }
    throw new Error(`HF Gradio call failed: ${res.status} ${body.slice(0, 120)}`);
  }

  const body = (await res.json()) as { event_id?: string };
  if (!body.event_id) throw new Error("HF Gradio missing event_id");
  return body.event_id;
}

/** Poll Gradio event stream for a result and normalize the Video component payload. */
async function gradioPoll(
  spaceBase: string,
  eventId: string,
  maxMs = 240_000,
): Promise<RemoteJobStatus> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(
        `${spaceBase}/gradio_api/call/generate/${encodeURIComponent(eventId)}`,
      );
      if (res.status === 429 || res.status === 503) {
        return {
          status: "failed",
          error: "HF ZeroGPU quota exhausted or Space busy",
          retryable: true,
        };
      }
      if (!res.ok) {
        await sleep(2500);
        continue;
      }

      const text = await res.text();
      const dataLines = text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const line of dataLines) {
        if (!line || line === "null") continue;
        try {
          const parsed = JSON.parse(line) as unknown;
          const videoUrl = extractVideoUrl(parsed, spaceBase);
          if (videoUrl) return { status: "succeeded", videoUrl };

          if (
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed) &&
            "error" in parsed
          ) {
            const error = (parsed as { error: unknown }).error;
            return {
              status: "failed",
              error: String(error ?? "Gradio generation failed"),
              retryable: true,
            };
          }
        } catch {
          // Ignore non-JSON heartbeat/progress lines and keep polling.
        }
      }

      if (/event: complete/.test(text) && dataLines.length > 0) {
        return {
          status: "failed",
          error: "Gradio completed without returning a recognizable video URL",
          retryable: false,
        };
      }
      await sleep(3000);
    } catch {
      await sleep(3000);
    }
  }
  return { status: "failed", error: "timeout", retryable: true };
}

/**
 * Create a worker adapter for a deployed ZeroGPU Space.
 * @param spaceUrl e.g. https://user-bharat-ai-video-worker.hf.space
 * or https://huggingface.co/spaces/user/bharat-ai-video-worker
 */
export function createHfZeroGpuWorker(
  spaceUrl: string,
  opts?: { id?: string; dailyGpuMinutes?: number },
): GpuWorkerAdapter {
  const spaceBase = normalizeSpaceUrl(spaceUrl);
  const id = opts?.id || "hf-zerogpu";
  // Estimate only: public ZeroGPU quota is not exposed as a remaining balance.
  const dailySeconds = (opts?.dailyGpuMinutes ?? 5) * 60;

  return {
    id,

    supports(request: ShotRequest) {
      return request.aspectRatio === "16:9" && request.durationSec <= 4;
    },

    async quota(): Promise<WorkerQuota> {
      try {
        const res = await fetch(spaceBase, { method: "GET" });
        if (!res.ok && res.status >= 500) {
          return {
            available: false,
            remainingUnits: null,
            unit: "gpu-seconds",
            reason: `Space HTTP ${res.status}`,
          };
        }
        return {
          available: true,
          remainingUnits: dailySeconds,
          unit: "gpu-seconds",
          reason: "Estimate only; HF ZeroGPU does not publish remaining quota",
        };
      } catch (error) {
        return {
          available: false,
          remainingUnits: null,
          unit: "gpu-seconds",
          reason: error instanceof Error ? error.message : "unreachable",
        };
      }
    },

    estimateUnits(request: ShotRequest) {
      return estimateZeroGpuSeconds(durationToFrames(request.durationSec));
    },

    async submit(request: ShotRequest, idempotencyKey: string) {
      const frames = durationToFrames(request.durationSec);
      const seed = request.seed || Math.floor(Math.random() * 1e9);
      const eventId = await gradioCall(spaceBase, request.prompt, frames, seed);
      const job = { eventId, spaceBase, startedAt: Date.now() };
      jobs.set(idempotencyKey, job);
      jobs.set(eventId, job);
      return { remoteJobId: eventId };
    },

    async status(remoteJobId: string): Promise<RemoteJobStatus> {
      const job = jobs.get(remoteJobId);
      return gradioPoll(job?.spaceBase || spaceBase, remoteJobId);
    },
  };
}

/** One-shot helper for a short silent test clip. */
export async function generateSilentClip(opts: {
  spaceUrl: string;
  prompt: string;
  durationSec?: number;
  seed?: number;
  onProgress?: (message: string) => void;
}): Promise<{ videoUrl: string; frames: number } | { error: string }> {
  const worker = createHfZeroGpuWorker(opts.spaceUrl);
  const frames = durationToFrames(opts.durationSec ?? 2);
  const request: ShotRequest = {
    movieId: "test",
    sceneId: "shot-0",
    prompt: opts.prompt,
    aspectRatio: "16:9",
    width: 832,
    height: 480,
    durationSec: framesToSeconds(frames),
    seed: opts.seed ?? 42,
  };

  opts.onProgress?.("Submitting to HF ZeroGPU…");
  try {
    const { remoteJobId } = await worker.submit(request, `clip-${Date.now()}`);
    opts.onProgress?.("Queued — generating (may take 1–2 min)…");
    const status = await worker.status(remoteJobId);
    if (status.status === "succeeded") {
      return { videoUrl: status.videoUrl, frames };
    }
    return { error: status.status === "failed" ? status.error : "unknown" };
  } catch (error) {
    if (error instanceof QuotaUnavailableError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "failed" };
  }
}
