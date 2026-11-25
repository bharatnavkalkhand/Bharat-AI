import { useState } from "react";
import { ArrowLeft, ExternalLink, Languages, Clapperboard, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "bharat_ai_dramaclaw_url";

function cleanBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.origin;
  } catch {
    return "";
  }
}

export function DramaClawPage() {
  const [lang, setLang] = useState<"hi" | "en">(() =>
    typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("hi") ? "hi" : "en",
  );
  const [baseUrl, setBaseUrl] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || "http://localhost:8080"; }
    catch { return "http://localhost:8080"; }
  });
  const [saved, setSaved] = useState(false);
  const hi = lang === "hi";
  const validUrl = cleanBaseUrl(baseUrl);

  function saveUrl() {
    if (!validUrl) return;
    try { localStorage.setItem(STORAGE_KEY, validUrl); } catch { /* private browsing */ }
    setBaseUrl(validUrl);
    setSaved(true);
  }

  return (
    <main className="page-shell mx-auto min-h-dvh max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-8 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/" aria-label={hi ? "वापस" : "Back"} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Bharat-AI · Production engine</p>
            <h1 className="mt-1 text-2xl font-bold">{hi ? "DramaClaw कनेक्शन" : "DramaClaw connection"}</h1>
            <p className="mt-1 text-sm text-muted">{hi ? "स्क्रिप्ट से सीन और फिल्म तक प्रोडक्शन वर्कफ़्लो" : "A production workspace for script-to-scene and film workflows"}</p>
          </div>
        </div>
        <button type="button" onClick={() => setLang(hi ? "en" : "hi")} className="flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm">
          <Languages className="h-4 w-4" /> {hi ? "English" : "हिन्दी"}
        </button>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent"><Clapperboard className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold">{hi ? "अपना DramaClaw सर्वर जोड़ें" : "Connect your DramaClaw server"}</h2>
            <p className="text-xs text-muted">{hi ? "आपके अपने कंप्यूटर या सर्वर पर चलने वाला इंस्टेंस" : "An instance running on your own computer or server"}</p>
          </div>
        </div>
        <label htmlFor="dramaclaw-url" className="mb-2 block text-sm font-medium">{hi ? "DramaClaw वेब पता" : "DramaClaw web address"}</label>
        <input id="dramaclaw-url" type="url" inputMode="url" autoCapitalize="none" spellCheck={false} value={baseUrl} onChange={(e) => { setBaseUrl(e.target.value); setSaved(false); }} placeholder="http://localhost:8080" className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-accent" />
        <p className="mt-2 text-xs text-muted">{hi ? "डिफ़ॉल्ट पता तभी काम करेगा जब DramaClaw इसी डिवाइस पर Docker से चल रहा हो। दूसरे डिवाइस के लिए उसका LAN/VPS URL डालें।" : "The default works only when DramaClaw is running on this device. For another machine, enter its reachable LAN/VPS URL."}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveUrl} disabled={!validUrl} className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-black disabled:opacity-40">{hi ? "पता सेव करें" : "Save address"}</button>
          {saved && <span role="status" className="text-xs text-muted">{hi ? "इस ब्राउज़र में सेव हुआ" : "Saved in this browser"}</span>}
          <a href={validUrl || undefined} target="_blank" rel="noreferrer" aria-disabled={!validUrl} onClick={(e) => { if (!validUrl) e.preventDefault(); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium aria-disabled:opacity-40">
            {hi ? "DramaClaw खोलें" : "Open DramaClaw"} <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /><h2 className="font-semibold">{hi ? "यह कनेक्शन अभी क्या करता है?" : "What this connection does today"}</h2></div>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
          <li>• {hi ? "Bharat-AI में हिन्दी/English कहानी और प्रोजेक्ट तैयार करें।" : "Create Hindi/English stories and projects in Bharat-AI."}</li>
          <li>• {hi ? "अपने self-hosted DramaClaw workspace को अलग टैब में खोलें।" : "Open your self-hosted DramaClaw workspace in a separate tab."}</li>
          <li>• {hi ? "यह सुरक्षित launch-link है; अभी दोनों ऐप्स के बीच automatic project/media sync या API job hand-off लागू नहीं है।" : "This is a safe launch-link; automatic project/media sync and API job hand-off are not implemented yet."}</li>
        </ul>
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card/60 p-5">
        <h2 className="font-semibold">{hi ? "सेटअप और ज़रूरी सीमाएँ" : "Setup and important limits"}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>{hi ? "कंप्यूटर/VPS पर Docker और Docker Compose इंस्टॉल करें।" : "Install Docker and Docker Compose on a computer/VPS."}</li>
          <li>{hi ? "DramaClaw का आधिकारिक Docker quickstart चलाएँ; वेब UI port 8080 और API port 8780 पर उपलब्ध होते हैं।" : "Follow DramaClaw's official Docker quickstart; its web UI uses port 8080 and API port 8780."}</li>
          <li>{hi ? "मॉडल gateway अलग से कॉन्फ़िगर करना होगा। Docker चलने का अर्थ यह नहीं कि AI inference मुफ़्त या unlimited है।" : "Configure a model gateway separately. Running Docker does not make model inference free or unlimited."}</li>
          <li>{hi ? "DramaClaw का Elastic License 2.0 hosted/managed SaaS के रूप में इसे तीसरे पक्ष को देने पर रोक लगाता है। इसीलिए Bharat-AI अभी केवल आपके अपने self-hosted instance का लिंक खोलता है।" : "DramaClaw's Elastic License 2.0 restricts offering it to third parties as a hosted/managed SaaS. Bharat-AI therefore links only to your own self-hosted instance."}</li>
        </ol>
        <a className="mt-4 inline-flex text-sm font-semibold text-accent underline-offset-4 hover:underline" href="https://github.com/dramaclaw/dramaclaw#quick-start" target="_blank" rel="noreferrer">{hi ? "आधिकारिक DramaClaw Quickstart पढ़ें" : "Read the official DramaClaw Quickstart"} <ExternalLink className="ml-1 h-3.5 w-3.5" /></a>
      </section>

      <p className="mt-5 text-center text-xs text-muted">Powered by DramaClaw · Self-hosted connection</p>
    </main>
  );
}
