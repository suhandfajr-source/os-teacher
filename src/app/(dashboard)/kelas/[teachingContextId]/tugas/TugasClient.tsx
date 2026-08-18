"use client";

import { useState } from "react";
import { createAssignment } from "@/modules/assignments/assignment.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";

type AssignmentData = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  dueDate?: Date | null;
  createdAt: Date | string;
};
type SessionData = {
  id: string;
  date: Date | string;
  actualTopic?: string | null;
  plannedTopic?: string | null;
};

export default function TugasClient({ teachingContextId, initialAssignments, sessions }: { teachingContextId: string; initialAssignments: AssignmentData[]; sessions: SessionData[] }) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDateStr, setDueDateStr] = useState("");
  const [sessionId, setSessionId] = useState<string>("none");

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Judul tugas wajib diisi");
      return;
    }

    try {
      setLoading(true);
      const newAssignment = await createAssignment({
        teachingContextId,
        title,
        description,
        dueDate: dueDateStr ? new Date(dueDateStr) : undefined,
        teachingSessionId: sessionId !== "none" ? sessionId : undefined,
      });

      setAssignments([newAssignment, ...assignments]);
      toast.success("Tugas berhasil ditambahkan");
      
      // reset
      setTitle("");
      setDescription("");
      setDueDateStr("");
      setSessionId("none");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat tugas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4 bg-white p-4 border rounded-md h-fit">
        <h3 className="font-semibold text-lg">Buat Tugas Baru</h3>
        
        <div className="space-y-2">
          <Label>Judul Tugas</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Latihan Soal Bab 1" />
        </div>
        
        <div className="space-y-2">
          <Label>Deskripsi (Opsional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instruksi tambahan..." />
        </div>
        
        <div className="space-y-2">
          <Label>Tenggat Waktu / Due Date (Opsional)</Label>
          <Input type="date" value={dueDateStr} onChange={(e) => setDueDateStr(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Kaitkan ke Sesi (Opsional)</Label>
          <Select value={sessionId} onValueChange={(val) => setSessionId(val || "none")}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih Sesi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tanpa Sesi</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {format(new Date(s.date), "dd MMM", { locale: id })} - {s.actualTopic || s.plannedTopic || "Sesi"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleCreate} disabled={loading} className="w-full">
          Tambah Tugas
        </Button>
      </div>

      <div className="md:col-span-2">
        <div className="bg-white border rounded-md divide-y">
          {assignments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Belum ada tugas diberikan.</div>
          ) : (
            assignments.map((assignment) => (
              <div key={assignment.id} className="p-4 flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <h4 className="font-medium text-lg">{assignment.title}</h4>
                  {assignment.description && <p className="text-sm text-gray-600 mt-1">{assignment.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">
                    Dibuat: {format(new Date(assignment.createdAt), "dd MMM yyyy", { locale: id })}
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <p className="text-sm font-medium">Status: {assignment.status === "ACTIVE" ? "Aktif" : "Selesai"}</p>
                  {assignment.dueDate && (
                    <p className="text-sm text-red-600 mt-1">
                      Tenggat: {format(new Date(assignment.dueDate), "dd MMM yyyy", { locale: id })}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
