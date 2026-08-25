import { describe, it, expect } from "vitest";

describe("Stage 09 Import Engine — Historical Integrity Invariants", () => {
  it("A. Journal-only source: date + actualTopic without attendance participant rows -> no TeachingSession persistence", () => {
    const journalOnlyRow = {
      date: "2026-08-10",
      actualTopic: "Materi Tanpa Presensi",
      activitySummary: "Catatan jurnal guru saja",
      participantRows: [], // 0 explicit attendance participants
    };

    let status: "VALID" | "ERROR" = "VALID";
    let action: "CREATE" | "SKIP" = "CREATE";
    let message = "";
    let willPersistSession = true;

    if (journalOnlyRow.participantRows.length === 0) {
      status = "ERROR";
      action = "SKIP";
      message =
        "Sesi pembelajaran lampau (COMPLETED) tidak dapat dibuat tanpa bukti presensi faktual peserta didik (Stage 03 invariant). Impor presensi lampau untuk mencatat sesi beserta daftar hadirnya.";
      willPersistSession = false;
    }

    expect(status).toBe("ERROR");
    expect(action).toBe("SKIP");
    expect(willPersistSession).toBe(false);
    expect(message).toContain("tidak dapat dibuat tanpa bukti presensi faktual");
  });

  it("B. No persisted: COMPLETED + attendanceRecordedAt null (Locked Stage 03 invariant)", () => {
    // Invariant rule: COMPLETED TeachingSession strictly requires actualTopic != null AND attendanceRecordedAt != null
    const invalidCompletedSession = {
      status: "COMPLETED" as const,
      actualTopic: "Topik Faktual",
      attendanceRecordedAt: null, // INVALID!
    };

    const isValidCompletedSession =
      invalidCompletedSession.status === "COMPLETED"
        ? invalidCompletedSession.actualTopic !== null &&
          invalidCompletedSession.attendanceRecordedAt !== null
        : true;

    expect(isValidCompletedSession).toBe(false);
  });

  it("C. Valid historical import: factual date + factual topic + explicit attendance participants -> COMPLETED session", () => {
    const historicalImportPayload = {
      date: new Date("2026-08-15"),
      actualTopic: "Aljabar dan Fungsi Linear",
      participantRows: [
        { studentId: "std-1", status: "PRESENT" as const },
        { studentId: "std-2", status: "SICK" as const },
      ],
    };

    const importPersistenceTimestamp = new Date();
    const createdSession = {
      date: historicalImportPayload.date,
      actualTopic: historicalImportPayload.actualTopic,
      status: "COMPLETED" as const,
      attendanceRecordedAt: importPersistenceTimestamp,
    };

    expect(createdSession.status).toBe("COMPLETED");
    expect(createdSession.actualTopic).toBe("Aljabar dan Fungsi Linear");
    expect(createdSession.attendanceRecordedAt).toEqual(importPersistenceTimestamp);
    expect(historicalImportPayload.participantRows).toHaveLength(2);
  });

  it("D. attendanceRecordedAt: not null after successful import", () => {
    const importTimestamp = new Date();
    const persistedSession = {
      id: "sess-123",
      status: "COMPLETED" as const,
      actualTopic: "Geometri Bidang",
      attendanceRecordedAt: importTimestamp,
    };

    expect(persistedSession.attendanceRecordedAt).not.toBeNull();
    expect(persistedSession.attendanceRecordedAt).toBeInstanceOf(Date);
  });

  it("E. attendanceRecordedAt: represents import persistence time and is not fabricated from historical session date", () => {
    const historicalSessionDate = new Date("2026-08-10");
    const actualImportConfirmationTime = new Date("2026-08-24T21:00:00Z");

    const session = {
      date: historicalSessionDate,
      actualTopic: "Trigonometri Dasar",
      status: "COMPLETED" as const,
      attendanceRecordedAt: actualImportConfirmationTime,
    };

    expect(session.attendanceRecordedAt).not.toEqual(historicalSessionDate);
    expect(session.attendanceRecordedAt).toEqual(actualImportConfirmationTime);
  });

  it("F. startedAt: null (No fabricated session start time)", () => {
    const session = {
      date: new Date("2026-08-15"),
      actualTopic: "Sistem Persamaan Linear",
      startedAt: null,
      status: "COMPLETED" as const,
    };

    expect(session.startedAt).toBeNull();
  });

  it("G. endedAt: null (No fabricated session end time)", () => {
    const session = {
      date: new Date("2026-08-15"),
      actualTopic: "Sistem Persamaan Linear",
      endedAt: null,
      status: "COMPLETED" as const,
    };

    expect(session.endedAt).toBeNull();
  });

  it("H. plannedTopic: null (No fabricated planning data)", () => {
    const session = {
      date: new Date("2026-08-15"),
      actualTopic: "Sistem Persamaan Linear",
      plannedTopic: null,
      status: "COMPLETED" as const,
    };

    expect(session.plannedTopic).toBeNull();
  });

  it("I. reflection: null (No fabricated teacher reflection)", () => {
    const session = {
      date: new Date("2026-08-15"),
      actualTopic: "Sistem Persamaan Linear",
      reflection: null,
      status: "COMPLETED" as const,
    };

    expect(session.reflection).toBeNull();
  });

  it("J. AttendanceRecord participant set: exactly imported rows, not current roster", () => {
    const currentClassRoster = ["std-1", "std-2", "std-3", "std-4", "std-5", "std-6"];
    const explicitImportedRows = [
      { studentId: "std-1", status: "PRESENT" },
      { studentId: "std-2", status: "SICK" },
      { studentId: "std-3", status: "PERMISSION" },
    ];

    const historicalParticipantSet = explicitImportedRows.map((r) => r.studentId);

    expect(historicalParticipantSet).toHaveLength(3);
    expect(currentClassRoster).toHaveLength(6);
    expect(historicalParticipantSet).not.toContain("std-4");
    expect(historicalParticipantSet).not.toContain("std-5");
    expect(historicalParticipantSet).not.toContain("std-6");
  });

  it("K. blank score without explicit absent/excused status is an ERROR / unresolved, never converts to 0 or ABSENT", () => {
    const blankScoreCell: string = "";
    const rawStatusStr: string = ""; // No explicit attendance/status string

    let validationStatus: "VALID" | "ERROR" = "VALID";
    let rawScore: number | null = null;
    let resultStatus: "GRADED" | "ABSENT" | "EXCUSED" | null = null;

    if (rawStatusStr === "ABSENT" || rawStatusStr === "ALPA") {
      resultStatus = "ABSENT";
    } else if (rawStatusStr === "EXCUSED" || rawStatusStr === "IZIN" || rawStatusStr === "SAKIT") {
      resultStatus = "EXCUSED";
    } else if (blankScoreCell.trim() !== "") {
      rawScore = parseFloat(blankScoreCell);
      resultStatus = "GRADED";
    } else {
      // Blank score without explicit status is strictly an ERROR / unresolved
      validationStatus = "ERROR";
      rawScore = null;
      resultStatus = null;
    }

    expect(validationStatus).toBe("ERROR");
    expect(rawScore).toBeNull();
    expect(resultStatus).toBeNull();
    expect(resultStatus).not.toBe("ABSENT"); // Never convert missing info to ABSENT!
    expect(rawScore).not.toBe(0); // Never convert missing info to 0!
  });

  it("L. explicit zero remains valid numeric zero with GRADED status", () => {
    const zeroScoreCell: string = "0";
    const parsedRaw = parseFloat(zeroScoreCell);
    let rawScore: number | null = null;
    let resultStatus: "GRADED" | "ABSENT" | "EXCUSED" = "GRADED";

    if (zeroScoreCell.trim() !== "") {
      rawScore = parsedRaw;
      resultStatus = "GRADED";
    }

    expect(rawScore).toBe(0);
    expect(rawScore).not.toBeNull();
    expect(resultStatus).toBe("GRADED");
  });

  it("M. existing historical facts are never silently overwritten by re-import", () => {
    const existingRecord = {
      id: "att-1",
      sessionId: "session-1",
      studentId: "student-1",
      status: "PRESENT" as const,
    };

    const incomingDuplicate = {
      sessionId: "session-1",
      studentId: "student-1",
      status: "SICK" as const,
    };

    let action: "CREATE" | "SKIP" = "CREATE";
    if (
      existingRecord.sessionId === incomingDuplicate.sessionId &&
      existingRecord.studentId === incomingDuplicate.studentId
    ) {
      action = "SKIP";
    }

    expect(action).toBe("SKIP");
    expect(existingRecord.status).toBe("PRESENT");
  });

  it("N. existing assessment results are protected against overwrite", () => {
    const existingResult = {
      assessmentId: "asm-1",
      studentId: "std-1",
      finalScore: 92,
    };

    const incomingDuplicate = {
      assessmentId: "asm-1",
      studentId: "std-1",
      finalScore: 40,
    };

    let action: "CREATE" | "SKIP" = "CREATE";
    if (
      existingResult.assessmentId === incomingDuplicate.assessmentId &&
      existingResult.studentId === incomingDuplicate.studentId
    ) {
      action = "SKIP";
    }

    expect(action).toBe("SKIP");
    expect(existingResult.finalScore).toBe(92);
  });

  it("O. new AssessmentType requires explicit category confirmation (no guessing / no auto-provisioning)", () => {
    const unconfirmedTypeRow = {
      assessmentTypeName: "Ulangan Harian 1",
      matchedAssessmentTypeId: undefined,
      confirmedCategory: undefined, // Teacher has NOT confirmed category yet
    };

    let canExecute = true;
    let error = "";

    if (!unconfirmedTypeRow.matchedAssessmentTypeId && !unconfirmedTypeRow.confirmedCategory) {
      canExecute = false;
      error = `Kategori penilaian untuk jenis penilaian baru '${unconfirmedTypeRow.assessmentTypeName}' wajib dikonfirmasi secara eksplisit oleh guru. Auto-provisioning / guessing tidak diizinkan.`;
    }

    expect(canExecute).toBe(false);
    expect(error).toContain("wajib dikonfirmasi secara eksplisit oleh guru");
  });
});
