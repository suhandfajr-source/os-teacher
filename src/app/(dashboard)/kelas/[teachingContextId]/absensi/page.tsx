import { prisma } from "@/lib/auth";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { format } from "date-fns";
import { id } from "date-fns/locale";

export default async function AbsensiPage({ params }: { params: Promise<{ teachingContextId: string }> }) {
  const { teachingContextId } = await params;
  await verifyTeachingContextAccess(teachingContextId);

  const sessions = await prisma.teachingSession.findMany({
    where: { teachingContextId, attendanceRecordedAt: { not: null } },
    orderBy: { date: "desc" },
    include: {
      attendanceRecords: {
        include: {
          student: true,
        }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Laporan Kehadiran</h2>
      </div>

      <div className="bg-white rounded-md border overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal Sesi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hadir</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sakit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Izin</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Alpa</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  Belum ada data kehadiran yang dicatat.
                </td>
              </tr>
            ) : (
              sessions.map((session) => {
                const hadir = session.attendanceRecords.filter(r => r.status === "PRESENT" || r.status === "LATE").length;
                const sakit = session.attendanceRecords.filter(r => r.status === "SICK").length;
                const izin = session.attendanceRecords.filter(r => r.status === "PERMISSION").length;
                const alpa = session.attendanceRecords.filter(r => r.status === "ABSENT").length;

                return (
                  <tr key={session.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {format(new Date(session.date), "dd MMM yyyy", { locale: id })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{hadir}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{sakit}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{izin}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{alpa}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
