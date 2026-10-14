/**
 * Real-human avatar (browser, ₹0):
 * 1) Photo mode — your face image + lip/jaw performance (closest to real human)
 * 2) Procedural mode — painted human head when no photo
 *
 * Not neural face-warp (Wav2Lip). Best free approach without GPU.
 */

import type { FaceAnimState } from "./expression-engine";

function skinPalette(mood: string): {
  base: [number, number, number];
  shadow: [number, number, number];
  highlight: [number, number, number];
  lip: [number, number, number];
  hair: [number, number, number];
} {
  const m = (mood || "").toLowerCase();
  if (m === "fight" || m === "action") {
    return {
      base: [198, 142, 112],
      shadow: [120, 75, 55],
      highlight: [235, 195, 165],
      lip: [150, 70, 75],
      hair: [28, 18, 12],
    };
  }
  if (m === "romance") {
    return {
      base: [220, 175, 148],
      shadow: [140, 95, 75],
      highlight: [250, 220, 200],
      lip: [175, 80, 95],
      hair: [45, 28, 18],
    };
  }
  if (m === "emotional") {
    return {
      base: [205, 160, 135],
      shadow: [125, 85, 65],
      highlight: [235, 200, 180],
      lip: [145, 75, 85],
      hair: [35, 22, 15],
    };
  }
  return {
    base: [212, 168, 140],
    shadow: [130, 88, 68],
    highlight: [242, 210, 185],
    lip: [160, 78, 88],
    hair: [32, 20, 14],
  };
}

