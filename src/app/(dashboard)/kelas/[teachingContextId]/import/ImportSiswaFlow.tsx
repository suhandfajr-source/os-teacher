"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  inspectImportFile,
  validateRosterAction,
  executeRosterImportAction,
} from "@/modules/imports/import.actions";
import { RosterValidationRow } from "@/modules/imports/import.types";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Users, FileSpreadsheet, ArrowLeft, Loader2, HelpCircle } from "lucide-react";

export default function ImportSiswaFlow({ teachingContextId }: { teachingContextId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);

  // Mapping
  const [namaCol, setNamaCol] = useState("Nama Lengkap");
  const [nisCol, setNisCol] = useState("NIS");

  // Validation Results
  const [results, setResults] = useState<RosterValidationRow[]>([]);
  const [token, setToken] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError("");
      setStep(1);
      setResults([]);

      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const inspection = await inspectImportFile(formData);
        if (inspection.suggestions.namaCol) setNamaCol(inspection.suggestions.namaCol);
        if (inspection.suggestions.nisCol) setNisCol(inspection.suggestions.nisCol);
      } catch {
        // Fallback
      }
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    if (!namaCol) {
      setError("Kolom Nama Lengkap wajib dipetakan.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await validateRosterAction(teachingContextId, formData, {
        namaCol,
        nisCol: nisCol || undefined,
      });
      // Initialize default choice for possible matches
      const mappedRows = res.rows.map((r) => ({
        ...r,
        userChoice: r.action === "POSSIBLE_MATCH" ? ("USE_EXISTING" as const) : undefined,
      }));
      setResults(mappedRows);
      setToken(res.token);
      setStep(2);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("#441") || msg.includes("Minified React error") || !msg) {
        setError("Terjadi kendala saat memvalidasi file. Silakan periksa kembali format spreadsheet Anda.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetUserChoice = (index: number, choice: "USE_EXISTING" | "CREATE_NEW") => {
    setResults((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        userChoice: choice,
      };
      return updated;
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await executeRosterImportAction(teachingContextId, results, token);
      toast.success(res.message || `${res.importedCount} siswa berhasil diimpor dan didaftarkan ke kelas.`);
      router.push(`/kelas/${teachingContextId}`);
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("#441") || msg.includes("Minified React error") || !msg) {
        setError("Sesi validasi telah kedaluwarsa atau terjadi kendala saat menyimpan. Silakan unggah ulang file Anda.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  const validCount = results.filter(
    (r) => r.status === "VALID" || (r.status === "WARNING" && r.action === "POSSIBLE_MATCH")
  ).length;
  const errorCount = results.filter((r) => r.status === "ERROR" || r.action === "AMBIGUOUS").length;

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Users className="h-5 w-5 text-indigo-600" />
          {step === 1 && "1. Upload & Pemetaan Kolom Daftar Siswa"}
          {step === 2 && "2. Pratinjau & Validasi Daftar Siswa"}
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
              <p className="text-xs text-muted-foreground mt-2">
                Pilih file Excel (XLSX, XLS) atau CSV (Maks. 500 baris)
              </p>
            </div>

            {file && (
              <div className="space-y-4 border p-4 rounded-lg bg-white">
                <h3 className="font-semibold text-sm text-slate-900">Pemetaan Kolom Spreadsheet</h3>
                <p className="text-xs text-muted-foreground">
                  Sesuaikan nama header kolom file Anda dengan nama data yang dibutuhkan sistem.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Kolom Nama Lengkap (Wajib)</label>
                    <Input
                      value={namaCol}
                      onChange={(e) => setNamaCol(e.target.value)}
                      placeholder="Contoh: Nama Lengkap"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Kolom NIS (Opsional)</label>
                    <Input
                      value={nisCol}
                      onChange={(e) => setNisCol(e.target.value)}
                      placeholder="Contoh: NIS"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200">
                <div className="text-xs font-medium">Siap Diimpor / Didaftarkan</div>
                <div className="text-2xl font-bold">{validCount}</div>
              </div>
              <div className="bg-rose-50 text-rose-800 p-3 rounded-lg border border-rose-200">
                <div className="text-xs font-medium">Format Salah / Error / Konflik (Dilewati)</div>
                <div className="text-2xl font-bold">{errorCount}</div>
              </div>
            </div>

            <div className="border rounded-lg max-h-[380px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Baris</TableHead>
                    <TableHead>Nama Lengkap</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resolusi / Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow
                      key={i}
                      className={
                        r.status === "ERROR" || r.action === "AMBIGUOUS"
                          ? "bg-rose-50/50"
                          : r.action === "POSSIBLE_MATCH"
                          ? "bg-amber-50/50"
                          : ""
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground">{r.rowNum}</TableCell>
                      <TableCell className="font-medium text-sm">{r.namaLengkap}</TableCell>
                      <TableCell className="text-sm text-slate-600">{r.nis || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            r.status === "VALID"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.action === "POSSIBLE_MATCH"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {r.action === "POSSIBLE_MATCH" ? "COCOK NAMA" : r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {r.action === "POSSIBLE_MATCH" ? (
                          <div className="space-y-1.5">
                            <div className="text-amber-900 font-medium flex items-center gap-1">
                              <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
                              Ditemukan nama siswa yang sama di sekolah:
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSetUserChoice(i, "USE_EXISTING")}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${
                                  r.userChoice === "USE_EXISTING"
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                Gunakan Siswa Ini
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetUserChoice(i, "CREATE_NEW")}
                                className={`px-2 py-1 text-xs rounded border transition-colors ${
                                  r.userChoice === "CREATE_NEW"
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                Buat Profil Baru
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{r.message}</span>
                        )}
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
              "Validasi File Siswa"
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
                Konfirmasi Impor ({validCount} Siswa)
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
