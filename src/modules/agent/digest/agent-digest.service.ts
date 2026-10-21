/**
 * Class Digest Service — Klassa Agent
 *
 * Prinsip "1 lembar rangkuman": statistik kelas (presensi + akademik + siswa
 * risiko) dihitung di server dan di-cache, sehingga LLM tidak perlu membaca
 * ulang roster mentah pada setiap pertanyaan. Output dipadatkan menjadi
 * ringkasan kecil + daftar top-N (default 5) siswa paling relevan.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/auth";
import {
  calculateAttendanceStats,
  calculateAcademicGradeStats,
} from "../tools/agent-deterministic-math";

export interface ClassDigestSiswaAbsen {
  studentId: string;
  fullName: string;
  alpa: number;
  sakit: number;
  izin: number;
  persentaseKehadiran: number;
}

export interface ClassDigestSiswaRisiko {
  studentId: string;
  fullName: string;
  persentaseKehadiran: number;
  rataRataNilai: number;
  alasan: string;
}

export interface ClassDigest {
  classId: string;
  className: string;
  totalSiswa: number;
  presensi: {
    totalPertemuanTercatat: number;
    persentaseKehadiranKelas: number;
    kategori: string;
  };
  akademik: {
    kkm: number;
    totalNilaiTercatat: number;
    rataRataKelas: number;
    persentaseKetuntasan: number;
    statusKetercapaian: string;
  };
  siswaSeringAbsen: ClassDigestSiswaAbsen[];
  siswaButuhPerhatian: ClassDigestSiswaRisiko[];
  totalSiswaButuhPerhatian: number;
  dihitungPada: string;
}

const DIGEST_TTL_MS = 15 * 60 * 1000;
const TOP_N = 5;

const digestCache = new Map<string, { digest: ClassDigest; expiresAt: number }>();

/** Hapus cache digest kelas (panggil saat data kelas berubah). */
export function invalidateClassDigest(classId: string): void {
  digestCache.delete(classId);
}

function extractScore(a: {
  finalScore: Prisma.Decimal | number | string | null;
  normalizedScore: Prisma.Decimal | number | string | null;
}): number | null {
  if (a.finalScore !== null && a.finalScore !== undefined) return Number(a.finalScore);
  if (a.normalizedScore !== null && a.normalizedScore !== undefined) {
    return Number(a.normalizedScore);
  }
  return null;
}

/**
 * Mengambil (atau membuat) digest ringkas sebuah rombel.
 * Cache in-memory 15 menit per classId — aman karena digest bersifat
 * agregat; detail mutakhir tetap bisa diambil via tool lain.
 */
