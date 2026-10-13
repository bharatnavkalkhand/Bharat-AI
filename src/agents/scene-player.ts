/**
 * Scene player: dual panel + caption + TTS + optional MediaRecorder export.
 * Browser free path — WebM (Chrome/Android/Firefox); MP4 when browser supports it.
 * Note: Web Speech TTS is heard live but usually cannot be muxed into the file
 * (browser security). Burned-in captions carry dialogue in the export.
 */

export interface PlayerScene {
  id: string;
  title: string;
  mood: string;
  dialogue?: string;
  narration?: string;
  visualPrompt?: string;
  imageTop?: string;
  imageBottom?: string;
}

export interface PlayerOptions {
  language: "en" | "hi";
  headline?: string;
  width?: number;
  height?: number;
  onCaption?: (text: string) => void;
  onScene?: (index: number, total: number) => void;
  /** When true, records canvas to a video blob and returns it */
  record?: boolean;
  onRecordProgress?: (msg: string) => void;
}

export interface PlayResult {
  blob: Blob | null;
  mimeType: string;
  extension: "webm" | "mp4";
  hadAudioTrack: boolean;
}

function parseTurns(dialogue: string): Array<{ speaker: string; text: string }> {
  const lines = dialogue
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Array<{ speaker: string; text: string }> = [];
  for (const line of lines) {
    const m = line.match(/^([^:]{1,40}):\s*(.+)$/);
    if (m) out.push({ speaker: m[1].trim(), text: m[2].trim() });
    else out.push({ speaker: "", text: line });
  }
  return out.length ? out : [{ speaker: "", text: dialogue }];
}

