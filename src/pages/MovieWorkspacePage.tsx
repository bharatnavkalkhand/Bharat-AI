import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clapperboard,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import type { MovieDuration, SceneMood } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOODS: SceneMood[] = [
  "neutral",
  "dialogue",
  "romance",
  "fight",
  "action",
  "gesture",
  "emotional",
  "dramatic",
  "comedy",
];

export function MovieWorkspacePage() {
  const { movieId } = useParams<{ movieId: string }>();
  const navigate = useNavigate();
  const movies = useMovieStore((s) => s.movies);
  const updateMovie = useMovieStore((s) => s.updateMovie);
  const updateScene = useMovieStore((s) => s.updateScene);
  const addScene = useMovieStore((s) => s.addScene);
  const removeScene = useMovieStore((s) => s.removeScene);
  const addCharacter = useMovieStore((s) => s.addCharacter);
  const removeCharacter = useMovieStore((s) => s.removeCharacter);

  const movie = useMemo(() => movies.find((m) => m.id === movieId) ?? null, [movies, movieId]);

  const [editTitle, setEditTitle] = useState("");
  const [editSynopsis, setEditSynopsis] = useState("");
  const [editDuration, setEditDuration] = useState<MovieDuration>("5min");

  useEffect(() => {
    if (!movie) return;
    setEditTitle(movie.title);
    setEditSynopsis(movie.synopsis || "");
    setEditDuration(movie.targetDuration);
  }, [movie?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!movie) {
    return (
      <main className="page-shell mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted">Movie not found</p>
        <Link to="/" className="mt-4 inline-block text-accent">
          Home
        </Link>
      </main>
    );
  }

  function saveMeta() {
    if (!movieId) return;
    updateMovie(movieId, {
      title: editTitle.trim() || movie!.title,
      synopsis: editSynopsis,
      targetDuration: editDuration,
    });
  }

  const sortedScenes = [...movie.scenes].sort((a, b) => a.order - b.order);

  return (
    <main className="page-shell mx-auto min-h-dvh max-w-lg px-4 pb-28 pt-6 sm:max-w-2xl">
      <header className="mb-5 flex items-start gap-3">
        <Link
          to="/"
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{movie.title}</h1>
          <p className="text-sm text-muted">
            {movie.targetDuration === "10sec"
              ? "10 sec"
              : movie.targetDuration === "5min"
                ? "5 min"
                : "10 min"}{" "}
            · {movie.characters.length} cast · {movie.scenes.length} scenes
          </p>
        </div>
        <Link
          to={`/movie/${movie.id}/produce`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-black"
        >
          <Clapperboard className="h-3.5 w-3.5" /> Produce
        </Link>
      </header>

      <section className="mb-4 card-pro space-y-3 p-3">
        <p className="text-xs font-semibold">
          <Pencil className="mr-1 inline h-3.5 w-3.5" /> Edit details
        </p>
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={saveMeta}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        />
        <textarea
          value={editSynopsis}
          onChange={(e) => setEditSynopsis(e.target.value)}
          onBlur={saveMeta}
          rows={3}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "10sec" as const, label: "10 sec" },
              { id: "5min" as const, label: "5 min" },
              { id: "10min" as const, label: "10 min" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setEditDuration(opt.id);
                if (movieId) updateMovie(movieId, { targetDuration: opt.id });
              }}
              className={cn(
                "rounded-xl border px-2 py-2 text-xs font-medium",
                editDuration === opt.id
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4 card-pro p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold">
            <Users className="mr-1 inline h-3.5 w-3.5" /> Cast
          </p>
          <button
            type="button"
            className="text-xs text-accent"
            onClick={() => {
              if (!movieId) return;
              addCharacter(movieId, {
                name: movie.language === "hi" ? "नया पात्र" : "New character",
                role: "",
                appearance: "",
              });
            }}
          >
            <Plus className="inline h-3 w-3" /> Add
          </button>
        </div>
        <ul className="space-y-2">
          {movie.characters.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5"
            >
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                value={c.name}
                onChange={(e) =>
                  useMovieStore.getState().updateCharacter(movieId!, c.id, {
                    name: e.target.value,
                  })
                }
              />
              <button
                type="button"
                className="text-muted"
                onClick={() => removeCharacter(movieId!, c.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-4 card-pro p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold">Scenes</p>
          <button
            type="button"
            className="text-xs text-accent"
            onClick={() => {
              if (!movieId) return;
              addScene(movieId, {
                title:
                  movie.language === "hi"
                    ? `दृश्य ${movie.scenes.length + 1}`
                    : `Scene ${movie.scenes.length + 1}`,
                mood: "dialogue",
                dialogue: "",
                status: "draft",
                characterIds: [],
              });
            }}
          >
            <Plus className="inline h-3 w-3" /> Add scene
          </button>
        </div>
        <ul className="space-y-2">
          {sortedScenes.map((sc, i) => (
            <li key={sc.id} className="rounded-lg border border-border p-2">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted">{i + 1}</span>
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                  value={sc.title}
                  onChange={(e) =>
                    updateScene(movieId!, sc.id, { title: e.target.value })
                  }
                />
                <select
                  value={sc.mood}
                  onChange={(e) =>
                    updateScene(movieId!, sc.id, {
                      mood: e.target.value as SceneMood,
                    })
                  }
                  className="rounded border border-border bg-bg px-1 py-0.5 text-[10px]"
                >
                  {MOODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => removeScene(movieId!, sc.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted" />
                </button>
              </div>
              <textarea
                className="w-full rounded bg-bg px-2 py-1 text-[11px] outline-none"
                rows={2}
                placeholder="Dialogue…"
                value={sc.dialogue || ""}
                onChange={(e) =>
                  updateScene(movieId!, sc.id, { dialogue: e.target.value })
                }
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-bg/95 p-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate(`/movie/${movie.id}/produce`)}
          className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-semibold text-black"
        >
          <Clapperboard className="h-4 w-4" /> Go to Produce
        </button>
      </div>
    </main>
  );
}
