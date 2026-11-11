import {
  createAiSharedLayer,
  type AiExecutionAdapter,
  type AiModel,
  type ToolRole,
} from "./shared-core";
import {
  generateComfyImage,
  getComfyImageJob,
  loadComfyImageWorkflow,
  type ComfyImageArtifact,
} from "@/agents/comfyui-image-worker";

const IMAGE_ROLE: ToolRole = {
  id: "image.generate",
  label: "Generate image",
  capability: "image-generation",
  inputs: [{ id: "prompt", required: true }],
};
const IMAGE_CONNECTION_ID = "comfyui-local-image";
const IMAGE_MODEL_ID = "comfyui-configured-image-workflow";

const comfyImageAdapter: AiExecutionAdapter = {
  id: "comfyui-image",
  async execute({ input, signal }) {
    const submitted = await generateComfyImage({
      prompt: String(input.prompt || ""),
      negativePrompt: typeof input.negativePrompt === "string" ? input.negativePrompt : undefined,
    });
    if (submitted.status === "failed") throw new Error(submitted.error);
    for (let attempt = 0; attempt < 90; attempt += 1) {
      if (signal.aborted) throw new Error("Image generation cancelled.");
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const status = await getComfyImageJob(submitted.promptId);
      if (status.status === "succeeded") return { output: { images: status.images } };
      if (status.status === "failed") throw new Error(status.error);
    }
    throw new Error("Image generation is still running after 3 minutes; check the ComfyUI queue.");
  },
};

export const bharatImageAi = createAiSharedLayer({
  appId: "bharat-ai-image-studio",
  adapters: [comfyImageAdapter],
});

/** Register the configured local image workflow as a real, explicitly executable model. */
export async function prepareComfyImageAi(): Promise<void> {
  const workflow = loadComfyImageWorkflow();
  if (!workflow) throw new Error("Import and save a ComfyUI API-format workflow first.");
  const health = await (await import("@/agents/comfyui-image-worker")).checkComfyImageWorker();
  if (!health.available) throw new Error(health.reason);

  if (!bharatImageAi.customTools().some((tool) => tool.id === IMAGE_ROLE.id)) {
    bharatImageAi.registerTool(IMAGE_ROLE);
  }
  const url = localStorage.getItem("bharat_comfyui_url") || "";
  bharatImageAi.upsertConnection({
    id: IMAGE_CONNECTION_ID,
    label: "User-configured ComfyUI",
    provider: "comfyui",
    adapterId: comfyImageAdapter.id,
  });
  const model: AiModel = {
    id: IMAGE_MODEL_ID,
    connectionId: IMAGE_CONNECTION_ID,
    label: "Configured ComfyUI image workflow",
    capabilities: ["image-generation"],
    inputs: [{ id: "prompt", required: true }],
    enabled: true,
  };
  bharatImageAi.upsertModel(model);
  bharatImageAi.choose(IMAGE_ROLE.id, IMAGE_CONNECTION_ID, IMAGE_MODEL_ID);
  if (!url.trim()) throw new Error("ComfyUI URL is not configured.");
}

export interface BharatImageOutput {
  images: ComfyImageArtifact[];
}
