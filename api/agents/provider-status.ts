import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Reports only whether server-side provider credentials are configured. Never returns secrets. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const paidEnabled = process.env.ALLOW_PAID_PROVIDERS === "true";
  return res.status(200).json({
    paidEnabled,
    text: {
      groq: Boolean(process.env.GROQ_API_KEY),
      mistral: Boolean(process.env.MISTRAL_API_KEY),
      omniroute: Boolean(process.env.OMNIROUTE_API_KEY && process.env.OMNIROUTE_BASE_URL),
    },
    image: { grokImagine: Boolean(process.env.XAI_API_KEY) },
  });
}
