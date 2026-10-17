import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Grok Imagine proxy (xAI Images API).
 * - Requires XAI_API_KEY in Vercel env (server-side only — never expose to frontend)
 * - Paid per image (~$0.02–$0.08). Free path remains web-image-agent.
 * - If key missing: returns { configured: false } so client can fall back.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const key = process.env.XAI_API_KEY;
    return res.status(200).json({
      configured: Boolean(key && key.length > 8),
      model: "grok-imagine-image-2.0",
      note: key
        ? "Grok Imagine ready (usage billed to your xAI account)."
        : "Set XAI_API_KEY in Vercel → Settings → Environment Variables to enable.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      ok: false,
      configured: false,
      message:
        "XAI_API_KEY not set. Add it in Vercel env, or use free B · Auto-fill / Import.",
    });
  }

  const body = (req.body || {}) as {
    prompt?: string;
    aspect_ratio?: string;
    n?: number;
  };

  const prompt = (body.prompt || "").trim().slice(0, 2000);
  if (prompt.length < 4) {
    return res.status(400).json({ ok: false, message: "prompt required" });
  }

  try {
    const r = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-imagine-image-2.0",
        prompt,
        n: Math.min(Math.max(body.n || 1, 1), 2),
        // Prefer cinematic portrait for reels when unspecified
        aspect_ratio: body.aspect_ratio || "9:16",
      }),
    });

    const text = await r.text();
    let data: {
      data?: Array<{ url?: string; b64_json?: string }>;
      error?: { message?: string };
    } = {};
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      /* non-json */
    }

    if (!r.ok) {
      return res.status(200).json({
        ok: false,
        configured: true,
        message:
          data.error?.message ||
          `xAI Imagine error ${r.status}: ${text.slice(0, 180)}`,
      });
    }

    const item = data.data?.[0];
    let imageDataUrl: string | undefined;
    let imageUrl: string | undefined;

    if (item?.b64_json) {
      imageDataUrl = `data:image/png;base64,${item.b64_json}`;
    } else if (item?.url) {
      imageUrl = item.url;
      // Fetch and convert to data URL so canvas export is CORS-safe
      try {
        const imgRes = await fetch(item.url);
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const ctype = imgRes.headers.get("content-type") || "image/png";
          imageDataUrl = `data:${ctype};base64,${buf.toString("base64")}`;
        }
      } catch {
        /* keep url only */
      }
    }

    if (!imageDataUrl && !imageUrl) {
      return res.status(200).json({
        ok: false,
        configured: true,
        message: "Imagine returned no image payload.",
      });
    }

    return res.status(200).json({
      ok: true,
      configured: true,
      provider: "grok-imagine",
      model: "grok-imagine-image-2.0",
      imageDataUrl,
      imageUrl,
      note: "Billed to your xAI account. Key stays server-side.",
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      configured: true,
      message: e instanceof Error ? e.message : "Imagine request failed",
    });
  }
}
