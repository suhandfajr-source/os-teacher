import { describe, it, expect } from "vitest";
import {
  shuffleArray,
  generateUniquePins,
  generateClassroomPin,
  normalizePin,
  checkPinRateLimit,
  recordPinFailure,
  resetPinRateLimit,
  shuffleOptions,
  gradeAttempt,
  normalizeScore,
  generateShareToken,
  isAttemptExpired,
  buildAttemptSnapshot,
} from "../quiz.service";

describe("quiz.service", () => {
  describe("shuffleArray", () => {
    it("mempertahankan semua elemen", () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8];
      const output = shuffleArray(input);
      expect([...output].sort()).toEqual([...input].sort());
    });

    it("tidak mengubah array asli", () => {
      const input = [1, 2, 3];
      shuffleArray(input);
      expect(input).toEqual([1, 2, 3]);
    });
  });

  describe("shuffleOptions", () => {
    it("menjaga posisi jawaban benar konsisten dengan opsi baru", () => {
      const options = ["Jawa", "Sumatra", "Bali", "Kalimantan"];
      const { options: shuffled, correctIndex } = shuffleOptions(options, 2); // Bali benar
      expect(shuffled[correctIndex]).toBe("Bali");
    });
  });

  describe("gradeAttempt", () => {
    const questions = [
      { id: "q1", correctIndex: 0, points: 1 },
      { id: "q2", correctIndex: 2, points: 3 },
      { id: "q3", correctIndex: 1, points: 1 },
    ];

    it("mengoreksi jawaban benar/salah/tidak dijawab", () => {
      const { score, totalPoints, perQuestion } = gradeAttempt(questions, [
        { questionId: "q1", selectedIndex: 0 },
        { questionId: "q2", selectedIndex: 1 },
      ]);
      expect(score).toBe(1);
      expect(totalPoints).toBe(5);
      expect(perQuestion[0].isCorrect).toBe(true);
      expect(perQuestion[1].isCorrect).toBe(false);
      expect(perQuestion[2].isCorrect).toBe(false);
      expect(perQuestion[2].selectedIndex).toBeNull();
    });
  });

  describe("normalizeScore", () => {
    it("menormalkan ke skala 0-100", () => {
      expect(normalizeScore(4, 5)).toBe(80);
      expect(normalizeScore(0, 5)).toBe(0);
      expect(normalizeScore(5, 5)).toBe(100);
      expect(normalizeScore(3, 0)).toBe(0);
    });
  });

  describe("generateShareToken", () => {
    it("menghasilkan token panjang yang unik", () => {
      const a = generateShareToken();
      const b = generateShareToken();
      expect(a).toHaveLength(32);
      expect(a).not.toBe(b);
      expect(a).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe("isAttemptExpired", () => {
    it("false tanpa durasi", () => {
      expect(isAttemptExpired(new Date(Date.now() - 3_600_000), null)).toBe(false);
    });

    it("true saat waktu habis (dengan grace 60 detik)", () => {
      const started = new Date(Date.now() - 32 * 60_000);
      expect(isAttemptExpired(started, 30)).toBe(true);
    });

    it("false saat masih dalam masa pengerjaan", () => {
      const started = new Date(Date.now() - 10 * 60_000);
      expect(isAttemptExpired(started, 30)).toBe(false);
    });
  });
});

describe("PIN helpers", () => {
  it("generateUniquePins: jumlah & panjang benar, tidak ada duplikat", () => {
    const pins = generateUniquePins(50);
    expect(pins).toHaveLength(50);
    expect(new Set(pins).size).toBe(50);
    for (const pin of pins) expect(pin).toMatch(/^\d{4}$/);
  });

  it("generateUniquePins: tidak menabrak PIN yang sudah ada", () => {
    const existing = new Set(["0000", "0001", "0002"]);
    const pins = generateUniquePins(10, existing);
    for (const pin of pins) expect(existing.has(pin)).toBe(false);
  });

  it("normalizePin: memaafkan leading zero & karakter non-digit", () => {
    expect(normalizePin("007")).toBe("7");
    expect(normalizePin(" 7 ")).toBe("7");
    expect(normalizePin("PIN 1234")).toBe("1234");
    expect(normalizePin("abc")).toBe("");
  });

  describe("checkPinRateLimit & recordPinFailure", () => {
    it("mengizinkan 5 percobaan pertama dan memblokir pada percobaan ke-6", () => {
      const key = "test-student-rate-limit-1";
      resetPinRateLimit(key);

      for (let i = 0; i < 5; i++) {
        expect(checkPinRateLimit(key, 5).allowed).toBe(true);
        recordPinFailure(key, 60000);
      }

      const blocked = checkPinRateLimit(key, 5);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remainingSeconds).toBeGreaterThan(0);
      expect(blocked.remainingSeconds).toBeLessThanOrEqual(60);

      // reset restores allowed
      resetPinRateLimit(key);
      expect(checkPinRateLimit(key, 5).allowed).toBe(true);
    });
  });

  describe("generateClassroomPin & isAttemptExpired with deadline (Sprint 2)", () => {
    it("generateClassroomPin menghasilkan string 6 digit numerik", () => {
      for (let i = 0; i < 20; i++) {
        const pin = generateClassroomPin();
        expect(pin).toMatch(/^\d{6}$/);
        expect(Number(pin)).toBeGreaterThanOrEqual(100_000);
        expect(Number(pin)).toBeLessThanOrEqual(999_999);
      }
    });

    it("isAttemptExpired: kedaluwarsa jika melewati deadline global meskipun durasi pengerjaan belum habis", () => {
      // Started 5 mins ago, duration 60 mins (so normally 55 mins left)
      const started = new Date(Date.now() - 5 * 60_000);
      // But deadline was 2 minutes ago
      const deadline = new Date(Date.now() - 2 * 60_000);
      expect(isAttemptExpired(started, 60, deadline)).toBe(true);
    });

    it("isAttemptExpired: belum kedaluwarsa jika masih dalam jendela deadline dan durasi", () => {
      const started = new Date(Date.now() - 5 * 60_000);
      const deadline = new Date(Date.now() + 30 * 60_000);
      expect(isAttemptExpired(started, 60, deadline)).toBe(false);
    });
  });

  describe("Essay & Short Answer questions (Sprint 3)", () => {
    it("gradeAttempt: mengoreksi otomatis soal PG dan membiarkan soal esai pending review", () => {
      const questions = [
        { id: "mcq1", type: "MULTIPLE_CHOICE" as const, correctIndex: 1, points: 2 },
        { id: "mcq2", type: "MULTIPLE_CHOICE" as const, correctIndex: 0, points: 2 },
        { id: "essay1", type: "ESSAY" as const, correctIndex: null, points: 6 },
      ];

      const answers = [
        { questionId: "mcq1", selectedIndex: 1 }, // Correct (+2)
        { questionId: "mcq2", selectedIndex: 3 }, // Wrong (+0)
        { questionId: "essay1", essayAnswer: "Jawaban esai panjang siswa..." },
      ];

      const res = gradeAttempt(questions, answers);
      expect(res.hasEssays).toBe(true);
      expect(res.totalPoints).toBe(10); // 2 + 2 + 6
      expect(res.score).toBe(2); // Only mcq1 points
      expect(res.perQuestion[0].isCorrect).toBe(true);
      expect(res.perQuestion[0].pointsEarned).toBe(2);
      expect(res.perQuestion[1].isCorrect).toBe(false);
      expect(res.perQuestion[2].isCorrect).toBeNull(); // Pending review
      expect(res.perQuestion[2].essayAnswer).toBe("Jawaban esai panjang siswa...");
      expect(res.perQuestion[2].pointsEarned).toBe(0);
      expect(res.perQuestion[2].pointsMax).toBe(6);
    });

    it("buildAttemptSnapshot: mempertahankan tipe soal ESSAY dan tidak mengacak opsi kosong", () => {
      const questions = [
        { id: "q1", type: "ESSAY" as const, text: "Uraikan hikmah beriman...", options: [], correctIndex: null, points: 10, explanation: "Rubrik guru..." },
        { id: "q2", type: "MULTIPLE_CHOICE" as const, text: "Soal PG", options: ["A", "B"], correctIndex: 0, points: 1 },
      ];

      const snapshot = buildAttemptSnapshot(questions, false, true);
      expect(snapshot[0].type).toBe("ESSAY");
      expect(snapshot[0].options).toEqual([]);
      expect(snapshot[0].correctIndex).toBeNull();
      expect(snapshot[0].points).toBe(10);
      expect(snapshot[0].explanation).toBe("Rubrik guru...");
      expect(snapshot[1].type).toBe("MULTIPLE_CHOICE");
    });
  });
});
