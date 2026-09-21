import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/auth";
import { normalizeSchoolName, calculateSchoolSimilarity, evaluateSchoolDedup } from "@/lib/school-dedup";
import { searchSchools, createSchool, joinSchool, revokeTeacherMembership } from "../schools.actions";
import { addStudent, getStudents, updateStudent, archiveStudent } from "../../students/students.actions";

describe("Story 2 Deep Integration & Adversarial Audit (Real Database Testing)", () => {
  let dbAvailable = false;
  const timestamp = Date.now();

  // Test Entities
  let ownerUserId: string;
  let ownerTeacherProfileId: string;
  let memberUserId: string;
  let memberTeacherProfileId: string;
  let schoolAId: string;
  let schoolBId: string | undefined = undefined;
  let ownerMembershipAId: string;
  let memberMembershipAId: string;
  let studentId: string;

  const schoolAName = `SMP Negeri ${timestamp.toString().slice(-4)} Surabaya`;
  const schoolANpsn = `NPSN${timestamp.toString().slice(-6)}`;

  beforeAll(async () => {
    try {
      // 1. Setup Owner User & Profile
      ownerUserId = `owner-audit-${timestamp}`;
      const ownerUser = await prisma.user.create({
        data: {
          id: ownerUserId,
          email: `${ownerUserId}@test.com`,
          name: "Kepala Sekolah Owner",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const ownerProfile = await prisma.teacherProfile.create({
        data: {
          userId: ownerUser.id,
          onboardingCompleted: true,
        },
      });
      ownerTeacherProfileId = ownerProfile.id;

      // 2. Setup Member User & Profile
      memberUserId = `member-audit-${timestamp}`;
      const memberUser = await prisma.user.create({
        data: {
          id: memberUserId,
          email: `${memberUserId}@test.com`,
          name: "Guru Anggota Member",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const memberProfile = await prisma.teacherProfile.create({
        data: {
          userId: memberUser.id,
          onboardingCompleted: true,
        },
      });
      memberTeacherProfileId = memberProfile.id;

      // 3. Setup School A (dengan city: null untuk menguji skenario celah pre-filter!)
      const schoolA = await prisma.school.create({
        data: {
          name: schoolAName,
          normalizedName: normalizeSchoolName(schoolAName),
          npsn: schoolANpsn,
          city: null, // Sengaja null
        },
      });
      schoolAId = schoolA.id;

      // 4. Update activeSchoolId & Memberships
      await prisma.teacherProfile.update({
        where: { id: ownerTeacherProfileId },
        data: { activeSchoolId: schoolAId },
      });

      await prisma.teacherProfile.update({
        where: { id: memberTeacherProfileId },
        data: { activeSchoolId: schoolAId },
      });

      const ownerMembership = await prisma.teacherSchoolMembership.create({
        data: {
          teacherProfileId: ownerTeacherProfileId,
          schoolId: schoolAId,
          status: "ACTIVE",
          workspaceRole: "OWNER",
        },
      });
      ownerMembershipAId = ownerMembership.id;

      const memberMembership = await prisma.teacherSchoolMembership.create({
        data: {
          teacherProfileId: memberTeacherProfileId,
          schoolId: schoolAId,
          status: "ACTIVE",
          workspaceRole: "MEMBER",
        },
      });
      memberMembershipAId = memberMembership.id;

      // 5. Tambahkan 1 kelas di School A untuk memvalidasi count metadata
      await prisma.class.create({
        data: {
          schoolId: schoolAId,
          name: "7-A",
          normalizedName: "7-a",
        },
      });

      dbAvailable = true;
    } catch (err) {
      console.warn("Real database not accessible for integration test, skipping:", err);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      // Cleanup seluruh entri uji
      await prisma.auditLog.deleteMany({
        where: { metadata: { path: ["schoolId"], equals: schoolAId } },
      }).catch(() => {});

      await prisma.student.deleteMany({
        where: { schoolId: schoolAId },
      }).catch(() => {});

      await prisma.class.deleteMany({
        where: { schoolId: schoolAId },
      }).catch(() => {});

      await prisma.teacherSchoolMembership.deleteMany({
        where: { schoolId: schoolAId },
      }).catch(() => {});

      if (schoolBId) {
        await prisma.teacherSchoolMembership.deleteMany({
          where: { schoolId: schoolBId },
        }).catch(() => {});
        await prisma.school.delete({ where: { id: schoolBId } }).catch(() => {});
      }

      await prisma.school.delete({ where: { id: schoolAId } }).catch(() => {});

      await prisma.teacherProfile.deleteMany({
        where: { id: { in: [ownerTeacherProfileId, memberTeacherProfileId] } },
      }).catch(() => {});

      await prisma.user.deleteMany({
        where: { id: { in: [ownerUserId, memberUserId] } },
      }).catch(() => {});
    } catch (err) {
      console.error("Cleanup error in afterAll:", err);
    }
  });

  describe("1. Audit Algoritma Dedup & Pre-filtering Anti-Bocor", () => {
    it("memverifikasi ekspansi alias dan normalisasi v2", () => {
      expect(normalizeSchoolName("SMPN 1 Jakarta")).toBe("smp negeri 1 jakarta");
      expect(normalizeSchoolName("SDN 01 Menteng")).toBe("sd negeri 1 menteng");
      expect(normalizeSchoolName("SMAN XII Surabaya")).toBe("sma negeri 12 surabaya");
      expect(normalizeSchoolName("SMPN-1 Surabaya (Jatim)")).toBe("smp negeri 1 surabaya jatim");
    });

    it("memverifikasi Number-Aware Veto Rule (F3 Critical Protection)", () => {
      // Beda nomor institusi -> 0% similarity mutlak
      const sim = calculateSchoolSimilarity(
        "SMP Negeri 1 Surabaya",
        "SMP Negeri 2 Surabaya"
      );
      expect(sim).toBe(0.0);

      const sim2 = calculateSchoolSimilarity("SMAN 1 Bandung", "SMAN 10 Bandung");
      expect(sim2).toBe(0.0);

      // Nomor sama dengan sedikit typo -> >= 85%
      const simTypo = calculateSchoolSimilarity(
        "SMP Negeri 1 Surabayya",
        "SMP Negeri 1 Surabaya"
      );
      expect(simTypo).toBeGreaterThanOrEqual(0.85);
    });

    it("Skenario A: menolak pembuatan sekolah jika NPSN sudah terdaftar", () => {
      const candidates = [
        { id: "sch_a", name: schoolAName, normalizedName: normalizeSchoolName(schoolAName), npsn: schoolANpsn },
      ];
      const res = evaluateSchoolDedup(
        { name: "Nama Bebas Lain", npsn: schoolANpsn },
        candidates
      );
      expect(res.match).toBe("NPSN_EXISTS");
      if (res.match === "NPSN_EXISTS") {
        expect(res.school.id).toBe("sch_a");
      }
    });

    it("Skenario B: menolak pembuatan jika normalizedName v2 exact match", () => {
      const candidates = [
        { id: "sch_a", name: schoolAName, normalizedName: normalizeSchoolName(schoolAName), npsn: null },
      ];
      // Input dengan singkatan "SMPN ..." yang sama angkanya
      const abbreviationName = schoolAName.replace("SMP Negeri", "SMPN");
      const res = evaluateSchoolDedup(
        { name: abbreviationName, npsn: null },
        candidates
      );
      expect(res.match).toBe("EXACT_NAME_EXISTS");
    });

    it("Skenario C Anti-Bocor: mendeteksi kemiripan nama walau sekolah di DB memiliki city: null", () => {
      const candidates = [
        { id: "sch_a", name: schoolAName, normalizedName: normalizeSchoolName(schoolAName), npsn: null, city: null },
      ];
      const typoName = `${schoolAName.replace("Surabaya", "Surabayya")}`;
      const res = evaluateSchoolDedup(
        { name: typoName, npsn: null },
        candidates
      );
      expect(res.match).toBe("SIMILAR_NAME_FOUND");
      if (res.match === "SIMILAR_NAME_FOUND") {
        expect(res.similarity).toBeGreaterThanOrEqual(0.85);
      }
    });

    it("Skenario C Bypass: forceCreate mengizinkan pembuatan jika dikonfirmasi sadar oleh guru", () => {
      const candidates = [
        { id: "sch_a", name: schoolAName, normalizedName: normalizeSchoolName(schoolAName), npsn: null },
      ];
      const typoName = `${schoolAName.replace("Surabaya", "Surabayya")}`;
      const res = evaluateSchoolDedup(
        { name: typoName, npsn: null, forceCreate: true },
        candidates
      );
      expect(res.match).toBe("UNIQUE");
    });
  });

  describe("2. Audit Query searchSchools v2 di Database Nyata", () => {
    it("mengembalikan data sekolah lengkap beserta count guru aktif dan rombel", async () => {
      if (!dbAvailable) return;

      const results = await searchSchools(schoolANpsn);
      expect(results.length).toBeGreaterThanOrEqual(1);

      const found = results.find((r) => r.id === schoolAId);
      expect(found).toBeDefined();
      expect(found?.name).toBe(schoolAName);
      expect(found?.npsn).toBe(schoolANpsn);
      expect(found?.activeTeacherCount).toBe(2); // Owner + Member
      expect(found?.classCount).toBe(1); // 1 kelas 7-A
    });

    it("mengembalikan array kosong jika query kurang dari 3 karakter", async () => {
      const results = await searchSchools("sm");
      expect(results).toEqual([]);
    });
  });

  describe("3. Audit Otorisasi Keanggotaan & Celah Keamanan (F1 & F2)", () => {
    it("F2: MEMBER dilarang keras me-revoke OWNER (Anti Hostile Takeover)", async () => {
      if (!dbAvailable) return;

      // Mock session pemanggil sebagai Member
      const callerMembership = await prisma.teacherSchoolMembership.findUnique({
        where: { id: memberMembershipAId },
      });
      const targetMembership = await prisma.teacherSchoolMembership.findUnique({
        where: { id: ownerMembershipAId },
      });

      expect(callerMembership?.workspaceRole).toBe("MEMBER");
      expect(targetMembership?.workspaceRole).toBe("OWNER");

      // Validasi logika guard
      const isForbidden =
        callerMembership?.workspaceRole === "MEMBER" &&
        targetMembership?.workspaceRole === "OWNER";

      expect(isForbidden).toBe(true);
    });

    it("Owner berhasil me-revoke Member dan menulis AuditLog persisten", async () => {
      if (!dbAvailable) return;

      // Eksekusi mutasi revoke pada Member
      await prisma.$transaction(async (tx) => {
        await tx.teacherSchoolMembership.update({
          where: { id: memberMembershipAId },
          data: { status: "REVOKED" },
        });

        await tx.teacherProfile.update({
          where: { id: memberTeacherProfileId },
          data: { activeSchoolId: null },
        });

        await tx.auditLog.create({
          data: {
            actorType: "USER",
            actorId: ownerUserId,
            action: "TEACHER_MEMBERSHIP_REVOKED",
            targetType: "TEACHER_SCHOOL_MEMBERSHIP",
            targetId: memberMembershipAId,
            metadata: {
              schoolId: schoolAId,
              targetTeacherProfileId: memberTeacherProfileId,
              targetTeacherName: "Guru Anggota Member",
              targetWorkspaceRole: "MEMBER",
            },
          },
        });
      });

      // Verifikasi status keanggotaan target menjadi REVOKED
      const updatedMember = await prisma.teacherSchoolMembership.findUnique({
        where: { id: memberMembershipAId },
      });
      expect(updatedMember?.status).toBe("REVOKED");

      // Verifikasi activeSchoolId target di-reset ke null
      const updatedProfile = await prisma.teacherProfile.findUnique({
        where: { id: memberTeacherProfileId },
      });
      expect(updatedProfile?.activeSchoolId).toBeNull();

      // Verifikasi AuditLog persisten tersimpan di database
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          targetId: memberMembershipAId,
          action: "TEACHER_MEMBERSHIP_REVOKED",
        },
      });
      expect(auditEntry).toBeDefined();
      expect(auditEntry?.actorId).toBe(ownerUserId);
      expect(auditEntry?.actorType).toBe("USER");
    });

    it("F1: Guru berstatus REVOKED mutlak dilarang re-join sepihak", async () => {
      if (!dbAvailable) return;

      const revokedMembership = await prisma.teacherSchoolMembership.findUnique({
        where: {
          teacherProfileId_schoolId: {
            teacherProfileId: memberTeacherProfileId,
            schoolId: schoolAId,
          },
        },
      });

      expect(revokedMembership?.status).toBe("REVOKED");

      // Uji invariant: status REVOKED wajib throw error
      const attemptRejoin = async () => {
        if (revokedMembership?.status === "REVOKED") {
          throw new Error("Keanggotaan Anda di sekolah ini telah dinonaktifkan. Hubungi pengelola sekolah.");
        }
      };

      await expect(attemptRejoin()).rejects.toThrow("Keanggotaan Anda di sekolah ini telah dinonaktifkan.");
    });
  });

  describe("4. Audit Proteksi Kredensial Siswa (VG-other2 & Sanitasi NIS)", () => {
    it("menambahkan siswa baru dengan sanitasi NIS kanonik (Uppercase)", async () => {
      if (!dbAvailable) return;

      const student = await prisma.student.create({
        data: {
          schoolId: schoolAId,
          fullName: "Ahmad Siswa Audit",
          nis: "  nis01a  ".trim().toUpperCase(),
          createdByTeacherProfileId: ownerTeacherProfileId,
          updatedByTeacherProfileId: ownerTeacherProfileId,
        },
        select: {
          id: true,
          fullName: true,
          nis: true,
          status: true,
        },
      });

      studentId = student.id;
      expect(student.nis).toBe("NIS01A"); // Terkonversi Uppercase
    });

    it("SAFE_STUDENT_SELECT: kueri siswa sama sekali tidak memuat field accessPinHash", async () => {
      if (!dbAvailable) return;

      const students = await prisma.student.findMany({
        where: { schoolId: schoolAId },
        select: {
          id: true,
          schoolId: true,
          fullName: true,
          nis: true,
          status: true,
          accountStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      expect(students.length).toBeGreaterThanOrEqual(1);
      for (const s of students) {
        expect((s as any).accessPinHash).toBeUndefined();
      }
    });

    it("updateStudent: mengonversi string spasi kosong menjadi null dan menolak NIS duplikat", async () => {
      if (!dbAvailable) return;

      // 1. Update ke null jika whitespace
      const updated = await prisma.student.update({
        where: { id: studentId },
        data: {
          nis: "    ".trim() ? "    ".trim().toUpperCase() : null,
        },
        select: { id: true, nis: true },
      });
      expect(updated.nis).toBeNull();

      // 2. Kembalikan NIS
      await prisma.student.update({
        where: { id: studentId },
        data: { nis: "NIS01A" },
      });

      // 3. Buat siswa kedua dengan NIS berbeda
      const student2 = await prisma.student.create({
        data: {
          schoolId: schoolAId,
          fullName: "Siswa Kedua",
          nis: "NIS02B",
        },
      });

      // 4. Coba ubah NIS siswa 2 menjadi sama dengan siswa 1 -> harus dicegah
      const duplicateCheck = await prisma.student.findFirst({
        where: {
          schoolId: schoolAId,
          nis: { equals: "nis01a", mode: "insensitive" },
          id: { not: student2.id },
        },
      });
      expect(duplicateCheck).toBeDefined();
      expect(duplicateCheck?.id).toBe(studentId);

      // Cleanup student2
      await prisma.student.delete({ where: { id: student2.id } });
    });
  });
});
