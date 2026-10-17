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
import { runMoviePipeline, getAgentCatalog } from "@/agents/orchestrator";
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
  readImageAsDataUrl,
  readAudioAsDataUrl,
} from "@/agents/visual-binder";
import type { MotionIntensity } from "@/agents/motion-engine";
import { DirectorControls } from "@/components/DirectorControls";
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
  const [frameIndex, setFrameIndex] = useState(0);
  const [playingCinema, setPlayingCinema] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cinemaCaption, setCinemaCaption] = useState("");
  const [recordStatus, setRecordStatus] = useState("");
  const [lastExport, setLastExport] = useState<{ blob: Blob; extension: "webm" | "mp4"; name: string } | null>(null);
  const [workerUrl, setWorkerUrl] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("bharat_video_worker_url")) || "",
  );
  const [doScript] = useState(true);
  const [doVoice, setDoVoice] = useState(true);
  const [voiceGender, setVoiceGender] = useState<"auto" | "male" | "female">("auto");
  const [doVideo] = useState(true);
  const [headline, setHeadline] = useState("");
  const [motionIntensity, setMotionIntensity] = useState<MotionIntensity>("high");
  const [facePerformance, setFacePerformance] = useState(false);
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
  }, [movie?.scenes, movie?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const hasPhotos = movie.scenes.some(
      (s) => s.imageTopLocal || s.imageBottomLocal || s.externalImageLocal,
    );

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
          bodyPerformance: (facePerformance || use3dAvatar) && !hasPhotos,
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
    if (!movieId || !file) return;
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
            ? "सिंगल स्क्रीन + आवाज़। Phone: नीचे scene audio import (VoiceStudio/CapCut mp3)।"
            : "Single screen + Voice. Phone: import scene audio below (VoiceStudio/CapCut mp3)."}
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

      <section className="mb-4 card-pro p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">
            {movie.language === "hi" ? "आवाज़ (कथा / पात्र)" : "Voice (narration / characters)"}
          </p>
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={doVoice}
              onChange={(e) => setDoVoice(e.target.checked)}
              className="rounded border-border"
            />
            {movie.language === "hi" ? "पाइपलाइन में आवाज़" : "Voice in pipeline"}
          </label>
        </div>
        <div className="mb-2 flex gap-2">
          {(["auto", "male", "female"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setVoiceGender(g)}
              className={cn(
                "flex-1 rounded-lg border py-2 text-xs font-medium capitalize",
                voiceGender === g ? "border-accent bg-accent/15 text-accent" : "border-border text-muted",
              )}
            >
              {g}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted">
          {movie.language === "hi"
            ? "Gender चुनो → नीचे Play दबाओ (phone volume ON)।"
            : "Pick gender → press Play below (phone volume ON)."}
        </p>
      </section>

      <section className="mb-4 card-pro p-3">
        <p className="mb-2 text-xs font-semibold">Motion intensity</p>
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

      <section className="mb-4 card-pro p-3">
        <p className="mb-1 text-xs font-semibold">
          {movie.language === "hi" ? "Scene audio import (phone)" : "Scene audio import (phone)"}
        </p>
        <p className="mb-2 text-[10px] text-muted">
          {movie.language === "hi"
            ? "PC pe VoiceStudio clone → mp3 phone pe bhejo → yahan scene pe lagaao. Max ~2.5MB/scene."
            : "Clone on PC (VoiceStudio) → send mp3 to phone → attach per scene. Max ~2.5MB/scene."}
        </p>
        {sortedScenes.length === 0 ? (
          <p className="text-[10px] text-muted">
            {movie.language === "hi" ? "Pehle script / pipeline chalao." : "Run script / pipeline first."}
          </p>
        ) : (
          <ul className="space-y-2">
            {sortedScenes.map((sc, i) => (
              <li
                key={sc.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg/50 px-2.5 py-2"
              >
                <span className="w-5 shrink-0 text-[10px] font-bold text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-xs">{sc.title}</span>
                {sc.audioLocal ? (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">
                    audio ✓
                  </span>
                ) : (
                  <span className="text-[10px] text-muted">TTS</span>
                )}
                <label className="cursor-pointer rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">
                  Import
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
                    className="text-[10px] text-muted underline"
                    onClick={() => clearSceneAudio(sc.id)}
                  >
                    clear
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <DirectorControls
        dualScreen={dualScreen}
        onDualScreenChange={setDualScreen}
        facePerformance={facePerformance}
        onFacePerformanceChange={setFacePerformance}
        onMotionHint={setMotionIntensity}
        onStatus={setRecordStatus}
        use3dAvatar={use3dAvatar}
        on3dAvatarChange={setUse3dAvatar}
        workerUrl={workerUrl}
        onWorkerUrlChange={setWorkerUrl}
        movieId={movieId}
        onImportExternal={(sceneId, dataUrl) => {
          if (!movieId) return;
          updateScene(movieId, sceneId, { externalImageLocal: dataUrl, imageTopLocal: dataUrl });
          setSceneProgress((prev) =>
            prev.map((s) =>
              s.id === sceneId ? { ...s, thumb: dataUrl, phase: "done" as ScenePhase } : s,
            ),
          );
        }}
        onApplyImages={(fills) => {
          if (!movieId) return;
          for (const f of fills) {
            const patch: { imageTopLocal?: string; imageBottomLocal?: string } = {};
            if (f.imageTop) patch.imageTopLocal = f.imageTop;
            if (f.imageBottom) patch.imageBottomLocal = f.imageBottom;
            if (patch.imageTopLocal || patch.imageBottomLocal) updateScene(movieId, f.sceneId, patch);
          }
          setSceneProgress((prev) =>
            prev.map((s) => {
              const fill = fills.find((x) => x.sceneId === s.id);
              if (!fill) return s;
              return {
                ...s,
                thumb: fill.imageTop || s.thumb,
                phase: "done" as ScenePhase,
                detail: fill.source || s.detail,
              };
            }),
          );
        }}
      />

      <section className="mb-4 overflow-hidden rounded-2xl border border-border bg-black">
        <canvas ref={canvasRef} className="mx-auto block w-full max-w-md bg-black" />
        {cinemaCaption && (
          <p className="border-t border-border px-3 py-2 text-center text-xs text-muted">{cinemaCaption}</p>
        )}
        {recordStatus && (
          <p className="border-t border-border px-3 py-2 text-center text-xs text-amber-400">{recordStatus}</p>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border p-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => runCinematic(false)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> Play
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => runCinematic(true)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export WebM/MP4
          </button>
        </div>
        {lastExport && (
          <button
            type="button"
            onClick={redownload}
            className="w-full border-t border-border py-2 text-xs text-accent"
          >
            Re-download {lastExport.name}
          </button>
        )}
      </section>

      <section className="fixed bottom-0 left-0 right-0 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-lg gap-2 sm:max-w-2xl">
          <button
            type="button"
            onClick={stopAll}
            disabled={!busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm disabled:opacity-40"
          >
            <Square className="h-4 w-4" /> Stop
          </button>
          <button
            type="button"
            onClick={runPipeline}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {running ? "Producing…" : "Run production pipeline"}
          </button>
        </div>
      </section>
    </main>
  );
}
