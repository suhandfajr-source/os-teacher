import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import ImportHub from "./ImportHub";

export default async function ImportSiswaPage({
  params,
}: {
  params: Promise<{ teachingContextId: string }> | { teachingContextId: string };
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const resolvedParams = await params;
  const teachingContextId = resolvedParams.teachingContextId;

  let authResult;
  try {
    authResult = await verifyTeachingContextAccess(teachingContextId);
  } catch {
    redirect("/kelas");
  }

  const { context } = authResult;

  const fullContext = await prisma.teachingContext.findUnique({
    where: { id: context.id },
    include: {
      class: true,
      subject: true,
      academicPeriod: true,
    },
  });

  if (!fullContext) redirect("/kelas");

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <Link
          href={`/kelas/${teachingContextId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Detail Kelas
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Pusat Impor Data — {fullContext.class.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              Mata Pelajaran: <span className="font-semibold text-slate-800">{fullContext.subject.name}</span> | Periode:{" "}
              <span className="font-semibold text-slate-800">
                {fullContext.academicPeriod.year} {fullContext.academicPeriod.semester}
              </span>
            </p>
          </div>
          <Link
            href="/onboarding/mid-semester"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Panduan Onboarding Mid-Semester
          </Link>
        </div>
      </div>

      <ImportHub teachingContextId={teachingContextId} />
    </div>
  );
}
