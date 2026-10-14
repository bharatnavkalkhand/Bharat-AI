import { useState } from "react";
import {
  runDirectorAgent,
  formatDirectorReport,
  type DirectorReport,
  type ScreenLayout,
} from "@/agents/director-agent";
import {
  runWebImageAgent,
  type SceneImageFill,
} from "@/agents/web-image-agent";
import type { MotionIntensity } from "@/agents/motion-engine";

export interface DirectorControlsProps {
  dualScreen: boolean;
  onDualScreenChange: (v: boolean) => void;
  facePerformance: boolean;
  onFacePerformanceChange: (v: boolean) => void;
  onMotionHint?: (m: MotionIntensity) => void;
  onStatus?: (msg: string) => void;
  /** Called when agent auto-inserts web images into scenes */
  onApplyImages?: (fills: SceneImageFill[]) => void;
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
  movie,
}: DirectorControlsProps) {
  const [busy, setBusy] = useState(false);
  const [fillBusy, setFillBusy] = useState(false);
  const [text, setText] = useState("");
  const [report, setReport] = useState<DirectorReport | null>(null);
  const [lastFills, setLastFills] = useState<SceneImageFill[]>([]);

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
    onStatus?.(
      movie.language === "hi"
        ? "वेब से emotion/situation इमेज ला रहे हैं…"
        : "Pulling web images by emotion & situation…",
    );
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
      onApplyImages?.(result.fills);
      onStatus?.(result.summary);
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "Web image fill failed");
    } finally {
      setFillBusy(false);
    }
  }

  const disabled = busy || fillBusy || !movie.scenes.length;

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold text-fg">Mind + Web Image Agent</p>

      <label className="flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={facePerformance}
          onChange={(e) => onFacePerformanceChange(e.target.checked)}
        />
        Face performance (lip + expression)
      </label>
      <label className="mt-3 flex items-center gap-2 text-xs font-medium">
        <input
          type="checkbox"
          checked={dualScreen}
          onChange={(e) => onDualScreenChange(e.target.checked)}
        />
        Dual screen (top + bottom panels)
      </label>
      <p className="mt-1 text-[11px] text-muted">
        Uncheck for simple single full-frame screen.
      </p>

      <button
        type="button"
        disabled={disabled}
        className="mt-3 w-full rounded-lg bg-accent py-2.5 text-xs font-semibold text-white disabled:opacity-40"
        onClick={autoFillFromWeb}
      >
        {fillBusy
          ? movie.language === "hi"
            ? "वेब इमेज डाल रहे हैं…"
            : "Inserting web images…"
          : movie.language === "hi"
            ? "वेब से इमेज ऑटो-डालो (emotion + situation)"
            : "Auto-fill scenes from web (emotion + situation)"}
      </button>
      <p className="mt-1 text-[10px] text-muted">
        Free Wikimedia search → agents place images into each scene panel.
      </p>

      <button
        type="button"
        disabled={disabled}
        className="mt-2 w-full rounded-lg border border-accent/40 bg-accent/10 py-2.5 text-xs font-semibold text-accent disabled:opacity-40"
        onClick={runDirector}
      >
        {busy ? "Director Agent…" : "Run Director / Mind Agent (plan only)"}
      </button>

      {lastFills.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] font-medium text-muted">
            Inserted ({lastFills.filter((f) => f.imageTop).length} scenes)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {lastFills.slice(0, 6).map((f) =>
              f.imageTop ? (
                <div key={f.sceneId} className="overflow-hidden rounded-lg border border-border">
                  <img
                    src={f.imageTop}
                    alt=""
                    className="aspect-video w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <p className="truncate px-1 py-0.5 text-[9px] text-muted">
                    {f.mood}
                  </p>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {text && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-2 text-[10px] text-muted">
          {text}
        </pre>
      )}

      {report &&
        report.scenes.some((s) => s.suggestedImageUrls.length > 0) &&
        !lastFills.length && (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] font-medium text-muted">
              Web suggestions (plan)
            </p>
            {report.scenes.slice(0, 4).map((s) =>
              s.suggestedImageUrls[0] ? (
                <div key={s.sceneId} className="flex items-center gap-2">
                  <img
                    src={s.suggestedImageUrls[0]}
                    alt=""
                    className="h-12 w-16 rounded object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="line-clamp-2 text-[10px] text-muted">
                    {s.title}
                  </span>
                </div>
              ) : null,
            )}
          </div>
        )}
    </section>
  );
}
