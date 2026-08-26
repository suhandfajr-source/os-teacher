import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function PertemuanPage({ params }: { params: Promise<{ teachingContextId: string }> }) {
  const { teachingContextId } = await params;
  await verifyTeachingContextAccess(teachingContextId);

  const sessions = await prisma.teachingSession.findMany({
    where: { teachingContextId },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Daftar Pertemuan</h2>
        <Link href={`/hari-ini`} className={buttonVariants()}>
          Mulai Sesi Baru
        </Link>
      </div>

      <div className="bg-white rounded-md border">
        {sessions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Belum ada pertemuan. Mulai sesi mengajar dari menu Hari Ini.
          </div>
        ) : (
          <ul className="divide-y">
            {sessions.map((session) => (
              <li key={session.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-lg">
                    {format(new Date(session.date), "EEEE, dd MMM yyyy", { locale: id })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Status: {session.status === "COMPLETED" ? "Selesai" : "Sedang Berlangsung"}
                  </p>
                  <p className="text-sm mt-1">
                    Topik: {session.actualTopic || session.plannedTopic || "-"}
                  </p>
                </div>
                  <Link href={`/kelas/${teachingContextId}/pertemuan/${session.id}`} className={buttonVariants({ variant: "outline" })}>
                    Lihat Detail
                  </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
