# Free AI video path (₹0 / no tokens)

Canonical guide for turning Bharat AI into a **usable free AI video generator** without paid credits.

## Principles

1. Canonical repo: `bharatnavkalkhand/Bharat-AI` only.
2. Prefer free / local / open-source workers.
3. Never add paid GPU/API dependencies without explicit approval.
4. Public product patterns only — no proprietary reverse engineering.

---

## Path A — HF ZeroGPU text-to-video (primary)

### What it does
Generates short, silent 16:9 AI video clips using Wan 2.1 T2V 1.3B on
Hugging Face ZeroGPU. Free tier gives ~5 GPU-min/day per account; a ~2s clip
costs ~45 GPU-seconds. The video agent generates up to **3 clips per run**
(one per scene, in order) to stay within the daily budget, then falls back
to storyboard placeholders for remaining scenes.

### Files
- Worker Space: `workers/hf-zerogpu/app.py` + `requirements.txt`
- Client adapter: `src/agents/hf-zerogpu-worker.ts`
- Video agent routing: `src/agents/video-agent.ts`

### Deploy your own HF Space (5 steps)

1. **Create a Hugging Face account** at https://huggingface.co (free).
2. **Create a new Space**:
   - Go to https://huggingface.co/new-space
   - SDK: **Gradio**
   - Hardware: **ZeroGPU** (free, requires account verification — may take a day)
   - Space name: e.g. `bharat-ai-video-worker`
3. **Upload these two files** to the Space (via the web UI or git):
   - `workers/hf-zerogpu/app.py`
   - `workers/hf-zerogpu/requirements.txt`
4. **Wait for the Space to build** (~5–10 min on first run; model weights
   (~5 GB) are downloaded from Hugging Face Hub at startup).
5. **Copy your Space URL** (e.g. `https://your-name-bharat-ai-video-worker.hf.space`)
   and paste it into Bharat AI → **Produce** → **Free HF / Colab worker URL**.

### Honest limits
| Limit | Detail |
|---|---|
| GPU minutes | ~5 min/day on HF free ZeroGPU (empirical; subject to change) |
| Clip length | 1–3 seconds (17–49 frames at 16 fps) |
| Scenes per run | Up to 3 real clips; rest stay as storyboard |
| Quality | Wan 2.1 T2V 1.3B — good short motion, not photoreal |
| Audio | Silent clips only; audio is added in a separate TTS stage |
| Queue wait | 30 s – 4 min depending on Space load |

### Optional HF token (higher free quota)
- Create a **read-only** token at https://huggingface.co/settings/tokens.
- Paste it into the token field in Director controls. It is saved in your browser only (`localStorage` key `bharat_hf_token`).
- It is sent as a Bearer header to the ZeroGPU Space to raise your daily quota. It is never committed to source control and is not needed for the default path.

### Paid providers are off by default
- Grok Imagine (xAI) is the only paid option in the repo. It runs only if the server has **both** `ALLOW_PAID_PROVIDERS=true` and `XAI_API_KEY`. A key alone does nothing.

---

## Path B — MuseTalk / LivePortrait lip-sync (optional)

- Adapter: `src/agents/musetalk-worker.ts`
- Docs: `workers/musetalk/README.md`
- Configure: `localStorage.setItem('bharat_musetalk_space', '<space-url>')`

Use after you have a face portrait + TTS/imported audio.

---

## Path C — Guided external AI video import (no auto API)

- Civitai / Roar / ReelShorts style import via ExternalStudioPanel
- User generates elsewhere for free, imports MP4/image into a scene
- No unlimited free third-party API claims

---

## Path D — Client preview (always free)

- Scene player + MediaPipe face landmarks + expression overlay
- Web Speech voice
- Works offline for preview even when GPU quota is exhausted

---

## Acceptance checklist

- [x] User can run Script + Voice with zero keys
- [x] Worker code deployable from `workers/hf-zerogpu/` (5-step guide above)
- [x] User can paste Space URL and get a short silent AI clip (quota permitting)
- [x] Up to 3 scenes get real clips per run; rest stay as honest storyboard
- [x] Without worker URL, app reports storyboard-only (no silent failure)
- [x] No paid keys required for the above
- [x] SSE stream read correctly (streaming, no full-body buffering)
- [x] ZeroGPU-compatible app.py (no module-level CUDA; lazy pipe.to("cuda"))

---

## Not in scope for ₹0 claim

- Unlimited multi-minute photoreal movies
- Guaranteed daily GPU minutes (HF quota changes)
- Commercial closed-model APIs (Runway, Kling, etc.)
- Real-time generation
