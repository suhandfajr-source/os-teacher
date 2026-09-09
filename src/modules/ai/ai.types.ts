import { z } from "zod";

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const AI_CONTENT_TYPES = [
  "LESSON_PLAN",
  "LEARNING_MATERIAL",
  "TASK_INSTRUCTION",
  "RUBRIC",
] as const;

export type AiContentType = (typeof AI_CONTENT_TYPES)[number];

export type AiStudioFlowType =
  | "LESSON_PLAN"
  | "ASSESSMENT_QUIZ"
  | "LKPD"
  | "PRESENTATION"
  | "LEARNING_MATERIAL"
  | "RUBRIC";

export interface FlowOptionMeta {
  id: AiStudioFlowType;
  parentContentType: AiContentType;
  title: string;
  subtitle: string;
  badge: string;
  recommendedExport: "docx" | "xlsx" | "pptx" | "pdf";
  iconName: "BookOpen" | "FileQuestion" | "CheckSquare" | "Presentation" | "FileText" | "Sliders";
}

export const AI_STUDIO_FLOWS: Record<AiStudioFlowType, FlowOptionMeta> = {
  LESSON_PLAN: {
    id: "LESSON_PLAN",
    parentContentType: "LESSON_PLAN",
    title: "Modul Ajar / RPP",
    subtitle: "Struktur lengkap CP, TP, model pembelajaran (PBL/PjBL), langkah kegiatan, dan alokasi waktu",
    badge: "Pedagogis Lengkap",
    recommendedExport: "docx",
    iconName: "BookOpen",
  },
  ASSESSMENT_QUIZ: {
    id: "ASSESSMENT_QUIZ",
    parentContentType: "TASK_INSTRUCTION",
    title: "Bank Soal & Kisi-Kisi",
    subtitle: "Distribusi Taksonomi Bloom (LOTS/HOTS), kuota PG/Essay, kunci jawaban, dan rubrik",
    badge: "Matriks Evaluasi",
    recommendedExport: "xlsx",
    iconName: "FileQuestion",
  },
  LKPD: {
    id: "LKPD",
    parentContentType: "TASK_INSTRUCTION",
    title: "LKPD (Lembar Kerja)",
    subtitle: "Aktivitas praktikum, studi kasus, stimulus fenomena, instruksi terstruktur, dan ruang isian siswa",
    badge: "Aktivitas Siswa",
    recommendedExport: "docx",
    iconName: "CheckSquare",
  },
  PRESENTATION: {
    id: "PRESENTATION",
    parentContentType: "LEARNING_MATERIAL",
    title: "Slide Presentasi",
    subtitle: "Struktur slide terurut, poin-poin visual ringkas, dan catatan penjelasan guru (Speaker Notes)",
    badge: "Media PPTX",
    recommendedExport: "pptx",
    iconName: "Presentation",
  },
  LEARNING_MATERIAL: {
    id: "LEARNING_MATERIAL",
    parentContentType: "LEARNING_MATERIAL",
    title: "Bahan Bacaan & Ringkasan",
    subtitle: "Materi diferensiasi level kesiapan belajar (Dasar/Pengayaan), konsep kunci, dan glosarium",
    badge: "Diferensiasi Belajar",
    recommendedExport: "docx",
    iconName: "FileText",
  },
  RUBRIC: {
    id: "RUBRIC",
    parentContentType: "RUBRIC",
    title: "Rubrik Penilaian",
    subtitle: "Kriteria deskriptif per level pencapaian (Perlu Bimbingan, Cukup, Cakap, Mahir)",
    badge: "Asesmen Autentik",
    recommendedExport: "docx",
    iconName: "Sliders",
  },
};

export const AI_DRAFT_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type AiDraftStatus = (typeof AI_DRAFT_STATUSES)[number];

export const CONTENT_TYPE_LABELS: Record<AiContentType, { title: string; subtitle: string }> = {
  LESSON_PLAN: {
    title: "Rencana Aktivitas Pembelajaran",
    subtitle: "Alur kegiatan pendahuluan, inti, penutup, dan estimasi durasi",
  },
  LEARNING_MATERIAL: {
    title: "Materi / Ringkasan Pembelajaran",
    subtitle: "Penjelasan ringkas, konsep kunci, analogi, dan rangkuman materi",
  },
  TASK_INSTRUCTION: {
    title: "Draft Instruksi Tugas",
    subtitle: "Tujuan tugas, petunjuk pengerjaan langkah-demi-langkah, dan kriteria hasil",
  },
  RUBRIC: {
    title: "Rubrik / Kriteria Sederhana",
    subtitle: "Kriteria penilaian kualitatif deskriptif per level pencapaian",
  },
};

