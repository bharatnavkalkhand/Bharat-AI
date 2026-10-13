import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Swords, Heart, Users } from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import type { Language, MovieDuration } from "@/lib/types";
import { cn } from "@/lib/utils";

const GENRE_OPTIONS = [
  { id: "action", label: "Action / Fight", icon: Swords },
  { id: "romance", label: "Romance", icon: Heart },
  { id: "drama", label: "Drama", icon: Users },
  { id: "comedy", label: "Comedy", icon: Sparkles },
];

export function CreateMoviePage() {
  const navigate = useNavigate();
  const createMovie = useMovieStore((s) => s.createMovie);

  const [idea, setIdea] = useState("");
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [duration, setDuration] = useState<MovieDuration>("5min");
  const [genres, setGenres] = useState<string[]>(["action", "romance"]);
  const [isCreating, setIsCreating] = useState(false);

  function toggleGenre(id: string) {
    setGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  function handleCreate() {
    if (!idea.trim() && !title.trim()) return;
    setIsCreating(true);

    const movie = createMovie({
      title: title.trim() || undefined,
      idea: idea.trim() || undefined,
      language,
      targetDuration: duration,
      genres,
    });

    setTimeout(() => {
      navigate(`/movie/${movie.id}`);
    }, 200);
  }

  const canCreate = idea.trim().length >= 8 || title.trim().length >= 2;

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-6 sm:max-w-2xl">
      <header className="mb-8 flex items-center gap-3">
        <Link
          to="/"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition hover:bg-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">New Avatar Movie</h1>
          <p className="text-sm text-muted">Characters · Fight · Romance</p>
        </div>
      </header>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium">Language</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "en", label: "English" },
                { id: "hi", label: "हिन्दी" },
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
          <label className="mb-2 block text-sm font-medium">Target Duration</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "5min", label: "5 minutes" },
                { id: "10min", label: "10 minutes" },
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
          <label className="mb-2 block text-sm font-medium">
            Scene styles you want
          </label>
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
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Title <span className="text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Avatar Story"
            maxLength={120}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Story idea or script
          </label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={
              language === "hi"
                ? "दो दोस्त, एक लड़ाई, और एक प्यार की कहानी... या पूरा स्क्रिप्ट पेस्ट करें"
                : "Two rivals, a fierce fight under the rain, then a quiet romance gesture at the temple steps... or paste a full script"
            }
            rows={7}
            maxLength={4000}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed outline-none focus:border-accent"
          />
          <p className="mt-2 text-xs text-muted">
            Mention characters, fight moments, and romance gestures. You can
            fully edit everything later.
          </p>
        </div>

        <button
          type="button"
          disabled={!canCreate || isCreating}
          onClick={handleCreate}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold text-white transition",
            canCreate && !isCreating
              ? "bg-accent hover:bg-accent-hover active:scale-[0.98]"
              : "cursor-not-allowed bg-accent/40",
          )}
        >
          <Sparkles className="h-5 w-5" />
          {isCreating ? "Creating..." : "Create Movie Project"}
        </button>
      </div>
    </main>
  );
}
