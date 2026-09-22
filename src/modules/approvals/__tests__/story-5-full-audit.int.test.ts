import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/auth";
import { verifyPin } from "@/lib/student-pin";
import { assertSessionCreationAllowed } from "@/lib/session-guards";
import {
  registerStudent,
  loginStudent,
  lookupJoinCode,
} from "../../student-auth/student-auth.actions";
import { startQuizAttemptAction, getPublicAttemptResultAction } from "../../quiz/quiz.actions";
import { getMyNotificationsAction, markMyNotificationsReadAction } from "../approvals.actions";
import {
  getPendingStudentsForClassAction,
  getPendingStudentsForSchoolAction,
  getPendingStudentsForMyClassesAction,
  approveStudentAction,
  rejectStudentAction,
  batchApproveStudentsAction,
  moveStudentClassAction,
  resetStudentPinAction,
} from "../approvals.actions";
import {
  forceApproveStudentAction,
  banTeacherAction,
  unbanTeacherAction,
  resetTeacherPasswordAction,
  deactivateSchoolAction,
  reactivateSchoolAction,
  setSchoolNpsnAction,
} from "../../admin/admin.actions";

/**
 * Story 5 — Deep Real-Database Integration & Security Audit (Neon PostgreSQL).
 *
 * Sesi guru/superadmin di-mock di tepi (@/lib/authorization & @/lib/superadmin)
 * karena mereka membaca next/headers; seluruh logika bisnis, transaksi,
 * conditional update, dan DB state diuji NYATA terhadap database.
 * Plugin admin Better Auth di-stub dengan perilaku ekuivalen (banned + revoke
 * sesi) — logika yang diuji adalah guard/ordering/audit milik Story 5.
 */

vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
}));

vi.mock("@/lib/superadmin", () => ({
  requireSuperAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    auth: {
      api: {
        banUser: vi.fn(async ({ body }: { body: { userId: string; banReason?: string } }) => {
          await actual.prisma.user.update({
            where: { id: body.userId },
            data: { banned: true, banReason: body.banReason ?? null },
          });
          await actual.prisma.session.deleteMany({ where: { userId: body.userId } });
          return { ok: true };
        }),
        unbanUser: vi.fn(async ({ body }: { body: { userId: string } }) => {
          await actual.prisma.user.update({
            where: { id: body.userId },
            data: { banned: false, banReason: null },
          });
          return { ok: true };
        }),
        setUserPassword: vi.fn(async () => ({ ok: true })),
        revokeUserSessions: vi.fn(async ({ body }: { body: { userId: string } }) => {
          await actual.prisma.session.deleteMany({ where: { userId: body.userId } });
          return [];
        }),
      },
    },
  };
});

import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { requireSuperAdmin } from "@/lib/superadmin";

const mockedVerify = vi.mocked(verifyActiveSchoolMembership);
const mockedRequireSuperAdmin = vi.mocked(requireSuperAdmin);

function setActor(actor: ActorContext) {
  mockedVerify.mockImplementation(
    async () => actor as unknown as Awaited<ReturnType<typeof verifyActiveSchoolMembership>>
  );
}

interface ActorContext {
  session: { user: { id: string } };
  profile: { id: string; userId: string };
  activeSchoolId: string;
  activeSchool: { id: string; name: string };
}

