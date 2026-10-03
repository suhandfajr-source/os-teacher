"use client";

import { useState, useEffect } from "react";
import { File as FileIcon, Loader2, Paperclip, Trash2, Upload, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isBlockedExtension, inferMimeFromExtension, MAX_FILE_BYTES, MAX_FILES } from "@/modules/storage/file-validation";
import { setAssignmentAttachmentsAction, type AssignmentAttachmentView } from "@/modules/assignments/assignment.actions";

/**
 * Story 2 — dialog kelola lampiran tugas (guru). Pola keep+new:
 * upload presign dulu (browser→storage), lalu setAssignmentAttachmentsAction.
 * K8: bebas diubah kapan saja, walau sudah ada yang mengumpulkan.
 */

type PendingItem = {
  localId: string;
  name: string;
  size: number;
  mimeType: string;
  file: File;
};

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function uploadToStorage(
  uploadUrl: string,
  fields: Record<string, string>,
  file: File
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.timeout = 60_000;
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload gagal (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah"));
    xhr.ontimeout = () => reject(new Error("Unggahan terlalu lama — periksa koneksi"));
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    fd.append("file", file);
    xhr.send(fd);
  });
}

export function AssignmentAttachmentsDialog({
  teachingContextId,
  assignmentId,
  assignmentTitle,
  initialAttachments,
  onAttachmentsUpdated,
}: {
  teachingContextId: string;
  assignmentId: string;
  assignmentTitle: string;
  initialAttachments: AssignmentAttachmentView[];
  onAttachmentsUpdated?: (updated: AssignmentAttachmentView[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kept, setKept] = useState<AssignmentAttachmentView[]>(initialAttachments);
  const [pendingFiles, setPendingFiles] = useState<PendingItem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setKept(initialAttachments);
      setPendingFiles([]);
    }
  }, [open, initialAttachments]);

  const total = kept.length + pendingFiles.length;

  const handleClose = () => {
    setKept(initialAttachments);
    setPendingFiles([]);
    setOpen(false);
  };

  const isDirty =
    pendingFiles.length > 0 ||
    kept.length !== initialAttachments.length ||
    !kept.every((k) => initialAttachments.some((init) => init.id === k.id));

  function addFiles(list: FileList | null) {
    if (!list) return;
    setPendingFiles((prev) => {
      const next = [...prev];
      for (const f of Array.from(list)) {
        if (next.length + kept.length >= MAX_FILES) {
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

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    try {
      // 1. Upload file pending → presign → langsung ke storage
      const uploaded: Array<{ storageKey: string; name: string; mimeType: string; sizeBytes: number }> = [];
      if (pendingFiles.length > 0) {
        const res = await fetch("/api/assignments/files/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "attachment",
            teachingContextId,
            files: pendingFiles.map((f) => ({ name: f.name, mimeType: f.mimeType, sizeBytes: f.size })),
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.uploads) {
          toast.error(data?.error ?? "Gagal menyiapkan unggahan.");
          setBusy(false);
          return;
        }
        for (let i = 0; i < pendingFiles.length; i++) {
          try {
            await uploadToStorage(data.uploads[i].uploadUrl, data.uploads[i].fields, pendingFiles[i].file);
            uploaded.push({
              storageKey: data.uploads[i].storageKey,
              name: pendingFiles[i].name,
              mimeType: pendingFiles[i].mimeType,
              sizeBytes: pendingFiles[i].size,
            });
          } catch {
            toast.error(`File "${pendingFiles[i].name}" gagal diunggah — periksa koneksi.`);
            setBusy(false);
            return;
          }
        }
      }

      // 2. Set final: keep + new
      const result = await setAssignmentAttachmentsAction({
        teachingContextId,
        assignmentId,
        keepFileIds: kept.map((f) => f.id),
        newFiles: uploaded,
      });
      if (result.success && result.attachments) {
        setKept(result.attachments);
        setPendingFiles([]);
        onAttachmentsUpdated?.(result.attachments);
        setOpen(false);
        toast.success("Lampiran tersimpan", { description: `Total ${result.attachments.length} file.` });
      } else {
        toast.error(result.error ?? "Gagal menyimpan lampiran");
      }
    } catch {
      toast.error("Gagal menyimpan — periksa koneksi lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline"
      >
        <Paperclip className="w-4 h-4" />
        Lampiran{kept.length > 0 ? ` (${kept.length})` : ""}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl border shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header Sticky */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b bg-white shrink-0">
              <div>
                <h3 className="font-semibold text-sm text-slate-900">Kelola Lampiran Tugas</h3>
                <p className="text-xs text-muted-foreground truncate max-w-[280px]">{assignmentTitle}</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Tutup"
                className="text-muted-foreground hover:text-foreground rounded-md p-1 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <p className="text-[11px] text-muted-foreground">
                Soal, LKPD, atau materi pendukung. Dapat ditambah/dihapus kapan saja walau siswa sudah mengumpulkan.
              </p>

              {kept.length === 0 && pendingFiles.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6 border rounded-lg border-dashed bg-slate-50/50">
                  <Paperclip className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  Belum ada lampiran pada tugas ini.
                </div>
              )}

              {/* Lampiran yang sudah tersimpan */}
              {kept.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tersimpan ({kept.length}):
                  </p>
                  {kept.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-2xs">
                      <FileIcon className="w-4 h-4 text-slate-500 shrink-0" />
                      <a
                        href={`/api/assignments/attachments/${f.id}${f.isPreviewable ? "?disposition=inline" : ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 truncate text-xs font-medium text-slate-700 hover:text-teal-700 hover:underline"
                        title={f.originalName}
                      >
                        {f.originalName}
                        <span className="text-muted-foreground font-normal"> ({fmtSize(f.sizeBytes)})</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setKept(kept.filter((x) => x.id !== f.id))}
                        aria-label={`Hapus ${f.originalName}`}
                        className="text-muted-foreground hover:text-rose-500 rounded p-1 hover:bg-rose-50 transition-colors"
                        title="Hapus berkas ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* File baru yang siap diunggah */}
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900 flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <b>{pendingFiles.length} file baru dipilih.</b> Klik tombol <b>Simpan Lampiran</b> di bawah untuk mengunggah ke tugas ini.
                    </span>
                  </div>
                  {pendingFiles.map((f) => (
                    <div key={f.localId} className="flex items-center gap-2 rounded-lg border border-teal-300 bg-teal-50/70 px-3 py-2">
                      <FileIcon className="w-4 h-4 text-teal-700 shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-xs font-medium text-teal-900">
                        {f.name} <span className="text-teal-600 font-normal">({fmtSize(f.size)})</span>
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                        Menunggu simpan
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingFiles(pendingFiles.filter((x) => x.localId !== f.localId))}
                        aria-label={`Batal ${f.name}`}
                        className="text-muted-foreground hover:text-rose-500 rounded p-1 hover:bg-rose-50 transition-colors"
                        title="Batal pilih"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tombol pilih file */}
              {total < MAX_FILES && (
                <label className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-3 py-3 text-xs font-semibold text-slate-600 cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 hover:text-teal-700 transition-colors">
                  <Upload className="w-4 h-4 text-slate-500" />
                  Pilih file untuk ditambahkan (maks {MAX_FILES - total} lagi)
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            {/* Footer Sticky — SELALU TERLIHAT */}
            <div className="p-3 border-t bg-slate-50 shrink-0 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={busy}
                className="w-1/3"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={busy || !isDirty}
                className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {busy
                  ? "Mengunggah…"
                  : pendingFiles.length > 0
                  ? `Simpan (${pendingFiles.length} file baru)`
                  : "Simpan Perubahan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
