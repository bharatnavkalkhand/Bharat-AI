# Mistral AI provider experiment

This branch adds an **opt-in Mistral chat-completions provider** to the existing Script Agent. It does not change the default zero-key browser path and does not add a video-generation engine.

## What changed

- `api/agents/script.ts` can call the Mistral API when `MISTRAL_API_KEY` is configured.
- Provider order is: OmniRoute → direct Mistral → Groq → browser-local fallback.
- Default model: `ministral-8b-2512`.
- Override with `MISTRAL_MODEL` if a different model is enabled for the account.
- Credentials are read only from server environment variables; never put keys in frontend code or commit them.

## Enable for a controlled test

Set these environment variables in the server/deployment environment (not in source files):

```env
MISTRAL_API_KEY=<secret>
MISTRAL_MODEL=ministral-8b-2512
```

Then enable **Use cloud LLM** in the app and generate one short test script. Confirm the response reports provider `mistral`, and verify that the returned JSON contains characters and ordered scenes.

Remove `MISTRAL_API_KEY` to return to the existing no-Mistral path. If Mistral is unavailable or returns an error, the route continues to Groq (if configured) and then the browser engine.

## Model and cost/licensing notes

| Model family | Potential use | Important constraint |
|---|---|---|
| Ministral 3 3B / 8B / 14B | Script planning; 3B/8B are the smaller candidates | Apache 2.0 weights; API inference is billed. Local hosting still requires suitable hardware. |
| Mistral Small 4 | Higher-capability script and scene reasoning | Apache 2.0 weights; API inference is billed. |
| Devstral 2 | Development/coding agent, not movie rendering | Separate model/runtime; do not route end-user script requests to it by default. |
| Voxtral Mini Transcribe 3 | Audio transcription | Hosted Premier service; not assumed free. |
| Voxtral TTS 3 | Voice generation | Hosted Premier service; not part of this branch or the ₹0 path. |
| OCR 4.1 | Document/script extraction | Hosted Premier service; not assumed free. |

Model availability, model IDs, API prices, and terms can change. Check the live [Mistral model catalogue](https://docs.mistral.ai/models) before changing the default model or deploying.

## Zero-cost policy

- This adapter is **optional and not a zero-cost inference guarantee**.
- Do not add Mistral API keys to the repository, client bundle, localStorage, or logs.
- Do not silently switch users to a paid provider.
- Keep the browser-local script engine as the default when no cloud provider is configured.
- Do not describe open weights as free hosting: self-hosting still consumes compute and storage.
- Do not use Voxtral TTS 3 for commercial voice generation without confirming the applicable commercial terms.

## Acceptance checks

1. With no `MISTRAL_API_KEY`, Script Agent returns `useLocal: true` when no other cloud provider is configured.
2. With a valid key and available model, response reports `provider: "mistral"` and returns a structured script.
3. With an invalid key or unavailable model, the route falls back without exposing the secret.
4. Browser-local fallback remains usable.
5. Build and typecheck pass; no paid provider is made mandatory.

## Scope intentionally excluded

This experiment does not integrate image generation, transcription, TTS, OCR, or text-to-video. Mistral is not a video-generation model. Existing video workers and the storyboard-only status rules remain unchanged.
