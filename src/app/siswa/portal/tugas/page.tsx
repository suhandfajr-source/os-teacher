import React from "react";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { prisma } from "@/lib/auth";
import { ClipboardList, Clock, BookOpen, AlertCircle } from "lucide-react";
import { SubmitAssignmentForm } from "@/components/student/SubmitAssignmentForm";
import { isSubmissionLate, type StudentSubmissionView } from "@/modules/assignments/submission.service";

export default async function StudentAssignmentsPage() {
  const session = await verifyStudentSession();
  if (!session) return null;

  const student = await prisma.student.findUnique({
    where: { id: session.studentId },
    include: {
      classMemberships: {
        include: {
          academicPeriod: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const activeMembership = student?.classMemberships.find(
    (cm) => cm.academicPeriod.status === "ACTIVE"
  ) || student?.classMemberships[0];

  let assignments: any[] = [];
  if (activeMembership) {
    assignments = await prisma.assignment.findMany({
      where: {
        teachingContext: {
          classId: activeMembership.classId,
          academicPeriodId: activeMembership.academicPeriodId,
        },
        status: "ACTIVE",
      },
      include: {
        teachingContext: {
          include: {
            subject: { select: { name: true } },
            teacherProfile: {
              include: {
                user: { select: { name: true } },
              },
            },
          },
        },
        submissions: {
          where: { studentId: session.studentId },
        },
      },
      orderBy: [
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      take: 20,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4 text-[#0F766E]" />
          <span>Daftar Tugas Mandiri</span>
        </h1>
        <p className="text-[11px] text-slate-500">
          Tugas kelas yang diberikan oleh guru pengampu
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="p-8 bg-white rounded-3xl border border-slate-200/80 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">Belum Ada Tugas</h4>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
            Tidak ada tugas aktif yang perlu dikumpulkan untuk rombelmu saat ini.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map((item) => (
            <div
              key={item.id}
              className="p-3.5 bg-white rounded-2xl border border-slate-200/80 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                  {item.teachingContext.subject.name}
                </span>
                {item.dueDate && (
                  <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Batas: {new Date(item.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
              <h3 className="text-xs font-bold text-slate-900 leading-tight">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              )}
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
                <span>Guru: {item.teachingContext.teacherProfile.user.name}</span>
              </div>
              <SubmitAssignmentForm
                assignmentId={item.id}
                dueDateIso={item.dueDate ? new Date(item.dueDate).toISOString() : null}
                submission={
                  item.submissions[0]
                    ? ({
                        id: item.submissions[0].id,
                        assignmentId: item.submissions[0].assignmentId,
                        status: item.submissions[0].status,
                        textContent: item.submissions[0].textContent,
                        linkUrl: item.submissions[0].linkUrl,
                        feedback: item.submissions[0].feedback,
                        score: item.submissions[0].score,
                        submittedAt: item.submissions[0].submittedAt.toISOString(),
                        reviewedAt: item.submissions[0].reviewedAt?.toISOString() ?? null,
                        isLate: isSubmissionLate(
                          item.submissions[0].submittedAt,
                          item.dueDate
                        ),
                      } satisfies StudentSubmissionView)
                    : null
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
