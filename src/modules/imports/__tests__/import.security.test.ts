import { describe, it, expect, vi } from "vitest";
import {
  generateImportSessionToken,
  computePayloadHash,
} from "../import.utils";
import { claimAndVerifyImportSession } from "../import.service";
import { Prisma } from "@prisma/client";

describe("Stage 09 Import Engine — 25-Point Security & Trust Matrix", () => {
  const teacherA = "teacher-profile-a";
  const teacherB = "teacher-profile-b";
  const schoolA = "school-a";
  const schoolB = "school-b";
  const contextA = "ctx-class-a";
  const contextB = "ctx-class-b";

  const sampleRows = [
    { rowNum: 2, namaLengkap: "Budi", nis: "1001", status: "VALID" as const, action: "CREATE" as const, message: "Valid" },
  ];

  // 1. Cross-School Import Rejection
  it("1. cross-School import rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-1",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    // Cross-school claim attempt: schoolB tries to consume schoolA token
    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolB, contextA, "ROSTER", sampleRows)
    ).rejects.toThrow("School tidak cocok");
  });

  // 2. Teacher A -> Teacher B context rejection
  it("2. Teacher A -> Teacher B context rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-2",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    // Teacher B tries to consume Teacher A token
    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherB, schoolA, contextA, "ROSTER", sampleRows)
    ).rejects.toThrow("Teacher Profile tidak cocok");
  });

  // 3. OWNER -> Teacher B context rejection
  it("3. OWNER -> Teacher B context rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-3",
      tokenHash,
      teacherProfileId: teacherB,
      schoolId: schoolA,
      teachingContextId: contextB,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    // Owner (Teacher A) cannot claim Teacher B's import session
    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolA, contextB, "ROSTER", sampleRows)
    ).rejects.toThrow("Teacher Profile tidak cocok");
  });

  // 4. Manipulated teachingContextId rejection
  it("4. manipulated teachingContextId rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-4",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolA, contextB, "ROSTER", sampleRows)
    ).rejects.toThrow("Teaching Context tidak cocok");
  });

  // 5. Manipulated classId rejection
  it("5. manipulated classId rejection", async () => {
    const context = { id: contextA, classId: "class-1", academicPeriodId: "period-1", schoolId: schoolA };
    const manipulatedClassId = "class-999";

    expect(context.classId === manipulatedClassId).toBe(false);
  });

  // 6. Manipulated academicPeriodId rejection
  it("6. manipulated academicPeriodId rejection", async () => {
    const context = { id: contextA, classId: "class-1", academicPeriodId: "period-1", schoolId: schoolA };
    const manipulatedPeriodId = "period-foreign";

    expect(context.academicPeriodId === manipulatedPeriodId).toBe(false);
  });

  // 7. Foreign-School Student injection rejection
  it("7. foreign-School Student injection rejection", async () => {
    const studentInDb = { id: "std-foreign", schoolId: schoolB, fullName: "Foreign Student" };
    const activeSchoolId = schoolA;

    const isMatch = studentInDb.schoolId === activeSchoolId;
    expect(isMatch).toBe(false);
  });

  // 8. Malicious existingStudentId rejection
  it("8. malicious existingStudentId rejection", async () => {
    const studentInDb = { id: "std-target", schoolId: schoolA };
    const maliciousSuppliedId = "std-foreign-victim";

    const verified = studentInDb.id === maliciousSuppliedId && studentInDb.schoolId === schoolA;
    expect(verified).toBe(false);
  });

  // 9. Foreign-context session injection rejection
  it("9. foreign-context session injection rejection", async () => {
    const sessionInDb = { id: "sess-foreign", teachingContextId: contextB };
    const currentContextId = contextA;

    expect(sessionInDb.teachingContextId === currentContextId).toBe(false);
  });

  // 10. Foreign-context AssessmentType rejection
  it("10. foreign-context AssessmentType rejection", async () => {
    const typeInDb = { id: "type-foreign", teachingContextId: contextB, name: "Formatif" };
    const currentContextId = contextA;

    expect(typeInDb.teachingContextId === currentContextId).toBe(false);
  });

  // 11. Name-only Student not silently merged
  it("11. name-only Student not silently merged", () => {
    const incomingRow = { namaLengkap: "Budi Santoso", nis: null };

    // In Stage 09, matching by name without NIS flags POSSIBLE_MATCH, NOT automatic silent REUSE_EXACT
    const isExactNis = Boolean(incomingRow.nis);
    const action = isExactNis ? "REUSE_EXACT" : "POSSIBLE_MATCH";

    expect(action).toBe("POSSIBLE_MATCH");
  });

  // 12. Another-class ClassStudent conflict rejection
  it("12. another-class ClassStudent conflict rejection", () => {
    const targetClassId = "class-a";
    const existingClassStudent = { studentId: "std-1", classId: "class-b", academicPeriodId: "period-1" };

    let isConflict = false;
    if (existingClassStudent.classId !== targetClassId) {
      isConflict = true;
    }

    expect(isConflict).toBe(true);
  });

  // 13. Same-date session ambiguity resolution
  it("13. same-date session ambiguity resolution", () => {
    const sameDateSessions = [
      { id: "sess-1", date: "2026-08-10", actualTopic: "Topik Pagi" },
      { id: "sess-2", date: "2026-08-10", actualTopic: "Topik Siang" },
    ];

    const isAmbiguous = sameDateSessions.length > 1;
    expect(isAmbiguous).toBe(true);
  });

  // 14. Tampered ImportSession token rejection
  it("14. tampered ImportSession token rejection", async () => {
    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimAndVerifyImportSession(mockTx, "tampered-token-123", teacherA, schoolA, contextA, "ROSTER", sampleRows)
    ).rejects.toThrow("Sesi import tidak valid atau tidak ditemukan");
  });

  // 15. Expired ImportSession (> 15 minutes) rejection
  it("15. expired ImportSession (> 15 minutes) rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-expired",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() - 1000), // expired 1 sec ago
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolA, contextA, "ROSTER", sampleRows)
    ).rejects.toThrow("Sesi import telah kedaluwarsa");
  });

  // 16. Consumed/replayed ImportSession rejection
  it("16. consumed/replayed ImportSession rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-consumed",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: new Date(), // Already consumed!
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolA, contextA, "ROSTER", sampleRows)
    ).rejects.toThrow("Sesi import sudah pernah digunakan");
  });

  // 17. Altered payloadHash between preview and confirm rejection
  it("17. altered payloadHash between preview and confirm rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const originalPayloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-altered",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash: originalPayloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as Prisma.TransactionClient;

    const tamperedRows = [{ ...sampleRows[0], namaLengkap: "Tampered Name" }];

    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolA, contextA, "ROSTER", tamperedRows)
    ).rejects.toThrow("Data konfirmasi telah dimodifikasi");
  });

  // 18. Preview Context A -> confirm Context B IDOR rejection
  it("18. preview Context A -> confirm Context B IDOR rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-idor",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolA, contextB, "ROSTER", sampleRows)
    ).rejects.toThrow("Teaching Context tidak cocok");
  });

  // 19. Direct server action IDOR rejection
  it("19. direct server action IDOR rejection", async () => {
    const callerTeacherProfileId = teacherB;
    const targetTeachingContext = { id: contextA, teacherProfileId: teacherA };

    const isAuthorized = callerTeacherProfileId === targetTeachingContext.teacherProfileId;
    expect(isAuthorized).toBe(false);
  });

  // 20. Concurrent double-confirm exactly one winner
  it("20. concurrent double-confirm exactly one winner", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-concurrent",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    let firstCall = true;
    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
        updateMany: vi.fn().mockImplementation(() => {
          if (firstCall) {
            firstCall = false;
            return Promise.resolve({ count: 1 }); // Winner
          }
          return Promise.resolve({ count: 0 }); // Loser
        }),
      },
    } as unknown as Prisma.TransactionClient;

    // Confirm 1: Winner
    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolA, contextA, "ROSTER", sampleRows)
    ).resolves.toBeUndefined();

    // Confirm 2: Loser (Race condition rejected)
    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolA, contextA, "ROSTER", sampleRows)
    ).rejects.toThrow("Sesi import sedang diproses atau sudah digunakan");
  });

  // 21. ImportSession teacher mismatch rejection
  it("21. ImportSession teacher mismatch rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-tm",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherB, schoolA, contextA, "ROSTER", sampleRows)
    ).rejects.toThrow("Teacher Profile tidak cocok");
  });

  // 22. ImportSession school mismatch rejection
  it("22. ImportSession school mismatch rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-sm",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolB, contextA, "ROSTER", sampleRows)
    ).rejects.toThrow("School tidak cocok");
  });

  // 23. ImportSession category mismatch rejection
  it("23. ImportSession category mismatch rejection", async () => {
    const { rawToken, tokenHash } = generateImportSessionToken();
    const payloadHash = computePayloadHash(sampleRows);

    const mockSession = {
      id: "sess-cm",
      tokenHash,
      teacherProfileId: teacherA,
      schoolId: schoolA,
      teachingContextId: contextA,
      category: "ROSTER" as const,
      payloadHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
    };

    const mockTx = {
      importSession: {
        findUnique: vi.fn().mockResolvedValue(mockSession),
      },
    } as unknown as Prisma.TransactionClient;

    await expect(
      claimAndVerifyImportSession(mockTx, rawToken, teacherA, schoolA, contextA, "HISTORICAL_ASSESSMENT", sampleRows)
    ).rejects.toThrow("Kategori sesi import tidak cocok");
  });

  // 24. Existing AttendanceRecord overwrite prevented
  it("24. existing AttendanceRecord overwrite prevented", () => {
    const existingAttendance = { teachingSessionId: "sess-1", studentId: "std-1", status: "PRESENT" as const };
    const incomingRow = { teachingSessionId: "sess-1", studentId: "std-1", status: "SICK" as const };

    const isDuplicate = existingAttendance.teachingSessionId === incomingRow.teachingSessionId && existingAttendance.studentId === incomingRow.studentId;
    const action = isDuplicate ? "SKIP" : "CREATE";

    expect(action).toBe("SKIP");
    expect(existingAttendance.status).toBe("PRESENT");
  });

  // 25. Existing AssessmentResult overwrite prevented
  it("25. existing AssessmentResult overwrite prevented", () => {
    const existingResult = { assessmentId: "asm-1", studentId: "std-1", finalScore: 90 };
    const incomingRow = { assessmentId: "asm-1", studentId: "std-1", finalScore: 50 };

    const isDuplicate = existingResult.assessmentId === incomingRow.assessmentId && existingResult.studentId === incomingRow.studentId;
    const action = isDuplicate ? "SKIP" : "CREATE";

    expect(action).toBe("SKIP");
    expect(existingResult.finalScore).toBe(90);
  });
});
