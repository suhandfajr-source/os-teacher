import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/auth
vi.mock("@/lib/auth", () => ({
  prisma: {
    class: {
      findUnique: vi.fn(),
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
  generateRandomJoinCode,
  generateClassJoinCode,
  rotateClassJoinCode,
  lockClassJoinCode,
} from "../class-join-code.actions";

describe("Class Join Code Actions (Teacher Controls)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifyActiveSchoolMembership as any).mockResolvedValue({
      activeSchoolId: "sch_1",
    });
  });

  describe("generateRandomJoinCode", () => {
    it("generates 6-character code with allowed charset and no ambiguous chars (0, O, 1, I)", () => {
      for (let i = 0; i < 50; i++) {
        const code = generateRandomJoinCode();
        expect(code).toHaveLength(6);
        expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
        expect(code).not.toMatch(/[01OI]/);
      }
    });
  });

  describe("generateClassJoinCode", () => {
    it("generates and stores joinCode if class belongs to teacher active school", async () => {
      (prisma.class.findUnique as any)
        .mockResolvedValueOnce({
          id: "cls_1",
          schoolId: "sch_1",
          joinCode: null,
          joinCodeLocked: false,
        })
        .mockResolvedValueOnce(null); // uniqueness check in loop

      (prisma.class.update as any).mockResolvedValue({
        id: "cls_1",
        joinCode: "ABC234",
        joinCodeLocked: false,
      });

      const res = await generateClassJoinCode("cls_1");
      expect(res.success).toBe(true);
      expect(res.joinCode).toBe("ABC234");
      expect(prisma.class.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cls_1" },
          data: expect.objectContaining({
            joinCodeLocked: false,
          }),
        })
      );
    });

    it("throws error if class belongs to different school", async () => {
      (prisma.class.findUnique as any).mockResolvedValueOnce({
        id: "cls_1",
        schoolId: "sch_different",
      });

      await expect(generateClassJoinCode("cls_1")).rejects.toThrow(
        "Kelas tidak ditemukan di sekolah aktif Anda."
      );
    });
  });

  describe("rotateClassJoinCode", () => {
    it("generates new code even if one already existed", async () => {
      (prisma.class.findUnique as any)
        .mockResolvedValueOnce({
          id: "cls_1",
          schoolId: "sch_1",
        })
        .mockResolvedValueOnce(null); // uniqueness check

      (prisma.class.update as any).mockResolvedValue({
        id: "cls_1",
        joinCode: "XYZ999",
        joinCodeLocked: false,
      });

      const res = await rotateClassJoinCode("cls_1");
      expect(res.success).toBe(true);
      expect(res.joinCode).toBe("XYZ999");
    });
  });

  describe("lockClassJoinCode", () => {
    it("locks and unlocks class join code successfully", async () => {
      (prisma.class.findUnique as any).mockResolvedValueOnce({
        id: "cls_1",
        schoolId: "sch_1",
        joinCode: "ABC234",
      });

      (prisma.class.update as any).mockResolvedValue({
        id: "cls_1",
        joinCode: "ABC234",
        joinCodeLocked: true,
      });

      const res = await lockClassJoinCode("cls_1", true);
      expect(res.success).toBe(true);
      expect(res.joinCodeLocked).toBe(true);

      expect(prisma.class.update).toHaveBeenCalledWith({
        where: { id: "cls_1" },
        data: { joinCodeLocked: true },
        select: expect.any(Object),
      });
    });
  });
});
