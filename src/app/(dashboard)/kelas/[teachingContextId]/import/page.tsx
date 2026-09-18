import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import Link from "next/link";
import { Sparkles } from "lucide-react";
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

  try {
    await verifyTeachingContextAccess(teachingContextId);
  } catch {
    redirect("/kelas");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Pusat Impor Data Excel
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unggah data siswa, rekap presensi, dan riwayat nilai via spreadsheet.
          </p>
        </div>
        <Link
          href="/onboarding/mid-semester"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Panduan Onboarding
        </Link>
      </div>

      <ImportHub teachingContextId={teachingContextId} />
    </div>
  );
}

