"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/superadmin";
import {
  createBugReport,
  listBugReports,
  getBugReportById,
  updateBugReport,
  CreateBugReportInput,
  UpdateBugReportInput,
} from "./bug-report.service";
import { BugReportCategory, BugReportPriority, BugReportStatus } from "@prisma/client";

/**
 * Action publik/terautentikasi untuk mengirim laporan bug dari mana saja
 */
export async function submitBugReportAction(payload: {
  title: string;
  description: string;
  category?: BugReportCategory;
  pageUrl?: string;
  deviceInfo?: string;
  attachmentUrls?: string[];
  reporterEmail?: string;
}): Promise<{ success: boolean; ticketNumber?: string; error?: string }> {
  try {
    if (!payload.title || !payload.title.trim()) {
      return { success: false, error: "Judul laporan wajib diisi." };
    }
    if (!payload.description || !payload.description.trim()) {
      return { success: false, error: "Deskripsi kendala wajib diisi." };
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    const report = await createBugReport({
      userId: session?.user?.id || null,
      reporterEmail: session?.user?.email || payload.reporterEmail || null,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      pageUrl: payload.pageUrl,
      deviceInfo: payload.deviceInfo,
      attachmentUrls: payload.attachmentUrls,
    });

    return { success: true, ticketNumber: report.ticketNumber };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengirim laporan tiket.",
    };
  }
}

/**
 * Superadmin action untuk melihat seluruh tiket
 */
export async function getBugReportsAdminAction(params?: {
  status?: BugReportStatus;
  category?: BugReportCategory;
  search?: string;
  page?: number;
  limit?: number;
}) {
  try {
    await requireSuperAdmin();
    const result = await listBugReports(params);
    return { success: true, data: result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Akses ditolak.",
    };
  }
}

/**
 * Superadmin action untuk update status/prioritas/catatan tiket
 */
export async function updateBugReportAdminAction(
  id: string,
  payload: UpdateBugReportInput
) {
  try {
    await requireSuperAdmin();
    const updated = await updateBugReport(id, payload);
    return { success: true, data: updated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memperbarui tiket.",
    };
  }
}

/**
 * Superadmin action untuk detail tiket
 */
export async function getBugReportDetailAdminAction(id: string) {
  try {
    await requireSuperAdmin();
    const detail = await getBugReportById(id);
    if (!detail) {
      return { success: false, error: "Tiket tidak ditemukan." };
    }
    return { success: true, data: detail };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal memuat detail tiket.",
    };
  }
}
