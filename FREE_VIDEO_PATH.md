# Free AI video path (₹0 / no tokens)

Canonical guide for turning Bharat AI into a **usable free AI video generator** without paid credits.

## Principles

1. Canonical repo: `bharatnavkalkhand/Bharat-AI` only.
2. Prefer free / local / open-source workers.
3. Never add paid GPU/API dependencies without explicit approval.
4. Public product patterns only — no proprietary reverse engineering.

## Path A — HF ZeroGPU text-to-video (primary)

Already implemented:

- Worker template: `workers/hf-zerogpu/` (Wan 2.1 T2V 1.3B Gradio)
- Client adapter: `src/agents/hf-zerogpu-worker.ts`
- Wired from `src/agents/video-agent.ts` when Produce worker URL is an HF Space

Deploy steps: see `workers/hf-zerogpu/README.md`.

Paste Space URL into Produce → **A · Free HF / Colab worker URL**.

## Path B — MuseTalk / LivePortrait lip-sync (optional)

- Adapter: `src/agents/musetalk-worker.ts`
- Docs: `workers/musetalk/README.md`
- Configure: `localStorage.setItem('bharat_musetalk_space', '<space-url>')`

Use after you have a face portrait + TTS/imported audio.

## Path C — Guided external AI video import (no auto API)

- Civitai / Roar / ReelShorts style import via ExternalStudioPanel
- User generates elsewhere for free, imports MP4/image into a scene
- No unlimited free third-party API claims

## Path D — Client preview (always free)

- Scene player + MediaPipe face landmarks + expression overlay
- Web Speech voice
- Works offline for preview even when GPU quota is exhausted

## Acceptance checklist

- [ ] User can run Script + Voice with zero keys
- [ ] User can deploy HF ZeroGPU Space from `workers/hf-zerogpu/`
- [ ] User can paste Space URL and get a short silent AI clip (quota permitting)
- [ ] Without worker URL, app honestly reports storyboard-only
- [ ] No paid keys required for the above

## Not in scope for ₹0 claim

- Unlimited multi-minute photoreal movies
- Guaranteed daily GPU minutes (HF quota changes)
- Commercial closed-model APIs
