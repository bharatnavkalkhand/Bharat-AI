# Bharat AI — Android APK

## Download (direct, no ZIP)

After the **Build Android APK** workflow finishes (green ✅):

**https://github.com/bharatnavkalkhand/Bharat-AI/releases/tag/latest-apk**

Install `Bharat-AI-debug.apk` (allow install from unknown sources).

Workflow also keeps an Actions artifact as backup: `bharat-ai-debug-apk`.

## Capacitor network (ComfyUI / LAN)

`capacitor.config.json`:

- `server.cleartext: true` — allow `http://` LAN workers
- `android.allowMixedContent: true` — HTTPS WebView may call HTTP workers

**Still recommended for reliability:** on PC run Comfy with CORS and expose HTTPS:

```bash
python main.py --listen --enable-cors-header "*"
# optional: cloudflared tunnel --url http://127.0.0.1:8188
```

Paste the **https://** tunnel URL in the app Comfy field (same as HF Spaces).

## What the phone can vs cannot do

| On phone | |
|----------|--|
| Script UI, cast photos, Play/Export canvas | ✅ |
| MediaPipe lips (on-device) | ✅ |
| HF / public GPU video over https | ✅ |
| Full Wan/SDXL diffusion in RAM | ❌ |
| Relative `/api/...` without Vercel host | ❌ (use live site APIs) |

Live web: https://bharat-ai-chi.vercel.app

## Trigger rebuild

GitHub → Actions → **Build Android APK (free)** → Run workflow  
or push to `main`.
