import {
  CheckCircle2,
  Circle,
  ImageIcon,
  Loader2,
  Lock,
  Mic,
  Film,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Per-scene generation phase — mirrors ReelShorts / IdeaShorts flow */
export type ScenePhase =
  | "pending"
  | "queued"
  | "voice"
  | "image"
  | "stitch"
  | "done"
  | "failed";

export interface SceneProgressItem {
  id: string;
  order: number;
  title: string;
  mood?: string;
  phase: ScenePhase;
  /** Optional thumbnail (data URL or remote) */
  thumb?: string;
  /** Short status line under the title */
  detail?: string;
  locked?: boolean;
}

export type OverallPhase =
  | "idle"
  | "story"
  | "scenes"
  | "stitching"
  | "ready"
  | "failed";

export interface SceneProgressPanelProps {
  language?: "en" | "hi";
  overallPhase: OverallPhase;
  /** 0–100 */
  percent: number;
  headline?: string;
  scenes: SceneProgressItem[];
  activeSceneIndex?: number;
  className?: string;
  onEditScene?: (sceneId: string) => void;
  onToggleLock?: (sceneId: string) => void;
}

const PHASE_LABEL: Record<
  ScenePhase,
  { en: string; hi: string; color: string }
> = {
  pending: { en: "Waiting", hi: "प्रतीक्षा", color: "text-muted" },
  queued: { en: "Queued", hi: "कतार में", color: "text-muted" },
  voice: { en: "Creating voice", hi: "आवाज़ बन रही है", color: "text-amber-400" },
  image: { en: "Creating image", hi: "चित्र बन रहा है", color: "text-sky-400" },
  stitch: { en: "Stitching", hi: "जोड़ रहा है", color: "text-violet-400" },
  done: { en: "Ready", hi: "तैयार", color: "text-emerald-400" },
  failed: { en: "Failed", hi: "विफल", color: "text-red-400" },
};

function overallCopy(
  phase: OverallPhase,
  percent: number,
  lang: "en" | "hi",
  activeLabel?: string,
): string {
  if (lang === "hi") {
    switch (phase) {
      case "idle":
        return "उत्पादन शुरू करने के लिए तैयार";
      case "story":
        return "कहानी / स्क्रिप्ट तैयार हो रही है…";
      case "scenes":
        return activeLabel
          ? activeLabel
          : `सीन तैयार हो रहे हैं… ${Math.round(percent)}%`;
      case "stitching":
        return `सीन जोड़े जा रहे हैं… ${Math.round(percent)}%`;
      case "ready":
        return "वीडियो तैयार है";
      case "failed":
        return "उत्पादन विफल — फिर से कोशिश करें";
    }
  }
  switch (phase) {
    case "idle":
      return "Ready to start production";
    case "story":
      return "Generating story / script…";
    case "scenes":
      return activeLabel
        ? activeLabel
        : `Creating scenes… ${Math.round(percent)}%`;
    case "stitching":
      return `Stitching scenes… ${Math.round(percent)}%`;
    case "ready":
      return "VIDEO READY";
    case "failed":
      return "Production failed — try again";
  }
}

function PhaseIcon({ phase }: { phase: ScenePhase }) {
  if (phase === "done")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (phase === "failed")
    return <AlertCircle className="h-4 w-4 text-red-400" />;
  if (phase === "voice")
    return <Mic className="h-4 w-4 animate-pulse text-amber-400" />;
  if (phase === "image")
    return <ImageIcon className="h-4 w-4 animate-pulse text-sky-400" />;
  if (phase === "stitch")
    return <Film className="h-4 w-4 animate-pulse text-violet-400" />;
  if (phase === "queued")
    return <Loader2 className="h-4 w-4 animate-spin text-muted" />;
  return <Circle className="h-4 w-4 text-muted/50" />;
}

export function SceneProgressPanel({
  language = "en",
  overallPhase,
  percent,
  headline,
  scenes,
  activeSceneIndex,
  className,
  onEditScene,
  onToggleLock,
}: SceneProgressPanelProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const sorted = scenes.slice().sort((a, b) => a.order - b.order);
  const doneCount = sorted.filter((s) => s.phase === "done").length;
  const total = sorted.length;

  let activeLabel: string | undefined;
  if (
    typeof activeSceneIndex === "number" &&
    activeSceneIndex >= 0 &&
    activeSceneIndex < sorted.length
  ) {
    const sc = sorted[activeSceneIndex];
    const pl = PHASE_LABEL[sc.phase];
    const phaseText = language === "hi" ? pl.hi : pl.en;
    activeLabel =
      language === "hi"
        ? `सीन ${activeSceneIndex + 1} — ${phaseText}`
        : `Scene ${activeSceneIndex + 1} — ${phaseText}`;
  } else if (overallPhase === "stitching" && total > 0) {
    activeLabel =
      language === "hi"
        ? `सीन जोड़ रहे हैं ${doneCount}/${total}`
        : `Stitching scenes ${doneCount}/${total}`;
  }

  const statusLine = overallCopy(overallPhase, clamped, language, activeLabel);
  const isLive =
    overallPhase === "story" ||
    overallPhase === "scenes" ||
    overallPhase === "stitching";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      {/* Header + progress */}
      <div className="border-b border-border px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              {language === "hi" ? "सीन प्रगति" : "Scene progress"}
            </p>
            {headline && (
              <p className="truncate text-sm font-medium text-fg">{headline}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "text-lg font-bold tabular-nums",
                overallPhase === "ready"
                  ? "text-emerald-400"
                  : overallPhase === "failed"
                    ? "text-red-400"
                    : "text-accent",
              )}
            >
              {Math.round(clamped)}%
            </p>
            {total > 0 && (
              <p className="text-[10px] text-muted">
                {doneCount}/{total}{" "}
                {language === "hi" ? "सीन" : "scenes"}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 overflow-hidden rounded-full bg-bg">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              overallPhase === "ready"
                ? "bg-emerald-500"
                : overallPhase === "failed"
                  ? "bg-red-500"
                  : "bg-gradient-to-r from-accent to-amber-400",
            )}
            style={{ width: `${clamped}%` }}
          />
        </div>

        <p
          className={cn(
            "mt-2 flex items-center gap-1.5 text-xs",
            overallPhase === "ready"
              ? "font-semibold text-emerald-400"
              : overallPhase === "failed"
                ? "text-red-400"
                : "text-muted",
          )}
        >
          {isLive && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
          {overallPhase === "ready" && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {statusLine}
        </p>
      </div>

      {/* Scene list */}
      {sorted.length > 0 ? (
        <ul className="max-h-80 divide-y divide-border overflow-y-auto">
          {sorted.map((sc, idx) => {
            const pl = PHASE_LABEL[sc.phase];
            const phaseText = language === "hi" ? pl.hi : pl.en;
            const isActive = activeSceneIndex === idx && isLive;
            return (
              <li
                key={sc.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 transition",
                  isActive && "bg-accent/5",
                )}
              >
                {/* Thumb */}
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-bg">
                  {sc.thumb ? (
                    <img
                      src={sc.thumb}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted">
                      {idx + 1}
                    </div>
                  )}
                  {sc.phase === "done" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                  )}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-medium text-fg">
                      {idx + 1}. {sc.title}
                    </p>
                    {sc.locked && (
                      <Lock className="h-3 w-3 shrink-0 text-muted" />
                    )}
                  </div>
                  <p className={cn("text-[10px]", pl.color)}>
                    {phaseText}
                    {sc.detail ? ` · ${sc.detail}` : ""}
                    {sc.mood ? ` · ${sc.mood}` : ""}
                  </p>
                </div>

                {/* Status + actions */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <PhaseIcon phase={sc.phase} />
                  {onEditScene && (
                    <button
                      type="button"
                      onClick={() => onEditScene(sc.id)}
                      className="rounded-md p-1 text-muted transition hover:bg-bg hover:text-fg"
                      aria-label="Edit scene"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {onToggleLock && (
                    <button
                      type="button"
                      onClick={() => onToggleLock(sc.id)}
                      className="rounded-md p-1 text-muted transition hover:bg-bg hover:text-fg"
                      aria-label={sc.locked ? "Unlock" : "Lock"}
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-8 text-center text-xs text-muted">
          {language === "hi"
            ? "अभी कोई सीन नहीं — पहले स्क्रिप्ट बनाएँ"
            : "No scenes yet — generate a script first"}
        </div>
      )}

      {overallPhase === "ready" && (
        <div className="border-t border-border bg-emerald-500/10 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-400">
            {language === "hi" ? "✓ वीडियो तैयार" : "✓ VIDEO READY"}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">
            {language === "hi"
              ? "नीचे Play / Export करें"
              : "Use Play / Export below"}
          </p>
        </div>
      )}
    </section>
  );
}

/** Helper: build initial progress list from movie scenes */
export function scenesToProgressItems(
  scenes: Array<{
    id: string;
    order: number;
    title: string;
    mood?: string;
    imageTopLocal?: string;
    externalImageLocal?: string;
    status?: string;
  }>,
): SceneProgressItem[] {
  return scenes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: s.id,
      order: s.order,
      title: s.title,
      mood: s.mood,
      thumb: s.externalImageLocal || s.imageTopLocal,
      phase:
        s.status === "completed"
          ? ("done" as const)
          : s.status === "failed"
            ? ("failed" as const)
            : s.status === "generating"
              ? ("image" as const)
              : ("pending" as const),
    }));
}
