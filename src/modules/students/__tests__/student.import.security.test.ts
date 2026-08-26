import { describe, it, expect, vi, beforeEach } from "vitest";
import { confirmImport, ValidationResult } from "../import.actions";
import { prisma } from "@/lib/auth";
import * as authLib from "@/lib/authorization";

vi.mock("@/lib/auth", () => ({
  prisma: {
    $transaction: vi.fn(async (cb) => {
      const mockTx = {
        student: {
          findFirst: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: "new-std-1" }),
        },
        classStudent: {
          findUnique: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: "cs-1" }),
          update: vi.fn().mockResolvedValue({ id: "cs-1" }),
        },
      };
      return await cb(mockTx);
    }),
    student: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    classStudent: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
  verifyTeachingContextAccess: vi.fn(),
}));

describe("Stage 02 Importer Security Hardening (Stage 09 Trust Boundary)", () => {
  const activeSchoolId = "school-legit-a";
  const teacherProfileId = "teacher-1";
  const teachingContextId = "ctx-1";
  const classId = "class-a";
  const foreignClassId = "class-other";
  const academicPeriodId = "period-1";

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authLib.verifyActiveSchoolMembership).mockResolvedValue({
      session: { user: { id: "user-1" } } as never,
      profile: { id: teacherProfileId, activeSchoolId } as never,
      activeSchoolId,
      activeSchool: { id: activeSchoolId, name: "SMA Negeri 1" } as never,
    });

    vi.mocked(authLib.verifyTeachingContextAccess).mockResolvedValue({
      profile: { id: teacherProfileId, activeSchoolId } as never,
      activeSchoolId,
      context: {
        id: teachingContextId,
        schoolId: activeSchoolId,
        teacherProfileId,
        classId,
        academicPeriodId,
      } as never,
    });
  });

  it("successfully processes legitimate Stage 02 roster import", async () => {
    const validRows: ValidationResult[] = [
      {
        rowNum: 2,
        namaLengkap: "Dewi Sartika",
        nis: "1001",
        status: "VALID",
        message: "Ready to import",
        action: "CREATE",
      },
    ];

    vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
      const mockTx = {
        student: {
          findFirst: vi.fn(),
          create: vi.fn().mockResolvedValue({ id: "std-new-dewi" }),
        },
        classStudent: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: "cs-new" }),
        },
      };
      return await cb(mockTx as never);
    });

    const result = await confirmImport(teachingContextId, validRows);
    expect(result.success).toBe(true);
    expect(result.importedCount).toBe(1);
  });

  it("rejects malicious existingStudentId belonging to another School (School B -> School A IDOR)", async () => {
    const maliciousRows: ValidationResult[] = [
      {
        rowNum: 2,
        namaLengkap: "Injected Student",
        nis: "9999",
        status: "VALID",
        message: "Ready",
        action: "REUSE_EXACT",
        existingStudentId: "student-from-school-b",
      },
    ];

    vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
      const mockTx = {
        student: {
          // findFirst searches with schoolId: activeSchoolId -> returns null for foreign student
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        classStudent: {
          findUnique: vi.fn(),
          create: vi.fn(),
        },
      };
      return await cb(mockTx as never);
    });

    await expect(confirmImport(teachingContextId, maliciousRows)).rejects.toThrow(
      "tidak ditemukan di sekolah aktif"
    );
  });

  it("prevents moving student between classes during import if student is already in another class for that period", async () => {
    const conflictRows: ValidationResult[] = [
      {
        rowNum: 2,
        namaLengkap: "Existing In Another Class",
        nis: "1005",
        status: "VALID",
        message: "Ready",
        action: "REUSE_EXACT",
        existingStudentId: "std-already-enrolled",
      },
    ];

    vi.mocked(prisma.$transaction).mockImplementation(async (cb) => {
      const mockTx = {
        student: {
          findFirst: vi.fn().mockResolvedValue({ id: "std-already-enrolled", schoolId: activeSchoolId }),
          create: vi.fn(),
        },
        classStudent: {
          // Student is already enrolled in foreignClassId for the same academic period
          findUnique: vi.fn().mockResolvedValue({
            id: "cs-existing",
            studentId: "std-already-enrolled",
            classId: foreignClassId,
            academicPeriodId,
          }),
          update: vi.fn(),
        },
      };
      return await cb(mockTx as never);
    });

    await expect(confirmImport(teachingContextId, conflictRows)).rejects.toThrow(
      "sudah terdaftar di kelas lain pada periode akademik ini. Importer tidak diizinkan memindahkan kelas"
    );
  });
});
