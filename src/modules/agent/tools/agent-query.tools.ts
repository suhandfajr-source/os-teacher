import { tool } from "ai";
import { prisma } from "@/lib/auth";
import {
  verifyActiveSchoolMembership,
  verifyClassRosterAccess,
} from "@/lib/authorization";
import {
  getClassStudentsSchema,
  getStudentAttendanceSummarySchema,
  getStudentAcademicSummarySchema,
  getClassDigestSchema,
  analyzeClassPerformanceSchema,
  getTeacherClassesSchema,
  GetClassStudentsInput,
  GetStudentAttendanceSummaryInput,
  GetStudentAcademicSummaryInput,
  GetClassDigestInput,
  AnalyzeClassPerformanceInput,
} from "./agent-tools.types";
import { getClassDigest } from "../digest/agent-digest.service";
import {
  calculateAttendanceStats,
  calculateAcademicGradeStats,
} from "./agent-deterministic-math";

function formatToolError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes("teach this class") || error.message.includes("Forbidden")) {
      return "Akses ditolak: Anda bukan pengampu rombel ini.";
    }
    return error.message;
  }
  return "Akses ditolak: Anda bukan pengampu rombel ini.";
}

/**
 * 1. Tool: Mengambil daftar rombel dan mata pelajaran yang diampu oleh guru
 */

/**
 * 1b. Tool: Rangkuman Kelas (Class Digest) — jalur utama agent.
 * Satu panggilan = ringkasan presensi + akademik + siswa risiko (top 5).
 * Dilayani dari cache server 15 menit sehingga ringan dan hemat context.
 */
export const getClassDigestTool = tool({
  description:
    "Mengambil RANGKUMAN SATU LEMBAR sebuah kelas: statistik presensi, rerata nilai & ketuntasan, daftar siswa yang sering absen, dan siswa yang butuh perhatian (top 5). PAKAI TOOL INI DULU untuk pertanyaan umum tentang kondisi kelas; tool lain hanya untuk detail spesifik.",
  inputSchema: getClassDigestSchema,
  execute: async ({ classId, kkm = 75 }: GetClassDigestInput) => {
    try {
      // Guard Otorisasi Scope Rombel B2
      await verifyClassRosterAccess(classId);
      const digest = await getClassDigest(classId, kkm);
      return { success: true, ...digest };
    } catch (error: unknown) {
      return {
        success: false,
        error: formatToolError(error),
      };
    }
  },
});
export const getTeacherClassesTool = tool({
  description:
    "Mengambil daftar kelas/rombel dan mata pelajaran yang diampu oleh guru yang sedang aktif di sekolah ini.",
  inputSchema: getTeacherClassesSchema,
  execute: async () => {
    try {
      const { profile, activeSchoolId } = await verifyActiveSchoolMembership();

      const teachingContexts = await prisma.teachingContext.findMany({
        where: {
          teacherProfileId: profile.id,
          schoolId: activeSchoolId,
        },
        include: {
          class: true,
          subject: true,
          academicPeriod: true,
        },
      });

      return {
        success: true,
        data: teachingContexts.map((tc) => ({
          contextId: tc.id,
          classId: tc.classId,
          className: tc.class.name,
          gradeLevel: tc.class.gradeLevel,
          subjectId: tc.subjectId,
          subjectName: tc.subject.name,
          academicYear: tc.academicPeriod.year,
          semester: tc.academicPeriod.semester,
        })),
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Gagal memuat daftar kelas.",
      };
    }
  },
});

/**
 * 2. Tool: Mengambil daftar murid di dalam rombel yang diampu (Scope Rombel B2 Guarded)
 */
export const getClassStudentsTool = tool({
  description:
    "Mengambil daftar lengkap murid (Nama, NIS, Status Aktif) dalam rombel yang diampu guru.",
  inputSchema: getClassStudentsSchema,
  execute: async ({ classId }: GetClassStudentsInput) => {
    try {
      // Guard Otorisasi Scope Rombel B2
      await verifyClassRosterAccess(classId);

      const classStudents = await prisma.classStudent.findMany({
        where: { classId },
        include: {
          student: true,
        },
        orderBy: {
          student: { fullName: "asc" },
        },
      });

      return {
        success: true,
        totalSiswa: classStudents.length,
        siswa: classStudents.map((cs) => ({
          studentId: cs.student.id,
          nis: cs.student.nis,
          fullName: cs.student.fullName,
          status: cs.student.status,
          birthDate: cs.student.birthDate,
        })),
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: formatToolError(error),
      };
    }
  },
});

