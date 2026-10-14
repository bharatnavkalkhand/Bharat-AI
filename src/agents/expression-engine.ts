/**
 * Facial expression + lip overlay.
 * Supports Rhubarb visemes when cues available; else rhythm fallback.
 */

import type { RhubarbViseme } from "./rhubarb-lipsync";
import {
  lipOpenFromViseme,
  widthFromViseme,
} from "./rhubarb-lipsync";

export type FaceExpression =
  | "neutral"
  | "speak"
  | "angry"
  | "soft"
  | "sad"
  | "intense";

export interface FaceAnimState {
  expression: FaceExpression;
  /** 0 closed → 1 open */
  lipOpen: number;
  lipWidth: number;
  browLift: number;
  eyeSquint: number;
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
  if (!speaking) return 0.05 + 0.02 * Math.sin(t * 2);
  const rate = 8 + Math.min(6, textLength / 40);
  const jaw = 0.35 + 0.55 * Math.abs(Math.sin(t * rate));
  const flutter = 0.12 * Math.abs(Math.sin(t * rate * 2.3));
  return Math.min(1, jaw + flutter);
}

export function faceAnimAt(
  mood: string,
  t: number,
  textLength: number,
  speaking: boolean,
  viseme?: RhubarbViseme | null,
): FaceAnimState {
  const expression = speaking ? "speak" : moodToExpression(mood);
  let lipOpen: number;
  let lipWidth = 1;

  if (speaking && viseme) {
    lipOpen = lipOpenFromViseme(viseme);
    lipWidth = widthFromViseme(viseme);
  } else {
    lipOpen = lipOpenAt(t, textLength, speaking);
  }

  switch (expression) {
    case "angry":
      return {
        expression,
        lipOpen: speaking ? lipOpen : 0.08,
        lipWidth,
        browLift: -0.4,
        eyeSquint: 0.55 + 0.1 * Math.sin(t * 3),
        viseme: viseme || undefined,
      };
    case "soft":
      return {
        expression,
        lipOpen: speaking ? lipOpen * 0.9 : 0.12,
        lipWidth,
        browLift: 0.25,
        eyeSquint: 0.1,
        viseme: viseme || undefined,
      };
    case "sad":
      return {
        expression,
        lipOpen: speaking ? lipOpen * 0.75 : 0.06,
        lipWidth,
        browLift: 0.35,
        eyeSquint: 0.35,
        viseme: viseme || undefined,
      };
    case "intense":
      return {
        expression,
        lipOpen: speaking ? lipOpen : 0.1,
        lipWidth,
        browLift: 0.15,
        eyeSquint: 0.4,
        viseme: viseme || undefined,
      };
    case "speak":
      return {
        expression,
        lipOpen,
        lipWidth,
        browLift: 0.1 * Math.sin(t * 1.5),
        eyeSquint: 0.15,
        viseme: viseme || undefined,
      };
    default:
      return {
        expression: "neutral",
        lipOpen: speaking ? lipOpen : 0.05,
        lipWidth,
        browLift: 0,
        eyeSquint: 0.05,
        viseme: viseme || undefined,
      };
  }
}

export function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  anim: FaceAnimState,
) {
  const cx = x + w / 2;
  const mouthY = y + h * 0.72;
  const baseW = w * 0.22 * (anim.lipWidth || 1);
  const mouthW = baseW;
  const mouthH = h * 0.035 * (0.35 + anim.lipOpen * 2);

  const vg = ctx.createRadialGradient(
    cx,
    y + h * 0.45,
    w * 0.1,
    cx,
    y + h * 0.5,
    w * 0.55,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = vg;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = `rgba(20,20,20,${0.35 + Math.abs(anim.browLift) * 0.25})`;
  ctx.lineWidth = Math.max(2, w * 0.008);
  ctx.lineCap = "round";
  const browY = y + h * 0.32 - anim.browLift * h * 0.02;
  const browSpan = w * 0.12;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * browSpan * 0.3, browY + (anim.browLift < 0 ? 4 : 0));
    ctx.quadraticCurveTo(
      cx + side * browSpan * 0.7,
      browY - 6 + (anim.browLift < 0 ? 8 : 0),
      cx + side * browSpan * 1.15,
      browY + 2,
    );
    ctx.stroke();
  }

  if (anim.eyeSquint > 0.2) {
    ctx.strokeStyle = `rgba(0,0,0,${0.2 + anim.eyeSquint * 0.25})`;
    ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.08, y + h * 0.42);
      ctx.lineTo(cx + side * w * 0.16, y + h * 0.43 + anim.eyeSquint * 2);
      ctx.stroke();
    }
  }

  // Viseme-specific mouth: B = lips closed line; F = bite; else ellipse
  const v = anim.viseme;
  if (v === "B" || (anim.lipOpen < 0.12 && !v)) {
    ctx.strokeStyle = "rgba(120,50,60,0.9)";
    ctx.lineWidth = Math.max(2, w * 0.008);
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 2, cx + mouthW, mouthY);
    ctx.stroke();
  } else if (v === "F") {
    ctx.fillStyle = "rgba(40,10,15,0.5)";
    ctx.fillRect(cx - mouthW, mouthY - 2, mouthW * 2, 4);
    ctx.strokeStyle = "rgba(120,50,60,0.85)";
    ctx.strokeRect(cx - mouthW, mouthY - 2, mouthW * 2, 4);
  } else {
    ctx.fillStyle = "rgba(40,10,15,0.75)";
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,50,60,0.85)";
    ctx.lineWidth = Math.max(1.5, w * 0.006);
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (anim.lipOpen > 0.45) {
      ctx.fillStyle = "rgba(240,240,245,0.55)";
      ctx.fillRect(
        cx - mouthW * 0.55,
        mouthY - mouthH * 0.35,
        mouthW * 1.1,
        mouthH * 0.35,
      );
    }
  }
}
