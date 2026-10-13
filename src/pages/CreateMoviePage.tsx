import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Swords,
  Heart,
  Users,
  Clapperboard,
  Loader2,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import { generateScript } from "@/lib/script-engine";
import { BHARAT_TEMPLATES, type BharatTemplate } from "@/lib/bharat-templates";
import type { Language, MovieDuration } from "@/lib/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const GENRE_OPTIONS = [
  { id: "action", labelEn: "Action / Fight", labelHi: "एक्शन / फाइट", icon: Swords },
  { id: "romance", labelEn: "Romance", labelHi: "रोमांस", icon: Heart },
  { id: "drama", labelEn: "Drama", labelHi: "ड्रामा", icon: Users },
  { id: "comedy", labelEn: "Comedy", labelHi: "कॉमेडी", icon: Sparkles },
];

export function CreateMoviePage() {
  const navigate = useNavigate();
  const createMovie = useMovieStore((s) => s.createMovie);
  const applyScriptResult = useMovieStore((s) => s.applyScriptResult);

  const [idea, setIdea] = useState("");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<Language>("hi");
  const [duration, setDuration] = useState<MovieDuration>("5min");
  const [genres, setGenres] = useState<string[]>(["action", "romance"]);
  const [busy, setBusy] = useState<"idle" | "create" | "oneclick">("idle");
  const [pickedTemplate, setPickedTemplate] = useState<string | null>(null);

  function toggleGenre(id: string) {
    setGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  function applyTemplate(tpl: BharatTemplate) {
    setPickedTemplate(tpl.id);
    setLanguage(tpl.language);
    setDuration(tpl.duration);
    setGenres(tpl.genres);
    setTitle(tpl.language === "hi" ? tpl.titleHi : tpl.titleEn);
    setIdea(tpl.language === "hi" ? tpl.ideaHi : tpl.ideaEn);
  }

  function handleCreateOnly() {
    if (!idea.trim() && !title.trim()) return;
    setBusy("create");
    const movie = createMovie({
      title: title.trim() || undefined,
      idea: idea.trim() || undefined,
      language,
      targetDuration: duration,
      genres,
    });
    window.setTimeout(() => navigate(`/movie/${movie.id}`), 150);
  }

  function handleOneClick() {
    if (!idea.trim() && !title.trim()) return;
    setBusy("oneclick");

    const movie = createMovie({
      title: title.trim() || undefined,
      idea: idea.trim() || undefined,
      language,
      targetDuration: duration,
      genres,
    });

    window.setTimeout(() => {
      try {
        const result = generateScript({
          title: movie.title,
          idea: movie.synopsis || movie.title,
          language: movie.language,
          targetDuration: movie.targetDuration,
          genres: movie.genres ?? [],
        });
        applyScriptResult(movie.id, result, {
          replaceCast: true,
          replaceScenes: true,
        });
        navigate(`/movie/${movie.id}/produce`);
      } catch {
        navigate(`/movie/${movie.id}`);
      }
    }, 280);
  }

  const canCreate = idea.trim().length >= 8 || title.trim().length >= 2;
  const ui = language;

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-6 sm:max-w-2xl">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition hover:bg-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">{t(ui, "newMovie")}</h1>
          <p className="text-sm text-muted">{t(ui, "newMovieSub")}</p>
        </div>
      </header>

      {/* Phase 5 templates */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium">
          {language === "hi" ? "भारत टेम्पलेट" : "Bharat templates"}
        </h2>
        <p className="mb-3 text-xs text-muted">
          {language === "hi"
            ? "तैयार कहानी चुनें — फिर वन-क्लिक प्रोड्यूस"
            : "Pick a ready story — then one-click produce"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {BHARAT_TEMPLATES.map((tpl) => {
            const active = pickedTemplate === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition",
                  active
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card hover:border-accent/40",
                )}
              >
                <p className="text-xs font-semibold leading-tight">
                  {language === "hi" ? tpl.titleHi : tpl.titleEn}
                </p>
                <p className="mt-1 text-[10px] text-muted">
                  {language === "hi" ? tpl.tagHi : tpl.tagEn}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium">{t(ui, "language")}</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "en" as const, label: "English" },
                { id: "hi" as const, label: "हिन्दी" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLanguage(opt.id)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-medium transition",
                  language === opt.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-card text-muted hover:border-muted",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">{t(ui, "duration")}</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "5min" as const, label: t(ui, "min5") },
                { id: "10min" as const, label: t(ui, "min10") },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDuration(opt.id)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-sm font-medium transition",
                  duration === opt.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-card text-muted hover:border-muted",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">{t(ui, "styles")}</label>
          <div className="grid grid-cols-2 gap-2">
            {GENRE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = genres.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleGenre(opt.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition",
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-card text-muted hover:border-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {language === "hi" ? opt.labelHi : opt.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">{t(ui, "titleOpt")}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={language === "hi" ? "मेरी अवतार कहानी" : "My Avatar Story"}
            maxLength={120}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">{t(ui, "storyIdea")}</label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={
              language === "hi"
                ? "दो दोस्त, एक लड़ाई, और एक प्यार की कहानी..."
                : "Two rivals, a fierce fight, then a quiet romance gesture..."
            }
            rows={6}
            maxLength={4000}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed outline-none focus:border-accent"
          />
          <p className="mt-2 text-xs text-muted">{t(ui, "oneClickHint")}</p>
        </div>

        <button
          type="button"
          disabled={!canCreate || busy !== "idle"}
          onClick={handleOneClick}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold text-white transition",
            canCreate && busy === "idle"
              ? "bg-accent hover:bg-accent-hover active:scale-[0.98]"
              : "cursor-not-allowed bg-accent/40",
          )}
        >
          {busy === "oneclick" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t(ui, "generating")}
            </>
          ) : (
            <>
              <Clapperboard className="h-5 w-5" />
              {t(ui, "oneClick")}
            </>
          )}
        </button>

        <button
          type="button"
          disabled={!canCreate || busy !== "idle"}
          onClick={handleCreateOnly}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3.5 text-sm font-medium transition",
            canCreate && busy === "idle"
              ? "text-fg hover:border-accent"
              : "cursor-not-allowed text-muted",
          )}
        >
          {busy === "create" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t(ui, "creating")}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {t(ui, "createProject")}
            </>
          )}
        </button>
      </div>
    </main>
  );
}
