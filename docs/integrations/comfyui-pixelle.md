# ComfyUI + Pixelle patterns in Bharat AI

We do **not** vendor ComfyUI, StabilityMatrix, or Pixelle-Video into the Vercel app.
We take their **best product patterns** and attach them as **self-serve workers**.

| Upstream | Role for Bharat |
|----------|------------------|
| [ComfyUI](https://github.com/Comfy-Org/ComfyUI) | Local GPU engine (I2V / T2V) |
| [StabilityMatrix](https://github.com/LykosAI/StabilityMatrix) | Easy Windows install of ComfyUI (docs only) |
| [Pixelle-Video](https://github.com/ATH-MaaS/Pixelle-Video) | UX patterns: one-topic short, digital human, motion transfer |

## What we integrated in code

1. **`src/agents/comfyui-worker.ts`**
   - `createComfyUiWorker()` — `GpuWorkerAdapter`
   - URL: `localStorage bharat_comfyui_url` (e.g. `http://127.0.0.1:8188`)
   - Path A: HTTP bridge `/quota` `/submit` `/status/:id` (recommended)
   - Path B: native Comfy `/prompt` + `/history` (best-effort)

2. **Produce UI**
   - **C · Local ComfyUI URL**
   - **Image	o video (Comfy)** when face/still + URL set

3. **Existing**
   - HF ZeroGPU (`hf-zerogpu-worker`) — free cloud short clips
   - MuseTalk / LivePortrait (`musetalk-worker`) — lip-sync Space

## Pixelle ideas mapped to Bharat

| Pixelle | Bharat |
|---------|--------|
| Topic → auto short | Script agent + scenes + one-click pipeline |
| Digital human | Face photo + Lip Space Animate |
| Motion transfer | LivePortrait / Comfy I2V (photo + motion) |
| Image-to-video | ComfyUI worker / HF Wan |
| BGM + TTS | Voice import + future BGM pack |
| Templates 9:16 | Bharat story templates |

## Setup (PC, one time)

1. Install [StabilityMatrix](https://github.com/LykosAI/StabilityMatrix) **or** raw ComfyUI.
2. Start ComfyUI (default `http://127.0.0.1:8188`).
3. Load an **Image-to-Video** workflow (e.g. Wan) and export API format if using a bridge.
4. In Bharat AI → Produce → paste URL into **C · Local ComfyUI**.
5. Add cast face photo → **Image	o video (Comfy)**.

Same-device browser can reach localhost. Phone browser cannot see PC localhost unless you use LAN IP + CORS proxy.

## Legal

- ComfyUI: GPL-3.0 (run separately; we only call HTTP).
- Pixelle-Video: Apache-2.0 (patterns only; no source copy required).
- StabilityMatrix: AGPL-3.0 (installer only; not shipped in our app).
