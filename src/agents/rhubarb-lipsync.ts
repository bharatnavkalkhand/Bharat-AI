/**
 * Rhubarb Lip Sync (lip-sync-engine WASM) + accuracy layer:
 * - peak-normalized 16 kHz PCM
 * - dialogText for PocketSphinx
 * - cue smoothing / micro-gap fill
 * - RMS energy blend for natural jaw motion
 * - text-timed fallback when WASM fails (esp. Hindi)
 */

export type RhubarbViseme = "X" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export interface MouthCue {
  start: number;
  end: number;
  value: RhubarbViseme;
}

export interface SmoothLipState {
  viseme: RhubarbViseme;
  lipOpen: number;
  lipWidth: number;
}

/** Approximate jaw open 0–1 from Rhubarb shape */
export const VISEME_LIP_OPEN: Record<RhubarbViseme, number> = {
  X: 0.03,
  B: 0.06,
  F: 0.2,
  C: 0.3,
  D: 0.4,
  E: 0.5,
  G: 0.58,
  H: 0.78,
  A: 0.95,
};

export const VISEME_WIDTH: Record<RhubarbViseme, number> = {
  X: 0.72,
  B: 0.7,
  F: 0.98,
  C: 0.82,
  D: 0.9,
  E: 1,
  G: 0.95,
  H: 1.18,
  A: 1.08,
};

// Vowel-ish open shapes cycle for text-guided fallback
const OPEN_CYCLE: RhubarbViseme[] = ["E", "A", "H", "D", "G", "C"];
const CLOSED: RhubarbViseme = "B";

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

/** Peak-normalize + light high-pass feel, resample to 16 kHz mono Int16 */
export function audioBufferToPcm16k(buffer: AudioBuffer): Int16Array {
  const targetRate = 16000;
  const srcRate = buffer.sampleRate;
  const ch0 = buffer.getChannelData(0);
  // Mix to mono if stereo
  let src: Float32Array;
  if (buffer.numberOfChannels > 1) {
    const ch1 = buffer.getChannelData(1);
    src = new Float32Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) src[i] = (ch0[i] + ch1[i]) * 0.5;
  } else {
    src = ch0;
  }

  // Peak normalize to ~0.92
  let peak = 0.0001;
  for (let i = 0; i < src.length; i++) {
    const a = Math.abs(src[i]);
    if (a > peak) peak = a;
  }
  const gain = 0.92 / peak;

  const outLen = Math.max(1, Math.floor((src.length * targetRate) / srcRate));
  const out = new Int16Array(outLen);
  let prev = 0;
  for (let i = 0; i < outLen; i++) {
    const srcIdx = (i * srcRate) / targetRate;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(src.length - 1, i0 + 1);
    const frac = srcIdx - i0;
    let sample = (src[i0] * (1 - frac) + src[i1] * frac) * gain;
    // Simple DC / very-low-frequency attenuate
    const hp = sample - prev * 0.97;
    prev = sample;
    sample = Math.max(-1, Math.min(1, hp * 0.85 + sample * 0.15));
    out[i] = (sample * 32767) | 0;
  }
  return out;
}

/** Frame RMS energy curve (0–1) aligned to buffer duration */
export function computeEnergyEnvelope(
  buffer: AudioBuffer,
  hopMs = 20,
): Float32Array {
  const data = buffer.getChannelData(0);
  const hop = Math.max(1, Math.floor((buffer.sampleRate * hopMs) / 1000));
  const n = Math.max(1, Math.ceil(data.length / hop));
  const env = new Float32Array(n);
  let maxRms = 0.0001;
  for (let i = 0; i < n; i++) {
    const start = i * hop;
    const end = Math.min(data.length, start + hop);
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j] * data[j];
    const rms = Math.sqrt(sum / Math.max(1, end - start));
    env[i] = rms;
    if (rms > maxRms) maxRms = rms;
  }
  for (let i = 0; i < n; i++) env[i] = Math.min(1, env[i] / maxRms);
  return env;
}

export function energyAt(
  env: Float32Array | null | undefined,
  t: number,
  duration: number,
): number {
  if (!env?.length || duration <= 0) return 0.5;
  const idx = Math.min(
    env.length - 1,
    Math.max(0, Math.floor((t / duration) * env.length)),
  );
  return env[idx];
}

function normalizeViseme(v: string): RhubarbViseme {
  const u = (v || "X").toUpperCase();
  if ("XABCDEFGH".includes(u) && u.length === 1) return u as RhubarbViseme;
  return "X";
}

/** Merge tiny gaps and drop sub-frame noise cues */
export function smoothCues(cues: MouthCue[], minDur = 0.04): MouthCue[] {
  if (!cues.length) return cues;
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  const out: MouthCue[] = [];
  for (const c of sorted) {
    const dur = c.end - c.start;
    if (dur < minDur && c.value === "X") continue;
    if (!out.length) {
      out.push({ ...c });
      continue;
    }
    const prev = out[out.length - 1];
    // Fill gap < 40ms with previous viseme
    if (c.start - prev.end < 0.04 && c.start >= prev.end) {
      prev.end = Math.max(prev.end, c.start);
    }
    if (c.value === prev.value && c.start <= prev.end + 0.05) {
      prev.end = Math.max(prev.end, c.end);
    } else {
      if (prev.end > c.start) prev.end = c.start;
      out.push({ ...c });
    }
  }
  return out;
}

/**
 * When Rhubarb fails (common for Hindi / noisy TTS),
 * build approximate visemes from text length + duration.
 */
