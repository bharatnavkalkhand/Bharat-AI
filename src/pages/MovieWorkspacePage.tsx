import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Users,
  Clapperboard,
  Swords,
  Heart,
  Hand,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import type { SceneMood } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "cast" | "scenes";

const MOODS: { id: SceneMood; label: string; icon: typeof Swords }[] = [
  { id: "fight", label: "Fight", icon: Swords },
  { id: "romance", label: "Romance", icon: Heart },
  { id: "gesture", label: "Gesture", icon: Hand },
  { id: "dialogue", label: "Dialogue", icon: MessageSquare },
  { id: "action", label: "Action", icon: Clapperboard },
  { id: "emotional", label: "Emotional", icon: Heart },
];

export function MovieWorkspacePage() {
  const { movieId } = useParams<{ movieId: string }>();
  const movies = useMovieStore((s) => s.movies);
  const addCharacter = useMovieStore((s) => s.addCharacter);
  const updateCharacter = useMovieStore((s) => s.updateCharacter);
  const removeCharacter = useMovieStore((s) => s.removeCharacter);
  const addScene = useMovieStore((s) => s.addScene);
  const updateScene = useMovieStore((s) => s.updateScene);
  const removeScene = useMovieStore((s) => s.removeScene);

  const movie = useMemo(
    () => movies.find((m) => m.id === movieId) ?? null,
    [movies, movieId],
  );

  const [tab, setTab] = useState<Tab>("cast");
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("");
  const [charAppearance, setCharAppearance] = useState("");
  const [sceneTitle, setSceneTitle] = useState("");
  const [sceneMood, setSceneMood] = useState<SceneMood>("dialogue");
  const [sceneNotes, setSceneNotes] = useState("");
  const [sceneDialogue, setSceneDialogue] = useState("");

  if (!movie) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-muted">Movie not found</p>
        <Link to="/" className="mt-4 inline-block text-accent">
          Back home
        </Link>
      </main>
    );
  }

  function onAddCharacter() {
    if (!charName.trim() || !movieId) return;
    addCharacter(movieId, {
      name: charName.trim(),
      role: charRole.trim() || undefined,
      appearance: charAppearance.trim() || undefined,
    });
    setCharName("");
    setCharRole("");
    setCharAppearance("");
  }

  function onAddScene() {
    if (!sceneTitle.trim() || !movieId) return;
    addScene(movieId, {
      title: sceneTitle.trim(),
      mood: sceneMood,
      gestureNotes: sceneNotes.trim() || undefined,
      dialogue: sceneDialogue.trim() || undefined,
      status: "draft",
      characterIds: [],
    });
    setSceneTitle("");
    setSceneNotes("");
    setSceneDialogue("");
  }

  function onReferenceImage(characterId: string, file: File | null) {
    if (!file || !movieId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (dataUrl) {
        updateCharacter(movieId, characterId, {
          referenceImageLocal: dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-28 pt-6 sm:max-w-2xl">
      <header className="mb-6 flex items-start gap-3">
        <Link
          to="/"
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:bg-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{movie.title}</h1>
          <p className="text-sm text-muted">
            {movie.targetDuration === "5min" ? "5 min" : "10 min"} ·{" "}
            {movie.characters.length} cast · {movie.scenes.length} scenes
          </p>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-1">
        {(
          [
            { id: "cast" as const, label: "Cast / Avatars", icon: Users },
            { id: "scenes" as const, label: "Scenes", icon: Clapperboard },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              tab === t.id
                ? "bg-accent text-white"
                : "text-muted hover:text-fg",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "cast" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">Add character / avatar</h2>
            <div className="space-y-3">
              <input
                value={charName}
                onChange={(e) => setCharName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <input
                value={charRole}
                onChange={(e) => setCharRole(e.target.value)}
                placeholder="Role (hero, villain, love interest…)"
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <textarea
                value={charAppearance}
                onChange={(e) => setCharAppearance(e.target.value)}
                placeholder="Appearance notes for consistent avatar"
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={onAddCharacter}
                disabled={!charName.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Add to cast
              </button>
            </div>
          </div>

          <ul className="space-y-3">
            {movie.characters.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-bg">
                    {c.referenceImageLocal ? (
                      <img
                        src={c.referenceImageLocal}
                        alt={c.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">
                        Face
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.name}</p>
                    {c.role && (
                      <p className="text-xs text-muted">{c.role}</p>
                    )}
                    {c.appearance && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted">
                        {c.appearance}
                      </p>
                    )}
                    <label className="mt-2 inline-block cursor-pointer text-xs text-accent">
                      Upload reference face
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          onReferenceImage(
                            c.id,
                            e.target.files?.[0] ?? null,
                          )
                        }
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCharacter(movie.id, c.id)}
                    className="text-muted hover:text-red-400"
                    aria-label="Remove character"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
            {movie.characters.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                No characters yet. Add heroes, rivals, or love interests.
              </p>
            )}
          </ul>
        </section>
      )}

      {tab === "scenes" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-medium">Add scene</h2>
            <div className="space-y-3">
              <input
                value={sceneTitle}
                onChange={(e) => setSceneTitle(e.target.value)}
                placeholder="Scene title"
                className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <div>
                <p className="mb-2 text-xs text-muted">Mood / effect type</p>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSceneMood(m.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                          sceneMood === m.id
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-border text-muted",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <textarea
                value={sceneNotes}
                onChange={(e) => setSceneNotes(e.target.value)}
                placeholder={
                  sceneMood === "fight"
                    ? "Fight notes: sword clash, kick, dodge…"
                    : sceneMood === "romance"
                      ? "Romance notes: hand hold, soft smile, embrace…"
                      : "Gesture / action notes"
                }
                rows={2}
                className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <textarea
                value={sceneDialogue}
                onChange={(e) => setSceneDialogue(e.target.value)}
                placeholder="Dialogue or narration (optional)"
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={onAddScene}
                disabled={!sceneTitle.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Add scene
              </button>
            </div>
          </div>

          <ul className="space-y-3">
            {movie.scenes
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((sc, idx) => (
                <li
                  key={sc.id}
                  className="rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted">Scene {idx + 1}</p>
                      <p className="font-medium">{sc.title}</p>
                      <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-xs capitalize text-accent">
                        {sc.mood}
                      </span>
                      {sc.gestureNotes && (
                        <p className="mt-2 text-sm text-muted">
                          {sc.gestureNotes}
                        </p>
                      )}
                      {sc.dialogue && (
                        <p className="mt-1 line-clamp-3 text-sm">
                          {sc.dialogue}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeScene(movie.id, sc.id)}
                      className="text-muted hover:text-red-400"
                      aria-label="Remove scene"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-muted">Visual prompt</label>
                    <input
                      value={sc.visualPrompt ?? ""}
                      onChange={(e) =>
                        updateScene(movie.id, sc.id, {
                          visualPrompt: e.target.value,
                        })
                      }
                      placeholder="Describe the shot for later generation…"
                      className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </div>
                </li>
              ))}
            {movie.scenes.length === 0 && (
              <p className="py-8 text-center text-sm text-muted">
                No scenes yet. Add fight, romance, or dialogue beats.
              </p>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
