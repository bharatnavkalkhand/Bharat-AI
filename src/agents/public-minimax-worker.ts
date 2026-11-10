import type { GpuWorkerAdapter, RemoteJobStatus, ShotRequest, WorkerQuota } from "./gpu-worker-pool";
import { QuotaUnavailableError } from "./gpu-worker-pool";

/** Public community ZeroGPU MiniMax-H3 demo. Shared capacity; not guaranteed. */
export const PUBLIC_MINIMAX_SPACE_URL = "https://minimaxai-minimax-h3-turbo-lora.hf.space";

const jobs = new Map<string, string>();

function findVideo(value: unknown, base: string): string | null {
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith("/gradio_api/file=") || value.startsWith("/file=")) return base + value;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) { const found = findVideo(item, base); if (found) return found; }
    return null;
  }
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    for (const key of ["url", "path", "video", "data", "output"]) {
      if (key in item) { const found = findVideo(item[key], base); if (found) return found; }
    }
  }
  return null;
}

function parseSse(text: string, base: string): RemoteJobStatus {
  let event = "";
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("event:")) { event = line.slice(6).trim(); continue; }
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (event === "error") {
      let detail = payload;
      try { detail = String(JSON.parse(payload) ?? ""); } catch { /* keep raw */ }
      return { status: "failed", error: detail && detail !== "null" ? detail : "MiniMax-H3 ZeroGPU returned an empty error event; no MP4 was produced.", retryable: true };
    }
    if (!payload || payload === "null") continue;
    try {
      const parsed = JSON.parse(payload) as unknown;
      const videoUrl = findVideo(parsed, base);
      if (videoUrl) return { status: "succeeded", videoUrl };
      if (event === "complete") return { status: "failed", error: "MiniMax-H3 completed without a video file URL.", retryable: true };
    } catch { /* ignore heartbeat */ }
  }
  return { status: "failed", error: "MiniMax-H3 stream ended without a completed MP4.", retryable: true };
}

export function createPublicMinimaxWorker(baseUrl = PUBLIC_MINIMAX_SPACE_URL): GpuWorkerAdapter {
  const base = baseUrl.replace(/\/$/, "");
  return {
    id: "public-minimax-h3-zerogpu",
    supports(request: ShotRequest) { return request.aspectRatio === "16:9" && request.durationSec <= 5.2; },
    async quota(): Promise<WorkerQuota> {
      try {
        const response = await fetch(base, { signal: AbortSignal.timeout(10000) });
        return { available: response.ok, remainingUnits: response.ok ? 120 : null, unit: "gpu-seconds", reason: response.ok ? "Shared public ZeroGPU Space; no live remaining quota is exposed." : `MiniMax Space HTTP ${response.status}` };
      } catch (error) {
        return { available: false, remainingUnits: null, unit: "gpu-seconds", reason: error instanceof Error ? error.message : "MiniMax Space unreachable" };
      }
    },
    estimateUnits() { return 120; },
    async submit(request: ShotRequest, idempotencyKey: string) {
      const response = await fetch(`${base}/gradio_api/call/v2/output_video`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          in_0: request.prompt,
          in_1: null,
          in_2: null,
          in_3: "960x544 · 16:9 fast",
          in_4: Math.min(5, Math.max(2, request.durationSec)),
          in_5: 4,
          in_6: Number.isFinite(request.seed) ? request.seed : 42,
          in_7: false,
          in_8: "larry",
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (response.status === 429 || response.status === 503) throw new QuotaUnavailableError("The shared MiniMax ZeroGPU queue is busy or its free quota is exhausted.");
      if (!response.ok) throw new Error(`MiniMax-H3 submit failed: HTTP ${response.status} ${(await response.text().catch(() => "")).slice(0, 160)}`);
      const result = await response.json() as { event_id?: string };
      if (!result.event_id) throw new Error("MiniMax-H3 did not return a Gradio event id.");
      jobs.set(result.event_id, base);
      return { remoteJobId: result.event_id };
    },
    async status(remoteJobId: string): Promise<RemoteJobStatus> {
      const jobBase = jobs.get(remoteJobId) || base;
      try {
        const response = await fetch(`${jobBase}/gradio_api/call/output_video/${encodeURIComponent(remoteJobId)}`, { signal: AbortSignal.timeout(210000) });
        if (response.status === 429 || response.status === 503) return { status: "failed", error: "MiniMax-H3 ZeroGPU is busy or its public quota is exhausted.", retryable: true };
        if (!response.ok) return { status: "failed", error: `MiniMax-H3 poll failed: HTTP ${response.status}`, retryable: response.status >= 500 };
        const result = parseSse(await response.text(), jobBase);
        jobs.delete(remoteJobId);
        return result;
      } catch (error) {
        return { status: "failed", error: error instanceof Error ? error.message : "MiniMax-H3 polling failed", retryable: true };
      }
    },
  };
}