// ============================================================================
// SAFE CONTEXT PACK TYPES
// ============================================================================

export interface RecentTopicItem {
  type: "SESSION" | "ASSIGNMENT";
  topic: string;
}

export interface SafeContextPack {
  subjectName: string;
  className: string;
  gradeLevel: string | null;
  academicPeriod: {
    year: string;
    semester: string;
  };
  // Explicitly opted-in historical session/assignment topics
  recentTopics?: RecentTopicItem[];
}

export interface VisibleContextSummary {
  subjectName?: string;
  className?: string;
  gradeLevel?: string | null;
  academicPeriod?: string;
  includedHistoricalTopics?: string[];
  isContextAware: boolean;
}

// ============================================================================
// PROVIDER INTERFACE TYPES
// ============================================================================

export interface AiProviderGenerateRequest {
  contentType: AiContentType;
  topic: string;
  instruction?: string;
  contextPack?: SafeContextPack;
  tone?: "CONCISE" | "STANDARD" | "DETAILED";
}

export interface AiProviderRefineRequest {
  contentType: AiContentType;
  currentTitle: string;
  currentContent: string;
  refinementInstruction: string;
  contextPack?: SafeContextPack;
}

export interface AiProviderResult {
  title: string;
  content: string;
  modelUsed: string;
}

// ============================================================================
// ZOD SCHEMAS FOR SERVER ACTIONS & VALIDATION
// ============================================================================

export const generateAiContentSchema = z.object({
  contentType: z.enum(AI_CONTENT_TYPES, {
    message: "Tipe konten pembelajaran tidak valid",
  }),
  topic: z
    .string()
    .min(2, "Topik pembelajaran minimal 2 karakter")
    .max(300, "Topik pembelajaran maksimal 300 karakter"),
  instruction: z
    .string()
    .max(10000, "Instruksi tambahan maksimal 10000 karakter")
    .optional(),
  teachingContextId: z.string().optional(),
  includeHistoricalTopics: z.boolean().optional().default(false),
  tone: z.enum(["CONCISE", "STANDARD", "DETAILED"]).optional().default("STANDARD"),
});

export type GenerateAiContentInput = z.infer<typeof generateAiContentSchema>;

export const refineAiContentSchema = z.object({
  contentType: z.enum(AI_CONTENT_TYPES),
  currentTitle: z
    .string()
    .min(1, "Judul draf tidak boleh kosong")
    .max(300, "Judul draf maksimal 300 karakter"),
  currentContent: z
    .string()
    .min(1, "Konten draf tidak boleh kosong")
    .max(15000, "Konten draf maksimal 15000 karakter"),
  refinementInstruction: z
    .string()
    .min(2, "Instruksi penyesuaian minimal 2 karakter")
    .max(2000, "Instruksi penyesuaian maksimal 2000 karakter"),
  teachingContextId: z.string().optional(),
});

export type RefineAiContentInput = z.infer<typeof refineAiContentSchema>;

export const saveAiDraftSchema = z.object({
  draftId: z.string().optional(), // If updating an existing active draft
  contentType: z.enum(AI_CONTENT_TYPES),
  title: z
    .string()
    .min(1, "Judul draft harus diisi")
    .max(200, "Judul draft maksimal 200 karakter"),
  topic: z
    .string()
    .min(1, "Topik harus diisi")
    .max(300, "Topik maksimal 300 karakter"),
  instruction: z.string().max(10000).optional(),
  content: z
    .string()
    .min(1, "Konten draft harus diisi")
    .max(20000, "Konten draft terlalu panjang"),
  teachingContextId: z.string().optional(),
});

export type SaveAiDraftInput = z.infer<typeof saveAiDraftSchema>;

export const archiveAiDraftSchema = z.object({
  draftId: z.string().min(1, "ID draft diperlukan"),
});

export type ArchiveAiDraftInput = z.infer<typeof archiveAiDraftSchema>;

export const aiDraftFilterSchema = z.object({
  status: z.enum(AI_DRAFT_STATUSES).optional().default("ACTIVE"),
  contentType: z.enum(AI_CONTENT_TYPES).optional(),
  teachingContextId: z.string().optional(),
  search: z.string().optional(),
});

export type AiDraftFilterInput = z.infer<typeof aiDraftFilterSchema>;

// Transient preview response returned to client after generate/refine
export interface TransientAiPreview {
  title: string;
  content: string;
  contentType: AiContentType;
  topic: string;
  instruction?: string;
  teachingContextId?: string;
  contextSummary: VisibleContextSummary;
  modelUsed: string;
  generatedAt: string;
}
