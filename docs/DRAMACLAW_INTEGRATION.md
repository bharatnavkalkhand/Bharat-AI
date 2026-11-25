# DramaClaw integration

Bharat-AI exposes a bilingual (Hindi/English) launch bridge for a user-owned DramaClaw Community Edition instance.

## Current integration boundary

- Bharat-AI remains the user-facing app and keeps its existing `en` / `hi` movie-language model.
- `/dramaclaw` lets the user save a self-hosted DramaClaw web URL in browser-local storage and open that instance in a separate tab.
- The default URL is `http://localhost:8080`, matching DramaClaw CE's documented Docker web port.
- No DramaClaw credentials are stored in Bharat-AI.
- No API calls, project import/export, job submission, media synchronization, or render-status polling are claimed by this first bridge. Those require a separately verified, version-pinned API contract and an authenticated server-side adapter.

## Why this is a launch bridge first

DramaClaw's documented CE deployment exposes its web UI on port 8080 and REST API on port 8780. Its model execution routes through a configured model gateway. A running Docker stack does not itself provide free inference, free GPU time, or unlimited generation.

The first integration intentionally avoids guessing endpoint paths or sending user content to an unverified third-party service. A future API adapter should:
1. Pin and document a supported DramaClaw release.
2. Verify authentication and API schemas against that release.
3. Keep credentials server-side; never place API keys in browser storage.
4. Add explicit user consent before sending a script, character references, or media.
5. Preserve job IDs, provider, queue state, errors, and output provenance.
6. Keep Bharat-AI's existing local/browser fallback working when DramaClaw is offline.

## Self-host setup

Follow the upstream instructions rather than duplicating a moving Docker configuration here:

- Quickstart: https://github.com/dramaclaw/dramaclaw#quick-start
- Self-hosting guide: https://github.com/dramaclaw/dramaclaw/blob/main/docs/en/guides/self-hosting.md
- Model configuration: https://github.com/dramaclaw/dramaclaw/blob/main/docs/en/getting-started/configuring-models.md

After the DramaClaw web UI is reachable, open Bharat-AI → **DramaClaw** and enter the reachable base URL. For a phone connecting to a computer on the same Wi-Fi, use the computer's LAN address and port (for example, `http://192.168.x.x:8080`), not `localhost`.

## Hindi and English

Bharat-AI already models movie language as `hi` or `en`. The bridge page is also bilingual. DramaClaw's own interface locale and the language quality of generated dialogue/voice are separate concerns; verify Hindi support for the selected model and TTS provider in DramaClaw before production use.

## License and branding

DramaClaw Community Edition is distributed under Elastic License 2.0 (source-available, not OSI open source). The license permits self-hosting and building applications with it, but restricts providing DramaClaw itself as a hosted/managed service to third parties. Keep the required "Powered by DramaClaw" attribution visible and review the upstream license/NOTICE before redistribution or commercial deployment.

## Cost policy

This bridge does not add a paid provider or claim zero-cost inference. Use a local/self-hosted model gateway where feasible; otherwise the selected model provider may impose fees, quotas, account requirements, or GPU limits. See upstream model configuration and each provider's current terms.
