import { useEffect, useMemo, useState } from "react";
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
  Pencil,
  Check,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import type { Language, MovieDuration, SceneMood } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "details" | "cast" | "scenes";

const MOODS: { id: SceneMood; label: string; icon: typeof Swords }[] = [
  { id: "fight", label: "Fight", icon: Swords },
  { id: "romance", label: "Romance", icon: Heart },
  { id: "gesture", label: "Gesture", icon: Hand },
  { id: "dialogue", label: "Dialogue", icon: MessageSquare },
  { id: "action", label: "Action", icon: Clapperboard },
  { id: "emotional", label: "Emotional", icon: Heart },
];

const GENRE_OPTIONS = [
  { id: "action", label: "Action / Fight", icon: Swords },
  { id: "romance", label: "Romance", icon: Heart },
  { id: "drama", label: "Drama", icon: Users },
  { id: "comedy", label: "Comedy", icon: Sparkles },
];

export function MovieWorkspacePage() {
  const { movieId } = useParams<{ movieId: string }>();
  const movies = useMovieStore((s) => s.movies);
  const updateMovie = useMovieStore((s) => s.updateMovie);
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

  // Movie edit form
  const [editTitle, setEditTitle] = useState("");
  const [editSynopsis, setEditSynopsis] = useState("");
  const [editLanguage, setEditLanguage] = useState<Language>("en");
  const [editDuration, setEditDuration] = useState<MovieDuration>("5min");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  // Character inline edit
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [ecName, setEcName] = useState("");
  const [ecRole, setEcRole] = useState("");
  const [ecAppearance, setEcAppearance] = useState("");

  // Scene inline edit
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [esTitle, setEsTitle] = useState("");
  const [esMood, setEsMood] = useState<SceneMood>("dialogue");
  const [esNotes, setEsNotes] = useState("");
  const [esDialogue, setEsDialogue] = useState("");

  useEffect(() => {
    if (!movie) return;
    setEditTitle(movie.title);
    setEditSynopsis(movie.synopsis ?? "");
    setEditLanguage(movie.language);
    setEditDuration(movie.targetDuration);
    setEditGenres(movie.genres ?? []);
  }, [movie?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function toggleGenre(id: string) {
    setEditGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  function saveMovieDetails() {
    if (!movieId) return;
    const title = editTitle.trim() || "Untitled Movie";
    updateMovie(movieId, {
      title,
      synopsis: editSynopsis.trim(),
      language: editLanguage,
      targetDuration: editDuration,
      genres: editGenres,
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
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

  function startEditCharacter(c: {
    id: string;
    name: string;
    role?: string;
    appearance?: string;
  }) {
    setEditingCharId(c.id);
    setEcName(c.name);
    setEcRole(c.role ?? "");
    setEcAppearance(c.appearance ?? "");
  }

  function saveCharacterEdit() {
    if (!movieId || !editingCharId || !ecName.trim()) return;
    updateCharacter(movieId, editingCharId, {
      name: ecName.trim(),
      role: ecRole.trim() || undefined,
      appearance: ecAppearance.trim() || undefined,
    });
    setEditingCharId(null);
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

  function startEditScene(sc: {
    id: string;
    title: string;
    mood: SceneMood;
    gestureNotes?: string;
    dialogue?: string;
  }) {
    setEditingSceneId(sc.id);
    setEsTitle(sc.title);
    setEsMood(sc.mood);
    setEsNotes(sc.gestureNotes ?? "");
    setEsDialogue(sc.dialogue ?? "");
  }

  function saveSceneEdit() {
    if (!movieId || !editingSceneId || !esTitle.trim()) return;
    updateScene(movieId, editingSceneId, {
      title: esTitle.trim(),
      mood: esMood,
      gestureNotes: esNotes.trim() || undefined,
      dialogue: esDialogue.trim() || undefined,
    });
    setEditingSceneId(null);
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
        <button
          type="button"
          onClick={() => setTab("details")}
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:border-accent hover:text-accent"
          aria-label="Edit movie details"
          title="Edit movie"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
        {(
          [
            { id: "details" as const, label: "Edit", icon: Settings2 },
            { id: "cast" as const, label: "Cast", icon: Users },
            { id: "scenes" as const, label: "Scenes", icon: Clapperboard },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-medium transition sm:text-sm",
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

      {tab === "details" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-4 text-sm font-medium">Edit movie</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-muted">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={120}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-muted">
                  Story / synopsis
                </label>
                <textarea
                  value={editSynopsis}
                  onChange={(e) => setEditSynopsis(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-muted">Language</label>
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
                      onClick={() => setEditLanguage(opt.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-sm font-medium",
                        editLanguage === opt.id
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-muted">
                  Target duration
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "5min" as const, label: "5 minutes" },
                      { id: "10min" as const, label: "10 minutes" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEditDuration(opt.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-sm font-medium",
                        editDuration === opt.id
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border text-muted",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-muted">Genres</label>
                <div className="grid grid-cols-2 gap-2">
                  {GENRE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = editGenres.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleGenre(opt.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium",
                          active
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-border text-muted",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={saveMovieDetails}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white"
              >
                {savedFlash ? (
                  <>
                    <Check className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}

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
                {editingCharId === c.id ? (
                  <div className="space-y-3">
                    <input
                      value={ecName}
                      onChange={(e) => setEcName(e.target.value)}
                      className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <input
                      value={ecRole}
                      onChange={(e) => setEcRole(e.target.value)}
                      placeholder="Role"
                      className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <textarea
                      value={ecAppearance}
                      onChange={(e) => setEcAppearance(e.target.value)}
                      placeholder="Appearance"
                      rows={2}
                      className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveCharacterEdit}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white"
                      >
                        <Check className="h-4 w-4" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCharId(null)}
                        className="rounded-xl border border-border px-3 py-2 text-sm text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
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
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => startEditCharacter(c)}
                        className="text-muted hover:text-accent"
                        aria-label="Edit character"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCharacter(movie.id, c.id)}
                        className="text-muted hover:text-red-400"
                        aria-label="Remove character"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
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
                  {editingSceneId === sc.id ? (
                    <div className="space-y-3">
                      <input
                        value={esTitle}
                        onChange={(e) => setEsTitle(e.target.value)}
                        className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                      <div className="flex flex-wrap gap-2">
                        {MOODS.map((m) => {
                          const Icon = m.icon;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setEsMood(m.id)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                                esMood === m.id
                                  ? "border-accent bg-accent/15 text-accent"
                                  : "border-border text-muted",
                              )}
                            >
                              <Icon className="h-3 w-3" />
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        value={esNotes}
                        onChange={(e) => setEsNotes(e.target.value)}
                        placeholder="Gesture / action notes"
                        rows={2}
                        className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                      <textarea
                        value={esDialogue}
                        onChange={(e) => setEsDialogue(e.target.value)}
                        placeholder="Dialogue"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveSceneEdit}
                          className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white"
                        >
                          <Check className="h-4 w-4" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSceneId(null)}
                          className="rounded-xl border border-border px-3 py-2 text-sm text-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => startEditScene(sc)}
                            className="text-muted hover:text-accent"
                            aria-label="Edit scene"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeScene(movie.id, sc.id)}
                            className="text-muted hover:text-red-400"
                            aria-label="Remove scene"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
                    </>
                  )}
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
