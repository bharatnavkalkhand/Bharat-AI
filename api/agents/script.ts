import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Optional free-tier LLM script enhancement.
 * - If GROQ_API_KEY is set (Groq free tier): uses llama model
 * - Else returns { useLocal: true } so client uses browser script engine
 * Never requires paid APIs. Keys only from env — never client.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const groqKey = process.env.GROQ_API_KEY;
  const body = req.body as {
    title?: string;
    synopsis?: string;
    language?: string;
    targetDuration?: string;
    genres?: string[];
  };

  if (!groqKey) {
    return res.status(200).json({
      useLocal: true,
      message:
        "No free LLM key configured. Client will use browser Script Agent. Set GROQ_API_KEY (free tier) on Vercel to upgrade.",
    });
  }

  try {
    const lang = body.language === "hi" ? "Hindi" : "English";
    const prompt = `You are a film script assistant for short avatar movies (5-10 min).
Write a compact structured script in ${lang}.
Title: ${body.title || "Untitled"}
Idea: ${body.synopsis || ""}
Genres: ${(body.genres || []).join(", ")}
Duration: ${body.targetDuration || "5min"}

Return ONLY valid JSON with keys:
logline (string), characters (array of {name, role, appearance}),
scenes (array of {title, mood, dialogue, gestureNotes, visualPrompt, estimatedDurationSec}).
mood must be one of: fight, romance, gesture, dialogue, action, emotional.
Include fight and romance scenes when genres suggest them.`;

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Output JSON only. No markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(200).json({
        useLocal: true,
        message: `Groq free tier unavailable (${r.status}). Using local engine. ${errText.slice(0, 120)}`,
      });
    }

    const data = (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content) as Record<string, unknown>;

    return res.status(200).json({
      useLocal: false,
      provider: "groq-free-tier",
      script: {
        title: body.title || "Untitled Movie",
        logline: parsed.logline || "",
        synopsis: body.synopsis || "",
        characters: parsed.characters || [],
        scenes: parsed.scenes || [],
        fullScriptText: JSON.stringify(parsed, null, 2),
        language: body.language === "hi" ? "hi" : "en",
        note: "Generated via Groq free-tier LLM (rate limits apply).",
      },
    });
  } catch (e) {
    return res.status(200).json({
      useLocal: true,
      message: e instanceof Error ? e.message : "LLM error — local fallback",
    });
  }
}
