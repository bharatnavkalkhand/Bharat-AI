/**
 * Rhubarb Lip Sync via lip-sync-engine (WASM + PocketSphinx).
 * Lazy-loads WASM from CDN; falls back to null cues if unavailable.
 * Visemes: X A B C D E F G H (Preston Blair / Rhubarb).
 */

export type RhubarbViseme = "X" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export interface MouthCue {
  start: number;
  end: number;
  value: RhubarbViseme;
}

/** Approximate jaw open 0–1 from Rhubarb shape */
export const VISEME_LIP_OPEN: Record<RhubarbViseme, number> = {
  X: 0.04,
  B: 0.08,
  F: 0.22,
  C: 0.28,
  D: 0.38,
  E: 0.48,
  G: 0.55,
  H: 0.72,
  A: 0.92,
};

/** Mouth width scale (relative) */
export const VISEME_WIDTH: Record<RhubarbViseme, number> = {
  X: 0.7,
  B: 0.75,
  F: 0.95,
  C: 0.85,
  D: 0.9,
  E: 1,
  G: 0.95,
  H: 1.15,
  A: 1.05,
};

let initPromise: Promise<boolean> | null = null;
let engineReady = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let engineInstance: any = null;

export async function initRhubarb(): Promise<boolean> {
  if (engineReady) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const mod = await import("lip-sync-engine");
      const LipSyncEngine = mod.LipSyncEngine ?? mod.default?.LipSyncEngine;
      if (!LipSyncEngine?.getInstance) {
        // try top-level analyze API only
        if (typeof mod.analyze === "function") {
          engineInstance = { analyze: mod.analyze, mode: "fn" };
          engineReady = true;
          return true;
        }
        return false;
      }
      const eng = LipSyncEngine.getInstance();
      await eng.init({
        wasmPath:
          "https://unpkg.com/lip-sync-engine@1.0.3/dist/wasm/lip-sync-engine.wasm",
        dataPath:
          "https://unpkg.com/lip-sync-engine@1.0.3/dist/wasm/lip-sync-engine.data",
        jsPath:
          "https://unpkg.com/lip-sync-engine@1.0.3/dist/wasm/lip-sync-engine.js",
      });
      engineInstance = eng;
      engineReady = true;
      return true;
    } catch {
      engineReady = false;
      return false;
    }
  })();

  return initPromise;
}

/** Resample AudioBuffer channel to 16 kHz mono Int16 PCM for Rhubarb */
export function audioBufferToPcm16k(buffer: AudioBuffer): Int16Array {
  const targetRate = 16000;
  const srcRate = buffer.sampleRate;
  const src = buffer.getChannelData(0);
  const outLen = Math.max(1, Math.floor((src.length * targetRate) / srcRate));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = (i * srcRate) / targetRate;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(src.length - 1, i0 + 1);
    const frac = srcIdx - i0;
    const sample = src[i0] * (1 - frac) + src[i1] * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[i] = (clamped * 32767) | 0;
  }
  return out;
}

function normalizeViseme(v: string): RhubarbViseme {
  const u = (v || "X").toUpperCase();
  if ("XABCDEFGH".includes(u) && u.length === 1) return u as RhubarbViseme;
  return "X";
}

export async function analyzeMouthCues(
  buffer: AudioBuffer,
  dialogText?: string,
): Promise<MouthCue[] | null> {
  const ok = await initRhubarb();
  if (!ok || !engineInstance) return null;

  try {
    const pcm16 = audioBufferToPcm16k(buffer);
    const opts = { dialogText: dialogText?.slice(0, 200), sampleRate: 16000 };
    let result: { mouthCues?: Array<{ start: number; end: number; value: string }> };

    if (engineInstance.mode === "fn") {
      result = await engineInstance.analyze(pcm16, opts);
    } else {
      result = await engineInstance.analyze(pcm16, opts);
    }

    const cues = result?.mouthCues;
    if (!cues?.length) return null;
    return cues.map((c) => ({
      start: c.start,
      end: c.end,
      value: normalizeViseme(c.value),
    }));
  } catch {
    return null;
  }
}

export function visemeAtTime(
  cues: MouthCue[] | null | undefined,
  t: number,
): RhubarbViseme {
  if (!cues?.length) return "X";
  for (const c of cues) {
    if (t >= c.start && t < c.end) return c.value;
  }
  // last cue hold briefly
  const last = cues[cues.length - 1];
  if (t >= last.start && t <= last.end + 0.08) return last.value;
  return "X";
}

export function lipOpenFromViseme(v: RhubarbViseme): number {
  return VISEME_LIP_OPEN[v] ?? 0.1;
}

export function widthFromViseme(v: RhubarbViseme): number {
  return VISEME_WIDTH[v] ?? 1;
}

export function isRhubarbReady(): boolean {
  return engineReady;
}
