"use server";

import { prisma } from "@/lib/auth";
import { verifyStudentSession, setStudentSessionCookie } from "@/modules/student-auth/student-session";
import { 
  getNormalizedDayOfWeek, 
  getCurrentTimeString, 
  getDayNameIndonesia 
} from "@/lib/schedule-date-utils";
import { verifyPin, hashPin } from "@/lib/student-pin";

export interface TodayScheduleItem {
  id: string;
  subjectName: string;
  teacherName: string;
  startTime: string;
  endTime: string;
  room?: string | null;
  isLive: boolean;
}

export interface UrgentQuizItem {
  id: string;
  title: string;
  shareToken: string;
  subjectName: string;
  deadline: string | null;
  durationMinutes?: number | null;
  isAttempted: boolean;
  attemptStatus?: "IN_PROGRESS" | "SUBMITTED" | null;
  score?: number | null;
}

export interface StudentDashboardData {
  student: {
    id: string;
    fullName: string;
    nis: string;
    schoolName: string;
    className: string;
    academicYear: string;
  };
  today: {
    dayName: string;
    currentTime: string;
    schedules: TodayScheduleItem[];
  };
  urgentQuizzes: UrgentQuizItem[];
  hasActivePeriod: boolean;
}

/**
 * Mengambil data komprehensif Beranda "Hari Ini" untuk portal siswa.
 * Seluruh identitas diderivasi dari sesi server (Amendum B1 & CAP-5).
 */
