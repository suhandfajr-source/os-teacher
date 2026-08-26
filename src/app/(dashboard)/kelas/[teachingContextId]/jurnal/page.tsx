import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default async function JurnalPage({ params }: { params: Promise<{ teachingContextId: string }> }) {
  const { teachingContextId } = await params;
  await verifyTeachingContextAccess(teachingContextId);

  const sessions = await prisma.teachingSession.findMany({
    where: { teachingContextId, status: "COMPLETED" },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Jurnal Mengajar</h2>
      </div>

      <div className="bg-white rounded-md border overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topik Aktual</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ringkasan Kegiatan</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                  Belum ada jurnal dari sesi yang selesai.
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(session.date), "dd MMM yyyy", { locale: id })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {session.actualTopic || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {session.activitySummary || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
