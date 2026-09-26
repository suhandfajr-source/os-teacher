"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
  Search,
  Save,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  AlertCircle,
  Loader2,
  Sparkles,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ReviewSubmissionForm } from "./ReviewSubmissionForm";
import {
  saveDirectAssignmentScoreAction,
  batchSaveDirectAssignmentScoresAction,
} from "@/modules/assignments/assignment.actions";
import type { TeacherQueueItem } from "@/modules/assignments/submission.service";

export interface StudentRosterItem {
  id: string; // studentId
  fullName: string;
  nis: string | null;
}

interface AssignmentRosterGradingViewProps {
  teachingContextId: string;
  assignmentId: string;
  roster: StudentRosterItem[];
  submissions: TeacherQueueItem[];
}

export function AssignmentRosterGradingView({
  teachingContextId,
  assignmentId,
  roster,
  submissions,
}: AssignmentRosterGradingViewProps) {
  const [activeTab, setActiveTab] = useState<"ROSTER" | "ONLINE">("ROSTER");
  const [searchQuery, setSearchQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  // Map submissions by studentId
  const submissionMap = useMemo(() => {
    const map = new Map<string, TeacherQueueItem>();
    submissions.forEach((s) => map.set(s.studentId, s));
    return map;
  }, [submissions]);

  // Local state for scores & feedbacks
  const [scores, setScores] = useState<Record<string, { score: string; feedback: string }>>(() => {
    const init: Record<string, { score: string; feedback: string }> = {};
    roster.forEach((st) => {
      const sub = submissionMap.get(st.id);
      init[st.id] = {
        score: sub?.score != null ? String(sub.score) : "",
        feedback: sub?.feedback || "",
      };
    });
    return init;
  });

  // Filtered roster
  const filteredRoster = useMemo(() => {
    if (!searchQuery.trim()) return roster;
    const q = searchQuery.toLowerCase();
    return roster.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        (s.nis && s.nis.toLowerCase().includes(q))
    );
  }, [roster, searchQuery]);

  const stats = useMemo(() => {
    let graded = 0;
    let onlineSubmitted = 0;
    roster.forEach((st) => {
      const sub = submissionMap.get(st.id);
      const curScore = scores[st.id]?.score;
      if (curScore && curScore.trim() !== "") graded++;
      if (sub && sub.status === "SUBMITTED") onlineSubmitted++;
    });
    return {
      total: roster.length,
      graded,
      ungraded: roster.length - graded,
      onlineSubmitted,
    };
  }, [roster, scores, submissionMap]);

  const handleScoreChange = (studentId: string, val: string) => {
    const cleanVal = val.replace(/[^0-9]/g, "");
    setScores((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        score: cleanVal,
      },
    }));
  };

  const handleFeedbackChange = (studentId: string, val: string) => {
    setScores((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        feedback: val,
      },
    }));
  };

  const handleSaveSingle = async (studentId: string, studentName: string) => {
    const item = scores[studentId];
    const numScore = item?.score?.trim() ? Number(item.score) : null;
    if (numScore !== null && (numScore < 0 || numScore > 100)) {
      toast.error("Skor harus antara 0 - 100");
      return;
    }

    try {
      setSavingId(studentId);
      const res = await saveDirectAssignmentScoreAction({
        teachingContextId,
        assignmentId,
        studentId,
        score: numScore,
        feedback: item?.feedback,
      });

      if (res.success) {
        toast.success(`Nilai ${studentName} berhasil disimpan`);
      } else {
        toast.error(res.error || "Gagal menyimpan nilai");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem saat menyimpan nilai");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSavingAll(true);
      const payload = roster.map((st) => {
        const item = scores[st.id];
        const numScore = item?.score?.trim() ? Number(item.score) : null;
        return {
          studentId: st.id,
          score: numScore,
          feedback: item?.feedback,
        };
      });

      const res = await batchSaveDirectAssignmentScoresAction({
        teachingContextId,
        assignmentId,
        items: payload,
      });

      if (res.success) {
        toast.success(`Berhasil menyimpan seluruh nilai (${res.updatedCount} siswa dinilai)`);
      } else {
        toast.error(res.error || "Gagal menyimpan nilai massal");
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan nilai massal");
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Navigation View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-1.5 rounded-2xl border">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("ROSTER")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "ROSTER"
                ? "bg-white text-teal-800 shadow-xs border border-teal-200"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-teal-600" />
            <span>Seluruh Siswa & Nilai Langsung ({stats.total})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ONLINE")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "ONLINE"
                ? "bg-white text-teal-800 shadow-xs border border-teal-200"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-teal-600" />
            <span>Pengumpulan Online ({submissions.length})</span>
            {stats.onlineSubmitted > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>
        </div>

        {activeTab === "ROSTER" && (
          <Button
            type="button"
            onClick={handleSaveAll}
            disabled={savingAll}
            size="sm"
            className="h-8 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-xl shadow-xs gap-1.5 self-end sm:self-auto"
          >
            {savingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Simpan Semua Nilai</span>
          </Button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: ROSTER & FAST DIRECT SCORING
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "ROSTER" && (
        <div className="space-y-3">
          {/* Quick Stats Bar & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-semibold rounded-lg border border-emerald-200">
                🟢 {stats.graded} Dinilai
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-semibold rounded-lg border border-slate-200">
                ⚪ {stats.ungraded} Belum Dinilai
              </span>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari siswa atau NIS..."
                className="pl-8 h-8 text-xs bg-card"
              />
            </div>
          </div>

          {/* Roster Table */}
          {filteredRoster.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl bg-card">
              Tidak ada siswa ditemukan di kelas ini.
            </div>
          ) : (
            <div className="border rounded-2xl bg-card overflow-hidden divide-y">
              {filteredRoster.map((st, idx) => {
                const sub = submissionMap.get(st.id);
                const item = scores[st.id];
                const isSaving = savingId === st.id;
                const hasScore = item?.score?.trim() !== "";

                return (
                  <div
                    key={st.id}
                    className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                      idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                    } ${hasScore ? "border-l-4 border-l-teal-600" : ""}`}
                  >
                    {/* Student Info & Submission Status */}
                    <div className="min-w-0 md:w-1/3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-6">
                          {idx + 1}.
                        </span>
                        <div className="truncate">
                          <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {st.fullName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-mono text-muted-foreground">
                              NIS: {st.nis || "—"}
                            </span>
                            {sub ? (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-4 ${
                                  sub.status === "SUBMITTED"
                                    ? "bg-amber-50 text-amber-700 border-amber-300"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-300"
                                }`}
                              >
                                {sub.status === "SUBMITTED"
                                  ? "Kumpul Online"
                                  : "Ternilai Online"}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                Nilai Langsung (Offline)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Feedback Input */}
                    <div className="md:w-1/3">
                      <Input
                        value={item?.feedback || ""}
                        onChange={(e) => handleFeedbackChange(st.id, e.target.value)}
                        placeholder="Catatan / umpan balik guru (opsional)..."
                        className="h-8 text-xs bg-background"
                      />
                    </div>

                    {/* Score Input & Save Action */}
                    <div className="flex items-center justify-end gap-2 md:w-1/3 shrink-0">
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={item?.score || ""}
                          onChange={(e) => handleScoreChange(st.id, e.target.value)}
                          placeholder="Skor 0-100"
                          className="w-24 h-8 text-xs font-bold text-center bg-background"
                          maxLength={3}
                        />
                        <span className="text-xs text-muted-foreground font-semibold">/100</span>
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleSaveSingle(st.id, st.fullName)}
                        disabled={isSaving}
                        size="sm"
                        variant={hasScore ? "outline" : "ghost"}
                        className={`h-8 px-2.5 text-xs font-semibold rounded-xl ${
                          hasScore
                            ? "text-teal-700 border-teal-200 bg-teal-50/50 hover:bg-teal-100"
                            : ""
                        }`}
                      >
                        {isSaving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : hasScore ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline ml-1">
                          {hasScore ? "Tersimpan" : "Simpan"}
                        </span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: ONLINE SUBMISSIONS DETAILED QUEUE
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "ONLINE" && (
        <div className="space-y-3">
          {submissions.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border rounded-2xl bg-card">
              Belum ada siswa yang mengunggah jawaban secara online pada tugas ini. Anda dapat
              memberikan nilai secara langsung melalui tab{" "}
              <strong
                className="text-teal-700 cursor-pointer underline"
                onClick={() => setActiveTab("ROSTER")}
              >
                Seluruh Siswa & Nilai Langsung
              </strong>
              .
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => (
                <div key={s.id} className="p-4 rounded-xl border bg-card space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {s.studentName}
                        {s.nis && (
                          <span className="ml-2 text-xs font-mono text-muted-foreground">
                            NIS {s.nis}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Dikumpulkan{" "}
                        {format(new Date(s.submittedAt), "dd MMM yyyy, HH:mm", {
                          locale: localeId,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.isLate && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          Terlambat
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          s.status === "SUBMITTED"
                            ? "text-amber-700 bg-amber-50 border-amber-200"
                            : "text-emerald-700 bg-emerald-50 border-emerald-200"
                        }`}
                      >
                        {s.status === "SUBMITTED" ? "Menunggu Koreksi" : "Sudah Dinilai"}
                      </span>
                    </div>
                  </div>

                  {(s.textContent || s.linkUrl) && (
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                      {s.textContent && (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {s.textContent}
                        </p>
                      )}
                      {s.linkUrl && (
                        <a
                          href={s.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline font-semibold"
                        >
                          🔗 {s.linkUrl}
                        </a>
                      )}
                    </div>
                  )}

                  <ReviewSubmissionForm teachingContextId={teachingContextId} item={s} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
