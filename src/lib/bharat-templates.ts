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

/** Clean story seeds — one clear universe per template, no mixed casts */
export const BHARAT_TEMPLATES: BharatTemplate[] = [
  {
    id: "monsoon-promise",
    titleEn: "Monsoon Promise",
    titleHi: "मानसून का वादा",
    tagEn: "Romance",
    tagHi: "रोमांस",
    language: "hi",
    duration: "10sec",
    genres: ["romance", "drama"],
    ideaEn:
      "Heavy rain on temple steps. Arjun shares his umbrella with Meera, a stranger. One look, one smile, a quiet promise to meet again tomorrow. Soft Hindi, emotional close-ups.",
    ideaHi:
      "मंदिर की सीढ़ियों पर भारी बारिश। अर्जुन अनजानी मीरा के साथ छाता बाँटता है। एक नज़र, एक मुस्कान, कल फिर मिलने का कोमल वादा। नरम हिंदी, भावनात्मक क्लोज़-अप।",
  },
  {
    id: "street-honour",
    titleEn: "Street Honour",
    titleHi: "गलि का सम्मान",
    tagEn: "Action",
    tagHi: "एक्शन",
    language: "hi",
    duration: "10sec",
    genres: ["fight", "drama"],
    ideaEn:
      "Narrow lane at dusk. Vikram blocks Arjun's path. One hard line, one firm step forward. No long fight — just honour and resolve in a few seconds.",
    ideaHi:
      "शाम की तंग गली। विक्रम अर्जुन का रास्ता रोकता है। एक कड़ी लाइन, एक दृढ़ कदम आगे। लंबी लड़ाई नहीं — कुछ सेकंड में सम्मान और संकल्प।",
  },
  {
    id: "rama-forest",
    titleEn: "Rama in the Forest",
    titleHi: "वन में श्री राम",
    tagEn: "Mythology",
    tagHi: "पौराणिक",
    language: "hi",
    duration: "10sec",
    genres: ["mythology", "drama"],
    ideaEn:
      "Dense forest. Lord Rama in yellow dhoti with bow asks a great elephant if it has seen Sita. Calm, divine, cinematic — only Ramayana cast, no modern characters.",
    ideaHi:
      "घना वन। पीले धोती में धनुष लिए श्री राम एक विशाल हाथी से पूछते हैं — क्या तुमने सीता को देखा? शांत, दिव्य, सिनेमैटिक — केवल रामायण पात्र, कोई आधुनिक किरदार नहीं।",
  },
  {
    id: "taj-door",
    titleEn: "The Closed Door",
    titleHi: "बंद दरवाज़ा",
    tagEn: "Historical",
    tagHi: "ऐतिहासिक",
    language: "hi",
    duration: "10sec",
    genres: ["drama"],
    ideaEn:
      "Colonial Mumbai. A British guard stops Jamsetji at a grand hotel door. One insult. One silent resolve. The spark that will build the Taj.",
    ideaHi:
      "औपनिवेशिक मुंबई। ब्रिटिश गार्ड जमशेदजी को होटल के भव्य द्वार पर रोकता है। एक अपमान। एक खामोश संकल्प। वही चिंगारी जिससे ताज बनेगा।",
  },
  {
    id: "last-train",
    titleEn: "Last Train",
    titleHi: "आखिरी ट्रेन",
    tagEn: "Drama",
    tagHi: "ड्रामा",
    language: "hi",
    duration: "10sec",
    genres: ["drama", "emotional"],
    ideaEn:
      "Crowded station platform. Meera must board the last train. Arjun reaches out — she turns, eyes full, one word goodbye. City lights, motion, heartbreak.",
    ideaHi:
      "भीड़ भरा प्लेटफ़ॉर्म। मीरा को आखिरी ट्रेन पकड़नी है। अर्जुन हाथ बढ़ाता है — वह मुड़ती है, आँखें भरी, एक शब्द अलविदा। शहर की रोशनी, गति, दिल टूटना।",
  },
  {
    id: "first-look",
    titleEn: "First Look",
    titleHi: "पहली नज़र",
    tagEn: "Romance",
    tagHi: "रोमांस",
    language: "hi",
    duration: "10sec",
    genres: ["romance"],
    ideaEn:
      "College corridor. Books spill. Arjun and Meera bend at the same time. Eyes meet. Soft smile. No dialogue needed — pure first-look energy.",
    ideaHi:
      "कॉलेज का गलियारा। किताबें गिरती हैं। अर्जुन और मीरा एक साथ झुकते हैं। नज़रें मिलती हैं। कोमल मुस्कान। संवाद की ज़रूरत नहीं — सिर्फ पहली नज़र।",
  },
];

export function templateById(id: string): BharatTemplate | undefined {
  return BHARAT_TEMPLATES.find((t) => t.id === id);
}
