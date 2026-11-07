/**
 * Bridge: Bharat AI movie → package for darkzOGx/youtube-automation-agent
 *
 * Does NOT embed the Node YouTube agent. Builds a portable JSON publish
 * package (title, description, tags, scene script) you can paste into the
 * self-hosted agent after exporting the MP4 from Produce.
 *
 * @see docs/integrations/youtube-automation-agent.md
 * @see https://github.com/darkzOGx/youtube-automation-agent
 */

export type YtSceneLine = {
  index: number;
  title?: string;
  dialogue?: string;
  narration?: string;
  durationSec?: number;
};

export type YtMovieInput = {
  title: string;
  language?: "hi" | "en" | string;
  logline?: string;
  genre?: string;
  characters?: string[];
  scenes?: YtSceneLine[];
  /** Absolute or relative path / URL of exported video on the operator machine */
  videoFileHint?: string;
};

export type YtPublishPackage = {
  source: "bharat-ai";
  upstreamCompanion: "darkzOGx/youtube-automation-agent";
  createdAt: string;
  language: string;
  title: string;
  description: string;
  tags: string[];
  scriptText: string;
  scenes: YtSceneLine[];
  videoFileHint?: string;
  notes: string[];
};

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "is",
  "hai",
  "ke",
  "ki",
  "ka",
  "se",
  "mein",
  "me",
  "aur",
  "ek",
  "ye",
  "woh",
]);

function clampTitle(s: string, max = 90): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function extractTags(movie: YtMovieInput): string[] {
  const bag: string[] = [];
  const push = (x?: string) => {
    if (!x) return;
    const w = x.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();
    if (w && w.length > 1 && !STOP.has(w)) bag.push(w);
  };
  push("bharat ai");
  push("short film");
  push(movie.genre);
  push(movie.language === "hi" ? "hindi" : movie.language);
  (movie.characters || []).forEach(push);
  (movie.title || "").split(/\s+/).forEach(push);
  const uniq = Array.from(new Set(bag)).slice(0, 12);
  return uniq;
}

function buildDescription(movie: YtMovieInput, scriptText: string): string {
  const lines: string[] = [];
  if (movie.logline) lines.push(movie.logline.trim());
  lines.push("");
  lines.push("Made with Bharat AI — avatar movie studio.");
  if (movie.characters?.length) {
    lines.push("Cast: " + movie.characters.join(", "));
  }
  lines.push("");
  lines.push("— Script —");
  lines.push(scriptText.slice(0, 3500));
  lines.push("");
  lines.push(
    "Publishing companion: https://github.com/darkzOGx/youtube-automation-agent",
  );
  return lines.join("\n").trim();
}

function buildScriptText(movie: YtMovieInput): string {
  const scenes = movie.scenes || [];
  if (!scenes.length) {
    return [movie.title, movie.logline || ""].filter(Boolean).join("\n");
  }
  return scenes
    .map((s, i) => {
      const head = `Scene ${s.index ?? i + 1}${s.title ? " — " + s.title : ""}`;
      const body = [s.dialogue, s.narration].filter(Boolean).join("\n");
      return `${head}\n${body}`;
    })
    .join("\n\n");
}

/** Build a portable package for the self-hosted YouTube agent. */
export function buildYoutubePublishPackage(movie: YtMovieInput): YtPublishPackage {
  const scriptText = buildScriptText(movie);
  const title = clampTitle(movie.title || "Bharat AI short");
  return {
    source: "bharat-ai",
    upstreamCompanion: "darkzOGx/youtube-automation-agent",
    createdAt: new Date().toISOString(),
    language: movie.language || "hi",
    title,
    description: buildDescription(movie, scriptText),
    tags: extractTags(movie),
    scriptText,
    scenes: movie.scenes || [],
    videoFileHint: movie.videoFileHint,
    notes: [
      "Export the video file from Bharat AI Produce first.",
      "Import/attach that file in youtube-automation-agent on your PC.",
      "Paste title, description, and tags; run SEO agent if desired.",
      "Publish only after manual approval in the agent dashboard.",
    ],
  };
}

/** Download helpers for browser UI */
export function publishPackageToJson(pkg: YtPublishPackage): string {
  return JSON.stringify(pkg, null, 2);
}

export function downloadPublishPackage(pkg: YtPublishPackage, filename?: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([publishPackageToJson(pkg)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `${pkg.title.replace(/[^\w\u0900-\u097F]+/g, "-").slice(0, 40) || "bharat"}-yt-package.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function getYtAgentDashboardUrl(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("bharat_yt_agent_url");
}

export function setYtAgentDashboardUrl(url: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem("bharat_yt_agent_url", url.replace(/\/$/, ""));
}
