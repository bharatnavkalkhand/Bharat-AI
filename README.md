# Bharat AI — Free Prompt-to-High-Res Image & Video Generator

Mobile-first AI **prompt-to-media studio** for Indian users. Design goal: **₹0 operating cost** where possible, with honest limits.

**Live:** https://bharat-ai-chi.vercel.app  
**Free generator:** https://bharat-ai-chi.vercel.app/generate  
**Repo:** https://github.com/bharatnavkalkhand/Bharat-AI

**AI provider modes:** [Free / Paid AI settings](/ai-providers) · [Provider setup and safety](./docs/AI_PROVIDER_MODES.md)  

**DramaClaw bridge:** [Connect a self-hosted DramaClaw instance](/dramaclaw) · [Integration notes](./docs/DRAMACLAW_INTEGRATION.md)  

**Design system:** [DESIGN.md](./DESIGN.md) · **Zero-cost render architecture:** [docs/zero-cost-rendering-plan.md](./docs/zero-cost-rendering-plan.md) · **Generative media stack:** [docs/GENERATIVE_MEDIA_STACK.md](./docs/GENERATIVE_MEDIA_STACK.md) · **Android companion:** [docs/ANDROID_COMPANION.md](./docs/ANDROID_COMPANION.md)

## Free AI video + high-res image path (no credits / tokens)

This is the supported **zero-paid** path. No Flixier reverse-engineering. Public patterns + open-source workers only.

**Prompt-based free high-res:** See [HIGH_RES_FREE_PROMPT.md](./HIGH_RES_FREE_PROMPT.md) — write a scene prompt and get free high-resolution stills (Pollinations) + short AI video clips (HF ZeroGPU / public Spaces). Use the dedicated **/generate** page for one-off generations, or the full Produce pipeline for movies.

### Zero-paid-cost capabilities and prerequisites

| Stage | Free path | Notes |
|-------|-----------|--------|
| Script | Browser engine + optional Groq free-tier | No key required for browser path |
| Voice | Browser Web Speech | System voices (not true clones) |
| Still art (high-res) | Pollinations public API (no key) + external import | Defaults raised to 1024+ / 1280×720; Civitai / Roar guided import |
| Short AI video | Wan 2.1 1.3B worker source is included + public LTX/MiniMax Spaces | Bharat AI sends scene prompts to a separately running compatible free worker; no manual video attachment is needed |
| Lip-sync upgrade | MuseTalk / LivePortrait Space | Optional; see `workers/musetalk/` |
| Preview / export | Client scene player + MediaPipe face overlay | Storyboard fallback only; not diffusion video |

### Setup free HF video worker (recommended)

1. Create a [Hugging Face Space](https://huggingface.co/new-space) — SDK **Gradio**, hardware **ZeroGPU**.
2. Upload files from `workers/hf-zerogpu/` (`app.py`, `requirements.txt`, README front-matter).
3. Wait for first build (model download can take several minutes).
4. Open the app → Produce → paste the Space URL into **A · Free HF / Colab worker URL**.
5. Run the production pipeline. Video Agent will attempt a short silent AI clip via Gradio queue.

Limits (honest):
- Free ZeroGPU quota is limited (the current personal allowance is documented as 5 GPU minutes per 24-hour quota window; availability and account eligibility can vary).
- Clips are short (≈1–3 s silent 16:9). The worker reserves 120–240 GPU seconds per request, so expect at most one small request in a typical free quota window. This cannot render a two-minute diffusion-generated film.
- First cold start is slow.

Optional lip-sync Space: set `localStorage.setItem('bharat_musetalk_space', 'https://…')` after deploying a public MuseTalk/LivePortrait Gradio app. See `workers/musetalk/README.md`.

### What is still storyboard-only

Without a running generation worker, Video Agent can only return a timed storyboard preview (gradients + prompts). The app never pretends that a storyboard is generated AI footage.

## Multi-agent architecture

```
Script Agent → Voice Agent → Video Agent
      ↑              ↑              ↑
  browser /      Web Speech     storyboard
  Groq free        (free)       + optional
                                WORKER_URL
```

- **Orchestrator** runs stages from **Produce** (`/movie/:id/produce`).
- Agents are pluggable: upgrade quality without rewriting the UI.

### LLM routing (optional, free-tier friendly)

Server-side Script Agent can use OmniRoute → Groq → browser engine. Keys stay in Vercel env only:

- `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY`, `OMNIROUTE_MODEL` (optional)
- `GROQ_API_KEY` (optional fallback)

### Paid optional path (not required)

- Grok Imagine (paid) is OFF by default. It runs only if both `ALLOW_PAID_PROVIDERS=true` and `XAI_API_KEY` are set on Vercel. Free path **B** works without either.

## Local dev

```bash
npm install
npm run dev
```

## Deploy

Vercel (free hobby). SPA rewrite in `vercel.json`. API under `/api/agents/*`.

## Non-negotiables

- Prefer open-source and free tiers
- Never put secrets in frontend code
- Never claim unlimited video at ₹0
- Ship working stages before marketing “AI movie”
- Do not reverse-engineer proprietary commercial video tools
