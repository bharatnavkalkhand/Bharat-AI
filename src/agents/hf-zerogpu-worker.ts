/**
 * Hugging Face ZeroGPU Gradio adapter — Wan 2.1 T2V 1.3B
 *
 * Public Space (no token in browser):
 *   POST {space}/gradio_api/call/generate
 *   GET  {space}/gradio_api/call/generate/{event_id}
 *
 * Free tier ~5 GPU minutes/day — short silent 16:9 clips only.
 * Audio is added later in Bharat AI pipeline.
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
  // 16 steps @ 480x832 — typical 40–90s wall; reserve conservatively
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
  let u = url.trim().replace(/\/$/, "");
  // Accept huggingface.co/spaces/user/name → https://user-name.hf.space
  const m = u.match(
    /huggingface\.co\/spaces\/([^/]+)\/([^/?#]+)/i,
  );
  if (m) {
    const user = m[1].toLowerCase().replace(/_/g, "-");
    const name = m[2].toLowerCase().replace(/_/g, "-");
    return `https://${user}-${name}.hf.space`;
  }
  return u;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Submit to Gradio queue API.
 * data = [prompt, num_frames, seed]
 */
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
    const text = await res.text().catch(() => "");
    if (/quota|limit|gpu|busy|429/i.test(text)) {
      throw new QuotaUnavailableError(text.slice(0, 200));
    }
    throw new Error(`HF Gradio call failed: ${res.status} ${text.slice(0, 120)}`);
  }

  const body = (await res.json()) as { event_id?: string };
  if (!body.event_id) throw new Error("HF Gradio missing event_id");
  return body.event_id;
}

/**
 * Poll Gradio event stream for result.
 * Returns video URL (often a temporary HF file URL).
 */
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
          error: "quota or busy",
          retryable: true,
        };
      }
      if (!res.ok) {
        await sleep(2500);
        continue;
      }

      const text = await res.text();
      // Gradio streams SSE-like lines: event: ... / data: ...
      const dataLines = text
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());

      for (const line of dataLines) {
        if (line === "null" || line === "") continue;
        try {
          const parsed = JSON.parse(line) as unknown;
          // Complete: [videoPathOrUrl, ...] or { video: url }
          if (Array.isArray(parsed) && parsed[0]) {
            const v = parsed[0];
            const url =
              typeof v === "string"
                ? v
                : typeof v === "object" &&
                    v &&
                    "url" in v &&
                    typeof (v as { url: string }).url === "string"
                  ? (v as { url: string }).url
                  : null;
            if (url) {
              // Relative paths → absolute on Space
              const videoUrl = url.startsWith("http")
                ? url
                : `${spaceBase}/file=${url}`;
              return { status: "succeeded", videoUrl };
            }
          }
          if (
            parsed &&
            typeof parsed === "object" &&
            "error" in (parsed as object)
          ) {
            return {
              status: "failed",
              error: String((parsed as { error: unknown }).error),
              retryable: true,
            };
          }
        } catch {
          /* keep polling */
        }
      }

      // Still processing
      if (/process|queue|pending|running/i.test(text) || dataLines.length === 0) {
        await sleep(3000);
        continue;
      }
    } catch {
      await sleep(3000);
      continue;
    }
    await sleep(3000);
  }
  return { status: "failed", error: "timeout", retryable: true };
}

/**
 * Create GpuWorkerAdapter for a deployed ZeroGPU Space.
 * @param spaceUrl e.g. https://user-bharat-ai-video-worker.hf.space
 *                  or https://huggingface.co/spaces/user/bharat-ai-video-worker
 */
export function createHfZeroGpuWorker(
  spaceUrl: string,
  opts?: { id?: string; dailyGpuMinutes?: number },
): GpuWorkerAdapter {
  const spaceBase = normalizeSpaceUrl(spaceUrl);
  const id = opts?.id || "hf-zerogpu";
  // Free tier default: 5 minutes = 300 seconds GPU time
  const dailySeconds = (opts?.dailyGpuMinutes ?? 5) * 60;

  return {
    id,

    supports(req: ShotRequest) {
      // Worker is 16:9 @ 832x480
      return req.aspectRatio === "16:9" && req.durationSec <= 4;
    },

    async quota(): Promise<WorkerQuota> {
      // ZeroGPU does not expose remaining quota via public API.
      // Optimistic: available until we hit 429/503.
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
          // Unknown remaining — report daily budget so ranking still works
          remainingUnits: dailySeconds,
          unit: "gpu-seconds",
          reason: "HF ZeroGPU does not publish remaining quota; estimate only",
        };
      } catch (e) {
        return {
          available: false,
          remainingUnits: null,
          unit: "gpu-seconds",
          reason: e instanceof Error ? e.message : "unreachable",
        };
      }
    },

    estimateUnits(req: ShotRequest) {
      const frames = durationToFrames(req.durationSec);
      return estimateZeroGpuSeconds(frames);
    },

    async submit(req: ShotRequest, idempotencyKey: string) {
      const frames = durationToFrames(req.durationSec);
      const seed = req.seed || Math.floor(Math.random() * 1e9);
      const eventId = await gradioCall(spaceBase, req.prompt, frames, seed);
      jobs.set(idempotencyKey, {
        eventId,
        spaceBase,
        startedAt: Date.now(),
      });
      // Also index by eventId for status()
      jobs.set(eventId, {
        eventId,
        spaceBase,
        startedAt: Date.now(),
      });
      return { remoteJobId: eventId };
    },

    async status(remoteJobId: string): Promise<RemoteJobStatus> {
      const job = jobs.get(remoteJobId);
      const base = job?.spaceBase || spaceBase;
      return gradioPoll(base, remoteJobId);
    },
  };
}

/**
 * One-shot helper: generate a short silent clip and return video URL.
 * Uses ~1 quota unit; prefer for testing after Space is live.
 */
export async function generateSilentClip(opts: {
  spaceUrl: string;
  prompt: string;
  durationSec?: number;
  seed?: number;
  onProgress?: (msg: string) => void;
}): Promise<{ videoUrl: string; frames: number } | { error: string }> {
  const worker = createHfZeroGpuWorker(opts.spaceUrl);
  const frames = durationToFrames(opts.durationSec ?? 2);
  const req: ShotRequest = {
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
    const { remoteJobId } = await worker.submit(req, `clip-${Date.now()}`);
    opts.onProgress?.("Queued — generating (may take 1–2 min)…");
    const st = await worker.status(remoteJobId);
    if (st.status === "succeeded") {
      return { videoUrl: st.videoUrl, frames };
    }
    return { error: st.status === "failed" ? st.error : "unknown" };
  } catch (e) {
    if (e instanceof QuotaUnavailableError) {
      return { error: e.message };
    }
    return { error: e instanceof Error ? e.message : "failed" };
  }
}
