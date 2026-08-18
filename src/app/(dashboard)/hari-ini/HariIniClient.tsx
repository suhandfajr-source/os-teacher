"use client";

import { useState } from "react";
import { startTeachingSession } from "@/modules/teaching/teaching.actions";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { id } from "date-fns/locale";

type TeachingContextDisplay = {
  id: string;
  subject: { name: string };
  class: { name: string };
  academicPeriod: { semester: string; year: string };
};
type SessionDisplay = {
  id: string;
  status: string;
  date: Date | string;
  teachingContextId: string;
  teachingContext: {
    subject: { name: string };
    class: { name: string };
  };
};

export default function HariIniClient({ teachingContexts, todaySessions }: { teachingContexts: TeachingContextDisplay[]; todaySessions: SessionDisplay[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleStartSession = async (contextId: string) => {
    try {
      setLoading(contextId);
      const session = await startTeachingSession(contextId);
      router.push(`/kelas/${contextId}/pertemuan/${session.id}`);
    } catch (e) {
      console.error(e);
      alert("Gagal memulai sesi");
    } finally {
      setLoading(null);
    }
  };

  const inProgressSessions = todaySessions.filter((s) => s.status === "IN_PROGRESS");
  const completedSessions = todaySessions.filter((s) => s.status === "COMPLETED");

  return (
    <div className="space-y-8">
      {inProgressSessions.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Sedang Berlangsung</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {inProgressSessions.map((session) => (
              <Card key={session.id} className="border-blue-200 bg-blue-50/50">
                <CardHeader>
                  <CardTitle className="text-lg text-blue-900">{session.teachingContext.subject.name}</CardTitle>
                  <CardDescription>
                    {session.teachingContext.class.name} • {format(new Date(session.date), "dd MMM yyyy", { locale: id })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => router.push(`/kelas/${session.teachingContextId}/pertemuan/${session.id}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Lanjutkan Sesi
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold mb-4">Kelas Anda</h2>
        {teachingContexts.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Belum ada kelas yang Anda ajar. Silakan atur di menu Pengaturan.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teachingContexts.map((tc) => (
              <Card key={tc.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{tc.subject.name}</CardTitle>
                  <CardDescription>
                    {tc.class.name} • {tc.academicPeriod.semester} {tc.academicPeriod.year}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleStartSession(tc.id)}
                    disabled={loading === tc.id}
                    className="w-full"
                  >
                    {loading === tc.id ? "Memulai..." : "Mulai Mengajar"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {completedSessions.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Selesai Hari Ini</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedSessions.map((session) => (
              <Card key={session.id} className="opacity-75">
                <CardHeader>
                  <CardTitle className="text-lg">{session.teachingContext.subject.name}</CardTitle>
                  <CardDescription>
                    {session.teachingContext.class.name} • {format(new Date(session.date), "dd MMM yyyy", { locale: id })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/kelas/${session.teachingContextId}/pertemuan/${session.id}`)}
                    className="w-full"
                  >
                    Lihat Detail
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
