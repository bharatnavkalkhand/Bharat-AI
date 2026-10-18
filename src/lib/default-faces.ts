/** Built-in portrait pack — real faces for free path (no external studio). */
import { FACE_M1_SRC } from "./faces/face-m1";
import { FACE_F1_SRC } from "./faces/face-f1";
import { FACE_F2_SRC } from "./faces/face-f2";
import { FACE_F3_SRC } from "./faces/face-f3";
import { FACE_F4_SRC } from "./faces/face-f4";

export type DefaultFaceId = "m1" | "f1" | "f2" | "f3" | "f4";

export interface DefaultFace {
  id: DefaultFaceId;
  src: string;
  gender: "male" | "female";
  label: string;
  labelHi: string;
}

export const DEFAULT_FACES: DefaultFace[] = [
  { id: "m1", src: FACE_M1_SRC, gender: "male", label: "Hero (M)", labelHi: "नायक" },
  { id: "f1", src: FACE_F1_SRC, gender: "female", label: "Lead (F)", labelHi: "नायिका" },
  { id: "f2", src: FACE_F2_SRC, gender: "female", label: "Support (F)", labelHi: "सह-नायिका" },
  { id: "f3", src: FACE_F3_SRC, gender: "female", label: "Drama (F)", labelHi: "भावना" },
  { id: "f4", src: FACE_F4_SRC, gender: "female", label: "Youth (F)", labelHi: "युवा" },
];

export function defaultFaceForRole(role: string, index: number, name?: string): DefaultFace {
  const blob = `${role} ${name || ""}`.toLowerCase();
  const isMale =
    /नायक|hero|jamsetji|जमशेद|राम|rama|guard|गार्ड|rival|विक्रम|male|man|boy/.test(blob) &&
    !/प्रेमिका|love|female|woman|girl|नायिका|मीरा|meera|हाथिनी/.test(blob);
  if (isMale) return DEFAULT_FACES[0]!;
  const females = DEFAULT_FACES.filter((f) => f.gender === "female");
  return females[index % females.length]!;
}

export function assignDefaultFaces(characters: Array<{ name: string; role: string }>): string[] {
  return characters.map((c, i) => defaultFaceForRole(c.role, i, c.name).src);
}
