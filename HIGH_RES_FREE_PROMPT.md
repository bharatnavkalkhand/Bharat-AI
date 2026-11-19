# Bharat AI — Free High-Resolution Image & Video Prompt Generator

**Goal:** Turn a simple text prompt into high-resolution images and short AI videos at ₹0 (no paid credits or tokens required for the free path).

Live app: https://bharat-ai-chi.vercel.app  
Repo: https://github.com/bharatnavkalkhand/Bharat-AI

## How to use (prompt → media)

1. Open the app → create or open a movie → go to **Produce**.
2. Write a clear scene prompt (subject + action + setting + lighting + camera + style).  
   Example: *"Young woman in a monsoon rain, standing under a street lamp, cinematic lighting, Indian film still, sharp details, 35mm"*
3. **Images (high-res free):** Use the free text-to-image path (Pollinations public API). Defaults now favor higher resolution (1024+). No key needed. Results are downloadable stills.
4. **Videos (short free):** Paste a free HF ZeroGPU Space URL (see FREE_VIDEO_PATH.md) or use public LTX / MiniMax Spaces. Optional free HF token (browser localStorage only) increases daily quota.
5. Preview in the scene player, add voice (Web Speech free), export or import external clips.

## Free high-res capabilities

| Type | Free path | Typical resolution | Cost | Notes |
|------|-----------|--------------------|------|-------|
| Still image | Pollinations public API | 1024×1024 / 1280×720+ | ₹0 | No key; rate limits apply; enhance=true; model=flux |
| Short video | HF ZeroGPU Wan 2.1 / public LTX / MiniMax Spaces | 480p–720p short clips | ₹0 | Daily GPU minutes limited; optional free HF token |
| Lip-sync | MuseTalk / LivePortrait optional Space | Portrait | ₹0 | After you have face + audio |
| Unlimited high-res | Self-host ComfyUI + open models (Wan, LTX, Flux) on your GPU | Up to 4K local | Electricity only | See docs/GENERATIVE_MEDIA_STACK.md & comfyui-worker |

## Prompt tips for better high-res results

- Be specific: subject, clothing, expression, environment, lighting, lens, style (cinematic, photoreal, Indian cinema).
- Add "sharp details, high resolution, clear faces, no text, no watermark".
- For video: keep motion simple (one clear action) because free Spaces favor short clips.
- Seed control for reproducibility.
- For true 1080p+/4K unlimited: run local ComfyUI (open-source) with open weights.

## Honest limits (non-negotiable)

- No unlimited multi-minute photoreal free movies on shared free GPUs.
- Public APIs and ZeroGPU Spaces have rate limits / daily quotas.
- Quality varies; faces are not identity-locked unless you use external import or local models.
- Paid Grok Imagine remains optional and OFF by default.

## Next steps for even higher quality

- Deploy your own HF ZeroGPU Space from `workers/hf-zerogpu/`.
- Or run ComfyUI locally / on free Kaggle/Colab for higher res and longer clips (subject to their free GPU quotas).
- Import external free generations (Civitai, etc.) via ExternalStudioPanel.

This project is the free prompt-to-media control plane. Heavy generation stays on free public Spaces or your own open-source workers.
