import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// In-memory cookie store mock for next/headers (pola story-4/7/8)
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
  headers: vi.fn(async () => new Headers()),
}));

import { prisma } from "@/lib/auth";
import { hashPin } from "@/lib/student-pin";
import { signStudentSessionToken } from "@/modules/student-auth/student-session";
import { getStudentFamilyDetailAction } from "../student-family.actions";

/**
 * Sunset /parent/* — pengayaan Mode Keluarga: rincian penilaian + aktivitas
 * belajar per mapel, student-scoped rombel periode aktif. Kontrak query
 * meniru getParentContextDetail: Assessment COMPLETED + result GRADED,
 * sesi COMPLETED dengan bukti partisipasi (Binding Amendment 6).
 */
describe("Story sunset-parent — getStudentFamilyDetailAction (Real-DB Integration)", { timeout: 60_000 }, () => {
  let dbAvailable = false;
  const timestamp = Date.now();

  let schoolId: string;
  let teacherUserId: string;
  let subjectId: string;
  let teachingContextId: string;
  let otherContextId: string;
  let studentId: string;
  let studentNis: string;
  let otherStudentId: string;
  let otherStudentNis: string;
  let studentToken: string;

  beforeAll(async () => {
    try {
      const school = await prisma.school.create({
        data: {
          name: `Audit Sekolah SP ${timestamp}`,
          normalizedName: `audit sekolah sp ${timestamp}`,
          npsn: `NPSP${timestamp.toString().slice(-5)}`,
        },
      });
      schoolId = school.id;

      const ap = await prisma.academicPeriod.create({
        data: { schoolId: school.id, year: "2026/2027", semester: "Ganjil", status: "ACTIVE" },
      });

      const subject = await prisma.subject.create({
        data: { name: `Matematika ${timestamp}`, schoolId: school.id },
      });
      subjectId = subject.id;

      teacherUserId = `teacher-sp-${timestamp}`;
      await prisma.user.create({
        data: {
          id: teacherUserId,
          email: `${teacherUserId}@test.com`,
          name: "Guru Pengampu SP",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      const tp = await prisma.teacherProfile.create({
        data: { userId: teacherUserId, activeSchoolId: school.id, onboardingCompleted: true },
      });

      const cls = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: "7-A",
          gradeLevel: "7",
          joinCode: `SP${timestamp.toString().slice(-4)}`,
        },
      });
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

      // Konteks rombel lain (kelas beda) — tak boleh muncul
      const otherCls = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: "7-B",
          gradeLevel: "7",
          joinCode: `SPX${timestamp.toString().slice(-4)}`,
        },
      });
      const otherTc = await prisma.teachingContext.create({
        data: {
          teacherProfileId: tp.id,
          schoolId: school.id,
          academicPeriodId: ap.id,
          subjectId: subject.id,
          classId: otherCls.id,
        },
      });
      otherContextId = otherTc.id;

      // Siswa target + siswa pembanding di rombel yang sama
      studentNis = `NISSP${timestamp.toString().slice(-5)}`;
      const student = await prisma.student.create({
        data: {
          schoolId: school.id,
          fullName: "Esi Siswa Pantau",
          nis: studentNis,
          accessPinHash: await hashPin("1234"),
          accountStatus: "ACTIVE",
          status: "ACTIVE",
          pinUpdatedAt: new Date(),
        },
      });
      studentId = student.id;
      await prisma.classStudent.create({
        data: { studentId, classId: cls.id, academicPeriodId: ap.id },
      });

      otherStudentNis = `NISSQ${timestamp.toString().slice(-5)}`;
      const otherStudent = await prisma.student.create({
        data: {
          schoolId: school.id,
          fullName: "Pembanding Saja",
          nis: otherStudentNis,
          accessPinHash: await hashPin("1234"),
          accountStatus: "ACTIVE",
          status: "ACTIVE",
          pinUpdatedAt: new Date(),
        },
      });
      otherStudentId = otherStudent.id;
      await prisma.classStudent.create({
        data: { studentId: otherStudentId, classId: cls.id, academicPeriodId: ap.id },
      });

      studentToken = signStudentSessionToken({
        studentId,
        schoolId: school.id,
        classId: cls.id,
        academicPeriodId: ap.id,
        nis: studentNis,
        fullName: student.fullName,
        pinUpdatedAt: student.pinUpdatedAt!.toISOString(),
      });

      const at = await prisma.assessmentType.create({
        data: {
          teachingContextId: tc.id,
          name: "Ulangan",
          normalizedName: "ulangan",
          category: "SUMMATIVE",
        },
      });

      // ── Fixture sesi ──
      // S1: COMPLETED + siswa hadir + topik aktual → muncul
      const s1 = await prisma.teachingSession.create({
        data: {
          teachingContextId: tc.id,
          date: new Date("2026-09-20"),
          status: "COMPLETED",
          actualTopic: "Persamaan Linear",
        },
      });
      await prisma.attendanceRecord.create({
        data: { teachingSessionId: s1.id, studentId, status: "PRESENT" },
      });
      // S2: COMPLETED tapi siswa tak punya record → tak muncul (bukti partisipasi)
      await prisma.teachingSession.create({
        data: {
          teachingContextId: tc.id,
          date: new Date("2026-09-21"),
          status: "COMPLETED",
          actualTopic: "Sesi Tanpa Siswa",
        },
      });
      // S3: IN_PROGRESS dengan siswa hadir → tak muncul
      const s3 = await prisma.teachingSession.create({
        data: {
          teachingContextId: tc.id,
          date: new Date("2026-09-22"),
          status: "IN_PROGRESS",
          actualTopic: "Sesi Berjalan",
        },
      });
      await prisma.attendanceRecord.create({
        data: { teachingSessionId: s3.id, studentId, status: "PRESENT" },
      });
      // S4: sesi rombel lain, siswa hadir → tak muncul (isolasi rombel)
      const s4 = await prisma.teachingSession.create({
        data: {
          teachingContextId: otherTc.id,
          date: new Date("2026-09-23"),
          status: "COMPLETED",
          actualTopic: "Topik Kelas Lain",
        },
      });
      await prisma.attendanceRecord.create({
        data: { teachingSessionId: s4.id, studentId, status: "PRESENT" },
      });

      // ── Fixture penilaian ──
      // A1: COMPLETED + GRADED 85 → muncul dengan finalScore
      const a1 = await prisma.assessment.create({
        data: {
          teachingContextId: tc.id,
          assessmentTypeId: at.id,
          title: "Ulangan Bab 1",
          assessmentDate: new Date("2026-09-18"),
          maxScore: 100,
          minimumPassingScore: 75,
          status: "COMPLETED",
        },
      });
      await prisma.assessmentResult.create({
        data: { assessmentId: a1.id, studentId, status: "GRADED", finalScore: 85 },
      });
      // A2: COMPLETED + GRADED 60 (di bawah KKM) → muncul, skor merah di UI
      const a2 = await prisma.assessment.create({
        data: {
          teachingContextId: tc.id,
          assessmentTypeId: at.id,
          title: "Ulangan Bab 2",
          assessmentDate: new Date("2026-09-19"),
          maxScore: 100,
          minimumPassingScore: 75,
          status: "COMPLETED",
        },
      });
      await prisma.assessmentResult.create({
        data: { assessmentId: a2.id, studentId, status: "GRADED", finalScore: 60 },
      });
      // A3: COMPLETED + PENDING → muncul tanpa finalScore (menunggu)
      const a3 = await prisma.assessment.create({
        data: {
          teachingContextId: tc.id,
          assessmentTypeId: at.id,
          title: "Proyek Kelompok",
          assessmentDate: new Date("2026-09-22"),
          maxScore: 100,
          status: "COMPLETED",
        },
      });
      await prisma.assessmentResult.create({
        data: { assessmentId: a3.id, studentId, status: "PENDING" },
      });
      // A4: DRAFT → tak muncul
      await prisma.assessment.create({
        data: {
          teachingContextId: tc.id,
          assessmentTypeId: at.id,
          title: "Draf Ulangan Bab 3",
          assessmentDate: new Date("2026-09-25"),
          maxScore: 100,
          status: "DRAFT",
        },
      });
      // A5: COMPLETED + GRADED tapi hanya milik siswa lain → tak muncul
      const a5 = await prisma.assessment.create({
        data: {
          teachingContextId: tc.id,
          assessmentTypeId: at.id,
          title: "Nilai Siswa Lain",
          assessmentDate: new Date("2026-09-17"),
          maxScore: 100,
          status: "COMPLETED",
        },
      });
      await prisma.assessmentResult.create({
        data: { assessmentId: a5.id, studentId: otherStudentId, status: "GRADED", finalScore: 90 },
      });
      // A6: COMPLETED + GRADED di rombel lain → tak muncul (isolasi rombel)
      const at2 = await prisma.assessmentType.create({
        data: {
          teachingContextId: otherTc.id,
          name: "Ulangan",
          normalizedName: "ulangan",
          category: "SUMMATIVE",
        },
      });
      const a6 = await prisma.assessment.create({
        data: {
          teachingContextId: otherTc.id,
          assessmentTypeId: at2.id,
          title: "Penilaian Kelas Lain",
          assessmentDate: new Date("2026-09-16"),
          maxScore: 100,
          status: "COMPLETED",
        },
      });
      await prisma.assessmentResult.create({
        data: { assessmentId: a6.id, studentId, status: "GRADED", finalScore: 95 },
      });

      currentCookieValue = studentToken;
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

  it("happy: penilaian GRADED/PENDING muncul; DRAFT, milik siswa lain, rombel lain tak bocor", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;

    const res = await getStudentFamilyDetailAction();
    expect(res.success).toBe(true);

    const subj = res.subjects!.find((s) => s.teachingContextId === teachingContextId);
    expect(subj).toBeDefined();
    expect(subj!.subjectName).toContain("Matematika");

    const titles = subj!.assessments.map((a) => a.title);
    expect(titles).toContain("Ulangan Bab 1");
    expect(titles).toContain("Ulangan Bab 2");
    expect(titles).toContain("Proyek Kelompok");
    expect(titles).not.toContain("Draf Ulangan Bab 3");
    expect(titles).not.toContain("Nilai Siswa Lain");
    expect(titles).not.toContain("Penilaian Kelas Lain");

    // finalScore hanya untuk GRADED; KKM terbawa; urutan tanggal desc
    const a1 = subj!.assessments.find((a) => a.title === "Ulangan Bab 1")!;
    expect(a1.finalScore).toBe(85);
    expect(a1.minimumPassingScore).toBe(75);
    const a3 = subj!.assessments.find((a) => a.title === "Proyek Kelompok")!;
    expect(a3.finalScore).toBeNull();
    expect(a3.resultStatus).toBe("PENDING");
    expect(subj!.assessments[0].date >= subj!.assessments[1].date).toBe(true);

    // Isolasi rombel: konteks kelas lain tak ikut
    expect(res.subjects!.find((s) => s.teachingContextId === otherContextId)).toBeUndefined();
  });

  it("aktivitas: hanya sesi COMPLETED yang diikuti siswa di rombelnya", async () => {
    if (!dbAvailable) return;
    currentCookieValue = studentToken;

    const res = await getStudentFamilyDetailAction();
    const subj = res.subjects!.find((s) => s.teachingContextId === teachingContextId)!;

    const topics = subj.activities.map((a) => a.actualTopic);
    expect(topics).toContain("Persamaan Linear");
    expect(topics).not.toContain("Sesi Tanpa Siswa");
    expect(topics).not.toContain("Sesi Berjalan");
    expect(topics).not.toContain("Topik Kelas Lain");

    const act = subj.activities.find((a) => a.actualTopic === "Persamaan Linear")!;
    expect(act.attendanceStatus).toBe("PRESENT");
  });

  it("tanpa sesi: ditolak tanpa membocorkan identitas lain", async () => {
    if (!dbAvailable) return;
    const saved = currentCookieValue;
    currentCookieValue = null;
    const res = await getStudentFamilyDetailAction();
    currentCookieValue = saved;
    expect(res.success).toBe(false);
    expect(res.error).toContain("Sesi");
  });
});
