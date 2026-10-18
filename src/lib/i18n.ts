import type { Language } from "./types";

const STR = {
  en: {
    appTagline: "Avatar Movie Studio · ₹0 focus",
    createNew: "Create New Movie",
    yourMovies: "Your Movies",
    noMovies: "No movies yet",
    noMoviesHint: "Start with a story that has characters, fights or romance",
    editMovie: "Edit movie",
    produce: "Produce",
    honestTitle: "Honest zero-cost mode",
    honestBody:
      "Create characters, fight scenes, romance gestures and full story plans for free. High-quality long video needs free-tier or self-hosted compute and is not unlimited.",
    newMovie: "New Avatar Movie",
    newMovieSub: "Characters · Fight · Romance",
    language: "Language",
    duration: "Target Duration",
    sec10: "10 seconds",
    min5: "5 minutes",
    min10: "10 minutes",
    styles: "Scene styles you want",
    titleOpt: "Title (optional)",
    storyIdea: "Story idea or script",
    createProject: "Create Movie Project",
    oneClick: "One-click: Script → Produce",
    oneClickHint:
      "Writes script + scenes, then opens the production pipeline.",
    creating: "Creating…",
    generating: "Writing script…",
  },
  hi: {
    appTagline: "अवतार मूवी स्टूडियो · ₹0 फोकस",
    createNew: "नई मूवी बनाएँ",
    yourMovies: "आपकी मूवीज़",
    noMovies: "अभी कोई मूवी नहीं",
    noMoviesHint: "किरदार, लड़ाई या रोमांस वाली कहानी से शुरू करें",
    editMovie: "एडिट करें",
    produce: "प्रोड्यूस",
    honestTitle: "ईमानदार ज़ीरो-कॉस्ट मोड",
    honestBody:
      "किरदार, फाइट सीन, रोमांस जेस्चर और पूरी कहानी मुफ़्त बनाएँ। लंबी हाई-क्वालिटी वीडियो के लिए फ्री-टियर या अपना कंप्यूट चाहिए — यह असीमित नहीं है।",
    newMovie: "नई अवतार मूवी",
    newMovieSub: "किरदार · फाइट · रोमांस",
    language: "भाषा",
    duration: "अवधि",
    sec10: "10 सेकंड",
    min5: "5 मिनट",
    min10: "10 मिनट",
    styles: "सीन स्टाइल",
    titleOpt: "शीर्षक (वैकल्पिक)",
    storyIdea: "कहानी या स्क्रिप्ट",
    createProject: "प्रोजेक्ट बनाएँ",
    oneClick: "वन-क्लिक: स्क्रिप्ट → प्रोड्यूस",
    oneClickHint: "स्क्रिप्ट और सीन लिखकर प्रोडक्शन पाइपलाइन खोलेगा।",
    creating: "बना रहे हैं…",
    generating: "स्क्रिप्ट लिख रहे हैं…",
  },
} as const;

export type UiKey = keyof (typeof STR)["en"];

export function t(lang: Language, key: UiKey): string {
  return STR[lang][key] ?? STR.en[key];
}
