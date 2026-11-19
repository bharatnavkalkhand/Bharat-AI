# Bharat AI — Free High-Resolution Image & Video Prompt Generator

**Goal:** Turn a simple text prompt into high-resolution images and short AI videos at ₹0 (no paid credits or tokens required for the free path).

Live app: https://bharat-ai-chi.vercel.app  
**Direct generator:** https://bharat-ai-chi.vercel.app/generate  
Repo: https://github.com/bharatnavkalkhand/Bharat-AI

## How to use (prompt → media)

### Simple path (recommended for one-off generations)

1. Open the app and go to **/generate** (or the Free Prompt Generator link on the home page).
2. Write a clear prompt (subject + action + setting + lighting + camera + style).  
   Example: *"Young woman in a monsoon rain, standing under a street lamp, cinematic lighting, Indian film still, sharp details, 35mm"*
3. Choose **Image** or **Video** and click Generate.
4. Download the result. Images are high-res stills; videos are short silent clips.

### Full movie studio path

1. Create or open a movie → go to **Produce**.
2. Generate script/scenes, then use the Text → Image and Generate GPU video buttons in Director Controls.
3. Preview in the scene player, add voice (Web Speech free), export or import external clips.

## Free high-res capabilities

| Type | Free path | Typical resolution | Cost | Notes |
|------|-----------|--------------------|------|-------|
| Still image | Pollinations public API (classic) | 1024×1024 / 1280×720 | ₹0 | No key; rate limits (~45s between requests); enhance=true; model=flux |
| Short video | Public HF ZeroGPU Spaces (MiniMax / LTX) + own Wan worker | 480p short clips (~2–5s) | ₹0 | Daily GPU minutes limited; optional free HF token in browser |
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
- Pollinations classic free path is rate-limited; newer gen.pollinations.ai requires keys/Pollen.

## Next steps for even higher quality

- Deploy your own HF ZeroGPU Space from `workers/hf-zerogpu/`.
- Or run ComfyUI locally / on free Kaggle/Colab for higher res and longer clips (subject to their free GPU quotas).
- Import external free generations (Civitai, etc.) via ExternalStudioPanel.

This project is the free prompt-to-media control plane. Heavy generation stays on free public Spaces or your own open-source workers.
