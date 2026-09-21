import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/auth
vi.mock("@/lib/auth", () => ({
  prisma: {
    school: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    teacherProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    teacherSchoolMembership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(prisma)),
  },
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// Mock @/lib/authorization
vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { prisma, auth } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import {
  searchSchools,
  createSchool,
  joinSchool,
  getSchoolTeachers,
  revokeTeacherMembership,
} from "../schools.actions";

describe("Schools Actions Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: "usr_teacher_1", name: "Pak Budi", email: "budi@test.com" },
    });
  });

  describe("searchSchools", () => {
    it("returns empty array when query is shorter than 3 chars", async () => {
      const res = await searchSchools("sm");
      expect(res).toEqual([]);
      expect(prisma.school.findMany).not.toHaveBeenCalled();
    });

    it("searches by name or npsn and includes count metadata", async () => {
      (prisma.school.findMany as any).mockResolvedValue([
        {
          id: "sch_1",
          name: "SMP Negeri 1 Surabaya",
          city: "Surabaya",
          npsn: "20532210",
          _count: {
            memberships: 15,
            classes: 12,
          },
        },
      ]);

      const res = await searchSchools("surabaya");
      expect(res).toEqual([
        {
          id: "sch_1",
          name: "SMP Negeri 1 Surabaya",
          city: "Surabaya",
          npsn: "20532210",
          activeTeacherCount: 15,
          classCount: 12,
        },
      ]);
    });
  });

  describe("createSchool & Dedup Scenarios", () => {
    beforeEach(() => {
      (prisma.teacherProfile.findUnique as any).mockResolvedValue({
        id: "tp_1",
        userId: "usr_teacher_1",
      });
    });

    it("Scenario A: rejects creation when NPSN already registered", async () => {
      (prisma.school.findMany as any).mockResolvedValue([
        {
          id: "sch_1",
          name: "SMP Negeri 1 Surabaya",
          normalizedName: "smp negeri 1 surabaya",
          npsn: "20532210",
          city: "Surabaya",
        },
      ]);

      const res = await createSchool({
        name: "SMP Harapan",
        npsn: "20532210",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("NPSN_EXISTS");
        expect(res.existingSchool?.id).toBe("sch_1");
      }
    });

    it("Scenario B: rejects creation when normalizedName v2 exact match exists", async () => {
      (prisma.school.findMany as any).mockResolvedValue([
        {
          id: "sch_1",
          name: "SMP Negeri 1 Surabaya",
          normalizedName: "smp negeri 1 surabaya",
          npsn: null,
          city: "Surabaya",
        },
      ]);

      // Input "SMPN-1 Surabaya" normalizes to "smp negeri 1 surabaya"
      const res = await createSchool({
        name: "SMPN-1 Surabaya",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("EXACT_NAME_EXISTS");
        expect(res.existingSchool?.id).toBe("sch_1");
      }
    });

    it("Scenario C: triggers SIMILAR_NAME_FOUND when similarity >= 85%", async () => {
      (prisma.school.findMany as any).mockResolvedValue([
        {
          id: "sch_1",
          name: "SMP Negeri 1 Surabaya",
          normalizedName: "smp negeri 1 surabaya",
          npsn: null,
          city: "Surabaya",
        },
      ]);

      const res = await createSchool({
        name: "SMP Negeri 1 Surabayya",
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("SIMILAR_NAME_FOUND");
        expect(res.matchedSchool?.id).toBe("sch_1");
        expect(res.similarity).toBeGreaterThanOrEqual(0.85);
      }
    });

    it("Scenario C: robust pre-filter includes schools whose city is null but name contains the city token", async () => {
      // Existing school in DB has city: null, but name has "Surabaya"
      (prisma.school.findMany as any).mockResolvedValue([
        {
          id: "sch_null_city",
          name: "SMP Negeri 1 Surabaya",
          normalizedName: "smp negeri 1 surabaya",
          npsn: null,
          city: null,
        },
      ]);

      const res = await createSchool({
        name: "SMP Negeri 1 Surabayya",
        city: "Surabaya",
      });

      // Verify that candidateConditions passed to findMany searched name for city
      const queryCall = (prisma.school.findMany as any).mock.calls[0][0];
      const conditions = queryCall.where.OR;
      const searchesNameForCity = conditions.some(
        (c: any) => c.name && c.name.contains === "Surabaya"
      );
      expect(searchesNameForCity).toBe(true);

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.code).toBe("SIMILAR_NAME_FOUND");
        expect(res.matchedSchool?.id).toBe("sch_null_city");
      }
    });

    it("Scenario C Bypass: allows creation if forceCreate: true", async () => {
      (prisma.school.findMany as any).mockResolvedValue([
        {
          id: "sch_1",
          name: "SMP Negeri 1 Surabaya",
          normalizedName: "smp negeri 1 surabaya",
          npsn: null,
          city: "Surabaya",
        },
      ]);
      (prisma.school.create as any).mockResolvedValue({
        id: "sch_new",
        name: "SMP Negeri 1 Surabayya",
        npsn: null,
        city: null,
      });

      const res = await createSchool({
        name: "SMP Negeri 1 Surabayya",
        forceCreate: true,
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.school.id).toBe("sch_new");
      }
    });

    it("Scenario D: creates new school with OWNER role when unique", async () => {
      (prisma.school.findMany as any).mockResolvedValue([]);
      (prisma.school.create as any).mockResolvedValue({
        id: "sch_unique",
        name: "SMA Bina Bangsa",
        npsn: "12345678",
        city: "Bandung",
      });

      const res = await createSchool({
        name: "SMA Bina Bangsa",
        npsn: "12345678",
        city: "Bandung",
      });

      expect(res.success).toBe(true);
      expect(prisma.teacherSchoolMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceRole: "OWNER",
            status: "ACTIVE",
          }),
        })
      );
    });
  });

  describe("joinSchool", () => {
    it("F1 CRITICAL: blocks join if membership is REVOKED", async () => {
      (prisma.teacherProfile.findUnique as any).mockResolvedValue({
        id: "tp_1",
        userId: "usr_teacher_1",
      });
      (prisma.teacherSchoolMembership.findUnique as any).mockResolvedValue({
        id: "tsm_revoked",
        status: "REVOKED",
        workspaceRole: "MEMBER",
      });

      await expect(joinSchool("sch_1")).rejects.toThrow(
        "Keanggotaan Anda di sekolah ini telah dinonaktifkan. Hubungi pengelola sekolah."
      );
      expect(prisma.teacherSchoolMembership.update).not.toHaveBeenCalled();
    });

    it("allows joining if not previously member", async () => {
      (prisma.teacherProfile.findUnique as any).mockResolvedValue({
        id: "tp_1",
        userId: "usr_teacher_1",
      });
      (prisma.teacherSchoolMembership.findUnique as any).mockResolvedValue(null);

      const res = await joinSchool("sch_1");
      expect(res.success).toBe(true);
      expect(prisma.teacherSchoolMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceRole: "MEMBER",
            status: "ACTIVE",
          }),
        })
      );
    });
  });

  describe("revokeTeacherMembership", () => {
    beforeEach(() => {
      (verifyActiveSchoolMembership as any).mockResolvedValue({
        session: { user: { id: "usr_caller" } },
        profile: { id: "tp_caller" },
        activeSchoolId: "sch_1",
      });
    });

    it("prevents revoking self", async () => {
      (prisma.teacherSchoolMembership.findUnique as any)
        .mockResolvedValueOnce({
          id: "tsm_caller",
          teacherProfileId: "tp_caller",
          schoolId: "sch_1",
          status: "ACTIVE",
          workspaceRole: "OWNER",
        })
        .mockResolvedValueOnce({
          id: "tsm_target",
          teacherProfileId: "tp_caller",
          schoolId: "sch_1",
        });

      await expect(revokeTeacherMembership("tsm_target")).rejects.toThrow(
        "Tidak dapat mencabut akses diri sendiri."
      );
    });

    it("F2 CRITICAL: blocks MEMBER from revoking OWNER", async () => {
      (prisma.teacherSchoolMembership.findUnique as any)
        .mockResolvedValueOnce({
          id: "tsm_caller",
          teacherProfileId: "tp_caller",
          schoolId: "sch_1",
          status: "ACTIVE",
          workspaceRole: "MEMBER", // Caller is MEMBER
        })
        .mockResolvedValueOnce({
          id: "tsm_target",
          teacherProfileId: "tp_target",
          schoolId: "sch_1",
          workspaceRole: "OWNER", // Target is OWNER
          teacherProfile: {
            user: { id: "usr_owner", name: "Kepala Sekolah" },
          },
        });

      await expect(revokeTeacherMembership("tsm_target")).rejects.toThrow(
        "Hanya SuperAdmin atau pengelola sekolah yang dapat mengubah status Owner."
      );
    });

    it("allows OWNER to revoke MEMBER and creates AuditLog", async () => {
      (prisma.teacherSchoolMembership.findUnique as any)
        .mockResolvedValueOnce({
          id: "tsm_caller",
          teacherProfileId: "tp_caller",
          schoolId: "sch_1",
          status: "ACTIVE",
          workspaceRole: "OWNER",
        })
        .mockResolvedValueOnce({
          id: "tsm_target",
          teacherProfileId: "tp_target",
          schoolId: "sch_1",
          workspaceRole: "MEMBER",
          teacherProfile: {
            activeSchoolId: "sch_1",
            user: { id: "usr_target", name: "Guru Palsu" },
          },
        });

      const res = await revokeTeacherMembership("tsm_target");
      expect(res.success).toBe(true);

      expect(prisma.teacherSchoolMembership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "tsm_target" },
          data: { status: "REVOKED" },
        })
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "TEACHER_MEMBERSHIP_REVOKED",
            targetType: "TEACHER_SCHOOL_MEMBERSHIP",
            targetId: "tsm_target",
          }),
        })
      );
    });
  });
});
