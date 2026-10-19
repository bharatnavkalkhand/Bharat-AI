/**
 * MediaPipe Face Landmarker — detect real lip position on portrait photos.
 * Free client-side path: landmarks stay on-device, no server upload.
 *
 * Key lip indices (MediaPipe Face Mesh / Face Landmarker):
 *  - 13  upper lip center
 *  - 14  lower lip center
 *  - 61  left mouth corner
 *  - 291 right mouth corner
 *  - 0   upper lip top (approx)
 */

import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";

export interface LipRegion {
  /** Normalized 0–1 relative to image width/height */
  centerX: number;
  centerY: number;
  /** Mouth width as fraction of image width */
  width: number;
  /** Mouth height (closed) as fraction of image height */
  height: number;
  /** Upper / lower lip Y (normalized) */
  upperY: number;
  lowerY: number;
  leftX: number;
  rightX: number;
  /** Confidence / validity */
  ok: boolean;
}

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarker: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker | null> | null = null;

/** Cache: image src / dataURL → LipRegion */
const lipCache = new Map<string, LipRegion>();

const FALLBACK: LipRegion = {
  centerX: 0.5,
  centerY: 0.68,
  width: 0.16,
  height: 0.03,
  upperY: 0.66,
  lowerY: 0.70,
  leftX: 0.42,
  rightX: 0.58,
  ok: false,
};

export async function initFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (landmarker) return landmarker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
      );
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
      return landmarker;
    } catch (err) {
      console.warn("[face-landmarks] init failed, using fallback positions", err);
      return null;
    }
  })();

  return initPromise;
}

/**
 * Detect lip region from an HTMLImageElement, HTMLCanvasElement, or ImageBitmap.
 * Results are cached by a stable key (src or generated id).
 */
export async function detectLipRegion(
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  cacheKey?: string,
): Promise<LipRegion> {
  const key =
    cacheKey ||
    (image instanceof HTMLImageElement && image.src
      ? image.src
      : `anon-${Math.random().toString(36).slice(2)}`);

  const cached = lipCache.get(key);
  if (cached) return cached;

  const lm = await initFaceLandmarker();
  if (!lm) {
    lipCache.set(key, FALLBACK);
    return FALLBACK;
  }

  try {
    const result = lm.detect(image as HTMLImageElement);
    const faces = result.faceLandmarks;
    if (!faces || faces.length === 0) {
      lipCache.set(key, FALLBACK);
      return FALLBACK;
    }

    const pts = faces[0]!;
    // MediaPipe normalized landmarks (x,y in 0–1)
    const upper = pts[13];
    const lower = pts[14];
    const left = pts[61];
    const right = pts[291];

    if (!upper || !lower || !left || !right) {
      lipCache.set(key, FALLBACK);
      return FALLBACK;
    }

    const centerX = (left.x + right.x) / 2;
    const centerY = (upper.y + lower.y) / 2;
    const width = Math.max(0.08, Math.abs(right.x - left.x) * 1.15);
    const height = Math.max(0.015, Math.abs(lower.y - upper.y) * 1.4);

    const region: LipRegion = {
      centerX,
      centerY,
      width,
      height,
      upperY: upper.y,
      lowerY: lower.y,
      leftX: left.x,
      rightX: right.x,
      ok: true,
    };

    lipCache.set(key, region);
    return region;
  } catch (err) {
    console.warn("[face-landmarks] detect failed", err);
    lipCache.set(key, FALLBACK);
    return FALLBACK;
  }
}

/** Preload + detect for a data-URL or remote image src (returns LipRegion). */
export async function detectLipRegionFromSrc(src: string): Promise<LipRegion> {
  if (lipCache.has(src)) return lipCache.get(src)!;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      const region = await detectLipRegion(img, src);
      resolve(region);
    };
    img.onerror = () => {
      lipCache.set(src, FALLBACK);
      resolve(FALLBACK);
    };
    img.src = src;
  });
}

export function clearLipCache(): void {
  lipCache.clear();
}
