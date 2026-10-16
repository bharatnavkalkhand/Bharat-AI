import type { AgentRunInput, AgentRunResult } from "./types";
import { generateSilentClip } from "./hf-zerogpu-worker";

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

  if (normalizedWorkerUrl && isHuggingFaceSpace) {
    // First prove the real generation path end-to-end. The free ZeroGPU
    // allowance is small, so do not silently spend it on every storyboard scene.
    const firstScene = [...input.scenes].sort((a, b) => a.order - b.order)[0];
    const prompt =
      firstScene?.visualPrompt ||
      `${firstScene?.title || input.title}, cinematic scene, ${firstScene?.mood || "dramatic"} mood`;
    const generated = await generateSilentClip({
      spaceUrl: normalizedWorkerUrl,
      prompt,
      durationSec: 2,
      seed: 42,
    });

    if ("videoUrl" in generated) {
      return {
        agentId: "video",
        status: "succeeded",
        message: `Real AI video clip generated. Open/copy this MP4 URL: ${generated.videoUrl} — short silent test clip; full movie assembly is the next stage.`,
        outputText: `Generated real clip for scene: ${firstScene?.title || input.title}\nVideo: ${generated.videoUrl}`,
        data: {
          board,
          mode: "hf-zero-gpu",
          clipUrl: generated.videoUrl,
          clipFrames: generated.frames,
          clipSceneId: firstScene?.id,
          clipDurationSec: generated.frames / 16,
        },
        durationMs: performance.now() - t0,
      };
    }

    return {
      agentId: "video",
      status: "succeeded",
      message: `Storyboard preview ready, but real GPU generation failed: ${generated.error}. Check that the HF Space is running and its free GPU quota is available.`,
      outputText: board
        .map((f, i) => `Frame ${i + 1}: ${f.title} [${f.mood}] ${f.durationSec}s — ${f.visualPrompt}`)
        .join("\n"),
      data: { board, mode: "storyboard", workerError: generated.error },
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
          status: "succeeded",
          message: "Video worker accepted job. Poll worker for MP4 when ready.",
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
    status: "succeeded",
    message:
      "Storyboard movie preview ready (free). To test real AI video, configure a running Hugging Face ZeroGPU Space URL in the Produce tab. The free worker makes short silent clips; full 5–10 minute movie assembly is not yet implemented.",
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
