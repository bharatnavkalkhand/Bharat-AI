---
title: Bharat AI Video Worker
sdk: gradio
app_file: app.py
pinned: false
---

# Bharat AI Video Worker (HF ZeroGPU)

Short **silent 16:9** scene clips using **Wan 2.1 T2V 1.3B**.

## Deploy

1. Create a new [Hugging Face Space](https://huggingface.co/new-space)
2. SDK: **Gradio** · Hardware: **ZeroGPU**
3. Upload `app.py` + `requirements.txt` from this folder
4. Wait for build → copy Space URL
5. Paste URL into Bharat AI Produce page (worker field)

## Limits

- Free accounts: ~**5 GPU minutes / day**
- Clip lengths: 17 / 33 / 49 frames @ 16 fps (~1–3 s)
- Resolution: 832×480 (16:9)
- **No audio** in this worker — Bharat AI adds TTS later

## API

Gradio endpoint `generate(prompt, num_frames, seed)` → MP4 path.
App adapter: `src/agents/hf-zerogpu-worker.ts`
