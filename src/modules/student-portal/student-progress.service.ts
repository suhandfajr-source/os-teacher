/**
 * Story 7 (CAP-9) — Service agregasi murni untuk Student Progress.
 * Tanpa akses DB: semua input berupa snapshot; unit-testable.
 *
 * Aturan mengikat (glossary.md + keputusan terkunci human 2026-09-23):
 * - Nilai FINAL kanonik = AssessmentResult.status === "GRADED" DAN
 *   parent Assessment.status === "COMPLETED" (join ganda, bukan filter satu sisi).
 * - Skor null / ABSENT / EXCUSED / PENDING dikecualikan — TIDAK pernah jadi 0.
 * - Nilai berjalan per mapel: reuse bobot GradePolicy (ACTIVE) via
 *   calculateStudentRunningPerformance(); fallback rata-rata flat berlabel.
 * - Pohon ketuntasan TP: proporsi KKTP per penilaian; penilaian tanpa KKTP
 *   hanya menyumbang skor/tren (dikecualikan dari proporsi).
 * - Presensi: LATE dihitung H (hadir) + keterangan jumlah telat.
 */
import {
  calculateStudentRunningPerformance,
  type PolicyItemSnapshot,
  type StudentScoreSnapshot,
} from "@/modules/assessment/assessment.service";

export type AssessmentStatusLite = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
export type ResultStatusLite = "PENDING" | "GRADED" | "ABSENT" | "EXCUSED";
export type AttendanceStatusLite = "PRESENT" | "SICK" | "PERMISSION" | "ABSENT" | "LATE";

export interface ScoredResultInput {
  assessmentStatus: AssessmentStatusLite;
  resultStatus: ResultStatusLite | null;
  finalScore: number | null;
}

/**
 * Nilai FINAL kanonik — keputusan ganda (glossary.md).
 * Wajib dipakai semua agregasi; memfilter AssessmentResult saja TIDAK cukup.
 */
export function isFinalScore(input: ScoredResultInput): boolean {
  return (
    input.assessmentStatus === "COMPLETED" &&
    input.resultStatus === "GRADED" &&
    input.finalScore !== null
  );
}

export interface AssessmentForProgress {
  id: string;
  title: string;
  assessmentTypeId: string;
  assessmentTypeName: string;
  assessmentStatus: AssessmentStatusLite;
  assessmentDate: Date;
  /** Skala maksimal penilaian (untuk normalisasi tren) */
  maxScore: number;
  /** KKTP per penilaian (Assessment.minimumPassingScore); null = tanpa KKTP */
  minimumPassingScore: number | null;
  /** Status AssessmentResult milik siswa ini; null = belum ada row result */
  resultStatus: ResultStatusLite | null;
  finalScore: number | null;
  remedialScores: number[];
  learningObjectiveIds: string[];
}

export interface LearningObjectiveForProgress {
  id: string;
  code: string | null;
  description: string;
  orderIndex: number;
  status: "ACTIVE" | "ARCHIVED";
  /** Snapshot fallback (AssessmentLearningObjective) saat LO non-ACTIVE */
  fallbackCode: string | null;
  fallbackDescription: string | null;
}

export interface SubjectRawData {
  teachingContextId: string;
  subjectName: string;
  teacherName: string | null;
  policyActive: boolean;
  policyItems: PolicyItemSnapshot[];
  assessments: AssessmentForProgress[];
  learningObjectives: LearningObjectiveForProgress[];
}

export type TpMasteryStatus = "TUNTAS" | "BELUM_TUNTAS" | "BELUM_DINILAI" | "TANPA_KKTP";

export interface TpMasteryItem {
  learningObjectiveId: string;
  code: string | null;
  description: string;
  status: TpMasteryStatus;
  /** y — jumlah penilaian FINAL ber-KKTP yang mengukur TP ini */
  assessedCount: number;
  /** x — jumlah penilaian ber-KKTP yang finalScore >= KKTP-nya */
  masteredCount: number;
  /** Rata-rata skor FINAL (info; bukan penentu ketuntasan) */
  averageScore: number | null;
  latestScore: number | null;
  latestScoreDate: string | null;
  remedialCount: number;
}

