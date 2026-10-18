import { useMemo, useState } from "react";
import { ExternalLink, Copy, Check, Clapperboard } from "lucide-react";
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
      onStatus?.(hi ? "Clipboard me copy ho gaya" : "Copied to clipboard");
      window.setTimeout(() => setCopied(null), 1600);
    } else {
      onStatus?.(hi ? "Copy fail — text select karke copy karein" : "Copy failed — select text manually");
    }
  }

  async function onVideoFile(sceneId: string, file: File | null) {
    if (!file) return;
    try {
      if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov)$/i.test(file.name)) {
        onStatus?.(hi ? "Video file chuniye (mp4/webm)" : "Pick a video file (mp4/webm)");
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        onStatus?.(hi ? "Video badi hai (max ~4 MB / scene)" : "Video too large (max ~4 MB / scene)");
        return;
      }
      const dataUrl = await readMediaAsDataUrl(file);
      onImportVideo(sceneId, dataUrl);
      onStatus?.(hi ? `Video scene pe lag gaya (${file.name})` : `Video attached (${file.name})`);
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : "Video import failed");
    }
  }

  if (!inverted.length) {
    return (
      <section className={cn("mb-4 card-pro p-3", className)}>
        <p className="text-xs font-semibold">
          {hi ? "Civitai + Roar.art studio" : "Civitai + Roar.art studio"}
        </p>
        <p className="mt-1 text-[10px] text-muted">
          {hi ? "Pehle script / pipeline chalao." : "Run script / pipeline first."}
        </p>
      </section>
    );
  }

  return (
    <section className={cn("mb-4 card-pro p-3", className)}>
      <div className="mb-2 flex items-center gap-2">
        <Clapperboard className="h-4 w-4 text-accent" />
        <p className="text-xs font-semibold">
          {hi ? "Scene design · Civitai + Roar" : "Scene design · Civitai + Roar"}
        </p>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-muted">
        {hi
          ? "1) Image prompt copy → Civitai Images. 2) Motion prompt → Roar Img2Vid. 3) Clip download karke yahan Import."
          : "1) Copy image prompt → Civitai Images. 2) Motion prompt → Roar Img2Vid. 3) Download clip → Import here."}
      </p>

      <ul className="space-y-2">
        {inverted.map((inv) => {
          const sc = scenes.find((s) => s.id === inv.sceneId);
          const hasVid = Boolean(sc?.externalVideoLocal);
          const isOpen = openId === inv.sceneId;
          return (
            <li
              key={inv.sceneId}
              className="rounded-lg border border-border bg-bg/40 px-2.5 py-2"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => setOpenId(isOpen ? null : inv.sceneId)}
              >
                <span className="w-5 shrink-0 text-[10px] font-bold text-muted">
                  {inv.order + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{inv.title}</span>
                {hasVid ? (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">
                    video ✓
                  </span>
                ) : (
                  <span className="text-[10px] text-muted">still</span>
                )}
              </button>

              {isOpen && (
                <div className="mt-2 space-y-2 border-t border-border pt-2">
                  <div>
                    <p className="mb-1 text-[10px] font-semibold text-muted">Image prompt</p>
                    <p className="max-h-16 overflow-y-auto rounded bg-card px-2 py-1 text-[10px] leading-snug text-fg/90">
                      {inv.imagePrompt}
                    </p>
                    <button
                      type="button"
                      onClick={() => void doCopy(`${inv.sceneId}-img`, inv.imagePrompt)}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-accent"
                    >
                      {copied === `${inv.sceneId}-img` ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Copy image
                    </button>
                  </div>

                  <div>
                    <p className="mb-1 text-[10px] font-semibold text-muted">Motion (Roar)</p>
                    <p className="rounded bg-card px-2 py-1 text-[10px] leading-snug">{inv.motionPrompt}</p>
                    <button
                      type="button"
                      onClick={() => void doCopy(`${inv.sceneId}-mot`, inv.motionPrompt)}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-accent"
                    >
                      {copied === `${inv.sceneId}-mot` ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      Copy motion
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <a
                      href={inv.civitaiImagesUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:border-accent/40"
                    >
                      Civitai Images <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={inv.civitaiVideosUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:border-accent/40"
                    >
                      Civitai Videos <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href={inv.roarVideoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent"
                    >
                      Roar Img2Vid <ExternalLink className="h-3 w-3" />
                    </a>
                    <label className="cursor-pointer rounded-md border border-border px-2 py-1 text-[10px] font-semibold">
                      Import video
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
                  </div>

                  <p className="text-[9px] text-muted">
                    tags: {inv.searchTags.join(", ")}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
