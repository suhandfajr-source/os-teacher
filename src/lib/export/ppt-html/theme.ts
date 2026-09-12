/**
 * TEACHER OS — AI STUDIO EXPORT V3
 * Subject-Adaptive Visual Theme System
 *
 * Resolves a teaching subject into a full visual theme (palette, decoration
 * style, iconography) so generated slides automatically match the subject:
 * science slides feel scientific, math slides feel geometric, etc.
 */

export type DecorationStyle = "organic" | "geometry" | "script" | "atlas" | "classic";

export interface SubjectTheme {
  /** Stable theme id, e.g. "science" */
  id: string;
  /** Human label, e.g. "Sains" */
  label: string;
  /** Icon used in the subject badge */
  badgeIcon: string;

  // Palette (all hex without #)
  bg1: string; // darkest background base
  bg2: string; // mid gradient stop
  bg3: string; // bright gradient highlight
  accent: string; // accent text / highlight (light, readable on dark bg)
  accentSoft: string; // rgba accent for soft fills (template placeholder)
  inkOnCard: string; // heading color on white cards
  ink2OnCard: string; // body color on white cards

  decoration: DecorationStyle;
  /** Fallback emoji set for cards, in theme flavor */
  iconSet: string[];
}

const SCIENCE: SubjectTheme = {
  id: "science",
  label: "Sains",
  badgeIcon: "🔬",
  bg1: "022c22",
  bg2: "065f46",
  bg3: "10b981",
  accent: "34d399",
  accentSoft: "rgba(52, 211, 153, 0.16)",
  inkOnCard: "052e21",
  ink2OnCard: "3d6b5c",
  decoration: "organic",
  iconSet: ["🔬", "🌿", "🧪", "🌍", "⚡", "🧬"],
};

const MATH: SubjectTheme = {
  id: "math",
  label: "Matematika",
  badgeIcon: "📐",
  bg1: "1e1b4b",
  bg2: "3730a3",
  bg3: "6366f1",
  accent: "a5b4fc",
  accentSoft: "rgba(165, 180, 252, 0.16)",
  inkOnCard: "1e1b4b",
  ink2OnCard: "4b4b83",
  decoration: "geometry",
  iconSet: ["➕", "📏", "🧮", "📊", "🔺", "♾️"],
};

const LANGUAGE: SubjectTheme = {
  id: "language",
  label: "Bahasa & Sastra",
  badgeIcon: "📖",
  bg1: "431407",
  bg2: "9a3412",
  bg3: "f97316",
  accent: "fdba74",
  accentSoft: "rgba(253, 186, 116, 0.16)",
  inkOnCard: "431407",
  ink2OnCard: "8a5a44",
  decoration: "script",
  iconSet: ["✍️", "📚", "💬", "🎭", "📜", "💡"],
};

const SOCIAL: SubjectTheme = {
  id: "social",
  label: "Sosial & Humaniora",
  badgeIcon: "🌏",
  bg1: "083344",
  bg2: "0e7490",
  bg3: "22d3ee",
  accent: "67e8f9",
  accentSoft: "rgba(103, 232, 249, 0.16)",
  inkOnCard: "083344",
  ink2OnCard: "336b7a",
  decoration: "atlas",
  iconSet: ["🌏", "🏛️", "📊", "⚖️", "🗺️", "🤝"],
};

const ARTS: SubjectTheme = {
  id: "arts",
  label: "Seni & Praktik",
  badgeIcon: "🎨",
  bg1: "4a044e",
  bg2: "86198f",
  bg3: "d946ef",
  accent: "f0abfc",
  accentSoft: "rgba(240, 171, 252, 0.16)",
  inkOnCard: "4a044e",
  ink2OnCard: "7c4a80",
  decoration: "organic",
  iconSet: ["🎨", "🎵", "🎬", "🧵", "🍳", "✂️"],
};

const RELIGION: SubjectTheme = {
  id: "religion",
  label: "Agama",
  badgeIcon: "🕌",
  bg1: "0f172a",
  bg2: "134e4a",
  bg3: "0d9488",
  accent: "5eead4",
  accentSoft: "rgba(94, 234, 212, 0.16)",
  inkOnCard: "0f172a",
  ink2OnCard: "3d6161",
  decoration: "classic",
  iconSet: ["🕌", "📿", "🌙", "⭐", "🤲", "📖"],
};

const PHYSICAL: SubjectTheme = {
  id: "physical",
  label: "Olahraga & Kesehatan",
  badgeIcon: "⚽",
  bg1: "14532d",
  bg2: "166534",
  bg3: "84cc16",
  accent: "bef264",
  accentSoft: "rgba(190, 242, 100, 0.16)",
  inkOnCard: "14532d",
  ink2OnCard: "4a6b4e",
  decoration: "organic",
  iconSet: ["⚽", "🏃", "💪", "🥗", "❤️", "🏀"],
};

const GENERAL: SubjectTheme = {
  id: "general",
  label: "Umum",
  badgeIcon: "🎓",
  bg1: "0f172a",
  bg2: "1e3a8a",
  bg3: "3b82f6",
  accent: "93c5fd",
  accentSoft: "rgba(147, 197, 253, 0.16)",
  inkOnCard: "0f172a",
  ink2OnCard: "475569",
  decoration: "classic",
  iconSet: ["🎓", "📌", "⭐", "🧠", "📚", "✅"],
};

const THEME_RULES: Array<{ keywords: string[]; theme: SubjectTheme }> = [
  {
    keywords: ["ipa", "fisika", "kimia", "biologi", "sains", "science", "alam"],
    theme: SCIENCE,
  },
  {
    keywords: ["matematika", "math", "geometri", "aljabar", "statistika", "kalkulus", "aritmatika"],
    theme: MATH,
  },
  {
    keywords: [
      "bahasa",
      "indonesia",
      "inggris",
      "english",
      "sastra",
      "sunda",
      "jawa",
      "literasi",
      "anekdot",
      "puisi",
    ],
    theme: LANGUAGE,
  },
  {
    keywords: [
      "ips",
      "sejarah",
      "geografi",
      "ekonomi",
      "sosiologi",
      "antropologi",
      "pkn",
      "ppkn",
      "kewarganegaraan",
      "civics",
      "politik",
    ],
    theme: SOCIAL,
  },
  {
    keywords: ["seni", "budaya", "musik", "prakarya", "rpl", "informatika", "teknologi", "desain"],
    theme: ARTS,
  },
  {
    keywords: ["agama", "islam", "kitab", "qur'an", "al-qur'an", "kristen", "katolik", "hindu", "buddha", "akhlak"],
    theme: RELIGION,
  },
  {
    keywords: ["penjaskes", "olahraga", "pjok", "kesehatan", "kebugaran", "sport"],
    theme: PHYSICAL,
  },
];

/**
 * Resolves a subject name (e.g. "Matematika", "Bahasa Indonesia Kelas X")
 * into a matching visual theme. Falls back to a professional general theme.
 */
export function resolveSubjectTheme(subjectName?: string): SubjectTheme {
  if (!subjectName) return GENERAL;
  const normalized = subjectName.toLowerCase();

  for (const rule of THEME_RULES) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule.theme;
    }
  }
  return GENERAL;
}
