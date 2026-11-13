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
import {
  createPublicLtxWorker,
  setBharatHfToken,
  getBharatHfToken,
} from "@/agents/public-ltx-worker";
import { generateSilentClip } from "@/agents/hf-zerogpu-worker";
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
  const [gpuBusy, setGpuBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);
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
  const [hfToken, setHfToken] = useState(
    () =>
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("bharat_hf_token")) ||
      "",
  );

  const tokenSaved = Boolean(hfToken.trim() || getBharatHfToken());

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

  function firstScene() {
    return movie.scenes.slice().sort((a, b) => a.order - b.order)[0];
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

  function scenePrompt(): string {
    const scene = firstScene();
    if (!scene) return movie.title;
    const cast =
      movie.characters
        ?.map((c) => [c.name, c.role, c.appearance].filter(Boolean).join(", "))
        .filter(Boolean)
        .join("; ") || "";
    return [
      scene.visualPrompt || scene.title,
      scene.mood ? `Mood: ${scene.mood}` : "",
      cast ? `Characters: ${cast}` : "",
      scene.dialogue || scene.narration
        ? `Context: ${scene.dialogue || scene.narration}`
        : "",
      "Photorealistic live-action cinematic video, natural movement, cinematic lighting, no text, no subtitles.",
    ]
      .filter(Boolean)
      .join(". ");
  }

  function persistToken(value: string) {
    setHfToken(value);
    setBharatHfToken(value);
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
    onStatus?.(movie.language === "hi" ? "Text → image…" : "Text → image…");
    try {
      const prompts = scenePromptsFromMovie(movie);
      const fills: SceneImageFill[] = [];
      for (let i = 0; i < prompts.length; i++) {
        const p = prompts[i]!;
        const scene = movie.scenes.find((s) => s.id === p.sceneId);
        onStatus?.(`Image ${i + 1}/${prompts.length}…`);
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
          ? `${fills.length} images ready`
          : `${fills.length} images ready`,
      );
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "Image generation failed");
    } finally {
      setImgBusy(false);
    }
  }

  /** Produce short silent GPU video in the web UI (public LTX or own HF Space). */
  async function runGpuVideo() {
    if (!movie.scenes.length) {
      onStatus?.(
        movie.language === "hi"
          ? "Pehle script / scenes banao"
          : "Generate script/scenes first",
      );
      return;
    }
    const scene = firstScene();
    if (!scene) return;

    setGpuBusy(true);
    onStatus?.(
      movie.language === "hi"
        ? "GPU video queue… (1–3 min)"
        : "GPU video queued… (1–3 min)",
    );

    try {
      const ownSpace = workerUrl.trim();
      if (ownSpace) {
        const generated = await generateSilentClip({
          spaceUrl: ownSpace,
          prompt: scenePrompt(),
          durationSec: 2,
          seed: 42 + scene.order,
          onProgress: (m) => onStatus?.(m),
        });
        if ("error" in generated) throw new Error(generated.error);
        if (onGeneratedVideo) onGeneratedVideo(scene.id, generated.videoUrl);
        onStatus?.(
          movie.language === "hi"
            ? "Video ready — scene player me dekho"
            : "Video ready — check scene player",
        );
        return;
      }

      // Default: public LTX ZeroGPU (token improves quota)
      const worker = createPublicLtxWorker();
      const { remoteJobId } = await worker.submit(
        {
          movieId: movieId || "local",
          sceneId: scene.id,
          prompt: scenePrompt(),
          aspectRatio: "16:9",
          width: 832,
          height: 480,
          durationSec: 4,
          seed: 42 + scene.order,
        },
        `ui-ltx-${movieId || "m"}-${scene.id}-${Date.now()}`,
      );

      let tries = 0;
      while (tries < 120) {
        await new Promise((r) => setTimeout(r, 2500));
        const st = await worker.status(remoteJobId);
        if (st.status === "succeeded" && st.videoUrl) {
          if (onGeneratedVideo) onGeneratedVideo(scene.id, st.videoUrl);
          onStatus?.(
            movie.language === "hi"
              ? "GPU video ready — player me play karo"
              : "GPU video ready — play in scene player",
          );
          return;
        }
        if (st.status === "failed") {
          throw new Error(st.error || "GPU video failed");
        }
        tries += 1;
        if (tries % 8 === 0) {
          onStatus?.(
            movie.language === "hi"
              ? `Abhi generate ho raha hai… (${tries})`
              : `Still generating… (${tries})`,
          );
        }
      }
      throw new Error("GPU video timeout");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "GPU video failed";
      onStatus?.(msg);
    } finally {
      setGpuBusy(false);
    }
  }

  async function runLipAnimate() {
    const url = lipSpaceUrl.trim();
    if (!url) {
      onStatus?.(movie.language === "hi" ? "Lip Space URL daalo" : "Paste Lip Space URL");
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bharat_musetalk_space", url);
    }
    const face = firstFace();
    if (!face) {
      onStatus?.(movie.language === "hi" ? "Cast pe face photo" : "Add face photo");
      return;
    }
    setLipBusy(true);
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
          const sid = firstSceneId();
          if (sid && onGeneratedVideo) onGeneratedVideo(sid, st.videoUrl);
          onStatus?.("Lip video ready");
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
      onStatus?.(movie.language === "hi" ? "ComfyUI URL chahiye" : "Need ComfyUI URL");
      return;
    }
    setComfyUiUrl(url);
    setComfyUrl(url);
    const face = firstFace();
    setComfyBusy(true);
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
          const sid = firstSceneId();
          if (sid && onGeneratedVideo) onGeneratedVideo(sid, st.videoUrl);
          onStatus?.("Video ready");
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

  const disabled =
    lipBusy || comfyBusy || imgBusy || gpuBusy || !movie.scenes.length;

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
            ? "Images…"
            : "Generating images…"
          : movie.language === "hi"
            ? "🖼 Text → Image (muft)"
            : "🖼 Text → Image (free)"}
      </button>

      <div className="mt-3 space-y-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
        <p className="text-[10px] font-semibold text-emerald-300">
          Secure HF token · browser only
        </p>
        <p className="text-[10px] text-muted leading-relaxed">
          Token is blurred, saved only in this browser (localStorage). Never
          committed to Git. Read-only token from{" "}
          <a
            className="underline text-emerald-300/90"
            href="https://huggingface.co/settings/tokens"
            target="_blank"
            rel="noreferrer"
          >
            huggingface.co/settings/tokens
          </a>
          .
        </p>
        <div className="flex gap-1">
          <input
            type={showToken ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={hfToken}
            onChange={(e) => persistToken(e.target.value)}
            placeholder="hf_… (blurred, optional)"
            className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-[11px] tracking-wider outline-none focus:border-accent"
          />
          <button
            type="button"
            className="shrink-0 rounded-lg border border-border px-2 text-[10px] text-muted"
            onClick={() => setShowToken((v) => !v)}
            title={showToken ? "Hide token" : "Show token"}
          >
            {showToken ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-border px-2 text-[10px] text-muted"
            onClick={() => persistToken("")}
            title="Clear token from this browser"
          >
            Clear
          </button>
        </div>
        <p className="text-[10px] text-muted">
          {tokenSaved
            ? "Token saved in this browser · used for ZeroGPU quota"
            : "No token · anonymous quota is smaller"}
        </p>

        <input
          value={workerUrl}
          onChange={(e) => onWorkerUrlChange?.(e.target.value)}
          placeholder="Optional: your HF Space URL"
          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[11px] outline-none focus:border-accent"
        />

        <button
          type="button"
          disabled={disabled}
          className="w-full rounded-xl border border-emerald-500/50 bg-emerald-500/20 py-2.5 text-xs font-bold text-emerald-100 disabled:opacity-40"
          onClick={() => void runGpuVideo()}
        >
          {gpuBusy
            ? movie.language === "hi"
              ? "GPU video… (1–3 min)"
              : "Generating GPU video… (1–3 min)"
            : movie.language === "hi"
              ? "▶ GPU video banao (web UI)"
              : "▶ Generate GPU video (in web UI)"}
        </button>
        <p className="text-[10px] text-muted">
          Uses public LTX ZeroGPU by default (token helps quota), or your Space
          URL if set. Clip attaches to the first scene for playback in the app.
        </p>
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={facePerformance}
          onChange={(e) => onFacePerformanceChange(e.target.checked)}
        />
        Face / lip overlay
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
        <p className="text-[10px] font-medium text-muted">L · Lip Space</p>
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
        <p className="text-[10px] font-medium text-muted">C · Local ComfyUI</p>
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
    </section>
  );
}
