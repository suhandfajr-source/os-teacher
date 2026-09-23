import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  isFinalScore,
  buildSubjectProgress,
  buildSubjectSummary,
  summarizeMonthlyAttendance,
  type AssessmentForProgress,
  type LearningObjectiveForProgress,
  type SubjectRawData,
  type AttendanceStatusLite,
} from "../student-progress.service";

// Tanggal ISO UTC tengah malam → deterministik di semua TZ server (grouping Jakarta = bulan sama)
const d = (day: number) => new Date(`2026-09-${String(day).padStart(2, "0")}T00:00:00Z`);

function assessment(partial: Partial<AssessmentForProgress> & { id: string }): AssessmentForProgress {
  return {
    title: partial.title ?? `Penilaian ${partial.id}`,
    assessmentTypeId: "type-1",
    assessmentTypeName: "Ulangan Harian",
    assessmentStatus: "COMPLETED",
    assessmentDate: partial.assessmentDate ?? d(10),
    maxScore: 100,
    minimumPassingScore: 70,
    resultStatus: "GRADED",
    finalScore: 80,
    remedialScores: [],
    learningObjectiveIds: [],
    ...partial,
  };
}

function lo(id: string, extra: Partial<LearningObjectiveForProgress> = {}): LearningObjectiveForProgress {
  return {
    id,
    code: `TP-${id}`,
    description: `Deskripsi ${id}`,
    orderIndex: 0,
    status: "ACTIVE",
    fallbackCode: `SNAP-${id}`,
    fallbackDescription: `Snapshot ${id}`,
    ...extra,
  };
}

function raw(partial: Partial<SubjectRawData> = {}): SubjectRawData {
  return {
    teachingContextId: "tc-1",
    subjectName: "Biologi",
    teacherName: "Bu Guru",
    policyActive: false,
    policyItems: [],
    assessments: [],
    learningObjectives: [],
    ...partial,
  };
}

describe("isFinalScore — definisi FINAL kanonik (glossary)", () => {
  it("FINAL = COMPLETED + GRADED + skor non-null", () => {
    expect(
      isFinalScore({ assessmentStatus: "COMPLETED", resultStatus: "GRADED", finalScore: 80 })
    ).toBe(true);
  });

  it("GRADED pada assessment IN_PROGRESS BUKAN final (join ganda wajib)", () => {
    expect(
      isFinalScore({ assessmentStatus: "IN_PROGRESS", resultStatus: "GRADED", finalScore: 80 })
    ).toBe(false);
    expect(
      isFinalScore({ assessmentStatus: "DRAFT", resultStatus: "GRADED", finalScore: 80 })
    ).toBe(false);
  });

  it("COMPLETED tapi result PENDING/ABSENT/EXCUSED/null-score bukan final", () => {
    for (const resultStatus of ["PENDING", "ABSENT", "EXCUSED"] as const) {
      expect(
        isFinalScore({ assessmentStatus: "COMPLETED", resultStatus, finalScore: 75 })
      ).toBe(false);
    }
    expect(
      isFinalScore({ assessmentStatus: "COMPLETED", resultStatus: "GRADED", finalScore: null })
    ).toBe(false);
  });
});

