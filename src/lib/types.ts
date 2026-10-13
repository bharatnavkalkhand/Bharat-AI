import { z } from "zod";

/** Core domain types for Bharat AI avatar movie production */

export const LanguageSchema = z.enum(["en", "hi"]);
export type Language = z.infer<typeof LanguageSchema>;

export const MovieDurationSchema = z.enum(["5min", "10min"]);
export type MovieDuration = z.infer<typeof MovieDurationSchema>;

/** Scene mood / action tags for avatar movie effects */
export const SceneMoodSchema = z.enum([
  "neutral",
  "romance",
  "fight",
  "gesture",
  "dialogue",
  "action",
  "emotional",
  "comedy",
  "dramatic",
]);
export type SceneMood = z.infer<typeof SceneMoodSchema>;

export const SceneStatusSchema = z.enum([
  "draft",
  "queued",
  "generating",
  "completed",
  "failed",
  "cancelled",
]);
export type SceneStatus = z.infer<typeof SceneStatusSchema>;

export const JobStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  appearance: z.string().max(800).optional(),
  personality: z.string().max(500).optional(),
  role: z.string().max(80).optional(),
  voiceId: z.string().optional(),
  /** Remote or data URL for reference image (keeps avatar consistent) */
  referenceImageUrl: z.string().optional(),
  referenceImageLocal: z.string().optional(),
});
export type Character = z.infer<typeof CharacterSchema>;

export const SceneSchema = z.object({
  id: z.string(),
  order: z.number().int().min(0),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  dialogue: z.string().max(3000).optional(),
  narration: z.string().max(3000).optional(),
  visualPrompt: z.string().max(1500).optional(),
  /** Explicit mood for fight / romance / gesture generation */
  mood: SceneMoodSchema.default("neutral"),
  camera: z.string().max(300).optional(),
  /** Gesture or action notes (e.g. "hand on heart", "sword clash") */
  gestureNotes: z.string().max(400).optional(),
  estimatedDurationSec: z.number().min(3).max(120).optional(),
  status: SceneStatusSchema.default("draft"),
  outputUrl: z.string().optional(),
  audioUrl: z.string().optional(),
  errorMessage: z.string().optional(),
  characterIds: z.array(z.string()).default([]),
});
export type Scene = z.infer<typeof SceneSchema>;

export const MovieSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  synopsis: z.string().max(2000).optional(),
  language: LanguageSchema.default("en"),
  targetDuration: MovieDurationSchema.default("5min"),
  /** Genre hints that drive scene mood suggestions */
  genres: z.array(z.string()).default([]),
  characters: z.array(CharacterSchema).default([]),
  scenes: z.array(SceneSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z
    .enum(["draft", "planning", "generating", "assembling", "ready", "failed"])
    .default("draft"),
});
export type Movie = z.infer<typeof MovieSchema>;

export const GenerationJobSchema = z.object({
  id: z.string(),
  movieId: z.string(),
  sceneId: z.string().optional(),
  type: z.enum([
    "script",
    "image",
    "voice",
    "video",
    "avatar",
    "assemble",
  ]),
  status: JobStatusSchema,
  provider: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
  resultUrl: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GenerationJob = z.infer<typeof GenerationJobSchema>;

/** Provider-independent media generation interface */
export interface MediaProvider {
  id: string;
  name: string;
  isFreeTierCompatible: boolean;
  supports: {
    image: boolean;
    video: boolean;
    tts: boolean;
    avatar: boolean;
  };
  submitJob(input: unknown): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<GenerationJob>;
  getResult(jobId: string): Promise<{ url: string } | null>;
}

/** Helper for building strong visual prompts from mood */
export function moodToPromptHint(mood: SceneMood): string {
  switch (mood) {
    case "fight":
      return "dynamic action, intense combat, powerful poses, motion blur, cinematic fight scene, dramatic lighting";
    case "romance":
      return "tender romance, soft lighting, emotional closeness, gentle gestures, warm color grading, intimate atmosphere";
    case "gesture":
      return "expressive body language, clear hand and face gestures, character acting, emotional expression";
    case "action":
      return "high energy action, dynamic camera, powerful movement";
    case "emotional":
      return "deep emotion, expressive face and posture, dramatic lighting";
    case "comedy":
      return "light-hearted, exaggerated expressions, comedic timing";
    case "dramatic":
      return "high drama, strong contrast, intense atmosphere";
    case "dialogue":
      return "two-shot conversation, clear faces, natural gestures";
    default:
      return "cinematic composition, clear characters, film still quality";
  }
}
