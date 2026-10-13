import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Volume2,
  Clapperboard,
  Play,
  Square,
  Bot,
  Loader2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import { runMoviePipeline, getAgentCatalog } from "@/agents/orchestrator";
import { stopVoice, type NarrationLine } from "@/agents/voice-agent";
import type { StoryboardFrame } from "@/agents/video-agent";
import type { AgentStageStatus, PipelineState } from "@/agents/types";
import { cn } from "@/lib/utils";

function StagePill({ status }: { status: AgentStageStatus }) {
  const colors: Record<AgentStageStatus, string> = {
    idle: "bg-border text-muted",
    queued: "bg-border text-muted",
    running: "bg-amber-500/20 text-amber-400",
    succeeded: "bg-emerald-500/20 text-emerald-400",
    failed: "bg-red-500/20 text-red-400",
    skipped: "bg-border text-muted",
    needs_upgrade: "bg-sky-500/20 text-sky-400",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
        colors[status],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function ProducePage() {
  const { movieId } = useParams<{ movieId: string }>();
  const movies = useMovieStore((s) => s.movies);
  const applyScriptResult = useMovieStore((s) => s.applyScriptResult);

  const movie = useMemo(
    () => movies.find((m) => m.id === movieId) ?? null,
    [movies, movieId],
  );

  const [pipeline, setPipeline] = useState<PipelineState>({
    script: "idle",
    voice: "idle",
    video: "idle",
    lastMessage: "Ready to produce",
    updatedAt: new Date().toISOString(),
  });
  const [running, setRunning] = useState(false);
  const [currentLine, setCurrentLine] = useState<NarrationLine | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playingBoard, setPlayingBoard] = useState(false);
  const [workerUrl, setWorkerUrl] = useState(
    () =>
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("bharat_video_worker_url")) ||
      "",
  );
  const [doScript, setDoScript] = useState(true);
  const [doVoice, setDoVoice] = useState(true);
  const [doVideo, setDoVideo] = useState(true);

  const catalog = getAgentCatalog();

  if (!movie) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted">Movie not found</p>
        <Link to="/" className="mt-4 inline-block text-accent">
          Back home
        </Link>
      </main>
    );
  }

  async function runPipeline() {
    if (!movieId || !movie) return;
    setRunning(true);
    stopVoice();
    setCurrentLine(null);

    if (workerUrl) {
      localStorage.setItem("bharat_video_worker_url", workerUrl.trim());
    }

    const result = await runMoviePipeline(
      {
        movieId,
        title: movie.title,
        synopsis: movie.synopsis || "",
        language: movie.language,
        targetDuration: movie.targetDuration,
        genres: movie.genres || [],
        scenes: movie.scenes.map((s) => ({
          id: s.id,
          order: s.order,
          title: s.title,
          mood: s.mood,
          dialogue: s.dialogue,
          narration: s.narration,
          gestureNotes: s.gestureNotes,
          visualPrompt: s.visualPrompt,
        })),
        characters: movie.characters.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
        })),
        options: {
          useCloudLlm: true,
          workerUrl: workerUrl.trim() || undefined,
        },
      },
      { script: doScript, voice: doVoice, video: doVideo },
      {
        onStage: (stage, status, msg) => {
          setPipeline((p) => ({
            ...p,
            [stage]: status,
            lastMessage: msg,
            updatedAt: new Date().toISOString(),
          }));
        },
        onNarrationLine: (line) => setCurrentLine(line),
      },
    );

    setPipeline(result.pipeline);
    if (result.script) {
      applyScriptResult(movieId, result.script, {
        replaceCast: true,
        replaceScenes: true,
      });
    }
    if (result.storyboard?.length) {
      setStoryboard(result.storyboard);
      setFrameIndex(0);
    }
    setRunning(false);
    setCurrentLine(null);
  }

  function stopAll() {
    stopVoice();
    setPlayingBoard(false);
    setRunning(false);
    setCurrentLine(null);
  }

  function playStoryboard() {
    if (!storyboard.length) return;
    setPlayingBoard(true);
    setFrameIndex(0);
    let i = 0;
    const tick = () => {
      if (i >= storyboard.length) {
        setPlayingBoard(false);
        return;
      }
      setFrameIndex(i);
      const ms = Math.min(storyboard[i].durationSec, 12) * 1000;
      i += 1;
      window.setTimeout(tick, ms);
    };
    tick();
  }

  const frame = storyboard[frameIndex];

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6 sm:max-w-2xl">
      <header className="mb-6 flex items-start gap-3">
        <Link
          to={`/movie/${movie.id}`}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:bg-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">Produce Movie</h1>
          <p className="text-sm text-muted">{movie.title} · Agent pipeline</p>
        </div>
      </header>

      <div className="mb-4 flex gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p>
          Honest status: ~pipeline foundation. Free script + browser narration +
          storyboard preview work now. Full avatar MP4 needs a free open-source
          GPU worker you control — connect it below when ready.
        </p>
      </div>

      {/* Agent stages */}
      <section className="mb-4 space-y-2">
        {(
          [
            { key: "script" as const, label: "1. Script Agent", icon: Sparkles },
            { key: "voice" as const, label: "2. Voice Agent", icon: Volume2 },
            { key: "video" as const, label: "3. Video Agent", icon: Clapperboard },
          ] as const
        ).map((s) => (
          <div
            key={s.key}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <div className="flex items-center gap-2 text-sm">
              <s.icon className="h-4 w-4 text-accent" />
              {s.label}
            </div>
            <StagePill status={pipeline[s.key]} />
          </div>
        ))}
        <p className="px-1 text-xs text-muted">{pipeline.lastMessage}</p>
      </section>

      {/* Stage toggles */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={doScript}
            onChange={(e) => setDoScript(e.target.checked)}
          />
          Script
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={doVoice}
            onChange={(e) => setDoVoice(e.target.checked)}
          />
          Voice
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={doVideo}
            onChange={(e) => setDoVideo(e.target.checked)}
          />
          Video
        </label>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          disabled={running}
          onClick={runPipeline}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Running agents…
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" /> Run production pipeline
            </>
          )}
        </button>
        <button
          type="button"
          onClick={stopAll}
          className="rounded-xl border border-border px-4 text-muted"
          aria-label="Stop"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>

      {currentLine && (
        <div className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
          <p className="text-xs text-accent">{currentLine.sceneTitle}</p>
          <p className="font-medium">{currentLine.speaker}</p>
          <p className="mt-1 text-muted">{currentLine.text}</p>
        </div>
      )}

      {/* Storyboard player */}
      <section className="mb-6 rounded-2xl border border-border bg-card overflow-hidden">
        <div
          className="relative flex aspect-video items-end p-4"
          style={{
            background: frame?.backdrop || "linear-gradient(135deg,#1e293b,#0f172a)",
          }}
        >
          <div className="w-full rounded-lg bg-black/50 p-3 backdrop-blur-sm">
            <p className="text-xs text-white/70">
              {frame
                ? `Scene ${frameIndex + 1}/${storyboard.length} · ${frame.mood}`
                : "Storyboard preview"}
            </p>
            <p className="font-medium text-white">
              {frame?.title || "Run Video Agent to build frames"}
            </p>
            {frame?.subtitle && (
              <p className="mt-1 text-sm text-white/80">{frame.subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-border p-3">
          <button
            type="button"
            disabled={!storyboard.length || playingBoard}
            onClick={playStoryboard}
            className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-2 text-xs font-medium text-accent disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" /> Play storyboard
          </button>
          <span className="text-xs text-muted">
            {storyboard.length
              ? `${storyboard.length} frames (preview — not final MP4)`
              : "No frames yet"}
          </span>
        </div>
      </section>

      {/* Worker upgrade */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-medium">Video worker (optional upgrade)</h2>
        <p className="mb-3 text-xs text-muted">
          Point to your free self-hosted open-source worker (ComfyUI API, custom
          FastAPI, etc.). Leave empty for storyboard-only mode.
        </p>
        <input
          value={workerUrl}
          onChange={(e) => setWorkerUrl(e.target.value)}
          placeholder="https://your-free-gpu-worker.example.com"
          className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </section>

      {/* Agent catalog */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">
          Agents & upgrade path
        </h2>
        <ul className="space-y-2">
          {catalog.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{a.name}</p>
                <span className="text-[10px] text-muted">
                  Q{a.qualityScore}/5 · {a.freeNow ? "free now" : "needs setup"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">{a.description}</p>
              <p className="mt-2 flex items-start gap-1 text-xs text-accent">
                <ChevronRight className="mt-0.5 h-3 w-3 shrink-0" />
                {a.upgradePath}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