export async function getStudentDashboardDataAction(): Promise<{
  success: boolean;
  data?: StudentDashboardData;
  error?: string;
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
    }

    // Ambil data siswa dan keanggotaan rombel aktif
    const student = await prisma.student.findUnique({
      where: { id: session.studentId },
      include: {
        school: { select: { id: true, name: true } },
        classMemberships: {
          include: {
            class: { select: { id: true, name: true, gradeLevel: true } },
            academicPeriod: { select: { id: true, year: true, semester: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) {
      return { success: false, error: "Data siswa tidak ditemukan." };
    }

    // Temukan keanggotaan rombel pada periode akademik aktif
    const activeMembership = student.classMemberships.find(
      (cm) => cm.academicPeriod.status === "ACTIVE"
    ) || student.classMemberships[0];

    if (!activeMembership) {
      return {
        success: true,
        data: {
          student: {
            id: student.id,
            fullName: student.fullName,
            nis: student.nis || session.nis,
            schoolName: student.school.name,
            className: "Belum Ada Rombel",
            academicYear: "-",
          },
          today: {
            dayName: getDayNameIndonesia(getNormalizedDayOfWeek(new Date(), "Asia/Jakarta")),
            currentTime: getCurrentTimeString(new Date(), "Asia/Jakarta"),
            schedules: [],
          },
          urgentQuizzes: [],
          hasActivePeriod: false,
        },
      };
    }

    const classId = activeMembership.classId;
    const academicPeriodId = activeMembership.academicPeriodId;
    const currentDay = getNormalizedDayOfWeek(new Date(), "Asia/Jakarta");
    const currentTime = getCurrentTimeString(new Date(), "Asia/Jakarta");
    const now = new Date();

    // Query paralel teroptimasi untuk jadwal hari ini dan kuis aktif
    const [todaySchedules, activeQuizzes] = await Promise.all([
      // 1. Jadwal hari ini
      prisma.teachingSchedule.findMany({
        where: {
          dayOfWeek: currentDay,
          teachingContext: {
            classId,
            academicPeriodId,
          },
        },
        include: {
          teachingContext: {
            include: {
              subject: { select: { name: true } },
              teacherProfile: {
                include: {
                  user: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { startTime: "asc" },
      }),

      // 2. Kuis aktif rombel
      prisma.quiz.findMany({
        where: {
          status: "PUBLISHED",
          teachingContext: {
            classId,
            academicPeriodId,
          },
        },
        include: {
          teachingContext: {
            include: {
              subject: { select: { name: true } },
            },
          },
          attempts: {
            where: { studentId: student.id },
            select: {
              id: true,
              status: true,
              score: true,
            },
            take: 1,
          },
        },
        orderBy: [
          { deadline: "asc" },
          { createdAt: "desc" },
        ],
        take: 10,
      }),
    ]);

    // Format item jadwal hari ini & tentukan status LIVE
    const formattedSchedules: TodayScheduleItem[] = todaySchedules.map((s) => {
      const isLive = currentTime >= s.startTime && currentTime <= s.endTime;
      return {
        id: s.id,
        subjectName: s.teachingContext.subject.name,
        teacherName: s.teachingContext.teacherProfile.user.name || "Guru Pengampu",
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        isLive,
      };
    });

    // Format kuis mendesak
    const formattedQuizzes: UrgentQuizItem[] = activeQuizzes.map((q) => {
      const attempt = q.attempts[0];
      return {
        id: q.id,
        title: q.title,
        shareToken: q.shareToken,
        subjectName: q.teachingContext.subject.name,
        deadline: q.deadline ? q.deadline.toISOString() : null,
        durationMinutes: q.durationMinutes,
        isAttempted: !!attempt,
        attemptStatus: attempt ? (attempt.status as "IN_PROGRESS" | "SUBMITTED") : null,
        score: attempt?.score ? Number(attempt.score) : null,
      };
    });

    return {
      success: true,
      data: {
        student: {
          id: student.id,
          fullName: student.fullName,
          nis: student.nis || session.nis,
          schoolName: student.school.name,
          className: `${activeMembership.class.name} (${activeMembership.class.gradeLevel || "Kelas"})`,
          academicYear: activeMembership.academicPeriod.year,
        },
        today: {
          dayName: getDayNameIndonesia(currentDay),
          currentTime,
          schedules: formattedSchedules,
        },
        urgentQuizzes: formattedQuizzes,
        hasActivePeriod: true,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data beranda.",
    };
  }
}

export interface DayWeeklySchedule {
  dayOfWeek: number;
  dayName: string;
  items: TodayScheduleItem[];
}

/**
 * Mengambil jadwal mingguan lengkap (Senin - Sabtu) untuk rombel siswa.
 */
export async function getStudentWeeklyScheduleAction(): Promise<{
  success: boolean;
  data?: DayWeeklySchedule[];
  error?: string;
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid." };
    }

    const student = await prisma.student.findUnique({
      where: { id: session.studentId },
      include: {
        classMemberships: {
          include: {
            academicPeriod: { select: { status: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const activeMembership = student?.classMemberships.find(
      (cm) => cm.academicPeriod.status === "ACTIVE"
    ) || student?.classMemberships[0];

    if (!activeMembership) {
      return { success: true, data: [] };
    }

    const schedules = await prisma.teachingSchedule.findMany({
      where: {
        teachingContext: {
          classId: activeMembership.classId,
          academicPeriodId: activeMembership.academicPeriodId,
        },
      },
      include: {
        teachingContext: {
          include: {
            subject: { select: { name: true } },
            teacherProfile: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { dayOfWeek: "asc" },
        { startTime: "asc" },
      ],
    });

    const currentTime = getCurrentTimeString(new Date(), "Asia/Jakarta");
    const currentDay = getNormalizedDayOfWeek(new Date(), "Asia/Jakarta");

    // Kelompokkan hari 1 - 6 (Senin s/d Sabtu)
    const result: DayWeeklySchedule[] = [1, 2, 3, 4, 5, 6].map((day) => {
      const items = schedules
        .filter((s) => s.dayOfWeek === day)
        .map((s) => ({
          id: s.id,
          subjectName: s.teachingContext.subject.name,
          teacherName: s.teachingContext.teacherProfile.user.name || "Guru Pengampu",
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room,
          isLive: day === currentDay && currentTime >= s.startTime && currentTime <= s.endTime,
        }));

      return {
        dayOfWeek: day,
        dayName: getDayNameIndonesia(day),
        items,
      };
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat jadwal mingguan.",
    };
  }
}

/**
 * Ganti PIN Keamanan Siswa (Amendum B5 & Temuan F5).
 * Memvalidasi PIN lama via scrypt, menerapkan lockout bertingkat, update pinUpdatedAt,
 * dan menerbitkan ulang cookie sesi lokal dengan pinUpdatedAt baru agar siswa tidak terkunci sendiri.
 */
export async function changeStudentPinAction(data: {
  oldPin: string;
  newPin: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
    }

    if (!data.oldPin || !data.newPin) {
      return { success: false, error: "PIN lama dan PIN baru wajib diisi." };
    }

    if (!/^\d{4}$/.test(data.oldPin) || !/^\d{4}$/.test(data.newPin)) {
      return { success: false, error: "PIN harus berupa 4 digit angka." };
    }

    if (data.oldPin === data.newPin) {
      return { success: false, error: "PIN baru tidak boleh sama dengan PIN lama." };
    }

    const student = await prisma.student.findUnique({
      where: { id: session.studentId },
    });

    if (!student || !student.accessPinHash) {
      return { success: false, error: "Akun siswa belum dikonfigurasi PIN." };
    }

    const now = new Date();

    // Periksa lockout persisten
    if (student.lockedUntil && student.lockedUntil > now) {
      const rem = Math.ceil((student.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
      return {
        success: false,
        error: `Akun terkunci karena percobaan PIN salah. Tunggu ${rem} menit lagi.`,
      };
    }

    // Verifikasi PIN lama via scrypt
    const isOldPinValid = await verifyPin(data.oldPin, student.accessPinHash);

    if (!isOldPinValid) {
      const newFailed = student.failedAttempts + 1;
      let newLockedUntil: Date | null = null;

      if (newFailed >= 10) {
        newLockedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (newFailed >= 6) {
        newLockedUntil = new Date(now.getTime() + 60 * 60 * 1000);
      } else if (newFailed === 5) {
        newLockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
      }

      await prisma.student.update({
        where: { id: student.id },
        data: {
          failedAttempts: newFailed,
          lockedUntil: newLockedUntil,
        },
      });

      return {
        success: false,
        error: "PIN lama salah. Silakan periksa kembali.",
      };
    }

    // Hash PIN baru
    const newHash = await hashPin(data.newPin);

    // Update PIN dan pinUpdatedAt di DB (membatalkan sesi perangkat lain)
    const updated = await prisma.student.update({
      where: { id: student.id },
      data: {
        accessPinHash: newHash,
        pinUpdatedAt: now,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    const updatedIso = updated.pinUpdatedAt ? updated.pinUpdatedAt.toISOString() : now.toISOString();

    // F5 CRITICAL: Re-issue cookie sesi lokal dengan pinUpdatedAt baru agar siswa tidak terkunci sendiri!
    await setStudentSessionCookie({
      studentId: session.studentId,
      schoolId: session.schoolId,
      classId: session.classId,
      academicPeriodId: session.academicPeriodId,
      nis: session.nis,
      fullName: session.fullName,
      pinUpdatedAt: updatedIso,
    });

    return {
      success: true,
      message: "PIN keamanan berhasil diubah. Sesi di perangkat lain telah diakhiri.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Terjadi kesalahan saat mengubah PIN.",
    };
  }
}
