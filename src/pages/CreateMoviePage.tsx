import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { useMovieStore } from "@/store/movie-store";
import type { Language, MovieDuration } from "@/lib/types";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BHARAT_TEMPLATES } from "@/lib/bharat-templates";

const STYLE_OPTIONS = [
  { id: "romance", en: "Romance", hi: "रोमांस" },
  { id: "fight", en: "Fight", hi: "लड़ाई" },
  { id: "gesture", en: "Gesture", hi: "जेस्चर" },
  { id: "drama", en: "Drama", hi: "ड्रामा" },
  { id: "mythology", en: "Mythology", hi: "पौराणिक" },
] as const;

export function CreateMoviePage() {
  const navigate = useNavigate();
  const createMovie = useMovieStore((s) => s.createMovie);
  const applyScriptResult = useMovieStore((s) => s.applyScriptResult);
  const [ui, setUi] = useState<Language>("hi");
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [duration, setDuration] = useState<MovieDuration>("10sec");
  const [styles, setStyles] = useState<string[]>(["mythology", "drama"]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"create" | "oneclick">("create");

  function toggleStyle(id: string) {
    setStyles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function applyTemplate(idx: number) {
    const tpl = BHARAT_TEMPLATES[idx];
    if (!tpl) return;
    setUi(tpl.language || "hi");
    setTitle(tpl.language === "hi" ? tpl.titleHi : tpl.titleEn);
    setIdea(tpl.language === "hi" ? tpl.ideaHi : tpl.ideaEn);
    setDuration(tpl.duration);
    setStyles(tpl.genres || ["drama"]);
  }

  async function submit(oneClick: boolean) {
    if (!idea.trim() && !title.trim()) return;
    setBusy(true);
    setMode(oneClick ? "oneclick" : "create");
    try {
      const movie = createMovie({
        title: title.trim() || (ui === "hi" ? "नई मूवी" : "New Movie"),
        idea: idea.trim(),
        language: ui,
        targetDuration: duration,
        genres: styles,
      });

      if (oneClick) {
        const { generateScript } = await import("@/lib/script-engine");
        const script = generateScript({
          title: movie.title,
          idea: idea.trim() || movie.title,
          language: movie.language,
          targetDuration: movie.targetDuration,
          genres: movie.genres ?? [],
        });
        applyScriptResult(movie.id, script, { replaceCast: true, replaceScenes: true });
        navigate(`/movie/${movie.id}/produce`);
      } else {
        navigate(`/movie/${movie.id}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell mx-auto min-h-dvh max-w-lg px-4 pb-20 pt-6 sm:max-w-xl">
      <header className="mb-6 flex items-start gap-3">
        <Link
          to="/"
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t(ui, "newMovie")}</h1>
          <p className="text-sm text-muted">{t(ui, "newMovieSub")}</p>
        </div>
      </header>

      <section className="mb-4">
        <p className="mb-2 text-xs font-semibold text-muted">
          {ui === "hi" ? "भाषा" : "Language"}
        </p>
        <div className="flex gap-2">
          {(["hi", "en"] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setUi(lang)}
              className={cn(
                "flex-1 rounded-xl border py-2.5 text-sm font-semibold",
                ui === lang ? "border-accent bg-accent/15 text-accent" : "border-border text-muted",
              )}
            >
              {lang === "hi" ? "हिन्दी" : "English"}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4">
        <p className="mb-2 text-xs font-semibold text-muted">{t(ui, "duration")}</p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: "10sec" as const, label: t(ui, "sec10") },
              { id: "5min" as const, label: t(ui, "min5") },
              { id: "10min" as const, label: t(ui, "min10") },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDuration(opt.id)}
              className={cn(
                "rounded-xl border py-2.5 text-xs font-semibold sm:text-sm",
                duration === opt.id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-muted">
          {ui === "hi"
            ? "10 सेकंड = तुरंत डेमो रील। लंबी कहानी के लिए 5/10 मिनट।"
            : "10 sec = instant demo reel. Use 5/10 min for longer stories."}
        </p>
      </section>

      <section className="mb-4">
        <p className="mb-2 text-xs font-semibold text-muted">{t(ui, "styles")}</p>
        <div className="flex flex-wrap gap-2">
          {STYLE_OPTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleStyle(s.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium",
                styles.includes(s.id)
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border text-muted",
              )}
            >
              {ui === "hi" ? s.hi : s.en}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-3">
        <label className="mb-1 block text-xs font-semibold text-muted">{t(ui, "titleOpt")}</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
          placeholder={ui === "hi" ? "जैसे: गजोपसेचन" : "e.g. Gajopasechan"}
        />
      </section>

      <section className="mb-5">
        <label className="mb-1 block text-xs font-semibold text-muted">{t(ui, "storyIdea")}</label>
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={5}
          className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
          placeholder={
            ui === "hi"
              ? "कहानी लिखें… (श्री राम, हाथी, शाप…)"
              : "Write your story idea…"
          }
        />
      </section>

      <section className="mb-6">
        <p className="mb-2 text-xs font-semibold text-muted">
          {ui === "hi" ? "टेम्पलेट" : "Templates"}
        </p>
        <div className="flex flex-wrap gap-2">
          {BHARAT_TEMPLATES.slice(0, 6).map((tpl, i) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => applyTemplate(i)}
              className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] text-muted hover:border-accent/40"
            >
              {(ui === "hi" ? tpl.titleHi : tpl.titleEn).slice(0, 28)}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          {busy && mode === "oneclick" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {busy && mode === "oneclick" ? t(ui, "generating") : t(ui, "oneClick")}
        </button>
        <p className="px-1 text-[10px] text-muted">{t(ui, "oneClickHint")}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit(false)}
          className="flex w-full items-center justify-center rounded-xl border border-border py-3 text-sm font-medium disabled:opacity-50"
        >
          {busy && mode === "create" ? t(ui, "creating") : t(ui, "createProject")}
        </button>
      </div>
    </main>
  );
}
