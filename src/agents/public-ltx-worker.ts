import type {
  GpuWorkerAdapter,
  RemoteJobStatus,
  ShotRequest,
  WorkerQuota,
} from "./gpu-worker-pool";
import { QuotaUnavailableError } from "./gpu-worker-pool";

/**
 * Public community LTX Video ZeroGPU Space.
 * This is an unauthenticated shared demo: it can be busy, paused, or rate-limited.
 * It is a real diffusion video generator, not a storyboard/attachment endpoint.
 */
export const PUBLIC_LTX_SPACE_URL =
  "https://deeprat-ltx-video-zerogpu-optimized.hf.space";

const jobs = new Map<string, { baseUrl: string; startedAt: number }>();

function extractVideoUrl(value: unknown, baseUrl: string): string | null {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/gradio_api/file=") || value.startsWith("/file=")) {
      return `${baseUrl}${value}`;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractVideoUrl(item, baseUrl);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.url === "string") {
      const found = extractVideoUrl(record.url, baseUrl);
      if (found) return found;
    }
    if (typeof record.path === "string") {
      const found = extractVideoUrl(record.path, baseUrl);
      if (found) return found;
    }
    for (const key of ["video", "data", "output"]) {
      if (key in record) {
        const found = extractVideoUrl(record[key], baseUrl);
        if (found) return found;
      }
    }
  }
  return null;
}

function parseSse(text: string, baseUrl: string): RemoteJobStatus {
  let eventName = "";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "null") continue;
    if (eventName === "error") {
      return {
        status: "failed",
        error: payload.replace(/^"|"$/g, ""),
        retryable: true,
      };
    }
    try {
      const parsed = JSON.parse(payload) as unknown;
      const videoUrl = extractVideoUrl(parsed, baseUrl);
      if (videoUrl) return { status: "succeeded", videoUrl };
      if (parsed && typeof parsed === "object" && "error" in parsed) {
        return {
          status: "failed",
          error: String((parsed as { error?: unknown }).error || "Generation failed"),
          retryable: true,
        };
      }
    } catch {
      // Ignore queue heartbeat / progress payloads.
    }
  }
  return {
    status: "failed",
    error: "The public LTX Space finished without returning a playable video URL.",
    retryable: true,
  };
}

export function createPublicLtxWorker(
  baseUrl = PUBLIC_LTX_SPACE_URL,
): GpuWorkerAdapter {
  const base = baseUrl.replace(/\/$/, "");
  return {
    id: "public-ltx-zerogpu",
    supports(request: ShotRequest) {
      return request.aspectRatio === "16:9" && request.durationSec <= 4;
    },
    async quota(): Promise<WorkerQuota> {
      try {
        const response = await fetch(base, { signal: AbortSignal.timeout(8000) });
        return {
          available: response.ok,
          // HF documents a 2-minute daily anonymous ZeroGPU allowance. This is
          // a published ceiling, not a live remaining-quota reading.
          remainingUnits: response.ok ? 120 : null,
          unit: "gpu-seconds",
          reason: response.ok
            ? "Shared public ZeroGPU demo; 120 seconds is the documented anonymous daily allowance, not a live balance."
            : `Public LTX Space returned HTTP ${response.status}`,
        };
      } catch (error) {
        return {
          available: false,
          remainingUnits: null,
          unit: "gpu-seconds",
          reason: error instanceof Error ? error.message : "Public LTX Space unreachable",
        };
      }
    },
    estimateUnits() {
      // The Space dynamically reserves 30–120 GPU seconds for each request.
      // Keep this estimate conservative and never promise remaining quota.
      return 90;
    },
    async submit(request: ShotRequest, idempotencyKey: string) {
      const seed = Number.isFinite(request.seed) ? request.seed : 42;
      const response = await fetch(`${base}/gradio_api/call/text_to_video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        // DeepRat/LTX-Video-ZeroGPU-Optimized text_to_video API inputs:
        // prompt, negative, image, video, height, width, mode, duration,
        // frames-to-use, seed, randomize, guidance, multi-scale, slow-motion.
        body: JSON.stringify({
          data: [
            request.prompt,
            "low quality, blurry, distorted anatomy, flicker, jitter, text, watermark",
            null,
            null,
            480,
            832,
            "text-to-video",
            Math.min(4, Math.max(2, request.durationSec)),
            9,
            seed,
            false,
            3,
            false,
            false,
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 429 || response.status === 503) {
        throw new QuotaUnavailableError(
          "The shared public ZeroGPU queue is busy or its free quota is exhausted. Try later.",
        );
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Public LTX generation submit failed (${response.status}): ${detail.slice(0, 180)}`,
        );
      }
      const result = (await response.json()) as { event_id?: string };
      if (!result.event_id) throw new Error("Public LTX Space did not return a Gradio job id.");
      jobs.set(result.event_id, { baseUrl: base, startedAt: Date.now() });
      return { remoteJobId: result.event_id };
    },
    async status(remoteJobId: string): Promise<RemoteJobStatus> {
      const job = jobs.get(remoteJobId);
      const jobBase = job?.baseUrl || base;
      try {
        const response = await fetch(
          `${jobBase}/gradio_api/call/text_to_video/${encodeURIComponent(remoteJobId)}`,
          { signal: AbortSignal.timeout(180000) },
        );
        if (response.status === 429 || response.status === 503) {
          return {
            status: "failed",
            error: "The shared public ZeroGPU queue is busy or its free quota is exhausted.",
            retryable: true,
          };
        }
        if (!response.ok) {
          return {
            status: "failed",
            error: `Public LTX status request failed: HTTP ${response.status}`,
            retryable: response.status >= 500,
          };
        }
        const result = parseSse(await response.text(), jobBase);
        if (result.status === "succeeded" || result.status === "failed") {
          jobs.delete(remoteJobId);
        }
        return result;
      } catch (error) {
        return {
          status: "failed",
          error: error instanceof Error ? error.message : "Public LTX polling failed",
          retryable: true,
        };
      }
    },
  };
}
