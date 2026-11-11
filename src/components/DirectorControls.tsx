import { useState } from "react";
import type { MotionIntensity } from "@/agents/motion-engine";
import { createMuseTalkWorker } from "@/agents/musetalk-worker";
import {
  createComfyUiWorker,
  setComfyUiUrl,
} from "@/agents/comfyui-worker";
import {
  generateTextToImage,
  scenePromptsFromMovie,
} from "@/agents/text-to-image-agent";
import type { SceneImageFill } from "@/agents/web-image-agent";

export interface DirectorControlsProps {
  dualScreen: boolean;
  onDualScreenChange: (v: boolean) => void;
  facePerformance: boolean;
  onFacePerformanceChange: (v: boolean) => void;
  onMotionHint?: (m: MotionIntensity) => void;
  onStatus?: (msg: string) => void;
  onApplyImages?: (fills: SceneImageFill[]) => void;
  onPickImage?: (
    sceneId: string,
    slot: "top" | "bottom",
    imageDataOrUrl: string,
  ) => void;
  onGeneratedVideo?: (sceneId: string, dataUrl: string) => void;
  use3dAvatar?: boolean;
  on3dAvatarChange?: (v: boolean) => void;
  workerUrl?: string;
  onWorkerUrlChange?: (v: string) => void;
  movieId?: string;
  movie: {
    title: string;
    language: "en" | "hi";
    scenes: Array<{
      id: string;
      order: number;
      title: string;
      mood: string;
      dialogue?: string;
      narration?: string;
      visualPrompt?: string;
      gestureNotes?: string;
    }>;
    characters?: Array<{
      id?: string;
      name: string;
      role?: string;
      appearance?: string;
      referenceImageLocal?: string;
      referenceImageUrl?: string;
    }>;
  };
}

/**
 * Image + video generator controls for Produce.
 * Free T2I (Pollinations) · optional lip / Comfy · HF worker override.
 */
