import type { Character, Scene } from "@/lib/types";
import type { PlayerScene } from "./scene-player";

/**
 * Maps movie scenes → player frames with images.
 * Priority: scene panel upload → character reference faces → none (mood art).
 */
export function bindScenesForPlayer(
  scenes: Scene[],
  characters: Character[],
): PlayerScene[] {
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const faces = characters
    .map((c) => c.referenceImageLocal || c.referenceImageUrl)
    .filter(Boolean) as string[];

  return sorted.map((sc, i) => {
    const top =
      sc.imageTopLocal ||
      faces[i % Math.max(faces.length, 1)] ||
      faces[0];
    const bottom =
      sc.imageBottomLocal ||
      faces[(i + 1) % Math.max(faces.length, 1)] ||
      faces[0] ||
      top;

    return {
      id: sc.id,
      title: sc.title,
      mood: sc.mood,
      dialogue: sc.dialogue,
      narration: sc.narration,
      visualPrompt: sc.visualPrompt,
      imageTop: top,
      imageBottom: bottom !== top ? bottom : sc.imageBottomLocal || top,
    };
  });
}

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read image"));
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}
