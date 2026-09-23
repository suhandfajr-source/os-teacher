import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// In-memory cookie store mock for next/headers (pola story-4-full-audit)
let currentCookieValue: string | null = null;
const mockCookieStore = {
  get: vi.fn((name: string) => {
    if (name === "klassa_student_session" && currentCookieValue) {
      return { name, value: currentCookieValue };
    }
    return undefined;
  }),
  set: vi.fn((name: string, value: string) => {
    if (name === "klassa_student_session") {
      currentCookieValue = value;
    }
  }),
  delete: vi.fn((name: string) => {
    if (name === "klassa_student_session") {
      currentCookieValue = null;
    }
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

import { prisma } from "@/lib/auth";
import { hashPin } from "@/lib/student-pin";
import { signStudentSessionToken } from "@/modules/student-auth/student-session";
import {
  getStudentProgressDataAction,
  getStudentProgressWidgetAction,
} from "../student-progress.actions";

function makeSessionToken(params: {
  studentId: string;
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  nis: string;
  fullName: string;
  pinUpdatedAt: Date;
}) {
  return signStudentSessionToken({
    studentId: params.studentId,
    schoolId: params.schoolId,
    classId: params.classId,
    academicPeriodId: params.academicPeriodId,
    nis: params.nis,
    fullName: params.fullName,
    pinUpdatedAt: params.pinUpdatedAt.toISOString(),
  });
}

/**
 * Story 7 — rantai DoD real-db: guru finalisasi assessment (COMPLETED + GRADED)
 * → siswa (via sesi server) melihat nilai di pohon ketuntasan & widget.
 * Termasuk regresi FINAL ganda: nilai pada assessment IN_PROGRESS tidak bocor.
 */
describe("Story 7 Student Progress — Real-DB Integration", () => {
  let dbAvailable = false;
  const timestamp = Date.now();

  let schoolId: string;
  let academicPeriodId: string;
  let subjectId: string;
  let teacherUserId: string;
  let teacherProfileId: string;
  let classId: string;
  let studentId: string;
  let studentNis: string;
  let teachingContextId: string;
  let assessmentTypeId: string;
  let loTuntasId: string;
  let loBelumId: string;
  let lonerStudentId: string; // tanpa membership rombel sama sekali
  let oldPeriodStudentId: string; // hanya membership periode INACTIVE
  let lonerToken: string;
  let oldPeriodToken: string;

  beforeAll(async () => {
    try {
      const school = await prisma.school.create({
        data: {
          name: `Audit Sekolah S7 ${timestamp}`,
          normalizedName: `audit sekolah s7 ${timestamp}`,
          npsn: `NPSN7${timestamp.toString().slice(-5)}`,
        },
      });
      schoolId = school.id;

      const ap = await prisma.academicPeriod.create({
        data: { schoolId: school.id, year: "2026/2027", semester: "Ganjil", status: "ACTIVE" },
      });
      academicPeriodId = ap.id;

      const subject = await prisma.subject.create({
        data: { name: `Fisika ${timestamp}`, schoolId: school.id },
      });
      subjectId = subject.id;

      teacherUserId = `teacher-s7-${timestamp}`;
      await prisma.user.create({
        data: {
          id: teacherUserId,
          email: `${teacherUserId}@test.com`,
          name: "Guru Pengampu S7",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      const tp = await prisma.teacherProfile.create({
        data: { userId: teacherUserId, activeSchoolId: school.id, onboardingCompleted: true },
      });
      teacherProfileId = tp.id;

      const cls = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: "9-B",
          gradeLevel: "9",
          joinCode: `S7${timestamp.toString().slice(-4)}`,
        },
      });
      classId = cls.id;

      const tc = await prisma.teachingContext.create({
        data: {
          teacherProfileId: tp.id,
          schoolId: school.id,
          academicPeriodId: ap.id,
          subjectId: subject.id,
          classId: cls.id,
        },
      });
      teachingContextId = tc.id;

      // Jenis penilaian + GradePolicy ACTIVE (bobot 100% Ulangan)
      const at = await prisma.assessmentType.create({
        data: {
          teachingContextId: tc.id,
          name: "Ulangan Harian",
          normalizedName: "ulangan harian",
          category: "FORMATIVE",
        },
      });
      assessmentTypeId = at.id;
      await prisma.gradePolicy.create({
        data: {
          teachingContextId: tc.id,
          status: "ACTIVE",
          items: { create: [{ assessmentTypeId: at.id, weight: 100, sortOrder: 1 }] },
        },
      });

      // TP (Learning Objective)
      const lo1 = await prisma.learningObjective.create({
        data: { teachingContextId: tc.id, code: "TP-1.1", description: "Menganalisis gerak lurus", orderIndex: 1 },
      });
      const lo2 = await prisma.learningObjective.create({
        data: { teachingContextId: tc.id, code: "TP-1.2", description: "Menerapkan Hukum Newton", orderIndex: 2 },
      });
      loTuntasId = lo1.id;
      loBelumId = lo2.id;

      // Siswa + enrollment
      studentNis = `NIS${timestamp.toString().slice(-6)}`;
      const student = await prisma.student.create({
        data: {
          schoolId: school.id,
          fullName: "Rara Siswa Rajin",
          nis: studentNis,
          accessPinHash: await hashPin("5678"),
          accountStatus: "ACTIVE",
          status: "ACTIVE",
          pinUpdatedAt: new Date(),
        },
      });
      studentId = student.id;
      await prisma.classStudent.create({
        data: { studentId, classId: cls.id, academicPeriodId: ap.id },
      });

      // Assessment #1 FINAL: COMPLETED + result GRADED 85 (KKTP 75) → TP-1.1 TUNTAS
      const a1 = await prisma.assessment.create({
        data: {
          teachingContextId: tc.id,
          assessmentTypeId: at.id,
          title: "Ulangan Gerak Lurus",
          assessmentDate: new Date("2026-09-10T00:00:00Z"),
          maxScore: 100,
          minimumPassingScore: 75,
          status: "COMPLETED",
          learningObjectiveLinks: {
            create: [
              { learningObjectiveId: lo1.id, snapshotCode: "TP-1.1", snapshotDescription: "Menganalisis gerak lurus" },
            ],
          },
        },
      });
      await prisma.assessmentResult.create({
        data: { assessmentId: a1.id, studentId, status: "GRADED", finalScore: 85 },
      });

      // Assessment #2 FINAL: COMPLETED + GRADED 60 (KKTP 75) → TP-1.2 BELUM_TUNTAS
      const a2 = await prisma.assessment.create({
        data: {
          teachingContextId: tc.id,
          assessmentTypeId: at.id,
          title: "Ulangan Hukum Newton",
          assessmentDate: new Date("2026-09-17T00:00:00Z"),
          maxScore: 100,
          minimumPassingScore: 75,
          status: "COMPLETED",
          learningObjectiveLinks: {
            create: [
              { learningObjectiveId: lo2.id, snapshotCode: "TP-1.2", snapshotDescription: "Menerapkan Hukum Newton" },
            ],
          },
        },
      });
      await prisma.assessmentResult.create({
        data: { assessmentId: a2.id, studentId, status: "GRADED", finalScore: 60 },
      });

      // Assessment #3 NON-FINAL: IN_PROGRESS + result GRADED 99 → TIDAK BOLEH BOCOR
      const a3 = await prisma.assessment.create({
        data: {
          teachingContextId: tc.id,
          assessmentTypeId: at.id,
          title: "Ulangan Masih Berjalan",
          assessmentDate: new Date("2026-09-20T00:00:00Z"),
          maxScore: 100,
          minimumPassingScore: 75,
          status: "IN_PROGRESS",
          learningObjectiveLinks: {
            create: [
              { learningObjectiveId: lo1.id, snapshotCode: "TP-1.1", snapshotDescription: "Menganalisis gerak lurus" },
            ],
          },
        },
      });
      await prisma.assessmentResult.create({
        data: { assessmentId: a3.id, studentId, status: "GRADED", finalScore: 99 },
      });

      // Presensi: 3 sesi September periode AKTIF (1 hadir, 1 telat, 1 sakit)
      // Tanggal ISO UTC → grouping bulan Jakarta deterministik di semua TZ server
      for (const [day, recStatus] of [["05", "PRESENT"], ["12", "LATE"], ["19", "SICK"]] as const) {
        const session = await prisma.teachingSession.create({
          data: { teachingContextId: tc.id, date: new Date(`2026-09-${day}T00:00:00Z`), status: "COMPLETED" },
        });
        await prisma.attendanceRecord.create({
          data: { teachingSessionId: session.id, studentId, status: recStatus },
        });
      }

      // Sesi valid
      currentCookieValue = signStudentSessionToken({
        studentId,
        schoolId: school.id,
        classId: cls.id,
        academicPeriodId: ap.id,
        nis: studentNis,
        fullName: student.fullName,
        pinUpdatedAt: student.pinUpdatedAt!.toISOString(),
      });

      // Siswa tanpa membership rombel (belum join/disetujui)
      const loner = await prisma.student.create({
        data: {
          schoolId: school.id,
          fullName: "Siswa Tanpa Rombel",
          nis: `LNR${timestamp.toString().slice(-6)}`,
          accessPinHash: await hashPin("9999"),
          accountStatus: "ACTIVE",
          status: "ACTIVE",
          pinUpdatedAt: new Date(),
        },
      });
      lonerStudentId = loner.id;
      lonerToken = makeSessionToken({
        studentId: loner.id,
        schoolId: school.id,
        classId: cls.id,
        academicPeriodId: ap.id,
        nis: loner.nis!,
        fullName: loner.fullName,
        pinUpdatedAt: loner.pinUpdatedAt!,
      });

      // Siswa dengan membership hanya di periode lama (INACTIVE)
      const oldAp = await prisma.academicPeriod.create({
        data: { schoolId: school.id, year: "2025/2026", semester: "Genap", status: "INACTIVE" },
      });
      const oldCls = await prisma.class.create({
        data: { schoolId: school.id, name: "8-Z", gradeLevel: "8", joinCode: `S7O${timestamp.toString().slice(-4)}` },
      });
      const oldStudent = await prisma.student.create({
        data: {
          schoolId: school.id,
          fullName: "Siswa Periode Lama",
          nis: `OLD${timestamp.toString().slice(-6)}`,
          accessPinHash: await hashPin("8888"),
          accountStatus: "ACTIVE",
          status: "ACTIVE",
          pinUpdatedAt: new Date(),
        },
      });
      oldPeriodStudentId = oldStudent.id;
      await prisma.classStudent.create({
        data: { studentId: oldStudent.id, classId: oldCls.id, academicPeriodId: oldAp.id },
      });

      // Isolasi antar-periode (VG-1): siswa UTAMA juga punya membership + data periode lama
      // (mapel & presensi periode lama TIDAK BOLEH tercampur ke rekap periode aktif)
      const oldTc = await prisma.teachingContext.create({
        data: {
          teacherProfileId: tp.id,
          schoolId: school.id,
          academicPeriodId: oldAp.id,
          subjectId: subject.id,
          classId: oldCls.id,
        },
      });
      await prisma.classStudent.create({
        data: { studentId, classId: oldCls.id, academicPeriodId: oldAp.id },
      });
      const oldSession = await prisma.teachingSession.create({
        data: { teachingContextId: oldTc.id, date: new Date("2026-05-10T00:00:00Z"), status: "COMPLETED" },
      });
      await prisma.attendanceRecord.create({
        data: { teachingSessionId: oldSession.id, studentId, status: "PRESENT" },
      });
      await prisma.assessment.create({
        data: {
          teachingContextId: oldTc.id,
          assessmentTypeId: at.id,
          title: "Nilai Tahun Lalu (tidak boleh tampil)",
          assessmentDate: new Date("2026-05-11T00:00:00Z"),
          maxScore: 100,
          minimumPassingScore: 75,
          status: "COMPLETED",
          results: {
            create: { studentId, status: "GRADED", finalScore: 100 },
          },
        },
      });
      oldPeriodToken = makeSessionToken({
        studentId: oldStudent.id,
        schoolId: school.id,
        classId: oldCls.id,
        academicPeriodId: oldAp.id,
        nis: oldStudent.nis!,
        fullName: oldStudent.fullName,
        pinUpdatedAt: oldStudent.pinUpdatedAt!,
      });

      dbAvailable = true;
    } catch (err) {
      console.warn("Real database not reachable, skipping live DB tests:", err);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      if (schoolId) await prisma.school.delete({ where: { id: schoolId } });
      if (teacherUserId) await prisma.user.delete({ where: { id: teacherUserId } });
      if (subjectId) await prisma.subject.delete({ where: { id: subjectId } });
    } catch {
      // Ignore cleanup error
    }
  });

  it("rantai DoD: guru finalisasi → siswa melihat nilai berbobot & pohon ketuntasan", async () => {
    if (!dbAvailable) return;
    const res = await getStudentProgressDataAction();
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data!.hasActivePeriod).toBe(true);
    expect(res.data!.subjects).toHaveLength(1);

    const fisika = res.data!.subjects[0];
    expect(fisika.subjectName).toContain("Fisika");
    expect(fisika.scoringMode).toBe("WEIGHTED");
    // Bobot 100% Ulangan → (85 + 60) / 2 = 72.5
    expect(fisika.runningScore).toBe(72.5);
    expect(fisika.finalCount).toBe(2);

    const tpTuntas = fisika.tpTree.find((t) => t.learningObjectiveId === loTuntasId)!;
    expect(tpTuntas.status).toBe("TUNTAS");
    expect(tpTuntas.masteredCount).toBe(1);
    expect(tpTuntas.assessedCount).toBe(1);

    const tpBelum = fisika.tpTree.find((t) => t.learningObjectiveId === loBelumId)!;
    expect(tpBelum.status).toBe("BELUM_TUNTAS");
    expect(tpBelum.masteredCount).toBe(0);
  });

  it("regresi FINAL ganda: nilai GRADED pada assessment IN_PROGRESS tidak bocor", async () => {
    if (!dbAvailable) return;
    const res = await getStudentProgressDataAction();
    const fisika = res.data!.subjects[0];

    expect(fisika.finalCount).toBe(2); // 99 dari a3 tidak dihitung
    expect(fisika.trend.map((t) => t.title)).not.toContain("Ulangan Masih Berjalan");
    // TP-1.1 tervaluasi a1 (85 tuntas) — 99 dari a3 tidak menambah proporsi
    const tpTuntas = fisika.tpTree.find((t) => t.learningObjectiveId === loTuntasId)!;
    expect(tpTuntas.assessedCount).toBe(1);
    expect(tpTuntas.averageScore).toBe(85);
  });

  it("presensi: rekap bulanan H/S/I/A dari sesi periode aktif; LATE dihitung H", async () => {
    if (!dbAvailable) return;
    const res = await getStudentProgressDataAction();
    const sept = res.data!.attendance.find((r) => r.year === 2026 && r.month === 9);
    expect(sept).toBeDefined();
    expect(sept!.hadir).toBe(2); // PRESENT + LATE
    expect(sept!.lateCount).toBe(1);
    expect(sept!.sakit).toBe(1);
    expect(sept!.izin).toBe(0);
    expect(sept!.alpa).toBe(0);
  });

  it("isolasi antar-periode: mapel, nilai & presensi periode lama tidak tercampur (VG-1)", async () => {
    if (!dbAvailable) return;
    const res = await getStudentProgressDataAction();

    // Siswa utama punya membership periode lama BERDATA, tapi resolusi wajib periode aktif
    expect(res.data!.hasActivePeriod).toBe(true);
    // Satu-satunya mapel = teachingContext periode aktif (bukan 2 — bukan campuran)
    expect(res.data!.subjects).toHaveLength(1);
    expect(res.data!.subjects[0].finalCount).toBe(2); // nilai Mei (100) tidak bocor → bukan 3
    expect(res.data!.subjects[0].trend.map((t) => t.title)).not.toContain("Nilai Tahun Lalu (tidak boleh tampil)");
    // Rekap presensi hanya bulan-bulan sejak data periode aktif — tidak ada Mei
    const mei = res.data!.attendance.find((r) => r.year === 2026 && r.month === 5);
    expect(mei).toBeUndefined();
    for (const r of res.data!.attendance) {
      expect(r.month).toBeGreaterThanOrEqual(9);
    }
  });

  it("widget beranda: ringkasan per mapel konsisten dengan halaman nilai", async () => {
    if (!dbAvailable) return;
    const res = await getStudentProgressWidgetAction();
    expect(res.success).toBe(true);
    expect(res.data!.subjects).toHaveLength(1);

    const summary = res.data!.subjects[0];
    expect(summary.hasFinalData).toBe(true);
    expect(summary.runningScore).toBe(72.5);
    expect(summary.tuntasTpCount).toBe(1);
    expect(summary.assessedTpCount).toBe(2);
  });

  it("tanpa sesi → error, bukan data (identitas hanya dari sesi server)", async () => {
    if (!dbAvailable) return;
    const saved = currentCookieValue;
    currentCookieValue = null;
    const res = await getStudentProgressDataAction();
    currentCookieValue = saved;
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("siswa tanpa membership rombel → keadaan kosong aman tanpa error", async () => {
    if (!dbAvailable) return;
    const saved = currentCookieValue;
    currentCookieValue = lonerToken;
    const res = await getStudentProgressDataAction();
    currentCookieValue = saved;

    expect(res.success).toBe(true);
    expect(res.data!.hasActivePeriod).toBe(false);
    expect(res.data!.subjects).toEqual([]);
    expect(res.data!.attendance).toEqual([]);
  });

  it("siswa dengan membership hanya periode lama (INACTIVE) → data periode lama tidak tampil", async () => {
    if (!dbAvailable) return;
    const saved = currentCookieValue;
    currentCookieValue = oldPeriodToken;
    const [res, widgetRes] = await Promise.all([
      getStudentProgressDataAction(),
      getStudentProgressWidgetAction(),
    ]);
    currentCookieValue = saved;

    expect(res.success).toBe(true);
    expect(res.data!.hasActivePeriod).toBe(false);
    expect(res.data!.subjects).toEqual([]);
    expect(widgetRes.data!.subjects).toEqual([]);
  });
});