const MOOD_COLORS: Record<string, [string, string]> = {
  fight: ["#3f0d12", "#7f1d1d"],
  romance: ["#4a044e", "#9d174d"],
  gesture: ["#164e63", "#0e7490"],
  dialogue: ["#1e293b", "#334155"],
  action: ["#7c2d12", "#c2410c"],
  emotional: ["#312e81", "#4c1d95"],
  dramatic: ["#18181b", "#3f3f46"],
};

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mood: string,
  label: string,
  image: HTMLImageElement | null,
  zoom: number,
) {
  const [c1, c2] = MOOD_COLORS[mood] || MOOD_COLORS.dialogue;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  if (image && image.complete && image.naturalWidth) {
    const iw = image.naturalWidth;
    const ih = image.naturalHeight;
    const scale = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.font = `600 ${Math.floor(w * 0.042)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = label.slice(0, 80).split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > w * 0.85 && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((ln, i) => {
      ctx.fillText(ln, x + w / 2, y + h / 2 + (i - 1) * 22);
    });
  }
}

function drawHeadline(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  h: number,
  text: string,
) {
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, y, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fs = Math.max(16, Math.floor(w * 0.048));
  ctx.font = `800 ${fs}px "Noto Sans Devanagari",system-ui,sans-serif`;
  const maxW = w * 0.92;
  const words = text.split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  const startY = y + h / 2 - ((lines.length - 1) * fs * 1.15) / 2;
  lines.slice(0, 2).forEach((ln, i) => {
    ctx.fillStyle = i === 0 ? "#f8fafc" : "#facc15";
    ctx.fillText(ln, w / 2, startY + i * fs * 1.15);
  });
}

function speak(
  text: string,
  language: "en" | "hi",
  speaker: string,
): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !text.trim()) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = language === "hi" ? "hi-IN" : "en-IN";
    const voices = window.speechSynthesis.getVoices();
    const pool = voices.filter((v) =>
      v.lang.toLowerCase().startsWith(language === "hi" ? "hi" : "en"),
    );
    if (pool.length) {
      let hash = 0;
      for (let i = 0; i < speaker.length; i++) hash += speaker.charCodeAt(i);
      u.voice = pool[hash % pool.length];
    }
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function stopScenePlayer() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Prefer MP4 when supported (Safari), else WebM VP9/VP8 */
export function pickRecorderMime(): { mimeType: string; extension: "webm" | "mp4" } {
  const candidates: Array<{ mimeType: string; extension: "webm" | "mp4" }> = [
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c.mimeType)
    ) {
      return c;
    }
  }
  return { mimeType: "video/webm", extension: "webm" };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function startRecording(canvas: HTMLCanvasElement): {
  recorder: MediaRecorder;
  chunks: BlobPart[];
  mimeType: string;
  extension: "webm" | "mp4";
  stop: () => Promise<Blob>;
} | null {
  if (!canvas.captureStream || typeof MediaRecorder === "undefined") return null;
  const { mimeType, extension } = pickRecorderMime();
  const stream = canvas.captureStream(30);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
    });
  } catch {
    try {
      recorder = new MediaRecorder(stream);
    } catch {
      return null;
    }
  }
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  const stop = () =>
    new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
      };
      if (recorder.state !== "inactive") recorder.stop();
      else resolve(new Blob(chunks, { type: mimeType }));
    });
  recorder.start(250);
  return { recorder, chunks, mimeType, extension, stop };
}

/**
 * Play dual-panel cinematic; optionally record to WebM/MP4.
 */
export async function playScenesOnCanvas(
  canvas: HTMLCanvasElement,
  scenes: PlayerScene[],
  options: PlayerOptions,
  signal?: { stopped: boolean },
): Promise<PlayResult> {
  const w = options.width ?? 360;
  const h = options.height ?? 450;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  const empty: PlayResult = {
    blob: null,
    mimeType: "",
    extension: "webm",
    hadAudioTrack: false,
  };
  if (!ctx || !scenes.length) return empty;

  const headline =
    options.headline ||
    (options.language === "hi" ? "कहानी चल रही है…" : "Story in motion…");

  const midBand = Math.floor(h * 0.14);
  const panelH = Math.floor((h - midBand) / 2);

  let recording: ReturnType<typeof startRecording> = null;
  if (options.record) {
    // Draw one black frame so captureStream has content
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    recording = startRecording(canvas);
    if (recording) {
      options.onRecordProgress?.(
        `Recording ${recording.extension.toUpperCase()}…`,
      );
    } else {
      options.onRecordProgress?.(
        "Recording not supported in this browser — playing only.",
      );
    }
  }

  for (let si = 0; si < scenes.length; si++) {
    if (signal?.stopped) break;
    const sc = scenes[si];
    options.onScene?.(si, scenes.length);

    let imgTop: HTMLImageElement | null = null;
    let imgBot: HTMLImageElement | null = null;
    if (sc.imageTop) {
      imgTop = new Image();
      imgTop.crossOrigin = "anonymous";
      imgTop.src = sc.imageTop;
      await imgTop.decode().catch(() => null);
    }
    if (sc.imageBottom) {
      imgBot = new Image();
      imgBot.crossOrigin = "anonymous";
      imgBot.src = sc.imageBottom;
      await imgBot.decode().catch(() => null);
    }

    const turns = sc.dialogue
      ? parseTurns(sc.dialogue)
      : sc.narration
        ? [{ speaker: "Narrator", text: sc.narration }]
        : [{ speaker: "", text: sc.title }];

    for (const turn of turns) {
      if (signal?.stopped) break;
      const caption = turn.speaker
        ? `${turn.speaker}: ${turn.text}`
        : turn.text;
      options.onCaption?.(caption);

      const t0 = performance.now();
      // Minimum hold so short lines still produce video frames
      const minHoldMs = 2200;
      const speakP = speak(turn.text, options.language, turn.speaker || sc.mood);
      let speakDone = false;
      speakP.then(() => {
        speakDone = true;
      });

      while (!signal?.stopped) {
        const elapsed = performance.now() - t0;
        if (speakDone && elapsed >= minHoldMs) break;
        // Cap single line at 20s
        if (elapsed > 20000) break;

        const t = elapsed / 1000;
        const zoom = 1 + Math.min(0.12, t * 0.02);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        drawPanel(
          ctx,
          0,
          0,
          w,
          panelH,
          sc.mood,
          sc.visualPrompt || sc.title,
          imgTop,
          zoom,
        );
        drawHeadline(ctx, w, panelH, midBand, headline);
        drawPanel(
          ctx,
          0,
          panelH + midBand,
          w,
          panelH,
          sc.mood,
          sc.title,
          imgBot || imgTop,
          1 + Math.min(0.08, t * 0.015),
        );
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, h - 56, w, 56);
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${Math.max(12, Math.floor(w * 0.035))}px system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const sub = caption.length > 90 ? caption.slice(0, 87) + "…" : caption;
        ctx.fillText(sub, w / 2, h - 28);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Hold last frame briefly for clean end
  await new Promise((r) => setTimeout(r, 400));

  if (recording) {
    options.onRecordProgress?.("Finalizing file…");
    const blob = await recording.stop();
    return {
      blob: blob.size > 0 ? blob : null,
      mimeType: recording.mimeType,
      extension: recording.extension,
      hadAudioTrack: false,
    };
  }

  return empty;
}