/**
 * 3. Tool: Rekap Presensi Siswa/Kelas 100% Deterministik (Scope Rombel B2 Guarded)
 */
export const getStudentAttendanceSummaryTool = tool({
  description:
    "Mengambil rekap kehadiran siswa atau satu kelas penuh dengan persentase kehadiran 100% deterministik, termasuk rincian siswa yang sering tidak hadir (alpa/sakit/izin).",
  inputSchema: getStudentAttendanceSummarySchema,
  execute: async ({ classId, studentId }: GetStudentAttendanceSummaryInput) => {
    try {
      await verifyClassRosterAccess(classId);

      const records = await prisma.attendanceRecord.findMany({
        where: {
          teachingSession: {
            teachingContext: {
              classId,
            },
          },
          ...(studentId ? { studentId } : {}),
        },
      });

      const counts = {
        hadir: records.filter((r) => r.status === "PRESENT").length,
        sakit: records.filter((r) => r.status === "SICK").length,
        izin: records.filter((r) => r.status === "PERMISSION").length,
        alpa: records.filter((r) => r.status === "ABSENT").length,
      };

      const stats = calculateAttendanceStats(counts);

      // Jika query mencakup seluruh kelas, sertakan rincian siswa yang sering absen/tidak hadir
      let daftarSiswaSeringAbsen: Array<{
        studentId: string;
        fullName: string;
        alpa: number;
        sakit: number;
        izin: number;
        hadir: number;
        persentaseKehadiran: number;
      }> = [];
      let totalSiswaSeringAbsen = 0;

      if (!studentId) {
        const classStudents = await prisma.classStudent.findMany({
          where: { classId },
          include: { student: true },
          orderBy: { student: { fullName: "asc" } },
        });

        const perStudentMap = classStudents.map((cs) => {
          const studentRecs = records.filter((r) => r.studentId === cs.studentId);
          const studentCounts = {
            hadir: studentRecs.filter((r) => r.status === "PRESENT").length,
            sakit: studentRecs.filter((r) => r.status === "SICK").length,
            izin: studentRecs.filter((r) => r.status === "PERMISSION").length,
            alpa: studentRecs.filter((r) => r.status === "ABSENT").length,
          };
          const studentStats = calculateAttendanceStats(studentCounts);
          return {
            studentId: cs.student.id,
            fullName: cs.student.fullName,
            alpa: studentCounts.alpa,
            sakit: studentCounts.sakit,
            izin: studentCounts.izin,
            hadir: studentCounts.hadir,
            persentaseKehadiran: studentStats.persentaseKehadiran,
          };
        });

        // Filter siswa yang memiliki ketidakhadiran (alpa > 0 atau sakit/izin > 0)
        // diurutkan dari alpa terbanyak — dibatasi TOP 5 untuk hemat context;
        // sisa daftar lengkap cukup disebut jumlahnya.
        const semuaSeringAbsen = perStudentMap
          .filter((s) => s.alpa > 0 || s.sakit > 0 || s.izin > 0)
          .sort((a, b) => b.alpa - a.alpa || (b.sakit + b.izin) - (a.sakit + a.izin));
        daftarSiswaSeringAbsen = semuaSeringAbsen.slice(0, 5);
        totalSiswaSeringAbsen = semuaSeringAbsen.length;
      }

      return {
        success: true,
        classId,
        studentId: studentId || "SELURUH_KELAS",
        statistik: stats,
        totalSiswaSeringAbsen,
        daftarSiswaSeringAbsen,
        catatan:
          totalSiswaSeringAbsen > 5
            ? `Hanya 5 teratas ditampilkan dari ${totalSiswaSeringAbsen} siswa.`
            : undefined,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: formatToolError(error),
      };
    }
  },
});

/**
 * 4. Tool: Rekap Asesmen Akademik Siswa/Kelas 100% Deterministik (Scope Rombel B2 Guarded)
 */
