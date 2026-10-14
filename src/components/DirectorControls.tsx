import { useState } from "react";
import {
  runDirectorAgent,
  formatDirectorReport,
  type DirectorReport,
  type ScreenLayout,
} from "@/agents/director-agent";
import {
  runWebImageAgent,
  materializeImage,
  type SceneImageFill,
  type ImageCandidate,
} from "@/agents/web-image-agent";
import type { MotionIntensity } from "@/agents/motion-engine";

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
  use3dAvatar?: boolean;
  on3dAvatarChange?: (v: boolean) => void;
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
  };
}

export function DirectorControls({
  dualScreen,
  onDualScreenChange,
  facePerformance,
  onFacePerformanceChange,
  onMotionHint,
  onStatus,
  onApplyImages,
  onPickImage,
  use3dAvatar = false,
  on3dAvatarChange,
  movie,
}: DirectorControlsProps) {
  const [busy, setBusy] = useState(false);
  const [fillBusy, setFillBusy] = useState(false);
  const [text, setText] = useState("");
  const [report, setReport] = useState<DirectorReport | null>(null);
  const [lastFills, setLastFills] = useState<SceneImageFill[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  async function runDirector() {
    if (!movie.scenes.length) {
      onStatus?.("Add scenes first.");
      return;
    }
    setBusy(true);
    onStatus?.("Director Agent thinking…");
    try {
      const layout: ScreenLayout = dualScreen ? "dual" : "single";
      const r = await runDirectorAgent({
        title: movie.title,
        language: movie.language,
        layout,
        scenes: movie.scenes,
        fetchWebImages: true,
        onProgress: (msg) => onStatus?.(msg),
      });
      setReport(r);
      setText(formatDirectorReport(r));
      const hot = r.scenes.find((s) => s.motionIntensity === "high");
      if (hot) onMotionHint?.(hot.motionIntensity);
      onStatus?.(r.summary);
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "Director failed");
    } finally {
      setBusy(false);
    }
  }

  async function autoFillFromWeb() {
    if (!movie.scenes.length) {
      onStatus?.("Add scenes first.");
      return;
    }
    setFillBusy(true);
    onStatus?.("Searching 4 free sources…");
    try {
      const layout: ScreenLayout = dualScreen ? "dual" : "single";
      const result = await runWebImageAgent({
        title: movie.title,
        language: movie.language,
        layout,
        scenes: movie.scenes,
        onProgress: (msg) => onStatus?.(msg),
      });
      setLastFills(result.fills);
      if (result.fills[0]) setActiveSceneId(result.fills[0].sceneId);
      onApplyImages?.(result.fills);
      onStatus?.(result.summary);
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "Web image fill failed");
    } finally {
      setFillBusy(false);
    }
  }

  async function pickCandidate(
    sceneId: string,
    slot: "top" | "bottom",
    c: ImageCandidate,
  ) {
    setPicking(true);
    onStatus?.("Applying selected image…");
    try {
      const data = await materializeImage(c.url);
      onPickImage?.(sceneId, slot, data);
      onStatus?.(`Panel ${slot}: ${c.source} image applied`);
    } catch {
      onPickImage?.(sceneId, slot, c.url);
    } finally {
      setPicking(false);
    }
  }

  const disabled = busy || fillBusy || !movie.scenes.length;
  const activeFill =
    lastFills.find((f) => f.sceneId === activeSceneId) || lastFills[0];

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold text-fg">
        Mind + Web Image + 3D Avatar
      </p>

      <label className="flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={facePerformance}
          onChange={(e) => onFacePerformanceChange(e.target.checked)}
        />
        Face remix / lip-sync on photos
      </label>
      <label className="mt-3 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={dualScreen}
          onChange={(e) => onDualScreenChange(e.target.checked)}
        />
        Dual screen (top + bottom panels)
      </label>
      <label className="mt-3 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={use3dAvatar}
          onChange={(e) => on3dAvatarChange?.(e.target.checked)}
        />
        3D talking-head avatar (lip-sync morph)
      </label>
      <p className="mt-1 text-[10px] text-muted">
        Canvas 3D head — jaw/lips follow Rhubarb + energy. No GPU.
      </p>

      <button
        type="button"
        disabled={disabled}
        className="mt-3 w-full rounded-lg bg-accent py-2.5 text-xs font-semibold text-white disabled:opacity-40"
        onClick={autoFillFromWeb}
      >
        {fillBusy
          ? "Searching 4 free sources…"
          : "Auto-fill from web (12+ options / scene)"}
      </button>

      <button
        type="button"
        disabled={disabled}
        className="mt-2 w-full rounded-lg border border-accent/40 bg-accent/10 py-2.5 text-xs font-semibold text-accent disabled:opacity-40"
        onClick={runDirector}
      >
        {busy ? "Director Agent…" : "Director plan only"}
      </button>

      {lastFills.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-medium text-muted">
            Scene · pick from 12+ candidates
          </p>
          <div className="flex flex-wrap gap-1">
            {lastFills.map((f, i) => (
              <button
                key={f.sceneId}
                type="button"
                onClick={() => setActiveSceneId(f.sceneId)}
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  (activeFill?.sceneId || "") === f.sceneId
                    ? "bg-accent text-white"
                    : "bg-bg text-muted border border-border"
                }`}
              >
                {i + 1}. {f.mood}
              </button>
            ))}
          </div>

          {activeFill && (
            <>
              <p className="text-[10px] text-muted">
                {activeFill.title} · {activeFill.candidates.length} options ·{" "}
                {activeFill.source}
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {activeFill.candidates.slice(0, 14).map((c, idx) => (
                  <button
                    key={c.url + idx}
                    type="button"
                    disabled={picking}
                    className="relative overflow-hidden rounded-md border border-border disabled:opacity-50"
                    onClick={() =>
                      pickCandidate(activeFill.sceneId, "top", c)
                    }
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (dualScreen)
                        pickCandidate(activeFill.sceneId, "bottom", c);
                    }}
                  >
                    <img
                      src={c.url}
                      alt=""
                      className="aspect-square w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-0.5 text-[8px] text-white">
                      {c.source}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-muted">
                Tap → top{dualScreen ? " · Right-click → bottom" : ""}
              </p>
            </>
          )}
        </div>
      )}

      {text && (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-2 text-[10px] text-muted">
          {text}
        </pre>
      )}

      {report && !lastFills.length && (
        <p className="mt-2 text-[10px] text-muted">{report.summary}</p>
      )}
    </section>
  );
}
