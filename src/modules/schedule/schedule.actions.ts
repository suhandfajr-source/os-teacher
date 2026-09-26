"use server";

import { prisma } from "@/lib/auth";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { CreateScheduleSlotSchema, CreateScheduleSlotInput } from "./schedule.schema";
import { getNormalizedDayOfWeek, getCurrentTimeString } from "@/lib/schedule-date-utils";
import { revalidatePath } from "next/cache";

/**
 * Mengambil seluruh slot jadwal mingguan untuk satu konteks mengajar.
 */
export async function getTeachingSchedulesAction(teachingContextId: string) {
  await verifyTeachingContextAccess(teachingContextId);

  return await prisma.teachingSchedule.findMany({
    where: { teachingContextId },
    orderBy: [
      { dayOfWeek: "asc" },
      { startTime: "asc" },
    ],
  });
}

/**
 * Menambahkan 1 slot jadwal baru dengan proteksi Anti-Collision (mencegah benturan jam mengajar guru).
 */
export async function createScheduleSlotAction(input: CreateScheduleSlotInput) {
  const parsed = CreateScheduleSlotSchema.parse(input);
  const { context, profile } = await verifyTeachingContextAccess(parsed.teachingContextId);

  // 1. Ambil seluruh jadwal mengajar guru pada hari yang sama di seluruh kelas pada sekolah aktif & periode yang sama
  const existingSchedules = await prisma.teachingSchedule.findMany({
    where: {
      dayOfWeek: parsed.dayOfWeek,
      teachingContext: {
        teacherProfileId: profile.id,
        schoolId: context.schoolId,
        academicPeriodId: context.academicPeriodId,
      },
    },
    include: {
      teachingContext: {
        include: { class: true, subject: true },
      },
    },
  });

  // 2. Evaluasi Overlap Anti-Collision: (newStart < existingEnd) && (newEnd > existingStart)
  const collision = existingSchedules.find((s) => {
    return parsed.startTime < s.endTime && parsed.endTime > s.startTime;
  });

  if (collision) {
    throw new Error(
      `Benturan Jadwal: Anda sudah memiliki jadwal mengajar ${collision.teachingContext.subject.name} (${collision.teachingContext.class.name}) pada jam ${collision.startTime} - ${collision.endTime}.`
    );
  }

  // 3. Simpan slot jadwal baru
  const slot = await prisma.teachingSchedule.create({
    data: {
      teachingContextId: parsed.teachingContextId,
      dayOfWeek: parsed.dayOfWeek,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      room: parsed.room || null,
    },
  });

  revalidatePath(`/kelas/${parsed.teachingContextId}`);
  revalidatePath(`/kelas`);
  revalidatePath(`/hari-ini`);
  revalidatePath(`/pengaturan/setup`);
  revalidatePath(`/`);

  return slot;
}

/**
 * Menghapus 1 slot jadwal dengan verifikasi Anti-IDOR.
 */
export async function deleteScheduleSlotAction(scheduleId: string) {
  const schedule = await prisma.teachingSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) {
    throw new Error("Slot jadwal tidak ditemukan");
  }

  // Otorisasi: Verifikasi akses guru ke konteks mengajar pemilik jadwal
  await verifyTeachingContextAccess(schedule.teachingContextId);

  await prisma.teachingSchedule.delete({
    where: { id: scheduleId },
  });

  revalidatePath(`/kelas/${schedule.teachingContextId}`);
  revalidatePath(`/kelas`);
  revalidatePath(`/hari-ini`);
  revalidatePath(`/pengaturan/setup`);
  revalidatePath(`/`);

  return { success: true };
}

export type ScheduleStreamStatus =
  | "UPCOMING"
  | "TIME_TO_TEACH"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "MISSED";

export type TodayScheduleItem = {
  scheduleId: string;
  teachingContextId: string;
  subjectName: string;
  className: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  status: ScheduleStreamStatus;
  session: {
    id: string;
    status: string;
    actualTopic: string | null;
  } | null;
};

/**
 * Mengambil stream jadwal mengajar hari ini untuk Beranda & Menu Hari Ini.
 */
export async function getTodayScheduleStreamAction(): Promise<{
  todayDayOfWeek: number;
  currentTime: string;
  items: TodayScheduleItem[];
}> {
  const authContext = await getRscAuthContext();
  const { profile, activeSchoolId } = authContext;

  if (!activeSchoolId) {
    return { todayDayOfWeek: 1, currentTime: "00:00", items: [] };
  }

  const currentDay = getNormalizedDayOfWeek(new Date());
  const currentTime = getCurrentTimeString(new Date());

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Ambil seluruh jadwal hari ini milik guru di sekolah aktif
  const schedules = await prisma.teachingSchedule.findMany({
    where: {
      dayOfWeek: currentDay,
      teachingContext: {
        teacherProfileId: profile.id,
        schoolId: activeSchoolId,
      },
    },
    include: {
      teachingContext: {
        include: {
          class: true,
          subject: true,
          academicPeriod: true,
        },
      },
      teachingSessions: {
        where: {
          date: { gte: todayStart },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { startTime: "asc" },
  });

  // Petakan status real-time untuk setiap slot jadwal
  const streamItems: TodayScheduleItem[] = schedules.map((slot) => {
    const activeSession = slot.teachingSessions[0] || null;
    let status: ScheduleStreamStatus = "UPCOMING";

    if (activeSession) {
      status = activeSession.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
    } else {
      if (currentTime >= slot.startTime && currentTime <= slot.endTime) {
        status = "TIME_TO_TEACH";
      } else if (currentTime > slot.endTime) {
        status = "MISSED";
      } else {
        status = "UPCOMING";
      }
    }

    return {
      scheduleId: slot.id,
      teachingContextId: slot.teachingContextId,
      subjectName: slot.teachingContext.subject.name,
      className: slot.teachingContext.class.name,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      status,
      session: activeSession
        ? {
            id: activeSession.id,
            status: activeSession.status,
            actualTopic: activeSession.actualTopic,
          }
        : null,
    };
  });

  return {
    todayDayOfWeek: currentDay,
    currentTime,
    items: streamItems,
  };
}
