/**
 * B — Cinematic prompt engine
 * One clear universe per scene. Never mix Ramayana anchors with modern cast.
 */

export interface CinematicPromptInput {
  title: string;
  sceneTitle: string;
  mood: string;
  dialogue?: string;
  narration?: string;
  visualPrompt?: string;
  gestureNotes?: string;
  language?: "en" | "hi";
  /** Optional cast names — used only to keep subject consistent, not to dump bios */
  characterNames?: string[];
}

const STYLE_TAIL =
  "cinematic still, photoreal, clear faces, dramatic lighting, vertical 9:16, no text, no watermark";

/** Strict Ramayana detect — needs explicit Rama/Sita/etc, not vague "forest" */
function isRamayana(text: string): boolean {
  return /\b(राम|श्री राम|सीता|लक्ष्मण|हनुमान|रावण|रघुनंदन|वनवास|ayodhya|\brama\b|\bsita\b|lord rama)\b/i.test(
    text,
  );
}

function isTaj(text: string): boolean {
  return /\b(ताज|जमशेद|jamsetji|taj mahal|colonial|औपनिवेश)/i.test(text);
}

function ramayanaSubject(mood: string, beat: string): string {
  const m = (mood + " " + beat).toLowerCase();
  if (/शाप|curse|क्षुब्ध|angry|fight/.test(m))
    return "Lord Rama blue skin yellow dhoti raising hand curse mystical light dense forest";
  if (/प्रार्थना|क्षमा|bow|pray|दीन/.test(m))
    return "Lord Rama forest, elephants bowing, devotional Ramayana scene";
  if (/जल|गजो|water|splash/.test(m))
    return "Lord Rama and elephants at river, water spray, mythology forest";
  if (/सीता|search|पता|खोज/.test(m))
    return "Lord Rama with bow meeting elephant on jungle path, searching for Sita";
  return "Lord Rama blue skin yellow dhoti bow in dense forest, Ramayana epic";
}

function tajSubject(mood: string): string {
  if (/fight|action|angry/.test(mood.toLowerCase()))
    return "colonial Mumbai hotel door confrontation, British guard and Indian industrialist, historical drama";
  return "colonial Mumbai grand hotel entrance, Jamsetji at closed door, historical cinematic still";
}

function modernSubject(input: CinematicPromptInput): string {
  const mood = (input.mood || "dialogue").toLowerCase();
  const names =
    input.characterNames?.filter(Boolean).slice(0, 2).join(" and ") ||
    "young Indian man and woman";
  const scene =
    (input.sceneTitle || input.visualPrompt || input.title || "story moment")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);

  const moodLook: Record<string, string> = {
    romance: "soft light romantic couple, tender expression",
    emotional: "emotional close-up, rain or soft dusk light",
    dramatic: "high drama, strong contrast, intense atmosphere",
    fight: "tense confrontation, firm stance, street or corridor",
    action: "dynamic action pose, motion energy",
    dialogue: "two characters facing each other, clear faces",
    gesture: "expressive gesture, body language film still",
  };
  const look = moodLook[mood] || "cinematic film still";
  return `${names}, ${scene}, ${look}`;
}

/** Ranked short search queries for free image APIs */
export function buildCinematicQueries(input: CinematicPromptInput): string[] {
  const blob = [
    input.title,
    input.sceneTitle,
    input.visualPrompt,
    input.narration,
    input.dialogue,
  ]
    .filter(Boolean)
    .join(" ");

  const out: string[] = [];

  if (isRamayana(blob)) {
    out.push(ramayanaSubject(input.mood, blob));
    out.push("Ramayana epic illustration forest cinematic");
  } else if (isTaj(blob)) {
    out.push(tajSubject(input.mood));
    out.push("colonial Mumbai historical cinematic still");
  } else {
    out.push(modernSubject(input));
    const mood = (input.mood || "").toLowerCase();
    if (mood === "romance") out.push("romantic monsoon India couple soft light");
    if (mood === "fight" || mood === "action")
      out.push("cinematic confrontation India street");
    if (mood === "emotional") out.push("emotional portrait India film still");
  }

  const uniq: string[] = [];
  for (const q of out) {
    const t = q.trim().slice(0, 100);
    if (t && !uniq.includes(t)) uniq.push(t);
  }
  return uniq.slice(0, 5);
}

/**
 * Full generation prompt — ONE universe, no cast bio dump, no motion spam.
 */
export function buildGenerationPrompt(input: CinematicPromptInput): string {
  const blob = [
    input.title,
    input.sceneTitle,
    input.visualPrompt,
    input.narration,
    input.dialogue,
  ]
    .filter(Boolean)
    .join(" ");

  let subject: string;
  if (isRamayana(blob)) {
    subject = ramayanaSubject(input.mood, blob);
  } else if (isTaj(blob)) {
    subject = tajSubject(input.mood);
  } else {
    subject = modernSubject(input);
  }

  return `${subject}. ${STYLE_TAIL}`;
}