describe("buildSubjectProgress — pohon ketuntasan TP (proporsi KKTP)", () => {
  it("HAPPY: proporsi x dari y tuntas per TP + status TUNTAS bila semua tuntas", () => {
    const data = raw({
      assessments: [
        assessment({ id: "a1", finalScore: 80, minimumPassingScore: 70, learningObjectiveIds: ["tp1"], assessmentDate: d(1) }),
        assessment({ id: "a2", finalScore: 60, minimumPassingScore: 55, learningObjectiveIds: ["tp1"], assessmentDate: d(2) }),
        // tp2: satu tuntas satu tidak
        assessment({ id: "a3", finalScore: 65, minimumPassingScore: 70, learningObjectiveIds: ["tp2"], assessmentDate: d(3) }),
      ],
      learningObjectives: [lo("tp1", { orderIndex: 1 }), lo("tp2", { orderIndex: 2 })],
    });
    const result = buildSubjectProgress(data);

    const tp1 = result.tpTree.find((t) => t.learningObjectiveId === "tp1")!;
    expect(tp1.status).toBe("TUNTAS");
    expect(tp1.assessedCount).toBe(2);
    expect(tp1.masteredCount).toBe(2);
    expect(tp1.averageScore).toBe(70); // (80+60)/2

    const tp2 = result.tpTree.find((t) => t.learningObjectiveId === "tp2")!;
    expect(tp2.status).toBe("BELUM_TUNTAS");
    expect(tp2.masteredCount).toBe(0);
  });

  it("NON-FINAL tidak bocor: GRADED pada assessment IN_PROGRESS dikecualikan dari semua agregasi", () => {
    const data = raw({
      assessments: [
        assessment({ id: "final", finalScore: 90, learningObjectiveIds: ["tp1"] }),
        assessment({ id: "bocor", assessmentStatus: "IN_PROGRESS", finalScore: 100, learningObjectiveIds: ["tp1"], assessmentDate: d(5) }),
        assessment({ id: "nullscore", finalScore: null, learningObjectiveIds: ["tp1"], assessmentDate: d(6) }),
        assessment({ id: "absen", resultStatus: "ABSENT", finalScore: null, learningObjectiveIds: ["tp1"], assessmentDate: d(7) }),
      ],
      learningObjectives: [lo("tp1")],
    });
    const result = buildSubjectProgress(data);

    expect(result.finalCount).toBe(1);
    expect(result.trend.map((t) => t.assessmentId)).toEqual(["final"]);
    expect(result.flatAverage).toBe(90); // bukan rata-rata termasuk 100/0

    const tp1 = result.tpTree[0];
    expect(tp1.assessedCount).toBe(1);
    expect(tp1.masteredCount).toBe(1);
    expect(tp1.averageScore).toBe(90);
  });

  it("TP tanpa penilaian FINAL → BELUM_DINILAI, bukan 0%", () => {
    const result = buildSubjectProgress(raw({ learningObjectives: [lo("tp-kosong")] }));
    const tp = result.tpTree[0];
    expect(tp.status).toBe("BELUM_DINILAI");
    expect(tp.assessedCount).toBe(0);
    expect(tp.averageScore).toBeNull();
    expect(result.finalCount).toBe(0);
    expect(result.flatAverage).toBeNull();
  });

  it("Penilaian tanpa KKTP: menyumbang skor/tren, dikecualikan dari proporsi ketuntasan", () => {
    const data = raw({
      assessments: [
        assessment({ id: "tanpa-kktp", minimumPassingScore: null, finalScore: 88, learningObjectiveIds: ["tp1"] }),
      ],
      learningObjectives: [lo("tp1")],
    });
    const result = buildSubjectProgress(data);
    const tp1 = result.tpTree[0];

    expect(tp1.status).toBe("TANPA_KKTP");
    expect(tp1.assessedCount).toBe(0);
    expect(tp1.averageScore).toBe(88); // tetap menyumbang skor
    expect(result.finalCount).toBe(1);
    expect(result.flatAverage).toBe(88);
  });

  it("Snapshot fallback dipakai saat LO non-ACTIVE (ARCHIVED)", () => {
    const data = raw({
      assessments: [assessment({ id: "a1", learningObjectiveIds: ["tp1"] })],
      learningObjectives: [lo("tp1", { status: "ARCHIVED" })],
    });
    const tp1 = buildSubjectProgress(data).tpTree[0];
    expect(tp1.code).toBe("SNAP-tp1");
    expect(tp1.description).toBe("Snapshot tp1");
  });

  it("Remedial hanya info tambahan — tidak mengubah skor/ketuntasan", () => {
    const data = raw({
      assessments: [
        assessment({ id: "a1", finalScore: 50, minimumPassingScore: 70, remedialScores: [85, 90], learningObjectiveIds: ["tp1"] }),
      ],
      learningObjectives: [lo("tp1")],
    });
    const tp1 = buildSubjectProgress(data).tpTree[0];
    expect(tp1.status).toBe("BELUM_TUNTAS"); // remedial TIDAK menaikkan
    expect(tp1.remedialCount).toBe(2);
    expect(tp1.averageScore).toBe(50);
  });

  it("Tren terurut kronologis, latestScore dari penilaian terakhir, bar ternormalisasi maxScore", () => {
    const data = raw({
      assessments: [
        assessment({ id: "late", finalScore: 95, learningObjectiveIds: ["tp1"], assessmentDate: d(20) }),
        assessment({ id: "early", finalScore: 40, maxScore: 50, learningObjectiveIds: ["tp1"], assessmentDate: d(1) }),
      ],
      learningObjectives: [lo("tp1")],
    });
    const result = buildSubjectProgress(data);
    expect(result.trend.map((t) => t.assessmentId)).toEqual(["early", "late"]);
    expect(result.tpTree[0].latestScore).toBe(95);
    // Skala beda: 40/50 dan 95/100 sama-sama 80% & 95% — bar apple-to-apple
    expect(result.trend.map((t) => t.percent)).toEqual([80, 95]);
  });
});

