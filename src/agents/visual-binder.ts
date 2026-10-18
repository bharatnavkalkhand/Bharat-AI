import type { Character, Scene } from "@/lib/types";
import type { PlayerScene } from "./scene-player";
import { assignDefaultFaces } from "@/lib/default-faces";

/**
 * Maps movie scenes → player frames.
 * Priority: external video/image → panel upload → cast face → built-in portraits.
 */
export function bindScenesForPlayer(
  scenes: Scene[],
  characters: Character[],
): PlayerScene[] {
  const sorted = [...scenes].sort((a, b) => a.order - b.order);
  const defaultPack = assignDefaultFaces(
    characters.map((c) => ({ name: c.name, role: c.role })),
  );
  const faces = characters
    .map((c, i) => c.referenceImageLocal || c.referenceImageUrl || defaultPack[i])
    .filter(Boolean) as string[];
  const pack = faces.length ? faces : defaultPack;

  return sorted.map((sc, i) => {
    const assigned = sc.characterIds
      .map((id) => characters.find((character) => character.id === id))
      .filter((character): character is Character => Boolean(character));
    const assignedFaces = assigned
      .map((character, ai) => {
        const idx = characters.findIndex((c) => c.id === character.id);
        return (
          character.referenceImageLocal ||
          character.referenceImageUrl ||
          defaultPack[idx >= 0 ? idx : ai] ||
          defaultPack[0]
        );
      })
      .filter(Boolean) as string[];
    const availableFaces = assignedFaces.length ? assignedFaces : pack;
    const top =
      sc.externalImageLocal ||
      sc.imageTopLocal ||
      availableFaces[i % Math.max(availableFaces.length, 1)] ||
      availableFaces[0] ||
      defaultPack[0];
    const bottom =
      sc.imageBottomLocal ||
      sc.externalImageLocal ||
      availableFaces[(i + 1) % Math.max(availableFaces.length, 1)] ||
      availableFaces[0] ||
      top;
    const characterPrompt = assigned
      .map((character) =>
        [character.name, character.role, character.appearance]
          .filter(Boolean)
          .join(", "),
      )
      .join("; ");
    const visualPrompt = [
      sc.visualPrompt,
      characterPrompt ? `Consistent selected characters: ${characterPrompt}` : "",
    ]
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
      audioUrl: sc.audioLocal || sc.audioUrl,
      videoUrl: sc.externalVideoLocal || undefined,
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

export function readAudioAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read audio"));
    };
    reader.onerror = () => reject(new Error("Failed to read audio"));
    reader.readAsDataURL(file);
  });
}

export function readMediaAsDataUrl(file: File): Promise<string> {
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
