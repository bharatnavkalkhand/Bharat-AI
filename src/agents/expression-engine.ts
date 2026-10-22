/**
 * Facial expression + lip overlay ("face remix" on photo panels).
 * Not photoreal neural warp — visible client-side performance on faces.
 * Prefers Rhubarb + energy; falls back to speech rhythm.
 * When LipRegion (from MediaPipe) is provided, mouth is drawn on the
 * actual detected lips of the photo instead of a fixed center estimate.
 */

import type { RhubarbViseme, SmoothLipState } from "./rhubarb-lipsync";
import { lipOpenFromViseme, widthFromViseme } from "./rhubarb-lipsync";
import type { LipRegion } from "./face-landmarks";

export type FaceExpression =
  | "neutral"
  | "speak"
  | "angry"
  | "soft"
  | "sad"
  | "intense";

export interface FaceAnimState {
  expression: FaceExpression;
  lipOpen: number;
  lipWidth: number;
  browLift: number;
  eyeSquint: number;
  cheek: number;
  viseme?: RhubarbViseme;
}

export function moodToExpression(mood: string): FaceExpression {
  const m = (mood || "").toLowerCase();
  if (m === "fight" || m === "action") return "angry";
  if (m === "romance") return "soft";
  if (m === "emotional") return "sad";
  if (m === "dramatic" || m === "gesture") return "intense";
  if (m === "dialogue" || m === "comedy") return "speak";
  return "neutral";
}

export function lipOpenAt(
  t: number,
  textLength: number,
  speaking: boolean,
): number {
  if (!speaking) return 0.06 + 0.03 * Math.sin(t * 2);
  const rate = 9 + Math.min(7, textLength / 35);
  const jaw = 0.42 + 0.52 * Math.abs(Math.sin(t * rate));
  const flutter = 0.14 * Math.abs(Math.sin(t * rate * 2.4));
  return Math.min(1, jaw + flutter);
}

export function faceAnimAt(
  mood: string,
  t: number,
  textLength: number,
  speaking: boolean,
  viseme?: RhubarbViseme | null,
  smooth?: SmoothLipState | null,
): FaceAnimState {
  const expression = speaking ? "speak" : moodToExpression(mood);
  let lipOpen: number;
  let lipWidth = 1;
  let v: RhubarbViseme | undefined;

  if (speaking && smooth) {
    lipOpen = Math.max(smooth.lipOpen, 0.2);
    lipWidth = smooth.lipWidth;
    v = smooth.viseme;
  } else if (speaking && viseme) {
    lipOpen = Math.max(lipOpenFromViseme(viseme), 0.2);
    lipWidth = widthFromViseme(viseme);
    v = viseme;
  } else {
    lipOpen = lipOpenAt(t, textLength, speaking);
  }

  switch (expression) {
    case "angry":
      return {
        expression,
        lipOpen: speaking ? lipOpen : 0.12,
        lipWidth: lipWidth * 0.92,
        browLift: -0.55,
        eyeSquint: 0.65 + 0.1 * Math.sin(t * 3),
        cheek: 0.15,
        viseme: v,
      };
    case "soft":
      return {
        expression,
        lipOpen: speaking ? lipOpen * 0.9 : 0.14,
        lipWidth,
        browLift: 0.28,
        eyeSquint: 0.12,
        cheek: 0.45 + 0.08 * Math.sin(t * 1.2),
        viseme: v,
      };
    case "sad":
      return {
        expression,
        lipOpen: speaking ? lipOpen * 0.75 : 0.08,
        lipWidth: lipWidth * 0.95,
        browLift: 0.4,
        eyeSquint: 0.4,
        cheek: 0.08,
        viseme: v,
      };
    case "intense":
      return {
        expression,
        lipOpen: speaking ? lipOpen : 0.12,
        lipWidth,
        browLift: 0.2,
        eyeSquint: 0.45,
        cheek: 0.2,
        viseme: v,
      };
    case "speak":
      return {
        expression,
        lipOpen,
        lipWidth,
        browLift: 0.1 * Math.sin(t * 1.5),
        eyeSquint: 0.15,
        cheek: 0.22 + 0.1 * lipOpen,
        viseme: v,
      };
    default:
      return {
        expression: "neutral",
        lipOpen: speaking ? lipOpen : 0.06,
        lipWidth,
        browLift: 0,
        eyeSquint: 0.06,
        cheek: 0.05,
        viseme: v,
      };
  }
}

/** Where the photo was actually drawn (cover-fit). Lip landmarks map into this. */
export type ImageDrawRect = { dx: number; dy: number; dw: number; dh: number };

/**
 * Draw a clear face remix on the panel.
 * If `lip` (MediaPipe LipRegion) is provided and ok, mouth is placed
 * on the detected lips — mapped into the *drawn image* rect (not the
 * panel), so cover-crop / pan / zoom stay aligned. Otherwise falls back
 * to an upper-face estimate (avoids chest placement on full-body photos).
 */
