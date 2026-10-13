/** Phase 2: obtain real audio blobs for dialogue (embeddable in export) */

export async function fetchTtsBlob(
  text: string,
  language: "en" | "hi",
): Promise<Blob | null> {
  const clean = text.trim().slice(0, 180);
  if (!clean) return null;

  try {
    const res = await fetch("/api/agents/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, language }),
    });

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("audio")) {
      const blob = await res.blob();
      if (blob.size > 500) return blob;
      return null;
    }
    // JSON fallback from API
    return null;
  } catch {
    return null;
  }
}

/** Split long dialogue into TTS-sized chunks */
export function chunkText(text: string, maxLen = 160): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxLen) return [t];
  const parts: string[] = [];
  let rest = t;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf(" ", maxLen);
    if (cut < 40) cut = maxLen;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function decodeBlob(
  ctx: AudioContext,
  blob: Blob,
): Promise<AudioBuffer | null> {
  try {
    const ab = await blob.arrayBuffer();
    return await ctx.decodeAudioData(ab.slice(0));
  } catch {
    return null;
  }
}

export interface TimedLine {
  text: string;
  speaker: string;
  buffer: AudioBuffer | null;
  /** estimated duration seconds */
  durationSec: number;
}

export async function prepareTimedLines(
  lines: Array<{ speaker: string; text: string }>,
  language: "en" | "hi",
  onProgress?: (msg: string) => void,
): Promise<{ ctx: AudioContext; lines: TimedLine[]; usedServerTts: boolean }> {
  const ctx = new AudioContext();
  const out: TimedLine[] = [];
  let usedServerTts = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    onProgress?.(`TTS ${i + 1}/${lines.length}: ${line.speaker || "line"}`);
    const chunks = chunkText(line.text);
    const buffers: AudioBuffer[] = [];

    for (const ch of chunks) {
      const blob = await fetchTtsBlob(ch, language);
      if (blob) {
        const buf = await decodeBlob(ctx, blob);
        if (buf) {
          buffers.push(buf);
          usedServerTts = true;
        }
      }
    }

    if (buffers.length === 1) {
      out.push({
        text: line.text,
        speaker: line.speaker,
        buffer: buffers[0],
        durationSec: buffers[0].duration,
      });
    } else if (buffers.length > 1) {
      // Concatenate chunk buffers into one
      const totalLen = buffers.reduce((s, b) => s + b.length, 0);
      const merged = ctx.createBuffer(
        buffers[0].numberOfChannels,
        totalLen,
        buffers[0].sampleRate,
      );
      let offset = 0;
      for (const b of buffers) {
        for (let c = 0; c < b.numberOfChannels; c++) {
          merged.getChannelData(c).set(b.getChannelData(c), offset);
        }
        offset += b.length;
      }
      out.push({
        text: line.text,
        speaker: line.speaker,
        buffer: merged,
        durationSec: merged.duration,
      });
    } else {
      // Estimate duration for browser-TTS fallback (~14 chars/sec)
      const est = Math.max(2.2, Math.min(12, line.text.length / 14));
      out.push({
        text: line.text,
        speaker: line.speaker,
        buffer: null,
        durationSec: est,
      });
    }
  }

  return { ctx, lines: out, usedServerTts };
}
