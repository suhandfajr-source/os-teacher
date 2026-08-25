"use server";

import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership, verifyTeachingContextAccess } from "@/lib/authorization";
import { read, utils } from "xlsx";

export type ImportRow = {
  namaLengkap: string;
  nis: string | null;
  __rowNum__: number;
};

export type ValidationResult = {
  rowNum: number;
  namaLengkap: string;
  nis: string | null;
  status: "VALID" | "ERROR" | "WARNING";
  message: string;
  action: "CREATE" | "REUSE_EXACT" | "REUSE_NAME" | "ENROLL_ONLY" | "SKIP";
  existingStudentId?: string;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_ROW_COUNT = 500;
const MAX_COLUMN_COUNT = 50;

export async function validateImportFile(
  teachingContextId: string,
  formData: FormData,
  mapping: { namaCol: string; nisCol: string }
) {
  const { activeSchoolId } = await verifyActiveSchoolMembership();
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file uploaded");

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds maximum limit (${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB).`);
  }

  const workbook = read(buffer, { type: "buffer", cellDates: true, cellFormula: false });

  if (!workbook.SheetNames.length) throw new Error("Excel file is empty");

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawData = utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

  if (rawData.length < 2) throw new Error("Excel file has no data rows");
  if (rawData.length > MAX_ROW_COUNT + 1) {
    throw new Error(`Row count exceeds maximum limit (${MAX_ROW_COUNT} rows).`);
  }

  const headers = rawData[0].map((h) => String(h).trim().toLowerCase());
  if (headers.length > MAX_COLUMN_COUNT) {
    throw new Error(`Column count exceeds maximum limit (${MAX_COLUMN_COUNT} columns).`);
  }

  const namaIdx = headers.findIndex((h) => h === mapping.namaCol.toLowerCase());
  const nisIdx = mapping.nisCol ? headers.findIndex((h) => h === mapping.nisCol.toLowerCase()) : -1;

  if (namaIdx === -1) {
    throw new Error(`Column mapped to 'Nama Lengkap' (${mapping.namaCol}) not found in the file.`);
  }

  const results: ValidationResult[] = [];
  const seenNisInFile = new Set<string>();

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (row.length === 0 || row.every((cell) => !cell)) continue;

    const rowNum = i + 1;
    const rawNama = row[namaIdx]?.toString().trim();
    const rawNis = nisIdx !== -1 && row[nisIdx] ? row[nisIdx].toString().trim() : null;

    if (!rawNama) {
      results.push({
        rowNum,
        namaLengkap: "",
        nis: rawNis,
        status: "ERROR",
        message: "Nama Lengkap is required.",
        action: "SKIP",
      });
      continue;
    }

    if (rawNis) {
      if (seenNisInFile.has(rawNis)) {
        results.push({
          rowNum,
          namaLengkap: rawNama,
          nis: rawNis,
          status: "ERROR",
          message: `Duplicate NIS (${rawNis}) found inside the uploaded file.`,
          action: "SKIP",
        });
        continue;
      }
      seenNisInFile.add(rawNis);
    }

    // Database validations strictly scoped to activeSchoolId
    let dbStatus: "VALID" | "ERROR" | "WARNING" = "VALID";
    let dbMessage = "Ready to import.";
    let dbAction: ValidationResult["action"] = "CREATE";
    let existingStudentId: string | undefined = undefined;

    if (rawNis) {
      const existingDb = await prisma.student.findUnique({
        where: { schoolId_nis: { schoolId: activeSchoolId, nis: rawNis } },
      });

      if (existingDb) {
        existingStudentId = existingDb.id;
        if (existingDb.fullName.toLowerCase() !== rawNama.toLowerCase()) {
          dbStatus = "WARNING";
          dbMessage = `NIS exists in database but name differs (${existingDb.fullName}). Will reuse existing student identity.`;
          dbAction = "REUSE_EXACT";
        } else {
          dbStatus = "VALID";
          dbMessage = "Student found by NIS. Will add to class.";
          dbAction = "REUSE_EXACT";
        }
      }
    } else {
      // Name-only match in active school
      const existingByName = await prisma.student.findFirst({
        where: {
          schoolId: activeSchoolId,
          fullName: { equals: rawNama, mode: "insensitive" },
        },
      });

      if (existingByName) {
        existingStudentId = existingByName.id;
        dbStatus = "WARNING";
        dbMessage = `Student matched by Name only (No NIS provided). Will reuse existing student identity.`;
        dbAction = "REUSE_NAME";
      }
    }

    // Check if already in class
    if (existingStudentId) {
      const alreadyInClass = await prisma.classStudent.findUnique({
        where: {
          studentId_academicPeriodId: {
            studentId: existingStudentId,
            academicPeriodId: context.academicPeriodId,
          },
        },
      });

      if (alreadyInClass) {
        if (alreadyInClass.classId === context.classId) {
          dbStatus = "WARNING";
          dbMessage = "Student is already enrolled in this class.";
          dbAction = "SKIP";
        } else {
          dbStatus = "ERROR";
          dbMessage = "Student is enrolled in another class for this Academic Period. Importer cannot automatically move students across classes.";
          dbAction = "SKIP";
        }
      }
    }

    results.push({
      rowNum,
      namaLengkap: rawNama,
      nis: rawNis,
      status: dbStatus,
      message: dbMessage,
      action: dbAction,
      existingStudentId,
    });
  }

  return { success: true, headers, results };
}

export async function confirmImport(teachingContextId: string, results: ValidationResult[]) {
  const { activeSchoolId, profile } = await verifyActiveSchoolMembership();
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  // Filter valid actionable rows
  const validRows = results.filter((r) => r.action !== "SKIP" && r.status !== "ERROR");
  let importedCount = 0;

  // Execute in transaction with strict active school and class validation
  await prisma.$transaction(async (tx) => {
    for (const row of validRows) {
      let studentId = row.existingStudentId;

      if (studentId) {
        // SECURITY HARDENING: Re-verify student belongs to activeSchoolId
        const verifiedStudent = await tx.student.findFirst({
          where: { id: studentId, schoolId: activeSchoolId },
        });
        if (!verifiedStudent) {
          throw new Error(`Siswa dengan ID ${studentId} tidak ditemukan di sekolah aktif.`);
        }
      }

      if (!studentId) {
        // Create new student in active school
        const newStudent = await tx.student.create({
          data: {
            schoolId: activeSchoolId,
            fullName: row.namaLengkap,
            nis: row.nis || null,
            createdByTeacherProfileId: profile.id,
            updatedByTeacherProfileId: profile.id,
          },
        });
        studentId = newStudent.id;
      }

      // Check ClassStudent for this academic period
      const existingClassStudent = await tx.classStudent.findUnique({
        where: {
          studentId_academicPeriodId: {
            studentId: studentId,
            academicPeriodId: context.academicPeriodId,
          },
        },
      });

      if (existingClassStudent) {
        if (existingClassStudent.classId !== context.classId) {
          throw new Error(
            `Siswa '${row.namaLengkap}' sudah terdaftar di kelas lain pada periode akademik ini. Importer tidak diizinkan memindahkan kelas.`
          );
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

      importedCount++;
    }
  });

  return { success: true, importedCount };
}
