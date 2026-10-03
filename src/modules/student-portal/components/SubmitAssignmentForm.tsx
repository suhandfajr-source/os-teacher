"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  File as FileIcon,
  Loader2,
  Lock,
  Paperclip,
  Send,
  TimerReset,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { submitAssignmentAction } from "@/modules/student-portal/student-submission.actions";
import {
  isBlockedExtension,
  inferMimeFromExtension,
  MAX_FILES,
  MAX_FILE_BYTES,
} from "@/modules/storage/file-validation";
import type { StudentSubmissionView } from "@/modules/assignments/submission.service";

interface Props {
  assignmentId: string;
  dueDateIso: string | null;
  submission: StudentSubmissionView | null;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Item file di form: sudah tersimpan (punya id) atau pending upload. */
type FileFormItem =
  | { kind: "saved"; id: string; name: string; size: number; mimeType: string }
  | { kind: "pending"; localId: string; name: string; size: number; mimeType: string; file: File };

/** Upload langsung ke storage via presigned POST (XHR untuk progress + timeout). */
function uploadToStorage(
  uploadUrl: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    // E11: koneksi drop diam-diam jangan biarkan form menggantung selamanya
    xhr.timeout = 60_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload gagal (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah"));
    xhr.ontimeout = () => reject(new Error("Unggahan terlalu lama — periksa koneksi"));
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append("file", file);
    xhr.send(fd);
  });
}

