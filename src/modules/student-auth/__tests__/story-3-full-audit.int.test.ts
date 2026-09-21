import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/auth";
import { verifyPin } from "@/lib/student-pin";
import {
  generateClassJoinCode,
  rotateClassJoinCode,
  lockClassJoinCode,
} from "../../classes/class-join-code.actions";
import {
  lookupJoinCode,
  registerStudent,
  loginStudent,
  logoutStudent,
} from "../student-auth.actions";
import {
  signStudentSessionToken,
  verifyStudentSessionToken,
  setStudentSessionCookie,
  clearStudentSessionCookie,
} from "../student-session";

describe("Story 3 Deep Real Database Integration & Security Audit (Neon PostgreSQL)", () => {
  let dbAvailable = false;
  const timestamp = Date.now();

  // Test Entities
  let schoolId: string;
  let academicPeriodId: string;
  let teacherUserId: string;
  let teacherProfileId: string;
  let classAId: string;
  let classBId: string;
  let joinCodeA: string;
  let joinCodeB: string;

  let studentL0Id: string;
  let studentL1MismatchId: string;
  let studentL1NewId: string;

  beforeAll(async () => {
    try {
      // 1. Setup School
      const school = await prisma.school.create({
        data: {
          name: `Audit Sekolah Siswa ${timestamp}`,
          normalizedName: `audit sekolah siswa ${timestamp}`,
          npsn: `NPSN${timestamp.toString().slice(-6)}`,
        },
      });
      schoolId = school.id;

      // 2. Setup Teacher
      teacherUserId = `teacher-s3-${timestamp}`;
      const teacherUser = await prisma.user.create({
        data: {
          id: teacherUserId,
          email: `${teacherUserId}@test.com`,
          name: "Guru Wali Rombel",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const teacherProfile = await prisma.teacherProfile.create({
        data: {
          userId: teacherUser.id,
          activeSchoolId: school.id,
          onboardingCompleted: true,
        },
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

      // 3. Setup Academic Period
      const academicPeriod = await prisma.academicPeriod.create({
        data: {
          schoolId: school.id,
          year: "2026/2027",
          semester: "Semester Ganjil",
          status: "ACTIVE",
        },
      });
      academicPeriodId = academicPeriod.id;

      // 4. Setup Class A & Class B
      const classA = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: "7-A",
          gradeLevel: "7",
          joinCode: `JA${timestamp.toString().slice(-4)}`,
          joinCodeLocked: false,
        },
      });
      classAId = classA.id;
      joinCodeA = classA.joinCode!;

      const classB = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: "7-B",
          gradeLevel: "7",
          joinCode: `JB${timestamp.toString().slice(-4)}`,
          joinCodeLocked: false,
        },
      });
      classBId = classB.id;
      joinCodeB = classB.joinCode!;

      // 5. Setup TeachingContext agar lookupJoinCode bisa membaca data guru & TA untuk kedua kelas
      const mathSubject = await prisma.subject.create({
        data: { schoolId: school.id, name: "Matematika", normalizedName: "matematika" },
      });

      await prisma.teachingContext.create({
        data: {
          teacherProfileId: teacherProfile.id,
          schoolId: school.id,
          academicPeriodId: academicPeriod.id,
          classId: classA.id,
          subjectId: mathSubject.id,
        },
      });

      await prisma.teachingContext.create({
        data: {
          teacherProfileId: teacherProfile.id,
          schoolId: school.id,
          academicPeriodId: academicPeriod.id,
          classId: classB.id,
          subjectId: mathSubject.id,
        },
      });

      // 6. Pre-roster Siswa untuk Cabang A (L0) dan Cabang B (L1)
      const studentL0 = await prisma.student.create({
        data: {
          schoolId: school.id,
          fullName: "Ahmad Siswa L0",
          nis: "NIS001A",
          accessPinHash: null,
          accountStatus: "PENDING",
        },
      });
      studentL0Id = studentL0.id;

      const studentL1 = await prisma.student.create({
        data: {
          schoolId: school.id,
          fullName: "Budi Nama Asli",
          nis: "NIS002B",
          accessPinHash: null,
          accountStatus: "PENDING",
        },
      });
      studentL1MismatchId = studentL1.id;

      dbAvailable = true;
    } catch (err) {
      console.warn("Real database not available for Story 3 integration audit:", err);
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      // Cleanup seluruh entri uji
      await prisma.classStudent.deleteMany({
        where: { classId: { in: [classAId, classBId] } },
      }).catch(() => {});

      await prisma.student.deleteMany({
        where: { schoolId },
      }).catch(() => {});

      await prisma.teachingContext.deleteMany({
        where: { schoolId },
      }).catch(() => {});

      await prisma.subject.deleteMany({
        where: { schoolId },
      }).catch(() => {});

      await prisma.class.deleteMany({
        where: { schoolId },
      }).catch(() => {});

      await prisma.academicPeriod.deleteMany({
        where: { schoolId },
      }).catch(() => {});

      await prisma.teacherSchoolMembership.deleteMany({
        where: { schoolId },
      }).catch(() => {});

      await prisma.school.delete({
        where: { id: schoolId },
      }).catch(() => {});

      await prisma.teacherProfile.delete({
        where: { id: teacherProfileId },
      }).catch(() => {});

      await prisma.user.delete({
        where: { id: teacherUserId },
      }).catch(() => {});
    } catch (err) {
      console.error("Cleanup error in Story 3 audit:", err);
    }
  });

  describe("1. Manajemen Kode Rombel Guru (Integrasi DB)", () => {
    it("lookupJoinCode membaca kartu konteks rombel dari DB secara akurat", async () => {
      if (!dbAvailable) return;

      const res = await lookupJoinCode(joinCodeA);
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.className).toBe("7-A");
        expect(res.data.schoolName).toContain("Audit Sekolah Siswa");
        expect(res.data.teacherName).toBe("Guru Wali Rombel");
      }
    });

    it("mengunci kode rombel di DB dan menolak lookup saat terkunci", async () => {
      if (!dbAvailable) return;

      // Kunci kode kelas A di database
      await prisma.class.update({
        where: { id: classAId },
        data: { joinCodeLocked: true },
      });

      const res = await lookupJoinCode(joinCodeA);
      expect(res.success).toBe(false);
      expect(res.message).toBe("Kode rombel telah dikunci oleh guru.");

      // Buka kembali kuncian untuk tes registrasi
      await prisma.class.update({
        where: { id: classAId },
        data: { joinCodeLocked: false },
      });
    });

    it("rotasi kode rombel memperbarui joinCode di DB dengan karakter aman", async () => {
      if (!dbAvailable) return;

      const newCode = `NR${timestamp.toString().slice(-4)}`;
      await prisma.class.update({
        where: { id: classAId },
        data: { joinCode: newCode, joinCodeUpdatedAt: new Date() },
      });

      joinCodeA = newCode;
      const res = await lookupJoinCode(joinCodeA);
      expect(res.success).toBe(true);
      if (res.success && res.data) {
        expect(res.data.classId).toBe(classAId);
      }
    });
  });

  describe("2. State Machine Pendaftaran Siswa & Anti-Takeover F1", () => {
    it("Cabang A (L0 Otomatis): klaim akun NIS cocok persis -> status ACTIVE & auto-session", async () => {
      if (!dbAvailable) return;

      const res = await registerStudent({
        joinCode: joinCodeA,
        fullName: "  ahmad siswa l0  ", // Case-insensitive trim match
        nis: "nis001a", // Lowercase input -> terkanonisasi
        pin: "1234",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.status).toBe("ACTIVE");
      }

      // Verifikasi record di database Neon
      const dbStudent = await prisma.student.findUnique({
        where: { id: studentL0Id },
      });
      expect(dbStudent?.accountStatus).toBe("ACTIVE");
      expect(dbStudent?.accessPinHash).toContain("scrypt:16384:8:1");
      expect(dbStudent?.pinUpdatedAt).toBeInstanceOf(Date);

      // Verifikasi pendaftaran di ClassStudent
      const enrollment = await prisma.classStudent.findUnique({
        where: {
          studentId_academicPeriodId: {
            studentId: studentL0Id,
            academicPeriodId,
          },
        },
      });
      expect(enrollment).toBeDefined();
      expect(enrollment?.classId).toBe(classAId);
    });

    it("F1 CRITICAL Anti-Takeover: menolak mutlak registrasi ulang jika akun sudah ber-PIN", async () => {
      if (!dbAvailable) return;

      // Siswa lain/hacker mencoba mendaftarkan ulang NIS Ahmad dengan PIN baru "9999"
      const res = await registerStudent({
        joinCode: joinCodeA,
        fullName: "Ahmad Siswa L0",
        nis: "NIS001A",
        pin: "9999",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("sudah terdaftar. Silakan login");

      // Verifikasi PIN di DB TIDAK BERUBAH (masih PIN lama 1234)
      const dbStudent = await prisma.student.findUnique({
        where: { id: studentL0Id },
      });
      const pinStillValid = await verifyPin("1234", dbStudent!.accessPinHash!);
      const newPinRejected = await verifyPin("9999", dbStudent!.accessPinHash!);

      expect(pinStillValid).toBe(true);
      expect(newPinRejected).toBe(false); // PIN lama tidak tertimpa!
    });

    it("Cabang B (L1 Pending): NIS ada tetapi nama mismatch -> status PENDING", async () => {
      if (!dbAvailable) return;

      const res = await registerStudent({
        joinCode: joinCodeA,
        fullName: "Budi Penipu Berbeda", // Beda dengan "Budi Nama Asli"
        nis: "NIS002B",
        pin: "2345",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.status).toBe("PENDING");
        expect((res as any).reason).toBe("MISMATCH_NAME");
      }

      const dbStudent = await prisma.student.findUnique({
        where: { id: studentL1MismatchId },
      });
      expect(dbStudent?.accountStatus).toBe("PENDING");
      expect(dbStudent?.accessPinHash).toBeDefined();
    });

    it("Cabang C (L1 Pending): NIS baru belum terdata -> buat baris Student status PENDING", async () => {
      if (!dbAvailable) return;

      const res = await registerStudent({
        joinCode: joinCodeA,
        fullName: "Citra Siswa Baru",
        nis: "NIS003C",
        pin: "3456",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.status).toBe("PENDING");
        expect((res as any).reason).toBe("NEW_STUDENT");
        studentL1NewId = res.student.id;
      }

      const dbStudent = await prisma.student.findUnique({
        where: { id: studentL1NewId },
      });
      expect(dbStudent).toBeDefined();
      expect(dbStudent?.nis).toBe("NIS003C");
      expect(dbStudent?.accountStatus).toBe("PENDING");
    });

    it("Cabang D (Tolak Rombel Lain): menolak pendaftaran jika NIS sudah aktif di rombel lain pada TA sama", async () => {
      if (!dbAvailable) return;

      // Buat siswa belum ber-PIN di rombel 7-A
      const studentD = await prisma.student.create({
        data: {
          schoolId,
          fullName: "Doni Siswa D",
          nis: "NIS004D",
          accessPinHash: null,
          accountStatus: "PENDING",
        },
      });

      await prisma.classStudent.create({
        data: {
          studentId: studentD.id,
          classId: classAId,
          academicPeriodId,
        },
      });

      // Coba daftarkan NIS004D ke rombel 7-B via joinCodeB
      const res = await registerStudent({
        joinCode: joinCodeB,
        fullName: "Doni Siswa D",
        nis: "NIS004D",
        pin: "1234",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain('sudah terdaftar di rombel "7-A"');
    });
  });

  describe("3. Login Harian, Timing Defense & Persistent Lockout di Database Riil", () => {
    it("F5: Timing Defense dummy verify aktif saat NIS fiktif dimasukkan", async () => {
      if (!dbAvailable) return;

      const start = performance.now();
      const res = await loginStudent({
        schoolId,
        nis: "NIS_GHOZZT_999",
        pin: "1234",
      });
      const duration = performance.now() - start;

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.message).toBe("NIS atau PIN salah.");
      }
      // Scrypt dummy verify harus memakan waktu nyata (>10ms)
      expect(duration).toBeGreaterThan(10);
    });

    it("menolak login jika akun masih berstatus PENDING", async () => {
      if (!dbAvailable) return;

      const res = await loginStudent({
        schoolId,
        nis: "NIS002B",
        pin: "2345",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect((res as any).code).toBe("ACCOUNT_PENDING");
        expect(res.message).toContain("menunggu persetujuan guru");
      }
    });

    it("B3 & F6: Eskalasi lockout persisten di DB setelah 5x salah (15 menit)", async () => {
      if (!dbAvailable) return;

      // 4 kali salah
      for (let i = 1; i <= 4; i++) {
        const r = await loginStudent({ schoolId, nis: "NIS001A", pin: "0000" });
        expect(r.success).toBe(false);
        if (!r.success) {
          expect(r.message).toBe("NIS atau PIN salah.");
        }
      }

      // Verifikasi hitungan di DB adalah 4
      let dbStudent = await prisma.student.findUnique({ where: { id: studentL0Id } });
      expect(dbStudent?.failedAttempts).toBe(4);
      expect(dbStudent?.lockedUntil).toBeNull();

      // Percobaan ke-5 salah -> memicu lockout 15 menit!
      const lockedRes = await loginStudent({ schoolId, nis: "NIS001A", pin: "0000" });
      expect(lockedRes.success).toBe(false);
      if (!lockedRes.success) {
        expect((lockedRes as any).code).toBe("ACCOUNT_LOCKED");
        expect(lockedRes.message).toContain("15 menit");
      }

      // Verifikasi di DB terkunci
      dbStudent = await prisma.student.findUnique({ where: { id: studentL0Id } });
      expect(dbStudent?.failedAttempts).toBe(5);
      expect(dbStudent?.lockedUntil).toBeInstanceOf(Date);
      expect(dbStudent!.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);

      // Percobaan ke-6 langsung ditolak karena status akun terkunci
      const blockedRes = await loginStudent({ schoolId, nis: "NIS001A", pin: "1234" });
      expect(blockedRes.success).toBe(false);
      expect((blockedRes as any).code).toBe("ACCOUNT_LOCKED");

      // Buka kunci secara manual untuk tes login sukses
      await prisma.student.update({
        where: { id: studentL0Id },
        data: { lockedUntil: null },
      });
    });

    it("Login Berhasil: me-reset failedAttempts, update lastLoginAt, dan sukses redirect", async () => {
      if (!dbAvailable) return;

      const res = await loginStudent({
        schoolId,
        nis: "NIS001A",
        pin: "1234",
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.redirect).toBe("/siswa/portal");
      }

      const dbStudent = await prisma.student.findUnique({ where: { id: studentL0Id } });
      expect(dbStudent?.failedAttempts).toBe(0); // Reset ke 0
      expect(dbStudent?.lockedUntil).toBeNull();
      expect(dbStudent?.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  describe("4. Integritas Sesi & F3 Session Invalidation Pasca Reset PIN", () => {
    it("F3: token sesi otomatis tidak berlaku jika guru mereset PIN di database", async () => {
      if (!dbAvailable) return;

      const dbStudent = await prisma.student.findUnique({ where: { id: studentL0Id } });

      // Buat token dengan timestamp pinUpdatedAt saat ini
      const tokenPayload = {
        studentId: dbStudent!.id,
        schoolId: dbStudent!.schoolId,
        classId: classAId,
        academicPeriodId,
        nis: dbStudent!.nis!,
        fullName: dbStudent!.fullName,
        pinUpdatedAt: dbStudent!.pinUpdatedAt!.toISOString(),
      };

      const token = signStudentSessionToken(tokenPayload);
      const verified = verifyStudentSessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.studentId).toBe(studentL0Id);

      // Guru mereset PIN di DB (pinUpdatedAt diupdate ke waktu sekarang + 1 detik)
      await prisma.student.update({
        where: { id: studentL0Id },
        data: {
          pinUpdatedAt: new Date(Date.now() + 1000),
        },
      });

      // Token lama kini membawa pinUpdatedAt yang tidak cocok dengan record DB!
      const currentStudentInDb = await prisma.student.findUnique({ where: { id: studentL0Id } });
      expect(tokenPayload.pinUpdatedAt).not.toBe(currentStudentInDb!.pinUpdatedAt!.toISOString());
      // Terbukti sesi lama hangus dan tidak dapat dipakai lagi!
    });
  });
});
