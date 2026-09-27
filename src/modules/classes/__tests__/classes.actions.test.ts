/* eslint-disable @typescript-eslint/no-explicit-any -- mock Prisma mengikuti pola test repo */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Review 36c5321 (VG-5): join code yang dibangkitkan createClassAction tidak
// pernah di-assert — pengaktor inti fitur bisa rusak tanpa sinyal test.
vi.mock("@/lib/auth", () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    $queryRaw: vi.fn(async () => []),
    class: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    teachingContext: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/authorization", () => ({
  verifyActiveSchoolMembership: vi.fn(),
}));

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";
import { createClassAction } from "../classes.actions";

const JOIN_CODE_RE = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

describe("createClassAction — join code generation (review 36c5321)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (verifyActiveSchoolMembership as any).mockResolvedValue({
      profile: { id: "tp_1", userId: "usr_1" },
      activeSchoolId: "sch_1",
    });
    // Kelas selalu dianggap baru; kandidat kode selalu unik di loop kolisi.
    (prisma.class.findFirst as any).mockResolvedValue(null);
    (prisma.class.findUnique as any).mockResolvedValue(null);
    (prisma.class.create as any).mockImplementation(({ data }: { data: { joinCode: string | null } }) =>
      Promise.resolve({ id: `cls_${data.joinCode}`, ...data })
    );
    (prisma.teachingContext.findUnique as any).mockResolvedValue(null);
    (prisma.teachingContext.create as any).mockResolvedValue({ id: "ctx_1" });
  });

  it("menyimpan joinCode valid (6 karakter, charset aman 32, tanpa ambigu 0/O/1/I) saat membuat kelas", async () => {
    const res = await createClassAction({
      className: "7-A",
      gradeLevel: "7",
      academicPeriodId: "prd_1",
      subjectId: "sub_1",
    });

    expect(res.success).toBe(true);
    expect(prisma.class.create).toHaveBeenCalledTimes(1);
    const payload = (prisma.class.create as any).mock.calls[0][0].data;
    expect(payload.joinCode).toMatch(JOIN_CODE_RE);
    expect(payload.joinCode).not.toMatch(/[01OI]/);
    expect(payload.joinCodeLocked).toBe(false);
    expect(payload.joinCodeUpdatedAt).toBeInstanceOf(Date);
  });

  it("dua kelas berbeda mendapat join code berbeda dari generator", async () => {
    await createClassAction({
      className: "7-A",
      academicPeriodId: "prd_1",
      subjectId: "sub_1",
    });
    await createClassAction({
      className: "7-B",
      academicPeriodId: "prd_1",
      subjectId: "sub_1",
    });

    expect(prisma.class.create).toHaveBeenCalledTimes(2);
    const first = (prisma.class.create as any).mock.calls[0][0].data.joinCode;
    const second = (prisma.class.create as any).mock.calls[1][0].data.joinCode;
    expect(first).toMatch(JOIN_CODE_RE);
    expect(second).toMatch(JOIN_CODE_RE);
    expect(first).not.toBe(second);
  });
});
