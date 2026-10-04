"use server";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/superadmin";
import {
  getKlassaPulseAnalytics,
  seedPulseDemoData,
} from "./pulse.service";
import { KlassaPulseAnalyticsResponse } from "./pulse.types";

const PulseAnalyticsQuerySchema = z.object({
  period: z
    .string()
    .regex(/^\d{4}-(W\d{2}|\d{2})$/, "Format periode harus YYYY-MM atau YYYY-Www")
    .optional(),
  schoolId: z.string().optional(),
});

/**
 * Server Action: Mengambil seluruh analitik makro Klassa Pulse untuk Superadmin
 */
export async function getKlassaPulseAnalyticsAction(params?: {
  period?: string;
  schoolId?: string;
}): Promise<{
  success: boolean;
  data?: KlassaPulseAnalyticsResponse;
  error?: string;
}> {
  try {
    // 1. Verifikasi Superadmin
    await requireSuperAdmin();

    // 2. Validasi Input Parameter (m-01)
    const validated = PulseAnalyticsQuerySchema.parse(params || {});

    const result = await getKlassaPulseAnalytics(
      validated.period,
      validated.schoolId
    );

    return {
      success: true,
      data: result,
    };
  } catch (err: unknown) {
    console.error("getKlassaPulseAnalyticsAction error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Gagal memuat data analitik Klassa Pulse.",
    };
  }
}

/**
 * Server Action: Seeding sampel data realistis Klassa Pulse (khusus Superadmin)
 */
export async function seedKlassaPulseDemoDataAction(schoolId?: string): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    await requireSuperAdmin();

    const res = await seedPulseDemoData(schoolId);

    return {
      success: true,
      count: res.count,
    };
  } catch (err: unknown) {
    console.error("seedKlassaPulseDemoDataAction error:", err);
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Gagal melakukan seeding data sampel Klassa Pulse.",
    };
  }
}
