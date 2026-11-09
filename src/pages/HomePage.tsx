/**
 * Bharat AI Studio — Cinematic Video Generator Homepage
 * Redesigned: dark-first cinematic, saffron-gold accent, bilingual Hindi/English
 * Tabs: Story Templates | Sample Videos | Graphics | Sound & Voice | My Projects
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMovieStore } from "@/store/movie-store";
import { BHARAT_TEMPLATES } from "@/lib/bharat-templates";

// ─── Types ───────────────────────────────────────────────────────────────────

type Lang = "hi" | "en";
type TabId = "templates" | "samples" | "graphics" | "sound" | "projects";

// ─── i18n strings ────────────────────────────────────────────────────────────

const TXT = {
  en: {
    eyebrow: "Free · AI · ZeroGPU · HF Spaces",
    heroTitle: ["Story to ", "Cinema"],
    heroHindi: "कहानी से फ़िल्म तक",
    heroDesc:
      "Write a script, add voices, generate AI video clips — all free. Powered by Wan 2.1 on Hugging Face ZeroGPU. Built for Indian stories.",
    ctaNew: "New Movie",
    ctaTemplate: "Browse Templates",
    stat1: "Operating Cost",
    stat2: "Story Templates",
    stat3: "Free AI Clips",
    stat4: "Hindi Voices",
    step1: ["Script", "Write your story in Hindi or English"],
    step2: ["Art", "AI generates scene visuals via HF ZeroGPU"],
    step3: ["Voice", "Hindi TTS voices for all characters"],
    step4: ["Export", "Download storyboard or MP4 clips"],
    tabs: ["Story Templates", "Sample Videos", "Graphics", "Sound & Voice", "My Projects"],
    tplHeading: "Story Templates",
    samplesHeading: "Sample AI Clips",
    gfxHeading: "Scene Graphics Styles",
    soundHeading: "Sound & Voice Profiles",
    projHeading: "My Projects",
    projEmpty: "No projects yet",
    projEmptySub: "Start with a template or write your own script",
    limitsTitle: "Honest Free Limits",
    limitsDesc:
      "~5 GPU-min/day on HF ZeroGPU free tier · 1–3 s silent clips · Up to 3 real clips per run · Queue wait 30 s – 4 min",
    useTemplate: "Use Template",
    preview: "Preview",
    newProject: "+ New Project",
  },
  hi: {
    eyebrow: "मुफ़्त · एआई · ZeroGPU · HF Spaces",
    heroTitle: ["कहानी से ", "सिनेमा"],
    heroHindi: "Story to Cinema",
    heroDesc:
      "स्क्रिप्ट लिखें, आवाज़ें जोड़ें, AI वीडियो क्लिप बनाएं — सब मुफ़्त। HF ZeroGPU पर Wan 2.1 द्वारा। भारतीय कहानियों के लिए।",
    ctaNew: "नई फ़िल्म",
    ctaTemplate: "टेम्पलेट देखें",
    stat1: "लागत",
    stat2: "कहानी टेम्पलेट",
    stat3: "मुफ़्त AI क्लिप",
    stat4: "हिंदी आवाज़ें",
    step1: ["स्क्रिप्ट", "हिंदी या अंग्रेज़ी में लिखें"],
    step2: ["कला", "AI दृश्य बनाता है ZeroGPU पर"],
    step3: ["आवाज़", "सभी किरदारों के लिए TTS"],
    step4: ["निर्यात", "स्टोरीबोर्ड या MP4 डाउनलोड करें"],
    tabs: ["कहानी टेम्पलेट", "सैंपल वीडियो", "ग्राफ़िक्स", "ध्वनि और आवाज़", "मेरे प्रोजेक्ट"],
    tplHeading: "कहानी टेम्पलेट",
    samplesHeading: "सैंपल AI क्लिप",
    gfxHeading: "दृश्य ग्राफ़िक्स शैलियाँ",
    soundHeading: "ध्वनि और आवाज़ प्रोफाइल",
    projHeading: "मेरे प्रोजेक्ट",
    projEmpty: "अभी तक कोई प्रोजेक्ट नहीं",
    projEmptySub: "टेम्पलेट से शुरू करें या अपनी स्क्रिप्ट लिखें",
    limitsTitle: "मुफ़्त सेवा की सीमाएं",
    limitsDesc:
      "HF ZeroGPU मुफ़्त टियर पर ~5 GPU-मिनट/दिन · 1–3 सेकंड साइलेंट क्लिप · प्रति रन 3 क्लिप · कतार 30 से – 4 मिनट",
    useTemplate: "टेम्पलेट उपयोग करें",
    preview: "प्रीव्यू",
    newProject: "+ नया प्रोजेक्ट",
  },
};

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function drawHeroCanvas(canvas: HTMLCanvasElement, tick: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#07070b");
  sky.addColorStop(0.5, "#0d0a1a");
  sky.addColorStop(1, "#1a0e06");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Orbiting gold glow
  const gx = w * 0.5 + Math.sin(tick * 0.012) * w * 0.18;
  const gy = h * 0.38 + Math.cos(tick * 0.008) * h * 0.12;
  const grd = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.55);
  grd.addColorStop(0, "rgba(232,160,34,0.18)");
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  // Stars
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 137 + 23) % w);
    const sy = ((i * 97 + 11) % (h * 0.65));
    const alpha = 0.3 + 0.4 * Math.sin(tick * 0.04 + i);
    ctx.fillStyle = `rgba(255,255,220,${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground silhouette
  ctx.fillStyle = "rgba(10,6,0,0.9)";
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.bezierCurveTo(w * 0.2, h * 0.68, w * 0.4, h * 0.75, w * 0.5, h * 0.70);
  ctx.bezierCurveTo(w * 0.6, h * 0.65, w * 0.8, h * 0.72, w, h * 0.68);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Two silhouette figures
  const figY = h * 0.69;
  [[w * 0.35, figY], [w * 0.55, figY - h * 0.01]].forEach(([fx, fy], i) => {
    const fh = h * 0.16 + i * 4;
    ctx.fillStyle = "rgba(0,0,0,0.95)";
    // body
    ctx.beginPath();
    ctx.ellipse(fx, fy - fh * 0.2, fh * 0.09, fh * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(fx, fy - fh * 0.55, fh * 0.11, 0, Math.PI * 2);
    ctx.fill();
  });

  // Floating particles
  for (let p = 0; p < 18; p++) {
    const px = ((p * 53 + tick * 0.3) % w);
    const py = h * 0.1 + ((p * 71 + tick * 0.18) % (h * 0.6));
    const pr = 1.2 + (p % 3) * 0.6;
    const pa = 0.15 + 0.25 * Math.sin(tick * 0.07 + p * 1.3);
    ctx.fillStyle = `rgba(232,160,34,${pa})`;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTemplateCanvas(
  canvas: HTMLCanvasElement,
  idx: number,
  title: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  const palettes = [
    ["#c2185b", "#880e4f", "#1a0010"],
    ["#f97316", "#b45309", "#1a0a00"],
    ["#7b1fa2", "#4a148c", "#0d001a"],
    ["#1565c0", "#0d47a1", "#00061a"],
    ["#2e7d32", "#1b5e20", "#00100a"],
    ["#c2185b", "#ad1457", "#1a0010"],
  ];
  const [c1, c2, bg] = palettes[idx % palettes.length];

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, c2 + "88");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const grd2 = ctx.createRadialGradient(w * 0.3, h * 0.4, 0, w * 0.3, h * 0.4, w * 0.6);
  grd2.addColorStop(0, c1 + "33");
  grd2.addColorStop(1, "transparent");
  ctx.fillStyle = grd2;
  ctx.fillRect(0, 0, w, h);

  // horizon line
  ctx.strokeStyle = c1 + "55";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.65);
  ctx.lineTo(w, h * 0.65);
  ctx.stroke();

  // title text overlay
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `bold ${Math.max(10, w * 0.065)}px Inter,sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(title.slice(0, 20), 8, h * 0.88);
}

function drawGraphicsCanvas(
  canvas: HTMLCanvasElement,
  styleIdx: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  const styles = [
    { name: "Cinematic", bg: ["#07070b", "#1a0e06"], accent: "#e8a022" },
    { name: "Golden Era", bg: ["#1a1000", "#2d1a00"], accent: "#f5c842" },
    { name: "Mythology", bg: ["#0d001a", "#1a0030"], accent: "#c084fc" },
    { name: "Modern Urban", bg: ["#000814", "#0a1628"], accent: "#38bdf8" },
    { name: "Desert Dusk", bg: ["#1a0800", "#2d1500"], accent: "#fb923c" },
    { name: "Monsoon", bg: ["#001a0d", "#00261a"], accent: "#34d399" },
  ];
  const style = styles[styleIdx % styles.length];

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, style.bg[0]);
  grad.addColorStop(1, style.bg[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = style.accent + "18";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < w; gx += w / 4) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
  }
  for (let gy = 0; gy < h; gy += h / 3) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  }

  // Central glow
  const cg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.5);
  cg.addColorStop(0, style.accent + "44");
  cg.addColorStop(1, "transparent");
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, w, h);
}

function drawVideoThumb(canvas: HTMLCanvasElement, vidIdx: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  const themes = [
    { sky: ["#07070b", "#1a0a00"], accent: "#e8a022", label: "Scene 01" },
    { sky: ["#000a1a", "#00061a"], accent: "#38bdf8", label: "Scene 02" },
    { sky: ["#0d0005", "#1a0010"], accent: "#f472b6", label: "Scene 03" },
    { sky: ["#070010", "#0d001a"], accent: "#a78bfa", label: "Scene 04" },
  ];
  const t = themes[vidIdx % themes.length];

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, t.sky[0]);
  g.addColorStop(1, t.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const rg = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.6);
  rg.addColorStop(0, t.accent + "30");
  rg.addColorStop(1, "transparent");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  ctx.fillStyle = t.accent;
  ctx.font = `bold ${Math.max(8, w * 0.07)}px Inter,sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(t.label, 8, h * 0.88);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const tick = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = rect?.width || 300;
      canvas.height = rect?.height || 400;
    };
    resize();
    const obs = new ResizeObserver(resize);
    if (canvas.parentElement) obs.observe(canvas.parentElement);

    const loop = () => {
      tick.current += 1;
      drawHeroCanvas(canvas, tick.current);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);

    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      obs.disconnect();
    };
  }, []);

  return <canvas ref={ref} style={{ position: "absolute", inset: "24px 0", width: "100%", height: "calc(100% - 48px)" }} />;
}

function TemplateCanvas({ idx, title }: { idx: number; title: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = c.offsetWidth * 2;
    c.height = c.offsetHeight * 2;
    drawTemplateCanvas(c, idx, title);
  }, [idx, title]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function GraphicsCanvas({ idx }: { idx: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = c.offsetWidth * 2;
    c.height = c.offsetHeight * 2;
    drawGraphicsCanvas(c, idx);
  }, [idx]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function VideoThumbCanvas({ idx }: { idx: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = c.offsetWidth * 2;
    c.height = c.offsetHeight * 2;
    drawVideoThumb(c, idx);
  }, [idx]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

// ─── Sprockets ────────────────────────────────────────────────────────────────

function Sprockets() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 6px" }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          width: 11, height: 8, borderRadius: 2, flexShrink: 0,
          background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.1)"
        }} />
      ))}
    </div>
  );
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

function Waveform({ active }: { active: boolean }) {
  const heights = [30, 55, 80, 65, 90, 45, 70, 50, 85, 60, 40, 75, 55, 95, 65, 48];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 32 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: 2, background: "#e8a022",
          height: `${active ? Math.max(15, (h * (0.6 + 0.4 * Math.sin(Date.now() * 0.003 + i))) | 0) : h * 0.35}%`,
          transition: "height 0.2s ease",
          animation: active ? `wave-bar ${0.8 + (i % 4) * 0.15}s ease-in-out infinite alternate` : "none",
          animationDelay: `${i * 0.06}s`,
          opacity: 0.85,
        }} />
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate();
  const movies = useMovieStore((s) => s.movies);
  const [lang, setLang] = useState<Lang>("hi");
  const [tab, setTab] = useState<TabId>("templates");
  const [activeSound, setActiveSound] = useState<number | null>(null);
  const tx = TXT[lang];

  const goCreate = useCallback(() => navigate("/produce"), [navigate]);

  const STEPS = [
    { num: "01", icon: "✍️", key: "step1" as const },
    { num: "02", icon: "🎨", key: "step2" as const },
    { num: "03", icon: "🎙️", key: "step3" as const },
    { num: "04", icon: "🎬", key: "step4" as const },
  ];

  const TABS: { id: TabId; icon: string; label: keyof typeof tx & string }[] = [
    { id: "templates", icon: "☰", label: "tabs" },
    { id: "samples", icon: "▶", label: "tabs" },
    { id: "graphics", icon: "🖼", label: "tabs" },
    { id: "sound", icon: "🎵", label: "tabs" },
    { id: "projects", icon: "📁", label: "tabs" },
  ];
  const TAB_LABELS = tx.tabs;

  const GFX_STYLES = [
    { name: "Cinematic Realism", sub: "Dark, moody, gold tones" },
    { name: "Golden Era", sub: "Warm, retro 70s palette" },
    { name: "Mythology", sub: "Divine purples & sacred light" },
    { name: "Modern Urban", sub: "Cool blues, city nights" },
    { name: "Desert Dusk", sub: "Rust, sand, sunset orange" },
    { name: "Monsoon Green", sub: "Lush greens, rain mist" },
  ];

  const VOICES = [
    { name: "Deep Baritone", meta: "Male · Hindi · Dramatic", bg: "#1a0a00", accent: "#e8a022", emoji: "🎙️" },
    { name: "Warm Narrator", meta: "Male · Hindi · Narration", bg: "#000a1a", accent: "#38bdf8", emoji: "🎤" },
    { name: "Soft Feminine", meta: "Female · Hindi · Romance", bg: "#0d0005", accent: "#f472b6", emoji: "🎵" },
    { name: "Classical Dhrupad", meta: "Male · Hindi · Classical", bg: "#07000d", accent: "#a78bfa", emoji: "🪘" },
    { name: "Child Voice", meta: "Child · Hindi · Innocence", bg: "#001a0d", accent: "#34d399", emoji: "👦" },
    { name: "Elder Wisdom", meta: "Elder · Hindi · Gravitas", bg: "#1a0d00", accent: "#fb923c", emoji: "🧓" },
  ];

  const SAMPLE_VIDEOS = [
    { title: "Monsoon Promise", genre: "Romance", dur: "0:32", desc: "Rain-soaked rooftop, two silhouettes" },
    { title: "Street Honour", genre: "Action", dur: "0:28", desc: "Narrow lane chase at dusk" },
    { title: "Rama in Forest", genre: "Mythology", dur: "0:45", desc: "Divine light through ancient trees" },
    { title: "Last Train", genre: "Drama", dur: "0:38", desc: "Platform farewell, fading steam" },
  ];

  const GENRE_COLORS: Record<string, string> = {
    Romance: "rgba(194,24,91,0.75)",
    Action: "rgba(249,115,22,0.75)",
    Mythology: "rgba(107,33,168,0.75)",
    Drama: "rgba(27,94,32,0.75)",
    Historical: "rgba(21,101,192,0.75)",
  };

  return (
    <>
      {/* Global CSS injected once */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;900&family=Noto+Sans+Devanagari:wght@400;600;700&display=swap');
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
        @keyframes wave-bar { from{transform:scaleY(.35)} to{transform:scaleY(1)} }
        .bharat-tab-btn { transition: background .15s, color .15s; }
        .bharat-tab-btn:hover:not(.bharat-tab-active) { background: #14141f; color: #f0ede8; }
        .bharat-card { transition: border-color .15s, transform .15s, box-shadow .15s; }
        .bharat-card:hover { border-color: rgba(232,160,34,.35) !important; transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,0,0,.35); }
        .bharat-btn-primary { transition: filter .15s, transform .12s; }
        .bharat-btn-primary:hover { filter: brightness(1.08); }
        .bharat-btn-primary:active { transform: scale(.97); }
        .bharat-btn-secondary { transition: border-color .15s, background .15s; }
        .bharat-btn-secondary:hover { border-color: rgba(232,160,34,.35); background: #14141f; }
      `}</style>

      <div style={{ background: "#07070b", minHeight: "100dvh", color: "#f0ede8", fontFamily: "Inter,system-ui,sans-serif", fontSize: 15, overflowX: "hidden" }}>

        {/* Ambient top glow */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 320, zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 300px at 50% -60px, rgba(232,160,34,.09), transparent 70%)" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 920, margin: "0 auto", padding: "0 16px 80px" }}>

          {/* ── NAV ── */}
          <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "20px 0 0", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#e8a022,#f97316)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(232,160,34,.22)", flexShrink: 0 }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="white"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V4h-4z"/></svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: "1.3rem", fontWeight: 700, letterSpacing: ".04em", lineHeight: 1.1 }}>BHARAT AI</div>
                <div style={{ fontSize: 11, color: "#e8a022", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>Free · Studio · ZeroGPU</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Lang toggle */}
              <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, background: "#0e0e16", border: "1px solid rgba(255,255,255,.07)" }}>
                {(["hi", "en"] as Lang[]).map((l) => (
                  <button key={l} onClick={() => setLang(l)} style={{ padding: "4px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: lang === l ? "#e8a022" : "transparent", color: lang === l ? "#0a0600" : "#a09898", transition: "all .15s" }}>
                    {l === "hi" ? "हिं" : "EN"}
                  </button>
                ))}
              </div>
              <span style={{ background: "rgba(232,160,34,.12)", color: "#e8a022", border: "1px solid rgba(232,160,34,.18)", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999 }}>₹0</span>
              <button className="bharat-btn-primary" onClick={goCreate} style={{ background: "#e8a022", color: "#0a0600", fontWeight: 700, fontSize: 13, padding: "8px 18px", borderRadius: 999, border: "none", cursor: "pointer" }}>
                + {lang === "hi" ? "बनाएं" : "Create"}
              </button>
            </div>
          </nav>

          {/* ── HERO ── */}
          <div style={{ margin: "40px 0 36px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(232,160,34,.12)", border: "1px solid rgba(232,160,34,.18)", color: "#e8a022", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", padding: "5px 12px", borderRadius: 999, marginBottom: 18 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e8a022", animation: "pulse-dot 2s ease-in-out infinite", display: "inline-block" }} />
                {tx.eyebrow}
              </div>
              <h1 style={{ fontFamily: "'Cinzel',serif", fontSize: "clamp(2.1rem,5vw,3rem)", fontWeight: 900, lineHeight: 1.08, letterSpacing: ".01em", color: "#f0ede8" }}>
                {tx.heroTitle[0]}<span style={{ color: "#e8a022" }}>{tx.heroTitle[1]}</span>
                <span style={{ fontFamily: "'Noto Sans Devanagari','Inter',sans-serif", fontWeight: 700, display: "block", fontSize: ".72em", color: "#a09898", marginTop: 4 }}>{tx.heroHindi}</span>
              </h1>
              <p style={{ marginTop: 14, fontSize: 15, color: "#a09898", lineHeight: 1.65, maxWidth: "42ch" }}>{tx.heroDesc}</p>
              <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="bharat-btn-primary" onClick={goCreate} style={{ background: "linear-gradient(135deg,#e8a022,#f97316)", color: "white", fontWeight: 700, fontSize: 14, padding: "13px 24px", borderRadius: 12, border: "none", cursor: "pointer", boxShadow: "0 8px 28px rgba(232,160,34,.28)" }}>
                  ＋ {tx.ctaNew}
                </button>
                <button className="bharat-btn-secondary" onClick={() => setTab("templates")} style={{ background: "#0e0e16", color: "#f0ede8", fontWeight: 600, fontSize: 14, padding: "13px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,.07)", cursor: "pointer" }}>
                  ⊞ {tx.ctaTemplate}
                </button>
              </div>
              <div style={{ display: "flex", gap: 24, marginTop: 28, flexWrap: "wrap" }}>
                {[["₹0", tx.stat1], ["6", tx.stat2], ["3s", tx.stat3], ["8+", tx.stat4]].map(([n, l]) => (
                  <div key={l} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontFamily: "'Cinzel',serif", fontSize: "1.5rem", fontWeight: 700, color: "#e8a022" }}>{n}</div>
                    <div style={{ fontSize: 11, color: "#5a5660", fontWeight: 500, textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Film strip */}
            <div style={{ position: "relative" }}>
              <div style={{ borderRadius: 20, overflow: "hidden", position: "relative", aspectRatio: "9/14", maxHeight: 460, background: "#0e0e16", border: "1px solid rgba(255,255,255,.07)", boxShadow: "0 24px 60px rgba(0,0,0,.5)" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 24, zIndex: 3, display: "flex", alignItems: "center", background: "rgba(0,0,0,.6)" }}><Sprockets /></div>
                <HeroCanvas />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 24, zIndex: 3, display: "flex", alignItems: "center", background: "rgba(0,0,0,.6)" }}><Sprockets /></div>
                <div style={{ position: "absolute", top: 30, left: 10, zIndex: 4, background: "rgba(0,0,0,.65)", color: "#e8a022", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: ".08em" }}>SCENE 01 · TAKE 1</div>
                <div style={{ position: "absolute", bottom: 32, right: 10, zIndex: 4, background: "#e8a022", color: "#0a0600", fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 999 }}>AI GENERATED</div>
                <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={goCreate}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(232,160,34,.18)", border: "2px solid #e8a022", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="#e8a022"><polygon points="5,3 19,12 5,21" /></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── STEPS ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 36 }}>
            {STEPS.map((s) => {
              const [name, sub] = tx[s.key];
              return (
                <div key={s.num} style={{ background: "#0e0e16", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "16px 14px" }}>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: ".75rem", fontWeight: 700, color: "#e8a022", letterSpacing: ".08em", marginBottom: 8 }}>{s.num}</div>
                  <span style={{ fontSize: "1.4rem", display: "block", marginBottom: 8 }}>{s.icon}</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{name}</div>
                  <div style={{ fontSize: 11, color: "#5a5660", marginTop: 4, lineHeight: 1.5 }}>{sub}</div>
                </div>
              );
            })}
          </div>

          {/* ── TABS ROW ── */}
          <div style={{ display: "flex", gap: 4, padding: 4, background: "#0e0e16", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, marginBottom: 28, overflowX: "auto", scrollbarWidth: "none" }}>
            {TABS.map((t, i) => (
              <button key={t.id} className={`bharat-tab-btn${tab === t.id ? " bharat-tab-active" : ""}`} onClick={() => setTab(t.id)} style={{ flex: "1 1 auto", minWidth: "max-content", padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", color: tab === t.id ? "#0a0600" : "#a09898", background: tab === t.id ? "#e8a022" : "transparent", whiteSpace: "nowrap" }}>
                {t.icon} {TAB_LABELS[i]}
              </button>
            ))}
          </div>

          {/* ── TAB: TEMPLATES ── */}
          {tab === "templates" && (
            <div>
              <SectionLabel title={tx.tplHeading} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
                {BHARAT_TEMPLATES.map((tpl, i) => (
                  <div key={tpl.id} className="bharat-card" style={{ background: "rgba(14,14,22,.92)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, overflow: "hidden", cursor: "pointer" }} onClick={goCreate}>
                    <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
                      <TemplateCanvas idx={i} title={lang === "hi" ? tpl.titleHi : tpl.titleEn} />
                      <div style={{ position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, background: GENRE_COLORS[tpl.genres[0]] ?? "rgba(100,100,100,.75)", color: "white", backdropFilter: "blur(6px)" }}>
                        {tpl.genres[0]}
                      </div>
                    </div>
                    <div style={{ padding: "14px 16px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#f0ede8" }}>{lang === "hi" ? tpl.titleHi : tpl.titleEn}</div>
                      <div style={{ fontFamily: "'Noto Sans Devanagari',sans-serif", fontSize: 12, color: "#a09898", marginTop: 2 }}>{lang === "hi" ? tpl.titleEn : tpl.titleHi}</div>
                      <div style={{ fontSize: 12, color: "#a09898", marginTop: 8, lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {lang === "hi" ? tpl.descHi : tpl.descEn}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                        <button onClick={(e) => { e.stopPropagation(); goCreate(); }} style={{ fontSize: 12, fontWeight: 700, color: "#e8a022", background: "rgba(232,160,34,.12)", border: "none", padding: "5px 12px", borderRadius: 999, cursor: "pointer" }}>
                          {tx.useTemplate}
                        </button>
                        <span style={{ fontSize: 11, color: "#5a5660" }}>~2 min</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: SAMPLE VIDEOS ── */}
          {tab === "samples" && (
            <div>
              <SectionLabel title={tx.samplesHeading} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14 }}>
                {SAMPLE_VIDEOS.map((v, i) => (
                  <div key={v.title} className="bharat-card" style={{ background: "#0e0e16", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20, overflow: "hidden", cursor: "pointer" }}>
                    <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden", background: "#14141f" }}>
                      <VideoThumbCanvas idx={i} />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.3)" }}>
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(232,160,34,.2)", border: "2px solid #e8a022", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="#e8a022"><polygon points="5,3 19,12 5,21" /></svg>
                        </div>
                      </div>
                      <div style={{ position: "absolute", bottom: 6, right: 8, background: "rgba(0,0,0,.65)", color: "#f0ede8", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 5 }}>{v.dur}</div>
                      <div style={{ position: "absolute", top: 6, left: 8, fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: "rgba(0,0,0,.5)", color: "#e8a022", border: "1px solid rgba(232,160,34,.3)" }}>{v.genre}</div>
                    </div>
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{v.title}</div>
                      <div style={{ fontSize: 11, color: "#5a5660", marginTop: 4 }}>{v.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: GRAPHICS ── */}
          {tab === "graphics" && (
            <div>
              <SectionLabel title={tx.gfxHeading} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
                {GFX_STYLES.map((g, i) => (
                  <div key={g.name} className="bharat-card" style={{ background: "#0e0e16", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, overflow: "hidden", cursor: "pointer" }}>
                    <div style={{ aspectRatio: "4/3", overflow: "hidden" }}>
                      <GraphicsCanvas idx={i} />
                    </div>
                    <div style={{ padding: "10px 12px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#f0ede8" }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: "#5a5660", marginTop: 2 }}>{g.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: SOUND & VOICE ── */}
          {tab === "sound" && (
            <div>
              <SectionLabel title={tx.soundHeading} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
                {VOICES.map((v, i) => (
                  <div key={v.name} className="bharat-card" style={{ background: "#0e0e16", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }} onMouseEnter={() => setActiveSound(i)} onMouseLeave={() => setActiveSound(null)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, background: v.bg }}>
                        {v.emoji}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</div>
                        <div style={{ fontSize: 11, color: "#5a5660", marginTop: 2 }}>{v.meta}</div>
                      </div>
                    </div>
                    <Waveform active={activeSound === i} />
                    <button onClick={goCreate} style={{ fontSize: 12, fontWeight: 700, color: v.accent, background: v.accent + "1a", border: "none", padding: "7px 14px", borderRadius: 999, cursor: "pointer", alignSelf: "flex-start" }}>
                      ▶ {tx.preview}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: MY PROJECTS ── */}
          {tab === "projects" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <SectionLabel title={tx.projHeading} />
                <button onClick={goCreate} style={{ fontSize: 12, fontWeight: 700, color: "#e8a022", background: "rgba(232,160,34,.12)", border: "1px solid rgba(232,160,34,.18)", padding: "6px 14px", borderRadius: 999, cursor: "pointer" }}>
                  {tx.newProject}
                </button>
              </div>
              {movies.length === 0 ? (
                <div style={{ border: "1px dashed rgba(255,255,255,.12)", borderRadius: 20, padding: "48px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 14 }}>🎬</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#f0ede8" }}>{tx.projEmpty}</h3>
                  <p style={{ fontSize: 13, color: "#a09898", marginTop: 6, maxWidth: "36ch", marginInline: "auto" }}>{tx.projEmptySub}</p>
                  <button onClick={goCreate} style={{ marginTop: 20, background: "linear-gradient(135deg,#e8a022,#f97316)", color: "white", fontWeight: 700, fontSize: 14, padding: "12px 24px", borderRadius: 12, border: "none", cursor: "pointer" }}>
                    + {tx.ctaNew}
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
                  {movies.map((m) => (
                    <div key={m.id} className="bharat-card" style={{ background: "#0e0e16", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#f0ede8" }}>{m.title}</div>
                      <div style={{ fontSize: 11, color: "#5a5660", marginTop: 4 }}>{m.scenes?.length ?? 0} scenes</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── HONEST LIMITS BANNER ── */}
          <div style={{ background: "#0e0e16", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14, marginTop: 32 }}>
            <span style={{ fontSize: "1.2rem", flexShrink: 0, marginTop: 1 }}>ℹ️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f0ede8" }}>{tx.limitsTitle}</div>
              <div style={{ fontSize: 12, color: "#a09898", marginTop: 4, lineHeight: 1.6 }}>{tx.limitsDesc}</div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <footer style={{ borderTop: "1px solid rgba(255,255,255,.07)", padding: "24px 0 0", marginTop: 48, textAlign: "center", fontSize: 11, color: "#5a5660", letterSpacing: ".04em" }}>
            <span style={{ color: "#e8a022" }}>BHARAT AI</span> · Free · Open Source · ZeroGPU · HF Spaces
          </footer>

        </div>
      </div>
    </>
  );
}

// ─── Helper component ─────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: "1.1rem", fontWeight: 700, letterSpacing: ".03em", color: "#f0ede8", whiteSpace: "nowrap" }}>{title}</h2>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.07)" }} />
    </div>
  );
}
