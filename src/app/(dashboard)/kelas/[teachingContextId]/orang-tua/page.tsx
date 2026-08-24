import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import KelasTabs from "../KelasTabs";
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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Manajemen Akses Orang Tua</h1>
        <p className="text-muted-foreground text-sm">
          Kelola tautan undangan dan hak akses orang tua untuk memantau kehadiran dan hasil pembelajaran siswa.
        </p>
      </div>

      <KelasTabs teachingContextId={teachingContextId} />

      <TeacherParentAccessManager
        teachingContextId={teachingContextId}
        rosterStudents={rosterStudents}
        initialAccesses={accesses}
        initialInvitations={invitations}
      />
    </div>
  );
}
