import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ImportSiswaFlow from "./ImportSiswaFlow";

export default async function ImportSiswaPage({ params }: { params: { teachingContextId: string } }) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) redirect("/login");

  const { teachingContextId } = await params;

  let authResult;
  try {
    authResult = await verifyTeachingContextAccess(teachingContextId);
  } catch (error) {
    redirect("/kelas");
  }

  const { context } = authResult;

  const fullContext = await prisma.teachingContext.findUnique({
    where: { id: context.id },
    include: {
      class: true,
      academicPeriod: true
    }
  });

  if (!fullContext) redirect("/kelas");

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div>
        <Link href={`/kelas/${teachingContextId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Detail Kelas
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Import Siswa ke Kelas {fullContext.class.name}</h1>
        <p className="text-muted-foreground mt-2">
          Unggah file Excel (XLSX) untuk menambahkan siswa secara massal ke kelas ini.
        </p>
      </div>

      <ImportSiswaFlow teachingContextId={teachingContextId} />
    </div>
  );
}
