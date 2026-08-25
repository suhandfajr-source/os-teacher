"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, UserCheck, FileSpreadsheet, ArrowLeft, Loader2 } from "lucide-react";
import {
  inspectImportFile,
  validateHistoricalAttendanceAction,
  executeHistoricalAttendanceImportAction,
} from "@/modules/imports/import.actions";
import { HistoricalAttendanceValidationRow } from "@/modules/imports/import.types";

export default function HistoricalAttendanceImportFlow({
  teachingContextId,
}: {
  teachingContextId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);

  // Column Mappings
  const [studentCol, setStudentCol] = useState("Nama Siswa");
  const [dateCol, setDateCol] = useState("Tanggal");
  const [statusCol, setStatusCol] = useState("Status Kehadiran");
  const [sessionCol] = useState("");
  const [topicCol, setTopicCol] = useState("Materi");

  // Validation State
  const [rows, setRows] = useState<HistoricalAttendanceValidationRow[]>([]);
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
        if (inspect.suggestions.namaCol) setStudentCol(inspect.suggestions.namaCol);
        if (inspect.suggestions.dateCol) setDateCol(inspect.suggestions.dateCol);
        if (inspect.suggestions.statusCol) setStatusCol(inspect.suggestions.statusCol);
        if (inspect.suggestions.topicCol) setTopicCol(inspect.suggestions.topicCol);
      } catch {
        // Fallback
      }
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    if (!studentCol || !dateCol || !statusCol) {
      setError("Kolom Siswa, Tanggal, dan Status Kehadiran wajib dipetakan.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const preview = await validateHistoricalAttendanceAction(teachingContextId, formData, {
        studentCol,
        dateCol,
        statusCol,
        sessionCol: sessionCol || undefined,
        topicCol: topicCol || undefined,
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

  const handleSessionResolution = (rowIndex: number, sessionId: string) => {
    setRows((prev) => {
      const updated = [...prev];
      const targetRow = { ...updated[rowIndex] };
      targetRow.matchedSessionId = sessionId;
      targetRow.isSessionAmbiguous = false;
      targetRow.status = "VALID";
      targetRow.action = "CREATE";
      targetRow.message = "Sesi pertemuan telah dipilih secara eksplisit.";
      updated[rowIndex] = targetRow;
      return updated;
    });
  };

  const handleConfirm = async () => {
    // Check if any row is still ambiguous
    const stillAmbiguous = rows.some((r) => r.isSessionAmbiguous);
    if (stillAmbiguous) {
      setError("Terdapat baris dengan pertemuan ambigu yang belum dipilih sesinya.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await executeHistoricalAttendanceImportAction(teachingContextId, rows, token);
      toast.success(result.message || `${result.importedCount} data presensi lampau berhasil diimpor.`);
      router.push(`/kelas/${teachingContextId}/pertemuan`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat mengimpor data.");
      setLoading(false);
    }
  };

  const validCount = rows.filter((r) => r.status === "VALID").length;
  const duplicateCount = rows.filter((r) => r.action === "SKIP" && r.status === "WARNING").length;
  const ambiguousCount = rows.filter((r) => r.isSessionAmbiguous).length;
  const errorCount = rows.filter((r) => r.status === "ERROR").length;

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <UserCheck className="h-5 w-5 text-indigo-600" />
          {step === 1 && "1. Upload & Pemetaan Kolom Presensi Lampau"}
          {step === 2 && "2. Pratinjau & Konfirmasi Presensi Lampau"}
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
                  Sesuaikan kolom file Anda dengan kolom data presensi sistem.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Kolom Siswa / NIS (Wajib)</label>
                    <Input
                      value={studentCol}
                      onChange={(e) => setStudentCol(e.target.value)}
                      placeholder="Contoh: Nama Siswa"
                      className="text-sm"
                    />
                  </div>
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
                    <label className="text-xs font-medium text-slate-700">Kolom Status Presensi (Wajib)</label>
                    <Input
                      value={statusCol}
                      onChange={(e) => setStatusCol(e.target.value)}
                      placeholder="Contoh: Hadir / Sakit / Izin / Alpa"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Kolom Topik Materi (Untuk Sesi Baru)</label>
                    <Input
                      value={topicCol}
                      onChange={(e) => setTopicCol(e.target.value)}
                      placeholder="Contoh: Topik / Materi"
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
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200">
                <div className="text-xs font-medium">Siap Diimpor</div>
                <div className="text-2xl font-bold">{validCount}</div>
              </div>
              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200">
                <div className="text-xs font-medium">Sudah Ada (Dilewati)</div>
                <div className="text-2xl font-bold">{duplicateCount}</div>
              </div>
              <div className="bg-purple-50 text-purple-800 p-3 rounded-lg border border-purple-200">
                <div className="text-xs font-medium">Sesi Ambigu</div>
                <div className="text-2xl font-bold">{ambiguousCount}</div>
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
                    <TableHead className="w-[50px]">Baris</TableHead>
                    <TableHead>Siswa Terdeteksi</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status Presensi</TableHead>
                    <TableHead>Target Sesi</TableHead>
                    <TableHead>Status Validasi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow
                      key={i}
                      className={
                        r.status === "ERROR"
                          ? "bg-rose-50/50"
                          : r.isSessionAmbiguous
                          ? "bg-purple-50/50"
                          : r.status === "WARNING"
                          ? "bg-amber-50/50"
                          : ""
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground">{r.rowNum}</TableCell>
                      <TableCell className="text-sm font-medium">
                        {r.matchedStudentName || r.studentIdentifier || "-"}
                      </TableCell>
                      <TableCell className="text-sm">{r.sessionDate || "-"}</TableCell>
                      <TableCell className="text-sm font-semibold">
                        <span
                          className={`px-2 py-0.5 text-xs rounded font-medium ${
                            r.attendanceStatus === "PRESENT"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.attendanceStatus === "SICK"
                              ? "bg-amber-100 text-amber-800"
                              : r.attendanceStatus === "PERMISSION"
                              ? "bg-blue-100 text-blue-800"
                              : r.attendanceStatus === "LATE"
                              ? "bg-purple-100 text-purple-800"
                              : r.attendanceStatus === "ABSENT"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {r.attendanceStatus || r.rawStatusString || "Tidak Valid"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.isSessionAmbiguous && r.availableSessions && r.availableSessions.length > 0 ? (
                          <select
                            className="text-xs border border-amber-400 bg-white rounded p-1"
                            onChange={(e) => handleSessionResolution(i, e.target.value)}
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Pilih Sesi...
                            </option>
                            {r.availableSessions.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.actualTopic || `Pertemuan ${s.date}`}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-muted-foreground">
                            {r.matchedSessionId ? "Sesi Cocok" : "Otomatis Dibuat"}
                          </span>
                        )}
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
              "Validasi File Presensi"
            )}
          </Button>
        )}
        {step === 2 && (
          <Button
            onClick={handleConfirm}
            disabled={loading || validCount === 0 || ambiguousCount > 0}
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
                Konfirmasi Impor ({validCount} Catatan)
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
