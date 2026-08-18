"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editTeachingSession, completeTeachingSession } from "@/modules/teaching/teaching.actions";
import { saveAttendance } from "@/modules/attendance/attendance.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { AttendanceStatus } from "@prisma/client";

type AttendanceData = { status: AttendanceStatus; note: string };
type SessionData = { id: string; status: string; date: Date | string; actualTopic?: string | null; plannedTopic?: string | null; activitySummary?: string | null; attendanceRecordedAt?: Date | string | null; };
type ContextData = { id: string; classId: string; subject: { name: string }; class: { name: string } };
type RosterData = { studentId: string; student: { fullName: string; nis?: string | null } };
type RecordData = { studentId: string; status: AttendanceStatus; note?: string | null };

export default function SessionClient({ session, context, roster, attendanceRecords }: { session: SessionData; context: ContextData; roster: RosterData[]; attendanceRecords: RecordData[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [actualTopic, setActualTopic] = useState(session.actualTopic || "");
  const [plannedTopic, setPlannedTopic] = useState(session.plannedTopic || "");
  const [activitySummary, setActivitySummary] = useState(session.activitySummary || "");
  
  // Attendance state
  const [attendance, setAttendance] = useState<Record<string, AttendanceData>>(() => {
    const initialState: Record<string, AttendanceData> = {};
    if (session.attendanceRecordedAt && attendanceRecords) {
      attendanceRecords.forEach((record) => {
        initialState[record.studentId] = { status: record.status, note: record.note || "" };
      });
    } else {
      roster.forEach((cs) => {
        initialState[cs.studentId] = { status: "PRESENT", note: "" }; // default to present for first save
      });
    }
    return initialState;
  });

  const isCompleted = session.status === "COMPLETED";
  const displayRoster = session.attendanceRecordedAt 
    ? roster.filter((cs) => attendance[cs.studentId]) // only show snapshotted students
    : roster; // show all current roster students

  const handleSaveDetails = async () => {
    try {
      setLoading(true);
      await editTeachingSession(session.id, { actualTopic, plannedTopic, activitySummary });
      toast.success("Detail sesi berhasil disimpan");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan detail");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAttendance = async () => {
    try {
      setLoading(true);
      const records = Object.entries(attendance).map(([studentId, data]) => ({
        studentId,
        status: data.status,
        note: data.note,
      }));
      await saveAttendance(session.id, records);
      toast.success("Kehadiran berhasil disimpan");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan kehadiran");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteSession = async () => {
    if (!actualTopic.trim()) {
      toast.error("Topik aktual (Materi yang Diajarkan) harus diisi");
      return;
    }
    if (!session.attendanceRecordedAt) {
      toast.error("Kehadiran harus disimpan terlebih dahulu");
      return;
    }

    try {
      setLoading(true);
      // Ensure latest details are saved first
      await editTeachingSession(session.id, { actualTopic, plannedTopic, activitySummary });
      await completeTeachingSession(session.id);
      toast.success("Sesi berhasil diselesaikan");
      router.push("/hari-ini");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menyelesaikan sesi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Sesi: {context.subject.name} - {context.class.name}
          </h1>
          <p className="text-muted-foreground mt-2">
            {format(new Date(session.date), "EEEE, dd MMMM yyyy", { locale: id })}
            {isCompleted && " (Selesai)"}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Col: Details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Jurnal Mengajar</CardTitle>
              <CardDescription>Isi detail materi yang diajarkan pada sesi ini</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Rencana Topik</Label>
                <Input 
                  value={plannedTopic} 
                  onChange={(e) => setPlannedTopic(e.target.value)} 
                  placeholder="Misal: Bab 1 Pendahuluan"
                />
              </div>
              <div className="space-y-2">
                <Label>Topik Aktual (Wajib) <span className="text-red-500">*</span></Label>
                <Input 
                  value={actualTopic} 
                  onChange={(e) => setActualTopic(e.target.value)} 
                  placeholder="Materi yang benar-benar diajarkan hari ini"
                />
              </div>
              <div className="space-y-2">
                <Label>Ringkasan Kegiatan (Opsional)</Label>
                <Textarea 
                  value={activitySummary} 
                  onChange={(e) => setActivitySummary(e.target.value)} 
                  rows={4}
                  placeholder="Catatan aktivitas selama sesi berlangsung..."
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveDetails} disabled={loading} variant="secondary" className="w-full">
                Simpan Jurnal
              </Button>
            </CardFooter>
          </Card>
          
          {!isCompleted && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-800">Selesaikan Sesi</CardTitle>
                <CardDescription>
                  Sesi yang sudah selesai tidak dapat diedit absensinya tanpa izin khusus.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleCompleteSession} disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white">
                  Akhiri & Selesaikan Sesi
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col: Attendance */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Absensi Siswa</CardTitle>
              <CardDescription>
                {session.attendanceRecordedAt 
                  ? `Absensi terkunci (disimpan pada ${format(new Date(session.attendanceRecordedAt), "HH:mm")})`
                  : "Catat kehadiran siswa untuk sesi ini. Menyimpan akan mengunci daftar siswa."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {displayRoster.length === 0 && (
                  <p className="text-sm text-muted-foreground">Tidak ada siswa yang terdaftar untuk absensi.</p>
                )}
                {displayRoster.map((cs) => {
                  const sId = cs.studentId;
                  const currentStatus = attendance[sId]?.status || "PRESENT";
                  return (
                    <div key={sId} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50/50">
                      <div>
                        <p className="font-medium">{cs.student.fullName}</p>
                        <p className="text-xs text-muted-foreground">{cs.student.nis || "No NIS"}</p>
                      </div>
                      <div className="flex gap-2 w-1/3">
                        <Select 
                          value={currentStatus} 
                          onValueChange={(val) => setAttendance(prev => ({...prev, [sId]: { ...prev[sId], status: val as AttendanceStatus, note: prev[sId]?.note || "" }}))}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRESENT">Hadir</SelectItem>
                            <SelectItem value="SICK">Sakit</SelectItem>
                            <SelectItem value="PERMISSION">Izin</SelectItem>
                            <SelectItem value="ABSENT">Alpa</SelectItem>
                            <SelectItem value="LATE">Terlambat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveAttendance} disabled={loading} className="w-full">
                Simpan Absensi
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
