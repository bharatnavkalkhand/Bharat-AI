# Hugging Face image-to-video Space review

Review date: 2026-11-11  
Target: https://huggingface.co/spaces/thea2026/image-to-video  
Repository: https://github.com/bharatnavkalkhand/Bharat-AI

## Decision

**Do not connect this Space to Bharat AI as a production image-to-video provider yet.** The public source and its actual inference contract could not be retrieved during this review. Available public descriptions suggest that the Space may be a Gradio front end delegating work to a remote service, but that claim has not been verified against its own app.py, README, network requests, or a successful generation. No endpoint, model, pricing, data-retention policy, or free quota is therefore approved.

This is a hold pending source-level and runtime verification, not a rejection of image-to-video as a feature.

## What was checked

- The target Space page and public API/source URLs were attempted, but the available retrieval path returned an access/internal error.
- Public third-party directory descriptions characterize it as a Gradio-style front end and mention a remote generation service. These are **unverified secondary reports**, not an authoritative technical specification.
- The repository's existing video path was inspected:
  - workers/hf-zerogpu/app.py is a Wan 2.1 text-to-video worker.
  - src/agents/hf-zerogpu-worker.ts sends prompt/frame/seed to a Gradio queue endpoint.
  - src/agents/video-agent.ts currently routes video jobs through configured ComfyUI, a shared LTX demo, or storyboard fallback.
  - The existing Wan adapter is **text-to-video**, not image-to-video. It must not be presented as implementing the target Space's feature.

## Evidence still required before integration

1. Read the target Space's own README and complete source (app.py and imported modules).
2. Identify the actual model and inference host. Confirm whether inference runs in the Space or is forwarded elsewhere.
3. Capture the exact Gradio API schema (api_name, input order/types, queue/poll flow, and output format) from the live Space.
4. Run one image-to-video request using a test image that contains no personal or sensitive information; verify a playable MP4 is actually returned.
5. Verify provider terms, model-weight license, commercial-use rights, image handling, retention, and whether the remote backend is genuinely free. A free Space frontend or Apache-2.0 Space code does not prove the inference service is free or open source.
6. Measure clip duration, resolution, latency, queue behavior, rate limits, and failure responses.

## Safe integration design after verification

- Add a separate image-to-video worker adapter; do not overload the current text-to-video adapter.
- Adapter inputs: image file/URL, motion prompt, optional duration/seed/aspect ratio.
- Adapter output: job ID, queued/running/succeeded/failed state, and a verified MP4 artifact URL plus MIME type and duration.
- Keep remote provider hostnames behind an explicit allow-list. Do not accept arbitrary URLs from the browser or proxy arbitrary hosts through Vercel.
- Do not store provider secrets in the Vite client. If the service requires a key, it is not a no-key public integration.
- Keep this provider opt-in and clearly label any quota, queue, privacy, or external-service dependency.
- Preserve the existing Wan/LTX/ComfyUI paths and storyboard fallback. A failure in this optional adapter must not break script, audio, or storyboard stages.

## Acceptance gate

Integration may be merged only when all of the following pass:

- Source and backend ownership are understood.
- Model and service terms are reviewed.
- A real image-to-video job completes.
- The returned MP4 is fetched, has non-zero size, correct video MIME/container, and plays.
- CORS/proxy behavior and failure handling are tested.
- No paid dependency or undisclosed external API is introduced.
- Build and typecheck pass.

## Current status

**Not integrated. Not deployed. No successful image-to-video output verified.** The research branch contains this review so the next implementation step is evidence-driven rather than based on guessed API endpoints.
