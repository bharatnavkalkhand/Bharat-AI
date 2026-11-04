import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Optional OpenAI-compatible LLM enhancement.
 * Priority: OmniRoute (if configured) -> Groq (if configured) -> local browser engine.
 * Provider credentials stay server-side; never expose them to the browser.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as {
    title?: string;
    synopsis?: string;
    language?: string;
    targetDuration?: string;
    genres?: string[];
  };

  const omniKey = process.env.OMNIROUTE_API_KEY;
  const omniBase = (process.env.OMNIROUTE_BASE_URL || "").trim().replace(/\/+$/, "");
  const omniModel = process.env.OMNIROUTE_MODEL || "auto";
  const groqKey = process.env.GROQ_API_KEY;

  if (!omniKey || !omniBase) {
    if (!groqKey) {
      return res.status(200).json({
        useLocal: true,
        message: "No LLM provider configured. Client will use the browser Script Agent.",
      });
    }
  }

  const lang = body.language === "hi" ? "Hindi" : "English";
  const prompt = `You are a film script assistant for short avatar movies (5-10 min).
CRITICAL RULES:
1. Follow the user's Idea/story EXACTLY. Do not invent a modern romance (Arjun/Meera) if the story is mythological or different.
2. Characters must come from the story (e.g. Ram, Sita, elephant if that is the story).
3. Never repeat the title in a loop (no "title: title: title:").
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

  async function requestModel(url: string, key: string, model: string) {
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });
  }

  try {
    let provider = "";
    let r: Response | null = null;
    let lastFailure = "";

    if (omniKey && omniBase) {
      const base = omniBase.endsWith("/v1") ? omniBase : `${omniBase}/v1`;
      try {
        r = await requestModel(`${base}/chat/completions`, omniKey, omniModel);
        if (r.ok) provider = "omniroute";
        else lastFailure = `OmniRoute returned HTTP ${r.status}`;
      } catch (e) {
        lastFailure = e instanceof Error ? e.message : "OmniRoute connection failed";
      }
    }

    if (!r?.ok && groqKey) {
      try {
        r = await requestModel(
          "https://api.groq.com/openai/v1/chat/completions",
          groqKey,
          "llama-3.3-70b-versatile",
        );
        if (r.ok) provider = "groq-free-tier";
        else lastFailure = `Groq returned HTTP ${r.status}`;
      } catch (e) {
        lastFailure = e instanceof Error ? e.message : "Groq connection failed";
      }
    }

    if (!r?.ok) {
      return res.status(200).json({
        useLocal: true,
        message: `Configured LLM providers unavailable. Falling back to local engine. ${lastFailure}`,
      });
    }

    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content) as Record<string, unknown>;

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
        note: `Generated via ${provider}; provider quotas and limits apply.`,
      },
    });
  } catch (e) {
    return res.status(200).json({
      useLocal: true,
      message: e instanceof Error ? e.message : "LLM error — local fallback",
    });
  }
}