export function textGuidedCues(
  text: string,
  durationSec: number,
): MouthCue[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || durationSec < 0.15) {
    return [{ start: 0, end: durationSec, value: "X" }];
  }
  // Treat each word / Devanagari syllable-ish chunk
  const tokens =
    clean.match(/[\u0900-\u097F]+|\w+/g) ||
    clean.split(" ").filter(Boolean);
  const cues: MouthCue[] = [];
  let t = 0;
  const totalChars = tokens.reduce((s, w) => s + w.length, 0) || 1;
  tokens.forEach((tok, i) => {
    const share = tok.length / totalChars;
    const wordDur = Math.max(0.08, share * durationSec * 0.92);
    const gap = Math.min(0.06, durationSec * 0.02);
    // Closed onset (consonant-ish)
    cues.push({
      start: t,
      end: t + wordDur * 0.15,
      value: CLOSED,
    });
    // Open cycle through word
    const open = OPEN_CYCLE[i % OPEN_CYCLE.length];
    cues.push({
      start: t + wordDur * 0.15,
      end: t + wordDur * 0.85,
      value: open,
    });
    cues.push({
      start: t + wordDur * 0.85,
      end: t + wordDur,
      value: "X",
    });
    t += wordDur + gap;
  });
  if (t < durationSec) {
    cues.push({ start: t, end: durationSec, value: "X" });
  }
  return smoothCues(cues);
}

export async function analyzeMouthCues(
  buffer: AudioBuffer,
  dialogText?: string,
): Promise<MouthCue[] | null> {
  const duration = buffer.duration;
  const text = (dialogText || "").trim().slice(0, 280);

  const ok = await initRhubarb();
  if (ok && engineInstance) {
    try {
      const pcm16 = audioBufferToPcm16k(buffer);
      // dialogText strongly improves English recognition
      const opts = {
        dialogText: text || undefined,
        sampleRate: 16000,
      };
      const result = await engineInstance.analyze(pcm16, opts);
      const raw = result?.mouthCues as
        | Array<{ start: number; end: number; value: string }>
        | undefined;
      if (raw?.length) {
        const mapped = smoothCues(
          raw.map((c) => ({
            start: c.start,
            end: c.end,
            value: normalizeViseme(c.value),
          })),
        );
        if (mapped.length >= 2) return mapped;
      }
    } catch {
      /* fall through */
    }
  }

  // Fallback: text-timed approx (works for Hindi too)
  if (text) return textGuidedCues(text, duration);
  return null;
}

export function visemeAtTime(
  cues: MouthCue[] | null | undefined,
  t: number,
): RhubarbViseme {
  if (!cues?.length) return "X";
  for (const c of cues) {
    if (t >= c.start && t < c.end) return c.value;
  }
  const last = cues[cues.length - 1];
  if (t >= last.start && t <= last.end + 0.1) return last.value;
  return "X";
}

/**
 * Smooth lip state: crossfade at viseme boundaries + optional energy blend.
 */
export function smoothLipAtTime(
  cues: MouthCue[] | null | undefined,
  t: number,
  energy?: number,
): SmoothLipState {
  const viseme = visemeAtTime(cues, t);
  let lipOpen = VISEME_LIP_OPEN[viseme] ?? 0.1;
  let lipWidth = VISEME_WIDTH[viseme] ?? 1;

  // Crossfade near cue edges (~30ms)
  if (cues?.length) {
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      if (t >= c.start && t < c.end) {
        const edge = 0.03;
        const into = t - c.start;
        const outOf = c.end - t;
        if (into < edge && i > 0) {
          const prev = cues[i - 1].value;
          const a = into / edge;
          lipOpen =
            (VISEME_LIP_OPEN[prev] ?? 0.1) * (1 - a) +
            (VISEME_LIP_OPEN[c.value] ?? 0.1) * a;
          lipWidth =
            (VISEME_WIDTH[prev] ?? 1) * (1 - a) +
            (VISEME_WIDTH[c.value] ?? 1) * a;
        } else if (outOf < edge && i < cues.length - 1) {
          const next = cues[i + 1].value;
          const a = 1 - outOf / edge;
          lipOpen =
            (VISEME_LIP_OPEN[c.value] ?? 0.1) * (1 - a) +
            (VISEME_LIP_OPEN[next] ?? 0.1) * a;
          lipWidth =
            (VISEME_WIDTH[c.value] ?? 1) * (1 - a) +
            (VISEME_WIDTH[next] ?? 1) * a;
        }
        break;
      }
    }
  }

  // Energy: quieter = more closed, loud = open toward target
  if (typeof energy === "number") {
    const e = Math.max(0, Math.min(1, energy));
    // Keep at least 35% of viseme shape so consonants stay readable
    lipOpen = lipOpen * (0.35 + 0.65 * Math.pow(e, 0.7));
  }

  return { viseme, lipOpen, lipWidth };
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

/** Bundle cues + energy for a dialogue line */
export async function prepareLineLipSync(
  buffer: AudioBuffer | null,
  text: string,
  durationSec: number,
): Promise<{ cues: MouthCue[] | null; energy: Float32Array | null }> {
  if (buffer) {
    const cues = await analyzeMouthCues(buffer, text);
    const energy = computeEnergyEnvelope(buffer, 16);
    return { cues, energy };
  }
  if (text.trim()) {
    return {
      cues: textGuidedCues(text, durationSec),
      energy: null,
    };
  }
  return { cues: null, energy: null };
}
