import { describe, it, expect } from "vitest";
import {
  validateSubmissionInput,
  validateReviewInput,
  isSubmissionLate,
  isValidHttpUrl,
} from "../../assignments/submission.service";

describe("Story 8 — validateSubmissionInput (matriks validasi)", () => {
  it("HAPPY: teks saja → ok", () => {
    expect(validateSubmissionInput({ textContent: " Jawaban saya " })).toEqual({
      ok: true,
      textContent: "Jawaban saya",
      linkUrl: null,
    });
  });

  it("HAPPY: tautan saja → ok", () => {
    expect(validateSubmissionInput({ linkUrl: "https://drive.google.com/file" })).toEqual({
      ok: true,
      textContent: null,
      linkUrl: "https://drive.google.com/file",
    });
  });

  it("HAPPY: teks + tautan → ok keduanya terisi", () => {
    const res = validateSubmissionInput({ textContent: "lihat lampiran", linkUrl: "http://contoh.id" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.textContent).toBe("lihat lampiran");
      expect(res.linkUrl).toBe("http://contoh.id");
    }
  });

  it("Submit kosong: teks & tautan kosong/space → ditolak", () => {
    expect(validateSubmissionInput({}).ok).toBe(false);
    expect(validateSubmissionInput({ textContent: "   ", linkUrl: " " }).ok).toBe(false);
    expect(validateSubmissionInput({ textContent: "", linkUrl: "" }).ok).toBe(false);
  });

  it("Link invalid: bukan URL http(s) → ditolak", () => {
    expect(validateSubmissionInput({ linkUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateSubmissionInput({ linkUrl: "data:text/html,x" }).ok).toBe(false);
    expect(validateSubmissionInput({ linkUrl: "ftp://file.id" }).ok).toBe(false);
    expect(validateSubmissionInput({ linkUrl: "bukan-url" }).ok).toBe(false);
  });

  it("Teks > 10.000 karakter → ditolak", () => {
    expect(validateSubmissionInput({ textContent: "a".repeat(10_001) }).ok).toBe(false);
    expect(validateSubmissionInput({ textContent: "a".repeat(10_000) }).ok).toBe(true);
  });

  it("Tautan > 2.048 karakter → ditolak", () => {
    const longUrl = `https://x.id/${"a".repeat(2_100)}`;
    expect(validateSubmissionInput({ linkUrl: longUrl }).ok).toBe(false);
    expect(
      validateSubmissionInput({ linkUrl: `https://x.id/${"a".repeat(2_000)}` }).ok
    ).toBe(true);
  });

  it("isValidHttpUrl murni", () => {
    expect(isValidHttpUrl("https://x.id")).toBe(true);
    expect(isValidHttpUrl("http://x.id")).toBe(true);
    expect(isValidHttpUrl("file:///etc/passwd")).toBe(false);
  });
});

describe("Story 8 — validateReviewInput (feedback wajib, skor opsional)", () => {
  it("HAPPY: feedback tanpa skor → ok, score null", () => {
    expect(validateReviewInput({ feedback: " Bagus! " })).toEqual({
      ok: true,
      feedback: "Bagus!",
      score: null,
    });
  });

  it("HAPPY: feedback + skor 0–100 → ok", () => {
    expect(validateReviewInput({ feedback: "Bagus", score: 87 })).toEqual({
      ok: true,
      feedback: "Bagus",
      score: 87,
    });
    expect(validateReviewInput({ feedback: "Nol", score: 0 }).ok).toBe(true);
    expect(validateReviewInput({ feedback: "Penuh", score: 100 }).ok).toBe(true);
  });

  it("Feedback kosong → ditolak", () => {
    expect(validateReviewInput({ feedback: "" }).ok).toBe(false);
    expect(validateReviewInput({ feedback: "   " }).ok).toBe(false);
    expect(validateReviewInput({}).ok).toBe(false);
  });

  it("Skor di luar 0–100 / bukan integer → ditolak", () => {
    expect(validateReviewInput({ feedback: "x", score: 101 }).ok).toBe(false);
    expect(validateReviewInput({ feedback: "x", score: -1 }).ok).toBe(false);
    expect(validateReviewInput({ feedback: "x", score: 85.5 }).ok).toBe(false);
  });

  it("Feedback > 4.000 karakter → ditolak", () => {
    expect(validateReviewInput({ feedback: "a".repeat(4_001) }).ok).toBe(false);
  });
});

describe("Story 8 — isSubmissionLate (computed)", () => {
  const due = new Date("2026-09-20T23:59:00Z");

  it("submittedAt > dueDate → terlambat", () => {
    expect(isSubmissionLate(new Date("2026-09-21T00:00:00Z"), due)).toBe(true);
  });

  it("submittedAt <= dueDate → tepat waktu", () => {
    expect(isSubmissionLate(new Date("2026-09-20T23:59:00Z"), due)).toBe(false);
    expect(isSubmissionLate(new Date("2026-09-20T10:00:00Z"), due)).toBe(false);
  });

  it("Tanpa dueDate → tidak pernah terlambat", () => {
    expect(isSubmissionLate(new Date("2030-01-01T00:00:00Z"), null)).toBe(false);
    expect(isSubmissionLate(new Date("2030-01-01T00:00:00Z"), undefined)).toBe(false);
  });
});
describe("Story 1 — validateSubmissionInput dengan kanal file", () => {
  const fileA = {
    storageKey: "submissions/tmp/0e5e1e96-9bd6-4a8e-a108-4b0e7dd41111.jpg",
    name: "jawaban.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 2048,
  };

  it("HAPPY: file saja → ok (tanpa teks/link)", () => {
    const res = validateSubmissionInput({ files: [fileA] });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.textContent).toBeNull();
      expect(res.linkUrl).toBeNull();
      expect(res.files).toHaveLength(1);
      expect(res.files?.[0].name).toBe("jawaban.jpg");
    }
  });

  it("files undefined + kosong semua → error menyebut file", () => {
    const res = validateSubmissionInput({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("file");
  });

  it("files: [] + kosong semua → error (set kosong bukan jawaban)", () => {
    expect(validateSubmissionInput({ files: [] }).ok).toBe(false);
  });

  it("file terblokir di daftar → error blocklist", () => {
    const res = validateSubmissionInput({
      files: [{ ...fileA, name: "makro.docm", mimeType: "application/msword" }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("docm");
  });

  it("lebih dari 5 file → error jumlah", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      ...fileA,
      name: `f${i}.jpg`,
    }));
    const res = validateSubmissionInput({ files: many });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("5 file");
  });

  it("file kebesaran (>25MB) → error ukuran", () => {
    const res = validateSubmissionInput({
      files: [{ ...fileA, sizeBytes: 26 * 1024 * 1024 }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("25 MB");
  });

  it("teks + file bersamaan → ok keduanya", () => {
    const res = validateSubmissionInput({ textContent: "lihat foto", files: [fileA] });
    expect(res.ok).toBe(true);
  });

  it("perilaku lama tetap: files undefined tidak divalidasi list", () => {
    // Regresi Story 8 — input tanpa files tidak boleh rusak
    expect(validateSubmissionInput({ textContent: "x" }).ok).toBe(true);
  });
});
