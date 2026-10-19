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

/**
 * Draw a clear face remix on the panel.
 * If `lip` (MediaPipe LipRegion) is provided and ok, mouth is placed
 * exactly on the detected lips of the photo. Otherwise falls back to
 * a center-estimate (old behaviour).
 */
export function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  anim: FaceAnimState,
  lip?: LipRegion | null,
) {
  const cx = x + w / 2;
  // Face band: middle of portrait-style crop (used for brows/eyes/cheeks)
  const faceTop = y + h * 0.22;
  const faceH = h * 0.55;

  // --- Mouth position: prefer real detected lips ---
  let mouthCx = cx;
  let mouthY: number;
  let mouthW: number;
  let mouthH: number;

  if (lip && lip.ok) {
    // Map normalized landmarks into the drawn panel rect
    mouthCx = x + lip.centerX * w;
    mouthY = y + lip.centerY * h;
    mouthW = Math.max(8, lip.width * w * (anim.lipWidth || 1) * 0.95);
    // Base closed height from detection, then open with anim
    const baseH = Math.max(3, lip.height * h * 1.1);
    mouthH = Math.max(3, baseH * (0.55 + anim.lipOpen * 2.8));
  } else {
    // Fallback: previous fixed estimate
    mouthY = faceTop + faceH * 0.72;
    mouthW = w * 0.16 * (anim.lipWidth || 1);
    mouthH = Math.max(3, h * 0.028 * (0.4 + anim.lipOpen * 2.6));
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

  // Mouth — high contrast so lips "move" on still photos
  // Uses mouthCx / mouthY (real detected lips when LipRegion available)
  const v = anim.viseme;
  if (v === "B" || (anim.lipOpen < 0.12 && !v && !anim.expression.includes("speak"))) {
    ctx.strokeStyle = "rgba(90,30,40,0.95)";
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
  } else if (v === "F") {
    ctx.fillStyle = "rgba(30,8,12,0.65)";
    ctx.fillRect(mouthCx - mouthW, mouthY - 3, mouthW * 2, 6);
    ctx.strokeStyle = "rgba(120,50,60,0.9)";
    ctx.strokeRect(mouthCx - mouthW, mouthY - 3, mouthW * 2, 6);
  } else {
    // Outer lip
    ctx.fillStyle = "rgba(90,25,35,0.55)";
    ctx.beginPath();
    ctx.ellipse(
      mouthCx,
      mouthY,
      mouthW * 1.08,
      Math.max(2, mouthH * 1.15),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // Inner open mouth
    ctx.fillStyle = "rgba(25,5,10,0.88)";
    ctx.beginPath();
    ctx.ellipse(mouthCx, mouthY, mouthW, Math.max(2, mouthH), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(140,55,65,0.95)";
    ctx.lineWidth = Math.max(1.5, w * 0.006);
    ctx.beginPath();
    ctx.ellipse(mouthCx, mouthY, mouthW, Math.max(2, mouthH), 0, 0, Math.PI * 2);
    ctx.stroke();
    if (anim.lipOpen > 0.38) {
      ctx.fillStyle = "rgba(245,245,250,0.65)";
      ctx.fillRect(
        mouthCx - mouthW * 0.5,
        mouthY - mouthH * 0.4,
        mouthW,
        mouthH * 0.35,
      );
    }
  }
}
