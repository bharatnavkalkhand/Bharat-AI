# Bharat AI — Avatar Movie Studio

Mobile-first AI movie **production pipeline** for Indian users. Design goal: **₹0 operating cost** where possible, with honest limits.

**Live:** https://bharat-ai-chi.vercel.app  
**Repo:** https://github.com/bharatnavkalkhand/Bharat-AI

## Synced tools from AppDeploy

- **Research Engine** (`/research`): searches public GitHub repository metadata and links to candidate projects. GitHub API rate limits apply; licence and GPU compatibility require review.
- **Avatar Studio** (`/avatar-studio`): creates a reusable cinematic master prompt with identity continuity, action, camera, lighting and audio direction, with copy/TXT export. It does not render video itself.
- The home page links to both tools. These features are integrated into this existing repository rather than creating a duplicate app.

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

### Free LLM (optional)

1. Create a free key at [console.groq.com](https://console.groq.com) (free tier, rate limits).
2. In Vercel → Project → Settings → Environment Variables:
   - `GROQ_API_KEY` = your key
3. Redeploy. Script Agent will try Groq first; if unavailable, falls back to local engine.

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