export function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  anim: FaceAnimState,
  lip?: LipRegion | null,
  imageDraw?: ImageDrawRect | null,
) {
  const cx = x + w / 2;
  // Face band: upper portion of panel (brows/eyes) — headshot-biased
  const faceTop = y + h * 0.12;
  const faceH = h * 0.42;

  // --- Mouth position: prefer real detected lips in image-draw space ---
  let mouthCx = cx;
  let mouthY: number;
  let mouthW: number;
  let mouthH: number;

  if (lip && lip.ok) {
    // Landmarks are normalized to the full photo. Map into where that
    // photo was drawn (cover-fit), not the panel (x,y,w,h).
    const id = imageDraw ?? { dx: x, dy: y, dw: w, dh: h };
    mouthCx = id.dx + lip.centerX * id.dw;
    mouthY = id.dy + lip.centerY * id.dh;
    mouthW = Math.max(8, lip.width * id.dw * (anim.lipWidth || 1) * 0.95);
    const baseH = Math.max(3, lip.height * id.dh * 1.1);
    mouthH = Math.max(3, baseH * (0.55 + anim.lipOpen * 2.8));
    // Safety: never draw mouth in lower 40% of panel (blocks chest placement)
    const maxMouthY = y + h * 0.58;
    if (mouthY > maxMouthY) mouthY = y + h * 0.38;
    // Keep inside panel horizontally
    mouthCx = Math.min(x + w - mouthW, Math.max(x + mouthW, mouthCx));
  } else {
    // Fallback: upper-face estimate (works for headshot + upper-body glam)
    mouthY = faceTop + faceH * 0.72;
    mouthW = w * 0.14 * (anim.lipWidth || 1);
    mouthH = Math.max(3, h * 0.022 * (0.4 + anim.lipOpen * 2.6));
  }

  // Soft focus ring so remix reads on busy photos
  const ring = ctx.createRadialGradient(
    cx,
    faceTop + faceH * 0.45,
    w * 0.08,
    cx,
    faceTop + faceH * 0.5,
    w * 0.42,
  );
  ring.addColorStop(0, "rgba(0,0,0,0)");
  ring.addColorStop(0.7, "rgba(0,0,0,0.05)");
  ring.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = ring;
  ctx.fillRect(x, y, w, h);

  // Cheeks (romance / speak)
  if (anim.cheek > 0.1) {
    const a = 0.12 + anim.cheek * 0.2;
    ctx.fillStyle = `rgba(255, 100, 110, ${a})`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(
        cx + side * w * 0.14,
        faceTop + faceH * 0.52,
        w * 0.06,
        h * 0.035,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Brows — thick enough to see on photos
  ctx.strokeStyle = `rgba(25,15,10,${0.55 + Math.abs(anim.browLift) * 0.3})`;
  ctx.lineWidth = Math.max(2.5, w * 0.012);
  ctx.lineCap = "round";
  const browY = faceTop + faceH * 0.22 - anim.browLift * h * 0.025;
  const browSpan = w * 0.1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const angryDip = anim.browLift < 0 ? 7 : 0;
    ctx.moveTo(cx + side * browSpan * 0.25, browY + angryDip * 0.3);
    ctx.quadraticCurveTo(
      cx + side * browSpan * 0.65,
      browY - 7 + angryDip,
      cx + side * browSpan * 1.2,
      browY + 3,
    );
    ctx.stroke();
  }

  // Eyes / squint lines
  if (anim.eyeSquint > 0.15) {
    ctx.strokeStyle = `rgba(15,10,8,${0.35 + anim.eyeSquint * 0.35})`;
    ctx.lineWidth = Math.max(1.5, w * 0.007);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.06, faceTop + faceH * 0.38);
      ctx.quadraticCurveTo(
        cx + side * w * 0.11,
        faceTop + faceH * 0.4 + anim.eyeSquint * 3,
        cx + side * w * 0.16,
        faceTop + faceH * 0.39,
      );
      ctx.stroke();
    }
  }

  // Mouth — animated lips
  // Uses mouthCx / mouthY (real detected lips when LipRegion available)
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (anim.expression === "soft" && anim.lipOpen < 0.25) {
    ctx.strokeStyle = "rgba(180,40,60,0.85)";
    ctx.lineWidth = Math.max(2.5, w * 0.01);
    ctx.beginPath();
    ctx.moveTo(mouthCx - mouthW, mouthY);
    ctx.quadraticCurveTo(
      mouthCx,
      mouthY + (anim.expression === "soft" ? 4 : 2),
      mouthCx + mouthW,
      mouthY,
    );
    ctx.stroke();
  } else if (anim.lipOpen < 0.18) {
    ctx.fillStyle = "rgba(40,15,15,0.75)";
    ctx.fillRect(mouthCx - mouthW, mouthY - 3, mouthW * 2, 6);
    ctx.strokeStyle = "rgba(120,40,50,0.6)";
    ctx.strokeRect(mouthCx - mouthW, mouthY - 3, mouthW * 2, 6);
  } else {
    // Open mouth cavity
    ctx.fillStyle = "rgba(20,5,8,0.92)";
    ctx.beginPath();
    ctx.ellipse(
      mouthCx,
      mouthY,
      mouthW,
      Math.max(2, mouthH),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // Lip outline
    ctx.strokeStyle = "rgba(160,50,60,0.9)";
    ctx.lineWidth = Math.max(2, w * 0.009);
    ctx.beginPath();
    ctx.ellipse(
      mouthCx,
      mouthY,
      mouthW,
      Math.max(2, mouthH),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    // Teeth hint when more open
    if (anim.lipOpen > 0.45) {
      ctx.fillStyle = "rgba(255,250,240,0.55)";
      ctx.fillRect(
        mouthCx - mouthW * 0.5,
        mouthY - mouthH * 0.4,
        mouthW,
        Math.max(2, mouthH * 0.35),
      );
    }
  }
}
