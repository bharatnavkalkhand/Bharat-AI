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
  FileText,
  Download,
  Loader2,
  Volume2,
} from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import type { Language, MovieDuration, SceneMood } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  generateScript,
  downloadTextFile,
  type ScriptOutput,
} from "@/lib/script-engine";

type Tab = "script" | "details" | "cast" | "scenes";

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
  const applyScriptResult = useMovieStore((s) => s.applyScriptResult);

  const movie = useMemo(
    () => movies.find((m) => m.id === movieId) ?? null,
    [movies, movieId],
  );

  const [tab, setTab] = useState<Tab>("script");
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("");
  const [charAppearance, setCharAppearance] = useState("");
  const [sceneTitle, setSceneTitle] = useState("");
  const [sceneMood, setSceneMood] = useState<SceneMood>("dialogue");
  const [sceneNotes, setSceneNotes] = useState("");
  const [sceneDialogue, setSceneDialogue] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSynopsis, setEditSynopsis] = useState("");
  const [editLanguage, setEditLanguage] = useState<Language>("en");
  const [editDuration, setEditDuration] = useState<MovieDuration>("5min");
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  const [ecName, setEcName] = useState("");
  const [ecRole, setEcRole] = useState("");
  const [ecAppearance, setEcAppearance] = useState("");
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [esTitle, setEsTitle] = useState("");
  const [esMood, setEsMood] = useState<SceneMood>("dialogue");
  const [esNotes, setEsNotes] = useState("");
  const [esDialogue, setEsDialogue] = useState("");
  const [scriptPreview, setScriptPreview] = useState<ScriptOutput | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState("");

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

  const currentMovie = movie;

  function toggleGenre(id: string) {
    setEditGenres((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  }

  function saveMovieDetails() {
    if (!movieId) return;
    updateMovie(movieId, {
      title: editTitle.trim() || "Untitled Movie",
      synopsis: editSynopsis.trim(),
      language: editLanguage,
      targetDuration: editDuration,
      genres: editGenres,
    });
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  }

  function runGenerateScript() {
    if (!movieId) return;
    setGenerating(true);
    setGenMessage("");
    window.setTimeout(() => {
      try {
        const result = generateScript({
          title: currentMovie.title,
          idea: currentMovie.synopsis || currentMovie.title,
          language: currentMovie.language,
          targetDuration: currentMovie.targetDuration,
          genres: currentMovie.genres ?? [],
        });
        setScriptPreview(result);
        applyScriptResult(movieId, result, {
          replaceCast: true,
          replaceScenes: true,
        });
        setGenMessage(
          `Generated ${result.scenes.length} scenes and ${result.characters.length} characters.`,
        );
        setTab("script");
      } catch {
        setGenMessage("Generation failed. Try again.");
      } finally {
        setGenerating(false);
      }
    }, 350);
  }

  function speakScript() {
    if (!scriptPreview && currentMovie.scenes.length === 0) return;
    const text =
      scriptPreview?.fullScriptText ??
      currentMovie.scenes
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => `${s.title}\n${s.dialogue ?? ""}`)
        .join("\n\n");
    if (!("speechSynthesis" in window)) {
      setGenMessage("Speech not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 4000));
    u.lang = currentMovie.language === "hi" ? "hi-IN" : "en-IN";
    window.speechSynthesis.speak(u);
  }

  function downloadScript() {
    let text = scriptPreview?.fullScriptText;
    if (!text) {
      const parts: string[] = [`TITLE: ${currentMovie.title}`, ""];
      if (currentMovie.synopsis) {
        parts.push(currentMovie.synopsis, "");
      }
      currentMovie.scenes
        .slice()
        .sort((a, b) => a.order - b.order)
        .forEach((s, i) => {
          parts.push(
            `--- SCENE ${i + 1}: ${s.title} [${s.mood}] ---`,
            s.dialogue ?? "",
            `VISUAL: ${s.visualPrompt ?? ""}`,
            "",
          );
        });
      text = parts.join("\n");
    }
    const safe =
      currentMovie.title.replace(/[^\w\u0900-\u097F]+/g, "_") || "script";
    downloadTextFile(`${safe}.txt`, text);
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

  const sortedScenes = movie.scenes.slice().sort((a, b) => a.order - b.order);

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
        <Link
          to={`/movie/${movie.id}/produce`}
          className="mt-0.5 shrink-0 rounded-full border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent"
        >
          Produce
        </Link>
      </header>

      <div className="mb-6 grid grid-cols-4 gap-1 rounded-xl border border-border bg-card p-1">
        {(
          [
            { id: "script" as const, label: "Script", icon: FileText },
            { id: "cast" as const, label: "Cast", icon: Users },
            { id: "scenes" as const, label: "Scenes", icon: Clapperboard },
            { id: "details" as const, label: "Edit", icon: Settings2 },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium transition sm:flex-row sm:gap-1.5 sm:text-xs",
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

      {tab === "script" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-1 text-sm font-medium">Script & scene output</h2>
            <p className="mb-4 text-xs text-muted">
              Free in-browser generator. For full pipeline (voice + storyboard),
              open Produce.
            </p>
            <button
              type="button"
              onClick={runGenerateScript}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate script + scenes
                </>
              )}
            </button>
            {genMessage && (
              <p className="mt-3 text-center text-xs text-accent">{genMessage}</p>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={downloadScript}
                disabled={!scriptPreview && movie.scenes.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium text-muted disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" /> Download .txt
              </button>
              <button
                type="button"
                onClick={speakScript}
                disabled={!scriptPreview && movie.scenes.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium text-muted disabled:opacity-40"
              >
                <Volume2 className="h-3.5 w-3.5" /> Read aloud
              </button>
            </div>
            <Link
              to={`/movie/${movie.id}/produce`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 py-3 text-sm font-medium text-accent"
            >
              Open Produce pipeline →
            </Link>
          </div>

          {scriptPreview && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Logline
              </p>
              <p className="mt-1 text-sm">{scriptPreview.logline}</p>
            </div>
          )}

          {(scriptPreview || sortedScenes.length > 0) && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-medium">Full script</h3>
              <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl bg-bg p-3 text-xs leading-relaxed text-fg/90">
                {scriptPreview?.fullScriptText ??
                  sortedScenes
                    .map(
                      (s, i) =>
                        `--- SCENE ${i + 1}: ${s.title} [${s.mood}] ---\n${s.dialogue ?? ""}\n`,
                    )
                    .join("\n")}
              </pre>
            </div>
          )}
        </section>
      )}

      {tab === "details" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <h2 className="text-sm font-medium">Edit movie</h2>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" placeholder="Title" />
            <textarea value={editSynopsis} onChange={(e) => setEditSynopsis(e.target.value)} rows={5} className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" placeholder="Story" />
            <div className="grid grid-cols-2 gap-2">
              {([{ id: "en" as const, label: "English" }, { id: "hi" as const, label: "हिन्दी" }] as const).map((opt) => (
                <button key={opt.id} type="button" onClick={() => setEditLanguage(opt.id)} className={cn("rounded-xl border px-3 py-2.5 text-sm font-medium", editLanguage === opt.id ? "border-accent bg-accent/10 text-accent" : "border-border text-muted")}>{opt.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([{ id: "5min" as const, label: "5 min" }, { id: "10min" as const, label: "10 min" }] as const).map((opt) => (
                <button key={opt.id} type="button" onClick={() => setEditDuration(opt.id)} className={cn("rounded-xl border px-3 py-2.5 text-sm font-medium", editDuration === opt.id ? "border-accent bg-accent/10 text-accent" : "border-border text-muted")}>{opt.label}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {GENRE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = editGenres.includes(opt.id);
                return (
                  <button key={opt.id} type="button" onClick={() => toggleGenre(opt.id)} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium", active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted")}>
                    <Icon className="h-4 w-4" />{opt.label}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={saveMovieDetails} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white">
              <Check className="h-4 w-4" />{savedFlash ? "Saved" : "Save changes"}
            </button>
          </div>
        </section>
      )}

      {tab === "cast" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Add character</h2>
            <input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="Name" className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <input value={charRole} onChange={(e) => setCharRole(e.target.value)} placeholder="Role" className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <textarea value={charAppearance} onChange={(e) => setCharAppearance(e.target.value)} placeholder="Appearance" rows={2} className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <button type="button" onClick={onAddCharacter} disabled={!charName.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" />Add to cast</button>
          </div>
          <ul className="space-y-3">
            {movie.characters.map((c) => (
              <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
                {editingCharId === c.id ? (
                  <div className="space-y-3">
                    <input value={ecName} onChange={(e) => setEcName(e.target.value)} className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                    <input value={ecRole} onChange={(e) => setEcRole(e.target.value)} className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                    <textarea value={ecAppearance} onChange={(e) => setEcAppearance(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                    <div className="flex gap-2">
                      <button type="button" onClick={saveCharacterEdit} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white"><Check className="h-4 w-4" />Save</button>
                      <button type="button" onClick={() => setEditingCharId(null)} className="rounded-xl border border-border px-3 py-2 text-sm text-muted">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-bg">
                      {c.referenceImageLocal ? <img src={c.referenceImageLocal} alt={c.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-muted">Face</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.name}</p>
                      {c.role && <p className="text-xs text-muted">{c.role}</p>}
                      <label className="mt-2 inline-block cursor-pointer text-xs text-accent">Upload face<input type="file" accept="image/*" className="hidden" onChange={(e) => onReferenceImage(c.id, e.target.files?.[0] ?? null)} /></label>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button type="button" onClick={() => startEditCharacter(c)} className="text-muted hover:text-accent"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => removeCharacter(movie.id, c.id)} className="text-muted hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "scenes" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-medium">Add scene</h2>
            <input value={sceneTitle} onChange={(e) => setSceneTitle(e.target.value)} placeholder="Scene title" className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => {
                const Icon = m.icon;
                return (
                  <button key={m.id} type="button" onClick={() => setSceneMood(m.id)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium", sceneMood === m.id ? "border-accent bg-accent/15 text-accent" : "border-border text-muted")}>
                    <Icon className="h-3.5 w-3.5" />{m.label}
                  </button>
                );
              })}
            </div>
            <textarea value={sceneNotes} onChange={(e) => setSceneNotes(e.target.value)} rows={2} placeholder="Gesture notes" className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <textarea value={sceneDialogue} onChange={(e) => setSceneDialogue(e.target.value)} rows={3} placeholder="Dialogue" className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <button type="button" onClick={onAddScene} disabled={!sceneTitle.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" />Add scene</button>
          </div>
          <ul className="space-y-3">
            {sortedScenes.map((sc, idx) => (
              <li key={sc.id} className="rounded-2xl border border-border bg-card p-4">
                {editingSceneId === sc.id ? (
                  <div className="space-y-3">
                    <input value={esTitle} onChange={(e) => setEsTitle(e.target.value)} className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                    <textarea value={esNotes} onChange={(e) => setEsNotes(e.target.value)} rows={2} className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                    <textarea value={esDialogue} onChange={(e) => setEsDialogue(e.target.value)} rows={3} className="w-full resize-none rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                    <div className="flex gap-2">
                      <button type="button" onClick={saveSceneEdit} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white"><Check className="h-4 w-4" />Save</button>
                      <button type="button" onClick={() => setEditingSceneId(null)} className="rounded-xl border border-border px-3 py-2 text-sm text-muted">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs text-muted">Scene {idx + 1}</p>
                        <p className="font-medium">{sc.title}</p>
                        <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-xs capitalize text-accent">{sc.mood}</span>
                        {sc.dialogue && <p className="mt-1 whitespace-pre-wrap text-sm">{sc.dialogue}</p>}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button type="button" onClick={() => startEditScene(sc)} className="text-muted hover:text-accent"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => removeScene(movie.id, sc.id)} className="text-muted hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <input value={sc.visualPrompt ?? ""} onChange={(e) => updateScene(movie.id, sc.id, { visualPrompt: e.target.value })} placeholder="Visual prompt" className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent" />
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
