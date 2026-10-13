/** Multi-agent contracts for Bharat AI production pipeline */

export type AgentId = "script" | "voice" | "video" | "orchestrator";

export type AgentStageStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "needs_upgrade";

export interface AgentCapability {
  id: AgentId;
  name: string;
  description: string;
  /** Runs at ₹0 with current free stack */
  freeNow: boolean;
  /** Quality level today: 1 low – 5 production */
  qualityScore: number;
  /** What unlocks higher quality */
  upgradePath: string;
}

export interface AgentRunInput {
  movieId: string;
  title: string;
  synopsis: string;
  language: "en" | "hi";
  targetDuration: "5min" | "10min";
  genres: string[];
  scenes: Array<{
    id: string;
    order: number;
    title: string;
    mood: string;
    dialogue?: string;
    narration?: string;
    gestureNotes?: string;
    visualPrompt?: string;
  }>;
  characters: Array<{
    id: string;
    name: string;
    role?: string;
  }>;
  /** Optional free-tier keys (never hardcode secrets in frontend) */
  options?: {
    useCloudLlm?: boolean;
    workerUrl?: string;
  };
}

export interface AgentRunResult {
  agentId: AgentId;
  status: AgentStageStatus;
  message: string;
  /** Human-readable output / logs */
  outputText?: string;
  /** Structured payload for store */
  data?: Record<string, unknown>;
  durationMs?: number;
}

export interface PipelineState {
  script: AgentStageStatus;
  voice: AgentStageStatus;
  video: AgentStageStatus;
  lastMessage: string;
  updatedAt: string;
}

export const AGENT_CATALOG: AgentCapability[] = [
  {
    id: "script",
    name: "Script Agent",
    description:
      "Turns idea into structured scenes, dialogue, fight/romance beats.",
    freeNow: true,
    qualityScore: 3,
    upgradePath:
      "Connect free Groq/HF LLM key, or self-host Ollama (Llama 3 / Qwen).",
  },
  {
    id: "voice",
    name: "Voice / Narration Agent",
    description:
      "Reads dialogue scene-by-scene. Browser TTS free; character cloning needs open-source voice models.",
    freeNow: true,
    qualityScore: 2,
    upgradePath:
      "Self-host Coqui XTTS / Piper, or free-tier cloud TTS for character voices.",
  },
  {
    id: "video",
    name: "Video Agent",
    description:
      "Storyboard + timed playback today. Full MP4 needs GPU worker (ComfyUI / AnimateDiff / Wan).",
    freeNow: true,
    qualityScore: 1,
    upgradePath:
      "Deploy free open-source video worker on your GPU or community free compute; point WORKER_URL.",
  },
  {
    id: "orchestrator",
    name: "Movie Orchestrator",
    description: "Runs Script → Voice → Video stages and tracks progress.",
    freeNow: true,
    qualityScore: 3,
    upgradePath: "Add queue + Redis later when scaling beyond single-browser jobs.",
  },
];