export interface TrendPoint {
  assessmentId: string;
  title: string;
  date: string;
  score: number;
  /** score / maxScore * 100 — tinggi bar tren lintas skala penilaian */
  percent: number;
}

export type ScoringMode = "WEIGHTED" | "FLAT_FALLBACK";

export interface SubjectProgress {
  teachingContextId: string;
  subjectName: string;
  teacherName: string | null;
  /** Nilai berjalan: berbobot (policy ACTIVE) atau fallback flat */
  runningScore: number | null;
  scoringMode: ScoringMode;
  availableWeight: number | null;
  flatAverage: number | null;
  finalCount: number;
  trend: TrendPoint[];
  tpTree: TpMasteryItem[];
}

export interface SubjectProgressSummary {
  teachingContextId: string;
  subjectName: string;
  runningScore: number | null;
  scoringMode: ScoringMode;
  tuntasTpCount: number;
  assessedTpCount: number;
  hasFinalData: boolean;
}

export interface AttendanceRecordLite {
  status: AttendanceStatusLite;
  date: Date;
}

export interface MonthlyAttendanceRecap {
  year: number;
  /** 1–12 */
  month: number;
  hadir: number;
  sakit: number;
  izin: number;
  alpa: number;
  /** Keterangan: hadir tapi telat (termasuk di `hadir`) */
  lateCount: number;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

/** Agregasi satu mapel: nilai berjalan + tren + pohon ketuntasan TP. */
export function buildSubjectProgress(raw: SubjectRawData): SubjectProgress {
  // FINAL-only (join ganda via isFinalScore); urut kronologis
  const finals = raw.assessments
    .filter((a) =>
      isFinalScore({
        assessmentStatus: a.assessmentStatus,
        resultStatus: a.resultStatus,
        finalScore: a.finalScore,
      })
    )
    .sort((a, b) => a.assessmentDate.getTime() - b.assessmentDate.getTime());

  const finalScores = finals.map((a) => a.finalScore as number);
  const flatAverage = mean(finalScores);

  let runningScore: number | null = null;
  let availableWeight: number | null = null;
  let scoringMode: ScoringMode = "FLAT_FALLBACK";

  if (raw.policyActive && raw.policyItems.length > 0) {
    // REUSE — jangan tulis ulang logika bobot; gating FINAL terjadi di dalamnya.
    const scoreSnapshots: StudentScoreSnapshot[] = raw.assessments.map((a) => ({
      assessmentId: a.id,
      assessmentTypeId: a.assessmentTypeId,
      assessmentTypeName: a.assessmentTypeName,
      assessmentStatus: a.assessmentStatus,
      resultStatus: a.resultStatus ?? "PENDING",
      finalScore: a.finalScore,
    }));
    const calc = calculateStudentRunningPerformance(
      { id: "student", fullName: "student", nis: null },
      raw.policyItems,
      scoreSnapshots
    );
    scoringMode = "WEIGHTED";
    runningScore = calc.runningPerformance !== null ? Number(calc.runningPerformance) : null;
    availableWeight = calc.availableWeight !== null ? Number(calc.availableWeight) : null;
  } else {
    // Fallback flat berlabel (keputusan terkunci #1)
    runningScore = flatAverage;
  }

  // Pohon ketuntasan TP — proporsi KKTP per penilaian (keputusan terkunci #2)
  const tpTree: TpMasteryItem[] = [...raw.learningObjectives]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((lo) => {
      const linkedFinals = finals.filter((a) => a.learningObjectiveIds.includes(lo.id));
      const withKktp = linkedFinals.filter((a) => a.minimumPassingScore !== null);
      const mastered = withKktp.filter((a) => (a.finalScore as number) >= (a.minimumPassingScore as number));
      const remedialCount = linkedFinals.reduce((acc, a) => acc + a.remedialScores.length, 0);
      const latest = linkedFinals[linkedFinals.length - 1] ?? null;

      let status: TpMasteryStatus;
      if (linkedFinals.length === 0) {
        status = "BELUM_DINILAI";
      } else if (withKktp.length === 0) {
        status = "TANPA_KKTP";
      } else {
        status = mastered.length === withKktp.length ? "TUNTAS" : "BELUM_TUNTAS";
      }

      const useLive = lo.status === "ACTIVE";
      return {
        learningObjectiveId: lo.id,
        code: useLive ? lo.code : lo.fallbackCode ?? lo.code,
        description: useLive ? lo.description : lo.fallbackDescription ?? lo.description,
        status,
        assessedCount: withKktp.length,
        masteredCount: mastered.length,
        averageScore: mean(linkedFinals.map((a) => a.finalScore as number)),
        latestScore: latest ? (latest.finalScore as number) : null,
        latestScoreDate: latest ? latest.assessmentDate.toISOString() : null,
        remedialCount,
      };
    });

  return {
    teachingContextId: raw.teachingContextId,
    subjectName: raw.subjectName,
    teacherName: raw.teacherName,
    runningScore,
    scoringMode,
    availableWeight,
    flatAverage,
    finalCount: finals.length,
    trend: finals.map((a) => ({
      assessmentId: a.id,
      title: a.title,
      date: a.assessmentDate.toISOString(),
      score: a.finalScore as number,
      percent: Math.round(((a.finalScore as number) / a.maxScore) * 100),
    })),
    tpTree,
  };
}

/** Ringkasan widget beranda (2.4) dari SubjectProgress. */
export function buildSubjectSummary(p: SubjectProgress): SubjectProgressSummary {
  const assessed = p.tpTree.filter((t) => t.status === "TUNTAS" || t.status === "BELUM_TUNTAS");
  return {
    teachingContextId: p.teachingContextId,
    subjectName: p.subjectName,
    runningScore: p.runningScore,
    scoringMode: p.scoringMode,
    tuntasTpCount: p.tpTree.filter((t) => t.status === "TUNTAS").length,
    assessedTpCount: assessed.length,
    hasFinalData: p.finalCount > 0,
  };
}

/** Kunci bulan kalender zona Asia/Jakarta (TZ kanonik aplikasi) — "YYYY-MM" */
function jakartaMonthKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

/** Rekap presensi bulanan H/S/I/A; LATE dihitung H + lateCount (keputusan #4).
 *  Bulan tanpa record di antara record pertama hingga bulan berjalan disintesis
 *  sebagai nol (matriks spec: "rekap H/S/I/A = 0"), grouping zona Asia/Jakarta. */
export function summarizeMonthlyAttendance(
  records: AttendanceRecordLite[],
  now: Date = new Date()
): MonthlyAttendanceRecap[] {
  if (records.length === 0) return [];

  const byMonth = new Map<string, MonthlyAttendanceRecap>();
  const ensure = (key: string): MonthlyAttendanceRecap => {
    let recap = byMonth.get(key);
    if (!recap) {
      const [y, m] = key.split("-").map(Number);
      recap = { year: y, month: m, hadir: 0, sakit: 0, izin: 0, alpa: 0, lateCount: 0 };
      byMonth.set(key, recap);
    }
    return recap;
  };

  for (const r of records) {
    const recap = ensure(jakartaMonthKey(r.date));
    switch (r.status) {
      case "PRESENT":
        recap.hadir++;
        break;
      case "LATE":
        recap.hadir++; // hadir, terlambat — keterangan terpisah
        recap.lateCount++;
        break;
      case "SICK":
        recap.sakit++;
        break;
      case "PERMISSION":
        recap.izin++;
        break;
      case "ABSENT":
        recap.alpa++;
        break;
    }
  }

  // Sintesis bulan nol dari bulan record terawal hingga bulan berjalan (Jakarta)
  const allKeys = Array.from(byMonth.keys()).sort();
  let [y, m] = allKeys[0].split("-").map(Number);
  const endKey = jakartaMonthKey(now);
  let [ey, em] = endKey.split("-").map(Number);
  let guard = 1200; // pengaman loop (≈100 tahun)
  while ((y < ey || (y === ey && m <= em)) && guard-- > 0) {
    ensure(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return Array.from(byMonth.values()).sort((a, b) => b.year - a.year || b.month - a.month);
}
