import { describe, it, expect } from "vitest";
import { buildAttemptSnapshot, gradeAttempt, normalizeScore } from "../quiz.service";

/**
 * Regression test for the shuffle/grading mismatch bug:
 * student answers the option that DISPLAYS as correct → score must be 100,
 * even when both question order and option order are shuffled.
 */
describe("snapshot grading consistency (regression: skor 30 bug)", () => {
  const masterQuestions = [
    { id: "q1", text: "Soal 1", options: ["A1", "B1", "C1", "D1"], correctIndex: 0, points: 1 },
    { id: "q2", text: "Soal 2", options: ["A2", "B2", "C2", "D2"], correctIndex: 2, points: 1 },
    { id: "q3", text: "Soal 3", options: ["A3", "B3", "C3", "D3"], correctIndex: 3, points: 1 },
    { id: "q4", text: "Soal 4", options: ["A4", "B4", "C4", "D4"], correctIndex: 1, points: 1 },
    { id: "q5", text: "Soal 5", options: ["A5", "B5", "C5", "D5"], correctIndex: 2, points: 1 },
  ];

  it("100 soal dijawab semua benar sesuai tampilan → skor 100 (berbagai seed acak)", () => {
    for (let trial = 0; trial < 50; trial++) {
      const snapshot = buildAttemptSnapshot(masterQuestions, true, true);

      // Student picks, for each displayed question, the option that is correct
      // in the DISPLAY order (simulating a perfect student).
      const answers = snapshot.map((q) => ({
        questionId: q.id,
        selectedIndex: q.correctIndex as number,
      }));

      const { score, totalPoints, perQuestion } = gradeAttempt(
        snapshot.map((q) => ({ id: q.id, correctIndex: q.correctIndex, points: q.points })),
        answers
      );

      expect(perQuestion.every((p) => p.isCorrect)).toBe(true);
      expect(normalizeScore(score, totalPoints)).toBe(100);
    }
  });

  it("snapshot memetakan ulang kunci jawaban ke urutan tampil", () => {
    const snapshot = buildAttemptSnapshot(masterQuestions, false, true);
    for (const q of snapshot) {
      const master = masterQuestions.find((m) => m.id === q.id)!;
      // The displayed option at the mapped correct index must equal the
      // master's correct option text.
      expect(q.options[q.correctIndex as number]).toBe(master.options[master.correctIndex]);
    }
  });

  it("tanpa shuffle, snapshot identik dengan soal master", () => {
    const snapshot = buildAttemptSnapshot(masterQuestions, false, false);
    expect(snapshot.map((q) => q.id)).toEqual(masterQuestions.map((q) => q.id));
    for (const q of snapshot) {
      const master = masterQuestions.find((m) => m.id === q.id)!;
      expect(q.options).toEqual(master.options);
      expect(q.correctIndex).toBe(master.correctIndex);
    }
  });
});
