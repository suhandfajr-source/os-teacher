import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/auth";
import { signStudentSessionToken, verifyStudentSession } from "@/modules/student-auth/student-session";
import { SuperAdminRequiredError } from "@/lib/superadmin";

/**
 * Story 5 — Verifikasi choke-point fail-closed sesi EXISTING (F7) dan guard
 * superadmin dengan audit `ADMIN_ACCESS_DENIED` ber-dedup (OQ-7/F10/G-9).
 *
 * `next/headers` (cookies/headers) di-mock agar choke-point nyata
 * (`verifyStudentSession`, `verifyParentStudentRelation`, `requireSuperAdmin`)
 * tereksekusi penuh; DB tetap real.
 */

const cookieStore: Record<string, { value: string }> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => cookieStore[name],
    set: vi.fn(),
    delete: vi.fn((name: string) => {
      delete cookieStore[name];
    }),
  })),
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    auth: {
      api: {
        getSession: vi.fn(async () => mockedSession),
      },
    },
  };
});

import { requireSuperAdmin } from "@/lib/superadmin";
import { verifyParentStudentRelation } from "@/lib/authorization";
import { getParentAuthorizedContexts } from "@/modules/parent/parent.service";

let mockedSession: { user: { id: string } } | null = null;

describe("Story 5 — fail-closed sesi existing & guard superadmin ber-audit", () => {
  let dbAvailable = false;
  const ts = Date.now();
  let schoolId: string;
  let studentId: string;
  let studentToken: string;
  let parentUserId: string;
  let teacherNonAdminId: string;

  beforeAll(async () => {
    try {
      const school = await prisma.school.create({
        data: { name: `S5 Guard ${ts}`, normalizedName: `s5 guard ${ts}` },
      });
      schoolId = school.id;

      const student = await prisma.student.create({
        data: {
          schoolId,
          fullName: "Siswa Guard",
          nis: `GD${`${ts}`.slice(-7)}`,
          accountStatus: "ACTIVE",
          status: "ACTIVE",
          pinUpdatedAt: new Date(),
        },
      });
      studentId = student.id;

      // Token sesi siswa valid (HMAC asli via signStudentSessionToken)
      studentToken = signStudentSessionToken({
        studentId,
        schoolId,
        classId: "c",
        academicPeriodId: "p",
        nis: student.nis!,
        fullName: student.fullName,
        pinUpdatedAt: student.pinUpdatedAt!.toISOString(),
      });

      parentUserId = `s5g-pr-${ts}`;
      teacherNonAdminId = `s5g-ta-${ts}`;
      await prisma.user.create({
        data: { id: parentUserId, email: `${parentUserId}@test.com`, name: "Ortu Guard", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
      });
      await prisma.user.create({
        data: { id: teacherNonAdminId, email: `${teacherNonAdminId}@test.com`, name: "Guru Guard", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "MODERATOR", role: "MODERATOR" },
      });
      const parentProfile = await prisma.parentProfile.create({ data: { userId: parentUserId } });
      await prisma.parentStudentRelation.create({
        data: { parentProfileId: parentProfile.id, studentId },
      });

      dbAvailable = true;
    } catch (err) {
      console.warn("[s5 guard test] DB unavailable:", err);
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      await prisma.parentStudentRelation.deleteMany({ where: { student: { schoolId } } });
      await prisma.parentProfile.deleteMany({ where: { userId: parentUserId } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: [teacherNonAdminId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [parentUserId, teacherNonAdminId] } } });
      await prisma.student.delete({ where: { id: studentId } });
      await prisma.school.delete({ where: { id: schoolId } });
    } catch {
      /* best-effort */
    }
  });

  beforeEach(() => {
    if (!dbAvailable) return;
    Object.keys(cookieStore).forEach((k) => delete cookieStore[k]);
    delete cookieStore["better-auth.session_token"];
  });

  it("F7: sesi existing siswa valid → terverifikasi; sekolah nonaktif → null seketika", async () => {
    cookieStore["klassa_student_session"] = { value: studentToken };

    const before = await verifyStudentSession();
    expect(before).not.toBeNull();
    expect(before!.studentId).toBe(studentId);

    // Nonaktifkan sekolah
    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: new Date() } });
    const during = await verifyStudentSession();
    expect(during).toBeNull(); // fail-closed tanpa revoke token

    // Reaktivasi → sesi valid kembali (skema reaktivasi G-6)
    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: null } });
    const after = await verifyStudentSession();
    expect(after).not.toBeNull();
  });

  it("Glosarium §9.2: sesi siswa PENDING → null (accountStatus gate tetap kaku)", async () => {
    cookieStore["klassa_student_session"] = { value: studentToken };
    await prisma.student.update({ where: { id: studentId }, data: { accountStatus: "PENDING" } });
    const res = await verifyStudentSession();
    expect(res).toBeNull();
    await prisma.student.update({ where: { id: studentId }, data: { accountStatus: "ACTIVE" } });
  });

  it("F7: layanan baca parent fail-closed saat sekolah nonaktif", async () => {
    mockedSession = { user: { id: parentUserId } };

    const before = await verifyParentStudentRelation(studentId);
    expect(before.relation.student.id).toBe(studentId);

    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: new Date() } });
    await expect(verifyParentStudentRelation(studentId)).rejects.toThrow();
    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: null } });
  });

  it("VG-1/F7: getParentAuthorizedContexts fail-closed saat sekolah nonaktif", async () => {
    mockedSession = { user: { id: parentUserId } };

    // Setup: guru + subject + teachingContext + parentTeachingAccess ACTIVE
    const teacherUser = await prisma.user.create({
      data: { id: `s5g-tc-${ts}`, email: `s5g-tc-${ts}@test.com`, name: "Guru Konteks", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
    });
    const teacherProfile = await prisma.teacherProfile.create({ data: { userId: teacherUser.id, activeSchoolId: schoolId, onboardingCompleted: true } });
    const subject = await prisma.subject.create({ data: { schoolId, name: "Guard Mapel", normalizedName: `guard mapel ${ts}` } });
    const period = await prisma.academicPeriod.create({ data: { schoolId, year: "2026/2027", semester: "Guard", status: "ACTIVE" } });
    const klass = await prisma.class.create({ data: { schoolId, name: `Guard-${ts}` } });
    const tc = await prisma.teachingContext.create({
      data: { teacherProfileId: teacherProfile.id, schoolId, academicPeriodId: period.id, classId: klass.id, subjectId: subject.id },
    });
    const parentProfile = await prisma.parentProfile.findFirstOrThrow({ where: { userId: parentUserId } });
    const relation = await prisma.parentStudentRelation.findFirstOrThrow({ where: { parentProfileId: parentProfile.id, studentId } });
    await prisma.parentTeachingAccess.create({
      data: { parentStudentRelationId: relation.id, teachingContextId: tc.id, grantedByTeacherProfileId: teacherProfile.id, status: "ACTIVE" },
    });

    // Sekolah aktif → konteks terlihat
    const before = await getParentAuthorizedContexts(parentProfile.id);
    expect(before.length).toBe(1);

    // Nonaktif → kosong (fail-closed); reaktivasi → kembali
    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: new Date() } });
    const during = await getParentAuthorizedContexts(parentProfile.id);
    expect(during.length).toBe(0);
    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: null } });
    const after = await getParentAuthorizedContexts(parentProfile.id);
    expect(after.length).toBe(1);

    // Cleanup entitas setup
    await prisma.parentTeachingAccess.deleteMany({ where: { parentStudentRelationId: relation.id } });
    await prisma.teachingContext.delete({ where: { id: tc.id } });
    await prisma.class.delete({ where: { id: klass.id } });
    await prisma.academicPeriod.delete({ where: { id: period.id } });
    await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.teacherProfile.delete({ where: { id: teacherProfile.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: teacherUser.id } }).catch(() => {});
  });

  it("OQ-7/F10/G-9: guard deny-by-default (MODERATOR tertolak), tanpa sesi ditolak, denial ter-audit ber-dedup 60 detik", async () => {
    // Sesi valid guru dengan platformRole "MODERATOR" → deny + audit
    mockedSession = { user: { id: teacherNonAdminId } };

    await expect(requireSuperAdmin()).rejects.toBeInstanceOf(SuperAdminRequiredError);
    await expect(requireSuperAdmin()).rejects.toBeInstanceOf(SuperAdminRequiredError);
    await expect(requireSuperAdmin()).rejects.toBeInstanceOf(SuperAdminRequiredError);

    // Dedup 60 detik: 3x denial → hanya 1 entri audit
    const logs = await prisma.auditLog.count({
      where: { actorId: teacherNonAdminId, action: "ADMIN_ACCESS_DENIED" },
    });
    expect(logs).toBe(1);

    // Tanpa sesi → denied (tanpa menulis audit baru — bukan sesi valid)
    mockedSession = null;
    const logsBefore = await prisma.auditLog.count({
      where: { actorId: teacherNonAdminId, action: "ADMIN_ACCESS_DENIED" },
    });
    await expect(requireSuperAdmin()).rejects.toBeInstanceOf(SuperAdminRequiredError);
    const logsAfter = await prisma.auditLog.count({
      where: { actorId: teacherNonAdminId, action: "ADMIN_ACCESS_DENIED" },
    });
    expect(logsAfter).toBe(logsBefore);

    // Superadmin sah (fallback DB lookup) → lolos
    const superadmin = await prisma.user.findFirst({ where: { platformRole: "ADMIN" } });
    if (superadmin) {
      mockedSession = { user: { id: superadmin.id } };
      const ctx = await requireSuperAdmin();
      expect(ctx.userId).toBe(superadmin.id);
    }
  });
});
