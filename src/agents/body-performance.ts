/**
 * Full-body character performance on Canvas (₹0, no GPU).
 * Walk / fight / gesture / speak — not photoreal video diffusion.
 * Designed to break the static photo-frame loop.
 */

import type { FaceAnimState } from "./expression-engine";

export type BodyAction = "idle" | "walk" | "speak" | "fight" | "gesture" | "bow";

export function moodToBodyAction(
  mood: string,
  speaking: boolean,
): BodyAction {
  if (speaking) return "speak";
  const m = (mood || "").toLowerCase();
  if (m === "fight" || m === "action") return "fight";
  if (m === "gesture" || m === "dramatic") return "gesture";
  if (m === "romance" || m === "emotional") return "bow";
  if (m === "dialogue") return "walk";
  return "idle";
}

function skinForMood(mood: string): string {
  const m = (mood || "").toLowerCase();
  if (m === "fight" || m === "action") return "#c48a6e";
  if (m === "romance") return "#e0b090";
  return "#d4a574";
}

function clothForMood(mood: string): [string, string] {
  const m = (mood || "").toLowerCase();
  if (m === "fight" || m === "action") return ["#7f1d1d", "#1c1917"];
  if (m === "romance") return ["#9d174d", "#4a044e"];
  if (m === "emotional") return ["#4338ca", "#1e1b4b"];
  return ["#0e7490", "#164e63"];
}

/**
 * Draw an animated full-body figure in the panel.
 * Legs/arms phase with time + action — clearly non-static.
 */
export function drawBodyPerformance(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mood: string,
  t: number,
  speaking: boolean,
  faceAnim?: FaceAnimState | null,
) {
  const action = moodToBodyAction(mood, speaking);
  const cx = x + w * 0.5;
  const ground = y + h * 0.92;
  const scale = Math.min(w, h) * 0.00115;
  const unit = 100 * scale * Math.min(w, h) * 0.01;
  // Use relative sizes
  const headR = Math.min(w, h) * 0.055;
  const torsoH = Math.min(w, h) * 0.16;
  const legLen = Math.min(w, h) * 0.18;
  const armLen = Math.min(w, h) * 0.14;

  let phase = t * (action === "fight" ? 14 : action === "walk" || action === "speak" ? 8 : 4);
  let hipX = cx;
  let hipY = ground - legLen - torsoH * 0.15;

  // Horizontal travel for walk
  if (action === "walk" || action === "speak") {
    hipX = cx + Math.sin(t * 1.3) * w * 0.06;
  }
  if (action === "fight") {
    hipX = cx + Math.sin(t * 6) * w * 0.08;
    hipY += Math.abs(Math.sin(t * 10)) * h * 0.02;
  }

  const legSwing =
    action === "idle" || action === "bow"
      ? 0.12 * Math.sin(t * 2)
      : action === "fight"
        ? 0.7 * Math.sin(phase)
        : 0.55 * Math.sin(phase);
  const armSwing =
    action === "fight"
      ? 0.9 * Math.sin(phase + 0.4)
      : action === "gesture"
        ? 0.5 + 0.4 * Math.sin(t * 3)
        : action === "bow"
          ? 0.3
          : 0.45 * Math.sin(phase + Math.PI);

  const bowLean = action === "bow" ? 0.35 + 0.08 * Math.sin(t * 1.5) : 0;
  const skin = skinForMood(mood);
  const [clothA, clothB] = clothForMood(mood);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Soft ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(hipX, ground + 4, headR * 2.2, headR * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = skin;
  ctx.lineWidth = Math.max(4, headR * 0.45);
  ctx.lineCap = "round";
  for (const side of [-1, 1] as const) {
    const ang = side * legSwing;
    const kneeX = hipX + side * headR * 0.3 + Math.sin(ang) * legLen * 0.5;
    const kneeY = hipY + Math.cos(ang * 0.5) * legLen * 0.45;
    const footX = hipX + side * headR * 0.2 + Math.sin(ang) * legLen;
    const footY = ground - 2;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // Foot
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.ellipse(footX + side * 3, footY, headR * 0.45, headR * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Torso
  const torsoTop = hipY - torsoH;
  const leanX = Math.sin(bowLean) * torsoH * 0.4;
  const grad = ctx.createLinearGradient(hipX, torsoTop, hipX, hipY);
  grad.addColorStop(0, clothA);
  grad.addColorStop(1, clothB);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(hipX - headR * 1.1 + leanX, torsoTop);
  ctx.lineTo(hipX + headR * 1.1 + leanX, torsoTop);
  ctx.lineTo(hipX + headR * 0.9, hipY);
  ctx.lineTo(hipX - headR * 0.9, hipY);
  ctx.closePath();
  ctx.fill();

  // Arms
  ctx.strokeStyle = skin;
  ctx.lineWidth = Math.max(3.5, headR * 0.38);
  for (const side of [-1, 1] as const) {
    const shoulderX = hipX + side * headR * 1.05 + leanX;
    const shoulderY = torsoTop + headR * 0.3;
    let ang = side * armSwing;
    if (action === "fight" && side === 1) ang = -0.9 + 0.5 * Math.sin(phase);
    if (action === "gesture" && side === -1) ang = -1.1 + 0.2 * Math.sin(t * 4);
    const handX = shoulderX + Math.sin(ang) * armLen;
    const handY = shoulderY + Math.cos(ang * 0.8) * armLen;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();
  }

  // Head
  const headCx = hipX + leanX * 1.2;
  const headCy = torsoTop - headR * 0.9;
  const headG = ctx.createRadialGradient(
    headCx - headR * 0.3,
    headCy - headR * 0.3,
    headR * 0.2,
    headCx,
    headCy,
    headR * 1.2,
  );
  headG.addColorStop(0, "#f0c8a8");
  headG.addColorStop(0.6, skin);
  headG.addColorStop(1, "#8a5a40");
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.arc(headCx, headCy, headR, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = "#1c1410";
  ctx.beginPath();
  ctx.arc(headCx, headCy - headR * 0.15, headR * 1.05, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#1a1a2e";
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(
      headCx + side * headR * 0.35,
      headCy - headR * 0.05,
      headR * 0.12,
      headR * 0.1 * (1 - (faceAnim?.eyeSquint || 0) * 0.3),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Mouth from face anim / speaking
  const open = faceAnim?.lipOpen ?? (speaking ? 0.4 + 0.3 * Math.abs(Math.sin(t * 12)) : 0.05);
  const mouthY = headCy + headR * 0.4;
  const mouthW = headR * 0.35 * (faceAnim?.lipWidth || 1);
  const mouthH = Math.max(1.5, headR * 0.08 + open * headR * 0.35);
  ctx.fillStyle = "rgba(40,10,15,0.9)";
  ctx.beginPath();
  ctx.ellipse(headCx, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Background dim + vignette so body reads on photo */
export function drawSceneAtmosphere(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
) {
  const g = ctx.createRadialGradient(
    x + w / 2,
    y + h * 0.4,
    w * 0.1,
    x + w / 2,
    y + h / 2,
    w * 0.75,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // Film grain-ish flicker
  ctx.fillStyle = `rgba(255,255,255,${0.02 + 0.015 * Math.sin(t * 20)})`;
  ctx.fillRect(x, y, w, h * 0.02);
}
