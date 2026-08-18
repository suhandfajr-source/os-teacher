"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { validateImportFile, confirmImport, ValidationResult } from "@/modules/students/import.actions";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";

export default function ImportSiswaFlow({ teachingContextId }: { teachingContextId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  
  // Mapping
  const [namaCol, setNamaCol] = useState("Nama Lengkap");
  const [nisCol, setNisCol] = useState("");
  
  // Validation Results
  const [results, setResults] = useState<ValidationResult[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError("");
      // Reset state if they upload a new file
      setStep(1);
      setResults([]);
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

      const res = await validateImportFile(teachingContextId, formData, { namaCol, nisCol });
      setResults(res.results);
      setStep(2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat validasi file.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await confirmImport(teachingContextId, results);
      toast.success(`${res.importedCount} siswa berhasil diimport dan didaftarkan ke kelas.`);
      router.push(`/kelas/${teachingContextId}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan saat import.");
      setLoading(false);
    }
  };

  const validCount = results.filter(r => r.status === "VALID" || r.status === "WARNING").length;
  const errorCount = results.filter(r => r.status === "ERROR").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {step === 1 && "1. Upload & Mapping"}
          {step === 2 && "2. Pratinjau & Validasi"}
          {step === 3 && "3. Selesai"}
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
            <div className="border-2 border-dashed p-6 rounded-md text-center bg-slate-50">
              <Input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileChange}
                className="max-w-xs mx-auto"
              />
              <p className="text-sm text-muted-foreground mt-2">Pilih file Excel (XLSX, XLS)</p>
            </div>

            {file && (
              <div className="space-y-4 border p-4 rounded-md">
                <h3 className="font-medium text-lg">Pemetaan Kolom (Jika Header Berbeda)</h3>
                <p className="text-sm text-muted-foreground">Ketik nama header di file Anda yang sesuai.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Kolom Nama Lengkap (Wajib)</label>
                    <Input 
                      value={namaCol} 
                      onChange={e => setNamaCol(e.target.value)} 
                      placeholder="Contoh: Nama Lengkap" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Kolom NIS (Opsional)</label>
                    <Input 
                      value={nisCol} 
                      onChange={e => setNisCol(e.target.value)} 
                      placeholder="Contoh: NIS" 
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex gap-4 mb-4">
              <div className="bg-green-50 text-green-700 px-4 py-2 rounded-md border border-green-200">
                <div className="text-sm font-medium">Siap Import</div>
                <div className="text-2xl font-bold">{validCount}</div>
              </div>
              <div className="bg-red-50 text-red-700 px-4 py-2 rounded-md border border-red-200">
                <div className="text-sm font-medium">Error (Dilewati)</div>
                <div className="text-2xl font-bold">{errorCount}</div>
              </div>
            </div>

            <div className="border rounded-md max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Baris</TableHead>
                    <TableHead>Nama Lengkap</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pesan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i} className={r.status === "ERROR" ? "bg-red-50" : r.status === "WARNING" ? "bg-amber-50" : ""}>
                      <TableCell>{r.rowNum}</TableCell>
                      <TableCell className="font-medium">{r.namaLengkap}</TableCell>
                      <TableCell>{r.nis || "-"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          r.status === "VALID" ? "bg-green-100 text-green-800" :
                          r.status === "WARNING" ? "bg-amber-100 text-amber-800" :
                          "bg-red-100 text-red-800"
                        }`}>
                          {r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {step === 2 && (
          <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
            Kembali
          </Button>
        )}
        {step === 1 && (
          <Button onClick={handleValidate} disabled={!file || loading} className="ml-auto">
            {loading ? "Memvalidasi..." : "Validasi File"}
          </Button>
        )}
        {step === 2 && (
          <Button onClick={handleConfirm} disabled={loading || validCount === 0}>
            {loading ? "Mengimpor..." : `Konfirmasi Import (${validCount} Siswa)`}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
