import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Server-side script provider router.
 * Browser/local is the default. Paid providers require an explicit UI choice,
 * ALLOW_PAID_PROVIDERS=true, and a server-side secret.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body as {
    title?: string;
    synopsis?: string;
    language?: string;
    targetDuration?: string;
    genres?: string[];
    provider?: "browser" | "groq" | "mistral" | "omniroute";
    aiMode?: "free" | "paid";
  };

  const provider = body.provider || "browser";
  const paidEnabled = process.env.ALLOW_PAID_PROVIDERS === "true";
  const groqKey = process.env.GROQ_API_KEY;
  const mistralKey = process.env.MISTRAL_API_KEY;
  const omniKey = process.env.OMNIROUTE_API_KEY;
  const omniBase = (process.env.OMNIROUTE_BASE_URL || "").trim().replace(/\/+$/, "");
  const omniModel = process.env.OMNIROUTE_MODEL || "auto";

  if (provider === "browser") {
    return res.status(200).json({ useLocal: true, message: "Browser script engine selected." });
  }
  if (provider === "mistral" || provider === "omniroute") {
    if (body.aiMode !== "paid" || !paidEnabled) {
      return res.status(200).json({ useLocal: true, providerBlocked: true, message: "Paid providers are disabled by the developer. Set ALLOW_PAID_PROVIDERS=true only after approving billing." });
    }
  }

  const lang = body.language === "hi" ? "Hindi" : "English";
  const prompt = `You are a film script assistant for realistic avatar movies.
CRITICAL RULES:
1. Follow the user's story exactly. Do not invent unrelated characters or plots.
2. Characters must come from the user's story.
3. Split the idea into ordered scenes that retell the plot.
4. Dialogue, narration, gestures and visual prompts must match each scene.
5. Write all story text in ${lang}; keep proper names unchanged.

Title: ${body.title || "Untitled"}
Idea (source of truth): ${body.synopsis || ""}
Genres: ${(body.genres || []).join(", ")}
Target duration: ${body.targetDuration || "5min"}

Return ONLY valid JSON with keys:
logline (string), characters (array of {name, role, appearance}),
scenes (array of {title, mood, dialogue, gestureNotes, visualPrompt, estimatedDurationSec, narration}).
mood must be one of: fight, romance, gesture, dialogue, action, emotional, dramatic.`;

  const messages = [
    { role: "system", content: "Output valid JSON only. Follow the user's story exactly." },
    { role: "user", content: prompt },
  ];

  let url = "";
  let key = "";
  let model = "";
  if (provider === "groq") {
    if (!groqKey) return res.status(200).json({ useLocal: true, providerBlocked: true, message: "Groq is not configured. Add GROQ_API_KEY or select Browser engine." });
    url = "https://api.groq.com/openai/v1/chat/completions";
    key = groqKey;
    model = "llama-3.3-70b-versatile";
  } else if (provider === "mistral") {
    if (!mistralKey) return res.status(200).json({ useLocal: true, providerBlocked: true, message: "Mistral is not configured. Add MISTRAL_API_KEY on the server." });
    url = "https://api.mistral.ai/v1/chat/completions";
    key = mistralKey;
    model = process.env.MISTRAL_MODEL || "ministral-8b-2512";
  } else if (provider === "omniroute") {
    if (!omniKey || !omniBase) return res.status(200).json({ useLocal: true, providerBlocked: true, message: "OmniRoute is not configured. Add OMNIROUTE_API_KEY, OMNIROUTE_BASE_URL and OMNIROUTE_MODEL." });
    const base = omniBase.endsWith("/v1") ? omniBase : `${omniBase}/v1`;
    url = `${base}/chat/completions`;
    key = omniKey;
    model = omniModel;
  } else {
    return res.status(400).json({ error: "Unsupported script provider" });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.5, response_format: { type: "json_object" } }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      return res.status(200).json({ useLocal: true, providerBlocked: true, message: `${provider} returned HTTP ${response.status}: ${responseText.slice(0, 220)}` });
    }
    const data = JSON.parse(responseText) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}") as Record<string, unknown>;
    return res.status(200).json({
      useLocal: false,
      provider,
      script: {
        title: body.title || "Untitled Movie",
        logline: parsed.logline || "",
        synopsis: body.synopsis || "",
        characters: Array.isArray(parsed.characters) ? parsed.characters : [],
        scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
        fullScriptText: JSON.stringify(parsed, null, 2),
        language: body.language === "hi" ? "hi" : "en",
        note: `Generated via ${provider}; provider quotas and pricing apply.`,
      },
    });
  } catch (error) {
    return res.status(200).json({ useLocal: true, providerBlocked: true, message: error instanceof Error ? error.message : "Provider request failed." });
  }
}
