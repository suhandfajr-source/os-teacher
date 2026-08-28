import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth module
vi.mock("@/lib/auth", () => {
  return {
    auth: {
      api: {
        getSession: vi.fn(),
      },
    },
    prisma: {
      teacherProfile: {
        findUnique: vi.fn(),
      },
      teachingContext: {
        findUnique: vi.fn(),
      },
      classStudent: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      student: {
        findFirst: vi.fn(),
        count: vi.fn(),
      },
    },
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

import {
  requireAuthSession,
  verifyActiveSchoolMembership,
  verifyTeachingContextAccess,
} from "../authorization";
import { auth, prisma } from "@/lib/auth";

describe("Performance Optimization Phase 1 - Auth & Security Matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Core Authorization Invariants", () => {
    it("fails closed when unauthenticated (requireAuthSession)", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);
      await expect(requireAuthSession()).rejects.toThrow("Unauthorized");
    });

    it("fails closed when TeacherProfile is missing", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "u-1", name: "Teacher One", email: "t1@test.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
        session: { id: "s-1", userId: "u-1", token: "tok-1", expiresAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
      } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce(null);

      await expect(verifyActiveSchoolMembership()).rejects.toThrow(
        "Teacher profile or active school not found"
      );
    });

    it("fails closed when activeSchoolId is missing / null", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "u-1" },
      } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({
        id: "tp-1",
        userId: "u-1",
        activeSchoolId: null,
        memberships: [],
      } as unknown as never);

      await expect(verifyActiveSchoolMembership()).rejects.toThrow(
        "Teacher profile or active school not found"
      );
    });

    it("fails closed when membership status is REVOKED", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "u-1" },
      } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({
        id: "tp-1",
        userId: "u-1",
        activeSchoolId: "school-A",
        memberships: [
          {
            schoolId: "school-A",
            status: "REVOKED",
            school: { id: "school-A", name: "School A" },
          },
        ],
      } as unknown as never);

      await expect(verifyActiveSchoolMembership()).rejects.toThrow(
        "Not an active member of the school workspace"
      );
    });

    it("fails closed when user has ACTIVE membership for School B but activeSchoolId is School A", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "u-1" },
      } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({
        id: "tp-1",
        userId: "u-1",
        activeSchoolId: "school-A",
        memberships: [
          {
            schoolId: "school-B",
            status: "ACTIVE",
            school: { id: "school-B", name: "School B" },
          },
        ],
      } as unknown as never);

      await expect(verifyActiveSchoolMembership()).rejects.toThrow(
        "Not an active member of the school workspace"
      );
    });

    it("succeeds and consolidates active school when activeSchoolId matches ACTIVE membership", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({
        user: { id: "u-1" },
      } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({
        id: "tp-1",
        userId: "u-1",
        activeSchoolId: "school-A",
        memberships: [
          {
            schoolId: "school-A",
            status: "ACTIVE",
            school: { id: "school-A", name: "SMP Negeri 1" },
          },
        ],
      } as unknown as never);

      const result = await verifyActiveSchoolMembership();
      expect(result.activeSchoolId).toBe("school-A");
      expect(result.activeSchool.name).toBe("SMP Negeri 1");
      expect(result.profile.id).toBe("tp-1");
    });
  });

  describe("2. Context Ownership & Cross-School Authorization", () => {
    it("fails when context is not found (manipulated teachingContextId)", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "u-1" } } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({
        id: "tp-1",
        userId: "u-1",
        activeSchoolId: "school-A",
        memberships: [
          { schoolId: "school-A", status: "ACTIVE", school: { id: "school-A", name: "School A" } },
        ],
      } as unknown as never);
      vi.mocked(prisma.teachingContext.findUnique).mockResolvedValueOnce(null);

      await expect(verifyTeachingContextAccess("non-existent-ctx")).rejects.toThrow(
        "Teaching context not found"
      );
    });

    it("fails when context is owned by another teacher", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "u-1" } } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({
        id: "tp-1",
        userId: "u-1",
        activeSchoolId: "school-A",
        memberships: [
          { schoolId: "school-A", status: "ACTIVE", school: { id: "school-A", name: "School A" } },
        ],
      } as unknown as never);
      vi.mocked(prisma.teachingContext.findUnique).mockResolvedValueOnce({
        id: "ctx-other",
        teacherProfileId: "tp-2", // different teacher
        schoolId: "school-A",
      } as unknown as never);

      await expect(verifyTeachingContextAccess("ctx-other")).rejects.toThrow(
        "Forbidden: You do not own this teaching context"
      );
    });

    it("fails when context belongs to a different school workspace (cross-School denial)", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "u-1" } } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({
        id: "tp-1",
        userId: "u-1",
        activeSchoolId: "school-A",
        memberships: [
          { schoolId: "school-A", status: "ACTIVE", school: { id: "school-A", name: "School A" } },
        ],
      } as unknown as never);
      vi.mocked(prisma.teachingContext.findUnique).mockResolvedValueOnce({
        id: "ctx-school-b",
        teacherProfileId: "tp-1",
        schoolId: "school-B", // different school
      } as unknown as never);

      await expect(verifyTeachingContextAccess("ctx-school-b")).rejects.toThrow(
        "Forbidden: This context belongs to a different school workspace"
      );
    });

    it("succeeds and returns pre-included context relations to prevent secondary DB query", async () => {
      vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "u-1" } } as unknown as never);
      vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValueOnce({
        id: "tp-1",
        userId: "u-1",
        activeSchoolId: "school-A",
        memberships: [
          { schoolId: "school-A", status: "ACTIVE", school: { id: "school-A", name: "School A" } },
        ],
      } as unknown as never);
      vi.mocked(prisma.teachingContext.findUnique).mockResolvedValueOnce({
        id: "ctx-1",
        teacherProfileId: "tp-1",
        schoolId: "school-A",
        classId: "class-7a",
        subjectId: "sub-math",
        academicPeriodId: "period-2026",
        class: { id: "class-7a", name: "7A" },
        subject: { id: "sub-math", name: "Matematika" },
        academicPeriod: { id: "period-2026", year: "2026/2027", semester: "GANJIL" },
      } as unknown as never);

      const result = await verifyTeachingContextAccess("ctx-1");
      expect(result.context.id).toBe("ctx-1");
      expect(result.context.class.name).toBe("7A");
      expect(result.context.subject.name).toBe("Matematika");
      expect(result.context.academicPeriod.year).toBe("2026/2027");
    });
  });
});
