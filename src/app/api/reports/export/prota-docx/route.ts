import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { exportProtaToDocx } from "@/modules/academic/academic.export";
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

    const profile = await prisma.academicContextProfile.findUnique({
      where: { teachingContextId: context.id },
    });

    // Prioritize active PROSEM items, fallback to PROTA if none exist
    let planItems = await prisma.academicPlanItem.findMany({
      where: {
        teachingContextId: context.id,
        planType: AcademicPlanType.PROSEM,
        status: EntityStatus.ACTIVE,
      },
      orderBy: [{ targetSemester: "asc" }, { orderIndex: "asc" }],
    });

    if (planItems.length === 0) {
      planItems = await prisma.academicPlanItem.findMany({
        where: {
          teachingContextId: context.id,
          planType: AcademicPlanType.PROTA,
          status: EntityStatus.ACTIVE,
        },
        orderBy: [{ targetSemester: "asc" }, { orderIndex: "asc" }],
      });
    }

    const hoursPerWeek = profile?.hoursPerWeek || 3;
    const effectiveWeeks =
      semester === 1 ? profile?.effectiveWeeksSem1 || 18 : profile?.effectiveWeeksSem2 || 16;

    const buffer = await exportProtaToDocx({
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
      "PROTA",
      `${fullContext.class.name}_${fullContext.subject.name}`
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });
  } catch (error: unknown) {
    console.error("[Export Prota Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export PROTA" },
      { status: 500 }
    );
  }
}