export function SubmitAssignmentForm({ assignmentId, dueDateIso, submission }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(submission?.textContent ?? "");
  const [link, setLink] = useState(submission?.linkUrl ?? "");
  const [files, setFiles] = useState<FileFormItem[]>(() =>
    (submission?.files ?? []).map((f) => ({
      kind: "saved" as const,
      id: f.id,
      name: f.originalName,
      size: f.sizeBytes,
      mimeType: f.mimeType,
    }))
  );
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [pending, setPending] = useState(false);
  const [current, setCurrent] = useState<StudentSubmissionView | null>(submission);

  const locked = current?.status === "REVIEWED";

  function validateLocal(f: File): string | null {
    if (isBlockedExtension(f.name)) {
      return `Jenis file ${f.name.split(".").pop()?.toUpperCase()} tidak diperbolehkan.`;
    }
    if (f.size > MAX_FILE_BYTES) return `File "${f.name}" melebihi 25 MB.`;
    return null;
  }

  function handleAddFiles(incoming: File[]) {
    if (!incoming || incoming.length === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      for (const f of incoming) {
        if (next.length >= MAX_FILES) {
          toast.error(`Maksimal ${MAX_FILES} file per pengumpulan.`);
          break;
        }
        const err = validateLocal(f);
        if (err) {
          toast.error(err);
          continue;
        }
        next.push({
          kind: "pending",
          localId: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          size: f.size,
          // E8: picker mobile kadang kirim type kosong — infer dari ekstensi
          mimeType: f.type || inferMimeFromExtension(f.name) || "application/octet-stream",
          file: f,
        });
      }
      return next;
    });
  }

  function removeFile(item: FileFormItem) {
    setFiles(files.filter((x) =>
      item.kind === "pending" ? x.kind !== "pending" || x.localId !== item.localId : x.kind !== "saved" || x.id !== item.id
    ));
  }

  async function handleSubmit() {
    if (pending) return;
    setPending(true);
    try {
      // 1. Upload file pending → presign → langsung ke storage
      const pendingItems = files.filter((f): f is Extract<FileFormItem, { kind: "pending" }> => f.kind === "pending");
      const uploaded: Array<{ storageKey: string; name: string; mimeType: string; sizeBytes: number }> = [];

      if (pendingItems.length > 0) {
        const res = await fetch("/api/assignments/files/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            files: pendingItems.map((f) => ({ name: f.name, mimeType: f.mimeType, sizeBytes: f.size })),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.uploads) {
          toast.error(data?.error ?? "Gagal menyiapkan unggahan file.");
          setPending(false);
          return;
        }

        for (let i = 0; i < pendingItems.length; i++) {
          const item = pendingItems[i];
          const up = data.uploads[i];
          try {
            setProgress((p) => ({ ...p, [item.localId]: 1 }));
            await uploadToStorage(up.uploadUrl, up.fields, item.file, (pct) =>
              setProgress((prev) => ({ ...prev, [item.localId]: pct }))
            );
            uploaded.push({ storageKey: up.storageKey, name: item.name, mimeType: item.mimeType, sizeBytes: item.size });
          } catch {
            toast.error(`File "${item.name}" gagal diunggah — periksa koneksi.`);
            setPending(false);
            return;
          }
        }
      }

      // 2. Submit — set file final: upload baru (storageKey) + file lama yang
      // dipertahankan (keepFileIds); sisanya dihapus oleh action (K7).
      const saved = files
        .filter((f): f is Extract<FileFormItem, { kind: "saved" }> => f.kind === "saved")
        .map((f) => f.id);

      const res2 = await submitAssignmentAction(assignmentId, {
        textContent: text,
        linkUrl: link,
        files: uploaded.map((u) => ({
          storageKey: u.storageKey,
          name: u.name,
          mimeType: u.mimeType,
          sizeBytes: u.sizeBytes,
        })),
        keepFileIds: saved,
      });

      if (res2.success && res2.submission) {
        // isLate dihitung server (jam server vs dueDate) — jangan override pakai jam browser
        setCurrent(res2.submission);
        setFiles(
          res2.submission.files.map((f) => ({
            kind: "saved" as const,
            id: f.id,
            name: f.originalName,
            size: f.sizeBytes,
            mimeType: f.mimeType,
          }))
        );
        setProgress({});
        setOpen(false);
        toast.success("Jawaban terkirim", {
          description: res2.submission.isLate
            ? "Terkirim setelah batas waktu — ditandai terlambat."
            : "Menunggu koreksi guru.",
        });
      } else {
        toast.error(res2.error ?? "Gagal menyimpan jawaban");
      }
    } catch {
      // Network/unexpected throw — jangan biarkan rejection tanpa feedback
      toast.error("Gagal mengirim — periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (locked) {
    return (
      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Sudah dinilai{current?.score != null ? ` — skor ${current.score}` : ""}
        </div>
        {(current?.files?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {current!.files.map((f) => (
              <a
                key={f.id}
                href={`/api/assignments/files/${f.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                <FileIcon className="w-3 h-3" /> {f.originalName} ({fmtSize(f.sizeBytes)})
              </a>
            ))}
          </div>
        )}
        {current?.feedback && (
          <div className="rounded-lg bg-white border border-emerald-100 p-2.5">
            <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">
              Umpan balik guru
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
              {current.feedback}
            </p>
          </div>
        )}
        <p className="text-[9px] text-slate-400 flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" /> Jawaban terkunci — hubungi guru untuk revisi.
        </p>
      </div>
    );
  }

  if (current && !open) {
    return (
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
            <TimerReset className="w-3.5 h-3.5" /> Terkirim {fmtDateTime(current.submittedAt)}
          </span>
          {current.isLate && (
            <span className="text-[9px] font-extrabold uppercase text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
              Terlambat
            </span>
          )}
        </div>
        {current.files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {current.files.map((f) => (
              <a
                key={f.id}
                href={f.id ? `/api/assignments/files/${f.id}` : "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
              >
                <FileIcon className="w-3 h-3" /> {f.originalName}
              </a>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          className="text-[10px] font-bold text-teal-700 flex items-center gap-1 hover:underline"
        >
          <Edit3 className="w-3 h-3" /> Ubah jawaban (sebelum dinilai)
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-white text-[11px] font-bold py-2 hover:bg-teal-700 active:scale-[0.99] transition"
        >
          <Send className="w-3.5 h-3.5" /> Kumpulkan Tugas
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Jawaban Tugas</span>
            <button onClick={() => setOpen(false)} aria-label="Tutup form">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis jawabanmu di sini…"
            rows={4}
            maxLength={10000}
            className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
          />
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="atau tautan jawaban (https://…)"
              inputMode="url"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
          </div>

          {/* File jawaban */}
          <div className="space-y-1.5">
            <label className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-500 cursor-pointer hover:border-teal-400 hover:text-teal-700">
              <Paperclip className="w-3.5 h-3.5" />
              Lampirkan file (foto/PDF/Word, maks {MAX_FILES} × 25 MB)
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const selected = e.target.files ? Array.from(e.target.files) : [];
                  e.target.value = "";
                  if (selected.length > 0) {
                    handleAddFiles(selected);
                  }
                }}
              />
            </label>
            {files.map((f) => (
              <div
                key={f.kind === "pending" ? f.localId : f.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
              >
                <FileIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-[10px] font-semibold text-slate-700">
                  {f.name} <span className="text-slate-400">({fmtSize(f.size)})</span>
                </span>
                {f.kind === "pending" && progress[f.localId] != null && progress[f.localId] < 100 && (
                  <Loader2 className="w-3 h-3 animate-spin text-teal-600" />
                )}
                <button
                  onClick={() => removeFile(f)}
                  aria-label={`Hapus ${f.name}`}
                  className="text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {dueDateIso && (
            <p className="text-[9px] text-slate-400 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              Batas {fmtDateTime(dueDateIso)} — terlambat tetap bisa dikirim.
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-white text-[11px] font-bold py-2 hover:bg-teal-700 disabled:opacity-60 transition"
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {pending ? "Mengirim…" : current ? "Perbarui Jawaban" : "Kirim Jawaban"}
          </button>
        </div>
      )}
    </div>
  );
}
