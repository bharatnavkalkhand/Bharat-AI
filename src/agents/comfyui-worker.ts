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

export interface ComfyWorkflowConfig {
  workflow: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
  promptNodeId: string;
  imageNodeId?: string;
}

export interface ComfyWorkerStatus {
  available: boolean;
  reason: string;
}

const COMFY_URL_STORAGE_KEY = "bharat_comfyui_url";
const COMFY_WORKFLOW_STORAGE_KEY = "bharat_comfyui_workflow";

// Built-in starter workflow (Wan 2.1 T2V 1.3B API format) so non-programmers never have to paste raw JSON
export const DEFAULT_COMFY_VIDEO_WORKFLOW: ComfyWorkflowConfig = {
  promptNodeId: "6",
  workflow: {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: 42,
        steps: 20,
        cfg: 6.0,
        sampler_name: "uni_pc",
        scheduler: "simple",
        denoise: 1.0,
        model: ["37", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["40", 0],
      },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: "Cinematic realistic scene", clip: ["38", 0] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: "blurry, distorted, watermark, text, low quality", clip: ["38", 0] },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["39", 0] },
    },
    "37": { class_type: "UNETLoader", inputs: { unet_name: "wan2.1_t2v_1.3B_fp16.safetensors", weight_dtype: "default" } },
    "38": { class_type: "CLIPLoader", inputs: { clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors", type: "wan" } },
    "39": { class_type: "VAELoader", inputs: { vae_name: "wan_2.1_vae.safetensors" } },
    "40": { class_type: "EmptyHunyuanLatentVideo", inputs: { width: 832, height: 480, length: 49, batch_size: 1 } },
    "49": { class_type: "SaveWEBM", inputs: { filename_prefix: "bharat_ai", codec: "vp9", fps: 16, crf: 28, images: ["8", 0] } },
  },
};

export function normalizeComfyUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

export function readComfyUrl(): string {
  try {
    return typeof localStorage !== "undefined"
      ? normalizeComfyUrl(localStorage.getItem(COMFY_URL_STORAGE_KEY) || "")
      : "";
  } catch {
    return "";
  }
}

export function saveComfyUrl(url: string): string {
  const normalized = normalizeComfyUrl(url);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(COMFY_URL_STORAGE_KEY, normalized);
  }
  return normalized;
}

export function loadComfyWorkflow(): ComfyWorkflowConfig {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(COMFY_WORKFLOW_STORAGE_KEY) : null;
    if (!raw) return DEFAULT_COMFY_VIDEO_WORKFLOW;
    const parsed = JSON.parse(raw) as ComfyWorkflowConfig;
    if (!parsed?.workflow || typeof parsed.workflow !== "object" || !parsed.promptNodeId) {
      return DEFAULT_COMFY_VIDEO_WORKFLOW;
    }
    return parsed;
  } catch {
    return DEFAULT_COMFY_VIDEO_WORKFLOW;
  }
}

export function saveComfyWorkflow(config: ComfyWorkflowConfig): void {
  if (!config.workflow || typeof config.workflow !== "object") {
    throw new Error("ComfyUI workflow must be a valid API-format JSON object.");
  }
  if (!config.promptNodeId || !config.workflow[config.promptNodeId]) {
    throw new Error("Prompt node ID must exist in the ComfyUI workflow.");
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(COMFY_WORKFLOW_STORAGE_KEY, JSON.stringify(config));
  }
}

export async function checkComfyWorker(): Promise<ComfyWorkerStatus> {
  const base = readComfyUrl();
  if (!base) {
    return {
      available: false,
      reason: "Enter your ComfyUI URL (for mobile APK, use an https:// tunnel like Cloudflare Quick Tunnel or Tailscale).",
    };
  }
  try {
    const res = await fetch(`${base}/system_stats`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { available: false, reason: `ComfyUI worker responded with HTTP ${res.status}.` };
    return { available: true, reason: "ComfyUI worker connected (preset workflow ready)." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    const isHttpFromApk = base.startsWith("http://") && typeof window !== "undefined" && window.location.protocol === "https:";
    return {
      available: false,
      reason: isHttpFromApk
        ? `Android WebView blocked http:// from https://localhost (${msg}). Use an https:// tunnel URL or run ComfyUI with --enable-cors-header "*"`
        : `Cannot reach ComfyUI at ${base} (${msg}). Start ComfyUI with --listen --enable-cors-header "*"`,
    };
  }
}

export async function generateComfySceneVideo(
  prompt: string,
  _sceneId: string,
  referenceImageUrl?: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const base = readComfyUrl();
  if (!base) {
    throw new Error("No ComfyUI worker URL saved. Paste your https:// ComfyUI URL first.");
  }

  const config = loadComfyWorkflow();
  const workflow = JSON.parse(JSON.stringify(config.workflow)) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;

  if (!workflow[config.promptNodeId]?.inputs) {
    throw new Error(`Prompt node "${config.promptNodeId}" was not found in the ComfyUI workflow.`);
  }
  workflow[config.promptNodeId].inputs.text = prompt;

  if (config.imageNodeId && workflow[config.imageNodeId]?.inputs && referenceImageUrl) {
    onProgress?.("Uploading character/scene reference image to ComfyUI...");
    const uploadedName = await uploadReferenceImageToComfy(base, referenceImageUrl);
    workflow[config.imageNodeId].inputs.image = uploadedName;
  }

  onProgress?.("Submitting scene to ComfyUI...");
  const queueRes = await fetch(`${base}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!queueRes.ok) {
    const errText = await queueRes.text().catch(() => "");
    throw new Error(`ComfyUI rejected workflow (${queueRes.status}): ${errText.slice(0, 160)}`);
  }

  const queued = (await queueRes.json()) as { prompt_id?: string };
  if (!queued.prompt_id) throw new Error("ComfyUI did not return a prompt_id.");

  onProgress?.("ComfyUI rendering video on GPU...");
  return await pollComfyHistory(base, queued.prompt_id);
}

async function uploadReferenceImageToComfy(base: string, imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Could not read reference image.");
  const blob = await res.blob();
  const form = new FormData();
  form.append("image", blob, "bharat_ref.png");

  const uploadRes = await fetch(`${base}/upload/image`, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error(`ComfyUI image upload failed (${uploadRes.status}).`);
  const payload = (await uploadRes.json()) as { name?: string };
  if (!payload.name) throw new Error("ComfyUI did not return an uploaded filename.");
  return payload.name;
}

async function pollComfyHistory(base: string, promptId: string): Promise<string> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${base}/history/${encodeURIComponent(promptId)}`);
    if (!res.ok) continue;
    const history = (await res.json()) as Record<string, { outputs?: Record<string, { gifs?: Array<{ filename: string; subfolder?: string; type?: string }>; videos?: Array<{ filename: string; subfolder?: string; type?: string }>; images?: Array<{ filename: string; subfolder?: string; type?: string }> }> }>;
    const outputs = history[promptId]?.outputs;
    if (!outputs) continue;

    for (const nodeOutput of Object.values(outputs)) {
      const artifact = nodeOutput.videos?.[0] || nodeOutput.gifs?.[0] || nodeOutput.images?.[0];
      if (artifact?.filename) {
        const params = new URLSearchParams({
          filename: artifact.filename,
          subfolder: artifact.subfolder || "",
          type: artifact.type || "output",
        });
        return `${base}/view?${params.toString()}`;
      }
    }
  }
  throw new Error("Timed out waiting for ComfyUI to finish rendering.");
}