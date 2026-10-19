import { useEffect, useMemo, useRef, useState } from "react";
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
  AlertCircle,
  Download,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import { runMoviePipeline } from "@/agents/orchestrator";
import { stopVoice } from "@/agents/voice-agent";
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
  readAudioAsDataUrl,
} from "@/agents/visual-binder";
import type { MotionIntensity } from "@/agents/motion-engine";
import { DirectorControls } from "@/components/DirectorControls";
import { ExternalStudioPanel } from "@/components/ExternalStudioPanel";
import {
  SceneProgressPanel,
  scenesToProgressItems,
  type OverallPhase,
  type SceneProgressItem,
  type ScenePhase,
} from "@/components/SceneProgressPanel";
import { runWebImageAgent } from "@/agents/web-image-agent";
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
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", colors[status])}>
      {status.replace("_", " ")}
    </span>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ProducePage() {
  const { movieId } = useParams<{ movieId: string }>();
  const movies = useMovieStore((s) => s.movies);
  const applyScriptResult = useMovieStore((s) => s.applyScriptResult);
  const updateScene = useMovieStore((s) => s.updateScene);
  const movie = useMemo(() => movies.find((m) => m.id === movieId) ?? null, [movies, movieId]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef({ stopped: false });
  const [pipeline, setPipeline] = useState<PipelineState>({
    script: "idle", voice: "idle", video: "idle",
    lastMessage: "Ready to produce", updatedAt: new Date().toISOString(),
  });
  const [running, setRunning] = useState(false);
  const [storyboard, setStoryboard] = useState<StoryboardFrame[]>([]);
  const [, setFrameIndex] = useState(0);
  const [playingCinema, setPlayingCinema] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cinemaCaption, setCinemaCaption] = useState("");
  const [recordStatus, setRecordStatus] = useState("");
  const [lastExport, setLastExport] = useState<{ blob: Blob; extension: "webm" | "mp4"; name: string } | null>(null);
  const [workerUrl] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("bharat_video_worker_url")) || "",
  );
  const [doScript] = useState(true);
  const [doVoice] = useState(true);
  const [voiceGender] = useState<"auto" | "male" | "female">("auto");
  const [doVideo] = useState(true);
  const [headline, setHeadline] = useState("");
  const [motionIntensity, setMotionIntensity] = useState<MotionIntensity>("high");
  const [facePerformance, setFacePerformance] = useState(true);
  const [dualScreen, setDualScreen] = useState(false);
  const [use3dAvatar, setUse3dAvatar] = useState(false);

  const [overallPhase, setOverallPhase] = useState<OverallPhase>("idle");
  const [progressPercent, setProgressPercent] = useState(0);
  const [sceneProgress, setSceneProgress] = useState<SceneProgressItem[]>([]);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (!movie || running || playingCinema || exporting) return;
    if (overallPhase === "ready" || overallPhase === "scenes" || overallPhase === "stitching") return;
    setSceneProgress(scenesToProgressItems(movie.scenes));
  }, [movie?.scenes, movie?.id]);

  if (!movie) {
    return (
      <main className="page-shell mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted">Movie not found</p>
        <Link to="/" className="mt-4 inline-block text-accent">Back home</Link>
      </main>
    );
  }

  function patchScenePhase(index: number, phase: ScenePhase, detail?: string) {
    setSceneProgress((prev) =>
      prev.map((s, i) => (i === index ? { ...s, phase, detail: detail ?? s.detail } : s)),
    );
    setActiveSceneIndex(index);
  }

  function buildPlayerScenes(): PlayerScene[] {
    if (!movie) return [];
    if (movie.scenes.length > 0) return bindScenesForPlayer(movie.scenes, movie.characters);
    return storyboard.map((f) => ({
      id: f.sceneId, title: f.title, mood: f.mood, dialogue: f.subtitle, visualPrompt: f.visualPrompt,
    }));
  }

  async function runPipeline() {
    if (!movieId || !movie) return;
    setRunning(true);
    stopVoice();
    stopScenePlayer();
    stopRef.current.stopped = true;
    setLastExport(null);
    setOverallPhase("story");
    setProgressPercent(4);
    setActiveSceneIndex(undefined);
    const seed = scenesToProgressItems(movie.scenes).map((s) => ({ ...s, phase: "queued" as ScenePhase }));
    setSceneProgress(
      seed.length
        ? seed
        : [{ id: "tmp-0", order: 0, title: movie.language === "hi" ? "स्क्रिप्ट तैयार हो रही है" : "Generating script", phase: "queued" }],
    );
    if (workerUrl) localStorage.setItem("bharat_video_worker_url", workerUrl.trim());

    const result = await runMoviePipeline(
      {
        movieId,
        title: movie.title,
        synopsis: movie.synopsis || "",
        language: movie.language,
        targetDuration: movie.targetDuration,
        genres: movie.genres || [],
        scenes: movie.scenes.map((s) => ({
          id: s.id, order: s.order, title: s.title, mood: s.mood, dialogue: s.dialogue,
          narration: s.narration, gestureNotes: s.gestureNotes, visualPrompt: s.visualPrompt,
          characterIds: s.characterIds,
        })),
        characters: movie.characters.map((c) => ({ id: c.id, name: c.name, role: c.role, appearance: c.appearance })),
        options: { useCloudLlm: true, workerUrl: workerUrl.trim() || undefined, voiceGender },
      },
      { script: doScript, voice: doVoice, video: doVideo },
      {
        onStage: (stage, status, msg) => {
          setPipeline((p) => ({ ...p, [stage]: status, lastMessage: msg, updatedAt: new Date().toISOString() }));
          if (stage === "script" && status === "running") {
            setOverallPhase("story");
            setProgressPercent(10);
          }
          if (stage === "voice" && status === "running") {
            setOverallPhase("scenes");
            setProgressPercent((p) => Math.max(p, 25));
          }
          if (stage === "video" && status === "running") {
            setOverallPhase("scenes");
            setProgressPercent((p) => Math.max(p, 40));
          }
        },
        onNarrationLine: () => undefined,
      },
    );
    setPipeline(result.pipeline);

    if (result.script) {
      applyScriptResult(movieId, result.script, { replaceCast: true, replaceScenes: true });
      setProgressPercent(35);
      setOverallPhase("scenes");

      const afterScript = useMovieStore.getState().movies.find((m) => m.id === movieId);
      const freshScenes = (afterScript?.scenes || []).slice().sort((a, b) => a.order - b.order);
      setSceneProgress(
        freshScenes.map((s) => ({
          id: s.id, order: s.order, title: s.title, mood: s.mood, phase: "queued" as ScenePhase,
        })),
      );

      try {
        setRecordStatus(
          movie.language === "hi" ? "Character Mind photos जोड़ रहा है…" : "Character Mind selecting photos…",
        );
        const n = Math.max(freshScenes.length, 1);
        for (let i = 0; i < freshScenes.length; i++) {
          if (stopRef.current.stopped) break;
          patchScenePhase(i, doVoice ? "voice" : "image");
          setProgressPercent(35 + Math.round((i / n) * 40));
          await sleep(180);
          if (doVoice) {
            patchScenePhase(i, "image");
            await sleep(120);
          }
        }

        const afterCast = useMovieStore.getState().movies.find((m) => m.id === movieId);
        const fills = await runWebImageAgent({
          title: result.script.title || movie.title,
          language: movie.language,
          layout: dualScreen ? "dual" : "single",
          scenes: result.script.scenes.map((sc, order) => ({
            id: `tmp-${order}`,
            order,
            title: sc.title,
            mood: sc.mood,
            dialogue: sc.dialogue,
            narration: sc.narration,
            visualPrompt: sc.visualPrompt,
            gestureNotes: sc.gestureNotes,
          })),
          characters: (afterCast?.characters || []).map((c) => ({
            id: c.id,
            name: c.name,
            role: c.role,
            appearance: c.appearance,
            referenceImageLocal: c.referenceImageLocal,
            referenceImageUrl: c.referenceImageUrl,
          })),
          onProgress: (msg) => setRecordStatus(msg),
        });

        const updated = useMovieStore.getState().movies.find((m) => m.id === movieId);
        const sorted = (updated?.scenes || []).slice().sort((a, b) => a.order - b.order);
        fills.fills.forEach((f, i) => {
          const sc = sorted[i];
          if (!sc) return;
          const patch: { imageTopLocal?: string; imageBottomLocal?: string } = {};
          if (f.imageTop) patch.imageTopLocal = f.imageTop;
          if (f.imageBottom) patch.imageBottomLocal = f.imageBottom;
          if (patch.imageTopLocal || patch.imageBottomLocal) updateScene(movieId, sc.id, patch);
        });

        setSceneProgress((prev) =>
          prev.map((s, i) => ({
            ...s,
            phase: "done" as ScenePhase,
            thumb: fills.fills[i]?.imageTop || s.thumb,
            detail: fills.fills[i]?.primaryCharacter || fills.fills[i]?.source || s.detail,
          })),
        );
        setRecordStatus(fills.summary);
      } catch {
        setRecordStatus(
          movie.language === "hi" ? "Auto-art partial — B button try करें" : "Auto-art partial — try B button",
        );
        setSceneProgress((prev) => prev.map((s) => ({ ...s, phase: "done" as ScenePhase })));
      }

      if (!headline) setHeadline(result.script.logline?.slice(0, 80) || movie.title);
    }

    if (result.storyboard?.length) {
      setStoryboard(result.storyboard);
      setFrameIndex(0);
    }

    setOverallPhase("stitching");
    setProgressPercent(88);
    setActiveSceneIndex(undefined);
    await sleep(400);
    setProgressPercent(100);
    setOverallPhase("ready");
    setRunning(false);
  }

  function stopAll() {
    stopVoice();
    stopScenePlayer();
    stopRef.current.stopped = true;
    setPlayingCinema(false);
    setExporting(false);
    setRunning(false);
    if (overallPhase !== "ready") {
      setOverallPhase("idle");
      setProgressPercent(0);
      setActiveSceneIndex(undefined);
    }
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
    setRecordStatus(record ? "Recording…" : "Playing…");
    setLastExport(null);
    setOverallPhase("stitching");
    setProgressPercent(5);
    if (sceneProgress.length === 0) setSceneProgress(scenesToProgressItems(movie.scenes));

    const hl = headline.trim() || movie.title;

    try {
      const result = await playScenesOnCanvas(
        canvas,
        playerScenes,
        {
          language: movie.language,
          headline: hl,
          width: record ? 540 : 360,
          height: record ? 676 : 450,
          record,
          embedAudio: true,
          voiceGender,
          motionIntensity,
          facePerformance: facePerformance || use3dAvatar,
          layout: dualScreen ? "dual" : "single",
          use3dAvatar,
          bodyPerformance: false,
          onCaption: (cap) => setCinemaCaption(cap),
          onScene: (i) => {
            setFrameIndex(i);
            setActiveSceneIndex(i);
            patchScenePhase(i, "stitch");
            const n = Math.max(playerScenes.length, 1);
            setProgressPercent(Math.min(95, Math.round(((i + 1) / n) * 90)));
          },
          onRecordProgress: (msg) => setRecordStatus(msg),
        },
        stopRef.current,
      );
      if (record && result.blob) {
        const safe = movie.title.replace(/[^\w\u0900-\u097F]+/g, "_").slice(0, 40) || "bharat_ai_movie";
        const name = `${safe}.${result.extension}`;
        setLastExport({ blob: result.blob, extension: result.extension, name });
        setRecordStatus(`Ready: ${name}`);
        downloadBlob(result.blob, name);
      } else if (record) {
        setRecordStatus("Recording failed — try Chrome/Firefox.");
      } else {
        setRecordStatus("Playback finished.");
      }
      setSceneProgress((prev) => prev.map((s) => ({ ...s, phase: "done" as ScenePhase })));
      setProgressPercent(100);
      setOverallPhase("ready");
      setActiveSceneIndex(undefined);
    } catch (e) {
      setRecordStatus(e instanceof Error ? e.message : "Playback/export failed");
      setOverallPhase("failed");
    } finally {
      setPlayingCinema(false);
      setExporting(false);
    }
  }

  function redownload() {
    if (!lastExport) return;
    downloadBlob(lastExport.blob, lastExport.name);
  }

  async function onSceneAudioFile(sceneId: string, file: File | null) {
    if (!movieId || !file || !movie) return;
    try {
      const dataUrl = await readAudioAsDataUrl(file);
      updateScene(movieId, sceneId, { audioLocal: dataUrl });
      setRecordStatus(
        movie.language === "hi"
          ? `Audio scene par lag gaya (${file.name})`
          : `Audio attached (${file.name})`,
      );
    } catch (e) {
      setRecordStatus(e instanceof Error ? e.message : "Audio import failed");
    }
  }

  function clearSceneAudio(sceneId: string) {
    if (!movieId) return;
    updateScene(movieId, sceneId, { audioLocal: undefined });
  }

  const busy = playingCinema || exporting || running;
  const sortedScenes = movie.scenes.slice().sort((a, b) => a.order - b.order);

  return (
    <main className="page-shell mx-auto min-h-dvh max-w-lg px-4 pb-28 pt-6 sm:max-w-2xl">
      <header className="mb-6 flex items-start gap-3">
        <Link
          to={`/movie/${movie.id}`}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted transition hover:border-accent/40 hover:text-fg"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">Produce Movie</h1>
          <p className="text-sm text-muted">{movie.title}</p>
        </div>
      </header>

      <div className="mb-5 flex gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3.5 text-xs text-muted">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <p className="leading-relaxed">
          <strong className="text-fg">Tip:</strong>{" "}
          {movie.language === "hi"
            ? "Default real faces + lip-sync ON. Civitai optional."
            : "Default real faces + lip-sync ON. Civitai optional."}
        </p>
      </div>

      <SceneProgressPanel
        language={movie.language}
        overallPhase={overallPhase}
        percent={progressPercent}
        headline={headline || movie.title}
        scenes={sceneProgress}
        activeSceneIndex={activeSceneIndex}
        className="mb-5"
      />

      <section className="mb-4 space-y-2">
        {([
          { key: "script" as const, label: "1. Script Agent", icon: Sparkles },
          { key: "voice" as const, label: "2. Voice Agent", icon: Volume2 },
          { key: "video" as const, label: "3. Video Agent", icon: Clapperboard },
        ] as const).map((s) => (
          <div key={s.key} className="card-pro flex items-center justify-between px-3.5 py-3">
            <div className="flex items-center gap-2 text-sm">
              <s.icon className="h-4 w-4 text-accent" />
              {s.label}
            </div>
            <StagePill status={pipeline[s.key]} />
          </div>
        ))}
        <p className="px-1 text-xs text-muted">{pipeline.lastMessage}</p>
      </section>

      <section className="mb-4 card-pro p-3">
        <p className="mb-2 text-xs font-semibold">
          {movie.language === "hi" ? "स्क्रीन लेआउट" : "Screen layout"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDualScreen(false)}
            className={cn(
              "flex-1 rounded-lg border py-2.5 text-xs font-semibold",
              !dualScreen ? "border-accent bg-accent/15 text-accent" : "border-border text-muted",
            )}
          >
            {movie.language === "hi" ? "सिंगल स्क्रीन" : "Single screen"}
          </button>
          <button
            type="button"
            onClick={() => setDualScreen(true)}
            className={cn(
              "flex-1 rounded-lg border py-2.5 text-xs font-semibold",
              dualScreen ? "border-accent bg-accent/15 text-accent" : "border-border text-muted",
            )}
          >
            {movie.language === "hi" ? "ड्यूल स्क्रीन" : "Dual screen"}
          </button>
        </div>
      </section>

      <DirectorControls
        dualScreen={dualScreen}
        onDualScreenChange={setDualScreen}
        facePerformance={facePerformance}
        onFacePerformanceChange={setFacePerformance}
        use3dAvatar={use3dAvatar}
        on3dAvatarChange={setUse3dAvatar}
        onMotionHint={setMotionIntensity}
        movieId={movieId}
        movie={{
          title: movie.title,
          language: movie.language,
          scenes: sortedScenes.map((s) => ({
            id: s.id,
            order: s.order,
            title: s.title,
            mood: s.mood,
            dialogue: s.dialogue,
            narration: s.narration,
            visualPrompt: s.visualPrompt,
            gestureNotes: s.gestureNotes,
          })),
          characters: movie.characters?.map((c) => ({
            id: c.id,
            name: c.name,
            role: c.role,
            appearance: c.appearance,
            referenceImageLocal: c.referenceImageLocal,
            referenceImageUrl: c.referenceImageUrl,
          })),
        }}
      />

      <ExternalStudioPanel
        language={movie.language}
        movieTitle={movie.title}
        scenes={sortedScenes}
        characters={movie.characters ?? []}
        onImportVideo={(sceneId, dataUrl) => {
          if (!movieId) return;
          updateScene(movieId, sceneId, { externalVideoLocal: dataUrl } as never);
        }}
      />

      <section className="mb-4 space-y-2">
        {sortedScenes.map((sc) => (
          <div key={sc.id} className="card-pro flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{sc.title}</p>
              <p className="text-[10px] text-muted">{sc.mood}</p>
            </div>
            <label className="cursor-pointer rounded-lg border border-border px-2 py-1 text-[10px] text-muted hover:border-accent/40">
              Audio
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  void onSceneAudioFile(sc.id, f);
                  e.target.value = "";
                }}
              />
            </label>
            {sc.audioLocal && (
              <button
                type="button"
                onClick={() => clearSceneAudio(sc.id)}
                className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted hover:border-red-500/40"
              >
                Clear
              </button>
            )}
          </div>
        ))}
      </section>

      <canvas
        ref={canvasRef}
        className="mb-4 w-full rounded-2xl border border-border bg-black"
        width={360}
        height={450}
      />

      {cinemaCaption && (
        <p className="mb-3 text-center text-xs text-muted">{cinemaCaption}</p>
      )}

      {recordStatus && (
        <p className="mb-3 text-center text-xs text-accent">{recordStatus}</p>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2 sm:max-w-2xl">
          <button
            type="button"
            disabled={busy}
            onClick={() => void runPipeline()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-3 py-3 text-sm font-bold text-black disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {running ? "Running…" : "Produce"}
          </button>
          <button
            type="button"
            disabled={busy || !movie.scenes.length}
            onClick={() => void runCinematic(false)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            Play
          </button>
          <button
            type="button"
            disabled={busy || !movie.scenes.length}
            onClick={() => void runCinematic(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-3 text-sm font-semibold disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {(playingCinema || exporting || running) && (
            <button
              type="button"
              onClick={stopAll}
              className="flex items-center justify-center rounded-xl border border-red-500/40 px-3 py-3 text-sm font-semibold text-red-400"
            >
              <Square className="h-4 w-4" />
            </button>
          )}
          {lastExport && (
            <button
              type="button"
              onClick={redownload}
              className="flex items-center justify-center rounded-xl border border-border px-3 py-3 text-sm font-semibold"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
