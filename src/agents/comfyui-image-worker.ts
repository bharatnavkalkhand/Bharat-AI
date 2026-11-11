/**
 * ComfyUI image-generation adapter.
 *
 * Uses ComfyUI's native /prompt, /history/:prompt_id and /view endpoints.
 * A real API-format workflow must be exported from ComfyUI and configured in
 * localStorage. No guessed node graph or fake image URL is generated here.
 */

export interface ComfyImageWorkflowConfig {
  workflow: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
  promptNodeId: string;
  promptInputName?: string;
  negativePromptNodeId?: string;
  negativePromptInputName?: string;
}

export interface ComfyImageArtifact {
  url: string;
  filename: string;
  subfolder: string;
  type: string;
}

export type ComfyImageJob =
  | { status: "queued" | "running"; promptId: string }
  | { status: "succeeded"; promptId: string; images: ComfyImageArtifact[] }
  | { status: "failed"; promptId?: string; error: string };

const WORKFLOW_KEY = "bharat_comfyui_image_workflow";
const URL_KEY = "bharat_comfyui_url";

function baseUrl(value?: string): string {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(URL_KEY) || "" : "";
  return (value || stored).trim().replace(/\/$/, "");
}

export function saveComfyImageWorkflow(config: ComfyImageWorkflowConfig): void {
  if (typeof localStorage === "undefined") throw new Error("Workflow settings require a browser.");
  if (!config.workflow || !config.promptNodeId || !config.workflow[config.promptNodeId]) {
    throw new Error("Choose a valid API workflow and prompt node before saving.");
  }
  localStorage.setItem(WORKFLOW_KEY, JSON.stringify(config));
}

export function loadComfyImageWorkflow(): ComfyImageWorkflowConfig | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(WORKFLOW_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ComfyImageWorkflowConfig;
    if (!parsed.workflow || !parsed.promptNodeId || !parsed.workflow[parsed.promptNodeId]) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function checkComfyImageWorker(url?: string): Promise<{
  available: boolean;
  reason: string;
}> {
  const base = baseUrl(url);
  if (!base) return { available: false, reason: "Set the ComfyUI base URL first." };
  try {
    const response = await fetch(`${base}/system_stats`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { available: false, reason: `ComfyUI returned HTTP ${response.status}.` };
    const data = (await response.json()) as { system?: { vram_total?: number; vram_free?: number } };
    const gpu = data.system?.vram_total
      ? ` GPU VRAM: ${Math.round(data.system.vram_free || 0)} free of ${Math.round(data.system.vram_total)} bytes.`
      : "";
    return { available: true, reason: `ComfyUI API reachable.${gpu}` };
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : "ComfyUI is unreachable." };
  }
}

export async function generateComfyImage(input: {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  url?: string;
}): Promise<ComfyImageJob> {
  const base = baseUrl(input.url);
  if (!base) return { status: "failed", error: "ComfyUI URL is not configured." };
  const config = loadComfyImageWorkflow();
  if (!config) return { status: "failed", error: "Import and save a ComfyUI API-format workflow first." };

  const workflow = structuredClone(config.workflow);
  const promptNode = workflow[config.promptNodeId];
  if (!promptNode?.inputs) return { status: "failed", error: "Configured prompt node is missing from the workflow." };
  promptNode.inputs[config.promptInputName || "text"] = input.prompt;

  if (config.negativePromptNodeId && workflow[config.negativePromptNodeId]) {
    workflow[config.negativePromptNodeId].inputs[config.negativePromptInputName || "text"] =
      input.negativePrompt || "low quality, blurry, distorted, watermark, text";
  }

  // Apply common KSampler settings when the configured graph contains one.
  for (const node of Object.values(workflow)) {
    if (node.class_type === "KSampler" && node.inputs) {
      if (typeof input.seed === "number") node.inputs.seed = input.seed;
    }
    if (node.class_type === "EmptyLatentImage" && node.inputs) {
      if (input.width) node.inputs.width = input.width;
      if (input.height) node.inputs.height = input.height;
    }
  }

  try {
    const response = await fetch(`${base}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await response.json().catch(() => ({}))) as { prompt_id?: string; error?: unknown; node_errors?: unknown };
    if (!response.ok || !body.prompt_id) {
      return { status: "failed", error: `ComfyUI rejected workflow (HTTP ${response.status}): ${JSON.stringify(body).slice(0, 500)}` };
    }
    return { status: "queued", promptId: body.prompt_id };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "ComfyUI submit failed." };
  }
}

export async function getComfyImageJob(promptId: string, url?: string): Promise<ComfyImageJob> {
  const base = baseUrl(url);
  if (!base) return { status: "failed", promptId, error: "ComfyUI URL is not configured." };
  try {
    const response = await fetch(`${base}/history/${encodeURIComponent(promptId)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return { status: "failed", promptId, error: `ComfyUI history returned HTTP ${response.status}.` };
    const history = (await response.json()) as Record<string, {
      outputs?: Record<string, { images?: Array<{ filename: string; subfolder?: string; type?: string }> }>;
      status?: { status_str?: string; completed?: boolean };
    }>;
    const item = history[promptId];
    if (!item) return { status: "running", promptId };

    const images: ComfyImageArtifact[] = [];
    for (const output of Object.values(item.outputs || {})) {
      for (const image of output.images || []) {
        if (!image.filename) continue;
        const subfolder = image.subfolder || "";
        const type = image.type || "output";
        const params = new URLSearchParams({ filename: image.filename, subfolder, type });
        images.push({
          url: `${base}/view?${params.toString()}`,
          filename: image.filename,
          subfolder,
          type,
        });
      }
    }
    if (images.length) return { status: "succeeded", promptId, images };
    if (item.status?.status_str === "error") {
      return { status: "failed", promptId, error: "ComfyUI reported a workflow execution error." };
    }
    return { status: "running", promptId };
  } catch (error) {
    return { status: "failed", promptId, error: error instanceof Error ? error.message : "ComfyUI status check failed." };
  }
}
