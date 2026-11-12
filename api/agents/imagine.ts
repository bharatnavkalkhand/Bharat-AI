import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Grok Imagine proxy (xAI Images API).
 * - Requires XAI_API_KEY in Vercel env (server-side only — never expose to frontend)
 * - Paid per image (~$0.02–$0.08). Free path remains web-image-agent.
 * - If key missing: returns { configured: false } so client can fall back.
 */
/**
 * Paid calls are OFF unless the operator explicitly sets BOTH
 * ALLOW_PAID_PROVIDERS=true and XAI_API_KEY. A key alone is never enough,
 * so the app stays ₹0 by default.
 */
function paidImagineAllowed(): { allowed: boolean; apiKey?: string } {
  const apiKey = process.env.XAI_API_KEY;
  const optIn = process.env.ALLOW_PAID_PROVIDERS === "true";
  if (!optIn || !apiKey) return { allowed: false };
  return { allowed: true, apiKey };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    const { allowed } = paidImagineAllowed();
    return res.status(200).json({
      configured: allowed,
      model: "grok-imagine-image-2.0",
      note: allowed
        ? "Grok Imagine enabled by ALLOW_PAID_PROVIDERS (usage billed to your xAI account)."
        : "Paid Grok Imagine is off (free default). To opt in, set ALLOW_PAID_PROVIDERS=true and XAI_API_KEY in Vercel env.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { allowed, apiKey } = paidImagineAllowed();
  if (!allowed || !apiKey) {
    return res.status(200).json({
      ok: false,
      configured: false,
      message:
        "Paid Grok Imagine is off (free default). Use free B · Auto-fill / Import, or opt in with ALLOW_PAID_PROVIDERS=true and XAI_API_KEY.",
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
