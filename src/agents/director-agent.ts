/**
 * Director / "Mind" Agent
 * Helps humans decide: which images for which scene, how to move the camera,
 * and how to integrate voice-over in a polished way.
 *
 * Uses free public web knowledge (Wikimedia Commons search) when online.
 * No paid APIs. Never reverse-engineers closed products.
 */

export type ScreenLayout = "dual" | "single";

export interface SceneDirection {
  sceneId: string;
  order: number;
  title: string;
  mood: string;
  /** What the top (or only) panel should show */
  panelPrimary: string;
  /** Bottom panel (dual only) */
  panelSecondary?: string;
  /** Search queries for free public images */
  imageQueries: string[];
  /** Suggested Wikimedia / public image URLs (if found) */
  suggestedImageUrls: string[];
  motionHint: string;
  motionIntensity: "low" | "medium" | "high";
  voiceOverPlan: {
    mode: "dialogue" | "narration" | "mixed";
    tone: string;
    tips: string[];
  };
  integrationSteps: string[];
}

export interface DirectorReport {
  generatedAt: string;
  layout: ScreenLayout;
  summary: string;
  scenes: SceneDirection[];
  globalVoiceTips: string[];
  globalVisualTips: string[];
}

export interface DirectorSceneInput {
  id: string;
  order: number;
  title: string;
  mood: string;
  dialogue?: string;
  narration?: string;
  visualPrompt?: string;
  gestureNotes?: string;
}

function moodMotion(mood: string): {
  intensity: "low" | "medium" | "high";
  hint: string;
} {
  const m = (mood || "").toLowerCase();
  if (m === "fight" || m === "action")
    return {
      intensity: "high",
      hint: "Quick shake + slight zoom punches on impacts; cut on action beats",
    };
  if (m === "romance")
    return {
      intensity: "low",
      hint: "Slow Ken Burns pan, soft zoom-in on faces, hold on gesture",
    };
  if (m === "emotional" || m === "dramatic")
    return {
      intensity: "medium",
      hint: "Slow push-in; freeze half a second after key line",
    };
  if (m === "comedy")
    return {
      intensity: "medium",
      hint: "Snappy cuts; slight overshoot zoom on punchline",
    };
  return {
    intensity: "medium",
    hint: "Gentle drift + dialogue-timed holds",
  };
}

function buildQueries(
  sc: DirectorSceneInput,
  language: "en" | "hi",
  title: string,
): string[] {
  const base = [sc.visualPrompt, sc.title, sc.mood, title]
    .filter(Boolean)
    .join(" ")
    .slice(0, 120);
  const mood = (sc.mood || "").toLowerCase();
  const extras: string[] = [];
  if (mood === "fight" || mood === "action")
    extras.push("cinematic action still", "dramatic confrontation");
  if (mood === "romance") extras.push("romantic couple soft light", "monsoon India");
  if (mood === "emotional") extras.push("emotional portrait India", "dramatic sky");
  if (language === "hi") extras.push("India historical", "Mumbai colonial architecture");
  const q1 = base || `${title} ${mood} cinematic`;
  return [q1, ...extras].slice(0, 3);
}

function voicePlan(sc: DirectorSceneInput): SceneDirection["voiceOverPlan"] {
  const hasDlg = !!(sc.dialogue && sc.dialogue.trim());
  const hasNar = !!(sc.narration && sc.narration.trim());
  if (hasDlg && hasNar) {
    return {
      mode: "mixed",
      tone: "Narration frames the scene; dialogue carries emotion",
      tips: [
        "Play narration 0.3s before first dialogue line",
        "Lower music under dialogue (-8 to -12 dB)",
        "Leave 150–250ms breath between speakers",
      ],
    };
  }
  if (hasDlg) {
    return {
      mode: "dialogue",
      tone: "Character-driven; lip-sync on speaking panel",
      tips: [
        "Keep face performance ON for the speaking character panel",
        "Match Rhubarb/energy lip-sync to each line",
        "Avoid overlapping music with consonant-heavy lines",
      ],
    };
  }
  return {
    mode: "narration",
    tone: "Storyteller VO over visuals",
    tips: [
      "Use slightly slower rate (0.9–0.95)",
      "Hold final frame 0.5s after last word",
      "Soft ambient bed under VO only",
    ],
  };
}

function panelCopy(
  sc: DirectorSceneInput,
  layout: ScreenLayout,
): { primary: string; secondary?: string } {
  const mood = (sc.mood || "").toLowerCase();
  const vp = sc.visualPrompt || sc.title;
  if (layout === "single") {
    return {
      primary: `Full-frame: ${vp}. Focus on clear face + environment.`,
    };
  }
  if (mood === "fight" || mood === "action") {
    return {
      primary: `Hero / aggressor close or medium shot — ${sc.title}`,
      secondary: `Opponent or wide environment reaction — ${vp.slice(0, 80)}`,
    };
  }
  if (mood === "romance" || mood === "emotional") {
    return {
      primary: `Character A face / soft gesture`,
      secondary: `Character B or shared space (steps, rain, window)`,
    };
  }
  return {
    primary: `Speaker / lead — ${sc.title}`,
    secondary: `Listener, detail insert, or setting — ${vp.slice(0, 80)}`,
  };
}

