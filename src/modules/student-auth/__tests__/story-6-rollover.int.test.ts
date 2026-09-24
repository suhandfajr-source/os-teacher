/**
 * Story 6 — Rollover TA: Deep Real-Database Integration & Security Audit
 *
 * Membuktikan CAP-8: "klaim ulang dengan NIS & PIN lama teruji" + saklar periode
 * atomik (invariant §9.4 satu periode ACTIVE) + matriks I/O spec Story 6.
 *
 * Pola mengikuti story-3-full-audit / story-5-full-audit: prisma REAL (Neon/lokal),
 * sesi guru di-mock di tepi (@/lib/authorization), auth.api di-stub dengan perilaku
 * setara (tulis DB langsung).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/auth";
import { verifyPin } from "@/lib/student-pin";
import {
  signStudentSessionToken,
  verifyStudentSessionToken,
  resolveStudentSessionMembership,
} from "../student-session";
import { registerStudent, loginStudent } from "../student-auth.actions";
import { createClassAction } from "../../classes/classes.actions";

vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
}));

import { verifyActiveSchoolMembership } from "@/lib/authorization";

const mockedVerify = vi.mocked(verifyActiveSchoolMembership);

function setActor(actor: {
  session: { user: { id: string } };
  profile: { id: string; userId: string };
  activeSchoolId: string;
  activeSchool: { id: string; name: string };
}) {
  mockedVerify.mockImplementation(
    async () => actor as unknown as Awaited<ReturnType<typeof verifyActiveSchoolMembership>>
  );
}

describe("Story 6 Rollover TA — Real Database Integration (CAP-8)", { timeout: 120_000 }, () => {
  let dbAvailable = false;
  const ts = Date.now();

  // Sekolah utama rollover
  let schoolId: string;
  let teacherUserId: string;
  let teacherProfileId: string;
  let oldPeriodId: string; // 2025/2026 Ganjil — ACTIVE awal
  let oldClassId: string;
  let oldJoinCode: string;

  let newPeriodId: string; // 2026/2027 Genap — diciptakan via createClassAction (saklar)
  let newClassId: string;
  let newJoinCode: string;

  const pinBudi = "1234";
  let budiId: string; // ACTIVE ber-PIN, enrollmen hanya periode lama → klaim ulang
  let sitiId: string; // jalur mayoritas: impor dulu (reuse NIS) → login
  let dewiId: string; // PENDING ber-PIN → komposisi approve → klaim ulang
  let fajarId: string; // klaim ulang nama beda → PENDING L1
  let gitaId: string; // gate periode INACTIVE
  let hanaId: string; // enroll aktif rombel lain/sama
  let ekaId: string; // REJECTED → G-1 regresi

  const auditTargets: string[] = [];

  async function seedStudent(opts: {
    fullName: string;
    nis: string;
    pin: string | null;
    accountStatus: "ACTIVE" | "PENDING" | "REJECTED";
    classId: string;
    periodId: string;
  }) {
    const { hashPin } = await import("@/lib/student-pin");
    const student = await prisma.student.create({
      data: {
        schoolId,
        fullName: opts.fullName,
        nis: opts.nis,
        accessPinHash: opts.pin ? await hashPin(opts.pin) : null,
        accountStatus: opts.accountStatus,
        accountRequestedAt: null,
        approvedAt: opts.accountStatus === "ACTIVE" ? new Date() : null,
      },
    });
    await prisma.classStudent.create({
      data: { studentId: student.id, classId: opts.classId, academicPeriodId: opts.periodId },
    });
    auditTargets.push(student.id);
    return student;
  }

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      const school = await prisma.school.create({
        data: {
          name: `Sekolah Rollover S6 ${ts}`,
          normalizedName: `sekolah rollover s6 ${ts}`,
        },
      });
      schoolId = school.id;

      teacherUserId = `teacher-s6-${ts}`;
      const teacherUser = await prisma.user.create({
        data: {
          id: teacherUserId,
          email: `${teacherUserId}@test.com`,
          name: "Guru Rollover",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      const teacherProfile = await prisma.teacherProfile.create({
        data: { userId: teacherUser.id, activeSchoolId: school.id, onboardingCompleted: true },
      });
      teacherProfileId = teacherProfile.id;

      await prisma.teacherSchoolMembership.create({
        data: {
          teacherProfileId: teacherProfile.id,
          schoolId: school.id,
          status: "ACTIVE",
          workspaceRole: "OWNER",
        },
      });

      setActor({
        session: { user: { id: teacherUserId } },
        profile: { id: teacherProfileId, userId: teacherUserId },
        activeSchoolId: school.id,
        activeSchool: { id: school.id, name: school.name },
      });

      // Periode lama ACTIVE + rombel lama berkode join
      const oldPeriod = await prisma.academicPeriod.create({
        data: { schoolId, year: "2025/2026", semester: "Semester Ganjil", status: "ACTIVE" },
      });
      oldPeriodId = oldPeriod.id;

      const subject = await prisma.subject.create({
        data: { schoolId, name: "Matematika", normalizedName: "matematika" },
      });

      const oldClass = await prisma.class.create({
        data: {
          schoolId,
          name: "7-A",
          gradeLevel: "7",
          joinCode: `S6O${ts.toString().slice(-4)}`,
          joinCodeLocked: false,
        },
      });
      oldClassId = oldClass.id;
      oldJoinCode = oldClass.joinCode!;

      await prisma.teachingContext.create({
        data: {
          teacherProfileId,
          schoolId,
          academicPeriodId: oldPeriodId,
          classId: oldClassId,
          subjectId: subject.id,
        },
      });

      // ── Siswa TA lama ──
      const budi = await seedStudent({
        fullName: "Budi Rollover",
        nis: `S6B${ts}`,
        pin: pinBudi,
        accountStatus: "ACTIVE",
        classId: oldClassId,
        periodId: oldPeriodId,
      });
      budiId = budi.id;

      const siti = await seedStudent({
        fullName: "Siti Impor",
        nis: `S6S${ts}`,
        pin: "5678",
        accountStatus: "ACTIVE",
        classId: oldClassId,
        periodId: oldPeriodId,
      });
      sitiId = siti.id;

      const dewi = await seedStudent({
        fullName: "Dewi Pending",
        nis: `S6D${ts}`,
        pin: "4321",
        accountStatus: "PENDING",
        classId: oldClassId,
        periodId: oldPeriodId,
      });
      dewiId = dewi.id;

      const fajar = await seedStudent({
        fullName: "Fajar Ganda",
        nis: `S6F${ts}`,
        pin: "1111",
        accountStatus: "ACTIVE",
        classId: oldClassId,
        periodId: oldPeriodId,
      });
      fajarId = fajar.id;

      const gita = await seedStudent({
        fullName: "Gita Aktif",
        nis: `S6G${ts}`,
        pin: "2222",
        accountStatus: "ACTIVE",
        classId: oldClassId,
        periodId: oldPeriodId,
      });
      gitaId = gita.id;

      const hana = await seedStudent({
        fullName: "Hana Pindah",
        nis: `S6H${ts}`,
        pin: "3333",
        accountStatus: "ACTIVE",
        classId: oldClassId,
        periodId: oldPeriodId,
      });
      hanaId = hana.id;

      const eka = await seedStudent({
        fullName: "Eka Rejected",
        nis: `S6E${ts}`,
        pin: "9999",
        accountStatus: "REJECTED",
        classId: oldClassId,
        periodId: oldPeriodId,
      });
      ekaId = eka.id;

      dbAvailable = true;
    } catch (err) {
      console.error("[story-6] DB unavailable — suite di-skip:", err);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      // Parent entities memakai onDelete: Restrict terhadap student — bersihkan lebih dulu
      const studentIds = auditTargets;
      const relations = await prisma.parentStudentRelation.findMany({
        where: { studentId: { in: studentIds } },
        select: { id: true, parentProfileId: true },
      });
      await prisma.parentTeachingAccess.deleteMany({
        where: { parentStudentRelationId: { in: relations.map((r) => r.id) } },
      });
      const parentProfileIds = [...new Set(relations.map((r) => r.parentProfileId))];
      await prisma.parentStudentRelation.deleteMany({
        where: { id: { in: relations.map((r) => r.id) } },
      });
      const parentUsers = await prisma.parentProfile.findMany({
        where: { id: { in: parentProfileIds } },
        select: { userId: true },
      });
      await prisma.parentProfile.deleteMany({ where: { id: { in: parentProfileIds } } });
      const parentUserIds = parentUsers.map((p) => p.userId).filter((uid) => uid !== teacherUserId);
      await prisma.user.deleteMany({ where: { id: { in: parentUserIds } } });

      await prisma.auditLog.deleteMany({
        where: { OR: [{ actorId: teacherUserId }, { targetId: { in: auditTargets } }] },
      });
      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
      await prisma.user.delete({ where: { id: teacherUserId } }).catch(() => {});
    } catch {
      /* cleanup best-effort */
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // A. Saklar periode atomik (createClassAction)
  // ─────────────────────────────────────────────────────────────────────────────

  it("A1 — Kelas TA baru: periode baru ACTIVE + periode lama INACTIVE (satu transaksi) + AuditLog saklar", async () => {
    if (!dbAvailable) return;

    const res = await createClassAction({
      className: "8-A",
      newAcademicYear: "2026/2027",
      newAcademicSemester: "Semester Genap",
    });
    expect(res.success).toBe(true);

    newPeriodId = (
      await prisma.academicPeriod.findUniqueOrThrow({
        where: { schoolId_year_semester: { schoolId, year: "2026/2027", semester: "Semester Genap" } },
      })
    ).id;
    newClassId = res.classEntity.id;

    const periods = await prisma.academicPeriod.findMany({ where: { schoolId } });
    const active = periods.filter((p) => p.status === "ACTIVE");
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(newPeriodId);
    expect(periods.find((p) => p.id === oldPeriodId)?.status).toBe("INACTIVE");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ACADEMIC_PERIOD_SWITCHED", targetType: "ACADEMIC_PERIOD", targetId: newPeriodId },
    });
    expect(audit).not.toBeNull();
    expect((audit!.metadata as Record<string, unknown>).closedActivePeriods).toBe(1);
    expect((audit!.metadata as Record<string, unknown>).source).toBe("new_period");
    // Metadata bebas secret (redactMetadata dipakai) — asersi bentuk
    expect(audit!.metadata).toHaveProperty("year");

    // Rombel baru siap menerima siswa: set joinCode terkenal + teaching context ada (dibuat action)
    const newClass = await prisma.class.update({
      where: { id: newClassId },
      data: { joinCode: `S6N${ts.toString().slice(-4)}`, joinCodeLocked: false },
    });
    newJoinCode = newClass.joinCode!;
  });

  it("A2 — Rollover tahun kedua: idempoten, tetap tepat SATU periode ACTIVE", async () => {
    if (!dbAvailable) return;

    const res = await createClassAction({
      className: "9-A",
      newAcademicYear: "2027/2028",
      newAcademicSemester: "Semester Ganjil",
    });
    expect(res.success).toBe(true);

    const active = await prisma.academicPeriod.findMany({ where: { schoolId, status: "ACTIVE" } });
    expect(active).toHaveLength(1);
    expect(active[0].year).toBe("2027/2028");
    expect((await prisma.academicPeriod.findUnique({ where: { id: newPeriodId } }))?.status).toBe(
      "INACTIVE"
    );
  });

  it("A3 — Reuse periode non-aktif: periode dihidupkan ulang + periode ACTIVE lain ikut ditutup", async () => {
    if (!dbAvailable) return;

    // Jadikan 2026/2027 non-aktif, lalu buat periode "2028/2029" ACTIVE secara manual
    await prisma.academicPeriod.update({ where: { id: newPeriodId }, data: { status: "INACTIVE" } });
    const manual = await prisma.academicPeriod.create({
      data: { schoolId, year: "2028/2029", semester: "Semester Genap", status: "ACTIVE" },
    });

    const res = await createClassAction({
      className: "8-B",
      newAcademicYear: "2026/2027",
      newAcademicSemester: "Semester Genap",
    });
    expect(res.success).toBe(true);

    const active = await prisma.academicPeriod.findMany({ where: { schoolId, status: "ACTIVE" } });
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(newPeriodId);
    expect((await prisma.academicPeriod.findUnique({ where: { id: manual.id } }))?.status).toBe(
      "INACTIVE"
    );

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ACADEMIC_PERIOD_SWITCHED", targetId: newPeriodId, metadata: { path: ["source"], equals: "reuse_inactive" } },
    });
    expect(audit).not.toBeNull();
  });

  it("A4 — Jalur academicPeriodId eksplisit TIDAK menutup periode aktif lain (semantik backfill)", async () => {
    if (!dbAvailable) return;

    // Sekolah kedua: dua periode ACTIVE secara manual (state legacy)
    const schoolB = await prisma.school.create({
      data: { name: `Sekolah Backfill S6 ${ts}`, normalizedName: `sekolah backfill s6 ${ts}` },
    });
    const periodB1 = await prisma.academicPeriod.create({
      data: { schoolId: schoolB.id, year: "2020/2021", semester: "Ganjil", status: "ACTIVE" },
    });
    const periodB2 = await prisma.academicPeriod.create({
      data: { schoolId: schoolB.id, year: "2021/2022", semester: "Ganjil", status: "ACTIVE" },
    });

    setActor({
      session: { user: { id: teacherUserId } },
      profile: { id: teacherProfileId, userId: teacherUserId },
      activeSchoolId: schoolB.id,
      activeSchool: { id: schoolB.id, name: schoolB.name },
    });

    const res = await createClassAction({ className: "X-A", academicPeriodId: periodB1.id });
    expect(res.success).toBe(true);

    const states = await prisma.academicPeriod.findMany({ where: { schoolId: schoolB.id } });
    expect(states.find((p) => p.id === periodB1.id)?.status).toBe("ACTIVE");
    expect(states.find((p) => p.id === periodB2.id)?.status).toBe("ACTIVE"); // tidak disentuh

    // No audit saklar pada jalur ini
    const audits = await prisma.auditLog.count({
      where: { action: "ACADEMIC_PERIOD_SWITCHED", actorId: teacherUserId },
    });
    const auditsMain = await prisma.auditLog.count({
      where: {
        action: "ACADEMIC_PERIOD_SWITCHED",
        metadata: { path: ["schoolId"], equals: schoolId },
      },
    });
    expect(audits).toBe(auditsMain);

    // Cleanup sekolah B
    await prisma.academicPeriod.deleteMany({ where: { schoolId: schoolB.id } });
    await prisma.class.deleteMany({ where: { schoolId: schoolB.id } });
    await prisma.subject.deleteMany({ where: { schoolId: schoolB.id } });
    await prisma.teachingContext.deleteMany({ where: { schoolId: schoolB.id } });
    await prisma.school.delete({ where: { id: schoolB.id } });

    // Kembalikan aktor ke sekolah utama
    setActor({
      session: { user: { id: teacherUserId } },
      profile: { id: teacherProfileId, userId: teacherUserId },
      activeSchoolId: schoolId,
      activeSchool: { id: schoolId, name: `Sekolah Rollover S6 ${ts}` },
    });
  });

  it("A5 — Sekolah tanpa periode aktif: fallback default-period ikut saklar + audit (jalur ketiga)", async () => {
    if (!dbAvailable) return;

    const schoolC = await prisma.school.create({
      data: { name: `Sekolah Kosong S6 ${ts}`, normalizedName: `sekolah kosong s6 ${ts}` },
    });
    setActor({
      session: { user: { id: teacherUserId } },
      profile: { id: teacherProfileId, userId: teacherUserId },
      activeSchoolId: schoolC.id,
      activeSchool: { id: schoolC.id, name: schoolC.name },
    });

    const res = await createClassAction({ className: "Y-A" });
    expect(res.success).toBe(true);

    const periods = await prisma.academicPeriod.findMany({ where: { schoolId: schoolC.id } });
    expect(periods).toHaveLength(1);
    expect(periods[0].status).toBe("ACTIVE");
    expect(periods[0].year).toBe("2024/2025");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "ACADEMIC_PERIOD_SWITCHED", targetId: periods[0].id },
    });
    expect(audit).not.toBeNull();
    expect((audit!.metadata as Record<string, unknown>).source).toBe("fallback_default");

    await prisma.academicPeriod.deleteMany({ where: { schoolId: schoolC.id } });
    await prisma.class.deleteMany({ where: { schoolId: schoolC.id } });
    await prisma.subject.deleteMany({ where: { schoolId: schoolC.id } });
    await prisma.teachingContext.deleteMany({ where: { schoolId: schoolC.id } });
    await prisma.school.delete({ where: { id: schoolC.id } });

    setActor({
      session: { user: { id: teacherUserId } },
      profile: { id: teacherProfileId, userId: teacherUserId },
      activeSchoolId: schoolId,
      activeSchool: { id: schoolId, name: `Sekolah Rollover S6 ${ts}` },
    });
  });

  it("A6 — Remediasi legacy: periode target sudah ACTIVE + periode ACTIVE warisan lain → ikut ditutup + audit", async () => {
    if (!dbAvailable) return;

    // 2026/2027 saat ini ACTIVE (hasil A3); ciptakan periode warisan ACTIVE kedua
    const legacy = await prisma.academicPeriod.create({
      data: { schoolId, year: "2029/2030", semester: "Semester Genap", status: "ACTIVE" },
    });

    const res = await createClassAction({
      className: "8-C",
      newAcademicYear: "2026/2027",
      newAcademicSemester: "Semester Genap",
    });
    expect(res.success).toBe(true);

    const active = await prisma.academicPeriod.findMany({ where: { schoolId, status: "ACTIVE" } });
    expect(active).toHaveLength(1);
    expect(active[0].year).toBe("2026/2027");
    expect((await prisma.academicPeriod.findUnique({ where: { id: legacy.id } }))?.status).toBe(
      "INACTIVE"
    );

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: "ACADEMIC_PERIOD_SWITCHED",
        metadata: { path: ["source"], equals: "reuse_active_remediation" },
      },
    });
    expect(audit).not.toBeNull();
    expect((audit!.metadata as Record<string, unknown>).closedActivePeriods).toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // B. Klaim ulang (registerStudent) — "klaim ulang; NIS & PIN tetap"
  // ─────────────────────────────────────────────────────────────────────────────

  it("B1 — Klaim ulang sukses: ACTIVE ber-PIN + kode rombel periode baru + nama exact + PIN lama → ACTIVE, enroll periode baru, ter-audit", async () => {
    if (!dbAvailable) return;

    const res = await registerStudent({
      joinCode: newJoinCode,
      fullName: "budi  rollover", // kanonik: trim + collapse whitespace + case-insensitive (BH-4/EC-8)
      nis: `s6b${ts}`, // kanonik uppercase
      pin: pinBudi, // PIN LAMA tetap
    });

    expect(res.success).toBe(true);
    if (res.success && res.status === "ACTIVE") {
      expect(res.redirect).toBe("/siswa/portal");
    }

    const db = await prisma.student.findUniqueOrThrow({ where: { id: budiId } });
    expect(db.accountStatus).toBe("ACTIVE");
    await expect(verifyPin(pinBudi, db.accessPinHash!)).resolves.toBe(true); // EC-7: tanpa await = floating assertion

    const enrollment = await prisma.classStudent.findUnique({
      where: { studentId_academicPeriodId: { studentId: budiId, academicPeriodId: newPeriodId } },
    });
    expect(enrollment).toBeDefined();
    expect(enrollment?.classId).toBe(newClassId);
    // Enrollment lama tidak hilang (riwayat utuh)
    expect(
      await prisma.classStudent.findUnique({
        where: { studentId_academicPeriodId: { studentId: budiId, academicPeriodId: oldPeriodId } },
      })
    ).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "STUDENT_RECLAIMED", targetId: budiId },
    });
    expect(audit).not.toBeNull();

    // Sesi lama hangus: token ber-pinUpdatedAt lama tidak lagi cocok dengan DB
    const oldPayload = {
      studentId: budiId,
      schoolId,
      classId: oldClassId,
      academicPeriodId: oldPeriodId,
      nis: `S6B${ts}`,
      fullName: "Budi Rollover",
      pinUpdatedAt: new Date(0).toISOString(),
    };
    const oldToken = signStudentSessionToken(oldPayload);
    const parsed = verifyStudentSessionToken(oldToken);
    expect(parsed?.pinUpdatedAt).not.toBe(db.pinUpdatedAt!.toISOString());
  });

  it("B2 — PIN salah 5x → lockout 15 menit, enrollment tak berubah, pesan generik; saat LOCKED pesan generik identik (anti-enumerasi)", async () => {
    if (!dbAvailable) return;

    const hana = await prisma.student.findUniqueOrThrow({ where: { id: hanaId } });

    let lastMessage = "";
    for (let i = 1; i <= 5; i++) {
      const res = await registerStudent({
        joinCode: newJoinCode,
        fullName: "Hana Pindah",
        nis: hana.nis!,
        pin: "0000", // salah
      });
      expect(res.success).toBe(false);
      lastMessage = res.message;
    }

    const after = await prisma.student.findUniqueOrThrow({ where: { id: hanaId } });
    expect(after.failedAttempts).toBe(5);
    expect(after.lockedUntil).not.toBeNull();
    const lockedMinutes = (after.lockedUntil!.getTime() - Date.now()) / 60000;
    expect(lockedMinutes).toBeGreaterThan(10);
    expect(lockedMinutes).toBeLessThanOrEqual(15);

    // Tidak ada enrollment baru
    expect(
      await prisma.classStudent.findUnique({
        where: { studentId_academicPeriodId: { studentId: hanaId, academicPeriodId: newPeriodId } },
      })
    ).toBeNull();

    const denied = await prisma.auditLog.findFirst({
      where: { action: "STUDENT_RECLAIM_DENIED", targetId: hanaId, metadata: { path: ["reason"], equals: "PIN_MISMATCH" } },
    });
    expect(denied).not.toBeNull();

    // Percobaan saat LOCKED: pesan SAMA persis (anti user-enumeration), nol mutasi
    const lockedRes = await registerStudent({
      joinCode: newJoinCode,
      fullName: "Hana Pindah",
      nis: hana.nis!,
      pin: "0000",
    });
    expect(lockedRes.success).toBe(false);
    expect(lockedRes.message).toBe(lastMessage);
    const afterLocked = await prisma.student.findUniqueOrThrow({ where: { id: hanaId } });
    expect(afterLocked.failedAttempts).toBe(5); // tidak bertambah saat locked
    const lockedAudit = await prisma.auditLog.findFirst({
      where: { action: "STUDENT_RECLAIM_DENIED", targetId: hanaId, metadata: { path: ["reason"], equals: "LOCKED" } },
    });
    expect(lockedAudit).not.toBeNull();
  });

  it("B3 — Klaim ulang nama beda → PENDING L1 + accountRequestedAt + enrollmen periode baru + audit", async () => {
    if (!dbAvailable) return;

    const res = await registerStudent({
      joinCode: newJoinCode,
      fullName: "Fajar Beda Nama",
      nis: `S6F${ts}`,
      pin: "1111", // PIN benar
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.status).toBe("PENDING");
      if (res.status === "PENDING") expect(res.reason).toBe("MISMATCH_NAME");
    }

    const db = await prisma.student.findUniqueOrThrow({ where: { id: fajarId } });
    expect(db.accountStatus).toBe("PENDING");
    expect(db.accountRequestedAt).not.toBeNull();

    expect(
      await prisma.classStudent.findUnique({
        where: { studentId_academicPeriodId: { studentId: fajarId, academicPeriodId: newPeriodId } },
      })
    ).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "STUDENT_RECLAIM_PENDING_NAME", targetId: fajarId },
    });
    expect(audit).not.toBeNull();
  });

  it("B4 — Gate periode INACTIVE: kode join periode lama ditolak (F1), enrollment & status tak berubah", async () => {
    if (!dbAvailable) return;

    const res = await registerStudent({
      joinCode: oldJoinCode, // periode 2025/2026 sudah INACTIVE
      fullName: "Gita Aktif",
      nis: `S6G${ts}`,
      pin: "2222",
    });

    expect(res.success).toBe(false);
    // EC-10: pesan khusus gate periode INACTIVE — arahan eksplisit (playbook §7),
    // bukan "login langsung" yang menyesatkan.
    expect(res.message).toContain("tidak berlaku untuk tahun ajaran aktif");
    expect(res.message).toContain("Minta kode join rombel yang baru");

    const db = await prisma.student.findUniqueOrThrow({ where: { id: gitaId } });
    expect(db.accountStatus).toBe("ACTIVE");
    expect(
      await prisma.classStudent.count({
        where: { studentId: gitaId, academicPeriodId: newPeriodId },
      })
    ).toBe(0);
  });

  it("B5 — PENDING ber-PIN → F1 statis tanpa cabang baru; pasca-approve komposisi klaim ulang menempel ke rombel baru", async () => {
    if (!dbAvailable) return;

    // 1) PENDING ber-PIN submit kode join periode baru → pesan statis F1 (anti-enumerasi)
    const denied = await registerStudent({
      joinCode: newJoinCode,
      fullName: "Dewi Pending",
      nis: `S6D${ts}`,
      pin: "4321",
    });
    expect(denied.success).toBe(false);
    expect(denied.message).toContain("sudah terdaftar");

    // 2) Guru approve pending periode lama (tetap sah — G-7): simulasi state hasil approve
    await prisma.student.update({
      where: { id: dewiId },
      data: {
        accountStatus: "ACTIVE",
        approvedAt: new Date(),
        approvedById: teacherUserId,
        accountRequestedAt: null,
      },
    });

    // 3) Siswa ACTIVE ber-PIN belum enroll periode aktif → klaim ulang
    const claim = await registerStudent({
      joinCode: newJoinCode,
      fullName: "Dewi Pending",
      nis: `S6D${ts}`,
      pin: "4321",
    });
    expect(claim.success).toBe(true);
    if (claim.success) expect(claim.status).toBe("ACTIVE");

    expect(
      await prisma.classStudent.findUnique({
        where: { studentId_academicPeriodId: { studentId: dewiId, academicPeriodId: newPeriodId } },
      })
    ).not.toBeNull();
  });

  it("B6 — Enroll aktif rombel lain & rombel sama → F1 (pindah rombel tetap kuasa guru, N5)", async () => {
    if (!dbAvailable) return;

    // Hana pindah ke rombel baru periode aktif (simulate: enroll manual rombel 8-A)
    await prisma.classStudent.create({
      data: { studentId: hanaId, classId: newClassId, academicPeriodId: newPeriodId },
    });

    // Reset lockout dari B2 agar akun bisa dipakai
    await prisma.student.update({
      where: { id: hanaId },
      data: { failedAttempts: 0, lockedUntil: null },
    });

    const res = await registerStudent({
      joinCode: newJoinCode, // rombel SAMA
      fullName: "Hana Pindah",
      nis: `S6H${ts}`,
      pin: "3333",
    });
    expect(res.success).toBe(false);
    expect(res.message).toContain("sudah terdaftar. Silakan login langsung");

    // Enrollment tetap menunjuk rombel sama, tidak ada duplikat
    const memberships = await prisma.classStudent.findMany({
      where: { studentId: hanaId, academicPeriodId: newPeriodId },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].classId).toBe(newClassId);

    // Varian rombel LAIN pada periode aktif yang sama (8-B dari A3): tetap ditolak —
    // perpindahan rombel hanya lewat guru (N5), kode join tidak bisa memindahkan siswa aktif
    const classB = await prisma.class.findFirstOrThrow({ where: { schoolId, name: "8-B" } });
    const joinCodeB = `S6B${ts.toString().slice(-4)}`;
    await prisma.class.update({
      where: { id: classB.id },
      data: { joinCode: joinCodeB, joinCodeLocked: false },
    });
    const resOther = await registerStudent({
      joinCode: joinCodeB,
      fullName: "Hana Pindah",
      nis: `S6H${ts}`,
      pin: "3333",
    });
    expect(resOther.success).toBe(false);
    expect(resOther.message).toContain("sudah terdaftar");

    const membershipsAfter = await prisma.classStudent.findMany({
      where: { studentId: hanaId, academicPeriodId: newPeriodId },
    });
    expect(membershipsAfter).toHaveLength(1);
    expect(membershipsAfter[0].classId).toBe(newClassId); // tak berpindah
  });

  it("B7 — REJECTED daftar ulang (G-1) regresi: PIN lama cocok → PENDING, row sama dipakai ulang", async () => {
    if (!dbAvailable) return;

    const res = await registerStudent({
      joinCode: newJoinCode,
      fullName: "Eka Rejected",
      nis: `S6E${ts}`,
      pin: "9999", // PIN lama
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.status).toBe("PENDING");
    }
    const db = await prisma.student.findUniqueOrThrow({ where: { id: ekaId } });
    expect(db.accountStatus).toBe("PENDING");
    // Row sama (bukan create baru)
    expect(await prisma.student.count({ where: { schoolId, nis: `S6E${ts}` } })).toBe(1);
  });

  it("B8 — Login pasca-rollover: resolusi sesi memprioritaskan enrollment periode AKTIF walau row lama lebih baru", async () => {
    if (!dbAvailable) return;

    // Buat row lama "lebih baru" (createdAt dimajukan) — urutan arbitrer tidak boleh menang
    await prisma.classStudent.update({
      where: { studentId_academicPeriodId: { studentId: budiId, academicPeriodId: oldPeriodId } },
      data: { createdAt: new Date(Date.now() + 60_000) },
    });

    const membership = await resolveStudentSessionMembership(budiId);
    expect(membership).not.toBeNull();
    expect(membership!.academicPeriodId).toBe(newPeriodId);
    expect(membership!.classId).toBe(newClassId);

    const res = await loginStudent({ schoolId, nis: `S6B${ts}`, pin: pinBudi });
    expect(res.success).toBe(true);
  });

  it("B12 — Fallback helper: siswa hanya ber-enrollment periode INACTIVE → helper mengembalikan row terbaru itu (VG-2)", async () => {
    if (!dbAvailable) return;

    // Siti sebelum B9: hanya punya enrollment periode lama (kini INACTIVE)
    const sitiBeforeImport = await prisma.student.findUniqueOrThrow({ where: { id: sitiId } });
    expect(sitiBeforeImport.accountStatus).toBe("ACTIVE");

    const enrollmentCountNew = await prisma.classStudent.count({
      where: { studentId: sitiId, academicPeriodId: newPeriodId },
    });
    expect(enrollmentCountNew).toBe(0); // pre-kondisi: belum enroll periode baru

    const membership = await resolveStudentSessionMembership(sitiId);
    expect(membership).not.toBeNull(); // fallback HARUS mengembalikan row lama, bukan null
    expect(membership!.academicPeriodId).toBe(oldPeriodId);
  });

  it("B9 — Login pasca-impor (jalur mayoritas): reuse-NIS impor menempel periode baru → login NIS+PIN lama sukses, sesi periode baru", async () => {
    if (!dbAvailable) return;

    // Simulasi hasil commit impor (import.service reuse deterministik by-NIS):
    // row ClassStudent periode baru dibuat untuk siswa existing — PIN & NIS tetap.
    await prisma.classStudent.create({
      data: { studentId: sitiId, classId: newClassId, academicPeriodId: newPeriodId },
    });

    const res = await loginStudent({ schoolId, nis: `S6S${ts}`, pin: "5678" });
    expect(res.success).toBe(true);

    const membership = await resolveStudentSessionMembership(sitiId);
    expect(membership!.academicPeriodId).toBe(newPeriodId);

    // Submit kode join rombel periode aktif yang sama → "login langsung" (F1)
    const rej = await registerStudent({
      joinCode: newJoinCode,
      fullName: "Siti Impor",
      nis: `S6S${ts}`,
      pin: "5678",
    });
    expect(rej.success).toBe(false);
    expect(rej.message).toContain("sudah terdaftar. Silakan login langsung");
  });

  it("B10 — Race dua klaim ulang simultan: tanpa duplikat enrollment, tanpa P2002 mentah", async () => {
    if (!dbAvailable) return;

    // Gita: ACTIVE ber-PIN, belum enroll periode baru
    const [r1, r2] = await Promise.allSettled([
      registerStudent({
        joinCode: newJoinCode,
        fullName: "Gita Aktif",
        nis: `S6G${ts}`,
        pin: "2222",
      }),
      registerStudent({
        joinCode: newJoinCode,
        fullName: "Gita Aktif",
        nis: `S6G${ts}`,
        pin: "2222",
      }),
    ]);

    const outcomes = [r1, r2].map((r) =>
      r.status === "fulfilled" ? r.value : { success: false, message: String(r.reason) }
    );

    // Minimal satu sukses; kegagalan (bila ada) berupa pesan generik — bukan error mentah
    expect(outcomes.some((o) => o.success)).toBe(true);
    for (const o of outcomes) {
      if (!o.success) {
        expect(o.message).not.toContain("P2002");
        expect(o.message).not.toContain("Unique constraint");
      }
    }

    // Invariant utama: TEPAT satu row enrollment periode baru (upsert N5 + unique)
    const memberships = await prisma.classStudent.findMany({
      where: { studentId: gitaId, academicPeriodId: newPeriodId },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0].classId).toBe(newClassId);
  });

  it("B11 — Visibilitas historis /parent/* pasca-saklar: akses konteks periode lama tetap terbaca", async () => {
    if (!dbAvailable) return;

    // Parent + relasi + akses pengajaran pada TeachingContext periode LAMA (kini INACTIVE)
    const parentUser = await prisma.user.create({
      data: {
        id: `parent-s6-${ts}`,
        email: `parent-s6-${ts}@test.com`,
        name: "Ortu Budi",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const parentProfile = await prisma.parentProfile.create({
      data: { userId: parentUser.id },
    });
    const relation = await prisma.parentStudentRelation.create({
      data: { parentProfileId: parentProfile.id, studentId: budiId, relationshipLabel: "Ayah" },
    });
    const oldContext = await prisma.teachingContext.findFirstOrThrow({
      where: { schoolId, academicPeriodId: oldPeriodId },
    });
    await prisma.parentTeachingAccess.create({
      data: {
        parentStudentRelationId: relation.id,
        teachingContextId: oldContext.id,
        grantedByTeacherProfileId: teacherProfileId,
        status: "ACTIVE",
      },
    });

    // Periode lama sudah INACTIVE (hasil saklar) — akses historis parent tetap utuh
    // (sunset /parent/*: tabel dipertahankan, kontrak rollover tak menghapus akses)
    const accessRows = await prisma.parentTeachingAccess.findMany({
      where: { parentStudentRelationId: relation.id },
      include: { teachingContext: { select: { academicPeriodId: true } } },
    });
    const historical = accessRows.find((a) => a.teachingContext.academicPeriodId === oldPeriodId);
    expect(historical).toBeDefined();
    expect(historical?.status).toBe("ACTIVE");

    // Cleanup parent entities (Restrict pada student)
    await prisma.parentTeachingAccess.deleteMany({ where: { parentStudentRelationId: relation.id } });
    await prisma.parentStudentRelation.delete({ where: { id: relation.id } });
    await prisma.parentProfile.delete({ where: { id: parentProfile.id } });
    await prisma.user.delete({ where: { id: parentUser.id } });
  });
});