export async function getClassDigest(classId: string, kkm = 75): Promise<ClassDigest> {
  const cached = digestCache.get(classId);
  if (cached && cached.expiresAt > Date.now()) return cached.digest;

  const [classRow, classStudents, attendanceRecords, assessmentResults] =
    await Promise.all([
      prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
      prisma.classStudent.findMany({
        where: { classId },
        include: { student: true },
        orderBy: { student: { fullName: "asc" } },
      }),
      prisma.attendanceRecord.findMany({
        where: { teachingSession: { teachingContext: { classId } } },
      }),
      prisma.assessmentResult.findMany({
        where: { assessment: { teachingContext: { classId } } },
      }),
    ]);

  // Agregat presensi kelas
  const classCounts = {
    hadir: attendanceRecords.filter((r) => r.status === "PRESENT").length,
    sakit: attendanceRecords.filter((r) => r.status === "SICK").length,
    izin: attendanceRecords.filter((r) => r.status === "PERMISSION").length,
    alpa: attendanceRecords.filter((r) => r.status === "ABSENT").length,
  };
  const attStats = calculateAttendanceStats(classCounts);

  // Agregat akademik kelas
  const allScores = assessmentResults
    .map(extractScore)
    .filter((s): s is number => s !== null);
  const acadStats = calculateAcademicGradeStats(allScores, kkm);
  const persentaseKetuntasan =
    acadStats.totalItem > 0
      ? Math.round((acadStats.tuntasCount / acadStats.totalItem) * 100)
      : 0;

  // Analisis per siswa (untuk daftar top-N)
  const perSiswa = classStudents.map((cs) => {
    const recs = attendanceRecords.filter((r) => r.studentId === cs.studentId);
    const counts = {
      hadir: recs.filter((r) => r.status === "PRESENT").length,
      sakit: recs.filter((r) => r.status === "SICK").length,
      izin: recs.filter((r) => r.status === "PERMISSION").length,
      alpa: recs.filter((r) => r.status === "ABSENT").length,
    };
    const sAtt = calculateAttendanceStats(counts);
    const sScores = assessmentResults
      .filter((a) => a.studentId === cs.studentId)
      .map(extractScore)
      .filter((s): s is number => s !== null);
    const sAcad = calculateAcademicGradeStats(sScores, kkm);
    return { student: cs.student, sAtt, sAcad };
  });

  // Top-N siswa sering absen
  const siswaSeringAbsen: ClassDigestSiswaAbsen[] = perSiswa
    .filter(
      (p) =>
        p.sAtt.alpa > 0 || p.sAtt.sakit > 0 || p.sAtt.izin > 0
    )
    .sort(
      (a, b) =>
        b.sAtt.alpa - a.sAtt.alpa ||
        b.sAtt.sakit + b.sAtt.izin - (a.sAtt.sakit + a.sAtt.izin)
    )
    .slice(0, TOP_N)
    .map((p) => ({
      studentId: p.student.id,
      fullName: p.student.fullName,
      alpa: p.sAtt.alpa,
      sakit: p.sAtt.sakit,
      izin: p.sAtt.izin,
      persentaseKehadiran: p.sAtt.persentaseKehadiran,
    }));

  // Siswa butuh perhatian (kehadiran < 75% atau rata-rata < KKM)
  const risikoAll = perSiswa
    .filter(
      (p) =>
        (p.sAtt.totalPertemuan > 0 && p.sAtt.persentaseKehadiran < 75) ||
        (p.sAcad.totalItem > 0 && p.sAcad.rataRata < kkm)
    )
    .map((p) => {
      const alasan: string[] = [];
      if (p.sAtt.totalPertemuan > 0 && p.sAtt.persentaseKehadiran < 75)
        alasan.push(`kehadiran ${p.sAtt.persentaseKehadiran}%`);
      if (p.sAcad.totalItem > 0 && p.sAcad.rataRata < kkm)
        alasan.push(`rerata ${p.sAcad.rataRata} < KKM ${kkm}`);
      return {
        studentId: p.student.id,
        fullName: p.student.fullName,
        persentaseKehadiran: p.sAtt.persentaseKehadiran,
        rataRataNilai: p.sAcad.rataRata,
        alasan: alasan.join(" & "),
      };
    });

  const digest: ClassDigest = {
    classId,
    className: classRow?.name ?? "(kelas tidak ditemukan)",
    totalSiswa: classStudents.length,
    presensi: {
      totalPertemuanTercatat: attStats.totalPertemuan,
      persentaseKehadiranKelas: attStats.persentaseKehadiran,
      kategori: attStats.kategori,
    },
    akademik: {
      kkm,
      totalNilaiTercatat: acadStats.totalItem,
      rataRataKelas: acadStats.rataRata,
      persentaseKetuntasan,
      statusKetercapaian: acadStats.statusKetercapaian,
    },
    siswaSeringAbsen,
    siswaButuhPerhatian: risikoAll.slice(0, TOP_N),
    totalSiswaButuhPerhatian: risikoAll.length,
    dihitungPada: new Date().toISOString(),
  };

  digestCache.set(classId, { digest, expiresAt: Date.now() + DIGEST_TTL_MS });
  return digest;
}
