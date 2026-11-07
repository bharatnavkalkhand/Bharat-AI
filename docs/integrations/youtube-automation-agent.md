# YouTube Automation Agent — companion for Bharat AI

Upstream: [darkzOGx/youtube-automation-agent](https://github.com/darkzOGx/youtube-automation-agent) (MIT).

## Why companion, not merge

| | **Bharat AI** | **youtube-automation-agent** |
|--|---------------|------------------------------|
| Stack | React / Vite / Vercel (browser) | Node.js self-hosted dashboard |
| Product | Avatar movie studio (script → lips → scenes) | Full YouTube channel ops |
| Cost model | Prefer ₹0 free path | Needs API keys + optional paid video |
| Publish | Not built-in | YouTube OAuth, SEO, schedule, analytics |

Copying the whole Node repo into this frontend would break the free mobile path and Vercel deploy. Integration is a **bridge**: Bharat AI produces the movie; the agent handles SEO / approve / upload on your PC.

## Pipeline

```text
Bharat AI (phone/browser)
  → script + scenes + export MP4 / WebM
  → Publish package (title, description, tags, script JSON)
        ↓
PC: youtube-automation-agent (localhost:3456)
  → review → SEO → schedule → YouTube (after your approval)
```

## Setup (PC)

```bash
git clone https://github.com/darkzOGx/youtube-automation-agent.git
cd youtube-automation-agent
cp .env.example .env   # add Gemini/OpenAI + YouTube OAuth keys
npm install
npm run setup
npm start              # dashboard http://127.0.0.1:3456
```

See upstream README for providers, narration, and production readiness checks.

## Bharat AI side

1. Produce a movie and export video as usual.
2. Build a publish package via `src/agents/youtube-publish-bridge.ts`.
3. Download JSON + keep the MP4.
4. On the PC agent: create/import a video job and attach the file; paste title/description/tags from the JSON.
5. Approve only after fact/media checks (agent never auto-publishes without approval).

Optional: set localStorage `bharat_yt_agent_url` to `http://127.0.0.1:3456` when the dashboard is running on the same LAN (advanced; CORS/API may require agent config).

## What we do **not** do

- Do not commit upstream `node_modules`, `.env`, or OAuth tokens.
- Do not claim unlimited free YouTube auto-post.
- Do not vendor the entire upstream tree into `src/`.

## License note

Upstream is MIT. Keep attribution if you copy code snippets; prefer calling the running agent over forking large files.
