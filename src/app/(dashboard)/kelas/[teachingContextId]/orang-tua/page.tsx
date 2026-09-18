import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";

import { TeacherParentAccessManager } from "./TeacherParentAccessManager";
import { getTeacherParentAccessList, getTeacherParentInvitationList } from "@/modules/parent/parent.service";

interface PageProps {
  params: Promise<{
    teachingContextId: string;
  }>;
}

export default async function TeacherParentAccessPage({ params }: PageProps) {
  const { teachingContextId } = await params;
  const { context } = await verifyTeachingContextAccess(teachingContextId);

  // 1. Fetch current active roster students
  const classStudents = await prisma.classStudent.findMany({
    where: {
      classId: context.classId,
      academicPeriodId: context.academicPeriodId,
    },
    include: {
      student: true,
    },
    orderBy: {
      student: {
        fullName: "asc",
      },
    },
  });

  const rosterStudents = classStudents.map((cs) => ({
    id: cs.student.id,
    fullName: cs.student.fullName,
    nis: cs.student.nis,
  }));

  // 2. Fetch existing accesses and invitations
  const accesses = await getTeacherParentAccessList(teachingContextId);
  const invitations = await getTeacherParentInvitationList(teachingContextId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 pb-1 border-b">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Akses & Undangan Akun Orang Tua</h2>
        <p className="text-muted-foreground text-xs">
          Kelola tautan undangan dan hak akses portal orang tua untuk memantau kehadiran dan hasil pembelajaran siswa.
        </p>
      </div>

      <TeacherParentAccessManager
        teachingContextId={teachingContextId}
        rosterStudents={rosterStudents}
        initialAccesses={accesses}
        initialInvitations={invitations}
      />
    </div>
  );
}
