/**
 * Bharat AI — Free Prompt → High-Res Image & Short Video Generator
 *
 * Simple dedicated page: paste a prompt, get free high-resolution stills
 * (Pollinations Flux) or short AI video clips (public ZeroGPU Spaces).
 * No movie pipeline required. ₹0 path with honest limits.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Image as ImageIcon, Clapperboard, Loader2, Download, AlertCircle } from "lucide-react";
import { generateTextToImage } from "@/agents/text-to-image-agent";
import { createPublicMinimaxWorker } from "@/agents/public-minimax-worker";
import { createPublicLtxWorker } from "@/agents/public-ltx-worker";
import type { ShotRequest } from "@/agents/gpu-worker-pool";

export function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [mode, setMode] = useState<"image" | "video">("image");

  async function generateImage() {
    if (!prompt.trim()) {
      setStatus("Enter a prompt first.");
      return;
    }
    setBusy(true);
    setStatus("Generating high-res image (Pollinations Flux, free)…");
    setImageUrl("");
    setVideoUrl("");
    try {
      const result = await generateTextToImage({
        prompt: prompt.trim(),
        highRes: true,
        width: 1280,
        height: 720,
      });
      setImageUrl(result.imageUrl);
      setStatus("Image ready — download or right-click to save. Rate limits apply (~45s between free requests).");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateVideo() {
    if (!prompt.trim()) {
      setStatus("Enter a prompt first.");
      return;
    }
    setBusy(true);
    setStatus("Queuing short free video (public ZeroGPU Space, 1–3 min)…");
    setImageUrl("");
    setVideoUrl("");
    try {
      const request: ShotRequest = {
        movieId: "generate",
        sceneId: "prompt",
        prompt: prompt.trim() + ". Photorealistic live-action cinematic video, natural movement, cinematic lighting, no text, no subtitles.",
        aspectRatio: "16:9",
        width: 832,
        height: 480,
        durationSec: 4,
        seed: Math.floor(Math.random() * 100000),
      };

      // Prefer MiniMax then LTX
      let videoUrlResult = "";
      try {
        setStatus("Trying MiniMax ZeroGPU…");
        const worker = createPublicMinimaxWorker();
        const { remoteJobId } = await worker.submit(request, `gen-${Date.now()}`);
        let tries = 0;
        while (tries < 80) {
          await new Promise((r) => setTimeout(r, 2500));
          const st = await worker.status(remoteJobId);
          if (st.status === "succeeded" && st.videoUrl) {
            videoUrlResult = st.videoUrl;
            break;
          }
          if (st.status === "failed") throw new Error(st.error || "MiniMax failed");
          tries++;
          if (tries % 6 === 0) setStatus(`MiniMax generating… (${tries})`);
        }
        if (!videoUrlResult) throw new Error("MiniMax timeout");
      } catch (e1) {
        setStatus("MiniMax busy — trying LTX…");
        try {
          const worker = createPublicLtxWorker();
          const { remoteJobId } = await worker.submit(request, `gen-ltx-${Date.now()}`);
          let tries = 0;
          while (tries < 80) {
            await new Promise((r) => setTimeout(r, 2500));
            const st = await worker.status(remoteJobId);
            if (st.status === "succeeded" && st.videoUrl) {
              videoUrlResult = st.videoUrl;
              break;
            }
            if (st.status === "failed") throw new Error(st.error || "LTX failed");
            tries++;
            if (tries % 6 === 0) setStatus(`LTX generating… (${tries})`);
          }
          if (!videoUrlResult) throw new Error("LTX timeout");
        } catch (e2) {
          throw new Error(
            (e1 instanceof Error ? e1.message : String(e1)) +
            " | " +
            (e2 instanceof Error ? e2.message : String(e2)) +
            ". Shared free GPUs are busy. Retry later or deploy your own HF Space (see FREE_VIDEO_PATH.md)."
          );
        }
      }

      setVideoUrl(videoUrlResult);
      setStatus("Short video ready (silent, ~4s). Daily free GPU quota applies.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Video generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell mx-auto min-h-dvh max-w-lg px-4 pb-20 pt-6 sm:max-w-2xl">
      <header className="mb-6">
        <Link to="/" className="text-sm text-muted hover:text-accent">← Home</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Free Prompt Generator</h1>
        <p className="text-sm text-muted">
          High-resolution images + short AI videos at ₹0. No credits or tokens required for the free path.
        </p>
      </header>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("image")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
            mode === "image" ? "bg-accent text-black" : "border border-border"
          }`}
        >
          <ImageIcon className="mr-1 inline h-4 w-4" /> Image
        </button>
        <button
          type="button"
          onClick={() => setMode("video")}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold ${
            mode === "video" ? "bg-accent text-black" : "border border-border"
          }`}
        >
          <Clapperboard className="mr-1 inline h-4 w-4" /> Video
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="Describe the scene: subject, action, setting, lighting, style… e.g. Young woman in monsoon rain under a street lamp, cinematic lighting, Indian film still, sharp details, 35mm"
        className="mb-3 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <button
        type="button"
        disabled={busy || !prompt.trim()}
        onClick={() => void (mode === "image" ? generateImage() : generateVideo())}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-black disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {mode === "image" ? "Generate High-Res Image (free)" : "Generate Short Video (free)"}
      </button>

      {status && (
        <div className="mb-4 flex gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 text-xs text-muted">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>{status}</p>
        </div>
      )}

      {imageUrl && (
        <section className="mb-4 space-y-2 rounded-xl border border-border bg-card p-3">
          <h2 className="text-sm font-semibold">Generated image</h2>
          <img src={imageUrl} alt="Generated" className="w-full rounded-lg" />
          <a
            href={imageUrl}
            download="bharat-ai-image.jpg"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-black"
          >
            <Download className="h-3 w-3" /> Download / open
          </a>
        </section>
      )}

      {videoUrl && (
        <section className="mb-4 space-y-2 rounded-xl border border-border bg-card p-3">
          <h2 className="text-sm font-semibold">Generated short video</h2>
          <video src={videoUrl} controls playsInline className="w-full rounded-lg" />
          <a
            href={videoUrl}
            download="bharat-ai-clip.mp4"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-black"
          >
            <Download className="h-3 w-3" /> Download MP4
          </a>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-muted">
        Images: Pollinations public Flux (no key, rate-limited). Videos: public HF ZeroGPU Spaces (MiniMax / LTX, daily GPU minutes limited, short silent clips). For longer / higher-res unlimited, use local ComfyUI (see docs). Paid paths remain off by default.
      </p>
    </main>
  );
}
