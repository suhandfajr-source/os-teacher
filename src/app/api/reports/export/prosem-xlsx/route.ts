import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { exportProsemToXlsx } from "@/modules/academic/academic.export";
import { generateSafeExportFilename } from "@/modules/reporting/reporting.service";
import { EntityStatus, AcademicPlanType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contextId = searchParams.get("contextId");
    const semester = parseInt(searchParams.get("semester") || "1") || 1;

    if (!contextId) {
      return NextResponse.json({ error: "Missing contextId" }, { status: 400 });
    }

    const { context } = await verifyTeachingContextAccess(contextId);

    const fullContext = await prisma.teachingContext.findUnique({
      where: { id: context.id },
      include: {
        school: true,
        class: true,
        subject: true,
        academicPeriod: true,
        teacherProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!fullContext) {
      return NextResponse.json({ error: "Context not found" }, { status: 404 });
    }

    const [profile, planItems] = await Promise.all([
      prisma.academicContextProfile.findUnique({
        where: { teachingContextId: context.id },
      }),
      prisma.academicPlanItem.findMany({
        where: {
          teachingContextId: context.id,
          planType: AcademicPlanType.PROSEM,
          targetSemester: semester,
          status: EntityStatus.ACTIVE,
        },
        orderBy: { orderIndex: "asc" },
      }),
    ]);

    const hoursPerWeek = profile?.hoursPerWeek || 3;
    const effectiveWeeks =
      semester === 1 ? profile?.effectiveWeeksSem1 || 18 : profile?.effectiveWeeksSem2 || 16;

    const buffer = await exportProsemToXlsx({
      schoolName: fullContext.school.name,
      className: fullContext.class.name,
      subjectName: fullContext.subject.name,
      academicYear: fullContext.academicPeriod.year,
      teacherName: fullContext.teacherProfile.preferredName || fullContext.teacherProfile.user.name || "Guru",
      curriculumName: profile?.curriculumName || "Kurikulum Merdeka",
      semester,
      hoursPerWeek,
      effectiveWeeks,
      items: planItems as any,
    });

    const filename = generateSafeExportFilename(
      `PROSEM_SEM${semester}`,
      `${fullContext.class.name}_${fullContext.subject.name}`
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    console.error("[Export Prosem Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export PROSEM" },
      { status: 500 }
    );
  }
}
