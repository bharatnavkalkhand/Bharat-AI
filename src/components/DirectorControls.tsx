import { useState } from "react";
import type { MotionIntensity } from "@/agents/motion-engine";
import { createMuseTalkWorker } from "@/agents/musetalk-worker";
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
  onImportExternal?: (sceneId: string, dataUrl: string) => void;
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
 * Director controls — self-serve lip worker + layout toggles.
 * Product rule: user does NOT run Kaggle cells daily.
 * One-time HF MuseTalk/LivePortrait Space URL → Produce → Animate.
 */
export function DirectorControls({
  dualScreen,
  onDualScreenChange,
  facePerformance,
  onFacePerformanceChange,
  onStatus,
  onImportExternal,
  use3dAvatar = false,
  on3dAvatarChange,
  workerUrl = "",
  onWorkerUrlChange,
  movieId,
  movie,
}: DirectorControlsProps) {
  const [lipBusy, setLipBusy] = useState(false);
  const [lipSpaceUrl, setLipSpaceUrl] = useState(
    () =>
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("bharat_musetalk_space")) ||
      "",
  );

  async function runLipAnimate() {
    const url = lipSpaceUrl.trim();
    if (!url) {
      onStatus?.(
        movie.language === "hi"
          ? "Pehle Lip Space URL daalein (ek baar HF Space deploy)"
          : "Paste Lip-sync Space URL once (HF MuseTalk/LivePortrait)",
      );
      return;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("bharat_musetalk_space", url);
    }
    const face =
      movie.characters?.find((c) => c.referenceImageLocal || c.referenceImageUrl)
        ?.referenceImageLocal ||
      movie.characters?.find((c) => c.referenceImageUrl)?.referenceImageUrl ||
      "";
    if (!face) {
      onStatus?.(
        movie.language === "hi"
          ? "Cast me face photo lagao (reference image)"
          : "Add a face photo on a cast member first",
      );
      return;
    }
    const dialogue =
      movie.scenes
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => s.dialogue || s.narration || "")
        .filter(Boolean)
        .join(" ")
        .slice(0, 200) || movie.title;

    setLipBusy(true);
    onStatus?.(
      movie.language === "hi"
        ? "Lip worker chal raha hai… (cold start 1–3 min)"
        : "Lip worker running… (cold start 1–3 min)",
    );
    try {
      const worker = createMuseTalkWorker({ spaceUrl: url, mode: "auto" });
      const key = `lip-${movieId || "m"}-${Date.now()}`;
      const { remoteJobId } = await worker.submit(
        {
          prompt: dialogue,
          audioPrompt: dialogue,
          durationSec: 6,
          referenceImageUrls: [face],
        },
        key,
      );
      let tries = 0;
      while (tries < 90) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await worker.status(remoteJobId);
        if (st.status === "succeeded" && st.videoUrl) {
          onStatus?.(
            movie.language === "hi"
              ? "Lip video ready — scene me import ho gaya"
              : "Lip video ready — imported to scene",
          );
          const first = movie.scenes.slice().sort((a, b) => a.order - b.order)[0];
          if (first && onImportExternal) onImportExternal(first.id, st.videoUrl);
          setLipBusy(false);
          return;
        }
        if (st.status === "failed") {
          throw new Error(st.error || "Lip worker failed");
        }
        tries += 1;
        if (tries % 5 === 0) {
          onStatus?.(`Lip worker… ${Math.round((st.progress || 0.3) * 100)}%`);
        }
      }
      throw new Error("Lip worker timeout");
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "Lip animate failed");
    } finally {
      setLipBusy(false);
    }
  }

  const disabled = lipBusy || !movie.scenes.length;

  return (
    <section className="mb-4 space-y-2 rounded-xl border border-border bg-card p-3">
      <p className="text-xs font-semibold">Director / art controls</p>

      <label className="flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={facePerformance}
          onChange={(e) => onFacePerformanceChange(e.target.checked)}
        />
        Face remix / lip-sync on photos (free client)
      </label>

      <label className="mt-2 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={dualScreen}
          onChange={(e) => onDualScreenChange(e.target.checked)}
        />
        Dual screen (top + bottom panels)
      </label>

      <label className="mt-2 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={use3dAvatar}
          onChange={(e) => on3dAvatarChange?.(e.target.checked)}
        />
        Real human avatar (face photo + lip-sync)
      </label>

      <div className="mt-3 space-y-1">
        <p className="text-[10px] font-medium text-muted">
          A · Free HF video worker URL (Wan / short clips)
        </p>
        <input
          value={workerUrl}
          onChange={(e) => onWorkerUrlChange?.(e.target.value)}
          placeholder="https://xxxx.hf.space"
          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[11px] outline-none focus:border-accent"
        />
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[10px] font-medium text-muted">
          L · Lip-sync Space — ek baar URL save, phir sirf button
        </p>
        <input
          value={lipSpaceUrl}
          onChange={(e) => {
            setLipSpaceUrl(e.target.value);
            if (typeof localStorage !== "undefined") {
              localStorage.setItem("bharat_musetalk_space", e.target.value.trim());
            }
          }}
          placeholder="https://xxxx.hf.space (MuseTalk / LivePortrait)"
          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-[11px] outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={disabled || !lipSpaceUrl.trim()}
          className="w-full rounded-lg border border-pink-500/40 bg-pink-500/10 py-2.5 text-xs font-semibold text-pink-300 disabled:opacity-40"
          onClick={() => void runLipAnimate()}
        >
          {lipBusy ? "Animating lips…" : "Animate face lips (self-serve)"}
        </button>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        <strong className="text-fg">Self-serve:</strong> Kaggle daily nahi.
        Ek baar apna HF Lip Space deploy karke URL yahan save karo. Uske baad
        Produce → face photo → Animate. Quota HF free ZeroGPU jaisa limited rehta hai.
      </p>
    </section>
  );
}
