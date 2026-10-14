/**
 * Lightweight "3D" talking head on Canvas 2D (no GPU / Three.js).
 * Ellipsoid head + jaw morph driven by lip-sync state.
 * Free, offline, export-safe.
 */

import type { FaceAnimState } from "./expression-engine";

function skinTone(mood: string): [number, number, number] {
  const m = (mood || "").toLowerCase();
  if (m === "fight" || m === "action") return [210, 150, 120];
  if (m === "romance") return [230, 180, 150];
  if (m === "emotional") return [200, 160, 140];
  return [220, 175, 145];
}

/** Draw a stylized 3D head with lips driven by anim.lipOpen */
export function drawAvatar3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mood: string,
  anim: FaceAnimState,
  t: number,
) {
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  const rx = w * 0.28;
  const ry = h * 0.32;

  // Background vignette
  const bg = ctx.createRadialGradient(cx, cy, rx * 0.2, cx, cy, Math.max(w, h) * 0.55);
  bg.addColorStop(0, "#1a1520");
  bg.addColorStop(1, "#050508");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  const [sr, sg, sb] = skinTone(mood);
  const jawDrop = anim.lipOpen * ry * 0.12;

  // Neck
  ctx.fillStyle = `rgb(${sr - 25},${sg - 25},${sb - 25})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.95, rx * 0.35, ry * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head sphere shading
  const headG = ctx.createRadialGradient(
    cx - rx * 0.25,
    cy - ry * 0.3,
    rx * 0.1,
    cx,
    cy,
    rx * 1.2,
  );
  headG.addColorStop(0, `rgb(${Math.min(255, sr + 35)},${Math.min(255, sg + 30)},${Math.min(255, sb + 25)})`);
  headG.addColorStop(0.55, `rgb(${sr},${sg},${sb})`);
  headG.addColorStop(1, `rgb(${sr - 55},${sg - 50},${sb - 45})`);
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.ellipse(cx, cy + jawDrop * 0.15, rx, ry + jawDrop * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = `rgb(${sr - 15},${sg - 15},${sb - 15})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * rx * 0.95, cy, rx * 0.14, ry * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hair cap
  ctx.fillStyle = mood === "romance" ? "#3b2218" : "#1c1410";
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.35, rx * 1.02, ry * 0.55, 0, Math.PI, 0);
  ctx.fill();

  // Brows
  ctx.strokeStyle = "rgba(40,25,15,0.9)";
  ctx.lineWidth = Math.max(2, w * 0.012);
  ctx.lineCap = "round";
  const browY = cy - ry * 0.22 - anim.browLift * ry * 0.08;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const dip = anim.browLift < 0 ? 5 : 0;
    ctx.moveTo(cx + side * rx * 0.12, browY + dip * 0.3);
    ctx.quadraticCurveTo(
      cx + side * rx * 0.28,
      browY - 6 + dip,
      cx + side * rx * 0.48,
      browY + 2,
    );
    ctx.stroke();
  }

  // Eyes
  for (const side of [-1, 1]) {
    const ex = cx + side * rx * 0.28;
    const ey = cy - ry * 0.05;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx * 0.12, ry * 0.08 * (1 - anim.eyeSquint * 0.35), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1a2e";
    ctx.beginPath();
    ctx.arc(ex + Math.sin(t * 0.5) * 2, ey, rx * 0.055, 0, Math.PI * 2);
    ctx.fill();
    // highlight
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(ex - 2, ey - 2, rx * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cheeks
  if (anim.cheek > 0.1) {
    ctx.fillStyle = `rgba(255,110,120,${0.15 + anim.cheek * 0.25})`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + side * rx * 0.45, cy + ry * 0.15, rx * 0.14, ry * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Nose
  ctx.strokeStyle = "rgba(80,50,40,0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry * 0.02);
  ctx.lineTo(cx - rx * 0.04, cy + ry * 0.18);
  ctx.lineTo(cx + rx * 0.06, cy + ry * 0.18);
  ctx.stroke();

  // Mouth / jaw cavity — primary lip-sync morph
  const mouthY = cy + ry * 0.38 + jawDrop * 0.5;
  const mouthW = rx * 0.38 * (anim.lipWidth || 1);
  const mouthH = Math.max(2, ry * 0.06 + anim.lipOpen * ry * 0.22);

  // Lips outer
  ctx.fillStyle = "rgba(160,70,80,0.95)";
  ctx.beginPath();
  ctx.ellipse(cx, mouthY, mouthW * 1.1, mouthH * 1.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Open mouth interior
  if (anim.lipOpen > 0.12) {
    ctx.fillStyle = "rgba(40,10,15,0.95)";
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW * 0.9, mouthH, 0, 0, Math.PI * 2);
    ctx.fill();
    // Teeth
    if (anim.lipOpen > 0.35) {
      ctx.fillStyle = "rgba(245,245,250,0.85)";
      ctx.fillRect(cx - mouthW * 0.55, mouthY - mouthH * 0.55, mouthW * 1.1, mouthH * 0.35);
    }
  } else {
    ctx.strokeStyle = "rgba(120,50,60,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + 3, cx + mouthW, mouthY);
    ctx.stroke();
  }

  // Soft rim light
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.02, ry * 1.02, 0, -0.8, 0.4);
  ctx.stroke();
}
