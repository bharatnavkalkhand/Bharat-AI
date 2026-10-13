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
  {
    id: "gully-fight",
    titleEn: "Gully Pride",
    titleHi: "गली का गुरूर",
    tagEn: "Fight",
    tagHi: "फाइट",
    language: "hi",
    duration: "5min",
    genres: ["action", "drama"],
    ideaEn:
      "A street football rivalry turns into a fight, then respect. Two young men from opposite ends of the gali. Action beats, dialogue after the clash, brotherhood ending.",
    ideaHi:
      "गली की फुटबॉल रंजिश लड़ाई में बदलती है, फिर सम्मान में। दो जवान, दो छोर। एक्शन बीट्स, झड़प के बाद संवाद, भाईचारे वाला अंत।",
  },
  {
    id: "train-letter",
    titleEn: "Letter on the Train",
    titleHi: "ट्रेन में चिट्ठी",
    tagEn: "Drama",
    tagHi: "ड्रामा",
    language: "hi",
    duration: "5min",
    genres: ["drama", "romance"],
    ideaEn:
      "A young woman finds an unfinished letter on a long-distance train to Varanasi. She meets the writer at a station chai stall. Gesture-heavy, poetic Hindi lines.",
    ideaHi:
      "वाराणसी जाती लंबी ट्रेन में एक अधूरी चिट्ठी मिलती है। स्टेशन की चाय की दुकान पर लेखक से मुलाकात। जेस्चर-भरपूर, काव्यात्मक हिंदी पंक्तियाँ।",
  },
  {
    id: "college-rival",
    titleEn: "Campus Clash",
    titleHi: "कैंपस टक्कर",
    tagEn: "Comedy",
    tagHi: "कॉमेडी",
    language: "en",
    duration: "5min",
    genres: ["comedy", "romance"],
    ideaEn:
      "College debate rivals forced to co-host a fest. Banter, a public argument, then a soft gesture backstage. Hinglish dialogue welcome.",
    ideaHi:
      "कॉलेज डिबेट के दुश्मन साथ में फेस्ट होस्ट करते हैं। तंज, सार्वजनिक बहस, फिर बैकस्टेज पर नरम जेस्चर। हिंग्लिश संवाद।",
  },
  {
    id: "border-lantern",
    titleEn: "Lantern at the Border",
    titleHi: "सरहद की लालटेन",
    tagEn: "Emotional",
    tagHi: "संवेदनशील",
    language: "hi",
    duration: "10min",
    genres: ["drama", "emotional"],
    ideaEn:
      "Partition memory told through one family and one lantern passed across a fence. Quiet fight of ideology, then an embrace. Strong historical emotion, Hindi narration.",
    ideaHi:
      "बँटवारे की याद — एक परिवार और बाड़ पार जाती एक लालटेन। विचारधारा की चुप लड़ाई, फिर गले मिलना। ऐतिहासिक भावना, हिंदी कथन।",
  },
];

export function templateById(id: string): BharatTemplate | undefined {
  return BHARAT_TEMPLATES.find((t) => t.id === id);
}
