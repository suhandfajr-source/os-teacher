"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Calendar, FileSpreadsheet, ArrowLeft, Loader2 } from "lucide-react";
import {
  inspectImportFile,
  validateHistoricalSessionsAction,
  executeHistoricalSessionsImportAction,
} from "@/modules/imports/import.actions";
import { HistoricalSessionValidationRow } from "@/modules/imports/import.types";

export default function HistoricalSessionImportFlow({
  teachingContextId,
}: {
  teachingContextId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);

  // Column Mappings
  const [dateCol, setDateCol] = useState("Tanggal");
  const [topicCol, setTopicCol] = useState("Materi");
  const [summaryCol, setSummaryCol] = useState("");

  // Validation State
  const [rows, setRows] = useState<HistoricalSessionValidationRow[]>([]);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError("");
      setStep(1);
      setRows([]);

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const inspect = await inspectImportFile(formData);
        if (inspect.suggestions.dateCol) setDateCol(inspect.suggestions.dateCol);
        if (inspect.suggestions.topicCol) setTopicCol(inspect.suggestions.topicCol);
        if (inspect.suggestions.summaryCol) setSummaryCol(inspect.suggestions.summaryCol);
      } catch {
        // Fallback to default mapping names
      }
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    if (!dateCol || !topicCol) {
      setError("Kolom Tanggal dan Materi / Topik wajib dipetakan.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const preview = await validateHistoricalSessionsAction(teachingContextId, formData, {
        dateCol,
        topicCol,
        summaryCol: summaryCol || undefined,
      });

      setRows(preview.rows);
      setToken(preview.token);
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat memvalidasi file.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await executeHistoricalSessionsImportAction(teachingContextId, rows, token);
      toast.success(result.message || `${result.importedCount} pertemuan lampau berhasil diimpor.`);
      router.push(`/kelas/${teachingContextId}/pertemuan`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat mengimpor data.");
      setLoading(false);
    }
  };

  const validCount = rows.filter((r) => r.status === "VALID").length;
  const duplicateCount = rows.filter((r) => r.action === "SKIP" && r.status === "WARNING").length;
  const errorCount = rows.filter((r) => r.status === "ERROR").length;

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Calendar className="h-5 w-5 text-indigo-600" />
          {step === 1 && "1. Upload & Pemetaan Kolom Pertemuan Lampau"}
          {step === 2 && "2. Pratinjau & Konfirmasi Pertemuan Lampau"}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 p-6 rounded-lg text-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
              <FileSpreadsheet className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <Input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="max-w-xs mx-auto cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-2">Format yang didukung: XLSX, XLS, CSV (Maks. 500 baris)</p>
            </div>

            {file && (
              <div className="space-y-4 border p-4 rounded-lg bg-white">
                <h3 className="font-semibold text-sm text-slate-900">Pemetaan Kolom Spreadsheet</h3>
                <p className="text-xs text-muted-foreground">
                  Sesuaikan nama header kolom file Anda dengan kolom yang dibutuhkan sistem.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Kolom Tanggal (Wajib)</label>
                    <Input
                      value={dateCol}
                      onChange={(e) => setDateCol(e.target.value)}
                      placeholder="Contoh: Tanggal"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Kolom Materi / Topik (Wajib)</label>
                    <Input
                      value={topicCol}
                      onChange={(e) => setTopicCol(e.target.value)}
                      placeholder="Contoh: Materi"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Kolom Ringkasan Aktivitas (Opsional)</label>
                    <Input
                      value={summaryCol}
                      onChange={(e) => setSummaryCol(e.target.value)}
                      placeholder="Contoh: Kegiatan"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200">
                <div className="text-xs font-medium">Siap Diimpor</div>
                <div className="text-2xl font-bold">{validCount}</div>
              </div>
              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200">
                <div className="text-xs font-medium">Sudah Ada (Dilewati)</div>
                <div className="text-2xl font-bold">{duplicateCount}</div>
              </div>
              <div className="bg-rose-50 text-rose-800 p-3 rounded-lg border border-rose-200">
                <div className="text-xs font-medium">Format Salah / Error</div>
                <div className="text-2xl font-bold">{errorCount}</div>
              </div>
            </div>

            <div className="border rounded-lg max-h-[380px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Baris</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Materi / Topik</TableHead>
                    <TableHead>Ringkasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pesan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow
                      key={i}
                      className={
                        r.status === "ERROR"
                          ? "bg-rose-50/50"
                          : r.status === "WARNING"
                          ? "bg-amber-50/50"
                          : ""
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground">{r.rowNum}</TableCell>
                      <TableCell className="font-medium text-sm">{r.date || "-"}</TableCell>
                      <TableCell className="text-sm">{r.actualTopic}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {r.activitySummary || "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            r.status === "VALID"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.status === "WARNING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-4">
        {step === 2 && (
          <Button variant="outline" size="sm" onClick={() => setStep(1)} disabled={loading}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Kembali ke Upload
          </Button>
        )}
        {step === 1 && (
          <Button
            onClick={handleValidate}
            disabled={!file || loading}
            className="ml-auto"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memvalidasi...
              </>
            ) : (
              "Validasi File Pertemuan"
            )}
          </Button>
        )}
        {step === 2 && (
          <Button
            onClick={handleConfirm}
            disabled={loading || validCount === 0}
            className="bg-emerald-600 hover:bg-emerald-700 ml-auto"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Mengimpor...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Konfirmasi Impor ({validCount} Pertemuan)
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
