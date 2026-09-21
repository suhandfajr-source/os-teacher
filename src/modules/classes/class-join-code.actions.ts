"use server";

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/auth";
import { verifyActiveSchoolMembership } from "@/lib/authorization";

// 32 karakter alfanumerik tanpa karakter ambigu (0, O, 1, I)
const JOIN_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const JOIN_CODE_LENGTH = 6;

/**
 * Menghasilkan kode acak 6 karakter dengan entropi kriptografis tinggi.
 * 32^6 = 1.073.741.824 kombinasi unik.
 */
export function generateRandomJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    const idx = randomInt(0, JOIN_CODE_CHARSET.length);
    code += JOIN_CODE_CHARSET[idx];
  }
  return code;
}

/**
 * Membuat kode rombel baru untuk kelas tertentu.
 */
export async function generateClassJoinCode(classId: string) {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  const targetClass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, schoolId: true, joinCode: true, joinCodeLocked: true },
  });

  if (!targetClass || targetClass.schoolId !== activeSchoolId) {
    throw new Error("Kelas tidak ditemukan di sekolah aktif Anda.");
  }

  // Jika sudah ada kode dan tidak terkunci, return yang ada
  if (targetClass.joinCode && !targetClass.joinCodeLocked) {
    return { success: true, joinCode: targetClass.joinCode, joinCodeLocked: targetClass.joinCodeLocked };
  }

  // Loop generate sampai dapat yang unik di tabel Class
  let attempts = 0;
  while (attempts < 10) {
    attempts++;
    const code = generateRandomJoinCode();
    const existing = await prisma.class.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });

    if (!existing) {
      const updated = await prisma.class.update({
        where: { id: classId },
        data: {
          joinCode: code,
          joinCodeUpdatedAt: new Date(),
          joinCodeLocked: false,
        },
        select: { id: true, joinCode: true, joinCodeLocked: true },
      });
      return { success: true, joinCode: updated.joinCode, joinCodeLocked: updated.joinCodeLocked };
    }
  }

  throw new Error("Gagal menghasilkan kode rombel unik. Coba lagi.");
}

/**
 * Merotasi kode rombel yang sudah ada dengan kode baru.
 */
export async function rotateClassJoinCode(classId: string) {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  const targetClass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, schoolId: true },
  });

  if (!targetClass || targetClass.schoolId !== activeSchoolId) {
    throw new Error("Kelas tidak ditemukan di sekolah aktif Anda.");
  }

  let attempts = 0;
  while (attempts < 10) {
    attempts++;
    const code = generateRandomJoinCode();
    const existing = await prisma.class.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });

    if (!existing) {
      const updated = await prisma.class.update({
        where: { id: classId },
        data: {
          joinCode: code,
          joinCodeUpdatedAt: new Date(),
        },
        select: { id: true, joinCode: true, joinCodeLocked: true },
      });
      return { success: true, joinCode: updated.joinCode, joinCodeLocked: updated.joinCodeLocked };
    }
  }

  throw new Error("Gagal merotasi kode rombel unik. Coba lagi.");
}

/**
 * Mengunci atau membuka kuncian kode rombel.
 * Saat terkunci, siswa tidak dapat mendaftar menggunakan kode tersebut.
 */
export async function lockClassJoinCode(classId: string, locked: boolean) {
  const { activeSchoolId } = await verifyActiveSchoolMembership();

  const targetClass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, schoolId: true, joinCode: true },
  });

  if (!targetClass || targetClass.schoolId !== activeSchoolId) {
    throw new Error("Kelas tidak ditemukan di sekolah aktif Anda.");
  }

  if (!targetClass.joinCode) {
    throw new Error("Kelas belum memiliki kode rombel untuk dikunci.");
  }

  const updated = await prisma.class.update({
    where: { id: classId },
    data: { joinCodeLocked: locked },
    select: { id: true, joinCode: true, joinCodeLocked: true },
  });

  return { success: true, joinCode: updated.joinCode, joinCodeLocked: updated.joinCodeLocked };
}
