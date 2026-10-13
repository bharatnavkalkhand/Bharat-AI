import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Film,
  Plus,
  Clock,
  AlertCircle,
  Swords,
  Heart,
  Pencil,
  Clapperboard,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import type { Language } from "@/lib/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function HomePage() {
  const movies = useMovieStore((s) => s.movies);
  const setCurrentMovie = useMovieStore((s) => s.setCurrentMovie);
  const [uiLang, setUiLang] = useState<Language>("hi");

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-8 sm:max-w-2xl">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Film className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Bharat AI</h1>
              <p className="text-sm text-muted">{t(uiLang, "appTagline")}</p>
            </div>
          </div>
          <div className="flex gap-1 rounded-lg border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setUiLang("hi")}
              className={cn(
                "rounded-md px-2 py-1",
                uiLang === "hi" ? "bg-accent text-white" : "text-muted",
              )}
            >
              हिं
            </button>
            <button
              type="button"
              onClick={() => setUiLang("en")}
              className={cn(
                "rounded-md px-2 py-1",
                uiLang === "en" ? "bg-accent text-white" : "text-muted",
              )}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl border border-border bg-card p-3">
          <Swords className="mx-auto h-5 w-5 text-accent" />
          <p className="mt-1 font-medium">{uiLang === "hi" ? "फाइट" : "Fight"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <Heart className="mx-auto h-5 w-5 text-accent" />
          <p className="mt-1 font-medium">{uiLang === "hi" ? "रोमांस" : "Romance"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <Film className="mx-auto h-5 w-5 text-accent" />
          <p className="mt-1 font-medium">{uiLang === "hi" ? "अवतार" : "Avatar"}</p>
        </div>
      </div>

      <div className="mb-8 flex gap-3 rounded-xl border border-border bg-card p-4 text-sm">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div>
          <p className="font-medium">{t(uiLang, "honestTitle")}</p>
          <p className="mt-1 text-muted">{t(uiLang, "honestBody")}</p>
        </div>
      </div>

      <Link
        to="/create"
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-2xl",
          "bg-accent px-6 py-4 text-base font-semibold text-white",
          "transition active:scale-[0.98] hover:bg-accent-hover",
        )}
      >
        <Plus className="h-5 w-5" />
        {t(uiLang, "createNew")}
      </Link>

      <section className="mt-12">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted">
          {t(uiLang, "yourMovies")}
        </h2>

        {movies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 text-center">
            <Film className="mx-auto h-10 w-10 text-muted/50" />
            <p className="mt-3 text-muted">{t(uiLang, "noMovies")}</p>
            <p className="mt-1 text-sm text-muted/70">{t(uiLang, "noMoviesHint")}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {movies.map((movie) => (
              <li key={movie.id}>
                <div className="rounded-2xl border border-border bg-card p-4 transition hover:border-accent/40">
                  <Link
                    to={`/movie/${movie.id}`}
                    onClick={() => setCurrentMovie(movie.id)}
                    className="block active:scale-[0.99]"
                  >
                    <h3 className="truncate font-medium">{movie.title}</h3>
                    {movie.synopsis && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted">
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
                  <div className="mt-3 flex gap-2 border-t border-border pt-3">
                    <Link
                      to={`/movie/${movie.id}`}
                      onClick={() => setCurrentMovie(movie.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-medium text-muted hover:border-accent hover:text-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t(uiLang, "editMovie")}
                    </Link>
                    <Link
                      to={`/movie/${movie.id}/produce`}
                      onClick={() => setCurrentMovie(movie.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 py-2 text-xs font-semibold text-accent"
                    >
                      <Clapperboard className="h-3.5 w-3.5" />
                      {t(uiLang, "produce")}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
