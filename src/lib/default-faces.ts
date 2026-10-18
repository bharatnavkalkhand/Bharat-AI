/**
 * Built-in portrait pack — used when user has no cast photo / no Civitai import.
 * Real faces replace cartoon stick-figures on the free path.
 */

export type DefaultFaceId = "m1" | "f1" | "f2" | "f3" | "f4";

export interface DefaultFace {
  id: DefaultFaceId;
  src: string;
  gender: "male" | "female";
  label: string;
  labelHi: string;
}

/** Served from /public/faces (Vite static). */
export const DEFAULT_FACES: DefaultFace[] = [
  {
    id: "m1",
    src: "/faces/face-m1.jpg",
    gender: "male",
    label: "Hero (M)",
    labelHi: "नायक",
  },
  {
    id: "f1",
    src: "/faces/face-f1.jpg",
    gender: "female",
    label: "Lead (F)",
    labelHi: "नायिका",
  },
  {
    id: "f2",
    src: "/faces/face-f2.jpg",
    gender: "female",
    label: "Support (F)",
    labelHi: "सह-नायिका",
  },
  {
    id: "f3",
    src: "/faces/face-f3.jpg",
    gender: "female",
    label: "Drama (F)",
    labelHi: "भावना",
  },
  {
    id: "f4",
    src: "/faces/face-f4.jpg",
    gender: "female",
    label: "Youth (F)",
    labelHi: "युवा",
  },
];

export function faceSrc(id: DefaultFaceId): string {
  return `/faces/face-${id}.jpg`;
}

/** Map cast role → default portrait (stable across scenes). */
export function defaultFaceForRole(
  role: string,
  index: number,
  name?: string,
): DefaultFace {
  const blob = `${role} ${name || ""}`.toLowerCase();
  const isMale =
    /नायक|hero|jamsetji|जमशेद|राम|rama|guard|गार्ड|rival|विक्रम|male|man|boy/.test(
      blob,
    ) && !/प्रेमिका|love|female|woman|girl|नायिका|मीरा|meera|हाथिनी/.test(blob);

  if (isMale) return DEFAULT_FACES[0]!; // m1

  // Cycle female portraits for variety
  const females = DEFAULT_FACES.filter((f) => f.gender === "female");
  return females[index % females.length]!;
}

/** Ordered face URLs for N characters (continuity). */
export function assignDefaultFaces(
  characters: Array<{ name: string; role: string }>,
): string[] {
  return characters.map((c, i) => defaultFaceForRole(c.role, i, c.name).src);
}
