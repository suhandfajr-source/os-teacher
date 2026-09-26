import { z } from "zod";

/**
 * Helper normalisasi waktu (contoh: "7:30" -> "07:30")
 */
export function normalizeTime(val: string): string {
  if (typeof val !== "string") return "";
  const parts = val.trim().split(":");
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    return `${h}:${m}`;
  }
  return val.trim();
}

export const CreateScheduleSlotSchema = z
  .object({
    teachingContextId: z.string().min(1, "Konteks mengajar wajib diisi"),
    dayOfWeek: z
      .number({ message: "Hari wajib dipilih" })
      .int("Hari harus berupa angka")
      .min(1, "Hari minimal Senin (1)")
      .max(7, "Hari maksimal Minggu (7)"),
    startTime: z
      .string()
      .transform(normalizeTime)
      .pipe(
        z
          .string()
          .regex(
            /^([01]\d|2[0-3]):([0-5]\d)$/,
            "Format jam mulai harus HH:mm (contoh: 07:30)"
          )
      ),
    endTime: z
      .string()
      .transform(normalizeTime)
      .pipe(
        z
          .string()
          .regex(
            /^([01]\d|2[0-3]):([0-5]\d)$/,
            "Format jam selesai harus HH:mm (contoh: 09:00)"
          )
      ),
    room: z
      .string()
      .max(50, "Nama ruangan maksimal 50 karakter")
      .optional()
      .nullable(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "Jam selesai harus lebih akhir daripada jam mulai",
    path: ["endTime"],
  });

export type CreateScheduleSlotInput = z.infer<typeof CreateScheduleSlotSchema>;
