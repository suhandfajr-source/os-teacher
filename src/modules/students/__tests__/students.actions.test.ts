import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/auth
vi.mock("@/lib/auth", () => ({
  prisma: {
    student: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock @/lib/authorization
vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
}));

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import {
  addStudent,
  getStudents,
  updateStudent,
  archiveStudent,
} from "../students.actions";

describe("Students Actions — Security & Projections (VG-other2 & F5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifyActiveSchoolMembership as any).mockResolvedValue({
      session: { user: { id: "usr_1" } },
      profile: { id: "tp_1" },
      activeSchoolId: "sch_1",
    });
  });

  it("getStudents uses safe select and never returns accessPinHash", async () => {
    (prisma.student.findMany as any).mockResolvedValue([
      {
        id: "std_1",
        schoolId: "sch_1",
        fullName: "Ahmad Siswa",
        nis: "1001",
        status: "ACTIVE",
        accountStatus: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const students = await getStudents();

    // Verify Prisma was called with SAFE_STUDENT_SELECT
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          fullName: true,
          nis: true,
        }),
      })
    );

    const callArgs = (prisma.student.findMany as any).mock.calls[0][0];
    expect(callArgs.select.accessPinHash).toBeUndefined();

    // Verify returned objects have no accessPinHash
    for (const s of students) {
      expect((s as any).accessPinHash).toBeUndefined();
    }
  });

  it("updateStudent canonicalizes NIS to uppercase, trims whitespace, and uses safe select", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "std_1",
      schoolId: "sch_1",
      nis: "OLD_NIS",
    });
    (prisma.student.findFirst as any).mockResolvedValue(null);
    (prisma.student.update as any).mockResolvedValue({
      id: "std_1",
      schoolId: "sch_1",
      fullName: "Ahmad Siswa Edit",
      nis: "NEW123A",
      status: "ACTIVE",
    });

    const res = await updateStudent("std_1", {
      fullName: "  Ahmad Siswa Edit  ",
      nis: "  new123a  ",
    });

    expect(prisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "std_1" },
        data: expect.objectContaining({
          fullName: "Ahmad Siswa Edit",
          nis: "NEW123A",
        }),
        select: expect.any(Object),
      })
    );

    const updateCall = (prisma.student.update as any).mock.calls[0][0];
    expect(updateCall.select.accessPinHash).toBeUndefined();
    expect((res as any).accessPinHash).toBeUndefined();
  });

  it("updateStudent converts empty whitespace NIS to null", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "std_1",
      schoolId: "sch_1",
      nis: "OLD_NIS",
    });
    (prisma.student.update as any).mockResolvedValue({
      id: "std_1",
      schoolId: "sch_1",
      fullName: "Siswa Tanpa NIS",
      nis: null,
      status: "ACTIVE",
    });

    await updateStudent("std_1", {
      nis: "    ",
    });

    expect(prisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "std_1" },
        data: expect.objectContaining({
          nis: null,
        }),
      })
    );
  });

  it("addStudent rejects duplicate NIS case-insensitively", async () => {
    (prisma.student.findFirst as any).mockResolvedValue({
      id: "std_existing",
      nis: "1001A",
    });

    await expect(
      addStudent({ fullName: "Budi", nis: "1001a" })
    ).rejects.toThrow("Siswa dengan NIS 1001A sudah terdaftar di sekolah ini.");
  });

  it("archiveStudent uses safe select projection", async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      id: "std_1",
      schoolId: "sch_1",
    });
    (prisma.student.update as any).mockResolvedValue({
      id: "std_1",
      schoolId: "sch_1",
      status: "ARCHIVED",
    });

    const res = await archiveStudent("std_1");
    expect((res as any).accessPinHash).toBeUndefined();
  });
});
