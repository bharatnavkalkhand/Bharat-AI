/**
 * ComfyUI local GPU worker adapter
 *
 * Integrates free local inference (ComfyUI / StabilityMatrix-installed ComfyUI)
 * as a self-serve backend for Bharat AI — same product rule as HF Spaces:
 * one-time URL, then Produce buttons. No daily notebook cells.
 *
 * Patterns inspired by:
 * - ComfyUI (https://github.com/Comfy-Org/ComfyUI) — /prompt + /history API
 * - Pixelle-Video — image-to-video + motion pipelines behind a simple UI
 *
 * Configure:
 *   localStorage.setItem('bharat_comfyui_url', 'http://127.0.0.1:8188')
 *
 * Honest limits:
 * - Requires a machine with GPU running ComfyUI
 * - Browser must reach the URL (localhost on same device, or LAN + CORS)
 * - Workflow API shape varies. This adapter requires a real HTTP generation bridge
 *   exposing /submit and /status/:id; a plain ComfyUI UI URL is not sufficient.
 */

import {
  type GpuWorkerAdapter,
  type RemoteJobStatus,
  type ShotRequest,
  type WorkerQuota,
  QuotaUnavailableError,
} from "./gpu-worker-pool";

export interface ComfyUiWorkerOptions {
  baseUrl?: string;
  id?: string;
  /** Prefer image-to-video when reference images exist */
  mode?: "txt2vid" | "img2vid" | "auto";
}

interface JobRec {
  kind: "http" | "comfy";
  base: string;
  promptId?: string;
  startedAt: number;
}

const jobs = new Map<string, JobRec>();

function normalizeBase(url: string): string {
  return (url || "").trim().replace(/\/$/, "");
}

function defaultComfyUrl(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("bharat_comfyui_url") || "";
}

