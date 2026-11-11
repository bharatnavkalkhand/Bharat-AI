import type {
  GpuWorkerAdapter,
  RemoteJobStatus,
  ShotRequest,
  WorkerQuota,
} from "./gpu-worker-pool";
import { QuotaUnavailableError } from "./gpu-worker-pool";

/**
 * Public community LTX Video ZeroGPU Space.
 *
 * Real diffusion video (not storyboard). Shared free ZeroGPU:
 * - Anonymous IP quota is tiny and often already exhausted.
 * - Free HF account token (read) unlocks more daily ZeroGPU runs.
 *
 * Token (optional, stays in browser only):
 *   localStorage.setItem('bharat_hf_token', 'hf_...')
 * Create at https://huggingface.co/settings/tokens (read access is enough).
 */
export const PUBLIC_LTX_SPACE_URL =
  "https://deeprat-ltx-video-zerogpu-optimized.hf.space";

/** Gradio fn_index for text_to_video on this Space (from /config). */
const TEXT_TO_VIDEO_FN_INDEX = 6;

interface JobRec {
  baseUrl: string;
  sessionHash: string;
  startedAt: number;
  eventId: string;
}

const jobs = new Map<string, JobRec>();

export function getBharatHfToken(): string {
  if (typeof localStorage === "undefined") return "";
  return (localStorage.getItem("bharat_hf_token") || "").trim();
}

export function setBharatHfToken(token: string): void {
  if (typeof localStorage === "undefined") return;
  const t = token.trim();
  if (t) localStorage.setItem("bharat_hf_token", t);
  else localStorage.removeItem("bharat_hf_token");
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extra || {}),
  };
  const token = getBharatHfToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function isQuotaMessage(text: string): boolean {
  return /zero\s*gpu|quota|exceeded|rate.?limit|authenticate|token/i.test(text);
}

function extractVideoUrl(value: unknown, baseUrl: string): string | null {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/gradio_api/file=") || value.startsWith("/file=")) {
      return `${baseUrl}${value}`;
    }
    if (value.startsWith("/") && /\.(mp4|webm|gif)/i.test(value)) {
      return `${baseUrl}/gradio_api/file=${value}`;
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
    for (const key of ["url", "path", "video", "data", "output", "value"]) {
      if (key in record) {
        const found = extractVideoUrl(record[key], baseUrl);
        if (found) return found;
      }
    }
  }
  return null;
}

function buildPayload(request: ShotRequest): unknown[] {
  const seed = Number.isFinite(request.seed) ? request.seed : 42;
  const duration = Math.min(3, Math.max(2, Math.round(request.durationSec) || 2));
  return [
    request.prompt,
    "worst quality, inconsistent motion, blurry, jittery, distorted, text, watermark",
    null,
    null,
    512,
    704,
    "text-to-video",
    duration,
    9,
    seed,
    false,
    3,
    false,
    false,
  ];
}

