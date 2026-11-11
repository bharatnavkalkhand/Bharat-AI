/**
 * EchoMimic portrait-animation worker client.
 *
 * EchoMimic itself is a model/repository, not a hosted public API. This adapter
 * talks only to a user-deployed worker implementing the documented contract.
 * No public endpoint, GPU quota, or generation result is assumed.
 */

export interface PortraitWorkerCapabilities {
  models?: string[];
  maxDurationSec?: number;
  supportsAudioDriven?: boolean;
  device?: string;
}

export interface PortraitWorkerHealth {
  available: boolean;
  reason: string;
  capabilities?: PortraitWorkerCapabilities;
}

export type PortraitJob =
  | { status: "queued" | "running"; jobId: string; progress?: number }
  | { status: "succeeded"; jobId: string; videoUrl: string; durationSec?: number }
  | { status: "failed"; jobId: string; error: string; retryable?: boolean };

export class EchoMimicWorker {
  private readonly base: string;

  constructor(baseUrl: string) {
    this.base = baseUrl.trim().replace(/\/$/, "");
  }

  async health(): Promise<PortraitWorkerHealth> {
    if (!this.base) return { available: false, reason: "EchoMimic worker URL is not configured." };
    try {
      const response = await fetch(`${this.base}/health`, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) return { available: false, reason: `Worker health returned HTTP ${response.status}.` };
      const data = (await response.json().catch(() => ({}))) as { status?: string; capabilities?: PortraitWorkerCapabilities };
      return {
        available: data.status === "ok" || data.status === "ready",
        reason: data.status === "ok" || data.status === "ready" ? "EchoMimic worker is ready." : "Worker responded but is not ready.",
        capabilities: data.capabilities,
      };
    } catch (error) {
      return { available: false, reason: error instanceof Error ? error.message : "EchoMimic worker is unreachable." };
    }
  }

  async submit(input: {
    imageUrl: string;
    audioUrl: string;
    prompt?: string;
    consentConfirmed: boolean;
  }): Promise<PortraitJob> {
    if (!input.consentConfirmed) return { status: "failed", jobId: "", error: "Confirm that you have permission to animate the person in this portrait." };
    if (!input.imageUrl || !input.audioUrl) return { status: "failed", jobId: "", error: "A portrait image URL and audio URL are required." };
    const health = await this.health();
    if (!health.available) return { status: "failed", jobId: "", error: health.reason, retryable: true };
    try {
      const response = await fetch(`${this.base}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "echomimic",
          image_url: input.imageUrl,
          audio_url: input.audioUrl,
          prompt: input.prompt || "",
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = (await response.json().catch(() => ({}))) as { job_id?: string; error?: string };
      if (!response.ok || !data.job_id) {
        return { status: "failed", jobId: "", error: data.error || `Worker rejected job (HTTP ${response.status}).`, retryable: response.status >= 500 };
      }
      return { status: "queued", jobId: data.job_id, progress: 0 };
    } catch (error) {
      return { status: "failed", jobId: "", error: error instanceof Error ? error.message : "EchoMimic submit failed.", retryable: true };
    }
  }

  async status(jobId: string): Promise<PortraitJob> {
    if (!jobId) return { status: "failed", jobId, error: "Missing portrait job ID." };
    try {
      const response = await fetch(`${this.base}/jobs/${encodeURIComponent(jobId)}`, { signal: AbortSignal.timeout(10000) });
      const data = (await response.json().catch(() => ({}))) as {
        status?: string; progress?: number; video_url?: string; duration_sec?: number; error?: string;
      };
      if (!response.ok) return { status: "failed", jobId, error: data.error || `Status returned HTTP ${response.status}.`, retryable: response.status >= 500 };
      if (data.status === "succeeded" && data.video_url) return { status: "succeeded", jobId, videoUrl: data.video_url, durationSec: data.duration_sec };
      if (data.status === "failed") return { status: "failed", jobId, error: data.error || "Portrait animation failed.", retryable: true };
      return { status: data.status === "queued" ? "queued" : "running", jobId, progress: data.progress };
    } catch (error) {
      return { status: "failed", jobId, error: error instanceof Error ? error.message : "EchoMimic status check failed.", retryable: true };
    }
  }
}
