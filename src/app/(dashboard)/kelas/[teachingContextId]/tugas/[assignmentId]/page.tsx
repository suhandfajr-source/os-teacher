import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { getSubmissionQueueAction } from "@/modules/assignments/assignment.actions";
import { SaveAsAssessmentDialog } from "@/components/assignments/SaveAsAssessmentDialog";
import {
  AssignmentRosterGradingView,
  type StudentRosterItem,
} from "./AssignmentRosterGradingView";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default async function SubmissionQueuePage({
  params,
}: {
  params: Promise<{ teachingContextId: string; assignmentId: string }>;
}) {
  const { teachingContextId, assignmentId } = await params;
  await verifyTeachingContextAccess(teachingContextId);

  const [assignment, context] = await Promise.all([
    prisma.assignment.findFirst({
      where: { id: assignmentId, teachingContextId },
      select: {
        id: true,
        title: true,
        dueDate: true,
        teachingContext: { select: { subject: { select: { name: true } }, class: { select: { name: true } } } },
      },
    }),
    prisma.teachingContext.findUnique({
      where: { id: teachingContextId },
      select: { classId: true, academicPeriodId: true },
    }),
  ]);

  if (!assignment) {
    return (
      <div className="space-y-4">
        <Link
          href={`/kelas/${teachingContextId}/tugas`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Tugas
        </Link>
        <p className="text-sm text-muted-foreground">Tugas tidak ditemukan.</p>
      </div>
    );
  }

  // Ambil data antrean submission dan daftar siswa di kelas
  const [submissions, assessmentTypes, rosterRaw] = await Promise.all([
    getSubmissionQueueAction(teachingContextId, assignmentId),
    prisma.assessmentType.findMany({
      where: { teachingContextId },
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
    }),
    context
      ? prisma.classStudent.findMany({
          where: {
            classId: context.classId,
            academicPeriodId: context.academicPeriodId,
          },
          include: {
            student: { select: { id: true, fullName: true, nis: true } },
          },
          orderBy: {
            student: { fullName: "asc" },
          },
        })
      : [],
  ]);

  const roster: StudentRosterItem[] = rosterRaw.map((r) => ({
    id: r.student.id,
    fullName: r.student.fullName,
    nis: r.student.nis,
  }));

  const pendingCount = submissions.filter((s) => s.status === "SUBMITTED").length;
  const gradedCount = submissions.filter((s) => s.status === "REVIEWED" && s.score !== null).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b">
        <div>
          <Link
            href={`/kelas/${teachingContextId}/tugas`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-fit mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Tugas
          </Link>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-teal-600" />
            Penilaian Tugas — {assignment.title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {assignment.teachingContext.subject.name} • {assignment.teachingContext.class.name}
            {assignment.dueDate &&
              ` • Tenggat ${format(assignment.dueDate, "dd MMM yyyy", { locale: id })}`}
            {` • ${pendingCount} menunggu koreksi online • ${gradedCount} telah dinilai dari ${roster.length} siswa`}
          </p>
        </div>

        {gradedCount > 0 && (
          <div className="shrink-0">
            <SaveAsAssessmentDialog
              teachingContextId={teachingContextId}
              assignmentId={assignmentId}
              defaultTitle={`Tugas: ${assignment.title}`}
              gradedCount={gradedCount}
              assessmentTypes={assessmentTypes}
            />
          </div>
        )}
      </div>

      <AssignmentRosterGradingView
        teachingContextId={teachingContextId}
        assignmentId={assignmentId}
        roster={roster}
        submissions={submissions}
      />
    </div>
  );
}