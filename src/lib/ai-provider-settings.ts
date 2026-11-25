export type AiMode = "free" | "paid";
export type TextProvider = "browser" | "groq" | "mistral" | "omniroute";
export type ImageProvider = "pollinations" | "grok-imagine";
export type VideoProvider = "public-free" | "comfyui";
export type VoiceProvider = "browser";

export interface AiProviderSettings {
  mode: AiMode;
  textProvider: TextProvider;
  imageProvider: ImageProvider;
  videoProvider: VideoProvider;
  voiceProvider: VoiceProvider;
}

export const AI_PROVIDER_SETTINGS_KEY = "bharat_ai_provider_settings";

/** Developer default: change this constant or set the same value in deployment config later. */
export const DEVELOPER_DEFAULT_AI_MODE: AiMode = "free";

export const DEFAULT_AI_PROVIDER_SETTINGS: AiProviderSettings = {
  mode: DEVELOPER_DEFAULT_AI_MODE,
  textProvider: "browser",
  imageProvider: "pollinations",
  videoProvider: "public-free",
  voiceProvider: "browser",
};

const TEXT_PROVIDERS: TextProvider[] = ["browser", "groq", "mistral", "omniroute"];
const IMAGE_PROVIDERS: ImageProvider[] = ["pollinations", "grok-imagine"];
const VIDEO_PROVIDERS: VideoProvider[] = ["public-free", "comfyui"];

export function loadAiProviderSettings(): AiProviderSettings {
  if (typeof localStorage === "undefined") return DEFAULT_AI_PROVIDER_SETTINGS;
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_PROVIDER_SETTINGS_KEY) || "null") as Partial<AiProviderSettings> | null;
    if (!parsed) return DEFAULT_AI_PROVIDER_SETTINGS;
    return {
      mode: parsed.mode === "paid" ? "paid" : "free",
      textProvider: TEXT_PROVIDERS.includes(parsed.textProvider as TextProvider) ? parsed.textProvider as TextProvider : "browser",
      imageProvider: IMAGE_PROVIDERS.includes(parsed.imageProvider as ImageProvider) ? parsed.imageProvider as ImageProvider : "pollinations",
      videoProvider: VIDEO_PROVIDERS.includes(parsed.videoProvider as VideoProvider) ? parsed.videoProvider as VideoProvider : "public-free",
      voiceProvider: "browser",
    };
  } catch {
    return DEFAULT_AI_PROVIDER_SETTINGS;
  }
}

export function saveAiProviderSettings(settings: AiProviderSettings): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(AI_PROVIDER_SETTINGS_KEY, JSON.stringify(settings));
  }
}
