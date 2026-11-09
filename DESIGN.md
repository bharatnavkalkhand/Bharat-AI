# Design System: Bharat AI — Zero-Cost Cinematic Studio

## 1. Visual Theme & Atmosphere
A mobile-first film-production workspace: restrained, cinematic, precise, and built for creators rather than engineers. The interface should feel like a compact professional edit suite, not a generic AI SaaS dashboard. Use an offset, editorial composition with a clear production timeline and a strong preview stage. Density 5/10, variance 7/10, motion 5/10. Every screen must make the ₹0 operating-cost promise visible without suggesting unlimited compute.

The product's defining UX principle is honest capability: distinguish real generated media, locally assembled output, storyboard placeholders, queued work, and unavailable GPU capacity. Never make a placeholder look like a completed AI render.

## 2. Color Palette & Roles
Use one neutral family throughout. Never use pure black and never introduce purple/blue neon.
- Cinema Charcoal (#18181B) — primary dark canvas and navigation.
- Deep Slate (#27272A) — raised work surfaces and editor rails.
- Studio Surface (#3F3F46) — secondary panels and input backgrounds.
- Paper White (#FAFAF9) — primary text and high-contrast preview labels.
- Soft Silver (#A1A1AA) — helper copy, metadata, inactive labels.
- Quiet Divider (#52525B) — 1px separators and panel boundaries.
- Reel Amber (#D6A24A) — the single accent for primary actions, active timeline position, focus and progress.
- Success Green (#4D9B78) — status only; never use as a decorative accent.
- Error Red (#D46A6A) — errors and destructive confirmation only.

No gradients as a substitute for real generated imagery. Gradients may be used only as clearly labelled storyboard placeholders.

## 3. Typography Rules
- Display / headings: Geist — compact, track-tight, weight-led hierarchy.
- Body: Geist — 14–16px minimum, relaxed line height, max 65ch.
- Technical metadata: Geist Mono — timestamps, frame counts, GPU reservations, render IDs and model identifiers.
- Use sentence case. Avoid oversized all-caps labels and decorative type.
- Do not use Inter or generic serif fonts. Serif is not used in the application UI.

## 4. Core Screens & Information Architecture
1. Studio Home — recent projects, new film action, local render availability, and a compact explanation of the zero-paid-cost workflow.
2. Story & Script — premise, language, duration target, scenes, dialogue and narration.
3. Character Studio — reusable character descriptions, reference images, continuity notes and per-scene cast assignment.
4. Scene Board — ordered scene cards with prompt, shot type, duration, visual status and generation status.
5. Produce / Render — preview, worker selection, queue, quota estimate, stage status, errors and output files.
6. Voice Studio — browser/system voice selection and optional self-hosted TTS status. Never imply system voices are cloned voices.
7. Export & Deliver — actual output duration, resolution, frame rate, audio track, file size, MP4 download and a manifest of generated vs assembled sections.

## 5. Component Stylings
- Primary button: Reel Amber fill, charcoal text, 10px radius, 44px minimum height. Active state translates down 1px. Only one primary action per screen.
- Secondary button: transparent charcoal surface with quiet divider border.
- Panels: restrained 14px radius and thin borders. Avoid floating-card overload; editor rails may use divider-separated regions.
- Inputs: visible label above, charcoal fill, quiet border, amber focus ring. Validation message below the input.
- Status chips: compact, text-first labels: Ready, Queued, Rendering, Generated, Assembled, Storyboard only, Blocked.
- Progress: show real stage completion and elapsed time. Never animate progress to imply work that has not happened.
- Quota panel: show the provider's published limit, estimated reservation and uncertainty. Do not display a fabricated remaining balance when the provider does not expose it.
- Preview: use 16:9 media area with transport controls and a visible badge describing its provenance: AI-generated, Local assembly, or Storyboard.
- Empty states: show the next useful action and the exact requirement (for example, Connect a local ComfyUI worker).
- Errors: inline, actionable, with provider response details safely redacted. Never hide a failed generation behind a successful storyboard preview.

## 6. Layout Principles
- Mobile-first. At widths below 768px, editor rails become stacked sections and timeline controls remain touch-accessible.
- Desktop uses a 12-column grid: left project rail, central preview/scene board, right inspector. Keep the central preview visually dominant.
- Maximum content width 1440px. Use 24px desktop gutters and 16px mobile gutters.
- Minimum interactive target 44×44px.
- No horizontal page overflow. Timeline may scroll within its own labelled viewport.
- Avoid three equal feature cards. Use an asymmetric preview + inspector composition.
- Every content element occupies its own spatial zone; no overlapping text and media.

## 7. Motion & Interaction
- Use restrained spring motion (stiffness 100, damping 20) for panel transitions and tactile controls.
- Animate only transform and opacity.
- Stagger scene-list entry by 35–55ms.
- Respect reduced-motion preferences.
- No perpetual shimmer on completed work. Skeletons are allowed only while a real request is pending.
- Do not simulate rendering with fake progress loops.

## 8. Zero-Cost Product Rules
- No credit balance, token counter, paid upgrade CTA, or pricing gate in the core workflow.
- Show ₹0 software/API fee only where accurate; disclose compute, device, bandwidth, storage and free-tier quotas separately.
- Prefer local/self-hosted open-source inference. Optional public free-tier workers must be explicitly labelled quota-limited.
- Never make paid APIs required for the primary path.
- A render is not free if it depends on a paid GPU, paid model API, or mandatory subscription.
- Export must not be blocked by a token or credit system.
- Make local output available even when a remote GPU worker is unavailable.

## 9. Provenance & Completion Language
Use these exact distinctions:
- AI-generated clip: media returned by a model inference worker.
- Locally assembled video: output composed from available clips, images, narration, captions and transitions.
- Storyboard preview: prompt/placeholder visualization; not a generated video.
- Render ready: all requested stages completed and an output file exists.
- Partially complete: some scenes generated; remaining scenes are clearly marked.
Never label a storyboard or a still-image pan/zoom sequence as fully AI-generated video.

## 10. Anti-Patterns (Banned)
- No AI purple/blue neon aesthetic or glowing buttons.
- No pure black (#000000), Inter, generic serif, or decorative gradient headlines.
- No fake GPU quota meters or fabricated render progress.
- No placeholder output presented as generated video.
- No mandatory paid API key or token balance.
- No unlimited free GPU claim.
- No equal three-column feature-card rows.
- No generic Next-gen, Unleash, Seamless, or Elevate marketing copy.
- No emoji-only controls, custom cursors, or decorative scroll prompts.
- No export button that silently downloads a storyboard while claiming to export an AI movie.
