import Link from "next/link";
import { ArrowLeft, ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { getSubmissionQueueAction } from "@/modules/assignments/assignment.actions";
import { ReviewSubmissionForm } from "./ReviewSubmissionForm";
import { SaveAsAssessmentDialog } from "@/components/assignments/SaveAsAssessmentDialog";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default async function SubmissionQueuePage({
  params,
}: {
  params: Promise<{ teachingContextId: string; assignmentId: string }>;
}) {
  const { teachingContextId, assignmentId } = await params;
  await verifyTeachingContextAccess(teachingContextId);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, teachingContextId },
    select: {
      id: true,
      title: true,
      dueDate: true,
      teachingContext: { select: { subject: { select: { name: true } } } },
    },
  });

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

  // Satu sumber kebenaran antrean: action yang sama dipakai test & API.
  const submissions = await getSubmissionQueueAction(teachingContextId, assignmentId);

  const assessmentTypes = await prisma.assessmentType.findMany({
    where: { teachingContextId },
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });

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
            Antrean Koreksi — {assignment.title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {assignment.teachingContext.subject.name}
            {assignment.dueDate &&
              ` • Tenggat ${format(assignment.dueDate, "dd MMM yyyy", { locale: id })}`}
            {` • ${pendingCount} menunggu koreksi • ${gradedCount} telah dinilai dari ${submissions.length} pengumpulan`}
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

      {submissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada siswa yang mengumpulkan tugas ini.
        </p>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div key={s.id} className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-medium text-sm">
                    {s.studentName}
                    {s.nis && (
                      <span className="ml-2 text-xs text-muted-foreground">NIS {s.nis}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Dikumpulkan {format(s.submittedAt, "dd MMM yyyy, HH:mm", { locale: id })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.isLate && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                      Terlambat
                    </span>
                  )}
                  <span
                    className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                      s.status === "SUBMITTED"
                        ? "text-amber-700 bg-amber-50 border-amber-200"
                        : "text-emerald-700 bg-emerald-50 border-emerald-200"
                    }`}
                  >
                    {s.status === "SUBMITTED" ? "Menunggu" : "Dinilai"}
                  </span>
                </div>
              </div>

              {(s.textContent || s.linkUrl) && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                  {s.textContent && (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{s.textContent}</p>
                  )}
                  {s.linkUrl && (
                    <a
                      href={s.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline"
                    >
                      {s.linkUrl}
                    </a>
                  )}
                </div>
              )}

              <ReviewSubmissionForm teachingContextId={teachingContextId} item={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}