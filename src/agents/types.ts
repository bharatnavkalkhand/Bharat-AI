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
  freeNow: boolean;
  qualityScore: number;
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
  options?: {
    useCloudLlm?: boolean;
    workerUrl?: string;
  };
}

export interface AgentRunResult {
  agentId: AgentId;
  status: AgentStageStatus;
  message: string;
  outputText?: string;
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
      "Phase 2: free TTS audio chunks muxed into export when available; else browser speech + captions.",
    freeNow: true,
    qualityScore: 3,
    upgradePath:
      "Self-host Piper / Coqui XTTS for character clones and offline Hindi quality.",
  },
  {
    id: "video",
    name: "Video Agent",
    description:
      "Dual-panel cinematic + scene art + WebM/MP4 export. Motion still limited without GPU worker.",
    freeNow: true,
    qualityScore: 2,
    upgradePath:
      "Deploy open-source video worker (ComfyUI / AnimateDiff) and set WORKER_URL.",
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
