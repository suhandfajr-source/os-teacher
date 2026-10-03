"use client";

import { useState } from "react";
import { createAssignment, type AssignmentAttachmentView } from "@/modules/assignments/assignment.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import Link from "next/link";
import { ClipboardCheck, File as FileIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { isBlockedExtension, inferMimeFromExtension, MAX_FILE_BYTES, MAX_FILES } from "@/modules/storage/file-validation";
import { AssignmentAttachmentsDialog } from "./AssignmentAttachmentsDialog";

type AssignmentData = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  dueDate?: Date | null;
  createdAt: Date | string;
  pendingSubmissions?: number;
  attachments?: AssignmentAttachmentView[];
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
  // Story 2 — lampiran saat buat tugas: upload presign dulu, claim di createAssignment
  const [newFiles, setNewFiles] = useState<Array<{ localId: string; name: string; size: number; mimeType: string; file: File }>>([]);
  const [uploading, setUploading] = useState(false);

  function addFiles(files: File[]) {
    if (!files || files.length === 0) return;
    setNewFiles((prev) => {
      const next = [...prev];
      for (const f of files) {
        if (next.length >= MAX_FILES) {
          toast.error(`Maksimal ${MAX_FILES} file per tugas.`);
          break;
        }
        if (isBlockedExtension(f.name)) {
          toast.error(`Jenis file ${f.name.split(".").pop()?.toUpperCase()} tidak diperbolehkan.`);
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          toast.error(`File "${f.name}" melebihi 25 MB.`);
          continue;
        }
        next.push({
          localId: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          size: f.size,
          mimeType: f.type || inferMimeFromExtension(f.name) || "application/octet-stream",
          file: f,
        });
      }
      return next;
    });
  }

  async function uploadPending(): Promise<Array<{ storageKey: string; name: string; mimeType: string; sizeBytes: number }>> {
    if (newFiles.length === 0) return [];
    const res = await fetch("/api/assignments/files/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "attachment",
        teachingContextId,
        files: newFiles.map((f) => ({ name: f.name, mimeType: f.mimeType, sizeBytes: f.size })),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.uploads) {
      throw new Error(data?.error ?? "Gagal menyiapkan unggahan lampiran.");
    }
    const uploaded: Array<{ storageKey: string; name: string; mimeType: string; sizeBytes: number }> = [];
    for (let i = 0; i < newFiles.length; i++) {
      const item = newFiles[i];
      const up = data.uploads[i];
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", up.uploadUrl);
        xhr.timeout = 60_000;
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload gagal (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Koneksi terputus"));
        xhr.ontimeout = () => reject(new Error("Unggahan terlalu lama"));
        const fd = new FormData();
        for (const [k, v] of Object.entries(up.fields as Record<string, string>)) fd.append(k, v);
        fd.append("file", item.file);
        xhr.send(fd);
      });
      uploaded.push({ storageKey: up.storageKey, name: item.name, mimeType: item.mimeType, sizeBytes: item.size });
    }
    return uploaded;
  }

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Judul tugas wajib diisi");
      return;
    }

    try {
      setLoading(true);
      if (newFiles.length > 0) setUploading(true);
      const files = await uploadPending();
      const newAssignment = await createAssignment({
        teachingContextId,
        title,
        description,
        dueDate: dueDateStr ? new Date(dueDateStr) : undefined,
        teachingSessionId: sessionId !== "none" ? sessionId : undefined,
        files,
      });

      setAssignments([newAssignment, ...assignments]);
      toast.success("Tugas berhasil ditambahkan", {
        description: files.length > 0 ? `Dengan ${files.length} lampiran.` : undefined,
      });
      
      // reset
      setTitle("");
      setDescription("");
      setDueDateStr("");
      setSessionId("none");
      setNewFiles([]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat tugas");
    } finally {
      setLoading(false);
      setUploading(false);
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

        {newFiles.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-teal-700 flex items-center gap-1">
              <span>●</span> {newFiles.length} file dipilih (akan diunggah saat klik Tambah Tugas):
            </p>
            {newFiles.map((f) => (
              <div key={f.localId} className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/50 px-2.5 py-1.5">
                <FileIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-xs font-medium">
                  {f.name}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({f.size >= 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`})
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setNewFiles(newFiles.filter((x) => x.localId !== f.localId))}
                  aria-label={`Hapus ${f.name}`}
                  className="text-muted-foreground hover:text-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label>Lampiran — soal/LKPD (opsional)</Label>
          <label className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:border-teal-400 hover:text-teal-700">
            <Upload className="w-4 h-4" />
            Pilih file (maks {MAX_FILES} × 25 MB)
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files ? Array.from(e.target.files) : [];
                e.target.value = "";
                if (selected.length > 0) {
                  addFiles(selected);
                }
              }}
            />
          </label>
        </div>

        <Button onClick={handleCreate} disabled={loading || uploading} className="w-full">
          {loading || uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {uploading ? "Mengunggah lampiran…" : "Tambah Tugas"}
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
                  <div className="mt-2 flex flex-col sm:items-end gap-1.5">
                    <Link
                      href={`/kelas/${teachingContextId}/tugas/${assignment.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline"
                    >
                      <ClipboardCheck className="w-4 h-4" />
                      Antrean koreksi
                      {(assignment.pendingSubmissions ?? 0) > 0 && (
                        <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200">
                          {assignment.pendingSubmissions}
                        </span>
                      )}
                    </Link>
                    <AssignmentAttachmentsDialog
                      teachingContextId={teachingContextId}
                      assignmentId={assignment.id}
                      assignmentTitle={assignment.title}
                      initialAttachments={assignment.attachments ?? []}
                      onAttachmentsUpdated={(updated) => {
                        setAssignments((prev) =>
                          prev.map((a) => (a.id === assignment.id ? { ...a, attachments: updated } : a))
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
