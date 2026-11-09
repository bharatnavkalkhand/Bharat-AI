import type { AgentRunInput, AgentRunResult } from "./types";
import { generateSilentClip } from "./hf-zerogpu-worker";
import { createComfyUiWorker, getComfyUiUrl } from "./comfyui-worker";
import { createPublicLtxWorker } from "./public-ltx-worker";

export interface StoryboardFrame {
  sceneId: string;
  order: number;
  title: string;
  mood: string;
  visualPrompt: string;
  subtitle: string;
  durationSec: number;
  /** CSS gradient placeholder until real frames exist */
  backdrop: string;
}

const MOOD_BACKDROP: Record<string, string> = {
  fight: "linear-gradient(135deg,#3f0d12 0%,#7f1d1d 40%,#1c1917 100%)",
  romance: "linear-gradient(135deg,#4a044e 0%,#9d174d 45%,#1e1b4b 100%)",
  gesture: "linear-gradient(135deg,#164e63 0%,#0e7490 50%,#1e293b 100%)",
  dialogue: "linear-gradient(135deg,#1e293b 0%,#334155 50%,#0f172a 100%)",
  action: "linear-gradient(135deg,#7c2d12 0%,#c2410c 40%,#1c1917 100%)",
  emotional: "linear-gradient(135deg,#312e81 0%,#4c1d95 50%,#0f172a 100%)",
  dramatic: "linear-gradient(135deg,#18181b 0%,#3f3f46 50%,#09090b 100%)",
  neutral: "linear-gradient(135deg,#27272a 0%,#3f3f46 50%,#18181b 100%)",
};

export function buildStoryboard(input: AgentRunInput): StoryboardFrame[] {
  const scenes = [...input.scenes].sort((a, b) => a.order - b.order);
  const totalTarget = input.targetDuration === "10min" ? 600 : 300;
  const per = Math.max(8, Math.round(totalTarget / Math.max(scenes.length, 1)));

  return scenes.map((sc) => ({
    sceneId: sc.id,
    order: sc.order,
    title: sc.title,
    mood: sc.mood,
    visualPrompt:
      sc.visualPrompt ||
      `${sc.title}, ${sc.mood} cinematic frame, avatar characters`,
    subtitle: (sc.dialogue || sc.narration || sc.gestureNotes || "")
      .split("\n")
      .slice(0, 2)
      .join(" · ")
      .slice(0, 160),
    durationSec: per,
    backdrop: MOOD_BACKDROP[sc.mood] || MOOD_BACKDROP.neutral,
  }));
}

/**
 * Video stage. Without a worker, keep the free storyboard preview.
 * Hugging Face Spaces use Gradio's queue API (not the generic /generate
 * contract), so route those URLs through the dedicated ZeroGPU adapter.
 */
