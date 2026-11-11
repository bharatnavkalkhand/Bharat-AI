# Bharat AI Android Companion

Status: implementation specification. No APK has been built or installed yet.

## Target device

- Device: Nothing Phone (2a)
- User-reported configuration: 8GB physical RAM, 128GB storage, plus 8GB virtual RAM expansion.
- Android companion should be tested on the actual device before enabling model downloads or background jobs.
- Reserve user storage for media. Do not fill the device automatically; expose model sizes, download progress, delete controls, and free-space warnings.

## Responsibilities

The phone is a local media assistant, not the primary cinematic diffusion server.

1. Offline speech synthesis and speech recognition using a small, compatible Sherpa-ONNX model.
2. Save narration/audio files locally instead of relying only on browser speechSynthesis playback.
3. Generate or import subtitle tracks and align them with audio.
4. Cache scene assets and generated clips with user-controlled cleanup.
5. Join video clips, narration, music, and subtitles with Android Media3 Transformer.
6. Upload completed artifacts to Bharat AI only when the user requests it.

## Proposed application structure

- Native Android app (Kotlin) with a foreground service for long-running local jobs.
- HTTPS-authenticated job handoff from Bharat AI; local pairing code/token rather than an unauthenticated LAN endpoint.
- Android Storage Access Framework for user-selected export folders.
- Sherpa-ONNX Android integration for supported local speech tasks.
- AndroidX Media3 Transformer for composition, encoding, and export.
- A small job database with queued/running/succeeded/failed/canceled states and recoverable progress.

## Browser-to-phone pairing

The web app should show a QR code or short-lived pairing code. The native app scans/enters it, authenticates to Bharat AI, then polls or receives signed job instructions. Avoid exposing an open localhost server to the public network. All transferred media should use short-lived signed URLs and integrity checks.

## Model policy

- Start with one small Hindi-capable TTS model and one speech-recognition model only after verifying language coverage, model size, license, and Android ABI compatibility.
- Keep models optional downloads, not bundled into the initial APK.
- Do not promise voice cloning, perfect expressive acting, or unlimited offline speech until measured.
- Do not run large image/video diffusion models, ComfyUI, or EchoMimic on the phone in the first release.

## First device acceptance test

1. Install a debug APK on the Nothing Phone (2a).
2. Download one approved Hindi/English model and report exact storage used.
3. Convert a 10-second sample script to a real audio file while offline.
4. Transcribe a short recorded sample and create an SRT subtitle file.
5. Mux a sample MP4 + narration + SRT and export a playable MP4.
6. Verify interruption/restart, battery use, thermal behavior, and cleanup.
7. Pair with Bharat AI and transfer a completed artifact in both directions.

No implementation should be described as completed until these tests have been run on the device.
