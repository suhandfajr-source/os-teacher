"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Award, FileSpreadsheet, ArrowLeft, Loader2 } from "lucide-react";
import {
  inspectImportFile,
  validateHistoricalAssessmentsAction,
  executeHistoricalAssessmentsImportAction,
} from "@/modules/imports/import.actions";
import { HistoricalAssessmentValidationRow } from "@/modules/imports/import.types";

export default function HistoricalAssessmentImportFlow({
  teachingContextId,
}: {
  teachingContextId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);

  // Column Mappings
  const [studentCol, setStudentCol] = useState("Nama Siswa");
  const [titleCol, setTitleCol] = useState("Judul Penilaian");
  const [dateCol, setDateCol] = useState("Tanggal");
  const [scoreCol, setScoreCol] = useState("Nilai");
  const [typeCol, setTypeCol] = useState("Jenis Penilaian");
  const [maxScoreCol, setMaxScoreCol] = useState("Skor Maksimum");
  const [statusCol, setStatusCol] = useState("");

  // Validation State
  const [rows, setRows] = useState<HistoricalAssessmentValidationRow[]>([]);
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
        if (inspect.suggestions.titleCol) setTitleCol(inspect.suggestions.titleCol);
        if (inspect.suggestions.dateCol) setDateCol(inspect.suggestions.dateCol);
        if (inspect.suggestions.scoreCol) setScoreCol(inspect.suggestions.scoreCol);
        if (inspect.suggestions.typeCol) setTypeCol(inspect.suggestions.typeCol);
        if (inspect.suggestions.maxScoreCol) setMaxScoreCol(inspect.suggestions.maxScoreCol);
        if (inspect.suggestions.statusCol) setStatusCol(inspect.suggestions.statusCol);
      } catch {
        // Fallback
      }
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    if (!studentCol || !titleCol || !dateCol) {
      setError("Kolom Siswa, Judul Penilaian, dan Tanggal wajib dipetakan.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const preview = await validateHistoricalAssessmentsAction(teachingContextId, formData, {
        studentCol,
        titleCol,
        dateCol,
        scoreCol: scoreCol || undefined,
        typeCol: typeCol || undefined,
        maxScoreCol: maxScoreCol || undefined,
        statusCol: statusCol || undefined,
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

  const handleSetCategory = (typeName: string, category: "FORMATIVE" | "SUMMATIVE" | "OTHER") => {
    setRows((prev) =>
      prev.map((r) =>
        r.assessmentTypeName === typeName
          ? { ...r, confirmedCategory: category }
          : r
      )
    );
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await executeHistoricalAssessmentsImportAction(teachingContextId, rows, token);
      toast.success(result.message || `${result.importedCount} nilai penilaian lampau berhasil diimpor.`);
      router.push(`/kelas/${teachingContextId}/penilaian`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat mengimpor data.");
      setLoading(false);
    }
  };

  const validCount = rows.filter((r) => r.status === "VALID" || r.status === "WARNING").length;
  const gradedCount = rows.filter((r) => (r.status === "VALID" || r.status === "WARNING") && r.resultStatus === "GRADED").length;
  const absentCount = rows.filter((r) => (r.status === "VALID" || r.status === "WARNING") && r.resultStatus !== "GRADED").length;
  const errorCount = rows.filter((r) => r.status === "ERROR").length;

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Award className="h-5 w-5 text-indigo-600" />
          {step === 1 && "1. Upload & Pemetaan Kolom Nilai Lampau"}
          {step === 2 && "2. Pratinjau & Konfirmasi Nilai Lampau"}
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
                  Sesuaikan kolom file Anda dengan kolom data penilaian sistem.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
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
                    <label className="text-xs font-medium text-slate-700">Kolom Judul Penilaian (Wajib)</label>
                    <Input
                      value={titleCol}
                      onChange={(e) => setTitleCol(e.target.value)}
                      placeholder="Contoh: Judul / Ulangan"
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
                    <label className="text-xs font-medium text-slate-700">Kolom Nilai / Skor Mentah</label>
                    <Input
                      value={scoreCol}
                      onChange={(e) => setScoreCol(e.target.value)}
                      placeholder="Contoh: Nilai"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Kolom Jenis Penilaian</label>
                    <Input
                      value={typeCol}
                      onChange={(e) => setTypeCol(e.target.value)}
                      placeholder="Contoh: Tugas / UH / UTS"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Kolom Skor Maksimum</label>
                    <Input
                      value={maxScoreCol}
                      onChange={(e) => setMaxScoreCol(e.target.value)}
                      placeholder="Contoh: 100"
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
              <div className="bg-indigo-50 text-indigo-800 p-3 rounded-lg border border-indigo-200">
                <div className="text-xs font-medium">Dinilai (Graded)</div>
                <div className="text-2xl font-bold">{gradedCount}</div>
              </div>
              <div className="bg-amber-50 text-amber-800 p-3 rounded-lg border border-amber-200">
                <div className="text-xs font-medium">Absen / Izin (Kosong)</div>
                <div className="text-2xl font-bold">{absentCount}</div>
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
                    <TableHead>Penilaian</TableHead>
                    <TableHead>Jenis & Kategori</TableHead>
                    <TableHead>Skor Mentah</TableHead>
                    <TableHead>Skor Normal (0-100)</TableHead>
                    <TableHead>Status Hasil</TableHead>
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
                      <TableCell className="text-sm font-medium">
                        {r.matchedStudentName || r.studentIdentifier || "-"}
                      </TableCell>
                      <TableCell className="text-sm">{r.assessmentTitle}</TableCell>
                      <TableCell className="text-xs">
                        <div>{r.assessmentTypeName}</div>
                        {!r.matchedAssessmentTypeId ? (
                          <div className="flex gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => handleSetCategory(r.assessmentTypeName, "FORMATIVE")}
                              className={`px-1.5 py-0.5 text-[10px] rounded border ${
                                (r.confirmedCategory || "FORMATIVE") === "FORMATIVE"
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white text-slate-700 border-slate-300"
                              }`}
                            >
                              Formatif
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetCategory(r.assessmentTypeName, "SUMMATIVE")}
                              className={`px-1.5 py-0.5 text-[10px] rounded border ${
                                r.confirmedCategory === "SUMMATIVE"
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white text-slate-700 border-slate-300"
                              }`}
                            >
                              Sumatif
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{r.confirmedCategory || "Sesuai Data"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {r.rawScore !== null ? `${r.rawScore} / ${r.maxScore}` : "-"}
                      </TableCell>
                      <TableCell className="text-sm font-bold text-indigo-700">
                        {r.normalizedScore !== null ? r.normalizedScore.toFixed(2) : "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            r.resultStatus === "GRADED"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.resultStatus === "EXCUSED"
                              ? "bg-blue-100 text-blue-800"
                              : r.resultStatus === "ABSENT"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {r.resultStatus || "ERROR"}
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
              "Validasi File Nilai"
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
                Konfirmasi Impor ({validCount} Nilai)
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
