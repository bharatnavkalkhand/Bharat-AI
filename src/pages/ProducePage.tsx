import { useMemo, useRef, useState } from "react";
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
  Film,
  Download,
  ImagePlus,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import { runMoviePipeline, getAgentCatalog } from "@/agents/orchestrator";
import { stopVoice, type NarrationLine } from "@/agents/voice-agent";
import type { StoryboardFrame } from "@/agents/video-agent";
import type { AgentStageStatus, PipelineState } from "@/agents/types";
import {
  playScenesOnCanvas,
  stopScenePlayer,
  downloadBlob,
  type PlayerScene,
} from "@/agents/scene-player";
import {
  bindScenesForPlayer,
  readImageAsDataUrl,
} from "@/agents/visual-binder";
import type { MotionIntensity } from "@/agents/motion-engine";
import {
  runUpgradeAgent,
  formatUpgradeReport,
} from "@/agents/upgrade-agent";
import { DirectorControls } from "@/components/DirectorControls";
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
  const updateScene = useMovieStore((s) => s.updateScene);

  const movie = useMemo(
    () => movies.find((m) => m.id === movieId) ?? null,
    [movies, movieId],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef({ stopped: false });

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
  const [playingCinema, setPlayingCinema] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cinemaCaption, setCinemaCaption] = useState("");
  const [recordStatus, setRecordStatus] = useState("");
  const [lastExport, setLastExport] = useState<{
    blob: Blob;
    extension: "webm" | "mp4";
    name: string;
  } | null>(null);
  const [workerUrl, setWorkerUrl] = useState(
    () =>
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("bharat_video_worker_url")) ||
      "",
  );
  const [doScript, setDoScript] = useState(true);
  const [doVoice, setDoVoice] = useState(false);
  const [doVideo, setDoVideo] = useState(true);
  const [headline, setHeadline] = useState("");
  const [motionIntensity, setMotionIntensity] =
    useState<MotionIntensity>("medium");
  const [facePerformance, setFacePerformance] = useState(true);
  const [dualScreen, setDualScreen] = useState(true);
  const [upgradeText, setUpgradeText] = useState("");

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

  function buildPlayerScenes(): PlayerScene[] {
    if (!movie) return [];
    if (movie.scenes.length > 0) {
      return bindScenesForPlayer(movie.scenes, movie.characters);
    }
    return storyboard.map((f) => ({
      id: f.sceneId,
      title: f.title,
      mood: f.mood,
      dialogue: f.subtitle,
      visualPrompt: f.visualPrompt,
    }));
  }

  async function onSceneImage(
    sceneId: string,
    slot: "top" | "bottom",
    file: File | null,
  ) {
    if (!file || !movieId) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      updateScene(movieId, sceneId, {
        ...(slot === "top"
          ? { imageTopLocal: dataUrl }
          : { imageBottomLocal: dataUrl }),
      });
      setRecordStatus(`Scene art updated (${slot} panel).`);
    } catch {
      setRecordStatus("Could not read image.");
    }
  }

  async function runPipeline() {
    if (!movieId || !movie) return;
    setRunning(true);
    stopVoice();
    stopScenePlayer();
    stopRef.current.stopped = true;
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
      if (!headline) {
        setHeadline(
          result.script.logline?.slice(0, 80) ||
            (movie.language === "hi"
              ? `${movie.title} — कहानी`
              : `${movie.title} — the story`),
        );
      }
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
    stopScenePlayer();
    stopRef.current.stopped = true;
    setPlayingBoard(false);
    setPlayingCinema(false);
    setExporting(false);
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
      const ms = Math.min(storyboard[i].durationSec, 8) * 1000;
      i += 1;
      window.setTimeout(tick, ms);
    };
    tick();
  }

  async function runCinematic(record: boolean) {
    const canvas = canvasRef.current;
    if (!canvas || !movie) return;
    const playerScenes = buildPlayerScenes();
    if (!playerScenes.length) {
      setRecordStatus("Generate a script / scenes first.");
      return;
    }

    stopRef.current = { stopped: false };
    setPlayingCinema(true);
    setExporting(record);
    setCinemaCaption("");
    setRecordStatus(
      record ? "Recording…" : "Playing…",
    );
    setLastExport(null);

    const hl =
      headline.trim() ||
      (movie.language === "hi" ? `${movie.title}!` : `${movie.title}`);

    const width = record ? 540 : 360;
    const height = record ? 676 : 450;

    try {
      const result = await playScenesOnCanvas(
        canvas,
        playerScenes,
        {
          language: movie.language,
          headline: hl,
          width,
          height,
          record,
          embedAudio: true,
          motionIntensity,
          facePerformance,
          layout: dualScreen ? "dual" : "single",
          onCaption: (t) => setCinemaCaption(t),
          onScene: (i) => setFrameIndex(i),
          onRecordProgress: (msg) => setRecordStatus(msg),
        },
        stopRef.current,
      );

      if (record && result.blob) {
        const safe =
          movie.title.replace(/[^\w\u0900-\u097F]+/g, "_").slice(0, 40) ||
          "bharat_ai_movie";
        const name = `${safe}.${result.extension}`;
        setLastExport({
          blob: result.blob,
          extension: result.extension,
          name,
        });
        setRecordStatus(`Ready: ${name}`);
        downloadBlob(result.blob, name);
      } else if (record) {
        setRecordStatus("Recording failed — try Chrome/Firefox.");
      } else {
        setRecordStatus("Playback finished.");
      }
    } catch (e) {
      setRecordStatus(
        e instanceof Error ? e.message : "Playback/export failed",
      );
    } finally {
      setPlayingCinema(false);
      setExporting(false);
    }
  }

  function redownload() {
    if (!lastExport) return;
    downloadBlob(lastExport.blob, lastExport.name);
  }

  const frame = storyboard[frameIndex];
  const busy = playingCinema || exporting || running;
  const sortedScenes = movie.scenes.slice().sort((a, b) => a.order - b.order);

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
          <p className="text-sm text-muted">{movie.title}</p>
        </div>
      </header>

      <div className="mb-4 flex gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p>
          <strong className="text-fg">Mind + layout:</strong> Director Agent
          plans images, motion & VO. Tick dual screen or single frame.
        </p>
      </div>

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

      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={doScript} onChange={(e) => setDoScript(e.target.checked)} />
          Script
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={doVoice} onChange={(e) => setDoVoice(e.target.checked)} />
          Voice
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={doVideo} onChange={(e) => setDoVideo(e.target.checked)} />
          Video
        </label>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={runPipeline}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {running ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Running…
            </>
          ) : (
            <>
              <Bot className="h-4 w-4" /> Run production pipeline
            </>
          )}
        </button>
        <button type="button" onClick={stopAll} className="rounded-xl border border-border px-4 text-muted" aria-label="Stop">
          <Square className="h-4 w-4" />
        </button>
      </div>

      {sortedScenes.length > 0 && (
        <section className="mb-6 space-y-2">
          <h2 className="text-sm font-medium">
            Scene art {dualScreen ? "(dual)" : "(single — top)"}
          </h2>
          <ul className="space-y-2">
            {sortedScenes.slice(0, 8).map((sc, idx) => (
              <li key={sc.id} className="rounded-xl border border-border bg-card p-3">
                <p className="mb-2 text-xs font-medium">
                  {idx + 1}. {sc.title}{" "}
                  <span className="text-muted">({sc.mood})</span>
                </p>
                <div className="flex gap-2">
                  {(["top", "bottom"] as const)
                    .filter((slot) => dualScreen || slot === "top")
                    .map((slot) => {
                    const src =
                      slot === "top" ? sc.imageTopLocal : sc.imageBottomLocal;
                    return (
                      <div key={slot} className="flex-1">
                        <div className="mb-1 aspect-video overflow-hidden rounded-lg border border-border bg-bg">
                          {src ? (
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-muted">
                              {slot}
                            </div>
                          )}
                        </div>
                        <label className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-border py-1.5 text-[10px] text-accent">
                          <ImagePlus className="h-3 w-3" /> {slot}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              onSceneImage(sc.id, slot, e.target.files?.[0] ?? null)
                            }
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-4 rounded-xl border border-border bg-card p-3">
        <p className="mb-2 text-xs font-medium">Motion intensity</p>
        <div className="flex gap-2">
          {(["low", "medium", "high"] as MotionIntensity[]).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setMotionIntensity(level)}
              className={cn(
                "flex-1 rounded-lg border py-2 text-xs font-medium capitalize",
                motionIntensity === level
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted",
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      <DirectorControls
        dualScreen={dualScreen}
        onDualScreenChange={setDualScreen}
        facePerformance={facePerformance}
        onFacePerformanceChange={setFacePerformance}
        onMotionHint={setMotionIntensity}
        onStatus={setRecordStatus}
        movie={{
          title: movie.title,
          language: movie.language,
          scenes: movie.scenes.map((s) => ({
            id: s.id,
            order: s.order,
            title: s.title,
            mood: s.mood,
            dialogue: s.dialogue,
            narration: s.narration,
            visualPrompt: s.visualPrompt,
            gestureNotes: s.gestureNotes,
          })),
        }}
      />

      <section className="mb-4 rounded-xl border border-border bg-card p-3">
        <button
          type="button"
          className="w-full rounded-lg border border-border py-2 text-xs font-medium text-accent"
          onClick={() => setUpgradeText(formatUpgradeReport(runUpgradeAgent()))}
        >
          Run Upgrade Agent (public gaps)
        </button>
        {upgradeText && (
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-2 text-[10px] text-muted">
            {upgradeText}
          </pre>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-medium text-muted">
            Cinematic · {dualScreen ? "dual" : "single"} · face · motion
          </p>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder={movie.language === "hi" ? "शीर्षक कैप्शन" : "Headline caption"}
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex justify-center bg-black py-2">
          <canvas
            ref={canvasRef}
            width={360}
            height={450}
            className="max-w-full rounded-lg"
            style={{
              width: "min(360px, 100%)",
              height: "auto",
              aspectRatio: "360/450",
            }}
          />
        </div>
        {cinemaCaption && (
          <p className="border-t border-border px-3 py-2 text-center text-xs text-muted">
            {cinemaCaption}
          </p>
        )}
        {recordStatus && (
          <p className="border-t border-border px-3 py-2 text-center text-xs text-accent">
            {recordStatus}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
          <button
            type="button"
            disabled={busy || (!movie.scenes.length && !storyboard.length)}
            onClick={() => runCinematic(false)}
            className="flex items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-2 text-xs font-medium text-accent disabled:opacity-40"
          >
            <Film className="h-3.5 w-3.5" /> Play
          </button>
          <button
            type="button"
            disabled={busy || (!movie.scenes.length && !storyboard.length)}
            onClick={() => runCinematic(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {exporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" /> Export WebM/MP4
              </>
            )}
          </button>
          {lastExport && (
            <button
              type="button"
              onClick={redownload}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted"
            >
              <Download className="h-3.5 w-3.5" /> Re-download
            </button>
          )}
          <button
            type="button"
            disabled={!storyboard.length || playingBoard || busy}
            onClick={playStoryboard}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5" /> Storyboard
          </button>
        </div>
      </section>

      {frame && (
        <div className="mb-4 rounded-xl border border-border bg-card p-3 text-xs text-muted">
          Active frame: {frame.title} · {frame.mood}
        </div>
      )}

      <section className="mb-6 rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-1 text-sm font-medium">AI motion / lip-sync worker (optional)</h2>
        <p className="mb-2 text-xs text-muted">
          Photoreal lips: self-host MuseTalk / Wav2Lip. POST /generate
        </p>
        <input
          value={workerUrl}
          onChange={(e) => setWorkerUrl(e.target.value)}
          placeholder="https://your-free-gpu-worker.example.com"
          className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">
          Agents
        </h2>
        <ul className="space-y-2">
          {catalog.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{a.name}</p>
                <span className="text-[10px] text-muted">Q{a.qualityScore}/5</span>
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
