/** Phase 4: stylized motion without GPU — Ken Burns + mood dynamics */

export type MotionIntensity = "low" | "medium" | "high";

export interface MotionState {
  /** scale multiplier */
  zoom: number;
  /** horizontal pan px */
  panX: number;
  /** vertical pan px */
  panY: number;
  /** rotation degrees (small) */
  rot: number;
}

const INTENSITY = {
  low: 0.6,
  medium: 1,
  high: 1.45,
} as const;

/**
 * Compute motion for a frame at time t (seconds) for a given mood.
 */
export function motionAt(
  mood: string,
  t: number,
  intensity: MotionIntensity = "medium",
): MotionState {
  const k = INTENSITY[intensity] ?? 1;
  const m = (mood || "dialogue").toLowerCase();

  if (m === "fight" || m === "action") {
    return {
      zoom: 1 + 0.08 * k + 0.04 * k * Math.sin(t * 9),
      panX: 10 * k * Math.sin(t * 7),
      panY: 6 * k * Math.cos(t * 5.5),
      rot: 0.6 * k * Math.sin(t * 11),
    };
  }
  if (m === "romance" || m === "emotional") {
    return {
      zoom: 1 + 0.03 * k * t * 0.15 + 0.02 * k * Math.sin(t * 0.8),
      panX: 8 * k * Math.sin(t * 0.35),
      panY: -4 * k * Math.sin(t * 0.25),
      rot: 0,
    };
  }
  if (m === "gesture" || m === "dramatic") {
    return {
      zoom: 1 + 0.06 * k * Math.min(1, t / 3),
      panX: 6 * k * Math.sin(t * 1.2),
      panY: 3 * k * Math.cos(t * 0.9),
      rot: 0.2 * k * Math.sin(t * 2),
    };
  }
  // dialogue / default — slow push-in
  return {
    zoom: 1 + 0.045 * k * Math.min(1, t / 4),
    panX: 3 * k * Math.sin(t * 0.5),
    panY: 2 * k * Math.cos(t * 0.4),
    rot: 0,
  };
}

/** Optional remote motion/video worker contract (ComfyUI-style) */
export interface MotionWorkerJob {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  resultUrl?: string;
  message?: string;
}

export async function requestMotionWorker(
  workerUrl: string,
  payload: {
    movieId: string;
    sceneId: string;
    prompt: string;
    imageDataUrl?: string;
    durationSec?: number;
  },
): Promise<MotionWorkerJob | null> {
  const base = workerUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return (await res.json()) as MotionWorkerJob;
  } catch {
    return null;
  }
}

export async function pollMotionWorker(
  workerUrl: string,
  jobId: string,
): Promise<MotionWorkerJob | null> {
  const base = workerUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/status/${encodeURIComponent(jobId)}`);
    if (!res.ok) return null;
    return (await res.json()) as MotionWorkerJob;
  } catch {
    return null;
  }
}