describe("Nilai berjalan — reuse bobot GradePolicy vs fallback flat", () => {
  const policyItems = [
    { assessmentTypeId: "type-1", assessmentTypeName: "Ulangan Harian", category: "FORMATIVE", weight: new Prisma.Decimal(30) },
    { assessmentTypeId: "type-2", assessmentTypeName: "Tugas", category: "ASSIGNMENT", weight: new Prisma.Decimal(70) },
  ];

  it("Policy ACTIVE → nilai berbobot identik dengan calculateStudentRunningPerformance", () => {
    const data = raw({
      policyActive: true,
      policyItems,
      assessments: [
        assessment({ id: "u1", finalScore: 80, assessmentDate: d(1) }), // Ulangan 80
        assessment({ id: "t1", assessmentTypeId: "type-2", assessmentTypeName: "Tugas", finalScore: 90, assessmentDate: d(2) }), // Tugas 90
      ],
    });
    const result = buildSubjectProgress(data);
    // (80*30 + 90*70) / 100 = 87
    expect(result.scoringMode).toBe("WEIGHTED");
    expect(result.runningScore).toBe(87);
    expect(result.availableWeight).toBe(100);
  });

  it("Bobot parsial: hanya komponen ber-nilai yang dihitung (availableWeight < 100)", () => {
    const data = raw({
      policyActive: true,
      policyItems,
      assessments: [
        assessment({ id: "u1", finalScore: 80, assessmentDate: d(1) }), // hanya Ulangan terisi
      ],
    });
    const result = buildSubjectProgress(data);
    expect(result.scoringMode).toBe("WEIGHTED");
    expect(result.runningScore).toBe(80);
    expect(result.availableWeight).toBe(30);
  });

  it("Policy DRAFT/non-ACTIVE → fallback flat berlabel, bukan weighted", () => {
    const data = raw({
      policyActive: false,
      policyItems, // items ada tapi policy tidak ACTIVE
      assessments: [
        assessment({ id: "u1", finalScore: 80, assessmentDate: d(1) }),
        assessment({ id: "u2", finalScore: 90, assessmentDate: d(2) }),
      ],
    });
    const result = buildSubjectProgress(data);
    expect(result.scoringMode).toBe("FLAT_FALLBACK");
    expect(result.runningScore).toBe(85);
    expect(result.availableWeight).toBeNull();
  });

  it("Weighted tanpa nilai final apapun → runningScore null (bukan 0)", () => {
    const result = buildSubjectProgress(
      raw({ policyActive: true, policyItems, assessments: [assessment({ id: "p", resultStatus: "PENDING", finalScore: null })] })
    );
    expect(result.runningScore).toBeNull();
    expect(result.scoringMode).toBe("WEIGHTED");
  });
});

