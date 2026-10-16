import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Film,
  Plus,
  Clock,
  Swords,
  Heart,
  Pencil,
  Clapperboard,
  Sparkles,
  Mic2,
  Download,
  Zap,
  Shield,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import { BHARAT_TEMPLATES } from "@/lib/bharat-templates";
import type { Language } from "@/lib/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function HomePage() {
  const movies = useMovieStore((s) => s.movies);
  const setCurrentMovie = useMovieStore((s) => s.setCurrentMovie);
  const [uiLang, setUiLang] = useState<Language>("hi");
  const navigate = useNavigate();

  return (
    <main className="page-shell mx-auto min-h-dvh max-w-lg px-4 pb-28 pt-6 sm:max-w-2xl">
      {/* Top bar */}
      <header className="mb-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-orange-700 text-white shadow-lg shadow-orange-500/20">
            <Film className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                Bharat AI
              </h1>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                Studio
              </span>
            </div>
            <p className="text-sm text-muted">
              {uiLang === "hi"
                ? "₹0 · AI मूवी स्टूडियो"
                : "₹0 · AI movie studio"}
            </p>
          </div>
        </div>
        <div className="flex gap-0.5 rounded-xl border border-border bg-card p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setUiLang("hi")}
            className={cn(
              "rounded-lg px-2.5 py-1.5 transition",
              uiLang === "hi"
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-fg",
            )}
          >
            हिं
          </button>
          <button
            type="button"
            onClick={() => setUiLang("en")}
            className={cn(
              "rounded-lg px-2.5 py-1.5 transition",
              uiLang === "en"
                ? "bg-accent text-white shadow-sm"
                : "text-muted hover:text-fg",
            )}
          >
            EN
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="mb-8 overflow-hidden rounded-3xl border border-border bg-card">
        <div className="relative px-5 pb-6 pt-7 sm:px-7">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-24 w-24 rounded-full bg-sky-500/10 blur-2xl" />

          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
            <Zap className="h-3 w-3" />
            {uiLang === "hi" ? "ब्राउज़र में · बिना GPU बिल" : "In browser · no GPU bill"}
          </p>

          <h2 className="max-w-md text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {uiLang === "hi"
              ? "कहानी से फ़िल्म तक — एक स्टूडियो"
              : "Story to film — one studio"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
            {uiLang === "hi"
              ? "स्क्रिप्ट, अवतार मोशन, आवाज़ और एक्सपोर्ट। भारतीय कहानियों के लिए बनाया।"
              : "Script, avatar motion, voice and export. Built for Indian stories."}
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/create"
              className="btn-primary flex flex-1 items-center justify-center gap-2 px-5 py-3.5 text-sm"
            >
              <Plus className="h-4 w-4" />
              {t(uiLang, "createNew")}
            </Link>
            <button
              type="button"
              onClick={() => navigate("/create")}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-bg/50 px-5 py-3.5 text-sm font-medium text-fg transition hover:border-accent/40"
            >
              <Sparkles className="h-4 w-4 text-accent" />
              {uiLang === "hi" ? "टेम्पलेट से शुरू" : "Start from template"}
            </button>
          </div>
        </div>

        {/* Feature strip */}
        <div className="grid grid-cols-3 border-t border-border divide-x divide-border">
          {[
            {
              icon: Swords,
              label: uiLang === "hi" ? "फाइट" : "Fight",
              sub: uiLang === "hi" ? "एक्शन सीन" : "Action scenes",
            },
            {
              icon: Heart,
              label: uiLang === "hi" ? "रोमांस" : "Romance",
              sub: uiLang === "hi" ? "भावना सीन" : "Emotion",
            },
            {
              icon: Mic2,
              label: uiLang === "hi" ? "आवाज़" : "Voice",
              sub: uiLang === "hi" ? "हिंदी TTS" : "Hindi TTS",
            },
          ].map((f) => (
            <div key={f.label} className="px-3 py-3.5 text-center">
              <f.icon className="mx-auto h-4.5 w-4.5 text-accent" />
              <p className="mt-1.5 text-xs font-semibold">{f.label}</p>
              <p className="text-[10px] text-muted">{f.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline steps */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          {uiLang === "hi" ? "कैसे काम करता है" : "How it works"}
        </h2>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["Script", "Art", "Voice", "Export"].map((step, i) => (
            <li
              key={step}
              className="card-pro flex items-center gap-2 px-3 py-2.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                {i + 1}
              </span>
              <span className="text-xs font-medium">
                {uiLang === "hi"
                  ? ["स्क्रिप्ट", "आर्ट", "आवाज़", "एक्सपोर्ट"][i]
                  : step}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Templates */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {uiLang === "hi" ? "भारत टेम्पलेट" : "Bharat templates"}
          </h2>
          <button
            type="button"
            onClick={() => navigate("/create")}
            className="text-xs font-medium text-accent hover:underline"
          >
            {uiLang === "hi" ? "सभी देखें →" : "See all →"}
          </button>
        </div>
        <div className="scroll-x-hide flex gap-2.5 pb-1">
          {BHARAT_TEMPLATES.slice(0, 2).map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => navigate("/create")}
              className="card-pro min-w-[150px] shrink-0 px-3.5 py-3 text-left hover:border-accent/50"
            >
              <p className="text-xs font-semibold leading-snug">
                {uiLang === "hi" ? tpl.titleHi : tpl.titleEn}
              </p>
              <p className="mt-1.5 text-[10px] leading-snug text-muted">
                {uiLang === "hi" ? tpl.tagHi : tpl.tagEn}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Trust / honesty strip */}
      <div className="mb-8 flex gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3.5 text-sm">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div>
          <p className="font-medium">
            {uiLang === "hi" ? "ईमानदार लिमिट्स" : "Honest limits"}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {uiLang === "hi"
              ? "फ्री प्लान में browser pipeline + import। Photoreal GPU video optional worker से — quota वाली।"
              : "Free plan: browser pipeline + import. Photoreal GPU video via optional workers — quota limited."}
          </p>
        </div>
      </div>

      {/* Movies list */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {t(uiLang, "yourMovies")}
          </h2>
          {movies.length > 0 && (
            <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
              {movies.length}
            </span>
          )}
        </div>

        {movies.length === 0 ? (
          <div className="card-pro border-dashed py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10">
              <Clapperboard className="h-7 w-7 text-accent/80" />
            </div>
            <p className="mt-4 font-medium text-fg/90">
              {t(uiLang, "noMovies")}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
              {t(uiLang, "noMoviesHint")}
            </p>
            <Link
              to="/create"
              className="btn-primary mt-5 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            >
              <Plus className="h-4 w-4" />
              {t(uiLang, "createNew")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {movies.map((movie) => (
              <li key={movie.id}>
                <div className="card-pro p-4 hover:border-accent/30">
                  <Link
                    to={`/movie/${movie.id}`}
                    onClick={() => setCurrentMovie(movie.id)}
                    className="block"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="truncate font-semibold">{movie.title}</h3>
                      <span className="shrink-0 rounded-md bg-bg px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        {movie.status}
                      </span>
                    </div>
                    {movie.synopsis && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted">
                        {movie.synopsis}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {movie.targetDuration === "5min" ? "5 min" : "10 min"}
                      </span>
                      <span>
                        {movie.characters.length}{" "}
                        {uiLang === "hi" ? "किरदार" : "cast"}
                      </span>
                      <span>
                        {movie.scenes.length}{" "}
                        {uiLang === "hi" ? "सीन" : "scenes"}
                      </span>
                    </div>
                  </Link>
                  <div className="mt-3.5 flex gap-2 border-t border-border pt-3">
                    <Link
                      to={`/movie/${movie.id}`}
                      onClick={() => setCurrentMovie(movie.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium text-muted transition hover:border-accent hover:text-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t(uiLang, "editMovie")}
                    </Link>
                    <Link
                      to={`/movie/${movie.id}/produce`}
                      onClick={() => setCurrentMovie(movie.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-xs font-semibold text-accent transition hover:bg-accent/20"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t(uiLang, "produce")}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 border-t border-border pt-6 text-center text-[11px] text-muted">
        Bharat AI · zero-cost movie studio · browser-first
      </footer>
    </main>
  );
}
