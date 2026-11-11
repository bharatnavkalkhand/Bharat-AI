# Bharat AI — Generative Media Stack

Status: architecture decision and integration registry. Listing a project here does not mean its code, weights, or runtime have been installed.

## Design rules

- Keep the React/Vite app as the control plane; never run large diffusion inference in Vercel functions.
- Keep the user's Nothing Phone (2a) as the local companion for speech, subtitle work, media caching, and final assembly—not as the primary diffusion GPU.
- Route heavy image, portrait-animation, and video inference to an explicitly configured GPU worker. A public demo is best-effort and may queue, rate-limit, or disappear.
- Prefer open-source implementations, but verify model-weight terms separately from source-code licenses. No paid API, subscription, or per-generation provider is required by this design.
- Do not claim a model is integrated until a real worker health check and artifact-producing smoke test pass.

## Approved component map

| Project | Bharat AI role | Execution target | Decision |
|---|---|---|---|
| [ComfyUI](https://github.com/Comfy-Org/ComfyUI) | Workflow backend for image/video pipelines | Separate GPU worker | Primary image workflow adapter candidate; not an Android runtime |
| [Diffusers](https://github.com/huggingface/diffusers) | Python model runtime and pipeline library | Separate GPU worker | Use inside model workers where supported; library, not a standalone app |
| [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) | Quantized/local image inference experiments | Desktop or compatible accelerator | Optional; Android feasibility must be benchmarked before adoption |
| [SD.Next](https://github.com/vladmandic/sdnext) | Alternative image/video UI and backend | Desktop/GPU worker | Evaluate as an alternative, not alongside every UI |
| [InvokeAI](https://github.com/invoke-ai/InvokeAI) | Creative image studio and workflows | Desktop/GPU worker | Optional alternative to ComfyUI |
| [Upscayl](https://github.com/upscayl/upscayl) | Image upscaling | Desktop; mobile only after port/benchmark | Post-processing candidate; desktop app is not an Android SDK |
| [Krita AI Diffusion](https://github.com/Acly/krita-ai-diffusion) | Artist-facing inpainting/outpainting | Desktop + ComfyUI | Optional creator integration, not core mobile runtime |
| [EchoMimic](https://github.com/antgroup/echomimic) | Audio-driven portrait animation | Separate GPU worker | High-priority optional talking-portrait/lip-sync worker; validate checkpoints and license |
| [Deep-Live-Cam](https://github.com/hacksider/Deep-Live-Cam) | Real-time face replacement | User-controlled desktop only | Optional, consent-only; not required for normal character animation |
| [Faceswap](https://github.com/deepfakes/faceswap) | Face replacement/training | User-controlled desktop only | Optional, consent-only; not part of default pipeline |

## Target architecture

```
Bharat AI web app (Vercel control plane)
  ├─ Script / scene / character planning
  ├─ Media jobs, status, artifacts, user controls
  └─ Worker adapter
       ├─ Image worker: ComfyUI + selected Diffusers pipeline
       ├─ Portrait worker: EchoMimic (optional)
       ├─ Video worker: current LTX-Video adapter; future models only after testing
       └─ Artifact storage: generated images, clips, audio
                         |
              Android companion (Nothing Phone 2a)
                ├─ Sherpa-ONNX speech / TTS candidate
                ├─ local subtitle and transcript tools
                ├─ local media cache
                └─ Android Media3 composition / export
```

## Worker contract

All remote inference adapters should implement:

- `GET /health` — ready state and version.
- `GET /capabilities` — model IDs, supported tasks, dimensions, durations, languages, limits, and hardware.
- `POST /jobs` — submit a job and return a stable job ID.
- `GET /jobs/:id` — queued/running/succeeded/failed/canceled plus progress and error.
- `GET /jobs/:id/artifacts` — real artifact metadata and URLs, only after files exist.

Every artifact should include MIME type, byte size, duration or dimensions where relevant, model ID, worker ID, and checksum. The UI must never treat a queued job or storyboard as a generated media file.

## Phone vs GPU boundary

The Nothing Phone (2a), with 8GB physical RAM and 128GB storage as reported by the user, is intended for offline speech, speech recognition, subtitles, local caching, and media assembly. Virtual RAM is storage-backed and is not equivalent to physical RAM. Android background limits and thermal throttling apply.

Do not target full ComfyUI, SD.Next, InvokeAI, Diffusers CUDA pipelines, or EchoMimic inference on this phone. The phone's browser also cannot reliably expose all device resources to a web page. Use a native Android companion with explicit user permissions and a foreground job service for long-running tasks.

## Integration order

1. Keep the existing LTX short-video adapter isolated and test a real MP4 before expanding it.
2. Add worker health/capability discovery and a generic job status/artifact contract.
3. Add ComfyUI as an optional GPU image worker; first smoke test: one generated PNG, then verify dimensions and actual file retrieval.
4. Add Upscayl-style upscaling only after the base image pipeline works.
5. Add EchoMimic as an optional portrait-animation worker; test a permitted sample portrait and audio input, verify actual MP4 and lip-sync.
6. Build the Android companion for local speech, subtitle support, caching, and Media3 composition/export.
7. Keep Deep-Live-Cam and Faceswap outside the default workflow; expose only as opt-in consent-based tools after security and licensing review.

## Acceptance criteria

- A worker is marked available only after its health endpoint succeeds.
- A generation job remains queued/running until the worker returns a completed artifact.
- A PNG/MP4/audio file can be fetched and opened; a URL string alone is not success.
- Worker failures do not break script/storyboard editing.
- No secrets are embedded in the Vite client bundle.
- Model weights and datasets are checked for redistribution and commercial-use terms before packaging.
- Face replacement or voice imitation requires authorization from the person represented.

## GPU host selection — first validation

**Selected first test host: Kaggle Notebooks (free GPU accelerator when available).**

Why this is the first candidate:
- Kaggle documents free notebook GPU access, including NVIDIA P100 and, depending on availability, T4 x2; GPU sessions are queued when capacity is busy.
- The notebook runtime is suitable for a controlled batch-generation smoke test and downloading the resulting artifact.
- It is **not** a persistent public inference server. Bharat AI on Vercel cannot depend on a Kaggle notebook remaining online or expose it as a production worker.

Official limits and caveats:
- Kaggle documents a weekly GPU quota (commonly 30 hours, subject to change) and session limits; availability can be queued.
- Google Colab free resources are not guaranteed. Its current FAQ explicitly disallows using free managed runtimes primarily as a web UI or distributed worker.
- Hugging Face ZeroGPU is shared and quota-limited. Its current documentation lists 5 minutes/day for free authenticated users and 2 minutes/day unauthenticated; hosting your own free ZeroGPU Space requires an account in good standing older than 30 days.

**Integration decision:** use Kaggle first for a one-shot GPU + real MP4 acceptance test. Do not register it as a live Bharat AI worker. Only after a playable MP4 is produced should we decide whether a compliant persistent worker is possible without payment. A browser login and GPU-session start must be performed by the account holder; no account credentials are stored in this repository.

### First GPU acceptance test

1. Open a Kaggle Notebook while signed in.
2. Set Notebook Settings → Accelerator → GPU (choose an available option).
3. Run `nvidia-smi` and record the actual GPU model and VRAM.
4. Run a CUDA/PyTorch availability check.
5. Run one short, low-resolution video-generation job only if the selected model fits the detected VRAM.
6. Verify the output file exists, is non-empty, reports MP4 MIME/container, and plays; then download it.
7. Record model, GPU, generation time, resolution, duration, and any quota/error. Do not mark the Bharat AI video adapter as connected based on GPU detection alone.
