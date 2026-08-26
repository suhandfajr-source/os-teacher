"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  initializeAssessmentParticipants,
  saveAssessmentScores,
  recordRemedialAttempt,
  completeAssessment,
  updateAssessmentMetadata,
} from "@/modules/assessment/assessment.actions";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Play,
  Save,
  Users,
  Edit,
  History,
} from "lucide-react";
import type { Prisma } from "@prisma/client";

interface RemedialAttemptItem {
  id: string;
  score: Prisma.Decimal | number;
  note: string | null;
  attemptDate: Date;
}

interface AssessmentResultItem {
  id: string;
  studentId: string;
  status: "PENDING" | "GRADED" | "ABSENT" | "EXCUSED";
  rawScore: Prisma.Decimal | number | null;
  normalizedScore: Prisma.Decimal | number | null;
  finalScore: Prisma.Decimal | number | null;
  note: string | null;
  student: {
    id: string;
    fullName: string;
    nis: string | null;
  };
  remedialAttempts: RemedialAttemptItem[];
}

interface Props {
  assessment: {
    id: string;
    title: string;
    description: string | null;
    assessmentDate: Date;
    maxScore: Prisma.Decimal | number;
    minimumPassingScore: Prisma.Decimal | number | null;
    status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
    participantsInitializedAt: Date | null;
    assessmentType: {
      id: string;
      name: string;
      category: string;
    };
    teachingContext: {
      id: string;
      class: { name: string };
      subject: { name: string };
      academicPeriod: { year: string; semester: string };
    };
  };
  results: AssessmentResultItem[];
  stats: {
    totalParticipants: number;
    gradedCount: number;
    pendingCount: number;
    absentCount: number;
    excusedCount: number;
    averageScore: Prisma.Decimal | number | null;
    highestScore: Prisma.Decimal | number | null;
    lowestScore: Prisma.Decimal | number | null;
    tuntasCount: number | null;
    perluRemedialCount: number | null;
    masteryPercentage: Prisma.Decimal | number | null;
  };
}

type SaveStatus = "IDLE" | "DIRTY" | "SAVING" | "SAVED" | "ERROR";

