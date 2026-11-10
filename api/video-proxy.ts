import type { VercelRequest, VercelResponse } from "@vercel/node";

const SPACE_HOST = "minimaxai-minimax-h3-turbo-lora.hf.space";

/** Allow-listed same-origin proxy for generated MP4s; avoids browser CORS and supports downloads. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const raw = typeof req.query.url === "string" ? req.query.url : "";
  let source: URL;
  try { source = new URL(raw); } catch { return res.status(400).json({ error: "Invalid video URL" }); }
  if (source.protocol !== "https:" || source.hostname !== SPACE_HOST || !source.pathname.startsWith("/gradio_api/file=") || !source.pathname.toLowerCase().endsWith(".mp4")) {
    return res.status(400).json({ error: "Only generated MP4 files from Bharat AI video engine are allowed." });
  }
  try {
    const upstream = await fetch(source.toString(), { signal: AbortSignal.timeout(25000) });
    if (!upstream.ok) return res.status(upstream.status).json({ error: "Generated MP4 is no longer available. Please generate another clip." });
    const contentType = upstream.headers.get("content-type") || "video/mp4";
    if (!contentType.includes("video/") && !contentType.includes("application/octet-stream")) return res.status(502).json({ error: "Video engine did not return an MP4 file." });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.setHeader("Cache-Control", "private, max-age=86400");
    if (req.query.download === "1") res.setHeader("Content-Disposition", "attachment; filename=\"bharat-ai-generated.mp4\"");
    return res.status(200).send(bytes);
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Could not retrieve generated MP4." });
  }
}