/** Parse Gradio queue/data SSE lines into a terminal or running status. */
function parseQueueSse(text: string, baseUrl: string): RemoteJobStatus {
  let last: RemoteJobStatus = { status: "running", progress: 0.2 };
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "null") continue;
    try {
      const msg = JSON.parse(payload) as {
        msg?: string;
        output?: { error?: string; data?: unknown };
        success?: boolean;
        rank_eta?: number;
      };
      if (msg.msg === "estimation" || msg.msg === "process_starts") {
        last = { status: "running", progress: 0.35 };
        continue;
      }
      if (msg.msg === "process_completed") {
        const err = msg.output?.error;
        if (err || msg.success === false) {
          const message = String(err || "Generation failed");
          return {
            status: "failed",
            error: isQuotaMessage(message)
              ? `${message} — free HF token lagao: https://huggingface.co/settings/tokens (localStorage bharat_hf_token)`
              : message,
            retryable: true,
          };
        }
        const videoUrl = extractVideoUrl(msg.output?.data ?? msg.output, baseUrl);
        if (videoUrl) return { status: "succeeded", videoUrl };
        return {
          status: "failed",
          error: "LTX finished without a video URL",
          retryable: true,
        };
      }
    } catch {
      // heartbeat
    }
  }
  return last;
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
        const response = await fetch(base, {
          headers: authHeaders(),
          signal: AbortSignal.timeout(8000),
        });
        const hasToken = Boolean(getBharatHfToken());
        return {
          available: response.ok,
          remainingUnits: response.ok ? (hasToken ? 300 : 60) : null,
          unit: "gpu-seconds",
          reason: response.ok
            ? hasToken
              ? "Public LTX ZeroGPU with HF token (shared; still rate-limited)."
              : "Public LTX ZeroGPU anonymous — quota often exhausted. Add free HF token for more runs."
            : `Public LTX Space HTTP ${response.status}`,
        };
      } catch (error) {
        return {
          available: false,
          remainingUnits: null,
          unit: "gpu-seconds",
          reason:
            error instanceof Error ? error.message : "Public LTX Space unreachable",
        };
      }
    },

    estimateUnits() {
      return 90;
    },

    async submit(request: ShotRequest, idempotencyKey: string) {
      const sessionHash = `bharat-${idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24) || Date.now()}`;

      // Prefer queue/join — returns real process errors (quota) on stream.
      const joinRes = await fetch(`${base}/gradio_api/queue/join`, {
        method: "POST",
        headers: authHeaders({ "Idempotency-Key": idempotencyKey }),
        body: JSON.stringify({
          data: buildPayload(request),
          fn_index: TEXT_TO_VIDEO_FN_INDEX,
          session_hash: sessionHash,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (joinRes.status === 429 || joinRes.status === 503) {
        throw new QuotaUnavailableError(
          "ZeroGPU busy/quota. Free HF token: https://huggingface.co/settings/tokens → save as bharat_hf_token",
        );
      }
      if (!joinRes.ok) {
        // Fallback to call/text_to_video
        const callRes = await fetch(`${base}/gradio_api/call/text_to_video`, {
          method: "POST",
          headers: authHeaders({ "Idempotency-Key": idempotencyKey }),
          body: JSON.stringify({ data: buildPayload(request) }),
          signal: AbortSignal.timeout(20000),
        });
        if (!callRes.ok) {
          const detail = await callRes.text().catch(() => "");
          if (isQuotaMessage(detail) || callRes.status === 429) {
            throw new QuotaUnavailableError(
              detail.slice(0, 200) ||
                "ZeroGPU quota exceeded — add free HF token (bharat_hf_token)",
            );
          }
          throw new Error(
            `LTX submit failed (${callRes.status}): ${detail.slice(0, 160)}`,
          );
        }
        const callJson = (await callRes.json()) as { event_id?: string };
        if (!callJson.event_id) throw new Error("LTX missing event_id");
        jobs.set(callJson.event_id, {
          baseUrl: base,
          sessionHash,
          startedAt: Date.now(),
          eventId: callJson.event_id,
        });
        return { remoteJobId: callJson.event_id };
      }

      const joinJson = (await joinRes.json()) as { event_id?: string };
      if (!joinJson.event_id) throw new Error("LTX queue join missing event_id");
      jobs.set(joinJson.event_id, {
        baseUrl: base,
        sessionHash,
        startedAt: Date.now(),
        eventId: joinJson.event_id,
      });
      return { remoteJobId: joinJson.event_id };
    },

    async status(remoteJobId: string): Promise<RemoteJobStatus> {
      const job = jobs.get(remoteJobId);
      const jobBase = job?.baseUrl || base;
      const sessionHash = job?.sessionHash;

      try {
        // Queue data stream (works with queue/join)
        if (sessionHash) {
          const qRes = await fetch(
            `${jobBase}/gradio_api/queue/data?session_hash=${encodeURIComponent(sessionHash)}`,
            {
              headers: authHeaders(),
              signal: AbortSignal.timeout(120000),
            },
          );
          if (qRes.ok) {
            const text = await qRes.text();
            const parsed = parseQueueSse(text, jobBase);
            if (parsed.status === "succeeded" || parsed.status === "failed") {
              jobs.delete(remoteJobId);
            }
            if (parsed.status !== "running") return parsed;
            // If stream ended early while still running, fall through
          }
        }

        // Fallback: call/event poll
        const response = await fetch(
          `${jobBase}/gradio_api/call/text_to_video/${encodeURIComponent(remoteJobId)}`,
          {
            headers: authHeaders(),
            signal: AbortSignal.timeout(180000),
          },
        );
        if (response.status === 429 || response.status === 503) {
          return {
            status: "failed",
            error:
              "ZeroGPU quota/busy. Add free HF token: https://huggingface.co/settings/tokens",
            retryable: true,
          };
        }
        if (!response.ok) {
          return {
            status: "failed",
            error: `LTX status HTTP ${response.status}`,
            retryable: response.status >= 500,
          };
        }
        const text = await response.text();
        if (/exceeded your ZeroGPU|quota/i.test(text)) {
          jobs.delete(remoteJobId);
          return {
            status: "failed",
            error:
              "ZeroGPU runs limit exceeded. Authenticate: https://huggingface.co/settings/tokens → Produce me HF token save karo",
            retryable: true,
          };
        }
        const videoUrl = extractVideoUrl(text, jobBase);
        // Also try SSE parse
        let eventName = "";
        for (const raw of text.split("\n")) {
          if (raw.startsWith("event:")) eventName = raw.slice(6).trim();
          if (raw.startsWith("data:")) {
            const payload = raw.slice(5).trim();
            if (eventName === "error") {
              jobs.delete(remoteJobId);
              return {
                status: "failed",
                error: payload.replace(/^"|"$/g, "") || "LTX error",
                retryable: true,
              };
            }
            try {
              const parsed = JSON.parse(payload) as unknown;
              const url = extractVideoUrl(parsed, jobBase);
              if (url) {
                jobs.delete(remoteJobId);
                return { status: "succeeded", videoUrl: url };
              }
            } catch {
              /* progress */
            }
          }
        }
        if (videoUrl) {
          jobs.delete(remoteJobId);
          return { status: "succeeded", videoUrl };
        }
        if (Date.now() - (job?.startedAt || Date.now()) > 8 * 60 * 1000) {
          jobs.delete(remoteJobId);
          return {
            status: "failed",
            error: "LTX timeout",
            retryable: true,
          };
        }
        return { status: "running", progress: 0.5 };
      } catch (error) {
        return {
          status: "failed",
          error: error instanceof Error ? error.message : "LTX poll failed",
          retryable: true,
        };
      }
    },
  };
}
