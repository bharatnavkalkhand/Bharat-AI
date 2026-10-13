import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Free-tier friendly TTS endpoint.
 * Uses Google Translate TTS endpoint server-side (no browser CORS).
 * Unofficial / best-effort — rate limits apply. Not a paid API key product.
 * Falls back gracefully when blocked.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body as { text?: string; language?: string };
  const text = (body.text || "").trim().slice(0, 180);
  if (!text) {
    return res.status(400).json({ error: "text required (max ~180 chars per chunk)" });
  }

  const tl = body.language === "hi" ? "hi" : "en";
  const url =
    "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&q=" +
    encodeURIComponent(text) +
    "&tl=" +
    tl;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });

    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        message: `TTS upstream ${r.status}. Client will use browser speech.`,
      });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 500) {
      return res.status(200).json({
        ok: false,
        message: "TTS empty/blocked. Client will use browser speech.",
      });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(200).json({
      ok: false,
      message: e instanceof Error ? e.message : "TTS failed",
    });
  }
}
