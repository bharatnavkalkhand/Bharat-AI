/** Stylized motion without GPU — Ken Burns + mood dynamics (visible movement) */

export type MotionIntensity = "low" | "medium" | "high";

export interface MotionState {
  zoom: number;
  panX: number;
  panY: number;
  rot: number;
  /** vertical bob for character presence */
  bobY: number;
  /** horizontal sway */
  swayX: number;
}

const INTENSITY = {
  low: 0.75,
  medium: 1.15,
  high: 1.7,
} as const;

/**
 * Motion at time t — always some movement so frames never feel static.
 */
export function motionAt(
  mood: string,
  t: number,
  intensity: MotionIntensity = "high",
): MotionState {
  const k = INTENSITY[intensity] ?? 1.15;
  const m = (mood || "dialogue").toLowerCase();

  // Base life — never zero
  const breath = 0.015 * k * Math.sin(t * 2.2);
  const sway = 4 * k * Math.sin(t * 1.1);
  const bob = 3 * k * Math.sin(t * 2.8);

  if (m === "fight" || m === "action") {
    return {
      zoom: 1 + 0.12 * k + 0.06 * k * Math.sin(t * 10) + breath,
      panX: 18 * k * Math.sin(t * 8) + sway,
      panY: 10 * k * Math.cos(t * 6) + bob,
      rot: 1.2 * k * Math.sin(t * 12),
      bobY: 6 * k * Math.sin(t * 9),
      swayX: 8 * k * Math.sin(t * 7),
    };
  }
  if (m === "romance" || m === "emotional") {
    return {
      zoom: 1 + 0.05 * k + 0.03 * k * Math.sin(t * 0.9) + breath,
      panX: 12 * k * Math.sin(t * 0.45) + sway * 0.5,
      panY: -6 * k * Math.sin(t * 0.35) + bob * 0.6,
      rot: 0.25 * k * Math.sin(t * 0.7),
      bobY: 2.5 * k * Math.sin(t * 1.6),
      swayX: 3 * k * Math.sin(t * 1.2),
    };
  }
  if (m === "gesture" || m === "dramatic") {
    return {
      zoom: 1 + 0.08 * k * Math.min(1.2, t / 2.5) + breath,
      panX: 10 * k * Math.sin(t * 1.4) + sway,
      panY: 5 * k * Math.cos(t * 1.1) + bob,
      rot: 0.45 * k * Math.sin(t * 2.2),
      bobY: 4 * k * Math.sin(t * 2.4),
      swayX: 5 * k * Math.sin(t * 1.8),
    };
  }
  // dialogue / default — slow push + living sway
  return {
    zoom: 1 + 0.06 * k * Math.min(1.1, t / 3.5) + breath,
    panX: 7 * k * Math.sin(t * 0.65) + sway * 0.7,
    panY: 4 * k * Math.cos(t * 0.55) + bob * 0.7,
    rot: 0.15 * k * Math.sin(t * 1.1),
    bobY: 2.2 * k * Math.sin(t * 2.1),
    swayX: 3.5 * k * Math.sin(t * 1.3),
  };
}

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
