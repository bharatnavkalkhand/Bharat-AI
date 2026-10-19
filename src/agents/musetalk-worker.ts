/**
 * MuseTalk / LivePortrait style lip-sync worker adapter
 *
 * Free path: Hugging Face ZeroGPU Gradio Spaces that accept
 *   - source image (portrait)
 *   - audio (wav/mp3)
 * and return a talking-head video.
 *
 * Public patterns only — no reverse engineering of proprietary apps.
 * Compatible with gpu-worker-pool.ts (GpuWorkerAdapter).
 *
 * Configure space URL via:
 *   - localStorage key `bharat_musetalk_space`
 *   - or env-style override when constructing the adapter
 *
 * Example public Spaces (community, quota-limited):
 *   - MuseTalk Gradio demos on HF
 *   - LivePortrait Gradio demos on HF
 *
 * Client flow:
 *   1. Take default face / uploaded portrait
 *   2. Take scene TTS audio (or imported audio)
 *   3. submit({ prompt, referenceImageUrls: [face], audioPrompt/audioUrl })
 *   4. Poll status → videoUrl → import as externalVideoLocal on scene
 */

import {
  type GpuWorkerAdapter,
  type RemoteJobStatus,
  type ShotRequest,
  type WorkerQuota,
  QuotaUnavailableError,
} from "./gpu-worker-pool";

export interface MuseTalkWorkerOptions {
  /** Gradio Space base URL or huggingface.co/spaces/... link */
  spaceUrl?: string;
  /** Adapter id for ranking / logging */
  id?: string;
  /** Prefer LivePortrait-style (full face) vs MuseTalk (mouth inpaint) */
  mode?: "musetalk" | "liveportrait" | "auto";
}

interface GradioJob {
  eventId: string;
  spaceBase: string;
  startedAt: number;
}

const jobs = new Map<string, GradioJob>();

const DEFAULT_SPACE =
  typeof localStorage !== "undefined"
    ? localStorage.getItem("bharat_musetalk_space") || ""
    : "";

