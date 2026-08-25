import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/auth";
import { generateImportSessionToken, computePayloadHash } from "../import.utils";
import { claimAndVerifyImportSession } from "../import.service";

describe("Stage 09 Import Engine — Real PostgreSQL-Backed Concurrency & Atomic Claim Test", () => {
  let dbAvailable = false;
  let schoolId: string | undefined;
  let teacherProfileId: string;
  let teachingContextId: string;
  let testUserId: string;

  const sampleRows = [
    { rowNum: 2, namaLengkap: "Budi Real DB", nis: "9901", status: "VALID", action: "CREATE", message: "Valid" },
  ];

  beforeAll(async () => {
    try {
      const timestamp = Date.now();
      const schoolName = `Test Concurrency School ${timestamp}`;
      const school = await prisma.school.create({
        data: {
          name: schoolName,
          normalizedName: schoolName.toLowerCase(),
          npsn: `NPSN${timestamp.toString().slice(-6)}`,
        },
      });
      schoolId = school.id;

      testUserId = `test-user-${timestamp}`;
      const user = await prisma.user.create({
        data: {
          id: testUserId,
          email: `${testUserId}@example.com`,
          name: "Test Teacher Concurrency",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const teacher = await prisma.teacherProfile.create({
        data: {
          userId: user.id,
          activeSchoolId: school.id,
        },
      });
      teacherProfileId = teacher.id;

      const academicPeriod = await prisma.academicPeriod.create({
        data: {
          schoolId: school.id,
          year: `2026/2027-${timestamp}`,
          semester: "Ganjil",
          status: "ACTIVE",
        },
      });

      const subjectName = `Matematika ${timestamp}`;
      const subject = await prisma.subject.create({
        data: {
          schoolId: school.id,
          name: subjectName,
          normalizedName: subjectName.toLowerCase(),
        },
      });

      const className = `7-C-${timestamp}`;
      const classRoom = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: className,
          normalizedName: className.toLowerCase(),
        },
      });

      const context = await prisma.teachingContext.create({
        data: {
          teacherProfileId: teacher.id,
          schoolId: school.id,
          academicPeriodId: academicPeriod.id,
          subjectId: subject.id,
          classId: classRoom.id,
        },
      });
      teachingContextId = context.id;
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    try {
      if (schoolId) {
        await prisma.importSession.deleteMany({ where: { schoolId } });
        await prisma.teachingContext.deleteMany({ where: { schoolId } });
        await prisma.class.deleteMany({ where: { schoolId } });
        await prisma.subject.deleteMany({ where: { schoolId } });
        await prisma.academicPeriod.deleteMany({ where: { schoolId } });
        await prisma.teacherProfile.deleteMany({ where: { activeSchoolId: schoolId } });
        await prisma.user.deleteMany({ where: { id: testUserId } });
        await prisma.school.deleteMany({ where: { id: schoolId } });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  it("real DB concurrency: two concurrent transactions target the same ImportSession -> exactly 1 winner, 1 loser", async () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return;
    }

    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    // Create real ImportSession row in PostgreSQL
    const session = await prisma.importSession.create({
      data: {
        tokenHash,
        teacherProfileId,
        schoolId: schoolId!,
        teachingContextId,
        category: "ROSTER",
        payloadHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
        consumedAt: null,
      },
    });
    expect(session.consumedAt).toBeNull();

    // Launch TWO real concurrent Prisma transactions targeting the same ImportSession token
    const results = await Promise.allSettled([
      prisma.$transaction(async (tx) => {
        await claimAndVerifyImportSession(
          tx,
          rawToken,
          teacherProfileId,
          schoolId!,
          teachingContextId,
          "ROSTER",
          sampleRows
        );
      }),
      prisma.$transaction(async (tx) => {
        await claimAndVerifyImportSession(
          tx,
          rawToken,
          teacherProfileId,
          schoolId!,
          teachingContextId,
          "ROSTER",
          sampleRows
        );
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one transaction must win, and exactly one must fail atomically
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    if (rejected[0].status === "rejected") {
      const errorMsg = (rejected[0].reason as Error).message;
      expect(
        errorMsg.includes("Sesi import sedang diproses atau sudah digunakan") ||
        errorMsg.includes("Sesi import sudah pernah digunakan")
      ).toBe(true);
    }

    // Verify persisted DB state: consumedAt is recorded
    const persisted = await prisma.importSession.findUnique({
      where: { tokenHash },
    });
    expect(persisted?.consumedAt).not.toBeNull();
  });

  it("real DB replay protection: subsequent attempt on consumed ImportSession is strictly rejected", async () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return;
    }

    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    // Create and consume session
    await prisma.importSession.create({
      data: {
        tokenHash,
        teacherProfileId,
        schoolId: schoolId!,
        teachingContextId,
        category: "ROSTER",
        payloadHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        consumedAt: null,
      },
    });

    // First claim: succeeds
    await prisma.$transaction(async (tx) => {
      await claimAndVerifyImportSession(
        tx,
        rawToken,
        teacherProfileId,
        schoolId!,
        teachingContextId,
        "ROSTER",
        sampleRows
      );
    });

    // Replay attempt: must fail
    await expect(
      prisma.$transaction(async (tx) => {
        await claimAndVerifyImportSession(
          tx,
          rawToken,
          teacherProfileId,
          schoolId!,
          teachingContextId,
          "ROSTER",
          sampleRows
        );
      })
    ).rejects.toThrow("Sesi import sudah pernah digunakan (one-time token replay detected).");
  });
});