describe("buildSubjectSummary — widget beranda", () => {
  it("Mapel tanpa data FINAL → hasFinalData false, bukan skor 0", () => {
    const p = buildSubjectProgress(raw({ learningObjectives: [lo("tp1")] }));
    const s = buildSubjectSummary(p);
    expect(s.hasFinalData).toBe(false);
    expect(s.runningScore).toBeNull();
    expect(s.assessedTpCount).toBe(0);
  });

  it("Hitungan TP tuntas hanya mencakup TP ber-KKTP", () => {
    const p = buildSubjectProgress(
      raw({
        assessments: [
          assessment({ id: "a1", finalScore: 80, learningObjectiveIds: ["tp1"] }),
          assessment({ id: "a2", minimumPassingScore: null, finalScore: 88, learningObjectiveIds: ["tp2"] }),
        ],
        learningObjectives: [lo("tp1"), lo("tp2"), lo("tp3")],
      })
    );
    const s = buildSubjectSummary(p);
    expect(s.tuntasTpCount).toBe(1);
    expect(s.assessedTpCount).toBe(1); // tp2 TANPA_KKTP & tp3 BELUM_DINILAI dikecualikan
  });
});

describe("summarizeMonthlyAttendance — rekap H/S/I/A + LATE", () => {
  const mk = (status: AttendanceStatusLite, day: number) => ({ status, date: d(day) });

  it("LATE dihitung H + keterangan lateCount (keputusan terkunci #4)", () => {
    const recap = summarizeMonthlyAttendance(
      [
        mk("PRESENT", 1),
        mk("LATE", 2),
        mk("LATE", 3),
        mk("SICK", 4),
        mk("PERMISSION", 5),
        mk("ABSENT", 6),
      ],
      new Date("2026-09-30T00:00:00Z")
    );
    expect(recap).toHaveLength(1);
    expect(recap[0]).toMatchObject({ year: 2026, month: 9, hadir: 3, sakit: 1, izin: 1, alpa: 1, lateCount: 2 });
  });

  it("Tanpa record sama sekali → tidak ada baris rekap (UI menampilkan empty state)", () => {
    expect(summarizeMonthlyAttendance([], new Date("2026-09-30T00:00:00Z"))).toEqual([]);
  });

  it("Bulan tanpa record di antara record pertama s.d. bulan berjalan disintesis nol (matriks: rekap H/S/I/A = 0)", () => {
    const recap = summarizeMonthlyAttendance(
      [{ status: "PRESENT", date: new Date("2026-07-10T00:00:00Z") }], // record hanya Juli
      new Date("2026-09-30T00:00:00Z")
    );
    expect(recap.map((r) => r.month)).toEqual([9, 8, 7]); // terbaru dulu
    expect(recap[2]).toMatchObject({ month: 7, hadir: 1 });
    expect(recap[1]).toMatchObject({ month: 8, hadir: 0, sakit: 0, izin: 0, alpa: 0, lateCount: 0 });
    expect(recap[0]).toMatchObject({ month: 9, hadir: 0 });
  });

  it("Grouping bulan memakai zona Asia/Jakarta, bukan TZ server (batas bulan)", () => {
    // 31 Agu 18:30 UTC = 1 Sept 01:30 WIB → harus masuk bulan September
    const recap = summarizeMonthlyAttendance(
      [{ status: "PRESENT", date: new Date("2026-08-31T18:30:00Z") }],
      new Date("2026-09-05T00:00:00Z")
    );
    expect(recap).toHaveLength(1);
    expect(recap[0].month).toBe(9);
    expect(recap[0].hadir).toBe(1);
  });

  it("Rekap terpisah per bulan, terurut terbaru dulu", () => {
    const recap = summarizeMonthlyAttendance(
      [
        { status: "PRESENT", date: new Date("2026-08-10T00:00:00Z") }, // Agu
        { status: "SICK", date: new Date("2026-09-10T00:00:00Z") }, // Sep
      ],
      new Date("2026-09-30T00:00:00Z")
    );
    expect(recap.map((r) => r.month)).toEqual([9, 8]);
  });
});
