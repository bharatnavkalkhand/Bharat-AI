import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Cpu, Image as ImageIcon, Video, Volume2, ShieldCheck, RefreshCw, Settings2, WalletCards } from "lucide-react";
import { DEFAULT_AI_PROVIDER_SETTINGS, loadAiProviderSettings, saveAiProviderSettings, type AiProviderSettings } from "@/lib/ai-provider-settings";

type ProviderStatus = {
  paidEnabled: boolean;
  text: { groq: boolean; mistral: boolean; omniroute: boolean };
  image: { grokImagine: boolean };
};

const COPY = {
  en: {
    title: "AI Provider Control", subtitle: "Choose the engine for each production stage.",
    free: "Free mode", paid: "Paid AI mode", freeDesc: "₹0-first providers and local/browser fallbacks. Shared quotas still apply.",
    paidDesc: "Use paid providers only after the developer enables them and configures server-side credentials. Charges may apply.",
    text: "Script & reasoning", image: "Image generation", video: "Video generation", voice: "Voice & narration",
    local: "Browser engine (free)", groq: "Groq API · free-tier (quota-limited)", mistral: "Mistral API · paid", omni: "OmniRoute gateway · provider billing varies",
    poll: "Pollinations · public free endpoint", grok: "Grok Imagine · paid per image",
    publicVideo: "Public community workers · free / quota-limited", comfy: "ComfyUI worker · self-hosted or hosted GPU",
    browserVoice: "Device/browser speech · free", save: "Save provider choices", saved: "Settings saved on this device.",
    status: "Server configuration", refresh: "Refresh status", paidGate: "Paid providers enabled by developer",
    yes: "Enabled", no: "Not enabled", configured: "Credential configured", missing: "Not configured",
    safety: "Safety controls", safetyBody: "The UI selection never exposes API keys. Paid requests are still blocked server-side unless ALLOW_PAID_PROVIDERS=true and the required secret is configured in Vercel. Selecting a paid provider does not itself start a request.",
    unavailable: "Not connected", future: "Paid video and paid voice adapters are not wired yet. They are intentionally shown as future extension points—not working integrations.",
    dev: "Developer setup", devBody: "Set ALLOW_PAID_PROVIDERS=true only when you are ready to permit charges. Add XAI_API_KEY for Grok Imagine, MISTRAL_API_KEY for Mistral, or OMNIROUTE_API_KEY + OMNIROUTE_BASE_URL + OMNIROUTE_MODEL for OmniRoute. Keep all secrets in Vercel environment variables.",
    modeNotice: "Mode is a browser-level preference on this device. The developer default is FREE in src/lib/ai-provider-settings.ts.",
    hi: "हिन्दी", en: "English",
  },
  hi: {
    title: "AI प्रोवाइडर कंट्रोल", subtitle: "हर प्रोडक्शन स्टेज के लिए AI इंजन चुनें।",
    free: "फ्री मोड", paid: "पेड AI मोड", freeDesc: "₹0-प्राथमिकता वाले और लोकल/ब्राउज़र विकल्प। साझा सेवाओं की सीमाएँ लागू होंगी।",
    paidDesc: "पेड AI तभी चलेगा जब डेवलपर उसे सर्वर पर सक्षम करे और credentials जोड़े। शुल्क लग सकता है।",
    text: "स्क्रिप्ट और रीजनिंग", image: "इमेज जनरेशन", video: "वीडियो जनरेशन", voice: "आवाज़ और नैरेशन",
    local: "ब्राउज़र इंजन (मुफ़्त)", groq: "Groq API · फ्री-टियर (सीमित)", mistral: "Mistral API · पेड", omni: "OmniRoute गेटवे · शुल्क मॉडल पर निर्भर",
    poll: "Pollinations · सार्वजनिक मुफ़्त सेवा", grok: "Grok Imagine · प्रति इमेज शुल्क",
    publicVideo: "पब्लिक कम्युनिटी वर्कर · मुफ़्त/सीमित", comfy: "ComfyUI वर्कर · अपना या होस्टेड GPU",
    browserVoice: "डिवाइस/ब्राउज़र स्पीच · मुफ़्त", save: "सेटिंग सेव करें", saved: "इस डिवाइस पर सेटिंग सेव हुई।",
    status: "सर्वर कॉन्फ़िगरेशन", refresh: "स्टेटस रीफ़्रेश", paidGate: "डेवलपर ने पेड प्रोवाइडर सक्षम किए",
    yes: "सक्षम", no: "सक्षम नहीं", configured: "क्रेडेंशियल उपलब्ध", missing: "कॉन्फ़िगर नहीं",
    safety: "सुरक्षा नियंत्रण", safetyBody: "UI में API keys नहीं रखी जातीं। पेड अनुरोध सर्वर पर ALLOW_PAID_PROVIDERS=true और सही secret के बिना ब्लॉक रहेंगे। पेड विकल्प चुनने मात्र से कोई अनुरोध नहीं भेजा जाता।",
    unavailable: "कनेक्ट नहीं", future: "पेड वीडियो और पेड वॉइस एडाप्टर अभी जुड़े नहीं हैं। इन्हें भविष्य के विकल्प के रूप में दिखाया गया है, चालू इंटीग्रेशन के रूप में नहीं।",
    dev: "डेवलपर सेटअप", devBody: "शुल्क की अनुमति देने से पहले ALLOW_PAID_PROVIDERS=true करें। Grok के लिए XAI_API_KEY, Mistral के लिए MISTRAL_API_KEY, या OmniRoute के लिए OMNIROUTE_API_KEY + OMNIROUTE_BASE_URL + OMNIROUTE_MODEL जोड़ें। सभी secrets Vercel environment variables में रखें।",
    modeNotice: "मोड इस डिवाइस के ब्राउज़र में सेव होता है। डेवलपर का डिफ़ॉल्ट मोड FREE है: src/lib/ai-provider-settings.ts.",
    hi: "हिन्दी", en: "English",
  },
};

