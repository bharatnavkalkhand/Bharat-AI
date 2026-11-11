# Bharat AI — Open-Source Media Engine Integration Plan

This document maps the open-source projects proposed for Bharat AI into a practical architecture. It is an implementation plan and dependency audit, **not a claim that every upstream model is already installed or running**.

## Non-negotiable deployment boundary

- The React/Vite application and Vercel deployment are the control plane: prompts, scene/character data, job status, previews, and downloads.
- Heavy model inference must run in a separate worker with an appropriate GPU or accelerator. Vercel serverless functions are not a substitute for a persistent CUDA/NPU inference host.
- Open-source code does not mean zero-cost compute. Model weights need storage and substantial RAM/VRAM; hosted GPUs may charge or enforce quotas. The app must show the selected worker's real availability and must never label a queued job as a completed video.
- Default strategy: local/self-hosted worker first; optional free community demo only as best-effort. No paid provider APIs, keys, subscriptions, or per-generation services are required by this design.
- Keep every upstream project pinned to a commit/release and preserve its license and notices before copying or packaging code/weights.

## Recommended system layout

```
Bharat AI Web App (Vercel; control plane only)
  ├─ Story / Script / Scene / Character agents
  ├─ Media job API + persistent job records
  ├─ Timeline editor, preview, subtitles, export controls
  └─ Worker adapter API
       ├─ Video worker: LTX-2 / Helios / Pixelle workflows
       ├─ Timeline renderer: HyperFrames + FFmpeg
       ├─ Audio worker: Supertonic / GPT-SoVITS / ACE-Step
       ├─ Speech-to-text: WhisperLive
       └─ Optional 3D asset worker: TRELLIS.2 / gsplat / OpenSplat
```

A worker adapter should expose: `GET /health`, `GET /capabilities`, `POST /jobs`, `GET /jobs/:id`, and `GET /jobs/:id/artifacts`. Job states are `queued | running | succeeded | failed | canceled`. Return a real artifact URL only after the MP4/audio/asset exists. Include progress, error details, duration, model id, worker id, and retryability.

## Video generation and orchestration