export const getStudentAcademicSummaryTool = tool({
  description:
    "Mengambil rekap capaian nilai asesmen akademik dan kuis siswa dengan rerata dan status KKM deterministik.",
  inputSchema: getStudentAcademicSummarySchema,
  execute: async ({ classId, studentId }: GetStudentAcademicSummaryInput) => {
    try {
      await verifyClassRosterAccess(classId);

      const assessmentResults = await prisma.assessmentResult.findMany({
        where: {
          assessment: {
            teachingContext: {
              classId,
            },
          },
          ...(studentId ? { studentId } : {}),
        },
      });

      const scores = assessmentResults
        .map((a) => {
          if (a.finalScore !== null && a.finalScore !== undefined) {
            return Number(a.finalScore);
          }
          if (a.normalizedScore !== null && a.normalizedScore !== undefined) {
            return Number(a.normalizedScore);
          }
          return null;
        })
        .filter((s): s is number => s !== null);

      const stats = calculateAcademicGradeStats(scores);

      return {
        success: true,
        classId,
        studentId: studentId || "SELURUH_KELAS",
        statistikAkademik: stats,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: formatToolError(error),
      };
    }
  },
});

/**
 * 5. Tool: Analisis Performa Kelas & Siswa Berisiko (Scope Rombel B2 Guarded)
 */
export const analyzeClassPerformanceTool = tool({
  description:
    "Menganalisis performa kelas secara komprehensif: rata-rata nilai kelas, tingkat ketuntasan, dan daftar siswa berisiko (butuh perhatian khusus atau remedial).",
  inputSchema: analyzeClassPerformanceSchema,
  execute: async ({ classId, kkm = 75 }: AnalyzeClassPerformanceInput) => {
    try {
      await verifyClassRosterAccess(classId);

      const classStudents = await prisma.classStudent.findMany({
        where: { classId },
        include: {
          student: true,
        },
      });

      // Ambil seluruh presensi sesi di rombel ini
      const attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          teachingSession: {
            teachingContext: {
              classId,
            },
          },
        },
      });

      // Ambil seluruh hasil asesmen di rombel ini
      const assessmentResults = await prisma.assessmentResult.findMany({
        where: {
          assessment: {
            teachingContext: {
              classId,
            },
          },
        },
      });

      const studentAnalyses = classStudents.map((cs) => {
        const studentAttendances = attendanceRecords.filter((r) => r.studentId === cs.studentId);
        const counts = {
          hadir: studentAttendances.filter((r) => r.status === "PRESENT").length,
          sakit: studentAttendances.filter((r) => r.status === "SICK").length,
          izin: studentAttendances.filter((r) => r.status === "PERMISSION").length,
          alpa: studentAttendances.filter((r) => r.status === "ABSENT").length,
        };
        const attStats = calculateAttendanceStats(counts);

        const studentScores = assessmentResults
          .filter((a) => a.studentId === cs.studentId)
          .map((a) => {
            if (a.finalScore !== null && a.finalScore !== undefined) {
              return Number(a.finalScore);
            }
            if (a.normalizedScore !== null && a.normalizedScore !== undefined) {
              return Number(a.normalizedScore);
            }
            return null;
          })
          .filter((s): s is number => s !== null);

        const acadStats = calculateAcademicGradeStats(studentScores, kkm);

        const butuhPerhatian =
          (attStats.totalPertemuan > 0 && attStats.persentaseKehadiran < 75) ||
          (acadStats.totalItem > 0 && acadStats.rataRata < kkm);

        return {
          studentId: cs.student.id,
          fullName: cs.student.fullName,
          persentaseKehadiran: attStats.persentaseKehadiran,
          rataRataNilai: acadStats.rataRata,
          statusKehadiran: attStats.kategori,
          statusAkademik: acadStats.statusKetercapaian,
          butuhPerhatian,
        };
      });

      const allScores = assessmentResults
        .map((a) => {
          if (a.finalScore !== null && a.finalScore !== undefined) {
            return Number(a.finalScore);
          }
          if (a.normalizedScore !== null && a.normalizedScore !== undefined) {
            return Number(a.normalizedScore);
          }
          return null;
        })
        .filter((score): score is number => score !== null);

      const classStats = calculateAcademicGradeStats(allScores, kkm);
      const siswaBermasalah = studentAnalyses
        .filter((s) => s.butuhPerhatian)
        .slice(0, 5); // TOP 5 untuk hemat context; total tetap dilaporkan

      return {
        success: true,
        classId,
        kkm,
        totalSiswa: classStudents.length,
        statistikKelas: classStats,
        jumlahSiswaPerluPerhatian: siswaBermasalah.length === 5 ? ">=5" : siswaBermasalah.length,
        daftarSiswaPerluPerhatian: siswaBermasalah,
        catatan:
          siswaBermasalah.length === 5
            ? "Hanya 5 teratas ditampilkan. Gunakan getClassStudents untuk daftar lengkap."
            : undefined,
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: formatToolError(error),
      };
    }
  },
});
