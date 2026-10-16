import { generateScript } from "@/lib/script-engine";
import type { ScriptOutput } from "@/lib/script-engine";
import { runVoiceAgent, type NarrationLine } from "./voice-agent";
import { runVideoAgent, type StoryboardFrame } from "./video-agent";
import type {
  AgentRunInput,
  AgentRunResult,
  AgentStageStatus,
  PipelineState,
} from "./types";
import { AGENT_CATALOG } from "./types";

export interface OrchestratorCallbacks {
  onStage?: (stage: keyof PipelineState, status: AgentStageStatus, msg: string) => void;
  onNarrationLine?: (line: NarrationLine, index: number, total: number) => void;
}

export interface OrchestratorResult {
  pipeline: PipelineState;
  script?: ScriptOutput;
  voice?: AgentRunResult;
  video?: AgentRunResult;
  storyboard?: StoryboardFrame[];
}

export function initialPipeline(): PipelineState {
  return {
    script: "idle",
    voice: "idle",
    video: "idle",
    lastMessage: "Ready",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Full free pipeline:
 * 1) Script agent (browser template; optional cloud LLM later)
 * 2) Voice agent (Web Speech narration)
 * 3) Video agent (storyboard player / worker hook)
 */
export async function runMoviePipeline(
  input: AgentRunInput,
  stages: { script: boolean; voice: boolean; video: boolean },
  cb?: OrchestratorCallbacks,
): Promise<OrchestratorResult> {
  const pipeline = initialPipeline();
  let scriptOut: ScriptOutput | undefined;
  let voiceRes: AgentRunResult | undefined;
  let videoRes: AgentRunResult | undefined;
  let storyboard: StoryboardFrame[] | undefined;

  // —— SCRIPT ——
  if (stages.script) {
    pipeline.script = "running";
    cb?.onStage?.("script", "running", "Script Agent writing…");
    try {
      // Optional: call /api/agents/script if cloud LLM configured
      let usedCloud = false;
      if (input.options?.useCloudLlm) {
        try {
          const res = await fetch("/api/agents/script", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          if (res.ok) {
            const data = (await res.json()) as { script?: ScriptOutput };
            if (data.script) {
              scriptOut = data.script;
              usedCloud = true;
            }
          }
        } catch {
          /* fall back */
        }
      }
      if (!scriptOut) {
        scriptOut = generateScript({
          title: input.title,
          idea: input.synopsis || input.title,
          language: input.language,
          targetDuration: input.targetDuration,
          genres: input.genres,
        });
      }
      pipeline.script = "succeeded";
      pipeline.lastMessage = usedCloud
        ? "Script Agent (cloud free-tier) done"
        : "Script Agent (browser free engine) done";
      cb?.onStage?.("script", "succeeded", pipeline.lastMessage);
    } catch (e) {
      pipeline.script = "failed";
      pipeline.lastMessage =
        e instanceof Error ? e.message : "Script agent failed";
      cb?.onStage?.("script", "failed", pipeline.lastMessage);
    }
  } else {
    pipeline.script = "skipped";
  }

  // Merge generated scenes into input for downstream agents
  const enriched: AgentRunInput = scriptOut
    ? (() => {
        const characters = scriptOut.characters.map((character, i) => ({
          id: `c-${i}`,
          name: character.name,
          role: character.role,
          appearance: character.appearance,
        }));
        const allCharacterIds = characters.map((character) => character.id);
        const scenes = scriptOut.scenes.map((sc, order) => {
          const speakerNames = (sc.dialogue || "")
            .split(/\n+/)
            .map((line) => line.match(/^([^:]{1,40}):\s*.+$/)?.[1]?.trim().toLocaleLowerCase())
            .filter((name): name is string => Boolean(name));
          const matchedIds = characters
            .filter((character) => speakerNames.includes(character.name.toLocaleLowerCase()))
            .map((character) => character.id);
          return {
            id: `gen-${order}`,
            order,
            title: sc.title,
            mood: sc.mood,
            dialogue: sc.dialogue,
            narration: sc.narration,
            gestureNotes: sc.gestureNotes,
            visualPrompt: sc.visualPrompt,
            characterIds: matchedIds.length ? matchedIds : allCharacterIds,
          };
        });
        return { ...input, scenes, characters };
      })()
    : input;

  // —— VOICE ——
  if (stages.voice) {
    pipeline.voice = "running";
    cb?.onStage?.("voice", "running", "Voice Agent narrating…");
    voiceRes = await runVoiceAgent(enriched, cb?.onNarrationLine);
    pipeline.voice = voiceRes.status;
    pipeline.lastMessage = voiceRes.message;
    cb?.onStage?.("voice", voiceRes.status, voiceRes.message);
  } else {
    pipeline.voice = "skipped";
  }

  // —— VIDEO ——
  if (stages.video) {
    pipeline.video = "running";
    cb?.onStage?.("video", "running", "Video Agent building preview…");
    videoRes = await runVideoAgent(enriched);
    pipeline.video = videoRes.status;
    pipeline.lastMessage = videoRes.message;
    storyboard = videoRes.data?.board as StoryboardFrame[] | undefined;
    cb?.onStage?.("video", videoRes.status, videoRes.message);
  } else {
    pipeline.video = "skipped";
  }

  pipeline.updatedAt = new Date().toISOString();
  return {
    pipeline,
    script: scriptOut,
    voice: voiceRes,
    video: videoRes,
    storyboard,
  };
}

export function getAgentCatalog() {
  return AGENT_CATALOG;
}