describe("Story 5 Deep Real-Database Integration & Security Audit (Neon PostgreSQL)", { timeout: 60_000 }, () => {
  let dbAvailable = false;
  const ts = Date.now();

  let schoolId: string;
  let activePeriodId: string;
  let oldPeriodId: string;

  let teacherAUserId: string; // pengampu
  let teacherAProfileId: string;
  let teacherBUserId: string; // bukan pengampu
  let teacherBProfileId: string;
  let superadminUserId: string;
  let parentUserId: string;

  let classAId: string;
  let classBId: string;
  let classOldId: string;
  let joinCodeA: string;
  let joinCodeB: string;
  let joinCodeOld: string;

  const actorA: ActorContext = {
    session: { user: { id: "" } },
    profile: { id: "", userId: "" },
    activeSchoolId: "",
    activeSchool: { id: "", name: "" },
  };
  const actorB: ActorContext = {
    session: { user: { id: "" } },
    profile: { id: "", userId: "" },
    activeSchoolId: "",
    activeSchool: { id: "", name: "" },
  };

  beforeAll(async () => {
    try {
      // 1. Sekolah + periode aktif + periode lama (G-7)
      const school = await prisma.school.create({
        data: {
          name: `Audit Story5 ${ts}`,
          normalizedName: `audit story5 ${ts}`,
          npsn: `${ts}`.slice(-8),
        },
      });
      schoolId = school.id;

      const activePeriod = await prisma.academicPeriod.create({
        data: { schoolId, year: "2026/2027", semester: "Ganjil S5", status: "ACTIVE" },
      });
      activePeriodId = activePeriod.id;

      const oldPeriod = await prisma.academicPeriod.create({
        data: { schoolId, year: "2025/2026", semester: "Genap S5", status: "INACTIVE" },
      });
      oldPeriodId = oldPeriod.id;

      // 2. Guru A (pengampu), Guru B (bukan pengampu), Superadmin, Parent
      teacherAUserId = `s5-ta-${ts}`;
      teacherBUserId = `s5-tb-${ts}`;
      superadminUserId = `s5-sa-${ts}`;
      parentUserId = `s5-pr-${ts}`;

      const userA = await prisma.user.create({
        data: { id: teacherAUserId, email: `${teacherAUserId}@test.com`, name: "Guru A", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
      });
      const userB = await prisma.user.create({
        data: { id: teacherBUserId, email: `${teacherBUserId}@test.com`, name: "Guru B", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
      });
      await prisma.user.create({
        data: { id: superadminUserId, email: `${superadminUserId}@test.com`, name: "Superadmin", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "ADMIN", role: "ADMIN" },
      });
      await prisma.user.create({
        data: { id: parentUserId, email: `${parentUserId}@test.com`, name: "Orang Tua", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
      });

      const profileA = await prisma.teacherProfile.create({
        data: { userId: userA.id, activeSchoolId: schoolId, onboardingCompleted: true },
      });
      teacherAProfileId = profileA.id;
      const profileB = await prisma.teacherProfile.create({
        data: { userId: userB.id, activeSchoolId: schoolId, onboardingCompleted: true },
      });
      teacherBProfileId = profileB.id;

      await prisma.teacherSchoolMembership.create({
        data: { teacherProfileId: profileA.id, schoolId, status: "ACTIVE", workspaceRole: "OWNER" },
      });
      await prisma.teacherSchoolMembership.create({
        data: { teacherProfileId: profileB.id, schoolId, status: "ACTIVE", workspaceRole: "MEMBER" },
      });

      // 3. Kelas A & B (periode aktif) + Kelas Old (periode lama) + TC pengampu
      const classA = await prisma.class.create({
        data: { schoolId, name: `5-A-${ts}`, gradeLevel: "5", joinCode: `S5A${`${ts}`.slice(-4)}` },
      });
      classAId = classA.id;
      joinCodeA = classA.joinCode!;

      const classB = await prisma.class.create({
        data: { schoolId, name: `5-B-${ts}`, gradeLevel: "5", joinCode: `S5B${`${ts}`.slice(-4)}` },
      });
      classBId = classB.id;
      joinCodeB = classB.joinCode!;

      const classOld = await prisma.class.create({
        data: { schoolId, name: `4-O-${ts}`, gradeLevel: "4", joinCode: `S5O${`${ts}`.slice(-4)}` },
      });
      classOldId = classOld.id;
      joinCodeOld = classOld.joinCode!;

      const subject = await prisma.subject.create({
        data: { schoolId, name: "IPA S5", normalizedName: `ipa s5 ${ts}` },
      });

      for (const [tcClass, tcPeriod] of [
        [classAId, activePeriodId],
        [classBId, activePeriodId],
        [classOldId, oldPeriodId],
      ]) {
        await prisma.teachingContext.create({
          data: {
            teacherProfileId: profileA.id,
            schoolId,
            academicPeriodId: tcPeriod,
            classId: tcClass,
            subjectId: subject.id,
          },
        });
      }

      // 4. Aktor konteks
      actorA.session.user.id = teacherAUserId;
      actorA.profile.id = teacherAProfileId;
      actorA.profile.userId = teacherAUserId;
      actorA.activeSchoolId = schoolId;
      actorA.activeSchool = { id: schoolId, name: school.name };

      actorB.session.user.id = teacherBUserId;
      actorB.profile.id = teacherBProfileId;
      actorB.profile.userId = teacherBUserId;
      actorB.activeSchoolId = schoolId;
      actorB.activeSchool = { id: schoolId, name: school.name };

      setActor(actorA);
      mockedRequireSuperAdmin.mockImplementation(async () => ({ userId: superadminUserId }));

      dbAvailable = true;
    } catch (err) {
      console.warn("[story-5 int test] DB unavailable, skipping:", err);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      await prisma.parentStudentRelation.deleteMany({ where: { parentProfile: { userId: parentUserId } } }).catch(() => {});
      await prisma.parentProfile.deleteMany({ where: { userId: parentUserId } }).catch(() => {});
      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
      // Sisa entity ter-cascade dari school; user dibuat manual — bersihkan.
      await prisma.user.deleteMany({ where: { id: { in: [teacherAUserId, teacherBUserId, superadminUserId, parentUserId] } } });
    } catch {
      /* cleanup best-effort */
    }
  });

  beforeEach(() => {
    if (!dbAvailable) return;
    setActor(actorA);
    mockedRequireSuperAdmin.mockImplementation(async () => ({ userId: superadminUserId }));
  });

  // =========================================================================
  // F1 + G-1 + G-2 — Jalur daftar ulang REJECTED
  // =========================================================================
  it("F1/G-1: register mismatch → PENDING dengan accountRequestedAt; guard (d) meloloskan pindah rombel REJECTED via UPDATE classId", async () => {
    // (b) mismatch → PENDING L1 + accountRequestedAt terisi (F2)
    const reg1 = await registerStudent({
      joinCode: joinCodeA,
      fullName: "Nama Beda S5",
      nis: `S5A${`${ts}`.slice(-6)}`,
      pin: "1234",
    });
    expect(reg1.success).toBe(true);
    if (!reg1.success || reg1.status !== "PENDING") throw new Error("register mismatch harus PENDING");

    const student = await prisma.student.findFirst({ where: { nis: `S5A${`${ts}`.slice(-6)}`, schoolId } });
    expect(student).not.toBeNull();
    expect(student!.accountStatus).toBe("PENDING");
    expect(student!.accountRequestedAt).not.toBeNull(); // F2
    const studentId = student!.id;

    // Simulasi guru menolak (reuse row — glosarium §9.2)
    const rej = await rejectStudentAction(studentId, "Nama tidak cocok");
    expect(rej.success).toBe(true);
    const afterReject = await prisma.student.findUnique({ where: { id: studentId } });
    expect(afterReject!.accountStatus).toBe("REJECTED");
    expect(afterReject!.accountRequestedAt).toBeNull(); // F2 — keputusan null-kan

    // G-1: PIN lama SALAH → tolak generik, row TIDAK disentuh + audit
    const regWrongPin = await registerStudent({
      joinCode: joinCodeA,
      fullName: "Nama Beda S5",
      nis: `S5A${`${ts}`.slice(-6)}`,
      pin: "9999",
    });
    expect(regWrongPin.success).toBe(false);
    const untouched = await prisma.student.findUnique({ where: { id: studentId } });
    expect(untouched!.accountStatus).toBe("REJECTED");
    const deniedLog = await prisma.auditLog.findFirst({ where: { action: "STUDENT_RE_REGISTER_DENIED", targetId: studentId } });
    expect(deniedLog).not.toBeNull();

    // G-2: daftar ulang (masih REJECTED) ke kode rombel BERBEDA → UPDATE classId row existing, bukan ditolak
    const regMove = await registerStudent({
      joinCode: joinCodeB,
      fullName: "Nama Beda S5",
      nis: `S5A${`${ts}`.slice(-6)}`,
      pin: "1234",
    });
    expect(regMove.success).toBe(true);
    const enrollments = await prisma.classStudent.findMany({ where: { studentId } });
    expect(enrollments.length).toBe(1); // reuse row — bukan delete-insert
    expect(enrollments[0].classId).toBe(classBId);

    // Tolak lagi, lalu G-1: PIN lama COCOK → reuse row, kembali PENDING, hygiene reset, ter-audit
    const rej2 = await rejectStudentAction(studentId, "Belum cocok");
    expect(rej2.success).toBe(true);
    const regOk = await registerStudent({
      joinCode: joinCodeB,
      fullName: "Nama Beda S5",
      nis: `S5A${`${ts}`.slice(-6)}`,
      pin: "1234",
    });
    expect(regOk.success).toBe(true);
    const reRegistered = await prisma.student.findUnique({ where: { id: studentId } });
    expect(reRegistered!.accountStatus).toBe("PENDING");
    expect(reRegistered!.accountRequestedAt).not.toBeNull();
    expect(await verifyPin("1234", reRegistered!.accessPinHash!)).toBe(true);
    const reRegLog = await prisma.auditLog.findFirst({ where: { action: "STUDENT_RE_REGISTERED", targetId: studentId } });
    expect(reRegLog).not.toBeNull();

    // Guard anti-takeover tetap keras untuk PENDING yang sudah ber-PIN
    const takeover = await registerStudent({
      joinCode: joinCodeA,
      fullName: "Penyerang S5",
      nis: `S5A${`${ts}`.slice(-6)}`,
      pin: "5555",
    });
    expect(takeover.success).toBe(false);

    // EC-11: baris REJECTED tanpa hash (legacy) tidak boleh auto-L0 maupun
    // jatuh ke cabang mismatch — wajib lewat jalur reset PIN guru dulu.
    const legacyRejected = await prisma.student.create({
      data: { schoolId, fullName: "Legacy Rejected", nis: `LR${`${ts}`.slice(-7)}`, accountStatus: "REJECTED", accessPinHash: null },
    });
    const legacyReg = await registerStudent({
      joinCode: joinCodeA,
      fullName: "Legacy Rejected",
      nis: `LR${`${ts}`.slice(-7)}`,
      pin: "1234",
    });
    expect(legacyReg.success).toBe(false);
    const legacyAfter = await prisma.student.findUnique({ where: { id: legacyRejected.id } });
    expect(legacyAfter!.accountStatus).toBe("REJECTED"); // tidak berubah
    expect(legacyAfter!.accessPinHash).toBeNull();
  });

  // =========================================================================
  // Tangga L1–L3 + F5 conditional update + F4 notifikasi
  // =========================================================================
  it("L1: approve oleh pengampu → ACTIVE + approvedById + accountRequestedAt null + audit L1, tanpa notifikasi", async () => {
    const s = await prisma.student.create({
      data: { schoolId, fullName: "Siswa L1", nis: `L1${`${ts}`.slice(-7)}`, accessPinHash: null, accountStatus: "PENDING", accountRequestedAt: new Date() },
    });
    await prisma.classStudent.create({
      data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId },
    });

    const res = await approveStudentAction(s.id);
    expect(res.success).toBe(true);
    expect((res as { approvalLevel?: string }).approvalLevel).toBe("L1");

    const updated = await prisma.student.findUnique({ where: { id: s.id } });
    expect(updated!.accountStatus).toBe("ACTIVE");
    expect(updated!.approvedById).toBe(teacherAUserId);
    expect(updated!.approvedAt).not.toBeNull();
    expect(updated!.accountRequestedAt).toBeNull();

    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_ACCOUNT_APPROVED", targetId: s.id } });
    expect(log).not.toBeNull();
    expect((log!.metadata as { approvalLevel?: string }).approvalLevel).toBe("L1");

    // F4: approve L1 TIDAK memicu notifikasi (bukan eskalasi L2)
    const notifs = await prisma.notification.findMany({ where: { schoolId, type: "STUDENT_APPROVAL_L2" } });
    expect(notifs.length).toBe(0);
  });

  it("F5: double-approve → transisi kedua ditolak generik (conditional update count=0), tanpa duplikat audit", async () => {
    const s = await prisma.student.create({
      data: { schoolId, fullName: "Siswa Race", nis: `RC${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() },
    });
    await prisma.classStudent.create({
      data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId },
    });

    const first = await approveStudentAction(s.id);
    expect(first.success).toBe(true);

    // Transisi kedua pada siswa yang sudah tidak PENDING → count 0 → gagal generik
    const second = await approveStudentAction(s.id);
    expect(second.success).toBe(false);

    const logs = await prisma.auditLog.count({ where: { action: "STUDENT_ACCOUNT_APPROVED", targetId: s.id } });
    expect(logs).toBe(1); // tanpa duplikat
  });

  it("L2 + F4: approve oleh non-pengampu → audit L2 + tepat SATU notifikasi ringkasan per guru (aktor dikecualikan)", async () => {
    const s = await prisma.student.create({
      data: { schoolId, fullName: "Siswa L2", nis: `L2${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() },
    });
    await prisma.classStudent.create({
      data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId },
    });

    // Actor B (bukan pengampu rombel manapun) → jalur L2
    setActor(actorB);
    const res = await approveStudentAction(s.id);
    expect(res.success).toBe(true);
    expect((res as { approvalLevel?: string }).approvalLevel).toBe("L2");

    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_ACCOUNT_APPROVED", targetId: s.id } });
    expect((log!.metadata as { approvalLevel?: string }).approvalLevel).toBe("L2");

    // Satu notifikasi ringkasan untuk Guru A; aktor (Guru B) tidak menotifikasi diri sendiri
    const notifsA = await prisma.notification.findMany({ where: { userId: teacherAUserId, type: "STUDENT_APPROVAL_L2" } });
    expect(notifsA.length).toBe(1);
    const notifsB = await prisma.notification.findMany({ where: { userId: teacherBUserId, type: "STUDENT_APPROVAL_L2" } });
    expect(notifsB.length).toBe(0);
  });

  it("N6/OQ-2/G-8/BH-2: batch → baris valid ter-approve + kalah race dilaporkan; notifikasi hanya bila ada baris L2; >100 ditolak", async () => {
    const s1 = await prisma.student.create({ data: { schoolId, fullName: "B1", nis: `B1${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
    const s2 = await prisma.student.create({ data: { schoolId, fullName: "B2", nis: `B2${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
    const s3 = await prisma.student.create({ data: { schoolId, fullName: "B3", nis: `B3${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
    for (const sid of [s1.id, s2.id, s3.id]) {
      await prisma.classStudent.create({ data: { studentId: sid, classId: classAId, academicPeriodId: activePeriodId } });
    }
    // s4 di rombel yang TIDAK diampui aktor (Guru B pengampu) → baris L2 dalam batch
    const classC = await prisma.class.create({ data: { schoolId, name: `5-C-${ts}`, gradeLevel: "5" } });
    const subjectC = await prisma.subject.create({ data: { schoolId, name: "BA S5", normalizedName: `ba s5 ${ts}` } });
    await prisma.teachingContext.create({
      data: { teacherProfileId: teacherBProfileId, schoolId, academicPeriodId: activePeriodId, classId: classC.id, subjectId: subjectC.id },
    });
    const s4 = await prisma.student.create({ data: { schoolId, fullName: "B4", nis: `B4${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
    await prisma.classStudent.create({ data: { studentId: s4.id, classId: classC.id, academicPeriodId: activePeriodId } });

    // s2 di-approve konkuren SEBELUM batch → kalah race → dilaporkan
    await prisma.student.update({ where: { id: s2.id }, data: { accountStatus: "ACTIVE" } });

    const res = await batchApproveStudentsAction([s1.id, s2.id, s3.id, s4.id]);
    expect(res.success).toBe(true);
    expect(res.approvedCount).toBe(3);
    expect(res.failed).toContainEqual({ studentId: s2.id });

    const approvedLogs = await prisma.auditLog.count({
      where: { action: "STUDENT_ACCOUNT_APPROVED", targetId: { in: [s1.id, s3.id, s4.id] }, metadata: { path: ["batch"], equals: true } },
    });
    expect(approvedLogs).toBe(3); // AuditLog per-baris sukses (N6)

    // BH-2: level per-baris — s1/s3 di rombel aktor = L1; s4 = L2
    const lvl = async (sid: string) => {
      const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_ACCOUNT_APPROVED", targetId: sid } });
      return (log?.metadata as { approvalLevel?: string } | null)?.approvalLevel;
    };
    expect(await lvl(s1.id)).toBe("L1");
    expect(await lvl(s4.id)).toBe("L2");

    // F4: TEPAT satu notifikasi ringkasan (karena ada baris L2); aktor dikecualikan
    const notifsB = await prisma.notification.count({ where: { userId: teacherBUserId, type: "STUDENT_APPROVAL_L2", payload: { path: ["count"], equals: 3 } } });
    expect(notifsB).toBe(1);
    const notifsA = await prisma.notification.count({ where: { userId: teacherAUserId, type: "STUDENT_APPROVAL_L2", payload: { path: ["count"], equals: 3 } } });
    expect(notifsA).toBe(0);

    // BH-2 kontrast: batch murni pengampu (semua L1) TIDAK menambah notifikasi
    const notifBaseline = await prisma.notification.count({ where: { schoolId, type: "STUDENT_APPROVAL_L2" } });
    const s5 = await prisma.student.create({ data: { schoolId, fullName: "B5", nis: `B5${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
    await prisma.classStudent.create({ data: { studentId: s5.id, classId: classAId, academicPeriodId: activePeriodId } });
    const resL1 = await batchApproveStudentsAction([s5.id]);
    expect(resL1.success).toBe(true);
    const notifsAfterL1 = await prisma.notification.count({ where: { schoolId, type: "STUDENT_APPROVAL_L2" } });
    expect(notifsAfterL1).toBe(notifBaseline);

    // VG-6: jalur baca/badge — penerima (Guru B) melihat 1 unread lalu nol setelah mark-read
    setActor(actorB);
    const feed = await getMyNotificationsAction();
    expect(feed.unreadCount).toBeGreaterThanOrEqual(1);
    const marked = await markMyNotificationsReadAction();
    expect(marked.count).toBeGreaterThanOrEqual(1);
    const feedAfter = await getMyNotificationsAction();
    expect(feedAfter.unreadCount).toBe(0);
    setActor(actorA);

    // G-8: batch 101 baris ditolak generik + ter-audit, nol baris dieksekusi
    const oversize = await batchApproveStudentsAction(Array.from({ length: 101 }, (_, i) => `fake-${i}`));
    expect(oversize.success).toBe(false);
    expect(oversize.approvedCount).toBe(0);
    const limitLog = await prisma.auditLog.findFirst({ where: { action: "BATCH_APPROVE_LIMIT_REJECTED" } });
    expect(limitLog).not.toBeNull();
  });

  it("G-7: L2 tanpa filter periode — pending periode lampau tetap tampil; L1 tetap ter-scope periode aktif", async () => {
    // PENDING di periode LAMA
    const sOld = await prisma.student.create({ data: { schoolId, fullName: "Pending Lama", nis: `OL${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() } });
    await prisma.classStudent.create({ data: { studentId: sOld.id, classId: classOldId, academicPeriodId: oldPeriodId } });

    // PENDING di periode aktif
    const sNew = await prisma.student.create({ data: { schoolId, fullName: "Pending Baru", nis: `NW${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() } });
    await prisma.classStudent.create({ data: { studentId: sNew.id, classId: classAId, academicPeriodId: activePeriodId } });

    // L2 sekolah-wide: keduanya tampil
    const l2 = await getPendingStudentsForSchoolAction();
    expect(l2.success).toBe(true);
    const l2Ids = l2.pending.map((p) => p.studentId);
    expect(l2Ids).toContain(sOld.id);
    expect(l2Ids).toContain(sNew.id);

    // L1 per-rombel: hanya periode aktif (sOld tidak muncul di classA/classB)
    const l1 = await getPendingStudentsForClassAction(classAId);
    expect(l1.success).toBe(true);
    expect(l1.pending.map((p) => p.studentId)).toContain(sNew.id);
    expect(l1.pending.map((p) => p.studentId)).not.toContain(sOld.id);

    // L1 multi-rombel (tab Daftar Siswa)
    const mine = await getPendingStudentsForMyClassesAction();
    expect(mine.pending.map((p) => p.studentId)).toContain(sNew.id);
  });

  it("L1 matrix: guru bukan pengampu ditolak server-side di panel L1", async () => {
    setActor(actorB);
    const res = await getPendingStudentsForClassAction(classAId);
    expect(res.success).toBe(false);
    expect(res.note).toBe("NOT_PENGAMPU");
  });

  // =========================================================================
  // N5/F12 — Pindah rombel
  // =========================================================================
  it("N5/F12: pindah rombel = UPDATE classId row existing; kuasa pengampu sumber/tujuan; guru asing ditolak", async () => {
    const s = await prisma.student.create({ data: { schoolId, fullName: "Pindah", nis: `MV${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
    const row = await prisma.classStudent.create({ data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId } });

    // Pengampu sumber (Guru A) dipindah ke rombel tujuan B
    const resA = await moveStudentClassAction(s.id, classBId);
    expect(resA.success).toBe(true);
    const after = await prisma.classStudent.findUnique({ where: { id: row.id } });
    expect(after!.classId).toBe(classBId);
    expect(after!.academicPeriodId).toBe(activePeriodId); // @@unique terjaga

    // Guru asing (B, bukan pengampu sumber/tujuan mana pun) → ditolak
    setActor(actorB);
    const resB = await moveStudentClassAction(s.id, classAId);
    expect(resB.success).toBe(false);
    setActor(actorA); // pulihkan aktor — jangan bocor ke asersi berikutnya

    // Audit
    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_CLASS_MOVED", targetId: s.id } });
    expect(log).not.toBeNull();

    // EC-10: pending periode LAMPAU (G-7) dipindah ke rombel periode aktif →
    // row BARU periode aktif dibuat; row lama tidak dimutasi jadi inkoheren.
    const sOld = await prisma.student.create({ data: { schoolId, fullName: "Pindah Lama", nis: `ML${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
    const oldRow = await prisma.classStudent.create({ data: { studentId: sOld.id, classId: classOldId, academicPeriodId: oldPeriodId } });
    const resOld = await moveStudentClassAction(sOld.id, classBId);
    expect(resOld.success).toBe(true);
    const oldRowAfter = await prisma.classStudent.findUnique({ where: { id: oldRow.id } });
    expect(oldRowAfter!.classId).toBe(classOldId); // row lama utuh
    expect(oldRowAfter!.academicPeriodId).toBe(oldPeriodId);
    const newRow = await prisma.classStudent.findFirst({
      where: { studentId: sOld.id, academicPeriodId: activePeriodId },
    });
    expect(newRow).not.toBeNull();
    expect(newRow!.classId).toBe(classBId);
  });

  // =========================================================================
  // B2/OQ-4/F8/G-1 — Reset PIN
  // =========================================================================
  it("B2/F8: reset PIN oleh pengampu → hygiene lengkap satu transaksi; non-pengampu & PIN sama ditolak; REJECTED bisa direset (G-1)", async () => {
    const s = await prisma.student.create({
      data: { schoolId, fullName: "Reset Pin", nis: `RP${`${ts}`.slice(-7)}`, accountStatus: "PENDING", failedAttempts: 3, lockedUntil: new Date(Date.now() + 10 * 60 * 1000) },
    });
    await prisma.classStudent.create({ data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId } });
    // Isi PIN lama "1234"
    const { hashPin } = await import("@/lib/student-pin");
    await prisma.student.update({ where: { id: s.id }, data: { accessPinHash: await hashPin("1234") } });

    // Non-pengampu (Guru B) → ditolak server-side
    setActor(actorB);
    const denied = await resetStudentPinAction(s.id, "5678");
    expect(denied.success).toBe(false);
    expect(denied.message).not.toContain("1234");

    // Pengampu (Guru A): PIN sama dengan lama → ditolak
    setActor(actorA);
    const same = await resetStudentPinAction(s.id, "1234");
    expect(same.success).toBe(false);
    expect(same.message).toContain("tidak boleh sama");

    // PIN baru → sukses; hygiene lengkap
    const ok = await resetStudentPinAction(s.id, "5678");
    expect(ok.success).toBe(true);
    const after = await prisma.student.findUnique({ where: { id: s.id } });
    expect(await verifyPin("5678", after!.accessPinHash!)).toBe(true);
    expect(await verifyPin("1234", after!.accessPinHash!)).toBe(false);
    expect(after!.failedAttempts).toBe(0);
    expect(after!.lockedUntil).toBeNull();
    expect(after!.pinUpdatedAt).not.toBeNull();
    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_PIN_RESET", targetId: s.id } });
    expect(log).not.toBeNull();
    // metadata bebas PIN/hash (N4)
    const meta = JSON.stringify(log!.metadata);
    expect(meta).not.toContain("5678");
  });

  // =========================================================================
  // CAP-7 Superadmin: force approve, ban/reset password (F6/G-3/B5/G-11)
  // =========================================================================
  it("L3: force approve oleh superadmin + audit aktor SUPERADMIN", async () => {
    const s = await prisma.student.create({ data: { schoolId, fullName: "Force", nis: `FC${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() } });
    const res = await forceApproveStudentAction(s.id);
    expect(res.success).toBe(true);
    const updated = await prisma.student.findUnique({ where: { id: s.id } });
    expect(updated!.accountStatus).toBe("ACTIVE");
    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_ACCOUNT_FORCE_APPROVED", targetId: s.id } });
    expect(log!.actorType).toBe("SUPERADMIN");
  });

  it("B5/F6: ban guru → SEMUA sesi revoked + audit; ban target ADMIN ditolak keras (F6)", async () => {
    // Sesi aktif guru B
    await prisma.session.create({
      data: { id: `sess-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: `tok-${ts}`, createdAt: new Date(), updatedAt: new Date(), userId: teacherBUserId },
    });

    const res = await banTeacherAction(teacherBUserId, "Pelanggaran");
    expect(res.success).toBe(true);
    const user = await prisma.user.findUnique({ where: { id: teacherBUserId } });
    expect(user!.banned).toBe(true);
    const sessions = await prisma.session.count({ where: { userId: teacherBUserId } });
    expect(sessions).toBe(0); // B5 — revoke SEMUA sesi
    const log = await prisma.auditLog.findFirst({ where: { action: "TEACHER_BANNED", targetId: teacherBUserId } });
    expect(log).not.toBeNull();

    // Unban
    const unban = await unbanTeacherAction(teacherBUserId);
    expect(unban.success).toBe(true);

    // F6: ban superadmin → ditolak + audit
    const banAdmin = await banTeacherAction(superadminUserId, "coba");
    expect(banAdmin.success).toBe(false);
    const denyLog = await prisma.auditLog.findFirst({ where: { action: "TEACHER_BAN_DENIED", targetId: superadminUserId } });
    expect(denyLog).not.toBeNull();
    const sa = await prisma.user.findUnique({ where: { id: superadminUserId } });
    expect(sa!.banned).toBe(false);
  });

  it("B5/G-3: reset password guru sukses + revoke sesi; reset password ADMIN ditolak keras (G-3)", async () => {
    await prisma.session.create({
      data: { id: `sess2-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: `tok2-${ts}`, createdAt: new Date(), updatedAt: new Date(), userId: teacherBUserId },
    });

    const res = await resetTeacherPasswordAction(teacherBUserId, "PasswordBaru123");
    expect(res.success).toBe(true);
    const sessions = await prisma.session.count({ where: { userId: teacherBUserId } });
    expect(sessions).toBe(0);
    const log = await prisma.auditLog.findFirst({ where: { action: "TEACHER_PASSWORD_RESET", targetId: teacherBUserId } });
    expect(log).not.toBeNull();

    // G-3: guard identik untuk reset password terhadap ADMIN
    const denied = await resetTeacherPasswordAction(superadminUserId, "PasswordBaru123");
    expect(denied.success).toBe(false);
    const denyLog = await prisma.auditLog.findFirst({ where: { action: "TEACHER_PASSWORD_RESET_DENIED", targetId: superadminUserId } });
    expect(denyLog).not.toBeNull();
  });

  // =========================================================================
  // B5/F7/G-5/G-6/G-4 — Siklus nonaktif sekolah
  // =========================================================================
  it("B5/F7/G-5: nonaktif sekolah → urutan aman, npsn clear, sesi revoked, semua gerbang fail-closed", { timeout: 60_000 }, async () => {
    // Sesi aktif guru A + parent
    await prisma.session.create({
      data: { id: `sessA-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: `tokA-${ts}`, createdAt: new Date(), updatedAt: new Date(), userId: teacherAUserId },
    });
    await prisma.session.create({
      data: { id: `sessP-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: `tokP-${ts}`, createdAt: new Date(), updatedAt: new Date(), userId: parentUserId },
    });

    // Parent profile + relasi ke siswa sekolah ini (G-5)
    const studentForParent = await prisma.student.create({
      data: { schoolId, fullName: "Anak Ortu", nis: `OP${`${ts}`.slice(-7)}`, accountStatus: "ACTIVE" },
    });
    const parentProfile = await prisma.parentProfile.create({ data: { userId: parentUserId } });
    await prisma.parentStudentRelation.create({ data: { parentProfileId: parentProfile.id, studentId: studentForParent.id } });

    // Kuis PUBLISHED sekolah ini (G-4)
    const tc = await prisma.teachingContext.findFirst({ where: { schoolId, academicPeriodId: activePeriodId } });
    const quiz = await prisma.quiz.create({
      data: {
        teachingContextId: tc!.id,
        title: "Kuis S5",
        status: "PUBLISHED",
        shareToken: `s5tok${ts}`,
        validFrom: new Date(Date.now() - 3600000),
        deadline: new Date(Date.now() + 86400000),
        accessMode: "CLASSROOM_PIN",
        classroomPin: "1111",
      },
    });

    // Siswa ACTIVE untuk roster quiz
    const quizStudent = await prisma.student.create({
      data: { schoolId, fullName: "Siswa Quiz", nis: `QZ${`${ts}`.slice(-7)}`, accountStatus: "ACTIVE", accessPinHash: null },
    });
    await prisma.classStudent.create({ data: { studentId: quizStudent.id, classId: tc!.classId, academicPeriodId: activePeriodId } });

    // Sanity: sebelum nonaktif, gerbang quiz TIDAK menjawab "tidak ditemukan"
    const before = await startQuizAttemptAction(`s5tok${ts}`, quizStudent.id, "1111");
    expect(before.error).not.toBe("Quiz tidak ditemukan");

    // === Deaktivasi ===
    const res = await deactivateSchoolAction(schoolId);
    expect(res.success).toBe(true);

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    expect(school!.deactivatedAt).not.toBeNull();
    expect(school!.npsn).toBeNull(); // B5 — clear npsn

    // Sesi guru & parent revoked (B5)
    expect(await prisma.session.count({ where: { userId: teacherAUserId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: parentUserId } })).toBe(0);

    // AuditLog
    const log = await prisma.auditLog.findFirst({ where: { action: "SCHOOL_DEACTIVATED", targetId: schoolId } });
    expect(log).not.toBeNull();

    // G-4: kuis publik fail-closed generik
    const after = await startQuizAttemptAction(`s5tok${ts}`, quizStudent.id, "1111");
    expect(after.success).toBe(false);
    expect(after.error).toBe("Quiz tidak ditemukan");

    // VG-5: hasil/pembahasan publik juga fail-closed (missing-adoption diperbaiki)
    const resultAfter = await getPublicAttemptResultAction(`s5tok${ts}`, quizStudent.id);
    expect(resultAfter.success).toBe(false);
    expect(resultAfter.error).toBe("Quiz tidak ditemukan");

    // F7: loginStudent → generic (setelah PIN verify — timing seragam)
    const student = await prisma.student.findFirst({ where: { nis: `QZ${`${ts}`.slice(-7)}`, schoolId } });
    await prisma.student.update({ where: { id: student!.id }, data: { accessPinHash: await (async () => (await import("@/lib/student-pin")).hashPin("1234"))() } });
    const login = await loginStudent({ schoolId, nis: `QZ${`${ts}`.slice(-7)}`, pin: "1234" });
    expect(login.success).toBe(false);

    // F7: registerStudent & lookupJoinCode fail-closed generik
    const reg = await registerStudent({ joinCode: joinCodeA, fullName: "Baru S5", nis: `NB${`${ts}`.slice(-6)}`, pin: "1234" });
    expect(reg.success).toBe(false);
    const lookup = await lookupJoinCode(joinCodeA);
    expect(lookup.success).toBe(false);

    // G-5/OQ-6: hook sesi baru guru DAN parent ditolak
    expect(await assertSessionCreationAllowed(teacherAUserId)).toBe(false);
    expect(await assertSessionCreationAllowed(parentUserId)).toBe(false);

    // ===== G-6: reaktivasi tanpa NPSN + konflik NPSN tertangani generik =====
    const react = await reactivateSchoolAction(schoolId);
    expect(react.success).toBe(true);
    const reactivated = await prisma.school.findUnique({ where: { id: schoolId } });
    expect(reactivated!.deactivatedAt).toBeNull();
    expect(reactivated!.npsn).toBeNull(); // G-6 — tetap null

    // G-6: NPSN sudah diklaim sekolah lain → pengisian ulang gagal generik, tanpa P2002 mentah
    const otherSchool = await prisma.school.create({
      data: { name: `Perebut NPSN ${ts}`, normalizedName: `perebut npsn ${ts}`, npsn: `${ts}`.slice(-8) },
    });
    const conflict = await setSchoolNpsnAction(schoolId, `${ts}`.slice(-8));
    expect(conflict.success).toBe(false);
    expect(conflict.message).toContain("NPSN sudah terdaftar");
    await prisma.school.delete({ where: { id: otherSchool.id } });

    // G-6: isi NPSN unik → sukses; hook sesi guru mengizinkan kembali
    const setOk = await setSchoolNpsnAction(schoolId, `8${`${ts}`.slice(-7)}`);
    expect(setOk.success).toBe(true);
    expect(await assertSessionCreationAllowed(teacherAUserId)).toBe(true);
  });
});