/** Free Wikimedia Commons search (no API key) */
export async function searchPublicImages(
  query: string,
  limit = 2,
): Promise<string[]> {
  const q = encodeURIComponent(query.slice(0, 80));
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${q}&gsrnamespace=6&gsrlimit=${limit}` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ url?: string; thumburl?: string }> }> };
    };
    const pages = data.query?.pages || {};
    const urls: string[] = [];
    for (const p of Object.values(pages)) {
      const info = p.imageinfo?.[0];
      const u = info?.thumburl || info?.url;
      if (u) urls.push(u);
    }
    return urls;
  } catch {
    return [];
  }
}

export async function runDirectorAgent(opts: {
  title: string;
  language: "en" | "hi";
  layout: ScreenLayout;
  scenes: DirectorSceneInput[];
  fetchWebImages?: boolean;
  onProgress?: (msg: string) => void;
}): Promise<DirectorReport> {
  const { title, language, layout, scenes, fetchWebImages = true } = opts;
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const directions: SceneDirection[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const sc = sorted[i];
    opts.onProgress?.(
      language === "hi"
        ? `निर्देशक: सीन ${i + 1}/${sorted.length}…`
        : `Director: scene ${i + 1}/${sorted.length}…`,
    );
    const queries = buildQueries(sc, language, title);
    let urls: string[] = [];
    if (fetchWebImages && queries[0]) {
      urls = await searchPublicImages(queries[0], layout === "dual" ? 2 : 1);
      if (!urls.length && queries[1]) {
        urls = await searchPublicImages(queries[1], 1);
      }
    }
    const panels = panelCopy(sc, layout);
    const motion = moodMotion(sc.mood);
    const vo = voicePlan(sc);

    directions.push({
      sceneId: sc.id,
      order: sc.order,
      title: sc.title,
      mood: sc.mood,
      panelPrimary: panels.primary,
      panelSecondary: panels.secondary,
      imageQueries: queries,
      suggestedImageUrls: urls,
      motionHint: motion.hint,
      motionIntensity: motion.intensity,
      voiceOverPlan: vo,
      integrationSteps:
        layout === "dual"
          ? [
              "Upload or accept suggested image for TOP panel (lead)",
              "Upload / assign BOTTOM panel (reaction or setting)",
              `Set motion intensity → ${motion.intensity}`,
              `VO mode → ${vo.mode}; enable face performance on speaking panel`,
              "Play once; export when lips + audio feel locked",
            ]
          : [
              "Upload one full-frame image for the scene",
              `Set motion → ${motion.intensity}`,
              `VO mode → ${vo.mode}; face performance if dialogue`,
              "Play → adjust → Export WebM/MP4",
            ],
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    layout,
    summary:
      language === "hi"
        ? `${title}: ${directions.length} सीन के लिए विज़ुअल + मोशन + वॉइस प्लान तैयार। लेआउट: ${layout === "dual" ? "ड्यूल स्क्रीन" : "सिंगल स्क्रीन"}.`
        : `${title}: visual, motion & VO plan for ${directions.length} scenes. Layout: ${layout}.`,
    scenes: directions,
    globalVoiceTips: [
      "One clear VO path per scene: dialogue OR narration-first",
      "Normalize loudness across scenes before final export",
      "Rhubarb + energy lip-sync works best with real TTS audio buffers",
      "Hindi: prefer short lines; text-guided visemes fill gaps",
    ],
    globalVisualTips: [
      layout === "dual"
        ? "Dual: top = emotion/speaker, bottom = world/reaction"
        : "Single: keep subject in upper third; leave caption space at bottom",
      "Prefer consistent character faces across scenes (same reference photo)",
      "Public Commons images are starting points — replace with your art for brand",
      "Match motion intensity to mood; fight high, romance low",
    ],
  };
}

export function formatDirectorReport(r: DirectorReport): string {
  const lines: string[] = [
    "Director / Mind Agent",
    r.summary,
    `Layout: ${r.layout}`,
    "",
    "— Global visual —",
    ...r.globalVisualTips.map((t) => `• ${t}`),
    "",
    "— Global voice —",
    ...r.globalVoiceTips.map((t) => `• ${t}`),
    "",
  ];
  for (const s of r.scenes) {
    lines.push(`Scene ${s.order + 1}: ${s.title} [${s.mood}]`);
    lines.push(`  Primary: ${s.panelPrimary}`);
    if (s.panelSecondary) lines.push(`  Secondary: ${s.panelSecondary}`);
    lines.push(`  Search: ${s.imageQueries.join(" | ")}`);
    if (s.suggestedImageUrls.length)
      lines.push(`  Web refs: ${s.suggestedImageUrls.length} image(s)`);
    lines.push(`  Motion: ${s.motionIntensity} — ${s.motionHint}`);
    lines.push(`  VO: ${s.voiceOverPlan.mode} — ${s.voiceOverPlan.tone}`);
    s.integrationSteps.forEach((step, i) =>
      lines.push(`  ${i + 1}. ${step}`),
    );
    lines.push("");
  }
  return lines.join("\n");
}