export default function AssessmentDetailClient({ assessment, results, stats }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("SAVED");

  // Local working state for score entries
  const [rows, setRows] = useState<
    Record<
      string,
      {
        status: "PENDING" | "GRADED" | "ABSENT" | "EXCUSED";
        rawScore: string;
        note: string;
      }
    >
  >(() => {
    const map: Record<string, { status: "PENDING" | "GRADED" | "ABSENT" | "EXCUSED"; rawScore: string; note: string }> = {};
    for (const r of results) {
      map[r.studentId] = {
        status: r.status,
        rawScore: r.rawScore !== null ? String(Number(r.rawScore)) : "",
        note: r.note || "",
      };
    }
    return map;
  });

  // Track dirty changes
  const [isDirty, setIsDirty] = useState(false);

  // Remedial modal state
  const [activeRemedialResult, setActiveRemedialResult] = useState<AssessmentResultItem | null>(null);
  const [remedialScore, setRemedialScore] = useState("80");
  const [remedialNewFinalScore, setRemedialNewFinalScore] = useState("80");
  const [remedialNote, setRemedialNote] = useState("");

  // Edit KKTP / Metadata modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState(assessment.title);
  const [editDesc, setEditDesc] = useState(assessment.description || "");
  const [editKKTP, setEditKKTP] = useState(
    assessment.minimumPassingScore !== null ? String(Number(assessment.minimumPassingScore)) : ""
  );

  const maxScore = Number(assessment.maxScore);
  const kktp = assessment.minimumPassingScore !== null ? Number(assessment.minimumPassingScore) : null;
  const isCompleted = assessment.status === "COMPLETED";

  const handleInitialize = async () => {
    setLoading(true);
    try {
      await initializeAssessmentParticipants(assessment.id);
      toast.success("Peserta penilaian berhasil diinisialisasi!");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menginisialisasi peserta.");
    } finally {
      setLoading(false);
    }
  };

  const handleRowStatusChange = (studentId: string, status: "PENDING" | "GRADED" | "ABSENT" | "EXCUSED") => {
    setRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        rawScore: status === "GRADED" ? prev[studentId].rawScore || "0" : "",
      },
    }));
    setIsDirty(true);
    setSaveStatus("DIRTY");
  };

  const handleRowScoreChange = (studentId: string, value: string) => {
    setRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: value.trim() !== "" ? "GRADED" : "PENDING",
        rawScore: value,
      },
    }));
    setIsDirty(true);
    setSaveStatus("DIRTY");
  };

  const handleSaveScores = async () => {
    setLoading(true);
    setSaveStatus("SAVING");
    try {
      const payload = results.map((r) => {
        const row = rows[r.studentId];
        const raw = row.status === "GRADED" && row.rawScore.trim() !== "" ? parseFloat(row.rawScore) : null;
        return {
          studentId: r.studentId,
          status: row.status,
          rawScore: raw,
          note: row.note || null,
        };
      });

      await saveAssessmentScores({
        assessmentId: assessment.id,
        scores: payload,
      });

      toast.success("Nilai berhasil disimpan!");
      setIsDirty(false);
      setSaveStatus("SAVED");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan nilai.");
      setSaveStatus("ERROR");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordRemedial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRemedialResult) return;
    const scoreVal = parseFloat(remedialScore);
    const finalScoreVal = parseFloat(remedialNewFinalScore);

    if (isNaN(scoreVal) || isNaN(finalScoreVal) || scoreVal < 0 || scoreVal > 100 || finalScoreVal < 0 || finalScoreVal > 100) {
      toast.error("Nilai remedial dan nilai akhir baru harus di antara 0 dan 100.");
      return;
    }

    setLoading(true);
    try {
      await recordRemedialAttempt({
        assessmentResultId: activeRemedialResult.id,
        score: scoreVal,
        newFinalScore: finalScoreVal,
        note: remedialNote.trim() || null,
      });
      toast.success(`Nilai remedial ${activeRemedialResult.student.fullName} berhasil dicatat.`);
      setActiveRemedialResult(null);
      setRemedialNote("");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mencatat remedial.");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteAssessment = async () => {
    if (isDirty) {
      toast.error("Simpan perubahan nilai terlebih dahulu sebelum menyelesaikan penilaian.");
      return;
    }
    if (!confirm("Tandai penilaian ini sebagai Selesai (COMPLETED)? Semua siswa harus sudah memiliki status nilai, tidak hadir, atau dikecualikan.")) {
      return;
    }
    setLoading(true);
    try {
      await completeAssessment(assessment.id);
      toast.success("Penilaian berhasil diselesaikan (COMPLETED)!");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menyelesaikan penilaian.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const kktpVal = editKKTP.trim() !== "" ? parseFloat(editKKTP) : null;
      await updateAssessmentMetadata({
        assessmentId: assessment.id,
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        minimumPassingScore: kktpVal,
      });
      toast.success("Data penilaian berhasil diperbarui.");
      setShowEditModal(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui data penilaian.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6 pb-24">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            href={`/kelas/${assessment.teachingContext.id}/penilaian`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali ke Penilaian Kelas
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{assessment.title}</h1>
            <Badge variant="outline" className="text-sm">
              {assessment.assessmentType.name}
            </Badge>

            {assessment.status === "COMPLETED" && (
              <Badge className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Selesai (COMPLETED)
              </Badge>
            )}
            {assessment.status === "IN_PROGRESS" && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                <Clock className="w-3.5 h-3.5 mr-1" /> Sedang Berlangsung
              </Badge>
            )}
            {assessment.status === "DRAFT" && (
              <Badge variant="outline" className="text-muted-foreground">
                Draft
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {assessment.teachingContext.class.name} &bull; {assessment.teachingContext.subject.name} &bull;{" "}
            {format(new Date(assessment.assessmentDate), "dd MMMM yyyy", { locale: localeId })}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Info / KKTP
          </Button>

          {assessment.status === "IN_PROGRESS" && (
            <Button
              size="sm"
              variant="default"
              className="bg-green-600 hover:bg-green-700 font-semibold"
              onClick={handleCompleteAssessment}
              disabled={loading}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Selesaikan Penilaian
            </Button>
          )}
        </div>
      </div>

      {/* DRAFT STATE: Participant Initialization CTA */}
      {assessment.status === "DRAFT" && (
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardContent className="py-10 text-center space-y-4">
            <Users className="w-12 h-12 text-primary mx-auto" />
            <h2 className="text-xl font-bold">Mulai Penilaian & Siapkan Lembar Nilai</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Inisialisasi peserta akan mengambil daftar siswa aktif di kelas saat ini untuk dibuatkan lembar penilaian (snapshot historis).
            </p>
            <div className="pt-2">
              <Button size="lg" onClick={handleInitialize} disabled={loading} className="font-semibold shadow-sm">
                <Play className="w-4 h-4 mr-2 fill-current" />
                Mulai Penilaian (Inisialisasi Peserta)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* IN_PROGRESS or COMPLETED: Statistics Bar & Scoring Grid */}
      {assessment.status !== "DRAFT" && (
        <>
          {/* Statistics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3.5 text-center">
              <div className="text-xs text-muted-foreground">Peserta</div>
              <div className="text-xl font-bold mt-0.5">{stats.totalParticipants}</div>
            </Card>

            <Card className="p-3.5 text-center">
              <div className="text-xs text-muted-foreground">Sudah Dinilai</div>
              <div className="text-xl font-bold text-blue-600 mt-0.5">
                {stats.gradedCount} / {stats.totalParticipants}
              </div>
            </Card>

            <Card className="p-3.5 text-center">
              <div className="text-xs text-muted-foreground">Rata-rata</div>
              <div className="text-xl font-bold mt-0.5">
                {stats.averageScore ? Number(stats.averageScore).toFixed(1) : "—"}
              </div>
            </Card>

            <Card className="p-3.5 text-center">
              <div className="text-xs text-muted-foreground">Tertinggi / Terendah</div>
              <div className="text-sm font-semibold mt-1">
                {stats.highestScore ? Number(stats.highestScore).toFixed(0) : "—"} /{" "}
                {stats.lowestScore ? Number(stats.lowestScore).toFixed(0) : "—"}
              </div>
            </Card>

            <Card className="p-3.5 text-center">
              <div className="text-xs text-muted-foreground">Tuntas (KKTP: {kktp ?? "—"})</div>
              <div className="text-xl font-bold text-green-600 mt-0.5">
                {stats.tuntasCount !== null ? stats.tuntasCount : "—"}
              </div>
            </Card>

            <Card className="p-3.5 text-center">
              <div className="text-xs text-muted-foreground">% Ketuntasan</div>
              <div className="text-xl font-bold text-green-600 mt-0.5">
                {stats.masteryPercentage !== null ? `${Number(stats.masteryPercentage).toFixed(0)}%` : "—"}
              </div>
            </Card>
          </div>

          {/* Scoring Header & Feedback Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-4 rounded-lg border">
            <div>
              <h2 className="text-lg font-bold">Lembar Nilai Siswa</h2>
              <p className="text-xs text-muted-foreground">
                Skor maksimum: <strong>{maxScore}</strong>. Nilai akhir dihitung otomatis ke skala 0-100.
              </p>
            </div>

            {/* Save Status & Action */}
            <div className="flex items-center gap-3">
              <div className="text-xs">
                {saveStatus === "DIRTY" && <span className="text-amber-600 font-medium">● Belum Disimpan</span>}
                {saveStatus === "SAVING" && <span className="text-blue-600 font-medium">⏳ Menyimpan...</span>}
                {saveStatus === "SAVED" && <span className="text-green-600 font-medium">✓ Tersimpan</span>}
                {saveStatus === "ERROR" && <span className="text-red-600 font-medium">⚠️ Gagal Menyimpan</span>}
              </div>

              {!isCompleted && (
                <Button onClick={handleSaveScores} disabled={loading || !isDirty} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Simpan Nilai
                </Button>
              )}
            </div>
          </div>

          {/* Scoring Table (Desktop Spreadsheet Grid) */}
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="py-3 px-3 text-center font-semibold w-12">No</th>
                  <th className="py-3 px-4 text-left font-semibold">Nama Siswa</th>
                  <th className="py-3 px-3 text-left font-semibold w-24">NIS</th>
                  <th className="py-3 px-4 text-center font-semibold w-48">Status Kehadiran/Nilai</th>
                  <th className="py-3 px-4 text-center font-semibold w-36">
                    Skor Mentah (/{maxScore})
                  </th>
                  <th className="py-3 px-4 text-center font-semibold w-28">Nilai (0-100)</th>
                  <th className="py-3 px-3 text-center font-semibold w-28">Ketuntasan</th>
                  <th className="py-3 px-4 text-center font-semibold w-32">Remedial</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {results.map((r, idx) => {
                  const row = rows[r.studentId] || { status: "PENDING", rawScore: "", note: "" };
                  const rawNum = parseFloat(row.rawScore);
                  const isValidRaw = !isNaN(rawNum) && rawNum >= 0 && rawNum <= maxScore;
                  const normalized = isValidRaw ? ((rawNum / maxScore) * 100).toFixed(1) : null;
                  const finalScoreDisplay = r.finalScore !== null ? Number(r.finalScore).toFixed(1) : normalized;

                  const isTuntas = kktp !== null && finalScoreDisplay !== null ? parseFloat(finalScoreDisplay) >= kktp : null;

                  return (
                    <tr key={r.studentId} className="hover:bg-slate-50/50">
                      <td className="py-3 px-3 text-center text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="py-3 px-4 font-medium">
                        <Link href={`/siswa/${r.studentId}`} className="hover:underline text-primary">
                          {r.student.fullName}
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{r.student.nis || "—"}</td>

                      {/* Status Pills */}
                      <td className="py-3 px-4 text-center">
                        {isCompleted ? (
                          <Badge variant="outline" className="text-xs">
                            {r.status === "GRADED" && "Dinilai"}
                            {r.status === "ABSENT" && "Tidak Hadir"}
                            {r.status === "EXCUSED" && "Dikecualikan"}
                            {r.status === "PENDING" && "Belum Dinilai"}
                          </Badge>
                        ) : (
                          <div className="inline-flex rounded-md shadow-sm border p-0.5 bg-slate-100 text-xs">
                            <button
                              type="button"
                              onClick={() => handleRowStatusChange(r.studentId, "GRADED")}
                              className={`px-2 py-1 rounded font-medium ${
                                row.status === "GRADED" ? "bg-white text-primary shadow-xs" : "text-muted-foreground"
                              }`}
                            >
                              Dinilai
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRowStatusChange(r.studentId, "ABSENT")}
                              className={`px-2 py-1 rounded font-medium ${
                                row.status === "ABSENT" ? "bg-white text-red-600 shadow-xs" : "text-muted-foreground"
                              }`}
                            >
                              Tidak Hadir
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRowStatusChange(r.studentId, "EXCUSED")}
                              className={`px-2 py-1 rounded font-medium ${
                                row.status === "EXCUSED" ? "bg-white text-amber-600 shadow-xs" : "text-muted-foreground"
                              }`}
                            >
                              Dikecualikan
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Raw Score Input */}
                      <td className="py-3 px-4 text-center">
                        {isCompleted ? (
                          <span className="font-semibold text-sm">
                            {r.rawScore !== null ? Number(r.rawScore) : "—"}
                          </span>
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            max={maxScore}
                            step="0.5"
                            placeholder="0"
                            value={row.rawScore}
                            disabled={row.status === "ABSENT" || row.status === "EXCUSED"}
                            onChange={(e) => handleRowScoreChange(r.studentId, e.target.value)}
                            className={`w-24 mx-auto text-center h-8 ${
                              row.status === "ABSENT" || row.status === "EXCUSED" ? "bg-slate-100 text-muted-foreground" : ""
                            }`}
                          />
                        )}
                      </td>

                      {/* Calculated 0-100 Normalization & Final Score */}
                      <td className="py-3 px-4 text-center font-bold text-sm">
                        {row.status === "GRADED" && finalScoreDisplay !== null ? (
                          <span>{finalScoreDisplay}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs font-normal">—</span>
                        )}
                      </td>

                      {/* Mastery KKTP Badge */}
                      <td className="py-3 px-3 text-center">
                        {kktp !== null && row.status === "GRADED" && isTuntas !== null ? (
                          isTuntas ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[11px]">
                              Tuntas
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[11px]">
                              Remedial
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Remedial Action Button */}
                      <td className="py-3 px-4 text-center">
                        {r.status === "GRADED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setActiveRemedialResult(r);
                              const initialNewScore = r.finalScore ? String(Number(r.finalScore)) : "80";
                              setRemedialScore(initialNewScore);
                              setRemedialNewFinalScore(initialNewScore);
                            }}
                          >
                            <History className="w-3 h-3 mr-1" />
                            {r.remedialAttempts.length > 0
                              ? `Remedial (${r.remedialAttempts.length})`
                              : "Remedial"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Remedial Modal / Drawer */}
      {activeRemedialResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold">Catat Remedial Siswa</h3>
                <p className="text-xs text-muted-foreground">
                  {activeRemedialResult.student.fullName} ({activeRemedialResult.student.nis || "Tanpa NIS"})
                </p>
              </div>
              <Badge variant="outline">{assessment.title}</Badge>
            </div>

            {/* Baseline Scores */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border text-xs">
              <div>
                <span className="text-muted-foreground">Skor Asli (Terkunci):</span>
                <div className="font-bold text-sm">
                  {activeRemedialResult.rawScore !== null ? Number(activeRemedialResult.rawScore) : "—"} / {maxScore}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Nilai Saat Ini:</span>
                <div className="font-bold text-sm text-primary">
                  {activeRemedialResult.finalScore !== null ? Number(activeRemedialResult.finalScore).toFixed(1) : "—"}
                </div>
              </div>
            </div>

            {/* Past Attempts History */}
            {activeRemedialResult.remedialAttempts.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">Riwayat Remedial Sebelumnya:</div>
                <div className="max-h-32 overflow-y-auto space-y-1.5 border rounded p-2 bg-slate-50">
                  {activeRemedialResult.remedialAttempts.map((att, idx) => (
                    <div key={att.id} className="text-xs flex justify-between items-center py-1 border-b last:border-0">
                      <span>
                        Percobaan {activeRemedialResult.remedialAttempts.length - idx} &bull;{" "}
                        {format(new Date(att.attemptDate), "dd/MM/yyyy")}
                        {att.note && <span className="text-muted-foreground ml-1">({att.note})</span>}
                      </span>
                      <Badge variant="secondary" className="font-bold">
                        Skor: {Number(att.score)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleRecordRemedial} className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Skor Tes Remedial (0-100) *</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={remedialScore}
                    onChange={(e) => setRemedialScore(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Nilai Akhir Baru (0-100) *</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={remedialNewFinalScore}
                    onChange={(e) => setRemedialNewFinalScore(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Catatan Remedial (Opsional)</label>
                <Input
                  placeholder="Contoh: Remedial tes lisan bab zakat fitrah"
                  value={remedialNote}
                  onChange={(e) => setRemedialNote(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setActiveRemedialResult(null)}>
                  Batal
                </Button>
                <Button type="submit" disabled={loading} className="font-semibold">
                  Simpan Hasil Remedial
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Info / KKTP Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold">Edit Informasi Penilaian & KKTP</h3>
            <form onSubmit={handleSaveMetadata} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Judul Penilaian</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Deskripsi</label>
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">KKTP (0-100, kosongkan jika tanpa KKTP)</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editKKTP}
                  placeholder="Contoh: 75"
                  onChange={(e) => setEditKKTP(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={loading}>
                  Simpan Perubahan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
