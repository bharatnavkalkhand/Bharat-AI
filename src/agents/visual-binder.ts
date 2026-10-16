import type { Character, Scene } from "@/lib/types";
import type { PlayerScene } from "./scene-player";

/**
 * Maps movie scenes → player frames.
 * Priority: external import (ReelShorts etc.) → panel upload → cast face → none.
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
    const assigned = sc.characterIds
      .map((id) => characters.find((character) => character.id === id))
      .filter((character): character is Character => Boolean(character));
    const assignedFaces = assigned
      .map((character) => character.referenceImageLocal || character.referenceImageUrl)
      .filter(Boolean) as string[];
    const availableFaces = assignedFaces.length ? assignedFaces : faces;
    const top =
      sc.externalImageLocal ||
      sc.imageTopLocal ||
      availableFaces[i % Math.max(availableFaces.length, 1)] ||
      availableFaces[0];
    const bottom =
      sc.imageBottomLocal ||
      sc.externalImageLocal ||
      availableFaces[(i + 1) % Math.max(availableFaces.length, 1)] ||
      availableFaces[0] ||
      top;
    const characterPrompt = assigned
      .map((character) => [character.name, character.role, character.appearance].filter(Boolean).join(", "))
      .join("; ");
    const visualPrompt = [sc.visualPrompt, characterPrompt ? `Consistent selected characters: ${characterPrompt}` : ""]
      .filter(Boolean)
      .join(". ");

    return {
      id: sc.id,
      title: sc.title,
      mood: sc.mood,
      dialogue: sc.dialogue,
      narration: sc.narration,
      visualPrompt,
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

/** C — import frame from external AI app (image or first-frame of video later) */
export function readMediaAsDataUrl(file: File): Promise<string> {
  if (file.type.startsWith("image/")) return readImageAsDataUrl(file);
  // Video: store as object URL string is not persistent; read as data URL if small
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read media"));
    };
    reader.onerror = () => reject(new Error("Failed to read media"));
    reader.readAsDataURL(file);
  });
}
