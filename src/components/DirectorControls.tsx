import { useState } from "react";
import {
  runDirectorAgent,
  formatDirectorReport,
  type DirectorReport,
  type ScreenLayout,
} from "@/agents/director-agent";
import type { MotionIntensity } from "@/agents/motion-engine";

export interface DirectorControlsProps {
  dualScreen: boolean;
  onDualScreenChange: (v: boolean) => void;
  facePerformance: boolean;
  onFacePerformanceChange: (v: boolean) => void;
  onMotionHint?: (m: MotionIntensity) => void;
  onStatus?: (msg: string) => void;
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
  movie,
}: DirectorControlsProps) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [report, setReport] = useState<DirectorReport | null>(null);

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

  return (
    <section className="mb-4 rounded-xl border border-border bg-card p-3">
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
        disabled={busy || !movie.scenes.length}
        className="mt-3 w-full rounded-lg border border-accent/40 bg-accent/10 py-2.5 text-xs font-semibold text-accent disabled:opacity-40"
        onClick={runDirector}
      >
        {busy ? "Director Agent…" : "Run Director / Mind Agent"}
      </button>
      <p className="mt-1 text-[10px] text-muted">
        Plans images (Wikimedia), motion & polished voice-over per scene.
      </p>

      {text && (
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-2 text-[10px] text-muted">
          {text}
        </pre>
      )}

      {report &&
        report.scenes.some((s) => s.suggestedImageUrls.length > 0) && (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] font-medium text-muted">
              Web image suggestions (Commons)
            </p>
            {report.scenes.slice(0, 5).map((s) =>
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
