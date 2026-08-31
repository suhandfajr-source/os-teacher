"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import { AiContentType, DocumentTemplateFormat } from "@prisma/client";
import { DocumentTemplateItem } from "@/modules/templates/template.types";
import {
  listDocumentTemplatesAction,
  archiveDocumentTemplateAction,
} from "@/modules/templates/template.actions";

interface TemplateManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultContentType?: AiContentType;
  onTemplateUpdated?: () => void;
}

const CONTENT_TYPE_LABELS: Record<AiContentType, string> = {
  LESSON_PLAN: "Rencana Pembelajaran (RPP/Modul)",
  LEARNING_MATERIAL: "Bahan & Materi Ajar",
  TASK_INSTRUCTION: "Petunjuk Tugas & LKPD",
  RUBRIC: "Rubrik Penilaian",
};

export function TemplateManagerDialog({
  isOpen,
  onClose,
  defaultContentType = "LESSON_PLAN",
  onTemplateUpdated,
}: TemplateManagerDialogProps) {
  const [templates, setTemplates] = useState<DocumentTemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedContentType, setSelectedContentType] = useState<AiContentType>(defaultContentType);
  const [formatFilter, setFormatFilter] = useState<"ALL" | DocumentTemplateFormat>("ALL");

  // Upload Form State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<DocumentTemplateFormat | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [unsupportedTags, setUnsupportedTags] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Replace State
  const [replacingTemplate, setReplacingTemplate] = useState<DocumentTemplateItem | null>(null);

  const [, startTransition] = useTransition();

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    setUploadError(null);
    setSuccessMessage(null);
    const res = await listDocumentTemplatesAction({
      contentType: selectedContentType,
      format: formatFilter === "ALL" ? undefined : formatFilter,
    });
    if (res.success && res.data) {
      setTemplates(res.data);
    }
    setIsLoading(false);
  }, [selectedContentType, formatFilter]);

  useEffect(() => {
    if (isOpen) {
      let isMounted = true;
      void listDocumentTemplatesAction({
        contentType: selectedContentType,
        format: formatFilter === "ALL" ? undefined : formatFilter,
      }).then((res) => {
        if (isMounted) {
          if (res.success && res.data) {
            setTemplates(res.data);
          }
          setIsLoading(false);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, selectedContentType, formatFilter]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUnsupportedTags([]);
    setSuccessMessage(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadFile(file);

      const lower = file.name.toLowerCase();
      if (lower.endsWith(".xlsx")) {
        setDetectedFormat("XLSX");
      } else if (lower.endsWith(".docx")) {
        setDetectedFormat("DOCX");
      } else {
        setDetectedFormat(null);
      }

      if (!uploadName) {
        const base = file.name.replace(/\.(docx|xlsx)$/i, "");
        setUploadName(base);
      }
    }
  };

  const handleUploadOrReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError("Pilih file dokumen Word (.docx) atau Excel (.xlsx) terlebih dahulu.");
      return;
    }
    if (!uploadName.trim()) {
      setUploadError("Nama template wajib diisi.");
      return;
    }

    const lower = uploadFile.name.toLowerCase();
    const isXlsx = lower.endsWith(".xlsx");
    const isDocx = lower.endsWith(".docx");

    if (!isXlsx && !isDocx) {
      setUploadError("Format file tidak didukung. Harap pilih file .docx atau .xlsx.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUnsupportedTags([]);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append("name", uploadName.trim());
    formData.append("contentType", selectedContentType);
    formData.append("file", uploadFile);

    let endpoint: string;
    if (replacingTemplate) {
      formData.append("templateId", replacingTemplate.id);
      endpoint = isXlsx
        ? "/api/templates/xlsx/replace"
        : "/api/templates/docx/replace";
    } else {
      endpoint = isXlsx
        ? "/api/templates/xlsx/upload"
        : "/api/templates/docx/upload";
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setUploadError(json.error || "Gagal mengunggah template.");
        if (json.unsupportedTags) {
          setUnsupportedTags(json.unsupportedTags);
        }
        setIsUploading(false);
        return;
      }

      setSuccessMessage(
        replacingTemplate
          ? `Template '${uploadName}' berhasil diperbarui!`
          : `Template '${uploadName}' berhasil disimpan!`
      );
      setUploadFile(null);
      setUploadName("");
      setDetectedFormat(null);
      setReplacingTemplate(null);
      await loadTemplates();
      if (onTemplateUpdated) onTemplateUpdated();
    } catch (err: unknown) {
      setUploadError(`Error jaringan: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleArchive = async (templateId: string, templateName: string) => {
    if (!confirm(`Arsipkan template '${templateName}'? Template ini tidak akan muncul lagi di daftar pilihan ekspor.`)) {
      return;
    }

    startTransition(async () => {
      const res = await archiveDocumentTemplateAction({ templateId });
      if (res.success) {
        setSuccessMessage(`Template '${templateName}' berhasil diarsipkan.`);
        await loadTemplates();
        if (onTemplateUpdated) onTemplateUpdated();
      } else {
        setUploadError(res.error || "Gagal mengarsipkan template.");
      }
    });
  };

  const startReplace = (t: DocumentTemplateItem) => {
    setReplacingTemplate(t);
    setUploadName(t.name);
    setUploadFile(null);
    setDetectedFormat(t.format);
    setUploadError(null);
    setUnsupportedTags([]);
    setSuccessMessage(null);
  };

  const cancelReplace = () => {
    setReplacingTemplate(null);
    setUploadName("");
    setUploadFile(null);
    setDetectedFormat(null);
    setUploadError(null);
    setUnsupportedTags([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Kelola Template Word & Excel</h2>
            <p className="text-xs text-slate-500">
              Gunakan format dokumen Word (.docx) atau Excel (.xlsx) dengan tag placeholder otomatis
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1"
            aria-label="Tutup"
          >
            &times;
          </button>
        </div>

        {/* Filters: Content Type & Format */}
        <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {/* Content Type Tabs */}
          <div className="flex gap-1.5 overflow-x-auto">
            {(Object.keys(CONTENT_TYPE_LABELS) as AiContentType[]).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedContentType(type);
                  cancelReplace();
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                  selectedContentType === type
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {CONTENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          {/* Format Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 font-medium mr-1">Format:</span>
            <button
              onClick={() => setFormatFilter("ALL")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                formatFilter === "ALL"
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFormatFilter("DOCX")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                formatFilter === "DOCX"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              Word (.docx)
            </button>
            <button
              onClick={() => setFormatFilter("XLSX")}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                formatFilter === "XLSX"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Success Notification */}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 font-bold ml-2">
                &times;
              </button>
            </div>
          )}

          {/* Error Notification */}
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl space-y-1">
              <div className="font-semibold">{uploadError}</div>
              {unsupportedTags.length > 0 && (
                <div className="text-[11px] text-rose-700">
                  Tag tidak dikenali: {unsupportedTags.map((t) => `{{${t}}}`).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Upload / Replace Box */}
          <form
            onSubmit={handleUploadOrReplace}
            className={`p-4 rounded-xl border transition-all ${
              replacingTemplate
                ? "bg-amber-50/50 border-amber-300"
                : "bg-indigo-50/30 border-indigo-100"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>{replacingTemplate ? "🔄 Ganti Berkas Template" : "📤 Unggah Template Baru"}</span>
                <span className="text-[10px] font-normal text-slate-500">
                  (Maks. 2 MB • .docx / .xlsx)
                </span>
                {detectedFormat && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      detectedFormat === "XLSX"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-blue-100 text-blue-800 border border-blue-300"
                    }`}
                  >
                    {detectedFormat}
                  </span>
                )}
              </h3>
              {replacingTemplate && (
                <button
                  type="button"
                  onClick={cancelReplace}
                  className="text-xs text-amber-700 hover:underline font-semibold"
                >
                  Batal Ganti
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Nama Template
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Misal: Format Modul Standar Kurikulum Merdeka"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Pilih Berkas (.docx / .xlsx)
                </label>
                <input
                  type="file"
                  accept=".docx,.xlsx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Tag wajib: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{"{{ISI_KONTEN}}"}</code> atau tag materi terkait.
              </span>
              <button
                type="submit"
                disabled={isUploading || !uploadFile}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
              >
                {isUploading
                  ? "Memvalidasi & Mengunggah..."
                  : replacingTemplate
                  ? "Simpan Perubahan Berkas"
                  : "Unggah Template"}
              </button>
            </div>
          </form>

          {/* List of Existing Templates */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Template Tersimpan ({templates.length})
            </h3>

            {isLoading ? (
              <div className="text-center py-8 text-xs text-slate-400">Memuat daftar template...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-xs text-slate-500 font-medium">
                  Belum ada template kustom untuk kategori ini.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Unggah file .docx atau .xlsx dengan tag placeholder seperti {"{{JUDUL}}"} dan {"{{ISI_KONTEN}}"}.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 border border-slate-200 rounded-xl hover:border-slate-300 transition-all bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            t.format === "XLSX"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {t.format || "DOCX"}
                        </span>
                        <span className="text-xs font-bold text-slate-800">{t.name}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 font-semibold rounded-full border border-indigo-100">
                          {CONTENT_TYPE_LABELS[t.contentType]}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                        <span>Berkas: {t.originalFileName} ({(t.fileSize / 1024).toFixed(1)} KB)</span>
                        <span>
                          Tag terdeteksi:{" "}
                          {t.placeholderManifest?.recognized?.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block bg-slate-100 text-slate-700 text-[10px] font-mono px-1 rounded mr-1"
                            >
                              {`{{${tag}}}`}
                            </span>
                          ))}
                        </span>
                      </div>
                      {t.placeholderManifest?.locations && t.placeholderManifest.locations.length > 0 && (
                        <div className="text-[10px] text-slate-400 flex flex-wrap gap-1 mt-0.5">
                          <span>Lokasi sel:</span>
                          {t.placeholderManifest.locations.map((loc, idx) => (
                            <span key={idx} className="bg-slate-50 px-1 py-0.2 rounded text-slate-600 font-mono">
                              {loc.sheet}!{loc.cell} ({loc.placeholder})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => startReplace(t)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                      >
                        Ganti File
                      </button>
                      <button
                        onClick={() => handleArchive(t.id, t.name)}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all"
                      >
                        Arsipkan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
