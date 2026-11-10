import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Sparkles, Volume2, Clapperboard, Play, Square, Bot, Loader2, AlertCircle, Download, Youtube,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import { runMoviePipeline } from "@/agents/orchestrator";
import { stopVoice } from "@/agents/voice-agent";
import type { StoryboardFrame } from "@/agents/video-agent";
import type { AgentStageStatus, PipelineState } from "@/agents/types";
import { playScenesOnCanvas, stopScenePlayer, downloadBlob, type PlayerScene } from "@/agents/scene-player";
import { bindScenesForPlayer } from "@/agents/visual-binder";
import type { MotionIntensity } from "@/agents/motion-engine";
import { DirectorControls } from "@/components/DirectorControls";
import { runWebImageAgent } from "@/agents/web-image-agent";
import {
  buildYoutubePublishPackage,
  downloadPublishPackage,
  getYtAgentDashboardUrl,
} from "@/agents/youtube-publish-bridge";
import { cn } from "@/lib/utils";

function appHostedVideoUrl(url: string, download = false): string {
  const query = new URLSearchParams({ url });
  if (download) query.set("download", "1");
  return `/api/video-proxy?${query.toString()}`;
}

function StagePill({ status }: { status: AgentStageStatus }) {
  const colors: Record<AgentStageStatus, string> = {
    idle: "bg-border text-muted", queued: "bg-border text-muted",
    running: "bg-amber-500/20 text-amber-400", succeeded: "bg-emerald-500/20 text-emerald-400",
    failed: "bg-red-500/20 text-red-400", skipped: "bg-border text-muted",
    needs_upgrade: "bg-sky-500/20 text-sky-400",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium uppercase", colors[status])}>
      {status.replace("_", " ")}
    </span>
  );
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
    lastMessage: "Ready — free ₹0 path (HF ZeroGPU worker optional)",
    updatedAt: new Date().toISOString(),
  });
  const [running, setRunning] = useState(false);
  const [storyboard, setStoryboard] = useState<StoryboardFrame[]>([]);
  const [clipUrl, setClipUrl] = useState("");
  const [generatedClips, setGeneratedClips] = useState<Array<{ sceneId: string; title: string; videoUrl: string; durationSec: number }>>([]);
  const [busyCinema, setBusyCinema] = useState(false);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("");
  const [workerUrl, setWorkerUrl] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("bharat_video_worker_url")) || "",
  );
  const [doScript, setDoScript] = useState(true);
  const [doVoice, setDoVoice] = useState(false);
  const [doVideo, setDoVideo] = useState(true);
  const [dualScreen, setDualScreen] = useState(true);
  const [facePerformance, setFacePerformance] = useState(true);
  const [use3dAvatar, setUse3dAvatar] = useState(false);
  const [motion, setMotion] = useState<MotionIntensity>("high");
  const [headline, setHeadline] = useState("");

  useEffect(() => {
    if (!movie) return;
    const saved = movie.scenes.filter((scene) => scene.outputUrl).map((scene) => ({ sceneId: scene.id, title: scene.title, videoUrl: scene.outputUrl!, durationSec: 5 }));
    if (saved.length) { setGeneratedClips(saved); setClipUrl(saved[0].videoUrl); }
  }, [movie?.id]);

  if (!movie) {
    return (
      <main className="page-shell mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted">Movie not found</p>
        <Link to="/" className="mt-4 inline-block text-accent">Back home</Link>
      </main>
    );
  }

  function playerScenes(): PlayerScene[] {
    if (movie!.scenes.length > 0) return bindScenesForPlayer(movie!.scenes, movie!.characters);
    return storyboard.map((f) => ({
      id: f.sceneId, title: f.title, mood: f.mood, dialogue: f.subtitle, visualPrompt: f.visualPrompt,
    }));
  }

  function exportYoutubePackage() {
    if (!movie) return;
    const scenes = (movie.scenes || []).slice().sort((a, b) => a.order - b.order);
    const pkg = buildYoutubePublishPackage({
      title: movie.title,
      language: movie.language,
      logline: headline.trim() || movie.synopsis || undefined,
      genre: (movie.genres && movie.genres[0]) || undefined,
      characters: movie.characters.map((c) => c.name),
      scenes: scenes.map((s, i) => ({
        index: i + 1,
        title: s.title,
        dialogue: s.dialogue,
        narration: s.narration,
      })),
      videoFileHint: clipUrl || undefined,
    });
    downloadPublishPackage(pkg);
    const dash = getYtAgentDashboardUrl();
    setStatus(
      dash
        ? `YouTube package downloaded — open agent at ${dash}`
        : "YouTube package downloaded — paste into PC agent (see docs/integrations/youtube-automation-agent.md)",
    );
  }

  async function runPipeline() {
    if (!movieId || !movie) return;
    setRunning(true);
    setGeneratedClips([]);
    setClipUrl("");
    stopVoice();
    stopScenePlayer();
    stopRef.current.stopped = true;
    if (workerUrl.trim()) localStorage.setItem("bharat_video_worker_url", workerUrl.trim());

    const result = await runMoviePipeline(
      {
        movieId, title: movie.title, synopsis: movie.synopsis || "", language: movie.language,
        targetDuration: movie.targetDuration, genres: movie.genres || [],
        scenes: movie.scenes.map((s) => ({
          id: s.id, order: s.order, title: s.title, mood: s.mood, dialogue: s.dialogue,
          narration: s.narration, gestureNotes: s.gestureNotes, visualPrompt: s.visualPrompt,
          characterIds: s.characterIds,
        })),
        characters: movie.characters.map((c) => ({
          id: c.id, name: c.name, role: c.role, appearance: c.appearance,
        })),
        options: { useCloudLlm: true, workerUrl: workerUrl.trim() || undefined },
      },
      { script: doScript, voice: doVoice, video: doVideo },
      {
        onStage: (stage, st, msg) => {
          setPipeline((p) => ({ ...p, [stage]: st, lastMessage: msg, updatedAt: new Date().toISOString() }));
        },
      },
    );
    setPipeline(result.pipeline);
    const url = result.video?.data?.clipUrl;
    setClipUrl(typeof url === "string" ? appHostedVideoUrl(url) : "");
    const rawClips = result.video?.data?.clips;
    let clipsToPersist: Array<{ sceneId: string; title: string; videoUrl: string; durationSec: number }> = [];
    if (Array.isArray(rawClips)) {
      const validClips = rawClips.filter((item): item is { sceneId: string; title: string; videoUrl: string; durationSec: number } => Boolean(item && typeof item === "object" && "videoUrl" in item && typeof item.videoUrl === "string"));
      clipsToPersist = validClips.map((item) => ({ ...item, videoUrl: appHostedVideoUrl(item.videoUrl) }));
      setGeneratedClips(clipsToPersist);
    }

    if (result.script) {
      applyScriptResult(movieId, result.script, { replaceCast: true, replaceScenes: true });
      const currentScenes = useMovieStore.getState().movies.find((m) => m.id === movieId)?.scenes.slice().sort((a, b) => a.order - b.order) || [];
      clipsToPersist.forEach((item, index) => {
        const target = currentScenes.find((scene) => scene.title === item.title) || currentScenes[index];
        if (target) updateScene(movieId, target.id, { outputUrl: item.videoUrl, status: "completed" });
      });
      if (!headline) setHeadline(result.script.logline?.slice(0, 80) || movie.title);
      try {
        const after = useMovieStore.getState().movies.find((m) => m.id === movieId);
        const fills = await runWebImageAgent({
          title: result.script.title || movie.title,
          language: movie.language,
          layout: dualScreen ? "dual" : "single",
          scenes: result.script.scenes.map((sc, order) => ({
            id: `tmp-${order}`, order, title: sc.title, mood: sc.mood,
            dialogue: sc.dialogue, narration: sc.narration, visualPrompt: sc.visualPrompt,
            gestureNotes: sc.gestureNotes,
          })),
          characters: (after?.characters || []).map((c) => ({
            id: c.id, name: c.name, role: c.role, appearance: c.appearance,
            referenceImageLocal: c.referenceImageLocal, referenceImageUrl: c.referenceImageUrl,
          })),
          onProgress: setStatus,
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
        setStatus(fills.summary);
      } catch {
        setStatus("Auto-art partial — use B button");
      }
    }
    if (result.storyboard?.length) setStoryboard(result.storyboard);
    setRunning(false);
  }

  function stopAll() {
    stopVoice();
    stopScenePlayer();
    stopRef.current.stopped = true;
    setBusyCinema(false);
    setRunning(false);
  }

  async function runCinema(record: boolean) {
    const canvas = canvasRef.current;
    if (!canvas || !movie) return;
    const scenes = playerScenes();
    if (!scenes.length) { setStatus("Generate script/scenes first."); return; }
    stopRef.current = { stopped: false };
    setBusyCinema(true);
    setCaption("");
    setStatus(record ? "Rendering a 120-second local storyboard preview (not AI footage)…" : "Playing preview…");
    try {
      const result = await playScenesOnCanvas(
        canvas, scenes,
        {
          language: movie.language, headline: headline.trim() || movie.title,
          width: record ? 540 : 360, height: record ? 676 : 450, record,
          targetDurationSec: record ? 120 : undefined,
          // Web Speech is not part of the canvas recording stream. Keep recorded
          // duration deterministic; uploaded scene audio needs a separate mux stage.
          embedAudio: !record,
          motionIntensity: motion, facePerformance: facePerformance || use3dAvatar,
          layout: dualScreen ? "dual" : "single", use3dAvatar, bodyPerformance: true,
          onCaption: setCaption, onRecordProgress: setStatus,
        },
        stopRef.current,
      );
      if (record && result.blob) {
        const safe = movie.title.replace(/[^\w\u0900-\u097F]+/g, "_").slice(0, 40) || "bharat_ai";
        const name = `${safe}.${result.extension}`;
        setStatus(
          `Preview ready: ${name} — approximately 120 seconds, ${result.hadAudioTrack ? "with audio track" : "silent storyboard preview"}. This is not AI-generated footage.`,
        );
        downloadBlob(result.blob, name);
      } else if (!record) setStatus("Playback finished.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Playback failed");
    } finally {
      setBusyCinema(false);
    }
  }

  const busy = running || busyCinema;

  return (
    <main className="page-shell mx-auto min-h-dvh max-w-lg px-4 pb-36 pt-6 sm:max-w-2xl">
      <header className="mb-6 flex items-start gap-3">
        <Link to={`/movie/${movie.id}`} className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted">
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
          <strong className="text-fg">Bharat AI is the video generator:</strong> the Video Agent generates footage directly from scene prompts. A shared public LTX ZeroGPU engine is used automatically when no custom worker is set; Wan / ComfyUI can be connected as alternatives. No finished video needs to be attached. Local preview export is separate from AI footage.
        </p>
      </div>

      <section className="mb-4 space-y-2">
        {([
          { key: "script" as const, label: "1. Script Agent", icon: Sparkles },
          { key: "voice" as const, label: "2. Voice Agent", icon: Volume2 },
          { key: "video" as const, label: "3. Video Agent", icon: Clapperboard },
        ]).map((s) => (
          <div key={s.key} className="card-pro flex items-center justify-between px-3.5 py-3">
            <div className="flex items-center gap-2 text-sm">
              <s.icon className="h-4 w-4 text-accent" />{s.label}
            </div>
            <StagePill status={pipeline[s.key]} />
          </div>
        ))}
        <p className="px-1 text-xs text-muted">{pipeline.lastMessage}</p>
      </section>

      <section className="mb-5 rounded-xl border border-border bg-card px-3.5 py-3 text-xs">
        <p className="font-semibold text-fg">Output provenance</p>
        <p className="mt-1 leading-relaxed text-muted">
          {generatedClips.length || clipUrl
            ? <>{generatedClips.length || 1} AI-generated scene clip(s) returned by the connected video worker. These are generated by Bharat AI's Video Agent, not user-attached footage.</>
            : "No AI clip has been generated yet. Choose Generate AI video; Bharat AI first tries its shared public LTX ZeroGPU engine. If the shared free queue is busy, retry later or connect a custom Wan / ComfyUI worker."}
        </p>
      </section>

      {generatedClips.length ? (
        <section className="card-pro mb-5 space-y-3 p-3">
          <h2 className="text-sm font-semibold">Generated video scenes</h2>
          {generatedClips.map((clip) => (
            <div key={clip.sceneId} className="space-y-1">
              <p className="text-xs font-medium">{clip.title}</p>
              <video src={clip.videoUrl} controls playsInline preload="metadata" className="w-full rounded-lg" />
              <a href={appHostedVideoUrl(new URL(clip.videoUrl, window.location.origin).searchParams.get("url") || clip.videoUrl, true)} className="inline-flex rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-black">Download MP4</a>
            </div>
          ))}
        </section>
      ) : clipUrl ? (
        <section className="card-pro mb-5 space-y-2 p-3">
          <h2 className="text-sm font-semibold">AI-generated video clip</h2>
          <video src={clipUrl} controls playsInline preload="metadata" className="w-full rounded-lg" />
          <a href={clipUrl} className="inline-flex rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-black">Download MP4</a>
        </section>
      ) : null}

      <DirectorControls
        dualScreen={dualScreen}
        onDualScreenChange={setDualScreen}
        facePerformance={facePerformance}
        onFacePerformanceChange={setFacePerformance}
        onMotionHint={setMotion}
        onStatus={setStatus}
        use3dAvatar={use3dAvatar}
        on3dAvatarChange={setUse3dAvatar}
        workerUrl={workerUrl}
        onWorkerUrlChange={setWorkerUrl}
        movieId={movieId}
        movie={{ title: movie.title, language: movie.language, scenes: movie.scenes, characters: movie.characters }}
        onApplyImages={(fills) => {
          if (!movieId) return;
          fills.forEach((f) => {
            const patch: { imageTopLocal?: string; imageBottomLocal?: string } = {};
            if (f.imageTop) patch.imageTopLocal = f.imageTop;
            if (f.imageBottom) patch.imageBottomLocal = f.imageBottom;
            if (patch.imageTopLocal || patch.imageBottomLocal) updateScene(movieId, f.sceneId, patch);
          });
        }}
        onPickImage={(sceneId, slot, dataUrl) => {
          if (!movieId) return;
          updateScene(movieId, sceneId, slot === "top" ? { imageTopLocal: dataUrl } : { imageBottomLocal: dataUrl });
        }}
        onGeneratedVideo={(sceneId, videoUrl) => {
          setClipUrl(videoUrl);
          setGeneratedClips([{ sceneId, title: "Generated scene", videoUrl, durationSec: 4 }]);
        }}
      />

      <section className="mb-4 rounded-xl border border-border bg-card p-3 text-xs">
        <p className="mb-2 font-semibold">Pipeline stages</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={doScript} onChange={(e) => setDoScript(e.target.checked)} /> Script</label>
        <label className="mt-1 flex items-center gap-2"><input type="checkbox" checked={doVoice} onChange={(e) => setDoVoice(e.target.checked)} /> Voice (Web Speech, free)</label>
        <label className="mt-1 flex items-center gap-2"><input type="checkbox" checked={doVideo} onChange={(e) => setDoVideo(e.target.checked)} /> Generate AI video (MiniMax-H3 / Wan / ComfyUI)</label>
      </section>

      <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-black">
        <canvas ref={canvasRef} className="mx-auto block w-full max-w-md" width={360} height={450} />
        {caption ? <p className="border-t border-white/10 px-3 py-2 text-center text-xs text-amber-100">{caption}</p> : null}
        {status ? <p className="px-3 pb-2 text-center text-[11px] text-muted">{status}</p> : null}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2 sm:max-w-2xl">
          <button type="button" disabled={busy} onClick={() => void runCinema(false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-3 text-sm font-semibold disabled:opacity-50">
            <Play className="h-4 w-4" /> Play
          </button>
          <button type="button" disabled={busy} onClick={() => void runCinema(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-3 text-sm font-bold text-black disabled:opacity-50">
            <Download className="h-4 w-4" /> Export storyboard preview
          </button>
        </div>
        <div className="mx-auto mt-2 flex max-w-lg gap-2 sm:max-w-2xl">
          <button type="button" onClick={stopAll}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-semibold">
            <Square className="h-3.5 w-3.5" /> Stop
          </button>
          <button type="button" disabled={busy} onClick={() => void runPipeline()}
            className="flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-orange-700 py-2.5 text-xs font-bold text-white disabled:opacity-50">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
            Generate AI video
          </button>
        </div>
        <div className="mx-auto mt-2 flex max-w-lg sm:max-w-2xl">
          <button
            type="button"
            disabled={!movie.scenes?.length && !movie.title}
            onClick={exportYoutubePackage}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 py-2.5 text-xs font-semibold text-red-200 disabled:opacity-50"
            title="Download JSON for darkzOGx/youtube-automation-agent on your PC"
          >
            <Youtube className="h-3.5 w-3.5" />
            YouTube package (JSON)
          </button>
        </div>
      </div>
    </main>
  );
}
