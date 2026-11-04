# Bharat AI — Avatar Movie Studio

Mobile-first AI movie **production pipeline** for Indian users. Design goal: **₹0 operating cost** where possible, with honest limits.

**Live:** https://bharat-ai-chi.vercel.app  
**Repo:** https://github.com/bharatnavkalkhand/Bharat-AI

## Current completion (honest)

| Area | Status | Notes |
|------|--------|-------|
| Script Agent | Working (free) | Browser engine + optional Groq free-tier via `GROQ_API_KEY` |
| Voice Agent | Working (free) | Browser Web Speech — system voices, not true character clones |
| Video Agent | Storyboard only | Timed preview frames; real MP4 needs GPU worker |
| Cast / scenes UI | Working | Edit, fight/romance moods, reference faces |
| Full 5–10 min avatar MP4 | Not yet | Requires open-source video worker |

Roughly a **pipeline foundation (~25–30%)**, not a finished movie generator.

## Multi-agent architecture

```
Script Agent → Voice Agent → Video Agent
      ↑              ↑              ↑
  browser /      Web Speech     storyboard
  Groq free        (free)       + optional
                                WORKER_URL
```

- **Orchestrator** runs stages in order from **Produce** (`/movie/:id/produce`).
- Agents are pluggable: upgrade quality without rewriting the app UI.

### LLM routing with OmniRoute (optional)

Bharat AI's server-side Script Agent supports an OpenAI-compatible OmniRoute gateway.
When configured, requests go to OmniRoute first, then fall back to Groq, then to the
browser's local script engine. Provider keys are kept in Vercel server environment
variables and are never sent to the browser.

Set these Vercel Project → Settings → Environment Variables:

- `OMNIROUTE_BASE_URL` = your reachable OmniRoute server URL (for example, `https://your-gateway.example`)
- `OMNIROUTE_API_KEY` = the gateway key copied from OmniRoute Dashboard → Endpoints
- `OMNIROUTE_MODEL` = `auto` (optional; defaults to `auto`)
- `GROQ_API_KEY` = optional fallback key

Redeploy after setting variables. OmniRoute itself is open-source, but a self-hosted
gateway still needs an always-on reachable host and eligible provider connections.
Free provider quotas, signup requirements, terms, and availability are controlled
by each provider. OmniRoute does not supply free GPU rendering and does not generate
video frames; it improves text/script model routing only. Do not put the gateway URL
or secret key in frontend code or browser localStorage.

### Real character voice (upgrade)

Self-host open-source TTS:

- [Piper](https://github.com/rhasspy/piper) (fast, CPU)
- [Coqui XTTS](https://github.com/coqui-ai/TTS) (voice clone)

Expose HTTP `/tts` and wire into Voice Agent later.

### Real video / avatar (upgrade)

Self-host on your GPU or free community compute:

- ComfyUI + AnimateDiff / Wan / Open-Sora style workflows
- Custom FastAPI worker: `POST /generate` with scene prompts

In Produce tab, set **Video worker URL** (saved in browser `localStorage`).

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
