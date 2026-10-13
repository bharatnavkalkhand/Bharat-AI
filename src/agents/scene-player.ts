/**
 * Scene player inspired by short-form illustrated history videos
 * (dual panel + Hindi caption bar + dialogue TTS + mild motion).
 * Runs fully in-browser at ₹0. Not a replacement for full AI video models.
 */

export interface PlayerScene {
  id: string;
  title: string;
  mood: string;
  dialogue?: string;
  narration?: string;
  visualPrompt?: string;
  /** Optional image URL or data URL for top panel */
  imageTop?: string;
  /** Optional image for bottom panel */
  imageBottom?: string;
}

export interface PlayerOptions {
  language: "en" | "hi";
  headline?: string;
  width?: number;
  height?: number;
  onCaption?: (text: string) => void;
  onScene?: (index: number, total: number) => void;
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
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.font = `600 ${Math.floor(w * 0.045)}px system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(label.slice(0, 48), x + w / 2, y + h / 2);
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
  // yellow/white style like sample
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fs = Math.max(18, Math.floor(w * 0.048));
  ctx.font = `800 ${fs}px "Noto Sans Devanagari",system-ui,sans-serif`;
  ctx.fillStyle = "#facc15";
  // simple wrap
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
    // highlight last few words in white if Hindi mixed — keep yellow base
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

/**
 * Play scenes on a canvas with dual-panel layout + caption + TTS.
 * Matches the *structure* of short illustrated dialogue videos.
 */
export async function playScenesOnCanvas(
  canvas: HTMLCanvasElement,
  scenes: PlayerScene[],
  options: PlayerOptions,
  signal?: { stopped: boolean },
): Promise<void> {
  const w = options.width ?? 360;
  const h = options.height ?? 450;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx || !scenes.length) return;

  const headline =
    options.headline ||
    (options.language === "hi"
      ? "कहानी चल रही है…"
      : "Story in motion…");

  const midBand = Math.floor(h * 0.14);
  const panelH = Math.floor((h - midBand) / 2);

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

      // Ken Burns frames while speaking
      const t0 = performance.now();
      const speakP = speak(turn.text, options.language, turn.speaker || sc.mood);
      let done = false;
      speakP.then(() => {
        done = true;
      });

      while (!done && !signal?.stopped) {
        const t = (performance.now() - t0) / 1000;
        const zoom = 1 + Math.min(0.12, t * 0.02);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, w, h);
        drawPanel(ctx, 0, 0, w, panelH, sc.mood, sc.visualPrompt || sc.title, imgTop, zoom);
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
        // dialogue subtitle bar
        ctx.fillStyle = "rgba(0,0,0,0.72)";
        ctx.fillRect(0, h - 56, w, 56);
        ctx.fillStyle = "#fff";
        ctx.font = `600 ${Math.max(12, Math.floor(w * 0.035))}px system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const sub = caption.length > 90 ? caption.slice(0, 87) + "…" : caption;
        ctx.fillText(sub, w / 2, h - 28);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      }
      await new Promise((r) => setTimeout(r, 180));
    }
  }
}

/** Record canvas stream + optional silent path — WebM in browsers that support it */
export async function recordCanvasWebM(
  canvas: HTMLCanvasElement,
  durationMs: number,
): Promise<Blob | null> {
  if (!canvas.captureStream) return null;
  const stream = canvas.captureStream(30);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });
  rec.start(200);
  await new Promise((r) => setTimeout(r, durationMs));
  rec.stop();
  return done;
}
