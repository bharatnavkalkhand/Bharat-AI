import { useState } from "react";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Save } from "lucide-react";
import {
  checkComfyImageWorker,
  generateComfyImage,
  getComfyImageJob,
  loadComfyImageWorkflow,
  saveComfyImageWorkflow,
  type ComfyImageArtifact,
} from "@/agents/comfyui-image-worker";

export function ComfyImageStudio() {
  const [workflowText, setWorkflowText] = useState(() => {
    const saved = loadComfyImageWorkflow();
    return saved ? JSON.stringify(saved.workflow, null, 2) : "";
  });
  const [promptNodeId, setPromptNodeId] = useState(() => loadComfyImageWorkflow()?.promptNodeId || "");
  const [workerUrl, setWorkerUrl] = useState(() => (typeof localStorage !== "undefined" ? localStorage.getItem("bharat_comfyui_url") || "" : ""));
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("low quality, blurry, distorted, watermark, text");
  const [message, setMessage] = useState("Import a ComfyUI API-format workflow to enable image generation.");
  const [busy, setBusy] = useState(false);
  const [workerReady, setWorkerReady] = useState<boolean | null>(null);
  const [images, setImages] = useState<ComfyImageArtifact[]>([]);

  function saveWorkflow() {
    try {
      const workflow = JSON.parse(workflowText) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
      saveComfyImageWorkflow({ workflow, promptNodeId });
      setMessage("Workflow saved on this device. It is not uploaded to Bharat AI servers.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid workflow JSON.");
    }
  }

  function saveWorkerUrl() {
    const value = workerUrl.trim().replace(/\/$/, "");
    if (!value) { setMessage("Enter your ComfyUI worker URL first."); return; }
    localStorage.setItem("bharat_comfyui_url", value);
    setWorkerReady(null);
    setMessage("Worker URL saved on this device. Now check the connection.");
  }

  async function checkWorker() {
    setBusy(true);
    if (workerUrl.trim()) localStorage.setItem("bharat_comfyui_url", workerUrl.trim().replace(/\/$/, ""));
    const result = await checkComfyImageWorker();
    setWorkerReady(result.available);
    setMessage(result.reason);
    setBusy(false);
  }

  async function generate() {
    if (workerUrl.trim()) localStorage.setItem("bharat_comfyui_url", workerUrl.trim().replace(/\/$/, ""));
    if (!prompt.trim()) { setMessage("Enter a scene prompt first."); return; }
    setBusy(true);
    setImages([]);
    const submitted = await generateComfyImage({ prompt: prompt.trim(), negativePrompt });
    if (submitted.status === "failed") {
      setMessage(submitted.error);
      setBusy(false);
      return;
    }
    setMessage("Image job queued. Waiting for ComfyUI…");
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const result = await getComfyImageJob(submitted.promptId);
      if (result.status === "succeeded") {
        setImages(result.images);
        setMessage(`Generated ${result.images.length} image(s) successfully.`);
        setBusy(false);
        return;
      }
      if (result.status === "failed") {
        setMessage(result.error);
        setBusy(false);
        return;
      }
      setMessage(`ComfyUI is processing the image… (${attempt + 1}/90)`);
    }
    setMessage("Generation is still running. Check the ComfyUI queue; this screen stopped polling after 3 minutes.");
    setBusy(false);
  }

  return (
    <section className="card-pro mb-5 space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">ComfyUI Image Studio</h2>
          <p className="text-[11px] text-muted">Local / self-hosted image generation · no Bharat AI API key</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] ${workerReady === true ? "bg-emerald-500/15 text-emerald-400" : workerReady === false ? "bg-red-500/15 text-red-400" : "bg-border text-muted"}`}>
          {workerReady === true ? "Worker online" : workerReady === false ? "Worker offline" : "Not checked"}
        </span>
      </div>
      <label className="block space-y-1 text-xs">
        <span>ComfyUI worker URL (must be reachable from this phone/browser)</span>
        <input value={workerUrl} onChange={(e) => setWorkerUrl(e.target.value)} placeholder="https://your-comfyui-worker.example.com" className="w-full rounded-lg border border-border bg-bg px-3 py-2" />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={saveWorkerUrl} disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs">Save worker URL</button>
        <button type="button" onClick={() => void checkWorker()} disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs">Check worker</button>
        <button type="button" onClick={saveWorkflow} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs"><Save className="h-3 w-3" /> Save workflow</button>
      </div>
      <label className="block space-y-1 text-xs">
        <span>Prompt node ID (from your exported API workflow)</span>
        <input value={promptNodeId} onChange={(e) => setPromptNodeId(e.target.value)} placeholder="e.g. 6" className="w-full rounded-lg border border-border bg-bg px-3 py-2" />
      </label>
      <label className="block space-y-1 text-xs">
        <span>ComfyUI API workflow JSON</span>
        <textarea value={workflowText} onChange={(e) => setWorkflowText(e.target.value)} rows={5} placeholder="Paste the workflow exported using ComfyUI → Save (API Format)" className="w-full rounded-lg border border-border bg-bg px-3 py-2 font-mono text-[10px]" />
      </label>
      <label className="block space-y-1 text-xs">
        <span>Image prompt</span>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Describe a cinematic scene or character…" className="w-full rounded-lg border border-border bg-bg px-3 py-2" />
      </label>
      <label className="block space-y-1 text-xs">
        <span>Negative prompt</span>
        <input value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} className="w-full rounded-lg border border-border bg-bg px-3 py-2" />
      </label>
      <button type="button" onClick={() => void generate()} disabled={busy || !prompt.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        Generate image
      </button>
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
        {workerReady ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" /> : <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />}
        {message}
      </p>
      {images.map((image) => (
        <figure key={image.filename + image.subfolder} className="space-y-1">
          <img src={image.url} alt="Generated by ComfyUI" className="w-full rounded-lg" />
          <figcaption className="text-[10px] text-muted">{image.filename}</figcaption>
          <a href={image.url} target="_blank" rel="noreferrer" className="text-xs text-accent underline">Open original image</a>
        </figure>
      ))}
      <p className="text-[10px] leading-relaxed text-muted">Requires a running ComfyUI instance reachable from this browser, with CORS enabled. The workflow JSON is saved only in this browser's local storage. It is not a cloud GPU service.</p>
    </section>
  );
}
