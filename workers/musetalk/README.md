# Bharat AI — MuseTalk / LivePortrait Lip-Sync Worker

Free **talking-head** generation for portrait photos + audio.

This is **Part B** of the lip-sync upgrade:

- **Part A (client):** MediaPipe Face Landmarker places the free-path lip overlay on the *real* mouth of the photo.
- **Part B (worker):** Optional ZeroGPU Space runs MuseTalk or LivePortrait so the *photo’s own lips* move naturally.

## What to deploy

1. Create a [Hugging Face Space](https://huggingface.co/new-space)
2. SDK: **Gradio** · Hardware: **ZeroGPU** (or Community GPU if available)
3. Use a public MuseTalk or LivePortrait Gradio app (community Spaces already exist)
4. Copy the Space URL into Bharat AI:
   - Browser console: `localStorage.setItem('bharat_musetalk_space', 'https://huggingface.co/spaces/USER/SPACE')`
   - Or paste into Produce page worker field when UI exposes it

## Client adapter

`src/agents/musetalk-worker.ts`

- Implements `GpuWorkerAdapter` from `gpu-worker-pool.ts`
- Submit: face image URL + audio/prompt
- Poll Gradio `event_id` → `videoUrl`
- On success: import video as scene `externalVideoLocal` / `videoUrl`

## Limits

- ZeroGPU free quota is limited (minutes per day)
- Gradio API endpoint names vary by Space (`generate` / `predict` / custom)
- First cold start downloads weights and can take several minutes
- Prefer short clips (3–8s) for free tier

## Legal / product notes

- Use public product patterns and open-source workers only
- Do not reverse-engineer proprietary commercial lip-sync products
- MuseTalk (MIT) and LivePortrait (MIT) are preferred licenses for commercial use
