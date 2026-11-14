/**
 * Mobile / phone-memory client path for Bharat AI.
 *
 * Uses only browser + device resources where possible:
 * - MediaPipe face landmarks (RAM + CPU/GPU via WASM)
 * - Web Speech TTS
 * - localStorage movie/scene media
 * - Canvas play/export
 *
 * Does NOT claim full SD/Wan inside the mobile browser.
 */

export type MobileCapability =
  | "speechSynthesis"
  | "mediaDevices"
  | "indexedDB"
  | "webgl"
  | "wasm"
  | "touch";

export interface MobileClientReport {
  /** Rough mobile UA */
  isMobileUa: boolean;
  /** Prefer client-only produce (no worker required) */
  preferClientPath: boolean;
  capabilities: Record<MobileCapability, boolean>;
  /** Short Hindi/English status for UI */
  summaryHi: string;
  summaryEn: string;
  /** RAM hint only — browsers do not expose exact free RAM */
  memoryHint: string;
}

function has(api: () => unknown): boolean {
  try {
    return Boolean(api());
  } catch {
    return false;
  }
}

export function detectMobileClient(): MobileClientReport {
  const ua =
    typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isMobileUa =
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|Opera Mini/i.test(ua);

  const capabilities: Record<MobileCapability, boolean> = {
    speechSynthesis: has(
      () => typeof window !== "undefined" && window.speechSynthesis,
    ),
    mediaDevices: has(
      () => typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia,
    ),
    indexedDB: has(() => typeof indexedDB !== "undefined"),
    webgl: has(() => {
      if (typeof document === "undefined") return false;
      const c = document.createElement("canvas");
      return Boolean(c.getContext("webgl") || c.getContext("experimental-webgl"));
    }),
    wasm: has(() => typeof WebAssembly !== "undefined"),
    touch: has(
      () =>
        typeof navigator !== "undefined" &&
        (navigator.maxTouchPoints > 0 || "ontouchstart" in (window || {})),
    ),
  };

  const onDeviceOk =
    capabilities.wasm && (capabilities.webgl || capabilities.speechSynthesis);

  const preferClientPath = isMobileUa || onDeviceOk;

  // deviceMemory is Chromium-only, approximate GB of RAM
  const deviceMemory =
    typeof navigator !== "undefined" &&
    "deviceMemory" in navigator &&
    typeof (navigator as Navigator & { deviceMemory?: number }).deviceMemory ===
      "number"
      ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
      : null;

  const memoryHint =
    deviceMemory != null
      ? `~${deviceMemory} GB deviceMemory (browser estimate)`
      : "RAM exact figure not exposed by browser";

  return {
    isMobileUa,
    preferClientPath,
    capabilities,
    memoryHint,
    summaryHi: onDeviceOk
      ? "Phone path ready: lips/TTS/canvas device pe. Full AI video optional cloud/PC."
      : "Limited browser APIs — script + stills; upgrade browser for lips/TTS.",
    summaryEn: onDeviceOk
      ? "On-device path ready: lips/TTS/canvas on phone. Full AI video optional."
      : "Limited APIs — script + stills; use a modern browser for lips/TTS.",
  };
}

/** Default Produce flags for phones — client-first, no worker required. */
export function mobileProduceDefaults(): {
  facePerformance: boolean;
  dualScreen: boolean;
  use3dAvatar: boolean;
} {
  return {
    facePerformance: true,
    dualScreen: false,
    use3dAvatar: true,
  };
}

/**
 * Estimate whether MediaPipe face model is worth loading on this device.
 * Very low deviceMemory → still allow, but UI should warn cold start.
 */
export function shouldLoadFaceLandmarks(): boolean {
  const report = detectMobileClient();
  if (!report.capabilities.wasm) return false;
  return true;
}
