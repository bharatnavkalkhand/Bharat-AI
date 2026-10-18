import { useMemo, useState } from "react";
import { ExternalLink, Copy, Check, Clapperboard, Mic2 } from "lucide-react";
import type { Character, Scene } from "@/lib/types";
import {
  invertAllScenes,
  copyText,
  type InvertedScenePrompt,
} from "@/agents/prompt-inverter";
import { readMediaAsDataUrl } from "@/agents/visual-binder";
import { cn } from "@/lib/utils";

interface Props {
  language: "en" | "hi";
  movieTitle: string;
  scenes: Scene[];
  characters: Character[];
  onImportVideo: (sceneId: string, dataUrl: string) => void;
  onStatus?: (msg: string) => void;
  className?: string;
}

export function ExternalStudioPanel({
  language,
  movieTitle,
  scenes,
  characters,
  onImportVideo,
  onStatus,
  className,
}: Props) {
  const hi = language === "hi";
  const [copied, setCopied] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const inverted: InvertedScenePrompt[] = useMemo(
    () =>
      invertAllScenes(scenes, {
        movieTitle,
        characters,
        language,
      }),
    [scenes, movieTitle, characters, language],
  );

  async function doCopy(key: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(key);
      onStatus?.(hi ? "Prompt clipboard me copy — Civitai me paste karein" : "Prompt copied — paste in Civitai");
      window.setTimeout(() => setCopied(null), 1800);
    } else {
      onStatus?.(hi ? "Copy fail — text select karke copy karein" : "Copy failed — select text manually");
    }
  }

  /** Copy video prompt then open Civitai Generate */
  async function sendToCivitai(inv: InvertedScenePrompt) {
    const ok = await copyText(inv.videoPrompt);
    if (ok) {
      setCopied(`vid-${inv.sceneId}`);
      onStatus?.(
        hi
          ? "Prompt copy ho gaya → Civitai Generate khul raha hai. Paste → Generate → Download → yahan Import"
          : "Prompt copied → opening Civitai Generate. Paste → Generate → Download → Import here",
      );
      window.setTimeout(() => setCopied(null), 2000);
    }
    window.open(inv.civitaiGenerateUrl, "_blank", "noopener,noreferrer");
  }

  async function onVideoFile(sceneId: string, file: File | null) {
    if (!file) return;
    try {
      if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov)$/i.test(file.name)) {
        onStatus?.(hi ? "Video file chuniye (mp4/webm)" : "Pick a video file (mp4/webm)");
        return;
      }
      if (file.size > 6 * 1024 * 1024) {
        onStatus?.(hi ? "Video badi hai (max ~6 MB / scene)" : "Video too large (max ~6 MB / scene)");
        return;
      }
      const dataUrl = await readMediaAsDataUrl(file);
      onImportVideo(sceneId, dataUrl);
      onStatus?.(
        hi
          ? `Video lag gaya (${file.name}). Play pe script voice ke saath chalega.`
          : `Video attached (${file.name}). Play will add script voice.`,
      );
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "Video import failed");
    }
  }

  if (!inverted.length) {
    return (
      <section className={cn("mb-4 card-pro p-3", className)}>
        <p className="text-xs font-semibold">
          {hi ? "Civitai video pipeline" : "Civitai video pipeline"}
        </p>
        <p className="mt-1 text-[11px] text-muted">
          {hi ? "Pehle script / scenes banao." : "Create script / scenes first."}
        </p>
      </section>
    );
  }

  return (
    <section className={cn("mb-4 card-pro p-3", className)}>
      <div className="mb-2 flex items-start gap-2">
        <Clapperboard className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div>
          <p className="text-xs font-semibold">
            {hi ? "Civitai Direct Pipeline" : "Civitai Direct Pipeline"}
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted">
            {hi
              ? "1) Prompt copy + Civitai Generate kholo → 2) Video download → 3) Import → 4) Play = video + script voice"
              : "1) Copy prompt + open Civitai Generate → 2) Download video → 3) Import → 4) Play = video + script voice"}
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2 py-1.5 text-[10px] text-accent">
        <Mic2 className="h-3 w-3 shrink-0" />
        {hi
          ? "Voice app ke script dialogue se aati hai — Civitai se video, yahan se awaaz."
          : "Voice comes from script dialogue — Civitai video + in-app voice on Play."}
      </div>

      <ul className="space-y-2">
        {inverted.map((inv) => {
          const sc = scenes.find((s) => s.id === inv.sceneId);
          const hasVid = Boolean(sc?.externalVideoLocal);
          const open = openId === inv.sceneId || inverted.length === 1;
          return (
            <li
              key={inv.sceneId}
              className="rounded-lg border border-border bg-black/20 p-2"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left"
                onClick={() =>
                  setOpenId((id) => (id === inv.sceneId ? null : inv.sceneId))
                }
              >
                <span className="text-[11px] font-semibold">
                  {inv.order + 1}. {inv.title}{" "}
                  <span className="font-normal text-muted">[{inv.mood}]</span>
                </span>
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] font-semibold",
                    hasVid
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/5 text-muted",
                  )}
                >
                  {hasVid
                    ? hi
                      ? "Video + ready"
                      : "Video ready"
                    : hi
                      ? "Pending"
                      : "Pending"}
                </span>
              </button>

              {open && (
                <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                  <p className="line-clamp-3 text-[10px] leading-snug text-muted">
                    {inv.videoPrompt.slice(0, 220)}
                    {inv.videoPrompt.length > 220 ? "…" : ""}
                  </p>

                  {/* Primary CTA: send to Civitai */}
                  <button
                    type="button"
                    onClick={() => void sendToCivitai(inv)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-2 py-2 text-[11px] font-bold text-black"
                  >
                    {copied === `vid-${inv.sceneId}` ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5" />
                    )}
                    {hi
                      ? "1. Prompt → Civitai Generate"
                      : "1. Prompt → Civitai Generate"}
                  </button>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => void doCopy(`vp-${inv.sceneId}`, inv.videoPrompt)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium"
                    >
                      {copied === `vp-${inv.sceneId}` ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {hi ? "Sirf prompt copy" : "Copy prompt only"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void doCopy(`neg-${inv.sceneId}`, inv.negativePrompt)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium"
                    >
                      {copied === `neg-${inv.sceneId}` ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Negative
                    </button>
                    <a
                      href={inv.civitaiVideosUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:border-accent/40"
                    >
                      Gallery <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={inv.roarVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:border-accent/40"
                    >
                      Roar <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Step 2: import */}
                  <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-accent/50 bg-accent/5 px-2 py-2 text-[11px] font-semibold text-accent">
                    {hi ? "2. Generated video Import" : "2. Import generated video"}
                    <input
                      type="file"
                      accept="video/*,.mp4,.webm,.mov"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        void onVideoFile(inv.sceneId, f);
                        e.target.value = "";
                      }}
                    />
                  </label>

                  <p className="text-[9px] leading-relaxed text-muted">
                    {hi
                      ? "3. Neeche Play dabao — imported video + script ki voice ek saath."
                      : "3. Press Play below — imported video + script voice together."}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[9px] leading-relaxed text-muted">
        {hi
          ? "Note: Civitai apna free Buzz use karta hai (account login). Bharat AI ₹0 rehta hai — video aap import karte ho, voice yahan se."
          : "Note: Civitai uses your free Buzz (login). Bharat AI stays ₹0 — you import video; voice is from this app."}
      </p>
    </section>
  );
}