/** Create adapter for local ComfyUI or a thin HTTP bridge in front of it. */
export function createComfyUiWorker(
  options: ComfyUiWorkerOptions = {},
): GpuWorkerAdapter {
  const base = normalizeBase(options.baseUrl || defaultComfyUrl());
  const id = options.id || "comfyui-local";

  return {
    id,

    supports(req: ShotRequest): boolean {
      if (!base) return false;
      // img2vid needs a face / still; txt2vid always ok when base set
      if (options.mode === "img2vid") {
        return Boolean(req.referenceImageUrls?.length);
      }
      return true;
    },

    async quota(): Promise<WorkerQuota> {
      if (!base) {
        return {
          available: false,
          remainingUnits: 0,
          unit: "gpu-seconds",
          reason: "No ComfyUI URL (set bharat_comfyui_url)",
        };
      }
      // Prefer an explicit bridge quota response. Never infer availability
      // from a configured URL: an offline worker must be reported unavailable.
      try {
        const res = await fetch(`${base}/quota`, {
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          const data = (await res.json()) as Partial<WorkerQuota>;
          if (typeof data.available === "boolean") {
            return {
              available: data.available,
              remainingUnits:
                typeof data.remainingUnits === "number" && Number.isFinite(data.remainingUnits)
                  ? data.remainingUnits
                  : null,
              unit: typeof data.unit === "string" ? data.unit : "gpu-seconds",
              resetsAt: data.resetsAt,
              reason: data.reason || "ComfyUI bridge quota endpoint",
            };
          }
        }
      } catch {
        /* Native ComfyUI has no /quota endpoint. */
      }

      // Native ComfyUI's system_stats endpoint is a reachability check only.
      // It does not expose a trustworthy free quota, so keep remainingUnits null.
      try {
        const sys = await fetch(`${base}/system_stats`, {
          signal: AbortSignal.timeout(2500),
        });
        if (sys.ok) {
          return {
            available: true,
            remainingUnits: null,
            unit: "gpu-seconds",
            reason: "ComfyUI system_stats reachable; quota is not reported by native ComfyUI",
          };
        }
        return {
          available: false,
          remainingUnits: null,
          unit: "gpu-seconds",
          reason: `ComfyUI system_stats returned HTTP ${sys.status}`,
        };
      } catch (error) {
        return {
          available: false,
          remainingUnits: null,
          unit: "gpu-seconds",
          reason: error instanceof Error ? error.message : "ComfyUI worker unreachable",
        };
      }
    },

    estimateUnits(req: ShotRequest): number {
      const d = req.durationSec || 4;
      if (d <= 3) return 30;
      if (d <= 8) return 60;
      return 120;
    },

    async submit(
      request: ShotRequest,
      idempotencyKey: string,
    ): Promise<{ remoteJobId: string }> {
      if (!base) {
        throw new QuotaUnavailableError(
          "ComfyUI URL not set. Save http://127.0.0.1:8188 after starting ComfyUI.",
        );
      }

      // Path A — thin HTTP bridge (recommended for production)
      try {
        const res = await fetch(`${base}/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            ...request,
            mode: options.mode || "auto",
          }),
        });
        if (res.status === 429 || res.status === 503) {
          throw new QuotaUnavailableError("ComfyUI bridge busy");
        }
        if (res.ok) {
          const data = (await res.json()) as {
            remoteJobId?: string;
            jobId?: string;
          };
          const remoteJobId = data.remoteJobId || data.jobId;
          if (remoteJobId) {
            jobs.set(`${id}:${remoteJobId}`, {
              kind: "http",
              base,
              startedAt: Date.now(),
            });
            return { remoteJobId: `${id}:${remoteJobId}` };
          }
        }
      } catch (e) {
        if (e instanceof QuotaUnavailableError) throw e;
        // try native Comfy path
      }

      throw new Error(
        "The ComfyUI URL is reachable, but it does not expose Bharat AI's /submit generation bridge. Native ComfyUI /prompt needs a real exported Wan API workflow; Bharat AI will not send a fake placeholder graph. Start the Bharat AI ComfyUI bridge with a Wan text-to-video or image-to-video workflow, then retry.",
      );
    },

    async status(remoteJobId: string): Promise<RemoteJobStatus> {
      const job = jobs.get(remoteJobId);
      const baseUrl = job?.base || base;
      if (!baseUrl) {
        return { status: "failed", error: "Unknown job", retryable: false };
      }

      if (job?.kind === "http" || remoteJobId.includes(":")) {
        const rawId = remoteJobId.includes(":")
          ? remoteJobId.slice(remoteJobId.indexOf(":") + 1)
          : remoteJobId;
        try {
          const res = await fetch(
            `${baseUrl}/status/${encodeURIComponent(rawId)}`,
          );
          if (res.ok) return (await res.json()) as RemoteJobStatus;
        } catch {
          /* try comfy history */
        }
      }

      const promptId = job?.promptId || remoteJobId.split(":").pop();
      if (!promptId) {
        return { status: "failed", error: "Missing prompt id", retryable: false };
      }

      try {
        const res = await fetch(`${baseUrl}/history/${encodeURIComponent(promptId)}`);
        if (!res.ok) {
          if (Date.now() - (job?.startedAt || Date.now()) > 10 * 60 * 1000) {
            return {
              status: "failed",
              error: `history HTTP ${res.status}`,
              retryable: true,
            };
          }
          return { status: "running", progress: 0.35 };
        }
        const hist = (await res.json()) as Record<
          string,
          {
            outputs?: Record<
              string,
              { gifs?: Array<{ filename: string; subfolder?: string }>; videos?: unknown }
            >;
            status?: { completed?: boolean; status_str?: string };
          }
        >;
        const entry = hist[promptId];
        if (!entry) return { status: "running", progress: 0.4 };

        // Extract first video-like artifact
        const outputs = entry.outputs || {};
        for (const node of Object.values(outputs)) {
          const gifs = node.gifs || [];
          for (const g of gifs) {
            if (g.filename) {
              const sub = g.subfolder ? `${g.subfolder}/` : "";
              const videoUrl = `${baseUrl}/view?filename=${encodeURIComponent(
                g.filename,
              )}&subfolder=${encodeURIComponent(sub)}&type=output`;
              return { status: "succeeded", videoUrl };
            }
          }
        }

        if (entry.status?.status_str === "error") {
          return {
            status: "failed",
            error: "ComfyUI reported error",
            retryable: true,
          };
        }
        return { status: "running", progress: 0.55 };
      } catch (e) {
        if (Date.now() - (job?.startedAt || Date.now()) > 10 * 60 * 1000) {
          return {
            status: "failed",
            error: e instanceof Error ? e.message : "poll failed",
            retryable: true,
          };
        }
        return { status: "running", progress: 0.3 };
      }
    },
  };
}

/** Register ComfyUI worker when URL is configured */
export function maybeAddComfyUiWorker(
  workers: GpuWorkerAdapter[],
  baseUrl?: string,
): GpuWorkerAdapter[] {
  const url =
    baseUrl ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("bharat_comfyui_url") || ""
      : "");
  if (!url.trim()) return workers;
  return [...workers, createComfyUiWorker({ baseUrl: url, mode: "auto" })];
}

export function getComfyUiUrl(): string {
  return defaultComfyUrl();
}

export function setComfyUiUrl(url: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("bharat_comfyui_url", url.trim().replace(/\/$/, ""));
}