export function AiProvidersPage() {
  const [lang, setLang] = useState<"hi" | "en">("hi");
  const [settings, setSettings] = useState<AiProviderSettings>(() => loadAiProviderSettings());
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const c = COPY[lang];

  async function refreshStatus() {
    setChecking(true);
    try {
      const response = await fetch("/api/agents/provider-status");
      if (!response.ok) throw new Error("status unavailable");
      setStatus(await response.json() as ProviderStatus);
    } catch {
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { void refreshStatus(); }, []);

  function update<K extends keyof AiProviderSettings>(key: K, value: AiProviderSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    saveAiProviderSettings(settings);
    setSaved(true);
  }

  const selectClass = "mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-accent";
  const cardClass = "rounded-2xl border border-border bg-card p-4 sm:p-5";

  return (
    <main className="page-shell mx-auto min-h-dvh max-w-3xl px-4 pb-24 pt-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link to="/" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"><ArrowLeft className="h-5 w-5" /></Link>
          <div><p className="text-xs font-semibold uppercase tracking-wider text-accent">Bharat-AI · Provider settings</p><h1 className="mt-1 text-2xl font-bold">{c.title}</h1><p className="mt-1 text-sm text-muted">{c.subtitle}</p></div>
        </div>
        <button type="button" onClick={() => setLang(lang === "hi" ? "en" : "hi")} className="min-h-10 rounded-xl border border-border px-3 text-xs font-semibold">{lang === "hi" ? c.en : c.hi}</button>
      </header>

      <section className={cardClass}>
        <div className="mb-3 flex items-center gap-2"><Settings2 className="h-5 w-5 text-accent" /><h2 className="font-semibold">{lang === "hi" ? "जनरेशन मोड" : "Generation mode"}</h2></div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { update("mode", "free"); update("textProvider", "browser"); update("imageProvider", "pollinations"); }} className={`rounded-xl border p-3 text-left ${settings.mode === "free" ? "border-accent bg-accent/10" : "border-border"}`}><span className="block font-semibold">{c.free}</span><span className="mt-1 block text-xs text-muted">{c.freeDesc}</span></button>
          <button type="button" onClick={() => update("mode", "paid")} className={`rounded-xl border p-3 text-left ${settings.mode === "paid" ? "border-accent bg-accent/10" : "border-border"}`}><span className="block font-semibold">{c.paid}</span><span className="mt-1 block text-xs text-muted">{c.paidDesc}</span></button>
        </div>
        <p className="mt-3 text-xs text-muted">{c.modeNotice}</p>
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <section className={cardClass}>
          <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-accent" /><h2 className="font-semibold">{c.text}</h2></div>
          <select className={selectClass} value={settings.textProvider} onChange={(e) => update("textProvider", e.target.value as AiProviderSettings["textProvider"])}>
            <option value="browser">{c.local}</option><option value="groq">{c.groq}</option><option value="mistral">{c.mistral}</option><option value="omniroute">{c.omni}</option>
          </select>
          <p className="mt-2 text-xs text-muted">{settings.textProvider === "browser" ? c.local : settings.textProvider === "groq" ? (status?.text.groq ? c.configured : c.missing) : settings.textProvider === "mistral" ? (status?.text.mistral && status.paidEnabled ? c.configured : c.missing) : (status?.text.omniroute && status.paidEnabled ? c.configured : c.missing)}</p>
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-accent" /><h2 className="font-semibold">{c.image}</h2></div>
          <select className={selectClass} value={settings.imageProvider} onChange={(e) => update("imageProvider", e.target.value as AiProviderSettings["imageProvider"])}>
            <option value="pollinations">{c.poll}</option><option value="grok-imagine">{c.grok}</option>
          </select>
          <p className="mt-2 text-xs text-muted">{settings.imageProvider === "pollinations" ? c.configured : status?.image.grokImagine && status.paidEnabled ? c.configured : c.missing}</p>
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-2"><Video className="h-4 w-4 text-accent" /><h2 className="font-semibold">{c.video}</h2></div>
          <select className={selectClass} value={settings.videoProvider} onChange={(e) => update("videoProvider", e.target.value as AiProviderSettings["videoProvider"])}>
            <option value="public-free">{c.publicVideo}</option><option value="comfyui">{c.comfy}</option>
          </select>
          <p className="mt-2 text-xs text-muted">{c.future}</p>
        </section>

        <section className={cardClass}>
          <div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-accent" /><h2 className="font-semibold">{c.voice}</h2></div>
          <select className={selectClass} value="browser" disabled><option value="browser">{c.browserVoice}</option></select>
          <p className="mt-2 text-xs text-muted">{c.future}</p>
        </section>
      </div>

      <section className={`${cardClass} mt-4`}>
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /><h2 className="font-semibold">{c.status}</h2></div><button type="button" onClick={() => void refreshStatus()} disabled={checking} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />{c.refresh}</button></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-background p-3">{c.paidGate}<strong className="mt-1 block">{status?.paidEnabled ? c.yes : c.no}</strong></div>
          <div className="rounded-lg bg-background p-3">Grok Imagine<strong className="mt-1 block">{status?.image.grokImagine && status.paidEnabled ? c.configured : c.missing}</strong></div>
          <div className="rounded-lg bg-background p-3">Mistral<strong className="mt-1 block">{status?.text.mistral && status.paidEnabled ? c.configured : c.missing}</strong></div>
          <div className="rounded-lg bg-background p-3">OmniRoute<strong className="mt-1 block">{status?.text.omniroute && status.paidEnabled ? c.configured : c.missing}</strong></div>
          <div className="rounded-lg bg-background p-3">Groq<strong className="mt-1 block">{status?.text.groq ? c.configured : c.missing}</strong></div>
        </div>
      </section>

      <section className={`${cardClass} mt-4`}>
        <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-accent" /><h2 className="font-semibold">{c.safety}</h2></div>
        <p className="mt-2 text-sm leading-6 text-muted">{c.safetyBody}</p>
        <h3 className="mt-4 text-sm font-semibold">{c.dev}</h3><p className="mt-1 text-sm leading-6 text-muted">{c.devBody}</p>
      </section>

      <div className="sticky bottom-3 mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
        <button type="button" onClick={save} className="min-h-11 flex-1 rounded-xl bg-accent px-4 text-sm font-bold text-black">{c.save}</button>
        {saved && <span role="status" className="text-xs text-muted">{c.saved}</span>}
      </div>
    </main>
  );
}
