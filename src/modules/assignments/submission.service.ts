/**
 * Story 8 (Gelombang 3) — service validasi & shaping submission tugas.
 * Murni tanpa DB: unit-testable, dipakai oleh action siswa & guru.
 */

export interface SubmissionInput {
  textContent?: string | null;
  linkUrl?: string | null;
}

export interface ReviewInput {
  feedback?: string | null;
  score?: number | null;
}

/** URL wajib absolut http(s) — menolak javascript:, data:, dsb. */
export function isValidHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type SubmissionValidation =
  | { ok: true; textContent: string | null; linkUrl: string | null }
  | { ok: false; error: string };

/**
 * Validasi input submit siswa: minimal salah satu dari teks/tautan terisi,
 * link wajib URL http(s) valid. Trim dilakukan di sini agar single source.
 */
export function validateSubmissionInput(input: SubmissionInput): SubmissionValidation {
  const textContent = (input.textContent ?? "").trim();
  const linkUrl = (input.linkUrl ?? "").trim();

  if (!textContent && !linkUrl) {
    return { ok: false, error: "Isi jawaban teks atau tautan terlebih dahulu." };
  }

  if (linkUrl && !isValidHttpUrl(linkUrl)) {
    return { ok: false, error: "Tautan tidak valid — gunakan alamat http(s) lengkap." };
  }

  if (linkUrl.length > 2_048) {
    return { ok: false, error: "Tautan terlalu panjang (maks. 2.048 karakter)." };
  }

  if (textContent.length > 10_000) {
    return { ok: false, error: "Jawaban teks terlalu panjang (maks. 10.000 karakter)." };
  }

  return { ok: true, textContent: textContent || null, linkUrl: linkUrl || null };
}

export type ReviewValidation =
  | { ok: true; feedback: string; score: number | null }
  | { ok: false; error: string };

/**
 * Validasi umpan balik guru: feedback wajib, skor opsional 0–100.
 */
export function validateReviewInput(input: ReviewInput): ReviewValidation {
  const feedback = (input.feedback ?? "").trim();

  if (!feedback) {
    return { ok: false, error: "Umpan balik wajib diisi." };
  }

  if (feedback.length > 4_000) {
    return { ok: false, error: "Umpan balik terlalu panjang (maks. 4.000 karakter)." };
  }

  let score: number | null = null;
  if (input.score !== null && input.score !== undefined && !Number.isNaN(Number(input.score))) {
    score = Number(input.score);
    if (!Number.isInteger(score) || score < 0 || score > 100) {
      return { ok: false, error: "Skor harus bilangan bulat 0–100 (opsional)." };
    }
  }

  return { ok: true, feedback, score };
}

/** Terlambat = computed: submittedAt > dueDate (tanpa kolom skema). */
export function isSubmissionLate(submittedAt: Date, dueDate?: Date | null): boolean {
  if (!dueDate) return false;
  return submittedAt.getTime() > dueDate.getTime();
}

/** Bentuk tampilan status submission untuk siswa (halaman Tugas & Mode Keluarga). */
export interface StudentSubmissionView {
  id: string;
  assignmentId: string;
  status: "SUBMITTED" | "REVIEWED";
  textContent: string | null;
  linkUrl: string | null;
  feedback: string | null;
  score: number | null;
  submittedAt: string; // ISO
  reviewedAt: string | null; // ISO
  isLate: boolean;
}

export interface TeacherQueueItem {
  id: string;
  studentId: string;
  studentName: string;
  nis: string | null;
  status: "SUBMITTED" | "REVIEWED";
  textContent: string | null;
  linkUrl: string | null;
  feedback: string | null;
  score: number | null;
  submittedAt: string; // ISO
  reviewedAt: string | null; // ISO
  isLate: boolean;
}
