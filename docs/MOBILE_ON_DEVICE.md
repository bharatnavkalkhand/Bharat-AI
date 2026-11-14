# Bharat AI — Mobile / phone memory path

Goal: phone pe kaam kare, **device CPU + RAM** use kare, har din Colab/Kaggle na khole.

## Honest limits

| On phone (browser) | Possible? |
|--------------------|-----------|
| Script, cast, templates | ✅ |
| Web Speech TTS (Hindi/English) | ✅ device voices |
| Scene stills from gallery / camera | ✅ local files |
| MediaPipe face landmarks + lip overlay | ✅ on-device model |
| Canvas Play / Export MP4-ish | ✅ client |
| Full SDXL / Wan video in browser | ❌ too heavy |
| Unlimited cloud GPU | ❌ quota |

Full photoreal video still needs **optional** HF/Comfy worker. Default mobile path is **client-first**.

## What uses phone memory

1. **MediaPipe Face Landmarker** (`@mediapipe/tasks-vision`)
   - Model loads once, cached
   - Lip position on user photos — no face upload to our server
2. **localStorage / IndexedDB**
   - Movies, scene images, worker URLs, HF token (optional)
3. **Web Speech API**
   - TTS on device
4. **Canvas scene-player**
   - Motion + lip overlay + export without GPU farm

## Mobile Produce flow (recommended)

```text
+ नई फ़िल्म / template
    → Script (hi/en)
    → Cast: phone gallery se face photo
    → Produce:
         Face remix ON (default)
         Text→Image optional (network)
         Play / Export on phone
    → Optional: HF token / Comfy only if AI video chahiye
```

## Setup for users

1. Open https://bharat-ai-chi.vercel.app in **Chrome** or **Safari**
2. Add to Home Screen (PWA-style bookmark)
3. Allow storage; do not clear site data if you want projects kept
4. Prefer **Wi‑Fi** first time (MediaPipe model ~ few MB download)

## Developer flags

| Key | Meaning |
|-----|--------|
| `facePerformance` | Client lip/expression on photos |
| `bharat_hf_token` | Optional ZeroGPU (not required for client path) |
| `bharat_comfyui_url` | Optional PC GPU |
| `bharat_musetalk_space` | Optional lip Space |

## Not in scope for pure phone memory

- Running Wan/LTX weights inside the mobile browser tab
- Guaranteed 10‑minute photoreal movies offline
- Background generation after tab kill (needs future durable jobs)

## Related code

- `src/agents/face-landmarks.ts` — on-device lips
- `src/agents/mobile-client-path.ts` — capability helper
- `src/components/DirectorControls.tsx` — face / workers UI