function rgb(c: [number, number, number], a = 1) {
  return a < 1
    ? `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
    : `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * REAL HUMAN path: portrait photo fills the panel; lips/jaw animate on the face.
 * Upload a clear front-facing face for best results.
 */
export function drawRealHumanAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  image: HTMLImageElement,
  anim: FaceAnimState,
  t: number,
) {
  // Dark studio plate
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(x, y, w, h);

  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return;

  // Ken-burns-ish breath + talk zoom
  const breath = 1 + 0.012 * Math.sin(t * 1.8) + anim.lipOpen * 0.02;
  const scale = Math.max(w / iw, h / ih) * breath;
  const dw = iw * scale;
  const dh = ih * scale;
  // Bias crop toward upper face (forehead/eyes), mouth stays in lower third of head
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2 - h * 0.04;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Slight head nod while speaking
  const nod = anim.lipOpen * 2.5 * Math.sin(t * 10);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((nod * Math.PI) / 180);
  ctx.translate(-(x + w / 2), -(y + h / 2));

  ctx.drawImage(image, dx, dy, dw, dh);

  // Face performance zone (lower-middle of portrait)
  const cx = x + w / 2;
  const faceMidY = y + h * 0.48;
  const mouthY = y + h * 0.68 + anim.lipOpen * h * 0.01;
  const mouthW = w * 0.11 * (anim.lipWidth || 1);
  const open = Math.max(0, anim.lipOpen);
  const mouthH = Math.max(1.2, h * 0.01 + open * h * 0.045);

  // Soft vignette so focus stays on face
  const vig = ctx.createRadialGradient(cx, faceMidY, w * 0.15, cx, faceMidY, w * 0.7);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vig;
  ctx.fillRect(x, y, w, h);

  // Cheek flush when soft/speak
  if (anim.cheek > 0.12) {
    ctx.fillStyle = `rgba(255,100,110,${0.08 + anim.cheek * 0.12})`;
    for (const side of [-1, 1] as const) {
      ctx.beginPath();
      ctx.ellipse(
        cx + side * w * 0.14,
        y + h * 0.52,
        w * 0.06,
        h * 0.035,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Brow motion (subtle dark curves over photo brows)
  ctx.strokeStyle = `rgba(20,12,8,${0.25 + Math.abs(anim.browLift) * 0.25})`;
  ctx.lineWidth = Math.max(1.5, w * 0.006);
  ctx.lineCap = "round";
  const browY = y + h * 0.36 - anim.browLift * h * 0.015;
  for (const side of [-1, 1] as const) {
    const dip = anim.browLift < 0 ? 3 : 0;
    ctx.beginPath();
    ctx.moveTo(cx + side * w * 0.04, browY + dip * 0.3);
    ctx.quadraticCurveTo(
      cx + side * w * 0.09,
      browY - 3 + dip,
      cx + side * w * 0.15,
      browY + 1,
    );
    ctx.stroke();
  }

  // —— Lip / jaw performance on real face ——
  if (open < 0.1) {
    // Soft closed-mouth line (doesn't erase photo lips fully)
    ctx.strokeStyle = "rgba(80,30,40,0.55)";
    ctx.lineWidth = Math.max(1.5, w * 0.005);
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + (anim.expression === "soft" ? 2 : 0.5), cx + mouthW, mouthY);
    ctx.stroke();
  } else {
    // Darken mouth cavity over photo lips region
    ctx.fillStyle = `rgba(30,8,12,${0.55 + open * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Lip rim
    ctx.strokeStyle = "rgba(140,60,70,0.75)";
    ctx.lineWidth = Math.max(1.2, w * 0.004);
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW, mouthH, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (open > 0.35) {
      ctx.fillStyle = "rgba(245,245,250,0.7)";
      ctx.fillRect(
        cx - mouthW * 0.55,
        mouthY - mouthH * 0.55,
        mouthW * 1.1,
        mouthH * 0.32,
      );
    }
  }

  ctx.restore();
}

/** Procedural human head when no photo is available */
export function drawAvatar3D(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  mood: string,
  anim: FaceAnimState,
  t: number,
  faceImage?: HTMLImageElement | null,
) {
  // Prefer real photo when present
  if (faceImage && faceImage.complete && faceImage.naturalWidth > 0) {
    drawRealHumanAvatar(ctx, x, y, w, h, faceImage, anim, t);
    return;
  }

  const pal = skinPalette(mood);
  const cx = x + w / 2;
  const cy = y + h * 0.4;
  const rx = w * 0.26;
  const ry = h * 0.34;
  const jawDrop = anim.lipOpen * ry * 0.1;

  const bg = ctx.createRadialGradient(
    cx,
    cy,
    rx * 0.3,
    cx,
    cy + ry * 0.2,
    Math.max(w, h) * 0.6,
  );
  bg.addColorStop(0, "#2a2430");
  bg.addColorStop(0.55, "#121018");
  bg.addColorStop(1, "#060508");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  const neckG = ctx.createLinearGradient(cx, cy + ry * 0.7, cx, cy + ry * 1.35);
  neckG.addColorStop(0, rgb(pal.base));
  neckG.addColorStop(1, rgb(pal.shadow));
  ctx.fillStyle = neckG;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.28, cy + ry * 0.75);
  ctx.quadraticCurveTo(cx, cy + ry * 1.35, cx + rx * 0.28, cy + ry * 0.75);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rgb(mix(pal.shadow, pal.base, 0.3));
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 1.35, rx * 1.15, ry * 0.22, 0, Math.PI, 0);
  ctx.fill();

  const headCy = cy + jawDrop * 0.12;
  const headG = ctx.createRadialGradient(
    cx - rx * 0.28,
    headCy - ry * 0.35,
    rx * 0.08,
    cx,
    headCy,
    rx * 1.35,
  );
  headG.addColorStop(0, rgb(pal.highlight));
  headG.addColorStop(0.35, rgb(pal.base));
  headG.addColorStop(0.75, rgb(mix(pal.base, pal.shadow, 0.45)));
  headG.addColorStop(1, rgb(pal.shadow));
  ctx.fillStyle = headG;
  ctx.beginPath();
  ctx.ellipse(cx, headCy, rx, ry + jawDrop * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = rgb([220, 120, 110], 0.12 + anim.cheek * 0.18);
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(
      cx + side * rx * 0.42,
      headCy + ry * 0.12,
      rx * 0.18,
      ry * 0.14,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  for (const side of [-1, 1] as const) {
    const earG = ctx.createRadialGradient(
      cx + side * rx * 0.95,
      headCy,
      2,
      cx + side * rx * 0.95,
      headCy,
      rx * 0.16,
    );
    earG.addColorStop(0, rgb(mix(pal.base, pal.highlight, 0.3)));
    earG.addColorStop(1, rgb(pal.shadow));
    ctx.fillStyle = earG;
    ctx.beginPath();
    ctx.ellipse(
      cx + side * rx * 0.98,
      headCy + ry * 0.02,
      rx * 0.12,
      ry * 0.18,
      side * 0.15,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.fillStyle = rgb(pal.hair);
  ctx.beginPath();
  ctx.ellipse(cx, headCy - ry * 0.45, rx * 1.05, ry * 0.55, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  for (const side of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(
      cx + side * rx * 0.75,
      headCy - ry * 0.05,
      rx * 0.28,
      ry * 0.55,
      side * 0.25,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.strokeStyle = rgb(mix(pal.hair, pal.shadow, 0.3), 0.9);
  ctx.lineWidth = Math.max(2.2, w * 0.011);
  ctx.lineCap = "round";
  const browY = headCy - ry * 0.2 - anim.browLift * ry * 0.07;
  for (const side of [-1, 1] as const) {
    const angry = anim.browLift < 0 ? 5 : 0;
    ctx.beginPath();
    ctx.moveTo(cx + side * rx * 0.1, browY + angry * 0.4);
    ctx.quadraticCurveTo(
      cx + side * rx * 0.28,
      browY - 5 + angry,
      cx + side * rx * 0.48,
      browY + 2,
    );
    ctx.stroke();
  }

  for (const side of [-1, 1] as const) {
    const ex = cx + side * rx * 0.26;
    const ey = headCy - ry * 0.02;
    const eyeW = rx * 0.13;
    const eyeH = ry * 0.075 * (1 - anim.eyeSquint * 0.4);
    ctx.fillStyle = "#f5f5f7";
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeW, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    const irisR = eyeH * 0.85;
    const look = Math.sin(t * 0.4 + side) * 1.5;
    const irisG = ctx.createRadialGradient(ex + look, ey, 0.5, ex + look, ey, irisR);
    irisG.addColorStop(0, "#4a3728");
    irisG.addColorStop(0.55, "#2a1c14");
    irisG.addColorStop(1, "#1a100c");
    ctx.fillStyle = irisG;
    ctx.beginPath();
    ctx.arc(ex + look, ey, irisR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a0806";
    ctx.beginPath();
    ctx.arc(ex + look, ey, irisR * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(ex + look - irisR * 0.25, ey - irisR * 0.3, irisR * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }

  const noseY = headCy + ry * 0.12;
  ctx.strokeStyle = rgb(pal.shadow, 0.35);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx, headCy - ry * 0.05);
  ctx.quadraticCurveTo(cx - rx * 0.02, noseY, cx - rx * 0.06, noseY + ry * 0.08);
  ctx.quadraticCurveTo(cx, noseY + ry * 0.12, cx + rx * 0.07, noseY + ry * 0.08);
  ctx.stroke();

  const mouthY = headCy + ry * 0.42 + jawDrop * 0.55;
  const mouthW = rx * 0.36 * (anim.lipWidth || 1);
  const open = Math.max(0, anim.lipOpen);
  const mouthH = Math.max(1.5, ry * 0.035 + open * ry * 0.2);
  const lipCol = pal.lip;

  if (open < 0.12) {
    const smile =
      anim.expression === "soft" || anim.expression === "speak" ? 3 : 1;
    ctx.strokeStyle = rgb(lipCol, 0.95);
    ctx.lineWidth = Math.max(2.5, w * 0.01);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - mouthW, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + smile + 1, cx + mouthW, mouthY);
    ctx.stroke();
  } else {
    ctx.fillStyle = rgb(lipCol, 0.92);
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW * 1.08, mouthH * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(45,12,18,0.95)";
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, mouthW * 0.88, mouthH, 0, 0, Math.PI * 2);
    ctx.fill();
    if (open > 0.32) {
      ctx.fillStyle = "rgba(248,248,252,0.9)";
      const tw = mouthW * 1.05;
      const th = Math.min(mouthH * 0.4, ry * 0.04);
      ctx.fillRect(cx - tw / 2, mouthY - mouthH * 0.55, tw, th);
    }
  }
}
