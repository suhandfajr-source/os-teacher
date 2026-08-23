import { NextRequest, NextResponse } from "next/server";
import {
  getTeachingJournalReport,
  getAttendanceRecapReport,
  getScoreRecapReport,
  getMonitoringReport,
  getAcademicCoverageReport,
} from "@/modules/reporting/reporting.actions";
import {
  exportTeachingJournalToXlsx,
  exportAttendanceRecapToXlsx,
  exportScoreRecapToXlsx,
  exportMonitoringReportToXlsx,
  exportAcademicCoverageToXlsx,
} from "@/modules/reporting/reporting.export";
import { generateSafeExportFilename } from "@/modules/reporting/reporting.service";
import { verifyTeachingContextAccess } from "@/lib/authorization";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const contextId = searchParams.get("contextId");
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const studentSearch = searchParams.get("studentSearch") || undefined;

    if (!type || !contextId) {
      return NextResponse.json({ error: "Missing required parameters: type and contextId" }, { status: 400 });
    }

    // Server-side authorization check
    const { context } = await verifyTeachingContextAccess(contextId);

    let buffer: Buffer;
    let filename: string;

    switch (type.toUpperCase()) {
      case "JOURNAL": {
        const data = await getTeachingJournalReport(context.id, { startDate, endDate });
        buffer = exportTeachingJournalToXlsx(data);
        filename = generateSafeExportFilename("jurnal_mengajar", `${data.contextInfo.className}_${data.contextInfo.subjectName}`);
        break;
      }
      case "ATTENDANCE": {
        const data = await getAttendanceRecapReport(context.id, { startDate, endDate, studentSearch });
        buffer = exportAttendanceRecapToXlsx(data);
        filename = generateSafeExportFilename("rekap_presensi", `${data.contextInfo.className}_${data.contextInfo.subjectName}`);
        break;
      }
      case "SCORE": {
        const data = await getScoreRecapReport(context.id, { studentSearch });
        buffer = exportScoreRecapToXlsx(data);
        filename = generateSafeExportFilename("rekap_nilai", `${data.contextInfo.className}_${data.contextInfo.subjectName}`);
        break;
      }
      case "MONITORING": {
        const data = await getMonitoringReport(context.id, { studentSearch });
        buffer = exportMonitoringReportToXlsx(data);
        filename = generateSafeExportFilename("rekap_monitoring", `${data.contextInfo.className}_${data.contextInfo.subjectName}`);
        break;
      }
      case "COVERAGE": {
        const data = await getAcademicCoverageReport(context.id);
        buffer = exportAcademicCoverageToXlsx(data);
        filename = generateSafeExportFilename("cakupan_akademik", `${data.contextInfo.className}_${data.contextInfo.subjectName}`);
        break;
      }
      default:
        return NextResponse.json({ error: `Unsupported report type: ${type}` }, { status: 400 });
    }

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message.includes("Forbidden") || message.includes("Unauthorized") || message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
