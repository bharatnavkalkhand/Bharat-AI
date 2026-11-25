# AI Provider Modes — Bharat-AI

## Product decision

Bharat-AI ships in **Free mode by default**. The developer controls the default in `src/lib/ai-provider-settings.ts`:

```ts
export const DEVELOPER_DEFAULT_AI_MODE: AiMode = "free";
```

The user can select Free or Paid AI mode from **AI Modes** in the app. The selection is stored in that browser's local storage. It does not expose provider secrets and does not automatically send a request; billing can begin only when a generation is run using a configured paid provider.

## Provider matrix

| Stage | Free/default | Optional paid / hosted path | Integration state |
|---|---|---|---|
| Script / reasoning | Browser script engine | Mistral or OmniRoute; Groq is a quota-limited free-tier option | Mistral, OmniRoute and Groq routed server-side |
| Images | Pollinations public endpoint | xAI Grok Imagine | Integrated; server-side key and explicit paid gate required |
| Video | Public LTX/ZeroGPU worker (shared quotas) | ComfyUI on self-hosted or hosted GPU | ComfyUI worker supported; no paid hosted video vendor adapter yet |
| Voice | Device/browser speech | Paid TTS vendor adapter | Browser voice only; paid adapter is a future extension |

A paid-mode selector is not a promise that every stage has a paid provider. Unsupported stages are clearly identified in the UI instead of pretending to be connected.

## Server-side secrets

Configure only in Vercel Project → Settings → Environment Variables (or the server's private environment). Never add secrets to `VITE_*`, browser local storage, committed files, or client code.

| Variable | Purpose |
|---|---|
| `ALLOW_PAID_PROVIDERS=true` | Master server-side permission gate for paid providers |
| `XAI_API_KEY` | Grok Imagine image generation |
| `MISTRAL_API_KEY` | Mistral script generation |
| `MISTRAL_MODEL` | Optional Mistral model override |
| `OMNIROUTE_API_KEY` | OmniRoute script gateway |
| `OMNIROUTE_BASE_URL` | OmniRoute OpenAI-compatible base URL |
| `OMNIROUTE_MODEL` | OmniRoute model name |
| `GROQ_API_KEY` | Optional Groq free-tier script provider |

Paid script providers require both the Paid mode selection in the UI and `ALLOW_PAID_PROVIDERS=true`. Grok Imagine requires the paid gate and `XAI_API_KEY`. Provider-status endpoint returns only booleans; it never returns keys.

## Runtime behavior

- Free is the default and uses browser script generation, public Pollinations stills, browser/device speech and the existing public video worker path.
- Groq may be selected as an optional free-tier cloud script provider; provider quotas and availability apply.
- Paid script selection routes only to the selected provider. If it is not configured or the paid gate is off, the app reports the reason and uses the local script fallback.
- Paid image selection calls Grok Imagine only when the paid mode is selected. If unavailable, the UI reports the configuration state; it does not silently spend through another provider.
- Video selection can choose the public worker or the configured ComfyUI worker. ComfyUI may be self-hosted or run on paid GPU infrastructure; its compute cost is separate from Bharat-AI.
- No user-facing provider choice can override server-side billing controls.

## Developer release checklist

1. Keep `DEVELOPER_DEFAULT_AI_MODE` set to `"free"` for a zero-paid-cost launch.
2. Deploy and verify `GET /api/agents/provider-status`.
3. Confirm the app shows Paid providers disabled before setting the master gate.
4. Add provider secrets privately and enable `ALLOW_PAID_PROVIDERS=true` only after billing approval.
5. Test each selected provider with one low-cost sample and inspect the provider's current pricing and quota before larger jobs.
6. Verify the Free mode still works with all paid secrets removed.
7. Do not market public free GPU endpoints as unlimited or guaranteed.
