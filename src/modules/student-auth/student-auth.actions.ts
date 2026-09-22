"use server";

import { prisma } from "@/lib/auth";
import { validatePinFormat, hashPin, verifyPin } from "@/lib/student-pin";
import { redactMetadata } from "@/lib/audit-metadata";
import type { Prisma } from "@prisma/client";
import { 
  setStudentSessionCookie, 
  clearStudentSessionCookie,
  DUMMY_HASH 
} from "./student-session";

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
        select: { id: true, name: true, city: true, deactivatedAt: true }, // Story 5 F7
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

  // Story 5 F7: sekolah nonaktif → lookup fail-closed (pesan generik identik,
  // tidak membocorkan status sekolah).
  if (classRecord.school?.deactivatedAt) {
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

export type JoinCodeContext = {
  classId: string;
  className: string;
  gradeLevel: string | null;
  schoolId: string;
  schoolName: string;
  city: string | null;
  academicPeriodId: string | null;
  academicYear: string;
  semester: string;
  teacherName: string;
};

export type RegisterStudentResult =
  | { success: true; status: "ACTIVE"; student: any; message: string; redirect?: string }
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
      school: {
        select: { id: true, name: true, deactivatedAt: true }, // Story 5 F7 — fail-closed
      },
      teachingContexts: {
        select: { academicPeriodId: true },
        take: 1,
      },
    },
  });

  if (!classRecord) {
    return { success: false, message: "Kode rombel tidak ditemukan." };
  }

  // Story 5 F7: sekolah nonaktif → semua gerbang pendaftaran fail-closed (pesan generik).
  if (classRecord.school?.deactivatedAt) {
    return { success: false, message: "Kode rombel tidak ditemukan." };
  }

  if (classRecord.joinCodeLocked) {
    return { success: false, message: "Kode rombel telah dikunci oleh guru." };
  }

  const academicPeriodId = classRecord.teachingContexts[0]?.academicPeriodId;
  if (!academicPeriodId) {
    return { success: false, message: "Rombel belum terhubung dengan tahun ajaran aktif." };
  }

  // Cari apakah row Student dengan NIS ini sudah ada di sekolah ini
  const existingStudent = await prisma.student.findFirst({
    where: {
      schoolId: classRecord.schoolId,
      nis: { equals: cleanNis, mode: "insensitive" },
    },
  });

  // F1 CRITICAL Anti-Takeover (Story 4): akun ber-PIN selain REJECTED ditolak keras.
  // Story 5 F1 + G-1: jalur daftar ulang REJECTED diizinkan dengan verifikasi
  // PIN lama wajib (bukti kepemilikan satu-satunya) — cabang khusus ada di bawah.
  if (
    existingStudent &&
    existingStudent.accessPinHash !== null &&
    existingStudent.accountStatus !== "REJECTED"
  ) {
    return {
      success: false,
      message: `Akun siswa dengan NIS ${cleanNis} sudah terdaftar. Silakan login langsung menggunakan NIS dan PIN Anda, atau hubungi guru pengampu untuk mereset PIN jika lupa.`,
    };
  }

  // Skenario (d): Cek apakah siswa sudah terdaftar di rombel lain pada periode aktif yang sama.
  // Story 5 G-2: siswa REJECTED daftar ulang ke rombel berbeda diarahkan ke UPDATE
  // classId pada row ClassStudent existing (N5) — bukan ditolak.
  const existingEnrollment = await prisma.classStudent.findFirst({
    where: {
      academicPeriodId,
      student: {
        schoolId: classRecord.schoolId,
        nis: { equals: cleanNis, mode: "insensitive" },
      },
    },
    include: {
      class: { select: { id: true, name: true } },
    },
  });

  if (
    existingEnrollment &&
    existingEnrollment.class.id !== classRecord.id &&
    existingStudent?.accountStatus !== "REJECTED"
  ) {
    return {
      success: false,
      message: `Siswa dengan NIS ${cleanNis} sudah terdaftar di rombel "${existingEnrollment.class.name}" pada tahun ajaran ini. Minta guru untuk memindahkan rombel jika ada perubahan kelas.`,
    };
  }

  const pinHash = await hashPin(data.pin);
  const now = new Date();

  // Story 5 F1 + G-1 — Jalur daftar ulang REJECTED:
  // PIN lama wajib cocok (bukti kepemilikan satu-satunya); row TIDAK disentuh bila salah.
  if (existingStudent && existingStudent.accountStatus === "REJECTED" && existingStudent.accessPinHash) {
    const oldPinValid = await verifyPin(data.pin, existingStudent.accessPinHash);
    if (!oldPinValid) {
      // G-1: tolak generik + AuditLog percobaan; row tidak berubah.
      await prisma.auditLog.create({
        data: {
          actorType: "STUDENT",
          actorId: existingStudent.id,
          action: "STUDENT_RE_REGISTER_DENIED",
          targetType: "STUDENT",
          targetId: existingStudent.id,
          metadata: redactMetadata({ reason: "OLD_PIN_MISMATCH" }) as Prisma.InputJsonValue,
        },
      });
      return {
        success: false,
        message: "NIS, nama, atau PIN tidak cocok dengan data sekolah.",
      };
    }

    const nameChanged = existingStudent.fullName.trim().toLowerCase() !== cleanFullName.toLowerCase();
    const movedClass = existingEnrollment ? existingEnrollment.class.id !== classRecord.id : false;

    const reRegistered = await prisma.$transaction(async (tx) => {
      // Conditional update (F5): hanya bila masih REJECTED — kalah race dengan approve → gagal generik.
      const updated = await tx.student.updateMany({
        where: { id: existingStudent.id, accountStatus: "REJECTED" },
        data: {
          accessPinHash: pinHash,
          fullName: cleanFullName,
          accountStatus: "PENDING",
          pinUpdatedAt: now,
          failedAttempts: 0,
          lockedUntil: null,
          accountRequestedAt: now, // F2
          approvedById: null,
          approvedAt: null,
        },
      });
      if (updated.count !== 1) return false;

      // N5 + G-2: reuse row enrollment — pindah rombel = UPDATE classId, bukan delete-insert.
      await tx.classStudent.upsert({
        where: {
          studentId_academicPeriodId: {
            studentId: existingStudent.id,
            academicPeriodId,
          },
        },
        create: { studentId: existingStudent.id, classId: classRecord.id, academicPeriodId },
        update: { classId: classRecord.id },
      });

      await tx.auditLog.create({
        data: {
          actorType: "STUDENT",
          actorId: existingStudent.id,
          action: "STUDENT_RE_REGISTERED",
          targetType: "STUDENT",
          targetId: existingStudent.id,
          metadata: redactMetadata({
            attempt: 2,
            nameChanged,
            nameChangedFrom: nameChanged ? existingStudent.fullName : undefined,
            movedClass,
            classId: classRecord.id,
          }) as Prisma.InputJsonValue,
        },
      });

      return true;
    });

    if (!reRegistered) {
      return { success: false, message: "Pendaftaran gagal. Coba beberapa saat lagi." };
    }

    return {
      success: true,
      status: "PENDING",
      reason: "MISMATCH_NAME",
      student: { id: existingStudent.id, fullName: cleanFullName, nis: cleanNis },
      message: nameChanged
        ? "Pendaftaran ulang terkirim. Perubahan nama akan diverifikasi guru pengampu."
        : "Pendaftaran ulang terkirim. Akun menunggu persetujuan guru pengampu.",
    };
  }

  // Story 5 EC-11: baris REJECTED tanpa hash (legacy/pramigrasi) TIDAK boleh
  // auto-L0 — tangga persetujuan melarang reaktivasi otomatis tanpa bukti PIN.
  // Jalur pulih: guru reset PIN (B2/G-1) → daftar ulang dengan PIN baru.
  if (existingStudent && existingStudent.accountStatus === "REJECTED" && !existingStudent.accessPinHash) {
    return {
      success: false,
      message:
        "Pendaftaran ulang akun ini memerlukan verifikasi PIN. Hubungi guru pengampu untuk mereset PIN terlebih dahulu.",
    };
  }

  // Skenario (a): NIS ada, accessPinHash null, nama cocok exact (case-insensitive) -> L0 ACTIVE
  if (
    existingStudent &&
    existingStudent.accountStatus !== "REJECTED" &&
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
      redirect: "/siswa/portal",
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
          accountRequestedAt: now, // Story 5 F2 — sumber tunggal eskalasi
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
        accountRequestedAt: now, // Story 5 F2 — sumber tunggal eskalasi
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
  | { 
      success: false; 
      message: string; 
      code?: "ACCOUNT_LOCKED" | "ACCOUNT_PENDING" | "ACCOUNT_REJECTED";
      status?: "PENDING" | "REJECTED";
      studentName?: string;
      schoolName?: string;
    };

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
    include: {
      school: {
        select: { id: true, name: true, deactivatedAt: true }, // Story 5 F7
      },
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
  // Benteng Keamanan: Wajib verifikasi PIN terlebih dahulu agar attacker tidak bisa
  // mengintip nama siswa berstatus PENDING/REJECTED hanya dengan menebak NIS.
  if (student.accountStatus === "PENDING") {
    const isPinValid = await verifyPin(data.pin, student.accessPinHash);
    if (!isPinValid) {
      const newFailed = student.failedAttempts + 1;
      await prisma.student.update({
        where: { id: student.id },
        data: { failedAttempts: newFailed },
      });
      return { success: false, message: genericErrorMessage };
    }
    return {
      success: false,
      code: "ACCOUNT_PENDING",
      status: "PENDING",
      studentName: student.fullName,
      schoolName: student.school?.name || "Sekolah",
      message: "Akun Anda masih menunggu persetujuan guru.",
    };
  }

  if (student.accountStatus === "REJECTED") {
    const isPinValid = await verifyPin(data.pin, student.accessPinHash);
    if (!isPinValid) {
      const newFailed = student.failedAttempts + 1;
      await prisma.student.update({
        where: { id: student.id },
        data: { failedAttempts: newFailed },
      });
      return { success: false, message: genericErrorMessage };
    }
    return {
      success: false,
      code: "ACCOUNT_REJECTED",
      status: "REJECTED",
      studentName: student.fullName,
      schoolName: student.school?.name || "Sekolah",
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

  // Story 5 F7: sekolah nonaktif → login siswa gagal generik (timing seragam —
  // dicek SETELAH verifikasi PIN agar tidak membocorkan status sekolah).
  if (student.school?.deactivatedAt) {
    return { success: false, message: genericErrorMessage };
  }

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
  return { success: true, redirect: "/portal-siswa" };
}