function normalizeSpaceUrl(url: string): string {
  const trimmed = (url || "").trim().replace(/\/$/, "");
  if (!trimmed) return "";
  const match = trimmed.match(
    /huggingface\.co\/spaces\/([^/]+)\/([^/?#]+)/i,
  );
  if (match) {
    const user = match[1]!.toLowerCase().replace(/_/g, "-");
    const name = match[2]!.toLowerCase().replace(/_/g, "-");
    return `https://${user}-${name}.hf.space`;
  }
  return trimmed;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

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
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const k of ["url", "path", "video", "name", "data"]) {
      if (k in o) {
        const found = extractVideoUrl(o[k], spaceBase);
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * Create a MuseTalk / LivePortrait worker adapter.
 * Returns null-ish behaviour (unavailable) when no space URL is configured.
 */
export function createMuseTalkWorker(
  options: MuseTalkWorkerOptions = {},
): GpuWorkerAdapter {
  const spaceBase = normalizeSpaceUrl(options.spaceUrl || DEFAULT_SPACE);
  const id = options.id || "musetalk-zerogpu";

  return {
    id,

    supports(request: ShotRequest): boolean {
      return Boolean(
        spaceBase &&
          request.referenceImageUrls &&
          request.referenceImageUrls.length > 0,
      );
    },

    async quota(): Promise<WorkerQuota> {
      if (!spaceBase) {
        return {
          available: false,
          remainingUnits: 0,
          unit: "gpu-seconds",
          reason: "No MuseTalk/LivePortrait Space URL configured (set bharat_musetalk_space)",
        };
      }
      return {
        available: true,
        remainingUnits: 120,
        unit: "gpu-seconds",
      };
    },

    estimateUnits(request: ShotRequest): number {
      const d = request.durationSec || 4;
      if (d <= 3) return 40;
      if (d <= 6) return 70;
      return 110;
    },

    async submit(
      request: ShotRequest,
      idempotencyKey: string,
    ): Promise<{ remoteJobId: string }> {
      if (!spaceBase) {
        throw new QuotaUnavailableError(
          "MuseTalk Space URL not configured. Set localStorage bharat_musetalk_space",
        );
      }

      const faceUrl = request.referenceImageUrls?.[0];
      if (!faceUrl) {
        throw new Error("MuseTalk worker requires referenceImageUrls[0] (face portrait)");
      }

      const audioHint = request.audioPrompt || request.prompt || "";
      const payload = {
        data: [
          faceUrl,
          audioHint,
          request.durationSec || 4,
        ],
      };

      const callUrl = `${spaceBase}/gradio_api/call/generate`;
      let res: Response;
      try {
        res = await fetch(callUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        throw new QuotaUnavailableError(
          `MuseTalk Space unreachable: ${(err as Error).message}`,
        );
      }

      if (res.status === 429 || res.status === 503) {
        throw new QuotaUnavailableError("MuseTalk Space quota / overloaded");
      }
      if (!res.ok) {
        const alt = await fetch(`${spaceBase}/gradio_api/call/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => null);
        if (!alt || !alt.ok) {
          throw new Error(
            `MuseTalk submit failed (${res.status}). Check Space API endpoint names.`,
          );
        }
        res = alt;
      }

      const json = (await res.json()) as { event_id?: string };
      const eventId = json.event_id;
      if (!eventId) {
        throw new Error("MuseTalk Space did not return event_id");
      }

      const remoteJobId = `${id}:${eventId}`;
      jobs.set(remoteJobId, {
        eventId,
        spaceBase,
        startedAt: Date.now(),
      });
      return { remoteJobId };
    },

    async status(remoteJobId: string): Promise<RemoteJobStatus> {
      const job = jobs.get(remoteJobId);
      if (!job) {
        return { status: "failed", error: "Unknown job id", retryable: false };
      }

      const url = `${job.spaceBase}/gradio_api/call/generate/${job.eventId}`;
      try {
        const res = await fetch(url);
        if (res.status === 429 || res.status === 503) {
          return {
            status: "failed",
            error: "Quota / overload while polling",
            retryable: true,
          };
        }
        if (!res.ok) {
          const alt = await fetch(
            `${job.spaceBase}/gradio_api/call/predict/${job.eventId}`,
          );
          if (!alt.ok) {
            if (Date.now() - job.startedAt > 8 * 60 * 1000) {
              return {
                status: "failed",
                error: `Poll failed (${res.status})`,
                retryable: true,
              };
            }
            return { status: "running", progress: 0.3 };
          }
          const text = await alt.text();
          return parseGradioEvent(text, job.spaceBase);
        }
        const text = await res.text();
        return parseGradioEvent(text, job.spaceBase);
      } catch (err) {
        if (Date.now() - job.startedAt > 8 * 60 * 1000) {
          return {
            status: "failed",
            error: (err as Error).message,
            retryable: true,
          };
        }
        return { status: "running", progress: 0.2 };
      }
    },
  };
}

function parseGradioEvent(text: string, spaceBase: string): RemoteJobStatus {
  const lines = text.split("\n");
  let dataLine = "";
  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLine = line.slice(5).trim();
    }
  }
  if (!dataLine) {
    return { status: "running", progress: 0.45 };
  }
  try {
    const data = JSON.parse(dataLine) as unknown;
    const videoUrl = extractVideoUrl(data, spaceBase);
    if (videoUrl) {
      return { status: "succeeded", videoUrl };
    }
    if (Array.isArray(data) && data.length) {
      const v = extractVideoUrl(data, spaceBase);
      if (v) return { status: "succeeded", videoUrl: v };
    }
    return { status: "running", progress: 0.6 };
  } catch {
    return { status: "running", progress: 0.5 };
  }
}

/** Helper: register MuseTalk worker into a pool list if space is configured */
export function maybeAddMuseTalkWorker(
  workers: GpuWorkerAdapter[],
  spaceUrl?: string,
): GpuWorkerAdapter[] {
  const url =
    spaceUrl ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("bharat_musetalk_space") || ""
      : "");
  if (!url.trim()) return workers;
  return [...workers, createMuseTalkWorker({ spaceUrl: url })];
}
