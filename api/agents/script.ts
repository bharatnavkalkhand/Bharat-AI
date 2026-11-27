import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Server-side script LLM router.
 * FREE mode: OpenRouter free-model router / explicitly :free models, then Groq free tier.
 * PAID mode: only after an explicit UI choice AND ALLOW_PAID_PROVIDERS=true.
 * Provider credentials remain server-side.
 */
type ScriptBody = {
  title?: string;
  synopsis?: string;
  language?: string;
  targetDuration?: string;
  genres?: string[];
  options?: { llmMode?: "free" | "paid" };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = (req.body || {}) as ScriptBody;
  const mode = body.options?.llmMode === "paid" ? "paid" : "free";
  const paidEnabled = process.env.ALLOW_PAID_PROVIDERS === "true";

  if (mode === "paid" && !paidEnabled) {
    return res.status(200).json({
      useLocal: true,
      provider: "browser-local",
      message: "Paid mode is locked by the server owner. Using the free browser Script Agent.",
    });
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const freeModel = (process.env.OPENROUTER_FREE_MODEL || "openrouter/free").trim();
  const paidModel = (process.env.OPENROUTER_MODEL || "").trim();
  const omniKey = process.env.OMNIROUTE_API_KEY;
  const omniBase = (process.env.OMNIROUTE_BASE_URL || "").trim().replace(/\/+$/, "");
  const omniModel = process.env.OMNIROUTE_MODEL || "auto";
  const mistralKey = process.env.MISTRAL_API_KEY;
  const mistralModel = process.env.MISTRAL_MODEL || "ministral-8b-2512";
  const groqKey = process.env.GROQ_API_KEY;

  const isFreeModel = (model: string) => model === "openrouter/free" || model.endsWith(":free");
  if (mode === "free" && !isFreeModel(freeModel)) {
    return res.status(500).json({
      useLocal: true,
      message: "OPENROUTER_FREE_MODEL must be openrouter/free or an explicitly free :free model. No paid model was called.",
    });
  }

  const lang = body.language === "hi" ? "Hindi" : "English";
  const prompt = `You are a film script assistant for short avatar movies (5-10 min).
CRITICAL RULES:
1. Follow the user's Idea/story EXACTLY. Do not invent a modern romance if the story is mythological or different.
2. Characters must come from the story.
3. Never repeat the title in a loop.
4. Split the idea into ordered scenes that retell the plot.
5. Dialogue and narration must match the plot events.

Write a compact structured script in ${lang}.
Title: ${body.title || "Untitled"}
Idea (SOURCE OF TRUTH): ${body.synopsis || ""}
Genres: ${(body.genres || []).join(", ")}
Duration: ${body.targetDuration || "5min"}

Return ONLY valid JSON with keys:
logline (string), characters (array of {name, role, appearance}),
scenes (array of {title, mood, dialogue, gestureNotes, visualPrompt, estimatedDurationSec, narration}).
mood must be one of: fight, romance, gesture, dialogue, action, emotional, dramatic.`;

  const messages = [
    { role: "system", content: "Output JSON only. No markdown. Follow the user's story exactly." },
    { role: "user", content: prompt },
  ];

  async function requestModel(url: string, key: string, model: string, openRouter = false) {
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(openRouter ? { "HTTP-Referer": "https://bharat-ai-chi.vercel.app", "X-Title": "Bharat-AI" } : {}),
      },
      body: JSON.stringify({ model, messages, temperature: 0.5, response_format: { type: "json_object" } }),
    });
  }

  try {
    let provider = "";
    let response: Response | null = null;
    let lastFailure = "";

    // FREE mode only sends the free router or a model explicitly marked :free.
    if (openRouterKey && (mode === "free" || paidModel)) {
      const model = mode === "free" ? freeModel : paidModel;
      try {
        response = await requestModel("https://openrouter.ai/api/v1/chat/completions", openRouterKey, model, true);
        if (response.ok) provider = mode === "free" ? "openrouter-free" : "openrouter-paid";
        else lastFailure = `OpenRouter returned HTTP ${response.status}`;
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : "OpenRouter connection failed";
      }
    }

    if (mode === "paid" && !response?.ok && omniKey && omniBase) {
      const base = omniBase.endsWith("/v1") ? omniBase : `${omniBase}/v1`;
      try {
        response = await requestModel(`${base}/chat/completions`, omniKey, omniModel);
        if (response.ok) provider = "omniroute";
        else lastFailure = `OmniRoute returned HTTP ${response.status}`;
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : "OmniRoute connection failed";
      }
    }

    if (mode === "paid" && !response?.ok && mistralKey) {
      try {
        response = await requestModel("https://api.mistral.ai/v1/chat/completions", mistralKey, mistralModel);
        if (response.ok) provider = "mistral";
        else lastFailure = `Mistral returned HTTP ${response.status}`;
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : "Mistral connection failed";
      }
    }

    // Groq developer free tier is permitted in either mode; it is never a paid fallback.
    if (!response?.ok && groqKey) {
      try {
        response = await requestModel("https://api.groq.com/openai/v1/chat/completions", groqKey, "llama-3.3-70b-versatile");
        if (response.ok) provider = "groq-free-tier";
        else lastFailure = `Groq returned HTTP ${response.status}`;
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : "Groq connection failed";
      }
    }

    if (!response?.ok) {
      return res.status(200).json({
        useLocal: true,
        provider: "browser-local",
        message: `No eligible cloud model available; using browser Script Agent. ${lastFailure}`,
      });
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}") as Record<string, unknown>;
    return res.status(200).json({
      useLocal: false,
      provider,
      script: {
        title: body.title || "Untitled Movie",
        logline: parsed.logline || "",
        synopsis: body.synopsis || "",
        characters: parsed.characters || [],
        scenes: parsed.scenes || [],
        fullScriptText: JSON.stringify(parsed, null, 2),
        language: body.language === "hi" ? "hi" : "en",
        note: `Generated via ${provider}; provider quotas, pricing, and limits apply.`,
      },
    });
  } catch (error) {
    return res.status(200).json({
      useLocal: true,
      provider: "browser-local",
      message: error instanceof Error ? error.message : "LLM error — local fallback",
    });
  }
}
