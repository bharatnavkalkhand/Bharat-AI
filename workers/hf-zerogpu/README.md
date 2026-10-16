---
title: Bharat AI Video Worker
sdk: gradio
app_file: app.py
pinned: false
---

# Bharat AI Video Worker (HF ZeroGPU)

Short **silent 16:9** scene clips using **Wan 2.1 T2V 1.3B**.

## Deploy

1. Create a new [Hugging Face Space](https://huggingface.co/new-space).
2. SDK: **Gradio** · Hardware: **ZeroGPU**.
3. Upload `app.py` + `requirements.txt` from this folder.
4. Wait for the first build/startup. The first startup downloads the model weights and may take several minutes.
5. Copy the Space URL and paste it into the Bharat AI Produce page's worker field.

## Limits and runtime

- Free personal accounts in good standing can host up to 2 ZeroGPU Spaces.
- Free ZeroGPU usage quota is **5 GPU minutes per 24-hour quota window**, shared across Spaces; the window resets 24 hours after first GPU use.
- The worker reserves a starting budget of 120 seconds for 17 frames, 180 seconds for 33 frames, and 240 seconds for 49 frames. These are initial estimates, not measured timings; adjust after testing the live Space.
- A request is checked against the **reserved duration**, not just actual runtime. With the free 300-second quota, a 33-frame test can leave only about 120 seconds available for the rest of the quota window.
- Clip lengths: 17 / 33 / 49 frames at 16 fps (~1.1 / 2.1 / 3.1 seconds).
- Resolution: 832×480 (16:9).
- **No audio** in this worker — voice generation, lip-sync, and movie assembly are separate stages.
- The worker and its generation settings have not yet been tested against a live Space. Successful CI/source checks do not prove GPU inference will fit the reservation or return an MP4.

## API

Gradio endpoint `generate(prompt, num_frames, seed)` → MP4 path.
App adapter: `src/agents/hf-zerogpu-worker.ts`
