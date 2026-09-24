"use server";

import { prisma } from "@/lib/auth";
import { verifyStudentSession } from "@/modules/student-auth/student-session";

/**
 * Story 8 — aksi baca daftar materi LEARNING_MATERIAL published untuk rombel
 * periode aktif siswa. Satu sumber kebenaran: dipakai halaman /siswa/portal/materi
 * dan int test — mencegah duplikasi query halaman vs test.
 */
interface PublishedMaterialItem {
  id: string;
  title: string;
  content: string;
  publishedAt: string; // ISO
  subjectName: string | null;
  teacherName: string | null;
}

export async function getPublishedMaterialsAction(): Promise<{
  success: boolean;
  error?: string;
  materials?: PublishedMaterialItem[];
}> {
  try {
    const session = await verifyStudentSession();
    if (!session) {
      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
    }

    const student = await prisma.student.findUnique({
      where: { id: session.studentId },
      include: {
        classMemberships: {
          include: { academicPeriod: { select: { status: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const activeMembership = student?.classMemberships.find(
      (cm) => cm.academicPeriod.status === "ACTIVE"
    );

    if (!activeMembership) {
      return { success: true, materials: [] };
    }

    const rows = await prisma.aiContentDraft.findMany({
      where: {
        contentType: "LEARNING_MATERIAL",
        status: "ACTIVE",
        publishedAt: { not: null },
        teachingContext: {
          classId: activeMembership.classId,
          academicPeriodId: activeMembership.academicPeriodId,
        },
      },
      select: {
        id: true,
        title: true,
        content: true,
        publishedAt: true,
        teachingContext: {
          select: {
            subject: { select: { name: true } },
            teacherProfile: { select: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { publishedAt: "desc" },
    });

    return {
      success: true,
      materials: rows.map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        publishedAt: r.publishedAt!.toISOString(),
        subjectName: r.teachingContext?.subject.name ?? null,
        teacherName: r.teachingContext?.teacherProfile?.user?.name ?? null,
      })),
    };
  } catch (err) {
    console.error("[getPublishedMaterialsAction]", err);
    return { success: false, error: "Gagal memuat materi." };
  }
}
