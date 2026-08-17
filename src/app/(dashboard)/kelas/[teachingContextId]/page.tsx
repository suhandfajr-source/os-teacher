import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import RosterManager from "./RosterManager";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function KelasDetailPage({ params }: { params: { teachingContextId: string } }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) redirect("/login");

  const { teachingContextId } = await params;

  // We use the authorization helper to verify access and get context details
  let authResult;
  try {
    authResult = await verifyTeachingContextAccess(teachingContextId);
  } catch (error) {
    redirect("/kelas"); // Redirect if not authorized
  }

  const { context } = authResult;

  // Fetch full context details
  const fullContext = await prisma.teachingContext.findUnique({
    where: { id: context.id },
    include: {
      subject: true,
      class: true,
      academicPeriod: true
    }
  });

  if (!fullContext) redirect("/kelas");

  // Fetch roster
  const roster = await prisma.classStudent.findMany({
    where: {
      classId: fullContext.classId,
      academicPeriodId: fullContext.academicPeriodId,
      student: {
        status: "ACTIVE"
      }
    },
    include: {
      student: true
    },
    orderBy: {
      student: { fullName: "asc" }
    }
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <Link href="/kelas" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Daftar Kelas
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{fullContext.class.name}</h1>
        <p className="text-muted-foreground mt-2">
          {fullContext.subject.name} &bull; {fullContext.academicPeriod.year} {fullContext.academicPeriod.semester}
        </p>
      </div>

      <RosterManager 
        teachingContextId={teachingContextId} 
        classId={fullContext.classId}
        academicPeriodId={fullContext.academicPeriodId}
        initialRoster={roster} 
      />
    </div>
  );
}
