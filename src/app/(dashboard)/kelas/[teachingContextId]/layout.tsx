import { auth, prisma } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KelasTabs from "./KelasTabs";

export default async function KelasLayout(props: { params: Promise<{ teachingContextId: string }>; children: React.ReactNode }) {
  const params = await props.params;
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session) redirect("/login");

  let authResult;
  try {
    authResult = await verifyTeachingContextAccess(params.teachingContextId);
  } catch (error) {
    redirect("/kelas"); 
  }

  const { context } = authResult;

  const fullContext = await prisma.teachingContext.findUnique({
    where: { id: context.id },
    include: {
      subject: true,
      class: true,
      academicPeriod: true
    }
  });

  if (!fullContext) redirect("/kelas");

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

      <KelasTabs teachingContextId={params.teachingContextId} />
      
      <div className="pt-4">
        {props.children}
      </div>
    </div>
  );
}
