"use server";

import { prisma } from "@/lib/auth";
import { validatePinFormat, hashPin, verifyPin } from "@/lib/student-pin";
import { setStudentSessionCookie, clearStudentSessionCookie } from "./student-session";

/**
 * Dummy Hash untuk perlindungan Timing Attack (B3 & F5).
 * Memiliki parameter scrypt valid (N=16384, r=8, p=1).
 * Dijamin berjalan asinkron ~50ms agar timing seragam saat NIS tidak ditemukan.
 */
export const DUMMY_HASH =
  "scrypt:16384:8:1:0123456789abcdef0123456789abcdef:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const SAFE_STUDENT_SELECT = {
  id: true,
  schoolId: true,
  fullName: true,
  nis: true,
  status: true,
  accountStatus: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Mencari data kartu konteks rombel berdasarkan kode join 6 karakter.
 */
export async function lookupJoinCode(code: string) {
  if (!code || typeof code !== "string" || code.trim().length < 6) {
    return { success: false, message: "Kode rombel minimal 6 karakter." };
  }

  const cleanCode = code.trim().toUpperCase();

  const classRecord = await prisma.class.findUnique({
    where: { joinCode: cleanCode },
    include: {
      school: {
        select: { id: true, name: true, city: true },
      },
      teachingContexts: {
        include: {
          academicPeriod: {
            select: { id: true, year: true, semester: true, status: true },
          },
          teacherProfile: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!classRecord) {
    return { success: false, message: "Kode rombel tidak ditemukan." };
  }

  if (classRecord.joinCodeLocked) {
    return { success: false, message: "Kode rombel telah dikunci oleh guru." };
  }

  const primaryContext = classRecord.teachingContexts[0];

  return {
    success: true,
    data: {
      classId: classRecord.id,
      className: classRecord.name,
      gradeLevel: classRecord.gradeLevel,
      schoolId: classRecord.school.id,
      schoolName: classRecord.school.name,
      city: classRecord.school.city,
      academicPeriodId: primaryContext?.academicPeriod.id || null,
      academicYear: primaryContext?.academicPeriod.year || "2026/2027",
      semester: primaryContext?.academicPeriod.semester || "Semester Ganjil",
      teacherName: primaryContext?.teacherProfile.user.name || "Guru Pengampu",
    },
  };
}

export type RegisterStudentResult =
  | { success: true; status: "ACTIVE"; student: any; message: string }
  | { success: true; status: "PENDING"; reason: "MISMATCH_NAME" | "NEW_STUDENT"; student: any; message: string }
  | { success: false; message: string };

/**
 * Pendaftaran akun siswa via kode rombel dengan state machine 4 cabang (A-D)
 * dan proteksi Re-registration Account Takeover (F1).
 */
export async function registerStudent(data: {
  joinCode: string;
  fullName: string;
  nis: string;
  pin: string;
}): Promise<RegisterStudentResult> {
  // 1. Validasi format PIN 4-digit (Throws PinFormatError if invalid)
  validatePinFormat(data.pin);

  if (!data.fullName || !data.fullName.trim()) {
    return { success: false, message: "Nama lengkap siswa wajib diisi." };
  }

  if (!data.nis || !data.nis.trim()) {
    return { success: false, message: "NIS siswa wajib diisi." };
  }

  const cleanNis = data.nis.trim().toUpperCase();
  const cleanFullName = data.fullName.trim();
  const cleanCode = data.joinCode.trim().toUpperCase();

  // 2. Ambil data rombel & sekolah
  const classRecord = await prisma.class.findUnique({
    where: { joinCode: cleanCode },
    include: {
      teachingContexts: {
        select: { academicPeriodId: true },
        take: 1,
      },
    },
  });

  if (!classRecord) {
    return { success: false, message: "Kode rombel tidak ditemukan." };
  }

  if (classRecord.joinCodeLocked) {
    return { success: false, message: "Kode rombel telah dikunci oleh guru." };
  }

  const academicPeriodId = classRecord.teachingContexts[0]?.academicPeriodId;
  if (!academicPeriodId) {
    return { success: false, message: "Rombel belum terhubung dengan tahun ajaran aktif." };
  }

  // Skenario (d): Cek apakah siswa sudah terdaftar di rombel lain pada periode aktif yang sama
  const existingEnrollment = await prisma.classStudent.findFirst({
    where: {
      academicPeriodId,
      student: {
        schoolId: classRecord.schoolId,
        nis: { equals: cleanNis, mode: "insensitive" },
      },
    },
    include: {
      class: { select: { name: true } },
    },
  });

  if (existingEnrollment) {
    return {
      success: false,
      message: `Siswa dengan NIS ${cleanNis} sudah terdaftar di rombel "${existingEnrollment.class.name}" pada tahun ajaran ini. Minta guru untuk memindahkan rombel jika ada perubahan kelas.`,
    };
  }

  // Cari apakah row Student dengan NIS ini sudah ada di sekolah ini
  const existingStudent = await prisma.student.findFirst({
    where: {
      schoolId: classRecord.schoolId,
      nis: { equals: cleanNis, mode: "insensitive" },
    },
  });

  // F1 CRITICAL Anti-Takeover: Jika akun sudah memiliki accessPinHash aktif, tolak keras registrasi ulang!
  if (existingStudent && existingStudent.accessPinHash !== null) {
    return {
      success: false,
      message: `Akun siswa dengan NIS ${cleanNis} sudah terdaftar. Silakan login langsung menggunakan NIS dan PIN Anda, atau hubungi guru pengampu untuk mereset PIN jika lupa.`,
    };
  }

  const pinHash = await hashPin(data.pin);
  const now = new Date();

  // Skenario (a): NIS ada, accessPinHash null, nama cocok exact (case-insensitive) -> L0 ACTIVE
  if (
    existingStudent &&
    existingStudent.fullName.trim().toLowerCase() === cleanFullName.toLowerCase()
  ) {
    const updatedStudent = await prisma.$transaction(async (tx) => {
      const s = await tx.student.update({
        where: { id: existingStudent.id },
        data: {
          accessPinHash: pinHash,
          accountStatus: "ACTIVE",
          pinUpdatedAt: now,
          lastLoginAt: now,
          failedAttempts: 0,
          lockedUntil: null,
        },
        select: SAFE_STUDENT_SELECT,
      });

      await tx.classStudent.upsert({
        where: {
          studentId_academicPeriodId: {
            studentId: s.id,
            academicPeriodId,
          },
        },
        create: {
          studentId: s.id,
          classId: classRecord.id,
          academicPeriodId,
        },
        update: {
          classId: classRecord.id,
        },
      });

      return s;
    });

    // Buat cookie sesi siswa seketika (Auto-login L0)
    await setStudentSessionCookie({
      studentId: updatedStudent.id,
      schoolId: classRecord.schoolId,
      classId: classRecord.id,
      academicPeriodId,
      nis: cleanNis,
      fullName: updatedStudent.fullName,
      pinUpdatedAt: now.toISOString(),
    });

    return {
      success: true,
      status: "ACTIVE",
      student: updatedStudent,
      message: "Pendaftaran berhasil! Akun Anda aktif otomatis.",
    };
  }

  // Skenario (b): NIS ada, accessPinHash null, nama berbeda -> PENDING L1
  if (existingStudent) {
    const pendingStudent = await prisma.$transaction(async (tx) => {
      const s = await tx.student.update({
        where: { id: existingStudent.id },
        data: {
          accessPinHash: pinHash,
          accountStatus: "PENDING",
          pinUpdatedAt: now,
          failedAttempts: 0,
          lockedUntil: null,
        },
        select: SAFE_STUDENT_SELECT,
      });

      await tx.classStudent.upsert({
        where: {
          studentId_academicPeriodId: {
            studentId: s.id,
            academicPeriodId,
          },
        },
        create: {
          studentId: s.id,
          classId: classRecord.id,
          academicPeriodId,
        },
        update: {
          classId: classRecord.id,
        },
      });

      return s;
    });

    return {
      success: true,
      status: "PENDING",
      reason: "MISMATCH_NAME",
      student: pendingStudent,
      message:
        "Pendaftaran terkirim. Nama berbeda dengan data sekolah; akun menunggu persetujuan guru pengampu.",
    };
  }

  // Skenario (c): NIS baru belum terdata di sekolah -> PENDING L1
  const newStudent = await prisma.$transaction(async (tx) => {
    const s = await tx.student.create({
      data: {
        schoolId: classRecord.schoolId,
        fullName: cleanFullName,
        nis: cleanNis,
        accessPinHash: pinHash,
        accountStatus: "PENDING",
        pinUpdatedAt: now,
        failedAttempts: 0,
      },
      select: SAFE_STUDENT_SELECT,
    });

    await tx.classStudent.create({
      data: {
        studentId: s.id,
        classId: classRecord.id,
        academicPeriodId,
      },
    });

    return s;
  });

  return {
    success: true,
    status: "PENDING",
    reason: "NEW_STUDENT",
    student: newStudent,
    message: "Pendaftaran terkirim. Akun siswa baru menunggu persetujuan guru pengampu.",
  };
}

export type LoginStudentResult =
  | { success: true; redirect: string }
  | { success: false; message: string; code?: "ACCOUNT_LOCKED" | "ACCOUNT_PENDING" | "ACCOUNT_REJECTED" };

/**
 * Login harian siswa dengan NIS + PIN ter-scope sekolah (F2),
 * benteng Timing Defense Dummy-Verify (F5 & B3), dan Lockout Persisten bertingkat (B3).
 */
export async function loginStudent(data: {
  schoolId: string;
  nis: string;
  pin: string;
}): Promise<LoginStudentResult> {
  const genericErrorMessage = "NIS atau PIN salah.";

  if (!data.schoolId || !data.nis || !data.pin) {
    // Jalankan dummy verify agar waktu CPU identik
    await verifyPin(data.pin || "0000", DUMMY_HASH);
    return { success: false, message: genericErrorMessage };
  }

  const cleanNis = data.nis.trim().toUpperCase();

  // Cek format PIN 4 digit (jika bukan 4 digit, tetap dummy verify dan tolak)
  if (!/^\d{4}$/.test(data.pin)) {
    await verifyPin("0000", DUMMY_HASH);
    return { success: false, message: genericErrorMessage };
  }

  // Lookup siswa berindeks [schoolId, nis]
  const student = await prisma.student.findFirst({
    where: {
      schoolId: data.schoolId,
      nis: { equals: cleanNis, mode: "insensitive" },
    },
  });

  // F5 Dummy-Verify Defense: Jika NIS tidak ada atau belum set PIN, eksekusi scrypt tiruan
  if (!student || !student.accessPinHash) {
    await verifyPin(data.pin, DUMMY_HASH);
    return { success: false, message: genericErrorMessage };
  }

  const now = new Date();

  // B3: Cek status lockout persisten
  if (student.lockedUntil && student.lockedUntil > now) {
    const remainingMinutes = Math.ceil((student.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
    return {
      success: false,
      code: "ACCOUNT_LOCKED",
      message: `Akun terkunci sementara karena 5x percobaan salah. Coba lagi dalam ${remainingMinutes} menit.`,
    };
  }

  // Cek accountStatus (PENDING atau REJECTED tidak boleh login portal)
  if (student.accountStatus === "PENDING") {
    await verifyPin(data.pin, student.accessPinHash);
    return {
      success: false,
      code: "ACCOUNT_PENDING",
      message: "Akun Anda masih menunggu persetujuan guru.",
    };
  }

  if (student.accountStatus === "REJECTED") {
    await verifyPin(data.pin, student.accessPinHash);
    return {
      success: false,
      code: "ACCOUNT_REJECTED",
      message: "Pendaftaran akun Anda ditolak oleh guru.",
    };
  }

  // Verifikasi PIN scrypt riil
  const isPinValid = await verifyPin(data.pin, student.accessPinHash);

  if (!isPinValid) {
    const newFailedAttempts = student.failedAttempts + 1;
    let newLockedUntil: Date | null = null;

    // F6: Formula Eskalasi Lockout (15m -> 1h -> 24h)
    if (newFailedAttempts >= 10) {
      newLockedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 jam
    } else if (newFailedAttempts >= 6) {
      newLockedUntil = new Date(now.getTime() + 60 * 60 * 1000); // 1 jam
    } else if (newFailedAttempts === 5) {
      newLockedUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 menit
    }

    await prisma.student.update({
      where: { id: student.id },
      data: {
        failedAttempts: newFailedAttempts,
        lockedUntil: newLockedUntil,
      },
    });

    if (newLockedUntil && newFailedAttempts === 5) {
      return {
        success: false,
        code: "ACCOUNT_LOCKED",
        message: "Akun terkunci sementara karena 5x percobaan salah. Coba lagi dalam 15 menit.",
      };
    }

    return { success: false, message: genericErrorMessage };
  }

  // PIN Benar -> Reset failedAttempts dan update lastLoginAt
  await prisma.student.update({
    where: { id: student.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
    },
  });

  // Ambil rombel aktif siswa
  const classMembership = await prisma.classStudent.findFirst({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    select: { classId: true, academicPeriodId: true },
  });

  // Buat sesi siswa (HttpOnly cookie klassa_student_session)
  await setStudentSessionCookie({
    studentId: student.id,
    schoolId: student.schoolId,
    classId: classMembership?.classId || "",
    academicPeriodId: classMembership?.academicPeriodId || "",
    nis: student.nis || cleanNis,
    fullName: student.fullName,
    pinUpdatedAt: student.pinUpdatedAt ? student.pinUpdatedAt.toISOString() : null,
  });

  return {
    success: true,
    redirect: "/siswa/portal",
  };
}

/**
 * Logout siswa dengan menghapus cookie sesi.
 * Sesi guru Better Auth tetap utuh (B4).
 */
export async function logoutStudent() {
  await clearStudentSessionCookie();
  return { success: true, redirect: "/siswa" };
}
