/**
 * Upgrade Agent — compares Bharat AI to *publicly observable* product patterns
 * (marketing demos, UX patterns like dual-panel + captions + voice).
 *
 * DOES NOT reverse-engineer proprietary Flixier binaries, APIs, DRM, or closed source.
 * That would be illegal / against terms. We only use public product design gaps.
 */

export interface FeatureGap {
  id: string;
  area: string;
  observedPublicly: string;
  bharatStatus: string;
  priority: 1 | 2 | 3;
  freePath: string;
  paidOrGpuPath: string;
}

export interface UpgradeReport {
  generatedAt: string;
  disclaimer: string;
  gaps: FeatureGap[];
  nextActions: string[];
}

const GAPS: FeatureGap[] = [
  {
    id: "illustrated-characters",
    area: "Visual",
    observedPublicly:
      "Short films often use painted/illustrated consistent characters in dual panels.",
    bharatStatus: "User-uploaded scene art + cast faces; no auto AI illustrator yet",
    priority: 1,
    freePath: "Upload art; optional HF free image models when quota allows",
    paidOrGpuPath: "Self-host SDXL / Flux worker",
  },
  {
    id: "lip-sync",
    area: "Performance",
    observedPublicly: "Dialogue scenes show mouth movement matched to speech",
    bharatStatus: "Phase 6 client lip aperture overlay on face panels",
    priority: 1,
    freePath: "Expression engine (shipped); Rhubarb WASM optional later",
    paidOrGpuPath: "Wav2Lip / MuseTalk / SadTalker self-host",
  },
  {
    id: "character-voice",
    area: "Audio",
    observedPublicly: "Distinct character-like voices, not only system TTS",
    bharatStatus: "Free TTS proxy + browser fallback; limited voice identity",
    priority: 1,
    freePath: "Piper / Coqui self-host; multi-speaker mapping by cast name",
    paidOrGpuPath: "XTTS voice clone on user GPU",
  },
  {
    id: "scene-motion",
    area: "Motion",
    observedPublicly: "Camera moves and light character gesture between cuts",
    bharatStatus: "Mood Ken Burns / shake (Phase 4)",
    priority: 2,
    freePath: "Stronger motion presets (done); multi-pose still swaps",
    paidOrGpuPath: "AnimateDiff / LivePortrait worker",
  },
  {
    id: "timeline-edit",
    area: "Editing",
    observedPublicly: "Timeline trim, reorder, music bed",
    bharatStatus: "Scene list + reorder in store; no full NLE timeline UI",
    priority: 2,
    freePath: "Scene reorder UI + BGM file mux",
    paidOrGpuPath: "Not required for MVP",
  },
  {
    id: "export-polish",
    area: "Export",
    observedPublicly: "Clean MP4 with burned captions and dialogue audio",
    bharatStatus: "WebM/MP4 + optional embedded TTS when upstream works",
    priority: 2,
    freePath: "Keep mux path; retry TTS chunks",
    paidOrGpuPath: "Server-side ffmpeg assembly",
  },
];

export function runUpgradeAgent(): UpgradeReport {
  const nextActions = GAPS.filter((g) => g.priority === 1)
    .map((g) => `${g.area}: ${g.freePath}`)
    .slice(0, 5);

  return {
    generatedAt: new Date().toISOString(),
    disclaimer:
      "This report uses only publicly observable product patterns. It does not reverse-engineer Flixier or any closed commercial software.",
    gaps: GAPS,
    nextActions,
  };
}

export function formatUpgradeReport(report: UpgradeReport): string {
  const lines = [
    "Bharat AI — Upgrade Agent Report",
    report.disclaimer,
    "",
    "Priority gaps:",
  ];
  for (const g of report.gaps) {
    lines.push(
      `P${g.priority} [${g.area}] ${g.id}`,
      `  Public pattern: ${g.observedPublicly}`,
      `  Bharat now: ${g.bharatStatus}`,
      `  Free path: ${g.freePath}`,
      "",
    );
  }
  lines.push("Next actions:");
  report.nextActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
  return lines.join("\n");
}