export async function runVideoAgent(
  input: AgentRunInput,
): Promise<AgentRunResult> {
  const t0 = performance.now();
  const board = buildStoryboard(input);

  if (!board.length) {
    return {
      agentId: "video",
      status: "failed",
      message: "No scenes to visualize. Run Script Agent first.",
      durationMs: performance.now() - t0,
    };
  }

  const workerUrl =
    input.options?.workerUrl ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("bharat_video_worker_url") || ""
      : "");
  const normalizedWorkerUrl = workerUrl.trim().replace(/\/$/, "");
  const isHuggingFaceSpace =
    /(^https?:\/\/[^/]+\.hf\.space$)/i.test(normalizedWorkerUrl) ||
    /huggingface\.co\/spaces\//i.test(normalizedWorkerUrl);

  // Prefer the in-app ComfyUI generation path when a local worker is configured.
  // This submits scene prompts directly to the generation worker; it does not ask
  // the user to download and attach finished videos from another website.
  const comfyUrl = getComfyUiUrl();
  if (comfyUrl) {
    const worker = createComfyUiWorker({ baseUrl: comfyUrl, mode: "auto" });
    const sortedScenes = [...input.scenes].sort((a, b) => a.order - b.order);
    const clips: Array<{ sceneId: string; title: string; videoUrl: string; durationSec: number }> = [];
    const failures: string[] = [];
    for (const scene of sortedScenes) {
      const cast = input.characters
        .filter((c) => !scene.characterIds?.length || scene.characterIds.includes(c.id))
        .map((c) => [c.name, c.role, c.appearance].filter(Boolean).join(", "))
        .filter(Boolean).join("; ");
      const prompt = [
        scene.visualPrompt || scene.title,
        scene.mood ? `Mood: ${scene.mood}` : "",
        cast ? `Keep character appearance consistent: ${cast}` : "",
        scene.dialogue || scene.narration ? `Performance and dialogue context: ${scene.dialogue || scene.narration}` : "",
        "Photorealistic live-action cinematic video, realistic human anatomy, natural full-body action, believable physics, expressive faces, detailed environment, smooth camera movement, cinematic lighting, no cartoon, no illustration, no text, no subtitles.",
      ].filter(Boolean).join(". ");
      try {
        const { remoteJobId } = await worker.submit({
          movieId: input.movieId,
          sceneId: scene.id,
          prompt,
          aspectRatio: "16:9",
          width: 832,
          height: 480,
          durationSec: 4,
          seed: 4200 + scene.order,
        }, `bharat-${input.movieId}-${scene.id}-${Date.now()}`);
        let result: Awaited<ReturnType<typeof worker.status>> | null = null;
        for (let attempt = 0; attempt < 180; attempt += 1) {
          result = await worker.status(remoteJobId);
          if (result.status === "succeeded" || result.status === "failed") break;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (result?.status === "succeeded") {
          clips.push({ sceneId: scene.id, title: scene.title, videoUrl: result.videoUrl, durationSec: 4 });
        } else {
          failures.push(`${scene.title}: ${result?.status === "failed" ? result.error : "generation timed out"}`);
          break;
        }
      } catch (error) {
        failures.push(`${scene.title}: ${error instanceof Error ? error.message : "generation failed"}`);
        break;
      }
    }
    if (clips.length) {
      return {
        agentId: "video",
        status: failures.length ? "failed" : "succeeded",
        message: `Generated ${clips.length} scene video(s) inside Bharat AI with ComfyUI.${failures.length ? ` Remaining generation stopped: ${failures[0]}` : ""}`,
        outputText: clips.map((clip) => `${clip.title}: ${clip.videoUrl}`).join("\\n"),
        data: { board, mode: "comfyui-generated", clips, clipUrl: clips[0].videoUrl, partialError: failures[0] },
        durationMs: performance.now() - t0,
      };
    }
    return {
      agentId: "video",
      status: "failed",
      message: `Bharat AI could not generate a video through ComfyUI: ${failures[0] || "No clip returned"}. Check that the ComfyUI generation bridge is running and has a valid Wan video workflow.`,
      data: { board, mode: "generation-error", workerError: failures[0] },
      durationMs: performance.now() - t0,
    };
  }

  // Zero-setup default: a public LTX Video ZeroGPU demo. This is genuine
  // diffusion inference, but it is a shared community service (not guaranteed).
  // Anonymous visitor quota is limited, so the default path generates one short scene.
  if (!normalizedWorkerUrl) {
    const sortedScenes = [...input.scenes].sort((a, b) => a.order - b.order);
    const scene = sortedScenes[0];
    const cast = input.characters
      .filter((character) => !scene.characterIds?.length || scene.characterIds.includes(character.id))
      .map((character) => [character.name, character.role, character.appearance].filter(Boolean).join(", "))
      .filter(Boolean)
      .join("; ");
    const prompt = [
      scene.visualPrompt || scene.title,
      scene.mood ? "Mood: " + scene.mood : "",
      cast ? "Maintain these character identities and appearances: " + cast : "",
      scene.dialogue || scene.narration ? "Scene context: " + (scene.dialogue || scene.narration) : "",
      "Photorealistic live-action cinematic footage, natural human movement, believable physics, expressive faces, detailed environment, smooth camera movement, cinematic lighting, consistent character design, no cartoon, no illustration, no text, no subtitles.",
    ].filter(Boolean).join(". ");
    const worker = createPublicLtxWorker();
    try {
      const { remoteJobId } = await worker.submit({ movieId: input.movieId, sceneId: scene.id, prompt, aspectRatio: "16:9", width: 704, height: 512, durationSec: 2, seed: 42 + scene.order }, "bharat-public-ltx-" + input.movieId + "-" + scene.id + "-" + Date.now());
      const generated = await worker.status(remoteJobId);
      if (generated.status === "succeeded") {
        const clip = { sceneId: scene.id, title: scene.title, videoUrl: generated.videoUrl, durationSec: 2 };
        return { agentId: "video", status: "succeeded", message: "Generated a real AI video clip through the shared public LTX ZeroGPU engine. Remaining scenes stay as storyboard scenes; free GPU availability is limited.", outputText: scene.title + ": " + generated.videoUrl, data: { board, mode: "public-ltx-zero-gpu", clips: [clip], clipUrl: clip.videoUrl, generatedSceneCount: 1, totalSceneCount: sortedScenes.length }, durationMs: performance.now() - t0 };
      }
      const reason = generated.status === "failed" ? generated.error : "job did not finish";
      return { agentId: "video", status: "failed", message: "The public AI video engine did not return a clip: " + reason, outputText: "No video file was produced. The storyboard remains available.", data: { board, mode: "public-ltx-error", workerError: reason }, durationMs: performance.now() - t0 };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Public AI video generation failed";
      return { agentId: "video", status: "failed", message: "The free public AI video engine is unavailable right now: " + reason, outputText: "No video file was produced. The storyboard remains available.", data: { board, mode: "public-ltx-error", workerError: reason }, durationMs: performance.now() - t0 };
    }
  }
  if (normalizedWorkerUrl && isHuggingFaceSpace) {
    // Generate a very small number of short silent clips. The worker reserves
    // 120s for 17 frames and 180s for 33 frames; a free personal ZeroGPU quota
    // is limited, so this is best-effort and cannot render a two-minute film.
    // Remaining scenes stay clearly marked as storyboard/local-assembly assets.
    const MAX_SCENES_TO_GENERATE = 1;
    const sortedScenes = [...input.scenes].sort((a, b) => a.order - b.order);
    const scenesToGenerate = sortedScenes.slice(0, MAX_SCENES_TO_GENERATE);

    const generatedClips: Array<{
      sceneId: string;
      videoUrl: string;
      frames: number;
    }> = [];
    let firstError: string | null = null;

    for (const scene of scenesToGenerate) {
      const selectedIds = scene.characterIds ?? [];
      const sceneCharacters = input.characters.filter((c) =>
        selectedIds.length ? selectedIds.includes(c.id) : true,
      );
      const castDescription = sceneCharacters
        .map((c) =>
          [c.name, c.role, c.appearance].filter(Boolean).join(", "),
        )
        .join("; ");
      const prompt = [
        scene.visualPrompt ||
          `${scene.title}, ${scene.mood || "dramatic"} cinematic scene`,
        castDescription
          ? `Keep these characters visually consistent: ${castDescription}`
          : "",
        "photorealistic live-action cinematic video, realistic human or humanoid anatomy, natural full-body movement, believable physics, expressive faces, detailed environment, smooth camera movement, cinematic lighting, no cartoon, no illustration, no 2D motion graphics, no subtitles, no text",
      ]
        .filter(Boolean)
        .join(". ");

      const generated = await generateSilentClip({
        spaceUrl: normalizedWorkerUrl,
        prompt,
        durationSec: 2,
        seed: 42 + scene.order,
      });

      if ("videoUrl" in generated) {
        generatedClips.push({
          sceneId: scene.id,
          videoUrl: generated.videoUrl,
          frames: generated.frames,
        });
      } else {
        // Quota exhausted or Space error — stop generating, report what we have.
        firstError = generated.error;
        break;
      }
    }

    if (generatedClips.length > 0) {
      const firstClip = generatedClips[0];
      const clipSummary = generatedClips
        .map((c, i) => `  Scene ${i + 1}: ${c.videoUrl}`)
        .join("\n");
      const skipped = sortedScenes.length - generatedClips.length;
      const skippedNote =
        skipped > 0
          ? ` ${skipped} scene(s) kept as storyboard (quota cap or generation limit).`
          : "";

      return {
        agentId: "video",
        status: "succeeded",
        message: `Generated ${generatedClips.length} real AI clip(s) (silent, ~2s each).${skippedNote}\n${clipSummary}`,
        outputText: `Generated ${generatedClips.length} clip(s) for: ${input.title}\n${clipSummary}`,
        data: {
          board,
          mode: "hf-zero-gpu",
          clips: generatedClips,
          // Convenience fields kept for backward compat with scene player.
          clipUrl: firstClip.videoUrl,
          clipFrames: firstClip.frames,
          clipSceneId: firstClip.sceneId,
          clipDurationSec: firstClip.frames / 16,
        },
        durationMs: performance.now() - t0,
      };
    }

    return {
      agentId: "video",
      status: "failed",
      message: `Real AI video generation failed: ${firstError ?? "unknown error"}. No MP4 was produced. Check the Hugging Face Space URL, its build/runtime logs, and free GPU availability.`,
      outputText: board
        .map(
          (f, i) =>
            `Storyboard only — frame ${i + 1}: ${f.title} [${f.mood}] ${f.durationSec}s — ${f.visualPrompt}`,
        )
        .join("\n"),
      data: { board, mode: "storyboard", workerError: firstError },
      durationMs: performance.now() - t0,
    };
  }

  if (normalizedWorkerUrl) {
    try {
      const res = await fetch(`${normalizedWorkerUrl}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieId: input.movieId,
          title: input.title,
          scenes: board,
          language: input.language,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        return {
          agentId: "video",
          status: "queued",
          message: "Video worker accepted the job, but no MP4 has been returned yet. This stage remains queued until the worker exposes a completed clip.",
          data: { board, worker: data },
          durationMs: performance.now() - t0,
        };
      }
    } catch {
      // fall through to storyboard
    }
  }

  return {
    agentId: "video",
    status: "failed",
    message:
      "No real AI video was generated. This is only a storyboard/2D motion preview. Configure a running Hugging Face ZeroGPU Space to attempt a short silent AI clip; full 5–10 minute movie assembly is not yet implemented.",
    outputText: board
      .map(
        (f, i) =>
          `Frame ${i + 1}: ${f.title} [${f.mood}] ${f.durationSec}s — ${f.visualPrompt}`,
      )
      .join("\n"),
    data: {
      board,
      mode: "storyboard",
      upgrade:
        "Deploy workers/hf-zerogpu as a Gradio ZeroGPU Space and set its URL in Produce.",
    },
    durationMs: performance.now() - t0,
  };
}
