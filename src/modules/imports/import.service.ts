import { prisma } from "@/lib/auth";
import { Prisma, AssessmentCategory } from "@prisma/client";
import { read, utils } from "xlsx";
import {
  ImportPreviewPayload,
  ImportExecutionResult,
  RosterValidationRow,
  HistoricalSessionValidationRow,
  HistoricalAttendanceValidationRow,
  HistoricalAssessmentValidationRow,
  AvailableSessionInfo,
} from "./import.types";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_ROW_COUNT,
  MAX_COLUMN_COUNT,
  sanitizeCellString,
  parseDateToIsoDateString,
  normalizeAttendanceStatus,
  generateImportSessionToken,
  hashToken,
  computePayloadHash,
} from "./import.utils";
import { calculateNormalizedScore, normalizeName } from "@/modules/assessment/assessment.service";

// ============================================================================
// 1. WORKBOOK PARSING HELPER
// ============================================================================

export function parseRawWorkbook(buffer: ArrayBuffer | Buffer): {
  sheetNames: string[];
  headers: string[];
  rows: unknown[][];
} {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (buf.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Ukuran file melebihi batas maksimum (${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB).`);
  }

  const workbook = read(buf, {
    type: "buffer",
    raw: false,
    cellDates: true,
    cellFormula: false,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("File spreadsheet tidak memiliki lembar kerja (worksheet).");
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    throw new Error("Lembar kerja kosong atau tidak dapat dibaca.");
  }

  const rawJson = utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

  if (!rawJson || rawJson.length < 2) {
    throw new Error("File spreadsheet tidak memiliki baris data.");
  }

  if (rawJson.length > MAX_ROW_COUNT + 1) {
    throw new Error(`Jumlah baris (${rawJson.length - 1}) melebihi batas maksimum (${MAX_ROW_COUNT} baris).`);
  }

  const headers = (rawJson[0] || []).map((h) => sanitizeCellString(h));

  if (headers.length > MAX_COLUMN_COUNT) {
    throw new Error(`Jumlah kolom (${headers.length}) melebihi batas maksimum (${MAX_COLUMN_COUNT} kolom).`);
  }

  const rows = rawJson.slice(1);
  return { sheetNames: workbook.SheetNames, headers, rows };
}

// ============================================================================
// 2. PERSISTED IMPORT SESSION HELPERS (One-Time Claim & Atomic Concurrency)
// ============================================================================

export async function createImportSessionRecord<TRow>(
  teacherProfileId: string,
  schoolId: string,
  teachingContextId: string,
  category: "ROSTER" | "HISTORICAL_SESSION" | "HISTORICAL_ATTENDANCE" | "HISTORICAL_ASSESSMENT",
  rows: TRow[]
): Promise<string> {
  const { rawToken, tokenHash } = generateImportSessionToken();
  const payloadHash = computePayloadHash(rows);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await prisma.importSession.create({
    data: {
      tokenHash,
      teacherProfileId,
      schoolId,
      teachingContextId,
      category,
      payloadHash,
      expiresAt,
    },
  });

  return rawToken;
}

export async function claimAndVerifyImportSession(
  tx: Prisma.TransactionClient,
  rawToken: string,
  teacherProfileId: string,
  schoolId: string,
  teachingContextId: string,
  expectedCategory: "ROSTER" | "HISTORICAL_SESSION" | "HISTORICAL_ATTENDANCE" | "HISTORICAL_ASSESSMENT",
  currentRows: unknown[]
): Promise<void> {
  const tokenHash = hashToken(rawToken);

  const session = await tx.importSession.findUnique({
    where: { tokenHash },
  });

  if (!session) {
    throw new Error("Sesi import tidak valid atau tidak ditemukan.");
  }

  if (session.teacherProfileId !== teacherProfileId) {
    throw new Error("Otorisasi import session gagal: Teacher Profile tidak cocok.");
  }

  if (session.schoolId !== schoolId) {
    throw new Error("Otorisasi import session gagal: School tidak cocok.");
  }

  if (session.teachingContextId !== teachingContextId) {
    throw new Error("Otorisasi import session gagal: Teaching Context tidak cocok.");
  }

  if (session.category !== expectedCategory) {
    throw new Error("Kategori sesi import tidak cocok.");
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new Error("Sesi import telah kedaluwarsa (batas 15 menit).");
  }

  if (session.consumedAt !== null) {
    throw new Error("Sesi import sudah pernah digunakan (one-time token replay detected).");
  }

  const currentPayloadHash = computePayloadHash(currentRows);
  if (session.payloadHash !== currentPayloadHash) {
    throw new Error("Data konfirmasi telah dimodifikasi setelah pratinjau dibuat.");
  }

  // Atomic conditional update to prevent double-confirm race condition
  const claimResult = await tx.importSession.updateMany({
    where: {
      id: session.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      consumedAt: new Date(),
    },
  });

  if (claimResult.count !== 1) {
    throw new Error("Sesi import sedang diproses atau sudah digunakan oleh proses lain.");
  }
}

// ============================================================================
// 3. ROSTER IMPORT SERVICE
// ============================================================================

export async function validateRosterImport(
  schoolId: string,
  teachingContextId: string,
  teacherProfileId: string,
  fileBuffer: ArrayBuffer | Buffer,
  mapping: { namaCol: string; nisCol?: string }
): Promise<ImportPreviewPayload<RosterValidationRow>> {
  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId },
  });
  if (!context || context.schoolId !== schoolId) {
    throw new Error("Konteks mengajar tidak valid untuk sekolah aktif.");
  }

  const { headers, rows } = parseRawWorkbook(fileBuffer);

  const namaIdx = headers.findIndex((h) => h.toLowerCase() === mapping.namaCol.toLowerCase());
  const nisIdx = mapping.nisCol
    ? headers.findIndex((h) => h.toLowerCase() === mapping.nisCol?.toLowerCase())
    : -1;

  if (namaIdx === -1) {
    throw new Error(`Kolom untuk 'Nama Siswa' (${mapping.namaCol}) tidak ditemukan dalam file.`);
  }

  const validationRows: RosterValidationRow[] = [];
  const seenNisInFile = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;

    const rowNum = i + 2;
    const rawNama = sanitizeCellString(row[namaIdx]);
    const rawNis = nisIdx !== -1 ? sanitizeCellString(row[nisIdx]) || null : null;

    if (!rawNama) {
      validationRows.push({
        rowNum,
        namaLengkap: "",
        nis: rawNis,
        status: "ERROR",
        message: "Nama Lengkap wajib diisi.",
        action: "SKIP",
      });
      continue;
    }

    if (rawNis) {
      if (seenNisInFile.has(rawNis)) {
        validationRows.push({
          rowNum,
          namaLengkap: rawNama,
          nis: rawNis,
          status: "ERROR",
          message: `Duplikasi NIS (${rawNis}) terdeteksi di dalam file spreadsheet.`,
          action: "SKIP",
        });
        continue;
      }
      seenNisInFile.add(rawNis);
    }

    let dbStatus: RosterValidationRow["status"] = "VALID";
    let dbMessage = "Siap didaftarkan sebagai siswa baru.";
    let dbAction: RosterValidationRow["action"] = "CREATE";
    let existingStudentId: string | undefined = undefined;
    let possibleMatches: RosterValidationRow["possibleMatches"] = undefined;
    let isAmbiguous = false;

    if (rawNis) {
      // 1. Exact NIS Match in Active School -> Deterministic Reuse
      const existingByNis = await prisma.student.findUnique({
        where: { schoolId_nis: { schoolId, nis: rawNis } },
      });

      if (existingByNis) {
        existingStudentId = existingByNis.id;
        dbStatus = "VALID";
        dbMessage = `NIS cocok dengan data siswa (${existingByNis.fullName}). Identitas siswa akan digunakan kembali.`;
        dbAction = "REUSE_EXACT";
      }
    } else {
      // 2. Name-only Match in Active School (No silent merge)
      const existingByName = await prisma.student.findMany({
        where: {
          schoolId,
          fullName: { equals: rawNama, mode: "insensitive" },
        },
      });

      if (existingByName.length === 1) {
        // Exactly 1 name match -> POSSIBLE_MATCH (Requires explicit teacher confirmation)
        existingStudentId = existingByName[0].id;
        dbStatus = "WARNING";
        dbMessage = `Ditemukan 1 siswa dengan nama yang sama di sekolah ini (${existingByName[0].fullName}${existingByName[0].nis ? `, NIS: ${existingByName[0].nis}` : ""}). Pilih untuk menggunakan siswa ini atau membuat siswa baru.`;
        dbAction = "POSSIBLE_MATCH";
        possibleMatches = [
          {
            id: existingByName[0].id,
            fullName: existingByName[0].fullName,
            nis: existingByName[0].nis,
          },
        ];
      } else if (existingByName.length > 1) {
        // Multiple name matches -> AMBIGUOUS (Confirmation blocked)
        dbStatus = "ERROR";
        dbMessage = `Ditemukan ${existingByName.length} siswa dengan nama '${rawNama}' di sekolah ini. Harap sertakan NIS untuk menghindari ambiguitas.`;
        dbAction = "AMBIGUOUS";
        isAmbiguous = true;
        possibleMatches = existingByName.map((s) => ({
          id: s.id,
          fullName: s.fullName,
          nis: s.nis,
        }));
      }
    }

    // 3. ClassStudent Conflict Check (Binding Amendment 6)
    if (existingStudentId && dbAction !== "AMBIGUOUS") {
      const existingClassStudent = await prisma.classStudent.findUnique({
        where: {
          studentId_academicPeriodId: {
            studentId: existingStudentId,
            academicPeriodId: context.academicPeriodId,
          },
        },
      });

      if (existingClassStudent) {
        if (existingClassStudent.classId === context.classId) {
          dbStatus = "WARNING";
          dbMessage = "Siswa sudah terdaftar di kelas ini untuk periode akademik aktif.";
          dbAction = "SKIP";
        } else {
          // Belongs to another class in same academic period -> CONFLICT / BLOCKED (Never move classId)
          dbStatus = "ERROR";
          dbMessage = "Siswa sudah terdaftar di kelas lain pada periode akademik aktif ini. Pemindahan kelas siswa antar-kelas tidak didukung melalui importer.";
          dbAction = "SKIP";
        }
      }
    }

    validationRows.push({
      rowNum,
      namaLengkap: rawNama,
      nis: rawNis,
      status: dbStatus,
      message: dbMessage,
      action: dbAction,
      existingStudentId,
      possibleMatches,
      isAmbiguous,
    });
  }

  const valid = validationRows.filter((r) => r.status === "VALID").length;
  const warning = validationRows.filter((r) => r.status === "WARNING").length;
  const error = validationRows.filter((r) => r.status === "ERROR").length;
  const duplicate = validationRows.filter((r) => r.action === "SKIP" && r.status !== "ERROR").length;

  const token = await createImportSessionRecord(
    teacherProfileId,
    schoolId,
    teachingContextId,
    "ROSTER",
    validationRows
  );

  return {
    teachingContextId,
    schoolId,
    category: "ROSTER",
    headers,
    rows: validationRows,
    token,
    summary: { total: validationRows.length, valid, warning, error, duplicate },
  };
}

export async function executeRosterImport(
  schoolId: string,
  teachingContextId: string,
  teacherProfileId: string,
  rows: RosterValidationRow[],
  token: string
): Promise<ImportExecutionResult> {
  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId },
  });
  if (!context || context.schoolId !== schoolId || context.teacherProfileId !== teacherProfileId) {
    throw new Error("Otorisasi konteks mengajar gagal.");
  }

  const validRows = rows.filter((r) => r.action !== "SKIP" && r.status !== "ERROR" && r.action !== "AMBIGUOUS");
  let importedCount = 0;
  let reusedCount = 0;

  await prisma.$transaction(async (tx) => {
    await claimAndVerifyImportSession(
      tx,
      token,
      teacherProfileId,
      schoolId,
      teachingContextId,
      "ROSTER",
      rows
    );

    for (const row of validRows) {
      let studentId: string | undefined = undefined;

      if (row.action === "REUSE_EXACT" && row.existingStudentId) {
        const verifiedStudent = await tx.student.findFirst({
          where: { id: row.existingStudentId, schoolId },
        });
        if (verifiedStudent) {
          studentId = verifiedStudent.id;
          reusedCount++;
        }
      } else if (row.action === "POSSIBLE_MATCH") {
        if (row.userChoice === "USE_EXISTING" && row.existingStudentId) {
          const verifiedStudent = await tx.student.findFirst({
            where: { id: row.existingStudentId, schoolId },
          });
          if (verifiedStudent) {
            studentId = verifiedStudent.id;
            reusedCount++;
          }
        }
      }

      if (!studentId) {
        // Create new student
        const newStudent = await tx.student.create({
          data: {
            schoolId,
            fullName: row.namaLengkap,
            nis: row.nis || null,
            createdByTeacherProfileId: teacherProfileId,
            updatedByTeacherProfileId: teacherProfileId,
          },
        });
        studentId = newStudent.id;
        importedCount++;
      }

      // Check ClassStudent enrollment: strictly prevent moving other-class student
      const existingClassStudent = await tx.classStudent.findUnique({
        where: {
          studentId_academicPeriodId: {
            studentId,
            academicPeriodId: context.academicPeriodId,
          },
        },
      });

      if (existingClassStudent) {
        if (existingClassStudent.classId !== context.classId) {
          throw new Error(`Siswa '${row.namaLengkap}' sudah terdaftar di kelas lain pada periode ini. Pemindahan kelas tidak diizinkan.`);
        }
      } else {
        await tx.classStudent.create({
          data: {
            studentId,
            classId: context.classId,
            academicPeriodId: context.academicPeriodId,
          },
        });
      }
    }
  }, {
    maxWait: 15000,
    timeout: 30000,
  });

  return {
    success: true,
    category: "ROSTER",
    totalRows: rows.length,
    importedCount,
    reusedCount,
    skippedCount: rows.length - (importedCount + reusedCount),
    errorCount: rows.filter((r) => r.status === "ERROR").length,
    message: `Berhasil memproses ${importedCount + reusedCount} siswa ke kelas.`,
  };
}

// ============================================================================
// 4. HISTORICAL TEACHING SESSION IMPORT SERVICE
// ============================================================================

export async function validateHistoricalSessionsImport(
  schoolId: string,
  teachingContextId: string,
  teacherProfileId: string,
  fileBuffer: ArrayBuffer | Buffer,
  mapping: { dateCol: string; topicCol: string; summaryCol?: string }
): Promise<ImportPreviewPayload<HistoricalSessionValidationRow>> {
  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId },
  });
  if (!context || context.schoolId !== schoolId) {
    throw new Error("Konteks mengajar tidak valid untuk sekolah aktif.");
  }

  const { headers, rows } = parseRawWorkbook(fileBuffer);

  const dateIdx = headers.findIndex((h) => h.toLowerCase() === mapping.dateCol.toLowerCase());
  const topicIdx = headers.findIndex((h) => h.toLowerCase() === mapping.topicCol.toLowerCase());
  const summaryIdx = mapping.summaryCol
    ? headers.findIndex((h) => h.toLowerCase() === mapping.summaryCol?.toLowerCase())
    : -1;

  if (dateIdx === -1) {
    throw new Error(`Kolom untuk 'Tanggal Pertemuan' (${mapping.dateCol}) tidak ditemukan.`);
  }
  if (topicIdx === -1) {
    throw new Error(`Kolom untuk 'Materi / Topik' (${mapping.topicCol}) tidak ditemukan.`);
  }

  // Preload existing sessions for this teaching context
  const existingSessions = await prisma.teachingSession.findMany({
    where: { teachingContextId },
    select: { id: true, date: true, actualTopic: true },
  });

  const validationRows: HistoricalSessionValidationRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;

    const rowNum = i + 2;
    const rawDate = row[dateIdx];
    const isoDate = parseDateToIsoDateString(rawDate);
    const rawTopic = sanitizeCellString(row[topicIdx]);
    const rawSummary = summaryIdx !== -1 ? sanitizeCellString(row[summaryIdx]) || null : null;

    if (!isoDate) {
      validationRows.push({
        rowNum,
        date: "",
        actualTopic: rawTopic,
        activitySummary: rawSummary,
        status: "ERROR",
        message: "Format tanggal tidak valid atau kosong.",
        action: "SKIP",
      });
      continue;
    }

    if (!rawTopic) {
      validationRows.push({
        rowNum,
        date: isoDate,
        actualTopic: "",
        activitySummary: rawSummary,
        status: "ERROR",
        message: "Materi / Topik pertemuan wajib diisi.",
        action: "SKIP",
      });
      continue;
    }

    // Check if session already exists
    const match = existingSessions.find(
      (s) =>
        s.date.toISOString().slice(0, 10) === isoDate &&
        s.actualTopic?.trim().toLowerCase() === rawTopic.toLowerCase()
    );

    if (match) {
      validationRows.push({
        rowNum,
        date: isoDate,
        actualTopic: rawTopic,
        activitySummary: rawSummary,
        status: "WARNING",
        message: `Pertemuan dengan tanggal dan materi yang sama sudah ada di kelas ini. Baris dilewati (No Overwrite).`,
        action: "SKIP",
        existingSessionId: match.id,
      });
    } else {
      // Binding rule: historical COMPLETED TeachingSession may only be persisted when the historical
      // source provides sufficient factual participant / attendance evidence (Stage 03 invariant).
      // Journal-only historical row without attendance evidence -> UNSUPPORTED / SKIP / BLOCK
      validationRows.push({
        rowNum,
        date: isoDate,
        actualTopic: rawTopic,
        activitySummary: rawSummary,
        status: "ERROR",
        message: "Sesi pembelajaran lampau (COMPLETED) tidak dapat dibuat tanpa bukti presensi faktual peserta didik (Stage 03 historical invariant). Impor presensi lampau untuk mencatat sesi beserta daftar hadirnya.",
        action: "SKIP",
      });
    }
  }

  const valid = validationRows.filter((r) => r.status === "VALID").length;
  const warning = validationRows.filter((r) => r.status === "WARNING").length;
  const error = validationRows.filter((r) => r.status === "ERROR").length;
  const duplicate = validationRows.filter((r) => r.action === "SKIP" && r.status !== "ERROR").length;

  const token = await createImportSessionRecord(
    teacherProfileId,
    schoolId,
    teachingContextId,
    "HISTORICAL_SESSION",
    validationRows
  );

  return {
    teachingContextId,
    schoolId,
    category: "HISTORICAL_SESSION",
    headers,
    rows: validationRows,
    token,
    summary: { total: validationRows.length, valid, warning, error, duplicate },
  };
}

export async function executeHistoricalSessionsImport(
  schoolId: string,
  teachingContextId: string,
  teacherProfileId: string,
  rows: HistoricalSessionValidationRow[],
  token: string
): Promise<ImportExecutionResult> {
  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId },
  });
  if (!context || context.schoolId !== schoolId || context.teacherProfileId !== teacherProfileId) {
    throw new Error("Otorisasi konteks mengajar gagal.");
  }

  // Standalone journal-only rows without explicit factual attendance participant evidence cannot be persisted as COMPLETED sessions (Stage 03 invariant).
  // Zero TeachingSessions are written.
  await prisma.$transaction(async (tx) => {
    await claimAndVerifyImportSession(
      tx,
      token,
      teacherProfileId,
      schoolId,
      teachingContextId,
      "HISTORICAL_SESSION",
      rows
    );
  }, {
    maxWait: 15000,
    timeout: 30000,
  });

  return {
    success: true,
    category: "HISTORICAL_SESSION",
    totalRows: rows.length,
    importedCount: 0,
    reusedCount: 0,
    skippedCount: rows.length,
    errorCount: rows.filter((r) => r.status === "ERROR").length,
    message:
      "Sesi pembelajaran lampau (COMPLETED) tidak dapat dibuat tanpa bukti presensi faktual peserta didik (Stage 03 invariant). Impor presensi lampau untuk mencatat sesi beserta daftar hadirnya.",
  };
}

// ============================================================================
// 5. HISTORICAL ATTENDANCE IMPORT SERVICE
// ============================================================================

export async function validateHistoricalAttendanceImport(
  schoolId: string,
  teachingContextId: string,
  teacherProfileId: string,
  fileBuffer: ArrayBuffer | Buffer,
  mapping: {
    studentCol: string;
    dateCol: string;
    statusCol: string;
    sessionCol?: string;
    topicCol?: string;
    summaryCol?: string;
  }
): Promise<ImportPreviewPayload<HistoricalAttendanceValidationRow>> {
  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId },
  });
  if (!context || context.schoolId !== schoolId) {
    throw new Error("Konteks mengajar tidak valid untuk sekolah aktif.");
  }

  const { headers, rows } = parseRawWorkbook(fileBuffer);

  const studentIdx = headers.findIndex((h) => h.toLowerCase() === mapping.studentCol.toLowerCase());
  const dateIdx = headers.findIndex((h) => h.toLowerCase() === mapping.dateCol.toLowerCase());
  const statusIdx = headers.findIndex((h) => h.toLowerCase() === mapping.statusCol.toLowerCase());
  const sessionIdx = mapping.sessionCol
    ? headers.findIndex((h) => h.toLowerCase() === mapping.sessionCol?.toLowerCase())
    : -1;
  const topicIdx = mapping.topicCol
    ? headers.findIndex((h) => h.toLowerCase() === mapping.topicCol?.toLowerCase())
    : -1;
  const summaryIdx = mapping.summaryCol
    ? headers.findIndex((h) => h.toLowerCase() === mapping.summaryCol?.toLowerCase())
    : -1;

  if (studentIdx === -1) throw new Error(`Kolom untuk 'Siswa' (${mapping.studentCol}) tidak ditemukan.`);
  if (dateIdx === -1) throw new Error(`Kolom untuk 'Tanggal' (${mapping.dateCol}) tidak ditemukan.`);
  if (statusIdx === -1) throw new Error(`Kolom untuk 'Status Presensi' (${mapping.statusCol}) tidak ditemukan.`);

  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { id: true, fullName: true, nis: true },
  });

  const sessions = await prisma.teachingSession.findMany({
    where: { teachingContextId },
    select: { id: true, date: true, actualTopic: true, startedAt: true },
    orderBy: { date: "asc" },
  });

  const existingAttendance = await prisma.attendanceRecord.findMany({
    where: { teachingSession: { teachingContextId } },
    select: { teachingSessionId: true, studentId: true },
  });
  const existingAttendanceSet = new Set(
    existingAttendance.map((a) => `${a.teachingSessionId}_${a.studentId}`)
  );

  const validationRows: HistoricalAttendanceValidationRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;

    const rowNum = i + 2;
    const rawStudent = sanitizeCellString(row[studentIdx]);
    const rawDate = row[dateIdx];
    const isoDate = parseDateToIsoDateString(rawDate);
    const rawStatus = sanitizeCellString(row[statusIdx]);
    const rawSessionId = sessionIdx !== -1 ? sanitizeCellString(row[sessionIdx]) || null : null;
    const rawTopic = topicIdx !== -1 ? sanitizeCellString(row[topicIdx]) || null : null;
    const rawSummary = summaryIdx !== -1 ? sanitizeCellString(row[summaryIdx]) || null : null;
    const normalizedStatus = normalizeAttendanceStatus(rawStatus);

    if (!rawStudent) {
      validationRows.push({
        rowNum,
        studentIdentifier: "",
        sessionDate: isoDate || "",
        actualTopic: rawTopic,
        activitySummary: rawSummary,
        rawStatusString: rawStatus,
        attendanceStatus: null,
        status: "ERROR",
        message: "Identitas siswa (Nama atau NIS) wajib diisi.",
        action: "SKIP",
      });
      continue;
    }

    if (!isoDate) {
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        sessionDate: "",
        actualTopic: rawTopic,
        activitySummary: rawSummary,
        rawStatusString: rawStatus,
        attendanceStatus: null,
        status: "ERROR",
        message: "Format tanggal tidak valid atau kosong.",
        action: "SKIP",
      });
      continue;
    }

    if (!normalizedStatus) {
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        sessionDate: isoDate,
        actualTopic: rawTopic,
        activitySummary: rawSummary,
        rawStatusString: rawStatus,
        attendanceStatus: null,
        status: "ERROR",
        message: `Status kehadiran '${rawStatus}' tidak dikenali. Gunakan Hadir, Sakit, Izin, Terlambat, atau Alpa.`,
        action: "SKIP",
      });
      continue;
    }

    // Match student: NIS first, then Name
    let matchedStudent = students.find((s) => s.nis && s.nis.toLowerCase() === rawStudent.toLowerCase());
    if (!matchedStudent) {
      const matchedByName = students.filter(
        (s) => s.fullName.trim().toLowerCase() === rawStudent.toLowerCase()
      );
      if (matchedByName.length === 1) {
        matchedStudent = matchedByName[0];
      } else if (matchedByName.length > 1) {
        validationRows.push({
          rowNum,
          studentIdentifier: rawStudent,
          sessionDate: isoDate,
          actualTopic: rawTopic,
          activitySummary: rawSummary,
          rawStatusString: rawStatus,
          attendanceStatus: normalizedStatus,
          status: "ERROR",
          message: `Ditemukan lebih dari satu siswa dengan nama '${rawStudent}'. Harap gunakan NIS.`,
          action: "SKIP",
        });
        continue;
      }
    }

    if (!matchedStudent) {
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        sessionDate: isoDate,
        actualTopic: rawTopic,
        activitySummary: rawSummary,
        rawStatusString: rawStatus,
        attendanceStatus: normalizedStatus,
        status: "ERROR",
        message: `Siswa '${rawStudent}' tidak ditemukan di database sekolah. Harap impor daftar siswa terlebih dahulu.`,
        action: "SKIP",
      });
      continue;
    }

    // Match session by date
    const sameDateSessions = sessions.filter((s) => s.date.toISOString().slice(0, 10) === isoDate);

    let matchedSessionId: string | undefined = undefined;
    let isSessionAmbiguous = false;
    let availableSessions: AvailableSessionInfo[] = [];

    if (rawSessionId) {
      const explicitSession = sameDateSessions.find((s) => s.id === rawSessionId);
      if (explicitSession) {
        matchedSessionId = explicitSession.id;
      }
    }

    if (!matchedSessionId) {
      if (sameDateSessions.length === 1) {
        matchedSessionId = sameDateSessions[0].id;
      } else if (sameDateSessions.length > 1) {
        isSessionAmbiguous = true;
        availableSessions = sameDateSessions.map((s) => ({
          id: s.id,
          date: s.date.toISOString().slice(0, 10),
          actualTopic: s.actualTopic,
          startedAt: s.startedAt ? s.startedAt.toISOString() : null,
        }));
      }
    }

    if (isSessionAmbiguous) {
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        sessionDate: isoDate,
        actualTopic: rawTopic,
        activitySummary: rawSummary,
        sessionIdentifier: rawSessionId,
        rawStatusString: rawStatus,
        attendanceStatus: normalizedStatus,
        status: "WARNING",
        message: `Terdapat ${sameDateSessions.length} pertemuan pada tanggal ${isoDate}. Harap pilih sesi pertemuan secara spesifik.`,
        action: "SKIP",
        matchedStudentId: matchedStudent.id,
        matchedStudentName: matchedStudent.fullName,
        isSessionAmbiguous: true,
        availableSessions,
      });
      continue;
    }

    // Check duplicate attendance record (Requirement 7: Existing Attendance Protection / No Overwrite)
    if (matchedSessionId) {
      const key = `${matchedSessionId}_${matchedStudent.id}`;
      if (existingAttendanceSet.has(key)) {
        validationRows.push({
          rowNum,
          studentIdentifier: rawStudent,
          sessionDate: isoDate,
          actualTopic: rawTopic,
          activitySummary: rawSummary,
          sessionIdentifier: matchedSessionId,
          rawStatusString: rawStatus,
          attendanceStatus: normalizedStatus,
          status: "WARNING",
          message: `Presensi siswa ini pada pertemuan terkait sudah ada di sistem. Baris dilewati (No Overwrite).`,
          action: "SKIP",
          matchedStudentId: matchedStudent.id,
          matchedStudentName: matchedStudent.fullName,
          matchedSessionId,
        });
        continue;
      }
    }

    // If no existing session matches on this date, creating a new session requires factual actualTopic
    if (!matchedSessionId && !rawTopic) {
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        sessionDate: isoDate,
        actualTopic: null,
        activitySummary: rawSummary,
        sessionIdentifier: null,
        rawStatusString: rawStatus,
        attendanceStatus: normalizedStatus,
        status: "ERROR",
        message: "Topik materi pertemuan faktual (actualTopic) wajib disediakan untuk membuat sesi lampau baru. Topik sintesis tidak diizinkan.",
        action: "SKIP",
        matchedStudentId: matchedStudent.id,
        matchedStudentName: matchedStudent.fullName,
      });
      continue;
    }

    validationRows.push({
      rowNum,
      studentIdentifier: rawStudent,
      sessionDate: isoDate,
      actualTopic: rawTopic,
      activitySummary: rawSummary,
      sessionIdentifier: matchedSessionId,
      rawStatusString: rawStatus,
      attendanceStatus: normalizedStatus,
      status: "VALID",
      message: matchedSessionId
        ? "Siap diimpor ke pertemuan yang cocok."
        : `Sesi lampau baru dengan topik '${rawTopic}' dan presensi ini akan dibuat saat konfirmasi.`,
      action: "CREATE",
      matchedStudentId: matchedStudent.id,
      matchedStudentName: matchedStudent.fullName,
      matchedSessionId,
    });
  }

  const valid = validationRows.filter((r) => r.status === "VALID").length;
  const warning = validationRows.filter((r) => r.status === "WARNING").length;
  const error = validationRows.filter((r) => r.status === "ERROR").length;
  const duplicate = validationRows.filter((r) => r.action === "SKIP" && r.status !== "ERROR").length;

  const token = await createImportSessionRecord(
    teacherProfileId,
    schoolId,
    teachingContextId,
    "HISTORICAL_ATTENDANCE",
    validationRows
  );

  return {
    teachingContextId,
    schoolId,
    category: "HISTORICAL_ATTENDANCE",
    headers,
    rows: validationRows,
    token,
    summary: { total: validationRows.length, valid, warning, error, duplicate },
  };
}

export async function executeHistoricalAttendanceImport(
  schoolId: string,
  teachingContextId: string,
  teacherProfileId: string,
  rows: HistoricalAttendanceValidationRow[],
  token: string
): Promise<ImportExecutionResult> {
  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId },
  });
  if (!context || context.schoolId !== schoolId || context.teacherProfileId !== teacherProfileId) {
    throw new Error("Otorisasi konteks mengajar gagal.");
  }

  const validRows = rows.filter((r) => r.action === "CREATE" && r.status !== "ERROR");
  let importedCount = 0;

  await prisma.$transaction(async (tx) => {
    await claimAndVerifyImportSession(
      tx,
      token,
      teacherProfileId,
      schoolId,
      teachingContextId,
      "HISTORICAL_ATTENDANCE",
      rows
    );

    // One shared import timestamp for this import operation representing when this snapshot was persisted
    const importTimestamp = new Date();
    const sessionMap = new Map<string, string>(); // dateStr -> sessionId

    for (const row of validRows) {
      if (!row.matchedStudentId || !row.attendanceStatus) continue;

      const verifiedStudent = await tx.student.findFirst({
        where: { id: row.matchedStudentId, schoolId },
      });
      if (!verifiedStudent) continue;

      let sessionId = row.matchedSessionId;

      if (sessionId) {
        const verifiedSession = await tx.teachingSession.findFirst({
          where: { id: sessionId, teachingContextId: context.id },
        });
        if (!verifiedSession) {
          sessionId = undefined;
        }
      }

      if (!sessionId) {
        if (sessionMap.has(row.sessionDate)) {
          sessionId = sessionMap.get(row.sessionDate);
        } else {
          let session = await tx.teachingSession.findFirst({
            where: {
              teachingContextId: context.id,
              date: new Date(row.sessionDate),
            },
          });

          if (!session) {
            // Require factual actualTopic (no manufactured / synthetic topic allowed)
            const factualTopic = validRows.find((r) => r.sessionDate === row.sessionDate && r.actualTopic)?.actualTopic || row.actualTopic;
            if (!factualTopic) {
              throw new Error(`Topik materi faktual wajib disediakan untuk membuat sesi pembelajaran lampau pada tanggal ${row.sessionDate}.`);
            }

            const factualSummary = validRows.find((r) => r.sessionDate === row.sessionDate && r.activitySummary)?.activitySummary || row.activitySummary || null;

            session = await tx.teachingSession.create({
              data: {
                teachingContextId: context.id,
                date: new Date(row.sessionDate),
                startedAt: null,
                endedAt: null,
                plannedTopic: null,
                actualTopic: factualTopic,
                activitySummary: factualSummary,
                reflection: null,
                status: "COMPLETED",
                attendanceRecordedAt: importTimestamp,
              },
            });
          }
          sessionId = session.id;
          sessionMap.set(row.sessionDate, session.id);
        }
      }

      if (!sessionId) continue;

      // Existing check: NEVER overwrite existing attendance record
      const existing = await tx.attendanceRecord.findUnique({
        where: {
          teachingSessionId_studentId: {
            teachingSessionId: sessionId,
            studentId: row.matchedStudentId,
          },
        },
      });

      if (!existing) {
        await tx.attendanceRecord.create({
          data: {
            teachingSessionId: sessionId,
            studentId: row.matchedStudentId,
            status: row.attendanceStatus,
          },
        });
        importedCount++;
      }
    }
  }, {
    maxWait: 15000,
    timeout: 30000,
  });

  return {
    success: true,
    category: "HISTORICAL_ATTENDANCE",
    totalRows: rows.length,
    importedCount,
    reusedCount: 0,
    skippedCount: rows.length - importedCount,
    errorCount: rows.filter((r) => r.status === "ERROR").length,
    message: `Berhasil mengimpor ${importedCount} catatan presensi lampau.`,
  };
}

// ============================================================================
// 6. HISTORICAL ASSESSMENT & SCORE IMPORT SERVICE
// ============================================================================

export async function validateHistoricalAssessmentsImport(
  schoolId: string,
  teachingContextId: string,
  teacherProfileId: string,
  fileBuffer: ArrayBuffer | Buffer,
  mapping: {
    studentCol: string;
    titleCol: string;
    dateCol: string;
    scoreCol?: string;
    typeCol?: string;
    maxScoreCol?: string;
    statusCol?: string;
  }
): Promise<ImportPreviewPayload<HistoricalAssessmentValidationRow>> {
  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId },
  });
  if (!context || context.schoolId !== schoolId) {
    throw new Error("Konteks mengajar tidak valid untuk sekolah aktif.");
  }

  const { headers, rows } = parseRawWorkbook(fileBuffer);

  const studentIdx = headers.findIndex((h) => h.toLowerCase() === mapping.studentCol.toLowerCase());
  const titleIdx = headers.findIndex((h) => h.toLowerCase() === mapping.titleCol.toLowerCase());
  const dateIdx = headers.findIndex((h) => h.toLowerCase() === mapping.dateCol.toLowerCase());
  const scoreIdx = mapping.scoreCol
    ? headers.findIndex((h) => h.toLowerCase() === mapping.scoreCol?.toLowerCase())
    : -1;
  const typeIdx = mapping.typeCol
    ? headers.findIndex((h) => h.toLowerCase() === mapping.typeCol?.toLowerCase())
    : -1;
  const maxScoreIdx = mapping.maxScoreCol
    ? headers.findIndex((h) => h.toLowerCase() === mapping.maxScoreCol?.toLowerCase())
    : -1;
  const statusIdx = mapping.statusCol
    ? headers.findIndex((h) => h.toLowerCase() === mapping.statusCol?.toLowerCase())
    : -1;

  if (studentIdx === -1) throw new Error(`Kolom untuk 'Siswa' (${mapping.studentCol}) tidak ditemukan.`);
  if (titleIdx === -1) throw new Error(`Kolom untuk 'Judul Penilaian' (${mapping.titleCol}) tidak ditemukan.`);
  if (dateIdx === -1) throw new Error(`Kolom untuk 'Tanggal' (${mapping.dateCol}) tidak ditemukan.`);

  const students = await prisma.student.findMany({
    where: { schoolId },
    select: { id: true, fullName: true, nis: true },
  });

  const assessmentTypes = await prisma.assessmentType.findMany({
    where: { teachingContextId, isActive: true },
  });

  const existingAssessments = await prisma.assessment.findMany({
    where: { teachingContextId },
    include: {
      results: { select: { studentId: true } },
    },
  });

  const validationRows: HistoricalAssessmentValidationRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || row.every((c) => !c)) continue;

    const rowNum = i + 2;
    const rawStudent = sanitizeCellString(row[studentIdx]);
    const rawTitle = sanitizeCellString(row[titleIdx]);
    const rawDate = row[dateIdx];
    const isoDate = parseDateToIsoDateString(rawDate);
    const rawTypeName = typeIdx !== -1 ? sanitizeCellString(row[typeIdx]) || "Tugas" : "Tugas";
    const rawMaxScoreStr = maxScoreIdx !== -1 ? sanitizeCellString(row[maxScoreIdx]) : "100";
    const rawScoreStr = scoreIdx !== -1 ? sanitizeCellString(row[scoreIdx]) : "";
    const rawStatusStr = statusIdx !== -1 ? sanitizeCellString(row[statusIdx]).toUpperCase() : "";

    if (!rawStudent) {
      validationRows.push({
        rowNum,
        studentIdentifier: "",
        assessmentTitle: rawTitle,
        assessmentDate: isoDate || "",
        assessmentTypeName: rawTypeName,
        maxScore: 100,
        resultStatus: null,
        rawScore: null,
        normalizedScore: null,
        finalScore: null,
        status: "ERROR",
        message: "Identitas siswa wajib diisi.",
        action: "SKIP",
      });
      continue;
    }

    if (!rawTitle) {
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        assessmentTitle: "",
        assessmentDate: isoDate || "",
        assessmentTypeName: rawTypeName,
        maxScore: 100,
        resultStatus: null,
        rawScore: null,
        normalizedScore: null,
        finalScore: null,
        status: "ERROR",
        message: "Judul penilaian wajib diisi.",
        action: "SKIP",
      });
      continue;
    }

    if (!isoDate) {
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        assessmentTitle: rawTitle,
        assessmentDate: "",
        assessmentTypeName: rawTypeName,
        maxScore: 100,
        resultStatus: null,
        rawScore: null,
        normalizedScore: null,
        finalScore: null,
        status: "ERROR",
        message: "Format tanggal tidak valid atau kosong.",
        action: "SKIP",
      });
      continue;
    }

    // Match student
    let matchedStudent = students.find((s) => s.nis && s.nis.toLowerCase() === rawStudent.toLowerCase());
    if (!matchedStudent) {
      const matchedByName = students.filter(
        (s) => s.fullName.trim().toLowerCase() === rawStudent.toLowerCase()
      );
      if (matchedByName.length === 1) {
        matchedStudent = matchedByName[0];
      } else if (matchedByName.length > 1) {
        validationRows.push({
          rowNum,
          studentIdentifier: rawStudent,
          assessmentTitle: rawTitle,
          assessmentDate: isoDate,
          assessmentTypeName: rawTypeName,
          maxScore: 100,
          resultStatus: null,
          rawScore: null,
          normalizedScore: null,
          finalScore: null,
          status: "ERROR",
          message: `Ditemukan lebih dari satu siswa bernama '${rawStudent}'. Harap gunakan NIS.`,
          action: "SKIP",
        });
        continue;
      }
    }

    if (!matchedStudent) {
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        assessmentTitle: rawTitle,
        assessmentDate: isoDate,
        assessmentTypeName: rawTypeName,
        maxScore: 100,
        resultStatus: null,
        rawScore: null,
        normalizedScore: null,
        finalScore: null,
        status: "ERROR",
        message: `Siswa '${rawStudent}' tidak ditemukan di database sekolah.`,
        action: "SKIP",
      });
      continue;
    }

    const parsedMax = parseFloat(rawMaxScoreStr);
    const maxScore = isNaN(parsedMax) || parsedMax <= 0 ? 100 : parsedMax;

    // Requirement 2: Match AssessmentType strictly within this teaching context
    const matchedType = assessmentTypes.find(
      (t) => t.name.toLowerCase() === rawTypeName.toLowerCase() || t.normalizedName === normalizeName(rawTypeName)
    );

    // Requirement 4: Score & Status Determination
    // Explicit rawScore = 0 -> GRADED with zero
    // Explicit ABSENT state -> ABSENT + numeric fields null
    // Explicit EXCUSED state -> EXCUSED + numeric fields null
    // Blank rawScore without explicit supported result state -> ERROR / unresolved
    let resultStatus: "GRADED" | "ABSENT" | "EXCUSED" | null = null;
    let rawScore: number | null = null;
    let normalizedScore: number | null = null;

    if (rawStatusStr === "ABSENT" || rawStatusStr === "ALPA" || rawStatusStr === "TIDAK HADIR") {
      resultStatus = "ABSENT";
    } else if (rawStatusStr === "EXCUSED" || rawStatusStr === "IZIN" || rawStatusStr === "SAKIT") {
      resultStatus = "EXCUSED";
    } else if (rawScoreStr !== "") {
      const parsedRaw = parseFloat(rawScoreStr);
      if (isNaN(parsedRaw) || parsedRaw < 0 || parsedRaw > maxScore) {
        validationRows.push({
          rowNum,
          studentIdentifier: rawStudent,
          assessmentTitle: rawTitle,
          assessmentDate: isoDate,
          assessmentTypeName: rawTypeName,
          maxScore,
          resultStatus: null,
          rawScore: isNaN(parsedRaw) ? null : parsedRaw,
          normalizedScore: null,
          finalScore: null,
          status: "ERROR",
          message: `Skor (${rawScoreStr}) harus berupa angka antara 0 dan skor maksimum (${maxScore}).`,
          action: "SKIP",
          matchedStudentId: matchedStudent.id,
          matchedStudentName: matchedStudent.fullName,
        });
        continue;
      }
      resultStatus = "GRADED";
      rawScore = parsedRaw;
      const decNorm = calculateNormalizedScore(parsedRaw, maxScore);
      normalizedScore = decNorm.toNumber();
    } else {
      // Blank score without explicit status string is an ERROR (Missing information is never converted to fact)
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        assessmentTitle: rawTitle,
        assessmentDate: isoDate,
        assessmentTypeName: rawTypeName,
        maxScore,
        resultStatus: null,
        rawScore: null,
        normalizedScore: null,
        finalScore: null,
        status: "ERROR",
        message: "Skor kosong tanpa status ketidakhadiran (Alpa/Izin/Sakit). Nilai kosong tidak otomatis dianggap sebagai 0 atau Alpa.",
        action: "SKIP",
        matchedStudentId: matchedStudent.id,
        matchedStudentName: matchedStudent.fullName,
      });
      continue;
    }

    // Check existing assessment result (Requirement 7: Existing AssessmentResult Protection / No Overwrite)
    const existingAssessment = existingAssessments.find(
      (a) =>
        a.title.trim().toLowerCase() === rawTitle.toLowerCase() &&
        a.assessmentDate.toISOString().slice(0, 10) === isoDate
    );
    const hasExistingResult = existingAssessment?.results.some((r) => r.studentId === matchedStudent.id);

    if (hasExistingResult) {
      validationRows.push({
        rowNum,
        studentIdentifier: rawStudent,
        assessmentTitle: rawTitle,
        assessmentDate: isoDate,
        assessmentTypeName: rawTypeName,
        confirmedCategory: matchedType ? matchedType.category : undefined,
        maxScore,
        resultStatus,
        rawScore,
        normalizedScore,
        finalScore: normalizedScore,
        status: "WARNING",
        message: "Nilai siswa untuk penilaian ini sudah ada di sistem. Baris dilewati (No Overwrite).",
        action: "SKIP",
        matchedStudentId: matchedStudent.id,
        matchedStudentName: matchedStudent.fullName,
        matchedAssessmentTypeId: matchedType ? matchedType.id : undefined,
      });
      continue;
    }

    validationRows.push({
      rowNum,
      studentIdentifier: rawStudent,
      assessmentTitle: rawTitle,
      assessmentDate: isoDate,
      assessmentTypeName: rawTypeName,
      confirmedCategory: matchedType ? matchedType.category : undefined,
      maxScore,
      resultStatus,
      rawScore,
      normalizedScore,
      finalScore: normalizedScore,
      status: matchedType ? "VALID" : "WARNING",
      message: matchedType
        ? `Siap diimpor dengan jenis penilaian '${matchedType.name}'.`
        : `Jenis penilaian baru '${rawTypeName}'. Kategori penilaian wajib dikonfirmasi secara eksplisit oleh guru.`,
      action: "CREATE",
      matchedStudentId: matchedStudent.id,
      matchedStudentName: matchedStudent.fullName,
      matchedAssessmentTypeId: matchedType ? matchedType.id : undefined,
    });
  }

  const valid = validationRows.filter((r) => r.status === "VALID").length;
  const warning = validationRows.filter((r) => r.status === "WARNING").length;
  const error = validationRows.filter((r) => r.status === "ERROR").length;
  const duplicate = validationRows.filter((r) => r.action === "SKIP" && r.status !== "ERROR").length;

  const token = await createImportSessionRecord(
    teacherProfileId,
    schoolId,
    teachingContextId,
    "HISTORICAL_ASSESSMENT",
    validationRows
  );

  return {
    teachingContextId,
    schoolId,
    category: "HISTORICAL_ASSESSMENT",
    headers,
    rows: validationRows,
    token,
    summary: { total: validationRows.length, valid, warning, error, duplicate },
  };
}

export async function executeHistoricalAssessmentsImport(
  schoolId: string,
  teachingContextId: string,
  teacherProfileId: string,
  rows: HistoricalAssessmentValidationRow[],
  token: string
): Promise<ImportExecutionResult> {
  const context = await prisma.teachingContext.findUnique({
    where: { id: teachingContextId },
  });
  if (!context || context.schoolId !== schoolId || context.teacherProfileId !== teacherProfileId) {
    throw new Error("Otorisasi konteks mengajar gagal.");
  }

  const validRows = rows.filter((r) => r.action === "CREATE" && r.status !== "ERROR");
  let importedCount = 0;

  await prisma.$transaction(async (tx) => {
    await claimAndVerifyImportSession(
      tx,
      token,
      teacherProfileId,
      schoolId,
      teachingContextId,
      "HISTORICAL_ASSESSMENT",
      rows
    );

    const assessmentGroups = new Map<
      string,
      {
        title: string;
        date: string;
        typeName: string;
        category: AssessmentCategory;
        maxScore: number;
        entries: HistoricalAssessmentValidationRow[];
      }
    >();

    const validCategories = Object.values(AssessmentCategory);

    for (const row of validRows) {
      let confirmedCategory = row.confirmedCategory;

      if (!row.matchedAssessmentTypeId && (!confirmedCategory || !validCategories.includes(confirmedCategory))) {
        throw new Error(
          `Kategori penilaian untuk jenis penilaian baru '${row.assessmentTypeName}' wajib dikonfirmasi secara eksplisit oleh guru. Auto-provisioning / guessing tidak diizinkan.`
        );
      }

      if (!confirmedCategory) {
        confirmedCategory = "OTHER";
      }

      const key = `${row.assessmentTitle}_${row.assessmentDate}_${row.assessmentTypeName}_${row.maxScore}`;
      if (!assessmentGroups.has(key)) {
        assessmentGroups.set(key, {
          title: row.assessmentTitle,
          date: row.assessmentDate,
          typeName: row.assessmentTypeName,
          category: confirmedCategory,
          maxScore: row.maxScore,
          entries: [],
        });
      }
      assessmentGroups.get(key)!.entries.push(row);
    }

    for (const group of assessmentGroups.values()) {
      const normalizedTypeName = normalizeName(group.typeName);

      // Find or create AssessmentType strictly with teacher's confirmed category
      let assessmentType = await tx.assessmentType.findUnique({
        where: {
          teachingContextId_normalizedName: {
            teachingContextId: context.id,
            normalizedName: normalizedTypeName,
          },
        },
      });

      if (!assessmentType) {
        assessmentType = await tx.assessmentType.create({
          data: {
            teachingContextId: context.id,
            name: group.typeName,
            normalizedName: normalizedTypeName,
            category: group.category,
            isActive: true,
          },
        });
      } else if (!assessmentType.isActive) {
        assessmentType = await tx.assessmentType.update({
          where: { id: assessmentType.id },
          data: { isActive: true },
        });
      }

      // Find or create Assessment in COMPLETED state
      const assessmentDateObj = new Date(group.date);
      let assessment = await tx.assessment.findFirst({
        where: {
          teachingContextId: context.id,
          assessmentTypeId: assessmentType.id,
          title: group.title,
          assessmentDate: assessmentDateObj,
        },
      });

      if (!assessment) {
        assessment = await tx.assessment.create({
          data: {
            teachingContextId: context.id,
            assessmentTypeId: assessmentType.id,
            title: group.title,
            assessmentDate: assessmentDateObj,
            maxScore: new Prisma.Decimal(group.maxScore),
            status: "COMPLETED",
            participantsInitializedAt: new Date(),
          },
        });
      }

      // Requirement 7: Existing AssessmentResult Protection (No Overwrite)
      for (const entry of group.entries) {
        if (!entry.matchedStudentId || !entry.resultStatus) continue;

        const verifiedStudent = await tx.student.findFirst({
          where: { id: entry.matchedStudentId, schoolId },
        });
        if (!verifiedStudent) continue;

        let rawScoreDecimal: Prisma.Decimal | null = null;
        let normalizedScoreDecimal: Prisma.Decimal | null = null;

        if (entry.resultStatus === "GRADED" && entry.rawScore !== null) {
          rawScoreDecimal = new Prisma.Decimal(entry.rawScore);
          normalizedScoreDecimal = calculateNormalizedScore(entry.rawScore, group.maxScore);
        }

        const existingResult = await tx.assessmentResult.findUnique({
          where: {
            assessmentId_studentId: {
              assessmentId: assessment.id,
              studentId: entry.matchedStudentId,
            },
          },
        });

        if (!existingResult) {
          await tx.assessmentResult.create({
            data: {
              assessmentId: assessment.id,
              studentId: entry.matchedStudentId,
              status: entry.resultStatus,
              rawScore: rawScoreDecimal,
              normalizedScore: normalizedScoreDecimal,
              finalScore: normalizedScoreDecimal,
            },
          });
          importedCount++;
        }
      }
    }
  }, {
    maxWait: 15000,
    timeout: 30000,
  });

  return {
    success: true,
    category: "HISTORICAL_ASSESSMENT",
    totalRows: rows.length,
    importedCount,
    reusedCount: 0,
    skippedCount: rows.length - importedCount,
    errorCount: rows.filter((r) => r.status === "ERROR").length,
    message: `Berhasil mengimpor ${importedCount} nilai penilaian lampau ke kelas.`,
  };
}
