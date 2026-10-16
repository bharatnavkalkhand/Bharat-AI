import type { Language, MovieDuration } from "./types";

export interface BharatTemplate {
  id: string;
  titleEn: string;
  titleHi: string;
  tagEn: string;
  tagHi: string;
  language: Language;
  duration: MovieDuration;
  genres: string[];
  ideaEn: string;
  ideaHi: string;
}

/** Curated desi story seeds — product moat vs generic editors */
export const BHARAT_TEMPLATES: BharatTemplate[] = [
  {
    id: "taj-honour",
    titleEn: "Taj & Honour",
    titleHi: "ताज और सम्मान",
    tagEn: "Historical",
    tagHi: "ऐतिहासिक",
    language: "hi",
    duration: "5min",
    genres: ["drama", "action"],
    ideaEn:
      "Colonial Mumbai. Jamsetji is stopped at a grand hotel door. A British guard refuses entry with a cruel insult. One humiliation becomes the fire that builds the Taj. Hindi dialogue, strong gesture scenes, dramatic confrontation.",
    ideaHi:
      "औपनिवेशिक मुंबई। जमशेदजी को एक बड़े होटल के दरवाज़े पर रोक दिया जाता है। ब्रिटिश गार्ड अपमानजनक शब्दों में प्रवेश मना करता है। एक अपमान से जन्म लेता है ताज का सपना। हिंदी संवाद, शक्तिशाली जेस्चर सीन, नाटकीय टकराव।",
  },
  {
    id: "rain-romance",
    titleEn: "Monsoon Steps",
    titleHi: "बारिश की सीढ़ियाँ",
    tagEn: "Romance",
    tagHi: "रोमांस",
    language: "hi",
    duration: "5min",
    genres: ["romance", "drama"],
    ideaEn:
      "Two strangers share an umbrella on temple steps in heavy rain. A quiet romance gesture, unspoken words, and a promise to meet again. Soft Hindi dialogue, emotional close-ups.",
    ideaHi:
      "भारी बारिश में मंदिर की सीढ़ियों पर दो अनजान एक छाते में छिपते हैं। धीमा रोमांस जेस्चर, अनकहे शब्द, और फिर मिलने का वादा। नरम हिंदी संवाद, भावनात्मक क्लोज़-अप।",
  },

];

export function templateById(id: string): BharatTemplate | undefined {
  return BHARAT_TEMPLATES.find((t) => t.id === id);
}