export function DirectorControls({
  dualScreen,
  onDualScreenChange,
  facePerformance,
  onFacePerformanceChange,
  onStatus,
  onApplyImages,
  onPickImage,
  onGeneratedVideo,
  use3dAvatar = false,
  on3dAvatarChange,
  workerUrl = "",
  onWorkerUrlChange,
  movieId,
  movie,
}: DirectorControlsProps) {
  const [lipBusy, setLipBusy] = useState(false);
  const [comfyBusy, setComfyBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [lipSpaceUrl, setLipSpaceUrl] = useState(
    () =>
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("bharat_musetalk_space")) ||
      "",
  );
  const [comfyUrl, setComfyUrl] = useState(
    () =>
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("bharat_comfyui_url")) ||
      "",
  );

  function firstFace(): string {
    return (
      movie.characters?.find((c) => c.referenceImageLocal || c.referenceImageUrl)
        ?.referenceImageLocal ||
      movie.characters?.find((c) => c.referenceImageUrl)?.referenceImageUrl ||
      ""
    );
  }

  function firstSceneId(): string | undefined {
    return movie.scenes.slice().sort((a, b) => a.order - b.order)[0]?.id;
  }

  function dialogueBlob(): string {
    return (
      movie.scenes
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => s.dialogue || s.narration || s.visualPrompt || "")
        .filter(Boolean)
        .join(" ")
        .slice(0, 240) || movie.title
    );
  }

  async function runTextToImage() {
    if (!movie.scenes.length) {
      onStatus?.(
        movie.language === "hi"
          ? "Pehle script / scenes banao"
          : "Generate script/scenes first",
      );
      return;
    }
    setImgBusy(true);
    onStatus?.(
      movie.language === "hi" ? "Text → image… (free)" : "Text → image… (free)",
    );
    try {
      const prompts = scenePromptsFromMovie(movie);
      const fills: SceneImageFill[] = [];
      for (let i = 0; i < prompts.length; i++) {
        const p = prompts[i]!;
        const scene = movie.scenes.find((s) => s.id === p.sceneId);
        onStatus?.(
          movie.language === "hi"
            ? `Image ${i + 1}/${prompts.length}…`
            : `Image ${i + 1}/${prompts.length}…`,
        );
        const result = await generateTextToImage({
          prompt: p.prompt,
          width: 720,
          height: 1280,
        });
        const src = result.dataUrl || result.imageUrl;
        fills.push({
          sceneId: p.sceneId,
          title: scene?.title || p.sceneId,
          mood: scene?.mood || "dramatic",
          queries: [p.prompt],
          candidates: [{ url: result.imageUrl, source: "mixed", title: p.prompt }],
          imageTop: src,
          source: "mixed",
        });
        if (onPickImage) onPickImage(p.sceneId, "top", src);
      }
      if (onApplyImages && fills.length) onApplyImages(fills);
      onStatus?.(
        movie.language === "hi"
          ? `${fills.length} images ready — scenes pe lag gayi`
          : `${fills.length} images ready on scenes`,
      );
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setImgBusy(false);
    }
  }

  async function runLipAnimate() {
    const url = lipSpaceUrl.trim();
    if (!url) {
      onStatus?.(
        movie.language === "hi"
          ? "Pehle Lip Space URL daalein"
          : "Paste Lip-sync Space URL once",
      );
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bharat_musetalk_space", url);
    }
    const face = firstFace();
    if (!face) {
      onStatus?.(
        movie.language === "hi"
          ? "Cast me face photo lagao"
          : "Add a face photo on cast first",
      );
      return;
    }
    setLipBusy(true);
    onStatus?.(movie.language === "hi" ? "Lip worker…" : "Lip worker…");
    try {
      const worker = createMuseTalkWorker({ spaceUrl: url, mode: "auto" });
      const key = `lip-${movieId || "m"}-${Date.now()}`;
      const { remoteJobId } = await worker.submit(
        {
          movieId: movieId || "local",
          sceneId: firstSceneId() || "s0",
          prompt: dialogueBlob(),
          audioPrompt: dialogueBlob(),
          durationSec: 6,
          aspectRatio: "9:16",
          width: 720,
          height: 1280,
          seed: Date.now() % 100000,
          referenceImageUrls: face ? [face] : [],
        },
        key,
      );
      let tries = 0;
      while (tries < 90) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await worker.status(remoteJobId);
        if (st.status === "succeeded" && st.videoUrl) {
          onStatus?.(movie.language === "hi" ? "Lip video ready" : "Lip video ready");
          const sid = firstSceneId();
          if (sid && onGeneratedVideo) onGeneratedVideo(sid, st.videoUrl);
          setLipBusy(false);
          return;
        }
        if (st.status === "failed") throw new Error(st.error || "Lip failed");
        tries += 1;
      }
      throw new Error("Lip timeout");
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "Lip failed");
    } finally {
      setLipBusy(false);
    }
  }

  async function runComfyImg2Vid() {
    const url = comfyUrl.trim();
    if (!url) {
      onStatus?.(
        movie.language === "hi"
          ? "ComfyUI URL chahiye — ya Run production pipeline se video"
          : "Need ComfyUI URL — or Run production pipeline for video",
      );
      return;
    }
    setComfyUiUrl(url);
    setComfyUrl(url);
    const face = firstFace();
    setComfyBusy(true);
    onStatus?.(movie.language === "hi" ? "ComfyUI video…" : "ComfyUI video…");
    try {
      const worker = createComfyUiWorker({
        baseUrl: url,
        mode: face ? "img2vid" : "txt2vid",
      });
      const key = `comfy-${movieId || "m"}-${Date.now()}`;
      const { remoteJobId } = await worker.submit(
        {
          movieId: movieId || "local",
          sceneId: firstSceneId() || "s0",
          prompt: dialogueBlob(),
          durationSec: 4,
          aspectRatio: "9:16",
          width: 720,
          height: 1280,
          seed: Date.now() % 100000,
          referenceImageUrls: face ? [face] : [],
        },
        key,
      );
      let tries = 0;
      while (tries < 120) {
        await new Promise((r) => setTimeout(r, 2500));
        const st = await worker.status(remoteJobId);
        if (st.status === "succeeded" && st.videoUrl) {
          onStatus?.(movie.language === "hi" ? "Video ready" : "Video ready");
          const sid = firstSceneId();
          if (sid && onGeneratedVideo) onGeneratedVideo(sid, st.videoUrl);
          setComfyBusy(false);
          return;
        }
        if (st.status === "failed") throw new Error(st.error || "Comfy failed");
        tries += 1;
      }
      throw new Error("ComfyUI timeout");
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "ComfyUI failed");
    } finally {
      setComfyBusy(false);
    }
  }

  const disabled = lipBusy || comfyBusy || imgBusy || !movie.scenes.length;

  return (
    <section className="mb-4 space-y-2 rounded-xl border border-border bg-card p-3">
      <p className="text-xs font-semibold">AI Image + Video Generator</p>

      <button
        type="button"
        disabled={disabled}
        className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-black disabled:opacity-40"
        onClick={() => void runTextToImage()}
      >
        {imgBusy
          ? movie.language === "hi"
            ? "Images ban rahi hain…"
            : "Generating images…"
          : movie.language === "hi"
            ? "🖼 Text → Image (muft)"
            : "🖼 Text → Image (free)"}
      </button>

      <p className="text-[10px] text-muted leading-relaxed">
        {movie.language === "hi"
          ? "Scene prompts se stills (Pollinations · no key). Phir Play / Export ya video."
          : "Stills from scene prompts (Pollinations · no key). Then Play / Export or video."}
      </p>

      <label className="mt-2 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={facePerformance}
          onChange={(e) => onFacePerformanceChange(e.target.checked)}
        />
        Face / lip overlay on photos
      </label>

      <label className="mt-1 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={dualScreen}
          onChange={(e) => onDualScreenChange(e.target.checked)}
        />
        Dual screen
      </label>

      <label className="mt-1 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={use3dAvatar}
          onChange={(e) => on3dAvatarChange?.(e.target.checked)}
        />
        Real human avatar mode
      </label>

      <div className="mt-3 space-y-1">
        <p className="text-[10px] font-medium text-muted">Video · optional HF worker</p>
        <input
          value={workerUrl}
          onChange={(e) => onWorkerUrlChange?.(e.target.value)}
          placeholder="Optional HF Space URL"
          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[11px] outline-none focus:border-accent"
        />
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[10px] font-medium text-muted">L · Lip-sync Space</p>
        <input
          value={lipSpaceUrl}
          onChange={(e) => {
            setLipSpaceUrl(e.target.value);
            if (typeof localStorage !== "undefined") {
              localStorage.setItem("bharat_musetalk_space", e.target.value.trim());
            }
          }}
          placeholder="https://xxxx.hf.space"
          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[11px] outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={disabled || !lipSpaceUrl.trim()}
          className="w-full rounded-lg border border-pink-500/40 bg-pink-500/10 py-2 text-xs font-semibold text-pink-300 disabled:opacity-40"
          onClick={() => void runLipAnimate()}
        >
          {lipBusy ? "Lips…" : "Animate face lips"}
        </button>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[10px] font-medium text-muted">C · Local ComfyUI (strong video)</p>
        <input
          value={comfyUrl}
          onChange={(e) => {
            setComfyUrl(e.target.value);
            setComfyUiUrl(e.target.value);
          }}
          placeholder="http://127.0.0.1:8188"
          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[11px] outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={disabled || !comfyUrl.trim()}
          className="w-full rounded-lg border border-sky-500/40 bg-sky-500/10 py-2 text-xs font-semibold text-sky-300 disabled:opacity-40"
          onClick={() => void runComfyImg2Vid()}
        >
          {comfyBusy ? "Video…" : "Text / image → video (Comfy)"}
        </button>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        <strong className="text-fg">Flow:</strong> Text→Image → Play/Export ·
        optional HF / Comfy video · optional lips. Public GPU limited.
      </p>
    </section>
  );
}
