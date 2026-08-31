import { AiContentType } from "@prisma/client";
import { CanonicalPlaceholderDefinition } from "./template.types";

export const CANONICAL_PLACEHOLDER_REGISTRY: Record<string, CanonicalPlaceholderDefinition> = {
  JUDUL: {
    tag: "JUDUL",
    description: "Judul materi atau dokumen draf",
    supportedContentTypes: ["LESSON_PLAN", "LEARNING_MATERIAL", "TASK_INSTRUCTION", "RUBRIC"],
    isContentBearing: false,
    isValueRequiredAtExport: true,
  },
  NAMA_SEKOLAH: {
    tag: "NAMA_SEKOLAH",
    description: "Nama sekolah / institusi",
    supportedContentTypes: ["LESSON_PLAN", "LEARNING_MATERIAL", "TASK_INSTRUCTION", "RUBRIC"],
    isContentBearing: false,
    isValueRequiredAtExport: false,
  },
  MATA_PELAJARAN: {
    tag: "MATA_PELAJARAN",
    description: "Nama mata pelajaran",
    supportedContentTypes: ["LESSON_PLAN", "LEARNING_MATERIAL", "TASK_INSTRUCTION", "RUBRIC"],
    isContentBearing: false,
    isValueRequiredAtExport: false,
  },
  GURU: {
    tag: "GURU",
    description: "Nama lengkap guru pengampu",
    supportedContentTypes: ["LESSON_PLAN", "LEARNING_MATERIAL", "TASK_INSTRUCTION", "RUBRIC"],
    isContentBearing: false,
    isValueRequiredAtExport: false,
  },
  KELAS: {
    tag: "KELAS",
    description: "Nama rombongan belajar / kelas",
    supportedContentTypes: ["LESSON_PLAN", "LEARNING_MATERIAL", "TASK_INSTRUCTION", "RUBRIC"],
    isContentBearing: false,
    isValueRequiredAtExport: false,
  },
  TANGGAL: {
    tag: "TANGGAL",
    description: "Tanggal pembuatan / ekspor dokumen (format Indonesia)",
    supportedContentTypes: ["LESSON_PLAN", "LEARNING_MATERIAL", "TASK_INSTRUCTION", "RUBRIC"],
    isContentBearing: false,
    isValueRequiredAtExport: false,
  },
  TUJUAN_PEMBELAJARAN: {
    tag: "TUJUAN_PEMBELAJARAN",
    description: "Tujuan pembelajaran atau sasaran pembelajaran",
    supportedContentTypes: ["LESSON_PLAN", "LEARNING_MATERIAL"],
    isContentBearing: true,
    isValueRequiredAtExport: false,
    headingAliases: ["Tujuan Pembelajaran", "Tujuan"],
  },
  RINGKASAN: {
    tag: "RINGKASAN",
    description: "Ringkasan materi atau kesimpulan",
    supportedContentTypes: ["LEARNING_MATERIAL"],
    isContentBearing: true,
    isValueRequiredAtExport: false,
    headingAliases: ["Kesimpulan", "Ringkasan", "Rangkuman"],
  },
  LANGKAH_PEMBELAJARAN: {
    tag: "LANGKAH_PEMBELAJARAN",
    description: "Kegiatan / langkah-langkah pembelajaran",
    supportedContentTypes: ["LESSON_PLAN"],
    isContentBearing: true,
    isValueRequiredAtExport: false,
    headingAliases: ["Kegiatan Pembelajaran", "Langkah-Langkah", "Aktivitas", "Langkah Pembelajaran"],
  },
  ISI_KONTEN: {
    tag: "ISI_KONTEN",
    description: "Seluruh isi materi utama / draf lengkap",
    supportedContentTypes: ["LESSON_PLAN", "LEARNING_MATERIAL", "TASK_INSTRUCTION", "RUBRIC"],
    isContentBearing: true,
    isValueRequiredAtExport: true,
  },
  SOAL_PILIHAN_GANDA: {
    tag: "SOAL_PILIHAN_GANDA",
    description: "Kumpulan butir soal pilihan ganda",
    supportedContentTypes: ["TASK_INSTRUCTION"],
    isContentBearing: true,
    isValueRequiredAtExport: false,
    headingAliases: ["Pilihan Ganda", "Soal Pilihan Ganda"],
  },
  SOAL_ESSAY: {
    tag: "SOAL_ESSAY",
    description: "Kumpulan butir soal uraian / essay",
    supportedContentTypes: ["TASK_INSTRUCTION"],
    isContentBearing: true,
    isValueRequiredAtExport: false,
    headingAliases: ["Soal Essay", "Soal Uraian", "Pertanyaan Uraian", "Uraian"],
  },
  KUNCI_JAWABAN: {
    tag: "KUNCI_JAWABAN",
    description: "Kunci jawaban atau pedoman jawaban",
    supportedContentTypes: ["TASK_INSTRUCTION"],
    isContentBearing: true,
    isValueRequiredAtExport: false,
    headingAliases: ["Kunci Jawaban", "Jawaban"],
  },
  RUBRIK_PENILAIAN: {
    tag: "RUBRIK_PENILAIAN",
    description: "Kriteria dan rubrik penilaian terstruktur",
    supportedContentTypes: ["RUBRIC"],
    isContentBearing: true,
    isValueRequiredAtExport: false,
    headingAliases: ["Rubrik Penilaian", "Rubrik"],
  },
};

export function isRecognizedTag(tag: string): boolean {
  return tag in CANONICAL_PLACEHOLDER_REGISTRY;
}

export function getCanonicalDefinition(tag: string): CanonicalPlaceholderDefinition | undefined {
  return CANONICAL_PLACEHOLDER_REGISTRY[tag];
}

export function getContentBearingTagsForType(contentType: AiContentType): string[] {
  return Object.values(CANONICAL_PLACEHOLDER_REGISTRY)
    .filter((def) => def.isContentBearing && def.supportedContentTypes.includes(contentType))
    .map((def) => def.tag);
}