| Project | Intended Bharat AI role | Integration decision |
| --- | --- | --- |
| [LTX-2](https://github.com/Lightricks/LTX-2) | Primary audio-video foundation model; text/image/audio conditioned video, retakes, keyframes, dubbing | First model adapter candidate. Its official repository documents large model downloads (about 66 GiB for the LTX-2.5 split set) and recommends substantial NVIDIA VRAM; do not promise browser/mobile inference. |
| [Helios](https://github.com/PKU-YuanGroup/Helios) | Long, autoregressive video generation and continuation | Secondary long-video worker candidate. Official project reports 14B parameters and H100-class real-time results; hardware and throughput must be measured on the actual worker. Apache-2.0 code license is stated upstream. |
| [Pixelle-Video](https://github.com/AIDC-AI/Pixelle-Video) | Automated short-video orchestration, script/image/video/TTS assembly | Workflow reference / optional separate worker. Verify the exact upstream repository, release and license before importing; do not assume all model endpoints are free. |
| [HyperFrames](https://github.com/heygen-com/hyperframes) | Timeline-driven composition and rendering from generated assets | Rendering/composition layer, not the core diffusion video model. Apache-2.0 is stated by its project. |
| [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) | Short-video automation patterns: script, footage, narration, subtitles | Reuse ideas and compatible modules only after code/license review; avoid relying on paid APIs in its optional integrations. |
| [OpenMontage](https://github.com/) | Agentic production orchestration patterns | Candidate for workflow comparison, not a runtime dependency until exact repository, license, security and maintenance are checked. |
| [ViMax](https://github.com/) | Multi-agent storyboarding, character design and temporal consistency patterns | Candidate for orchestration patterns; confirm canonical upstream repository and license before adoption. |

**Model routing:** use LTX-2 for supported short shots and image/audio-conditioned scenes; evaluate Helios for longer continuous sequences; use Pixelle-style orchestration to plan and assemble multiple shots. The model adapter must advertise its actual max duration, resolution, aspect ratios, conditioning modes, and hardware requirements. Bharat AI should split long films into scene/shot jobs and assemble them; do not request a 5–30 minute single diffusion render by default.

## Audio, speech and music

| Project | Intended Bharat AI role | Integration decision |
| --- | --- | --- |
| [WhisperLive](https://github.com/collabora/WhisperLive) | Live/streaming speech recognition, transcripts and subtitle timing | Optional speech input/transcription worker. |
| [ACE-Step](https://github.com/ace-step/ACE-Step) | Local music generation | Background score worker, subject to model/runtime requirements. |
| [Magenta](https://github.com/magenta/magenta) | Music research/tooling | Research candidate; confirm the exact “Magenta RealTime 2” repository and current supported runtime before selecting it. |
| [Amphion](https://github.com/open-mmlab/Amphion) | Speech, singing and audio research toolkit | Optional advanced audio worker; broad toolkit, not a one-click TTS endpoint. |
| [Stable Audio Tools](https://github.com/Stability-AI/stable-audio-tools) | Sound effects and music generation | Optional local sound-design worker; check model-weight terms separately from code license. |
| [GPT-SoVITS](https://github.com/RVC-Boss/GPT-SoVITS) | Reference-voice cloning and multilingual speech | Optional consent-based character voice worker. Require explicit speaker permission and store voice references securely. |
| [Supertonic](https://github.com/supertone-inc/supertonic) | Fast on-device/local text-to-speech | Preferred lightweight TTS candidate for initial integration if Hindi/English voices and target runtime are supported. |
| [Voicebox](https://github.com/) | Local voice studio patterns | Exact upstream repo and license need confirmation before adoption. |
| [Voice-Pro](https://github.com/) | Speech recognition/TTS/voice UI patterns | Exact upstream repo and license need confirmation before adoption. |

Audio pipeline: script/dialogue → TTS per character or narrator → optional music/SFX → speech alignment → subtitles → final mux. Voice cloning is opt-in and must not be used to imitate a real person without permission.

## 3D and spatial assets

| Project | Intended Bharat AI role | Integration decision |
| --- | --- | --- |
| [TRELLIS.2](https://github.com/microsoft/TRELLIS.2) | Image-to-3D asset generation | Optional character/prop/environment asset worker; not a video generator. |
| [gsplat](https://github.com/nerfstudio-project/gsplat) | Gaussian-splat training/rendering primitives | Advanced scene reconstruction pipeline. |
| [LichtFeld-Studio](https://github.com/MrNeRF/LichtFeld-Studio) | Desktop Gaussian-splat editing/training | Creator-side tool, not a hosted web dependency. |
| [OpenSplat](https://github.com/pierotofy/OpenSplat) | Portable Gaussian-splat reconstruction | Optional reconstruction worker; review AGPL obligations before network deployment or distribution. |
| [Modly](https://github.com/) | Image-to-3D desktop workflow | Exact canonical repository and license need confirmation before adoption. |

## License and security gate

The licenses listed in the source article are not sufficient for redistribution. Before integrating any source or model weights, record the canonical repository URL, pinned commit, code license, model-weight license, attribution/NOTICE requirements, commercial-use restrictions, and any gated model terms. In particular, AGPL projects (for example OpenMontage/OpenSplat if the stated licenses are confirmed) need legal review before being incorporated into a network service. Never copy weights or source into Bharat AI without this check.

## Delivery phases

1. **Worker contract and honest status:** standardize job submission/status/artifact responses; add health/capability checks and bounded retry/backoff. Keep the existing public ZeroGPU worker explicitly best-effort.
2. **Local video worker:** deploy one supported LTX-2 pipeline behind the adapter on a GPU machine the user controls; run a 5-second smoke test and record real VRAM/time/output. Add Helios only after the first worker is stable.
3. **Timeline renderer:** use HyperFrames/FFmpeg to join shot outputs, narration, music and subtitles; render a short 20-second test before long projects.
4. **Audio worker:** add Supertonic first if language/voice coverage passes; then optional WhisperLive and consent-based GPT-SoVITS/ACE-Step.
5. **3D worker:** add TRELLIS.2 and Gaussian-splat tools as a separate optional asset pipeline, not a requirement for basic video generation.
6. **Production hardening:** persist jobs/artifacts, validate uploads, secure worker authentication, set quotas/timeouts, clean temporary media, and add reproducible worker health/build tests.

## Acceptance tests

- A prompt produces a real MP4 artifact (not a storyboard or CSS animation).
- The UI remains queued/running until the worker reports completion.
- A 5-second clip reports actual duration, dimensions, frame rate, model and worker.
- Failed or timed-out jobs show a useful error and do not show a fake download button.
- A multi-shot export preserves shot order and audio/subtitle synchronization.
- A worker outage does not break the script editor or existing project data.
