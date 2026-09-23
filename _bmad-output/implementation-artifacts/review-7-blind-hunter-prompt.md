# Review Task: Blind Hunter — Story 7 (jalankan di session LLM terpisah)

Conduct a review of CONTENT.
Look for what's missing, not only what's wrong.
Compute your finding floor N from the diff's size: N = min(floor(sqrt(kB) + 1), 10), where kB is the diff size in kilobytes. State the arithmetic in one line, then find at least N issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If the content is empty, stop and say so.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.

CONTENT: the unified diff below.

```diff
diff --git a/_bmad-output/specs/spec-student-portal-auth/.memlog.md b/_bmad-output/specs/spec-student-portal-auth/.memlog.md
index 876d004..7cd01a4 100644
--- a/_bmad-output/specs/spec-student-portal-auth/.memlog.md
+++ b/_bmad-output/specs/spec-student-portal-auth/.memlog.md
@@ -63,3 +63,5 @@ updated: 2026-09-20T14:49
 - (event) Story 1a implemented: schema +8/+3/+1 kolom + audit_log; migrasi student_portal_foundation (murni aditif) di-apply ke lokal klassa_dev (db execute) DAN Neon (db execute + migrate resolve, persetujuan human, direct URL); insiden drift schedule/prosem pra-existing terdokumentasi; 475/475 hijau, tsc bersih
 - (decision) Checkpoint flags: hanya 1a membawa spec_checkpoint+done_checkpoint (fondasi berisiko); 1b/1c sengaja tanpa flag karena sudah ter-elicitasi 2x (keputusan 2026-09-20, kini tercatat eksplisit — temuan BH10)
 - (event) Review pass 1 Story 1a (3 reviewer eksternal): 15 temuan, 2 rejected, 8 defer, bad_spec loopback #1 (prosedur migrate-dev basi diamendemen di 1a/1c/stories.yaml; KEEP: schema+migrasi byte-identik, nol delta kode)
+- (event) Story 7 spec ditulis (stories/7-student-progress-gelombang-2.md, route full): investigasi menemukan GradePolicy/GradePolicyItem + calculateStudentRunningPerformance sudah ada di backend (assessment.service) — open question KKTP terjawab via benang merah bobot
+- (decision) Keputusan terkunci Story 7 (human, 2026-09-23): (1) nilai berjalan per mapel = reuse bobot GradePolicy ACTIVE via calculateStudentRunningPerformance, fallback flat berlabel saat policy DRAFT; (2) pohon ketuntasan TP = proporsi KKTP per penilaian ("x dari y tuntas"), penilaian tanpa KKTP dikecualikan dari proporsi; (3) bottom nav 6 item tambah "Nilai" (amendemen ringan CAP-5); (4) presensi LATE dihitung H + keterangan telat
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/7-student-progress-gelombang-2.md b/_bmad-output/specs/spec-student-portal-auth/stories/7-student-progress-gelombang-2.md
new file mode 100644
index 0000000..f97cff7
--- /dev/null
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/7-student-progress-gelombang-2.md
@@ -0,0 +1,110 @@
+---
+title: 'Story 7 — Student Progress (Gelombang 2)'
+type: 'feature'
+created: '2026-09-23'
+status: 'in-review'
+route: 'full'
+review_loop_iteration: 0
+baseline_commit: '4a4d347b1d2f07bbba5a590d26b09ed43c51787b'
+context:
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/glossary.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/execution-stages.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/portal-modules.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** CAP-9 belum terwujud — siswa belum bisa melihat capaian belajarnya: nilai FINAL per mapel & pohon ketuntasan TP, rekap presensi bulanan, dan widget ketuntasan di beranda (daftar tugas read-only modul 2.3 sudah terbangun di Story 4).
+
+**Approach:** Bangun service agregasi murni (FINAL-only) + action portal berbasis sesi, halaman "Nilai" (pohon ketuntasan TP per mapel + tren + tab presensi bulanan), dan widget ketuntasan ringkas di beranda. Tanpa skema baru — murni agregasi atas tabel existing.
+
+## Boundaries & Constraints
+
+**Always:**
+- Nilai FINAL kanonik (glossary.md): `AssessmentResult.status === 'GRADED'` **DAN** parent `Assessment.status === 'COMPLETED'` — query wajib join keduanya; memfilter `AssessmentResult` saja tidak cukup.
+- Semua query di-scope ke periode aktif rombel (pola resolusi membership `student-portal.actions.ts`); `studentId` selalu di-derive dari `verifyStudentSession()`.
+- Skor null/ABSENT/EXCUSED/PENDING dikecualikan, tidak pernah dikonversi jadi 0 (amandemen 2–4; pola `summarizeStudentAssessments`).
+- Unit test membuktikan nilai non-FINAL tidak bocor ke agregasi mana pun (pohon, tren, widget).
+- N9 regresi nol: `/q/[token]` & `/parent/*` tetap hijau.
+
+**Keputusan terkunci (human, 2026-09-23):**
+1. **Nilai berjalan per mapel + tren** = reuse bobot `GradePolicy` (status ACTIVE) via `calculateStudentRunningPerformance()` — angka siswa identik dengan leger guru. Policy DRAFT/tidak ada → fallback rata-rata flat semua nilai FINAL dengan label kecil "rata-rata sederhana — bobot belum diatur guru".
+2. **Pohon ketuntasan TP** = proporsi KKTP per penilaian: tiap penilaian FINAL dengan `minimumPassingScore` dinilai tuntas bila `finalScore` ≥ KKTP-nya; TP menampilkan "x dari y penilaian tuntas", status TUNTAS bila semua tuntas; penilaian tanpa KKTP hanya menyumbang skor/tren, dikecualikan dari proporsi ketuntasan.
+3. **Bottom nav 6 item** — tambah item "Nilai" (amendemen ringan constraint CAP-5 yang 5 item).
+4. **Presensi `LATE`** dihitung sebagai H (hadir); jumlah telat tampil sebagai keterangan.
+
+**Never:**
+- Tanpa migrasi/skema baru (termasuk TIDAK membuat model GradePolicy baru — agregasi memakai kolom existing).
+- Tanpa jalur tulis apa pun dari sisi siswa (modul 2.1/2.2/2.4 bersifat pasif).
+- `StudentMonitoringNote`, Prota/Prosem, dan identitas sunting mandiri tidak tampil (§4.4).
+- Tidak mengubah signature `startQuizAttemptAction` maupun action quiz Story 4.
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected Output / Behavior | Error Handling |
+|----------|--------------|---------------------------|----------------|
+| HAPPY_PATH | Siswa ACTIVE, enrollment periode aktif, ada assessment FINAL terkait TP | Nilai berbobot per mapel (GradePolicy ACTIVE; fallback flat berlabel), pohon ketuntasan per TP "x dari y tuntas" (KKTP per penilaian), tren nilai, info remedial | — |
+| NON-FINAL leak | `AssessmentResult` GRADED pada `Assessment` IN_PROGRESS/DRAFT | Tidak muncul di pohon/tren/widget mana pun | Unit test wajib membuktikan |
+| Skor null / ABSENT / EXCUSED / PENDING | Result non-GRADED | Dikecualikan dari agregasi; bukan 0 | — |
+| TP tanpa penilaian FINAL | LO tanpa link assessment FINAL | Tampil "belum dinilai", bukan 0% | — |
+| Assessment tanpa `minimumPassingScore` | KKTP null | Hanya menyumbang skor/tren; dikecualikan dari proporsi ketuntasan TP (keputusan terkunci #2) | — |
+| Siswa tanpa periode aktif / PENDING | Membership hanya periode lama / belum disetujui | Keadaan kosong aman (pola `hasActivePeriod`) | Tanpa error |
+| Presensi bulanan tanpa record | Bulan tanpa `AttendanceRecord` | Rekap H/S/I/A = 0; `LATE` dipetakan sesuai keputusan ③ | — |
+| Widget beranda | Mapel tanpa data FINAL | Mapel di-skip/ditandai "belum ada nilai" (bukan 0%) | — |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `src/modules/student-portal/student-portal.actions.ts` — pola referensi: resolusi membership prioritas periode ACTIVE, action berbasis `verifyStudentSession()`; dashboard action = tempat widget 2.4 menempel.
+- `src/modules/monitoring/monitoring.service.ts` — `summarizeStudentAssessments`: logika FINAL kanonik + KKTP (`finalScore < minimumPassingScore` per assessment); pola referensi, JANGAN diubah.
+- `src/modules/assessment/assessment.service.ts` — `calculateStudentRunningPerformance()`: nilai berjalan berbobot (GradePolicy) dengan gating FINAL kanonik + `availableWeight` data parsial — REUSE untuk nilai per mapel; jangan tulis ulang logika bobot.
+- `src/modules/reporting/reporting.actions.ts` (`getScoreRecapReport`) — pola pemuatan GradePolicy (`findUnique` + items, `hasActiveGradePolicy`) — referensi cara query policy.
+- `prisma/schema.prisma` — `Assessment` (status, `minimumPassingScore` nullable), `AssessmentResult` (finalScore, status, `@@unique[assessmentId,studentId]`), `AssessmentLearningObjective` (snapshotCode/Description), `LearningObjective` (code, description, orderIndex, targetSemester), `RemedialAttempt` (score), `AttendanceRecord` (status: PRESENT/SICK/PERMISSION/ABSENT/LATE), `Assignment`, `GradePolicy`/`GradePolicyItem` (bobot per jenis penilaian, status DRAFT/ACTIVE).
+- `src/app/siswa/portal/*` — halaman existing (layout + `StudentBottomNav`); `tugas/page.tsx` = modul 2.3 sudah jadi (read-only, scope periode aktif).
+- `src/components/student/StudentBottomNav.tsx` — kini 5 item (Hari Ini, Jadwal, Kuis, Tugas, Profil); tambah item "Nilai" jadi 6 (keputusan terkunci #3).
+- `src/modules/student-portal/__tests__/story-4-full-audit.int.test.ts` + `student-portal.actions.test.ts` — pola suite real-db & unit test.
+- `src/modules/attendance/`, `TeachingSession` — sumber data presensi per sesi.
+
+## Tasks & Acceptance
+
+**Execution:**
+- [x] `src/modules/student-portal/student-progress.service.ts` (BARU) — agregasi murni tanpa DB: pohon ketuntasan per mapel (LO ⇄ `AssessmentLearningObjective` ⇄ result FINAL-only, proporsi KKTP per penilaian), nilai berjalan via reuse `calculateStudentRunningPerformance` + fallback flat berlabel, tren, ringkasan widget, rekap presensi bulanan (LATE→H + keterangan) — unit-testable.
+- [x] `src/modules/student-portal/student-progress.actions.ts` (BARU) — action berbasis sesi: verifikasi → scope periode aktif → query Prisma (termasuk GradePolicy per mapel) → delegasi ke service; return shape untuk halaman Nilai + widget beranda.
+- [x] `src/app/siswa/portal/nilai/page.tsx` (BARU) — UI pohon ketuntasan per mapel + nilai berjalan + tren + info remedial + tab Presensi; empty state aman tanpa periode aktif.
+- [x] `src/components/student/StudentBottomNav.tsx` + beranda — nav 6 item (tambah "Nilai") & widget ketuntasan ringkas (2.4).
+- [x] `src/modules/student-portal/__tests__/student-progress.service.test.ts` (BARU) — unit test matriks di atas: non-FINAL tak bocor, null≠0, TP kosong, KKTP null dikecualikan dari proporsi, fallback flat saat policy non-ACTIVE, LATE→H.
+- [x] `src/modules/student-portal/__tests__/story-7-progress.int.test.ts` (BARU) — suite real-db rantai DoD: guru finalisasi assessment (COMPLETED + GRADED) → siswa (sesi) melihat nilai di pohon; regresi titik FINAL ganda.
+
+**Acceptance Criteria:**
+- Given assessment masih IN_PROGRESS dengan result GRADED, when siswa membuka Nilai/widget, then nilai itu tidak tampil di agregasi mana pun.
+- Given guru finalisasi assessment (COMPLETED + result GRADED) untuk TP tertentu, when siswa membuka halaman Nilai, then nilai muncul pada TP terkait (rantai int-test).
+- Given request data progress, then `studentId` berasal dari sesi — parameter identitas klien diabaikan.
+- `tsc` bersih; seluruh test hijau; `/q/[token]` & `/parent/*` tetap hijau (N9).
+
+## Implementation Notes
+
+- Widget action awalnya skip pemuatan TP tree (`includeTpTree: false`), tapi widget beranda menampilkan "TP tuntas x/y" — diubah ke `true` (ditemukan via int test gagal `tuntasTpCount`).
+- Query assessment difilter `status: COMPLETED` di level Prisma (proteksi pertama); gating FINAL ganda tetap ditegakkan di service via `isFinalScore` (proteksi kedua) — sesuai boundary "join keduanya".
+- Baris matriks "siswa tanpa periode aktif" diuji dengan 2 siswa tambahan di int test: tanpa membership rombel & hanya membership periode INACTIVE — keduanya kembali keadaan kosong aman.
+- `pinUpdatedAt` dihitung non-null via `!` pada student test fixtures (schema selalu terisi pada jalur klaim/login).
+
+## Spec Change Log
+
+## Review Triage Log
+
+## Design Notes
+
+- Snapshot fallback: render pakai `LearningObjective` live (status ACTIVE); bila LO terhapus/non-ACTIVE, fallback ke `snapshotCode`/`snapshotDescription` di `AssessmentLearningObjective`.
+- `RemedialAttempt` tampil sebagai info tambahan (skor percobaan terakhir) — TIDAK mengubah `finalScore` maupun status ketuntasan (konsisten sisi guru yang hanya menghitung `remedialCount`).
+- Agregasi presensi: group by bulan kalender dari `TeachingSession` periode aktif; default bulan berjalan + navigasi bulan.
+
+## Verification
+
+**Commands:**
+- `npx tsc --noEmit` — expected: bersih tanpa error.
+- `npm test` — expected: semua suite hijau termasuk unit & int test baru (DoD Tahap 7: unit test agregasi + non-FINAL tak bocor + rantai finalisasi→siswa).
+
diff --git a/src/app/siswa/portal/nilai/page.tsx b/src/app/siswa/portal/nilai/page.tsx
new file mode 100644
index 0000000..61dcc73
--- /dev/null
+++ b/src/app/siswa/portal/nilai/page.tsx
@@ -0,0 +1,364 @@
+"use client";
+
+import React, { useEffect, useState } from "react";
+import Link from "next/link";
+import {
+  TrendingUp,
+  RefreshCw,
+  AlertCircle,
+  ChevronDown,
+  ChevronLeft,
+  ChevronRight,
+  CalendarCheck,
+  Award,
+  BookOpen,
+  ArrowRight,
+} from "lucide-react";
+import {
+  getStudentProgressDataAction,
+  type StudentProgressPageData,
+} from "@/modules/student-portal/student-progress.actions";
+import type { SubjectProgress, MonthlyAttendanceRecap, TpMasteryItem } from "@/modules/student-portal/student-progress.service";
+import { Button } from "@/components/ui/button";
+
+const MONTH_NAMES = [
+  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
+  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
+];
+
+function TpStatusBadge({ tp }: { tp: TpMasteryItem }) {
+  if (tp.status === "TUNTAS") {
+    return (
+      <span className="shrink-0 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
+        ✓ {tp.masteredCount}/{tp.assessedCount} Tuntas
+      </span>
+    );
+  }
+  if (tp.status === "BELUM_TUNTAS") {
+    return (
+      <span className="shrink-0 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
+        {tp.masteredCount}/{tp.assessedCount} Tuntas
+      </span>
+    );
+  }
+  if (tp.status === "TANPA_KKTP") {
+    return (
+      <span className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
+        Dinilai
+      </span>
+    );
+  }
+  return (
+    <span className="shrink-0 text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
+      Belum Dinilai
+    </span>
+  );
+}
+
+function SubjectCard({ subject }: { subject: SubjectProgress }) {
+  const [open, setOpen] = useState(false);
+  const hasData = subject.finalCount > 0;
+  const maxTrend = Math.max(100, ...subject.trend.map((t) => t.score));
+
+  return (
+    <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden">
+      <button
+        onClick={() => setOpen((v) => !v)}
+        className="w-full p-4 flex items-start justify-between gap-3 text-left"
+      >
+        <div className="space-y-1 min-w-0">
+          <div className="flex items-center gap-1.5">
+            <h3 className="text-sm font-black text-slate-900 truncate">{subject.subjectName}</h3>
+          </div>
+          <p className="text-[11px] text-slate-500 truncate">
+            {subject.teacherName || "Guru Pengampu"} • {subject.finalCount} nilai final
+          </p>
+          {hasData ? (
+            <div className="flex items-center gap-1.5 flex-wrap">
+              <span className="text-xl font-black text-[#0F766E]">
+                {subject.runningScore !== null ? subject.runningScore : "–"}
+              </span>
+              <span
+                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
+                  subject.scoringMode === "WEIGHTED"
+                    ? "text-teal-700 bg-teal-50 border-teal-200/70"
+                    : "text-slate-500 bg-slate-50 border-slate-200"
+                }`}
+                title={
+                  subject.scoringMode === "WEIGHTED"
+                    ? `Rata-rata berbobot guru (bobot terpasang: ${subject.availableWeight ?? 0}%)`
+                    : undefined
+                }
+              >
+                {subject.scoringMode === "WEIGHTED" ? "rata-rata berbobot" : "rata-rata sederhana — bobot belum diatur guru"}
+              </span>
+            </div>
+          ) : (
+            <span className="text-[11px] font-medium text-slate-400">Belum ada nilai final</span>
+          )}
+        </div>
+        <ChevronDown
+          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
+        />
+      </button>
+
+      {open && (
+        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
+          {/* Tren nilai */}
+          {subject.trend.length > 0 && (
+            <div className="space-y-1.5">
+              <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tren Nilai</h4>
+              <div className="flex items-end gap-1.5 h-20">
+                {subject.trend.slice(-8).map((t) => (
+                  <div key={t.assessmentId} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
+                    <div
+                      className="w-full rounded-t-lg bg-gradient-to-t from-[#0F766E] to-teal-400 min-h-[4px]"
+                      style={{ height: `${Math.max(6, (t.score / maxTrend) * 64)}px` }}
+                      title={`${t.title}: ${t.score}`}
+                    />
+                    <span className="text-[9px] font-bold text-slate-500 truncate w-full text-center">
+                      {t.score}
+                    </span>
+                  </div>
+                ))}
+              </div>
+            </div>
+          )}
+
+          {/* Pohon ketuntasan TP */}
+          <div className="space-y-1.5">
+            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
+              Ketuntasan TP (Tujuan Pembelajaran)
+            </h4>
+            {subject.tpTree.length === 0 ? (
+              <p className="text-[11px] text-slate-400 py-1">
+                Guru belum menetapkan TP untuk mapel ini.
+              </p>
+            ) : (
+              <div className="space-y-1.5">
+                {subject.tpTree.map((tp) => (
+                  <div
+                    key={tp.learningObjectiveId}
+                    className="p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 flex items-start justify-between gap-2"
+                  >
+                    <div className="min-w-0 space-y-0.5">
+                      <p className="text-[11px] font-bold text-slate-800 leading-snug">
+                        {tp.code ? `${tp.code} — ` : ""}
+                        {tp.description}
+                      </p>
+                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
+                        {tp.averageScore !== null && <span>rata-rata {tp.averageScore}</span>}
+                        {tp.remedialCount > 0 && (
+                          <span className="text-amber-600">remedial: {tp.remedialCount}×</span>
+                        )}
+                      </div>
+                    </div>
+                    <TpStatusBadge tp={tp} />
+                  </div>
+                ))}
+              </div>
+            )}
+          </div>
+        </div>
+      )}
+    </div>
+  );
+}
+
+function AttendanceTab({ attendance }: { attendance: MonthlyAttendanceRecap[] }) {
+  const [idx, setIdx] = useState(0);
+  const current = attendance[idx];
+
+  if (attendance.length === 0) {
+    return (
+      <div className="p-5 bg-white rounded-3xl border border-slate-200/80 text-center space-y-1.5">
+        <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
+          <CalendarCheck className="w-5 h-5" />
+        </div>
+        <h3 className="text-xs font-bold text-slate-800">Belum Ada Data Presensi</h3>
+        <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
+          Rekap kehadiran muncul setelah guru mencatat presensi pada sesi pembelajaran.
+        </p>
+      </div>
+    );
+  }
+
+  const items: Array<{ label: string; value: number; color: string }> = [
+    { label: "Hadir", value: current.hadir, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
+    { label: "Sakit", value: current.sakit, color: "text-sky-600 bg-sky-50 border-sky-200" },
+    { label: "Izin", value: current.izin, color: "text-amber-600 bg-amber-50 border-amber-200" },
+    { label: "Alpa", value: current.alpa, color: "text-rose-600 bg-rose-50 border-rose-200" },
+  ];
+
+  return (
+    <div className="space-y-3">
+      <div className="flex items-center justify-between">
+        <button
+          onClick={() => setIdx((i) => Math.min(attendance.length - 1, i + 1))}
+          disabled={idx >= attendance.length - 1}
+          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 disabled:opacity-30"
+          aria-label="Bulan berikutnya"
+        >
+          <ChevronLeft className="w-4 h-4" />
+        </button>
+        <h3 className="text-xs font-black text-slate-800">
+          {MONTH_NAMES[current.month - 1]} {current.year}
+        </h3>
+        <button
+          onClick={() => setIdx((i) => Math.max(0, i - 1))}
+          disabled={idx <= 0}
+          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 disabled:opacity-30"
+          aria-label="Bulan sebelumnya"
+        >
+          <ChevronRight className="w-4 h-4" />
+        </button>
+      </div>
+
+      <div className="grid grid-cols-4 gap-2">
+        {items.map((it) => (
+          <div key={it.label} className={`p-3 rounded-2xl border text-center space-y-1 ${it.color}`}>
+            <p className="text-xl font-black">{it.value}</p>
+            <p className="text-[10px] font-bold uppercase tracking-wide">{it.label}</p>
+          </div>
+        ))}
+      </div>
+
+      {current.lateCount > 0 && (
+        <p className="text-[11px] text-amber-600 font-medium px-1">
+          Termasuk {current.lateCount}× hadir terlambat.
+        </p>
+      )}
+    </div>
+  );
+}
+
+export default function StudentProgressPage() {
+  const [data, setData] = useState<StudentProgressPageData | null>(null);
+  const [loading, setLoading] = useState(true);
+  const [error, setError] = useState<string | null>(null);
+  const [tab, setTab] = useState<"nilai" | "presensi">("nilai");
+
+  const loadData = async () => {
+    setLoading(true);
+    setError(null);
+    try {
+      const res = await getStudentProgressDataAction();
+      if (res.success && res.data) {
+        setData(res.data);
+      } else {
+        setError(res.error || "Gagal memuat capaian belajar.");
+      }
+    } catch {
+      setError("Terjadi kesalahan saat memuat data.");
+    } finally {
+      setLoading(false);
+    }
+  };
+
+  useEffect(() => {
+    loadData();
+  }, []);
+
+  if (loading) {
+    return (
+      <div className="space-y-4 pt-2">
+        <div className="h-16 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60"></div>
+        <div className="h-44 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60"></div>
+        <div className="h-32 bg-white/70 rounded-3xl animate-pulse border border-slate-200/60"></div>
+      </div>
+    );
+  }
+
+  if (error || !data) {
+    return (
+      <div className="p-6 bg-white rounded-3xl border border-slate-200 text-center space-y-3 mt-4">
+        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
+        <h3 className="font-bold text-slate-800 text-sm">Gagal Memuat Capaian Belajar</h3>
+        <p className="text-xs text-slate-500">{error || "Data tidak dapat diakses."}</p>
+        <Button onClick={loadData} variant="outline" size="sm" className="rounded-xl">
+          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Coba Lagi
+        </Button>
+      </div>
+    );
+  }
+
+  return (
+    <div className="space-y-4">
+      {/* Header */}
+      <div className="p-4 bg-gradient-to-br from-[#0F766E] to-[#115E59] rounded-3xl text-white shadow-lg shadow-teal-900/10 space-y-1 relative overflow-hidden">
+        <div className="relative z-10 flex justify-between items-start">
+          <div className="space-y-0.5">
+            <span className="text-[10px] font-bold text-teal-200 uppercase tracking-wider flex items-center gap-1">
+              <TrendingUp className="w-3 h-3 text-teal-300" />
+              {data.student.className} • {data.student.academicYear}
+            </span>
+            <h1 className="text-base font-black tracking-tight">Capaian Belajarku</h1>
+            <p className="text-[11px] text-teal-100/90 font-medium">
+              Nilai final & ketuntasan TP per mata pelajaran
+            </p>
+          </div>
+          <button
+            onClick={loadData}
+            title="Muat ulang"
+            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
+          >
+            <RefreshCw className="w-3.5 h-3.5" />
+          </button>
+        </div>
+        {!data.hasActivePeriod && (
+          <div className="p-2 bg-amber-500/20 border border-amber-300/40 rounded-xl text-[11px] text-amber-100 flex items-center gap-2">
+            <AlertCircle className="w-4 h-4 shrink-0" />
+            <span>Tahun ajaran belum aktif. Data capaian belum tersedia.</span>
+          </div>
+        )}
+      </div>
+
+      {/* Tab switch */}
+      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
+        <button
+          onClick={() => setTab("nilai")}
+          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
+            tab === "nilai" ? "bg-white text-[#0F766E] shadow-sm" : "text-slate-500"
+          }`}
+        >
+          Nilai & Ketuntasan
+        </button>
+        <button
+          onClick={() => setTab("presensi")}
+          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
+            tab === "presensi" ? "bg-white text-[#0F766E] shadow-sm" : "text-slate-500"
+          }`}
+        >
+          Presensi Saya
+        </button>
+      </div>
+
+      {tab === "nilai" ? (
+        data.subjects.length === 0 ? (
+          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 text-center space-y-1.5">
+            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
+              <BookOpen className="w-5 h-5" />
+            </div>
+            <h3 className="text-xs font-bold text-slate-800">Belum Ada Mapel</h3>
+            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
+              Mapel rombelmu akan muncul di sini setelah guru mengelolanya.
+            </p>
+          </div>
+        ) : (
+          <div className="space-y-3">
+            {data.subjects.map((s) => (
+              <SubjectCard key={s.teachingContextId} subject={s} />
+            ))}
+          </div>
+        )
+      ) : (
+        <AttendanceTab attendance={data.attendance} />
+      )}
+
+      <p className="text-[10px] text-slate-400 text-center px-4 leading-relaxed">
+        Hanya nilai final (assessment selesai & sudah dinilai guru) yang ditampilkan.
+        Nilai sedang berlangsung tidak akan muncul sampai guru memfinalisasinya.
+      </p>
+    </div>
+  );
+}
diff --git a/src/app/siswa/portal/page.tsx b/src/app/siswa/portal/page.tsx
index b15a60b..f2a8c6e 100644
--- a/src/app/siswa/portal/page.tsx
+++ b/src/app/siswa/portal/page.tsx
@@ -13,16 +13,23 @@ import {
   FileQuestion, 
   User, 
   MapPin, 
-  RefreshCw 
+  RefreshCw,
+  TrendingUp,
+  Award
 } from "lucide-react";
 import { 
   getStudentDashboardDataAction, 
   type StudentDashboardData 
 } from "@/modules/student-portal/student-portal.actions";
+import {
+  getStudentProgressWidgetAction,
+  type StudentProgressWidgetData,
+} from "@/modules/student-portal/student-progress.actions";
 import { Button } from "@/components/ui/button";
 
 export default function StudentPortalHomePage() {
   const [data, setData] = useState<StudentDashboardData | null>(null);
+  const [widget, setWidget] = useState<StudentProgressWidgetData | null>(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
@@ -30,12 +37,18 @@ export default function StudentPortalHomePage() {
     setLoading(true);
     setError(null);
     try {
-      const res = await getStudentDashboardDataAction();
+      const [res, widgetRes] = await Promise.all([
+        getStudentDashboardDataAction(),
+        getStudentProgressWidgetAction(),
+      ]);
       if (res.success && res.data) {
         setData(res.data);
       } else {
         setError(res.error || "Gagal memuat informasi beranda.");
       }
+      if (widgetRes.success && widgetRes.data) {
+        setWidget(widgetRes.data);
+      }
     } catch {
       setError("Terjadi kesalahan saat memuat data.");
     } finally {
@@ -71,6 +84,7 @@ export default function StudentPortalHomePage() {
   }
 
   const { student, today, urgentQuizzes, hasActivePeriod } = data;
+  const visibleSubjects = (widget?.subjects ?? []).slice(0, 4);
 
   return (
     <div className="space-y-4">
@@ -263,6 +277,66 @@ export default function StudentPortalHomePage() {
         )}
       </div>
 
+      {/* 4. WIDGET CAPAIAN BELAJAR (Gelombang 2) */}
+      {widget?.hasActivePeriod && (
+        <div className="space-y-2.5 pt-1">
+          <div className="flex items-center justify-between px-1">
+            <div className="flex items-center gap-1.5">
+              <TrendingUp className="w-4 h-4 text-[#0F766E]" />
+              <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">
+                Capaian Belajar
+              </h2>
+            </div>
+            <Link
+              href="/siswa/portal/nilai"
+              className="text-[11px] font-bold text-teal-700 hover:underline flex items-center gap-0.5"
+            >
+              Lihat Detail <ArrowRight className="w-3 h-3" />
+            </Link>
+          </div>
+
+          {visibleSubjects.length === 0 ? (
+            <div className="p-4 bg-white rounded-3xl border border-slate-200/80 text-center space-y-1">
+              <p className="text-xs font-semibold text-slate-700">Belum ada nilai final</p>
+              <p className="text-[11px] text-slate-400">
+                Capaian per mapel muncul setelah guru memfinalisasi penilaian.
+              </p>
+            </div>
+          ) : (
+            <div className="space-y-2">
+              {visibleSubjects.map((s) => (
+                <Link
+                  key={s.teachingContextId}
+                  href="/siswa/portal/nilai"
+                  className="p-3.5 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 shadow-xs"
+                >
+                  <div className="min-w-0 space-y-0.5">
+                    <h4 className="text-xs font-bold text-slate-900 truncate">{s.subjectName}</h4>
+                    {s.assessedTpCount > 0 ? (
+                      <p className="text-[10px] text-slate-500">
+                        TP tuntas: {s.tuntasTpCount}/{s.assessedTpCount}
+                      </p>
+                    ) : (
+                      <p className="text-[10px] text-slate-400">belum ada nilai</p>
+                    )}
+                  </div>
+                  <div className="flex items-center gap-2 shrink-0">
+                    {s.hasFinalData ? (
+                      <span className="text-lg font-black text-[#0F766E]">{s.runningScore ?? "–"}</span>
+                    ) : (
+                      <span className="text-[10px] font-bold text-slate-400">–</span>
+                    )}
+                    {s.assessedTpCount > 0 && s.tuntasTpCount === s.assessedTpCount && (
+                      <Award className="w-4 h-4 text-emerald-500" />
+                    )}
+                  </div>
+                </Link>
+              ))}
+            </div>
+          )}
+        </div>
+      )}
+
     </div>
   );
 }
diff --git a/src/components/student/StudentBottomNav.tsx b/src/components/student/StudentBottomNav.tsx
index 48a9444..bba3252 100644
--- a/src/components/student/StudentBottomNav.tsx
+++ b/src/components/student/StudentBottomNav.tsx
@@ -7,6 +7,7 @@ import {
   Home, 
   CalendarDays, 
   CheckSquare, 
+  TrendingUp,
   ClipboardList, 
   UserCircle 
 } from "lucide-react";
@@ -43,6 +44,12 @@ export function StudentBottomNav() {
       icon: CheckSquare,
       exact: false,
     },
+    {
+      href: "/siswa/portal/nilai",
+      label: "Nilai",
+      icon: TrendingUp,
+      exact: false,
+    },
     {
       href: "/siswa/portal/tugas",
       label: "Tugas",
diff --git a/src/modules/student-portal/__tests__/story-7-progress.int.test.ts b/src/modules/student-portal/__tests__/story-7-progress.int.test.ts
new file mode 100644
index 0000000..c3d1564
--- /dev/null
+++ b/src/modules/student-portal/__tests__/story-7-progress.int.test.ts
@@ -0,0 +1,444 @@
+import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
+
+// In-memory cookie store mock for next/headers (pola story-4-full-audit)
+let currentCookieValue: string | null = null;
+const mockCookieStore = {
+  get: vi.fn((name: string) => {
+    if (name === "klassa_student_session" && currentCookieValue) {
+      return { name, value: currentCookieValue };
+    }
+    return undefined;
+  }),
+  set: vi.fn((name: string, value: string) => {
+    if (name === "klassa_student_session") {
+      currentCookieValue = value;
+    }
+  }),
+  delete: vi.fn((name: string) => {
+    if (name === "klassa_student_session") {
+      currentCookieValue = null;
+    }
+  }),
+};
+
+vi.mock("next/headers", () => ({
+  cookies: vi.fn(async () => mockCookieStore),
+}));
+
+import { prisma } from "@/lib/auth";
+import { hashPin } from "@/lib/student-pin";
+import { signStudentSessionToken } from "@/modules/student-auth/student-session";
+import {
+  getStudentProgressDataAction,
+  getStudentProgressWidgetAction,
+} from "../student-progress.actions";
+
+function makeSessionToken(params: {
+  studentId: string;
+  schoolId: string;
+  classId: string;
+  academicPeriodId: string;
+  nis: string;
+  fullName: string;
+  pinUpdatedAt: Date;
+}) {
+  return signStudentSessionToken({
+    studentId: params.studentId,
+    schoolId: params.schoolId,
+    classId: params.classId,
+    academicPeriodId: params.academicPeriodId,
+    nis: params.nis,
+    fullName: params.fullName,
+    pinUpdatedAt: params.pinUpdatedAt.toISOString(),
+  });
+}
+
+/**
+ * Story 7 — rantai DoD real-db: guru finalisasi assessment (COMPLETED + GRADED)
+ * → siswa (via sesi server) melihat nilai di pohon ketuntasan & widget.
+ * Termasuk regresi FINAL ganda: nilai pada assessment IN_PROGRESS tidak bocor.
+ */
+describe("Story 7 Student Progress — Real-DB Integration", () => {
+  let dbAvailable = false;
+  const timestamp = Date.now();
+
+  let schoolId: string;
+  let academicPeriodId: string;
+  let subjectId: string;
+  let teacherUserId: string;
+  let teacherProfileId: string;
+  let classId: string;
+  let studentId: string;
+  let studentNis: string;
+  let teachingContextId: string;
+  let assessmentTypeId: string;
+  let loTuntasId: string;
+  let loBelumId: string;
+  let lonerStudentId: string; // tanpa membership rombel sama sekali
+  let oldPeriodStudentId: string; // hanya membership periode INACTIVE
+  let lonerToken: string;
+  let oldPeriodToken: string;
+
+  beforeAll(async () => {
+    try {
+      const school = await prisma.school.create({
+        data: {
+          name: `Audit Sekolah S7 ${timestamp}`,
+          normalizedName: `audit sekolah s7 ${timestamp}`,
+          npsn: `NPSN7${timestamp.toString().slice(-5)}`,
+        },
+      });
+      schoolId = school.id;
+
+      const ap = await prisma.academicPeriod.create({
+        data: { schoolId: school.id, year: "2026/2027", semester: "Ganjil", status: "ACTIVE" },
+      });
+      academicPeriodId = ap.id;
+
+      const subject = await prisma.subject.create({
+        data: { name: `Fisika ${timestamp}`, schoolId: school.id },
+      });
+      subjectId = subject.id;
+
+      teacherUserId = `teacher-s7-${timestamp}`;
+      await prisma.user.create({
+        data: {
+          id: teacherUserId,
+          email: `${teacherUserId}@test.com`,
+          name: "Guru Pengampu S7",
+          emailVerified: true,
+          createdAt: new Date(),
+          updatedAt: new Date(),
+        },
+      });
+      const tp = await prisma.teacherProfile.create({
+        data: { userId: teacherUserId, activeSchoolId: school.id, onboardingCompleted: true },
+      });
+      teacherProfileId = tp.id;
+
+      const cls = await prisma.class.create({
+        data: {
+          schoolId: school.id,
+          name: "9-B",
+          gradeLevel: "9",
+          joinCode: `S7${timestamp.toString().slice(-4)}`,
+        },
+      });
+      classId = cls.id;
+
+      const tc = await prisma.teachingContext.create({
+        data: {
+          teacherProfileId: tp.id,
+          schoolId: school.id,
+          academicPeriodId: ap.id,
+          subjectId: subject.id,
+          classId: cls.id,
+        },
+      });
+      teachingContextId = tc.id;
+
+      // Jenis penilaian + GradePolicy ACTIVE (bobot 100% Ulangan)
+      const at = await prisma.assessmentType.create({
+        data: {
+          teachingContextId: tc.id,
+          name: "Ulangan Harian",
+          normalizedName: "ulangan harian",
+          category: "FORMATIVE",
+        },
+      });
+      assessmentTypeId = at.id;
+      await prisma.gradePolicy.create({
+        data: {
+          teachingContextId: tc.id,
+          status: "ACTIVE",
+          items: { create: [{ assessmentTypeId: at.id, weight: 100, sortOrder: 1 }] },
+        },
+      });
+
+      // TP (Learning Objective)
+      const lo1 = await prisma.learningObjective.create({
+        data: { teachingContextId: tc.id, code: "TP-1.1", description: "Menganalisis gerak lurus", orderIndex: 1 },
+      });
+      const lo2 = await prisma.learningObjective.create({
+        data: { teachingContextId: tc.id, code: "TP-1.2", description: "Menerapkan Hukum Newton", orderIndex: 2 },
+      });
+      loTuntasId = lo1.id;
+      loBelumId = lo2.id;
+
+      // Siswa + enrollment
+      studentNis = `NIS${timestamp.toString().slice(-6)}`;
+      const student = await prisma.student.create({
+        data: {
+          schoolId: school.id,
+          fullName: "Rara Siswa Rajin",
+          nis: studentNis,
+          accessPinHash: await hashPin("5678"),
+          accountStatus: "ACTIVE",
+          status: "ACTIVE",
+          pinUpdatedAt: new Date(),
+        },
+      });
+      studentId = student.id;
+      await prisma.classStudent.create({
+        data: { studentId, classId: cls.id, academicPeriodId: ap.id },
+      });
+
+      // Assessment #1 FINAL: COMPLETED + result GRADED 85 (KKTP 75) → TP-1.1 TUNTAS
+      const a1 = await prisma.assessment.create({
+        data: {
+          teachingContextId: tc.id,
+          assessmentTypeId: at.id,
+          title: "Ulangan Gerak Lurus",
+          assessmentDate: new Date(2026, 8, 10),
+          maxScore: 100,
+          minimumPassingScore: 75,
+          status: "COMPLETED",
+          learningObjectiveLinks: {
+            create: [
+              { learningObjectiveId: lo1.id, snapshotCode: "TP-1.1", snapshotDescription: "Menganalisis gerak lurus" },
+            ],
+          },
+        },
+      });
+      await prisma.assessmentResult.create({
+        data: { assessmentId: a1.id, studentId, status: "GRADED", finalScore: 85 },
+      });
+
+      // Assessment #2 FINAL: COMPLETED + GRADED 60 (KKTP 75) → TP-1.2 BELUM_TUNTAS
+      const a2 = await prisma.assessment.create({
+        data: {
+          teachingContextId: tc.id,
+          assessmentTypeId: at.id,
+          title: "Ulangan Hukum Newton",
+          assessmentDate: new Date(2026, 8, 17),
+          maxScore: 100,
+          minimumPassingScore: 75,
+          status: "COMPLETED",
+          learningObjectiveLinks: {
+            create: [
+              { learningObjectiveId: lo2.id, snapshotCode: "TP-1.2", snapshotDescription: "Menerapkan Hukum Newton" },
+            ],
+          },
+        },
+      });
+      await prisma.assessmentResult.create({
+        data: { assessmentId: a2.id, studentId, status: "GRADED", finalScore: 60 },
+      });
+
+      // Assessment #3 NON-FINAL: IN_PROGRESS + result GRADED 99 → TIDAK BOLEH BOCOR
+      const a3 = await prisma.assessment.create({
+        data: {
+          teachingContextId: tc.id,
+          assessmentTypeId: at.id,
+          title: "Ulangan Masih Berjalan",
+          assessmentDate: new Date(2026, 8, 20),
+          maxScore: 100,
+          minimumPassingScore: 75,
+          status: "IN_PROGRESS",
+          learningObjectiveLinks: {
+            create: [
+              { learningObjectiveId: lo1.id, snapshotCode: "TP-1.1", snapshotDescription: "Menganalisis gerak lurus" },
+            ],
+          },
+        },
+      });
+      await prisma.assessmentResult.create({
+        data: { assessmentId: a3.id, studentId, status: "GRADED", finalScore: 99 },
+      });
+
+      // Presensi: 2 sesi (1 hadir, 1 telat, 1 sakit)
+      for (const [day, recStatus] of [[5, "PRESENT"], [12, "LATE"], [19, "SICK"]] as const) {
+        const session = await prisma.teachingSession.create({
+          data: { teachingContextId: tc.id, date: new Date(2026, 8, day), status: "COMPLETED" },
+        });
+        await prisma.attendanceRecord.create({
+          data: { teachingSessionId: session.id, studentId, status: recStatus },
+        });
+      }
+
+      // Sesi valid
+      currentCookieValue = signStudentSessionToken({
+        studentId,
+        schoolId: school.id,
+        classId: cls.id,
+        academicPeriodId: ap.id,
+        nis: studentNis,
+        fullName: student.fullName,
+        pinUpdatedAt: student.pinUpdatedAt!.toISOString(),
+      });
+
+      // Siswa tanpa membership rombel (belum join/disetujui)
+      const loner = await prisma.student.create({
+        data: {
+          schoolId: school.id,
+          fullName: "Siswa Tanpa Rombel",
+          nis: `LNR${timestamp.toString().slice(-6)}`,
+          accessPinHash: await hashPin("9999"),
+          accountStatus: "ACTIVE",
+          status: "ACTIVE",
+          pinUpdatedAt: new Date(),
+        },
+      });
+      lonerStudentId = loner.id;
+      lonerToken = makeSessionToken({
+        studentId: loner.id,
+        schoolId: school.id,
+        classId: cls.id,
+        academicPeriodId: ap.id,
+        nis: loner.nis!,
+        fullName: loner.fullName,
+        pinUpdatedAt: loner.pinUpdatedAt!,
+      });
+
+      // Siswa dengan membership hanya di periode lama (INACTIVE)
+      const oldAp = await prisma.academicPeriod.create({
+        data: { schoolId: school.id, year: "2025/2026", semester: "Genap", status: "INACTIVE" },
+      });
+      const oldCls = await prisma.class.create({
+        data: { schoolId: school.id, name: "8-Z", gradeLevel: "8", joinCode: `S7O${timestamp.toString().slice(-4)}` },
+      });
+      const oldStudent = await prisma.student.create({
+        data: {
+          schoolId: school.id,
+          fullName: "Siswa Periode Lama",
+          nis: `OLD${timestamp.toString().slice(-6)}`,
+          accessPinHash: await hashPin("8888"),
+          accountStatus: "ACTIVE",
+          status: "ACTIVE",
+          pinUpdatedAt: new Date(),
+        },
+      });
+      oldPeriodStudentId = oldStudent.id;
+      await prisma.classStudent.create({
+        data: { studentId: oldStudent.id, classId: oldCls.id, academicPeriodId: oldAp.id },
+      });
+      oldPeriodToken = makeSessionToken({
+        studentId: oldStudent.id,
+        schoolId: school.id,
+        classId: oldCls.id,
+        academicPeriodId: oldAp.id,
+        nis: oldStudent.nis!,
+        fullName: oldStudent.fullName,
+        pinUpdatedAt: oldStudent.pinUpdatedAt!,
+      });
+
+      dbAvailable = true;
+    } catch (err) {
+      console.warn("Real database not reachable, skipping live DB tests:", err);
+      dbAvailable = false;
+    }
+  });
+
+  afterAll(async () => {
+    if (!dbAvailable) return;
+    try {
+      if (schoolId) await prisma.school.delete({ where: { id: schoolId } });
+      if (teacherUserId) await prisma.user.delete({ where: { id: teacherUserId } });
+      if (subjectId) await prisma.subject.delete({ where: { id: subjectId } });
+    } catch {
+      // Ignore cleanup error
+    }
+  });
+
+  it("rantai DoD: guru finalisasi → siswa melihat nilai berbobot & pohon ketuntasan", async () => {
+    if (!dbAvailable) return;
+    const res = await getStudentProgressDataAction();
+    expect(res.success).toBe(true);
+    expect(res.data).toBeDefined();
+    expect(res.data!.hasActivePeriod).toBe(true);
+    expect(res.data!.subjects).toHaveLength(1);
+
+    const fisika = res.data!.subjects[0];
+    expect(fisika.subjectName).toContain("Fisika");
+    expect(fisika.scoringMode).toBe("WEIGHTED");
+    // Bobot 100% Ulangan → (85 + 60) / 2 = 72.5
+    expect(fisika.runningScore).toBe(72.5);
+    expect(fisika.finalCount).toBe(2);
+
+    const tpTuntas = fisika.tpTree.find((t) => t.learningObjectiveId === loTuntasId)!;
+    expect(tpTuntas.status).toBe("TUNTAS");
+    expect(tpTuntas.masteredCount).toBe(1);
+    expect(tpTuntas.assessedCount).toBe(1);
+
+    const tpBelum = fisika.tpTree.find((t) => t.learningObjectiveId === loBelumId)!;
+    expect(tpBelum.status).toBe("BELUM_TUNTAS");
+    expect(tpBelum.masteredCount).toBe(0);
+  });
+
+  it("regresi FINAL ganda: nilai GRADED pada assessment IN_PROGRESS tidak bocor", async () => {
+    if (!dbAvailable) return;
+    const res = await getStudentProgressDataAction();
+    const fisika = res.data!.subjects[0];
+
+    expect(fisika.finalCount).toBe(2); // 99 dari a3 tidak dihitung
+    expect(fisika.trend.map((t) => t.title)).not.toContain("Ulangan Masih Berjalan");
+    // TP-1.1 tervaluasi a1 (85 tuntas) — 99 dari a3 tidak menambah proporsi
+    const tpTuntas = fisika.tpTree.find((t) => t.learningObjectiveId === loTuntasId)!;
+    expect(tpTuntas.assessedCount).toBe(1);
+    expect(tpTuntas.averageScore).toBe(85);
+  });
+
+  it("presensi: rekap bulanan H/S/I/A dari sesi periode aktif; LATE dihitung H", async () => {
+    if (!dbAvailable) return;
+    const res = await getStudentProgressDataAction();
+    const sept = res.data!.attendance.find((r) => r.year === 2026 && r.month === 9);
+    expect(sept).toBeDefined();
+    expect(sept!.hadir).toBe(2); // PRESENT + LATE
+    expect(sept!.lateCount).toBe(1);
+    expect(sept!.sakit).toBe(1);
+    expect(sept!.izin).toBe(0);
+    expect(sept!.alpa).toBe(0);
+  });
+
+  it("widget beranda: ringkasan per mapel konsisten dengan halaman nilai", async () => {
+    if (!dbAvailable) return;
+    const res = await getStudentProgressWidgetAction();
+    expect(res.success).toBe(true);
+    expect(res.data!.subjects).toHaveLength(1);
+
+    const summary = res.data!.subjects[0];
+    expect(summary.hasFinalData).toBe(true);
+    expect(summary.runningScore).toBe(72.5);
+    expect(summary.tuntasTpCount).toBe(1);
+    expect(summary.assessedTpCount).toBe(2);
+  });
+
+  it("tanpa sesi → error, bukan data (identitas hanya dari sesi server)", async () => {
+    if (!dbAvailable) return;
+    const saved = currentCookieValue;
+    currentCookieValue = null;
+    const res = await getStudentProgressDataAction();
+    currentCookieValue = saved;
+    expect(res.success).toBe(false);
+    expect(res.error).toBeDefined();
+  });
+
+  it("siswa tanpa membership rombel → keadaan kosong aman tanpa error", async () => {
+    if (!dbAvailable) return;
+    const saved = currentCookieValue;
+    currentCookieValue = lonerToken;
+    const res = await getStudentProgressDataAction();
+    currentCookieValue = saved;
+
+    expect(res.success).toBe(true);
+    expect(res.data!.hasActivePeriod).toBe(false);
+    expect(res.data!.subjects).toEqual([]);
+    expect(res.data!.attendance).toEqual([]);
+  });
+
+  it("siswa dengan membership hanya periode lama (INACTIVE) → data periode lama tidak tampil", async () => {
+    if (!dbAvailable) return;
+    const saved = currentCookieValue;
+    currentCookieValue = oldPeriodToken;
+    const [res, widgetRes] = await Promise.all([
+      getStudentProgressDataAction(),
+      getStudentProgressWidgetAction(),
+    ]);
+    currentCookieValue = saved;
+
+    expect(res.success).toBe(true);
+    expect(res.data!.hasActivePeriod).toBe(false);
+    expect(res.data!.subjects).toEqual([]);
+    expect(widgetRes.data!.subjects).toEqual([]);
+  });
+});
diff --git a/src/modules/student-portal/__tests__/student-progress.service.test.ts b/src/modules/student-portal/__tests__/student-progress.service.test.ts
new file mode 100644
index 0000000..6a40be1
--- /dev/null
+++ b/src/modules/student-portal/__tests__/student-progress.service.test.ts
@@ -0,0 +1,308 @@
+import { describe, it, expect } from "vitest";
+import { Prisma } from "@prisma/client";
+import {
+  isFinalScore,
+  buildSubjectProgress,
+  buildSubjectSummary,
+  summarizeMonthlyAttendance,
+  type AssessmentForProgress,
+  type LearningObjectiveForProgress,
+  type SubjectRawData,
+  type AttendanceStatusLite,
+} from "../student-progress.service";
+
+const d = (day: number) => new Date(2026, 8, day); // Sept 2026
+
+function assessment(partial: Partial<AssessmentForProgress> & { id: string }): AssessmentForProgress {
+  return {
+    title: partial.title ?? `Penilaian ${partial.id}`,
+    assessmentTypeId: "type-1",
+    assessmentTypeName: "Ulangan Harian",
+    assessmentStatus: "COMPLETED",
+    assessmentDate: partial.assessmentDate ?? d(10),
+    minimumPassingScore: 70,
+    resultStatus: "GRADED",
+    finalScore: 80,
+    remedialScores: [],
+    learningObjectiveIds: [],
+    ...partial,
+  };
+}
+
+function lo(id: string, extra: Partial<LearningObjectiveForProgress> = {}): LearningObjectiveForProgress {
+  return {
+    id,
+    code: `TP-${id}`,
+    description: `Deskripsi ${id}`,
+    orderIndex: 0,
+    status: "ACTIVE",
+    fallbackCode: `SNAP-${id}`,
+    fallbackDescription: `Snapshot ${id}`,
+    ...extra,
+  };
+}
+
+function raw(partial: Partial<SubjectRawData> = {}): SubjectRawData {
+  return {
+    teachingContextId: "tc-1",
+    subjectName: "Biologi",
+    teacherName: "Bu Guru",
+    policyActive: false,
+    policyItems: [],
+    assessments: [],
+    learningObjectives: [],
+    ...partial,
+  };
+}
+
+describe("isFinalScore — definisi FINAL kanonik (glossary)", () => {
+  it("FINAL = COMPLETED + GRADED + skor non-null", () => {
+    expect(
+      isFinalScore({ assessmentStatus: "COMPLETED", resultStatus: "GRADED", finalScore: 80 })
+    ).toBe(true);
+  });
+
+  it("GRADED pada assessment IN_PROGRESS BUKAN final (join ganda wajib)", () => {
+    expect(
+      isFinalScore({ assessmentStatus: "IN_PROGRESS", resultStatus: "GRADED", finalScore: 80 })
+    ).toBe(false);
+    expect(
+      isFinalScore({ assessmentStatus: "DRAFT", resultStatus: "GRADED", finalScore: 80 })
+    ).toBe(false);
+  });
+
+  it("COMPLETED tapi result PENDING/ABSENT/EXCUSED/null-score bukan final", () => {
+    for (const resultStatus of ["PENDING", "ABSENT", "EXCUSED"] as const) {
+      expect(
+        isFinalScore({ assessmentStatus: "COMPLETED", resultStatus, finalScore: 75 })
+      ).toBe(false);
+    }
+    expect(
+      isFinalScore({ assessmentStatus: "COMPLETED", resultStatus: "GRADED", finalScore: null })
+    ).toBe(false);
+  });
+});
+
+describe("buildSubjectProgress — pohon ketuntasan TP (proporsi KKTP)", () => {
+  it("HAPPY: proporsi x dari y tuntas per TP + status TUNTAS bila semua tuntas", () => {
+    const data = raw({
+      assessments: [
+        assessment({ id: "a1", finalScore: 80, minimumPassingScore: 70, learningObjectiveIds: ["tp1"], assessmentDate: d(1) }),
+        assessment({ id: "a2", finalScore: 60, minimumPassingScore: 55, learningObjectiveIds: ["tp1"], assessmentDate: d(2) }),
+        // tp2: satu tuntas satu tidak
+        assessment({ id: "a3", finalScore: 65, minimumPassingScore: 70, learningObjectiveIds: ["tp2"], assessmentDate: d(3) }),
+      ],
+      learningObjectives: [lo("tp1", { orderIndex: 1 }), lo("tp2", { orderIndex: 2 })],
+    });
+    const result = buildSubjectProgress(data);
+
+    const tp1 = result.tpTree.find((t) => t.learningObjectiveId === "tp1")!;
+    expect(tp1.status).toBe("TUNTAS");
+    expect(tp1.assessedCount).toBe(2);
+    expect(tp1.masteredCount).toBe(2);
+    expect(tp1.averageScore).toBe(70); // (80+60)/2
+
+    const tp2 = result.tpTree.find((t) => t.learningObjectiveId === "tp2")!;
+    expect(tp2.status).toBe("BELUM_TUNTAS");
+    expect(tp2.masteredCount).toBe(0);
+  });
+
+  it("NON-FINAL tidak bocor: GRADED pada assessment IN_PROGRESS dikecualikan dari semua agregasi", () => {
+    const data = raw({
+      assessments: [
+        assessment({ id: "final", finalScore: 90, learningObjectiveIds: ["tp1"] }),
+        assessment({ id: "bocor", assessmentStatus: "IN_PROGRESS", finalScore: 100, learningObjectiveIds: ["tp1"], assessmentDate: d(5) }),
+        assessment({ id: "nullscore", finalScore: null, learningObjectiveIds: ["tp1"], assessmentDate: d(6) }),
+        assessment({ id: "absen", resultStatus: "ABSENT", finalScore: null, learningObjectiveIds: ["tp1"], assessmentDate: d(7) }),
+      ],
+      learningObjectives: [lo("tp1")],
+    });
+    const result = buildSubjectProgress(data);
+
+    expect(result.finalCount).toBe(1);
+    expect(result.trend.map((t) => t.assessmentId)).toEqual(["final"]);
+    expect(result.flatAverage).toBe(90); // bukan rata-rata termasuk 100/0
+
+    const tp1 = result.tpTree[0];
+    expect(tp1.assessedCount).toBe(1);
+    expect(tp1.masteredCount).toBe(1);
+    expect(tp1.averageScore).toBe(90);
+  });
+
+  it("TP tanpa penilaian FINAL → BELUM_DINILAI, bukan 0%", () => {
+    const result = buildSubjectProgress(raw({ learningObjectives: [lo("tp-kosong")] }));
+    const tp = result.tpTree[0];
+    expect(tp.status).toBe("BELUM_DINILAI");
+    expect(tp.assessedCount).toBe(0);
+    expect(tp.averageScore).toBeNull();
+    expect(result.finalCount).toBe(0);
+    expect(result.flatAverage).toBeNull();
+  });
+
+  it("Penilaian tanpa KKTP: menyumbang skor/tren, dikecualikan dari proporsi ketuntasan", () => {
+    const data = raw({
+      assessments: [
+        assessment({ id: "tanpa-kktp", minimumPassingScore: null, finalScore: 88, learningObjectiveIds: ["tp1"] }),
+      ],
+      learningObjectives: [lo("tp1")],
+    });
+    const result = buildSubjectProgress(data);
+    const tp1 = result.tpTree[0];
+
+    expect(tp1.status).toBe("TANPA_KKTP");
+    expect(tp1.assessedCount).toBe(0);
+    expect(tp1.averageScore).toBe(88); // tetap menyumbang skor
+    expect(result.finalCount).toBe(1);
+    expect(result.flatAverage).toBe(88);
+  });
+
+  it("Snapshot fallback dipakai saat LO non-ACTIVE (ARCHIVED)", () => {
+    const data = raw({
+      assessments: [assessment({ id: "a1", learningObjectiveIds: ["tp1"] })],
+      learningObjectives: [lo("tp1", { status: "ARCHIVED" })],
+    });
+    const tp1 = buildSubjectProgress(data).tpTree[0];
+    expect(tp1.code).toBe("SNAP-tp1");
+    expect(tp1.description).toBe("Snapshot tp1");
+  });
+
+  it("Remedial hanya info tambahan — tidak mengubah skor/ketuntasan", () => {
+    const data = raw({
+      assessments: [
+        assessment({ id: "a1", finalScore: 50, minimumPassingScore: 70, remedialScores: [85, 90], learningObjectiveIds: ["tp1"] }),
+      ],
+      learningObjectives: [lo("tp1")],
+    });
+    const tp1 = buildSubjectProgress(data).tpTree[0];
+    expect(tp1.status).toBe("BELUM_TUNTAS"); // remedial TIDAK menaikkan
+    expect(tp1.remedialCount).toBe(2);
+    expect(tp1.averageScore).toBe(50);
+  });
+
+  it("Tren terurut kronologis dan latestScore diambil dari penilaian terakhir", () => {
+    const data = raw({
+      assessments: [
+        assessment({ id: "late", finalScore: 95, learningObjectiveIds: ["tp1"], assessmentDate: d(20) }),
+        assessment({ id: "early", finalScore: 60, learningObjectiveIds: ["tp1"], assessmentDate: d(1) }),
+      ],
+      learningObjectives: [lo("tp1")],
+    });
+    const result = buildSubjectProgress(data);
+    expect(result.trend.map((t) => t.assessmentId)).toEqual(["early", "late"]);
+    expect(result.tpTree[0].latestScore).toBe(95);
+  });
+});
+
+describe("Nilai berjalan — reuse bobot GradePolicy vs fallback flat", () => {
+  const policyItems = [
+    { assessmentTypeId: "type-1", assessmentTypeName: "Ulangan Harian", category: "FORMATIVE", weight: new Prisma.Decimal(30) },
+    { assessmentTypeId: "type-2", assessmentTypeName: "Tugas", category: "ASSIGNMENT", weight: new Prisma.Decimal(70) },
+  ];
+
+  it("Policy ACTIVE → nilai berbobot identik dengan calculateStudentRunningPerformance", () => {
+    const data = raw({
+      policyActive: true,
+      policyItems,
+      assessments: [
+        assessment({ id: "u1", finalScore: 80, assessmentDate: d(1) }), // Ulangan 80
+        assessment({ id: "t1", assessmentTypeId: "type-2", assessmentTypeName: "Tugas", finalScore: 90, assessmentDate: d(2) }), // Tugas 90
+      ],
+    });
+    const result = buildSubjectProgress(data);
+    // (80*30 + 90*70) / 100 = 87
+    expect(result.scoringMode).toBe("WEIGHTED");
+    expect(result.runningScore).toBe(87);
+    expect(result.availableWeight).toBe(100);
+  });
+
+  it("Bobot parsial: hanya komponen ber-nilai yang dihitung (availableWeight < 100)", () => {
+    const data = raw({
+      policyActive: true,
+      policyItems,
+      assessments: [
+        assessment({ id: "u1", finalScore: 80, assessmentDate: d(1) }), // hanya Ulangan terisi
+      ],
+    });
+    const result = buildSubjectProgress(data);
+    expect(result.scoringMode).toBe("WEIGHTED");
+    expect(result.runningScore).toBe(80);
+    expect(result.availableWeight).toBe(30);
+  });
+
+  it("Policy DRAFT/non-ACTIVE → fallback flat berlabel, bukan weighted", () => {
+    const data = raw({
+      policyActive: false,
+      policyItems, // items ada tapi policy tidak ACTIVE
+      assessments: [
+        assessment({ id: "u1", finalScore: 80, assessmentDate: d(1) }),
+        assessment({ id: "u2", finalScore: 90, assessmentDate: d(2) }),
+      ],
+    });
+    const result = buildSubjectProgress(data);
+    expect(result.scoringMode).toBe("FLAT_FALLBACK");
+    expect(result.runningScore).toBe(85);
+    expect(result.availableWeight).toBeNull();
+  });
+
+  it("Weighted tanpa nilai final apapun → runningScore null (bukan 0)", () => {
+    const result = buildSubjectProgress(
+      raw({ policyActive: true, policyItems, assessments: [assessment({ id: "p", resultStatus: "PENDING", finalScore: null })] })
+    );
+    expect(result.runningScore).toBeNull();
+    expect(result.scoringMode).toBe("WEIGHTED");
+  });
+});
+
+describe("buildSubjectSummary — widget beranda", () => {
+  it("Mapel tanpa data FINAL → hasFinalData false, bukan skor 0", () => {
+    const p = buildSubjectProgress(raw({ learningObjectives: [lo("tp1")] }));
+    const s = buildSubjectSummary(p);
+    expect(s.hasFinalData).toBe(false);
+    expect(s.runningScore).toBeNull();
+    expect(s.assessedTpCount).toBe(0);
+  });
+
+  it("Hitungan TP tuntas hanya mencakup TP ber-KKTP", () => {
+    const p = buildSubjectProgress(
+      raw({
+        assessments: [
+          assessment({ id: "a1", finalScore: 80, learningObjectiveIds: ["tp1"] }),
+          assessment({ id: "a2", minimumPassingScore: null, finalScore: 88, learningObjectiveIds: ["tp2"] }),
+        ],
+        learningObjectives: [lo("tp1"), lo("tp2"), lo("tp3")],
+      })
+    );
+    const s = buildSubjectSummary(p);
+    expect(s.tuntasTpCount).toBe(1);
+    expect(s.assessedTpCount).toBe(1); // tp2 TANPA_KKTP & tp3 BELUM_DINILAI dikecualikan
+  });
+});
+
+describe("summarizeMonthlyAttendance — rekap H/S/I/A + LATE", () => {
+  const mk = (status: AttendanceStatusLite, day: number) => ({ status, date: d(day) });
+
+  it("LATE dihitung H + keterangan lateCount (keputusan terkunci #4)", () => {
+    const recap = summarizeMonthlyAttendance([
+      mk("PRESENT", 1),
+      mk("LATE", 2),
+      mk("LATE", 3),
+      mk("SICK", 4),
+      mk("PERMISSION", 5),
+      mk("ABSENT", 6),
+    ]);
+    expect(recap).toHaveLength(1);
+    expect(recap[0]).toMatchObject({ year: 2026, month: 9, hadir: 3, sakit: 1, izin: 1, alpa: 1, lateCount: 2 });
+  });
+
+  it("Bulan tanpa record tidak menghasilkan baris rekap (rekap 0 ditangani UI)", () => {
+    expect(summarizeMonthlyAttendance([])).toEqual([]);
+  });
+
+  it("Rekap terpisah per bulan, terurut terbaru dulu", () => {
+    const recap = summarizeMonthlyAttendance([
+      { status: "PRESENT", date: new Date(2026, 7, 10) }, // Agu
+      { status: "SICK", date: new Date(2026, 8, 10) }, // Sep
+    ]);
+    expect(recap.map((r) => r.month)).toEqual([9, 8]);
+  });
+});
diff --git a/src/modules/student-portal/student-progress.actions.ts b/src/modules/student-portal/student-progress.actions.ts
new file mode 100644
index 0000000..5b706bd
--- /dev/null
+++ b/src/modules/student-portal/student-progress.actions.ts
@@ -0,0 +1,302 @@
+"use server";
+
+/**
+ * Story 7 (CAP-9) — Actions Student Progress untuk portal siswa.
+ * Seluruh identitas di-derive dari verifyStudentSession() (Amendum B1);
+ * semua query di-scope ke periode aktif rombel (§9.4).
+ */
+import { prisma } from "@/lib/auth";
+import { verifyStudentSession } from "@/modules/student-auth/student-session";
+import type { PolicyItemSnapshot } from "@/modules/assessment/assessment.service";
+import {
+  buildSubjectProgress,
+  buildSubjectSummary,
+  summarizeMonthlyAttendance,
+  type AssessmentForProgress,
+  type AssessmentStatusLite,
+  type LearningObjectiveForProgress,
+  type MonthlyAttendanceRecap,
+  type ResultStatusLite,
+  type SubjectProgress,
+  type SubjectProgressSummary,
+} from "./student-progress.service";
+
+export interface StudentProgressPageData {
+  hasActivePeriod: boolean;
+  student: { fullName: string; className: string; academicYear: string };
+  subjects: SubjectProgress[];
+  attendance: MonthlyAttendanceRecap[];
+}
+
+export interface StudentProgressWidgetData {
+  hasActivePeriod: boolean;
+  subjects: SubjectProgressSummary[];
+}
+
+/** Resolusi membership rombel prioritas periode aktif (pola student-portal.actions). */
+async function resolveActiveMembership(studentId: string) {
+  const student = await prisma.student.findUnique({
+    where: { id: studentId },
+    include: {
+      classMemberships: {
+        include: {
+          class: { select: { name: true, gradeLevel: true } },
+          academicPeriod: { select: { id: true, year: true, status: true } },
+        },
+        orderBy: { createdAt: "desc" },
+      },
+    },
+  });
+  if (!student) return null;
+
+  const activeMembership =
+    student.classMemberships.find((cm) => cm.academicPeriod.status === "ACTIVE") ??
+    student.classMemberships[0] ??
+    null;
+
+  return { student, activeMembership };
+}
+
+interface LoadedSubject {
+  progress: SubjectProgress;
+}
+
+async function loadSubjects(
+  studentId: string,
+  classId: string,
+  academicPeriodId: string,
+  includeTpTree: boolean
+): Promise<LoadedSubject[]> {
+  const contexts = await prisma.teachingContext.findMany({
+    where: { classId, academicPeriodId },
+    include: {
+      subject: { select: { name: true } },
+      teacherProfile: { include: { user: { select: { name: true } } } },
+    },
+    orderBy: { subject: { name: "asc" } },
+  });
+
+  const results = await Promise.all(
+    contexts.map(async (tc): Promise<LoadedSubject> => {
+      const teacherName = tc.teacherProfile?.user?.name ?? null;
+
+      // GradePolicy per mapel (pola getScoreRecapReport) — hanya ACTIVE yang berlaku
+      const policy = await prisma.gradePolicy.findUnique({
+        where: { teachingContextId: tc.id },
+        include: {
+          items: { include: { assessmentType: true }, orderBy: { sortOrder: "asc" } },
+        },
+      });
+      const policyActive = policy?.status === "ACTIVE";
+      const policyItems: PolicyItemSnapshot[] =
+        policyActive && policy
+          ? policy.items.map((item) => ({
+              assessmentTypeId: item.assessmentTypeId,
+              assessmentTypeName: item.assessmentType.name,
+              category: item.assessmentType.category,
+              weight: item.weight,
+            }))
+          : [];
+
+      // Hanya assessment COMPLETED yang bisa FINAL — filter pertama (laporan ganda
+      // tetap ditegakkan di service via isFinalScore).
+      const assessments = await prisma.assessment.findMany({
+        where: { teachingContextId: tc.id, status: "COMPLETED" },
+        include: {
+          assessmentType: { select: { id: true, name: true } },
+          learningObjectiveLinks: {
+            select: { learningObjectiveId: true, snapshotCode: true, snapshotDescription: true },
+          },
+          results: {
+            where: { studentId },
+            select: { status: true, finalScore: true, remedialAttempts: { select: { score: true } } },
+          },
+        },
+      });
+
+      const assessmentsForProgress: AssessmentForProgress[] = assessments.map((a) => {
+        const result = a.results[0] ?? null;
+        return {
+          id: a.id,
+          title: a.title,
+          assessmentTypeId: a.assessmentType.id,
+          assessmentTypeName: a.assessmentType.name,
+          assessmentStatus: a.status as AssessmentStatusLite,
+          assessmentDate: new Date(a.assessmentDate),
+          minimumPassingScore: a.minimumPassingScore !== null ? Number(a.minimumPassingScore) : null,
+          resultStatus: result ? (result.status as ResultStatusLite) : null,
+          finalScore: result?.finalScore !== null && result?.finalScore !== undefined ? Number(result.finalScore) : null,
+          remedialScores: result ? result.remedialAttempts.map((r) => Number(r.score)) : [],
+          learningObjectiveIds: a.learningObjectiveLinks.map((l) => l.learningObjectiveId),
+        };
+      });
+
+      let learningObjectives: LearningObjectiveForProgress[] = [];
+      if (includeTpTree) {
+        const los = await prisma.learningObjective.findMany({
+          where: { teachingContextId: tc.id },
+          orderBy: { orderIndex: "asc" },
+        });
+        // Snapshot fallback: kode/deskripsi tersimpan pada link assessment
+        const snapshotByLo = new Map<
+          string,
+          { code: string | null; description: string | null }
+        >();
+        for (const a of assessments) {
+          for (const link of a.learningObjectiveLinks) {
+            if (!snapshotByLo.has(link.learningObjectiveId)) {
+              snapshotByLo.set(link.learningObjectiveId, {
+                code: link.snapshotCode,
+                description: link.snapshotDescription,
+              });
+            }
+          }
+        }
+        learningObjectives = los.map((lo) => {
+          const snapshot = snapshotByLo.get(lo.id);
+          return {
+            id: lo.id,
+            code: lo.code,
+            description: lo.description,
+            orderIndex: lo.orderIndex,
+            status: lo.status,
+            fallbackCode: snapshot?.code ?? null,
+            fallbackDescription: snapshot?.description ?? null,
+          };
+        });
+      }
+
+      return {
+        progress: buildSubjectProgress({
+          teachingContextId: tc.id,
+          subjectName: tc.subject.name,
+          teacherName,
+          policyActive,
+          policyItems,
+          assessments: assessmentsForProgress,
+          learningObjectives,
+        }),
+      };
+    })
+  );
+
+  return results;
+}
+
+/** Data lengkap halaman Nilai: pohon ketuntasan + nilai berjalan + presensi. */
+export async function getStudentProgressDataAction(): Promise<{
+  success: boolean;
+  data?: StudentProgressPageData;
+  error?: string;
+}> {
+  try {
+    const session = await verifyStudentSession();
+    if (!session) {
+      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
+    }
+
+    const resolved = await resolveActiveMembership(session.studentId);
+    if (!resolved) {
+      return { success: false, error: "Data siswa tidak ditemukan." };
+    }
+    const { student, activeMembership } = resolved;
+
+    const emptyData: StudentProgressPageData = {
+      hasActivePeriod: false,
+      student: {
+        fullName: student.fullName,
+        className: "Belum Ada Rombel",
+        academicYear: "-",
+      },
+      subjects: [],
+      attendance: [],
+    };
+    if (!activeMembership) return { success: true, data: emptyData };
+    if (activeMembership.academicPeriod.status !== "ACTIVE") {
+      return { success: true, data: { ...emptyData, hasActivePeriod: false } };
+    }
+
+    const [subjects, attendanceRecords] = await Promise.all([
+      loadSubjects(student.id, activeMembership.classId, activeMembership.academicPeriodId, true),
+      prisma.attendanceRecord.findMany({
+        where: {
+          studentId: student.id,
+          teachingSession: {
+            teachingContext: {
+              classId: activeMembership.classId,
+              academicPeriodId: activeMembership.academicPeriodId,
+            },
+          },
+        },
+        include: { teachingSession: { select: { date: true } } },
+      }),
+    ]);
+
+    return {
+      success: true,
+      data: {
+        hasActivePeriod: true,
+        student: {
+          fullName: student.fullName,
+          className: `${activeMembership.class.name} (${activeMembership.class.gradeLevel || "Kelas"})`,
+          academicYear: activeMembership.academicPeriod.year,
+        },
+        subjects: subjects.map((s) => s.progress),
+        attendance: summarizeMonthlyAttendance(
+          attendanceRecords.map((r) => ({
+            status: r.status,
+            date: new Date(r.teachingSession.date),
+          }))
+        ),
+      },
+    };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data capaian belajar.",
+    };
+  }
+}
+
+/** Widget ketuntasan ringkas untuk beranda (2.4) — tanpa pohon & presensi. */
+export async function getStudentProgressWidgetAction(): Promise<{
+  success: boolean;
+  data?: StudentProgressWidgetData;
+  error?: string;
+}> {
+  try {
+    const session = await verifyStudentSession();
+    if (!session) {
+      return { success: false, error: "Sesi tidak valid atau telah berakhir." };
+    }
+
+    const resolved = await resolveActiveMembership(session.studentId);
+    if (!resolved) {
+      return { success: false, error: "Data siswa tidak ditemukan." };
+    }
+    const { student, activeMembership } = resolved;
+    if (!activeMembership || activeMembership.academicPeriod.status !== "ACTIVE") {
+      return { success: true, data: { hasActivePeriod: false, subjects: [] } };
+    }
+
+    const subjects = await loadSubjects(
+      student.id,
+      activeMembership.classId,
+      activeMembership.academicPeriodId,
+      true // widget menampilkan ringkasan ketuntasan TP per mapel
+    );
+
+    return {
+      success: true,
+      data: {
+        hasActivePeriod: true,
+        subjects: subjects.map((s) => buildSubjectSummary(s.progress)),
+      },
+    };
+  } catch (err: unknown) {
+    return {
+      success: false,
+      error: err instanceof Error ? err.message : "Terjadi kesalahan saat memuat widget capaian.",
+    };
+  }
+}
diff --git a/src/modules/student-portal/student-progress.service.ts b/src/modules/student-portal/student-progress.service.ts
new file mode 100644
index 0000000..1b05d8c
--- /dev/null
+++ b/src/modules/student-portal/student-progress.service.ts
@@ -0,0 +1,297 @@
+/**
+ * Story 7 (CAP-9) — Service agregasi murni untuk Student Progress.
+ * Tanpa akses DB: semua input berupa snapshot; unit-testable.
+ *
+ * Aturan mengikat (glossary.md + keputusan terkunci human 2026-09-23):
+ * - Nilai FINAL kanonik = AssessmentResult.status === "GRADED" DAN
+ *   parent Assessment.status === "COMPLETED" (join ganda, bukan filter satu sisi).
+ * - Skor null / ABSENT / EXCUSED / PENDING dikecualikan — TIDAK pernah jadi 0.
+ * - Nilai berjalan per mapel: reuse bobot GradePolicy (ACTIVE) via
+ *   calculateStudentRunningPerformance(); fallback rata-rata flat berlabel.
+ * - Pohon ketuntasan TP: proporsi KKTP per penilaian; penilaian tanpa KKTP
+ *   hanya menyumbang skor/tren (dikecualikan dari proporsi).
+ * - Presensi: LATE dihitung H (hadir) + keterangan jumlah telat.
+ */
+import {
+  calculateStudentRunningPerformance,
+  type PolicyItemSnapshot,
+  type StudentScoreSnapshot,
+} from "@/modules/assessment/assessment.service";
+
+export type AssessmentStatusLite = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
+export type ResultStatusLite = "PENDING" | "GRADED" | "ABSENT" | "EXCUSED";
+export type AttendanceStatusLite = "PRESENT" | "SICK" | "PERMISSION" | "ABSENT" | "LATE";
+
+export interface ScoredResultInput {
+  assessmentStatus: AssessmentStatusLite;
+  resultStatus: ResultStatusLite | null;
+  finalScore: number | null;
+}
+
+/**
+ * Nilai FINAL kanonik — keputusan ganda (glossary.md).
+ * Wajib dipakai semua agregasi; memfilter AssessmentResult saja TIDAK cukup.
+ */
+export function isFinalScore(input: ScoredResultInput): boolean {
+  return (
+    input.assessmentStatus === "COMPLETED" &&
+    input.resultStatus === "GRADED" &&
+    input.finalScore !== null
+  );
+}
+
+export interface AssessmentForProgress {
+  id: string;
+  title: string;
+  assessmentTypeId: string;
+  assessmentTypeName: string;
+  assessmentStatus: AssessmentStatusLite;
+  assessmentDate: Date;
+  /** KKTP per penilaian (Assessment.minimumPassingScore); null = tanpa KKTP */
+  minimumPassingScore: number | null;
+  /** Status AssessmentResult milik siswa ini; null = belum ada row result */
+  resultStatus: ResultStatusLite | null;
+  finalScore: number | null;
+  remedialScores: number[];
+  learningObjectiveIds: string[];
+}
+
+export interface LearningObjectiveForProgress {
+  id: string;
+  code: string | null;
+  description: string;
+  orderIndex: number;
+  status: "ACTIVE" | "ARCHIVED";
+  /** Snapshot fallback (AssessmentLearningObjective) saat LO non-ACTIVE */
+  fallbackCode: string | null;
+  fallbackDescription: string | null;
+}
+
+export interface SubjectRawData {
+  teachingContextId: string;
+  subjectName: string;
+  teacherName: string | null;
+  policyActive: boolean;
+  policyItems: PolicyItemSnapshot[];
+  assessments: AssessmentForProgress[];
+  learningObjectives: LearningObjectiveForProgress[];
+}
+
+export type TpMasteryStatus = "TUNTAS" | "BELUM_TUNTAS" | "BELUM_DINILAI" | "TANPA_KKTP";
+
+export interface TpMasteryItem {
+  learningObjectiveId: string;
+  code: string | null;
+  description: string;
+  status: TpMasteryStatus;
+  /** y — jumlah penilaian FINAL ber-KKTP yang mengukur TP ini */
+  assessedCount: number;
+  /** x — jumlah penilaian ber-KKTP yang finalScore >= KKTP-nya */
+  masteredCount: number;
+  /** Rata-rata skor FINAL (info; bukan penentu ketuntasan) */
+  averageScore: number | null;
+  latestScore: number | null;
+  latestScoreDate: string | null;
+  remedialCount: number;
+}
+
+export interface TrendPoint {
+  assessmentId: string;
+  title: string;
+  date: string;
+  score: number;
+}
+
+export type ScoringMode = "WEIGHTED" | "FLAT_FALLBACK";
+
+export interface SubjectProgress {
+  teachingContextId: string;
+  subjectName: string;
+  teacherName: string | null;
+  /** Nilai berjalan: berbobot (policy ACTIVE) atau fallback flat */
+  runningScore: number | null;
+  scoringMode: ScoringMode;
+  availableWeight: number | null;
+  flatAverage: number | null;
+  finalCount: number;
+  trend: TrendPoint[];
+  tpTree: TpMasteryItem[];
+}
+
+export interface SubjectProgressSummary {
+  teachingContextId: string;
+  subjectName: string;
+  runningScore: number | null;
+  scoringMode: ScoringMode;
+  tuntasTpCount: number;
+  assessedTpCount: number;
+  hasFinalData: boolean;
+}
+
+export interface AttendanceRecordLite {
+  status: AttendanceStatusLite;
+  date: Date;
+}
+
+export interface MonthlyAttendanceRecap {
+  year: number;
+  /** 1–12 */
+  month: number;
+  hadir: number;
+  sakit: number;
+  izin: number;
+  alpa: number;
+  /** Keterangan: hadir tapi telat (termasuk di `hadir`) */
+  lateCount: number;
+}
+
+function mean(values: number[]): number | null {
+  if (values.length === 0) return null;
+  const sum = values.reduce((acc, v) => acc + v, 0);
+  return Math.round((sum / values.length) * 100) / 100;
+}
+
+/** Agregasi satu mapel: nilai berjalan + tren + pohon ketuntasan TP. */
+export function buildSubjectProgress(raw: SubjectRawData): SubjectProgress {
+  // FINAL-only (join ganda via isFinalScore); urut kronologis
+  const finals = raw.assessments
+    .filter((a) =>
+      isFinalScore({
+        assessmentStatus: a.assessmentStatus,
+        resultStatus: a.resultStatus,
+        finalScore: a.finalScore,
+      })
+    )
+    .sort((a, b) => a.assessmentDate.getTime() - b.assessmentDate.getTime());
+
+  const finalScores = finals.map((a) => a.finalScore as number);
+  const flatAverage = mean(finalScores);
+
+  let runningScore: number | null = null;
+  let availableWeight: number | null = null;
+  let scoringMode: ScoringMode = "FLAT_FALLBACK";
+
+  if (raw.policyActive && raw.policyItems.length > 0) {
+    // REUSE — jangan tulis ulang logika bobot; gating FINAL terjadi di dalamnya.
+    const scoreSnapshots: StudentScoreSnapshot[] = raw.assessments.map((a) => ({
+      assessmentId: a.id,
+      assessmentTypeId: a.assessmentTypeId,
+      assessmentTypeName: a.assessmentTypeName,
+      assessmentStatus: a.assessmentStatus,
+      resultStatus: a.resultStatus ?? "PENDING",
+      finalScore: a.finalScore,
+    }));
+    const calc = calculateStudentRunningPerformance(
+      { id: "student", fullName: "student", nis: null },
+      raw.policyItems,
+      scoreSnapshots
+    );
+    scoringMode = "WEIGHTED";
+    runningScore = calc.runningPerformance !== null ? Number(calc.runningPerformance) : null;
+    availableWeight = calc.availableWeight !== null ? Number(calc.availableWeight) : null;
+  } else {
+    // Fallback flat berlabel (keputusan terkunci #1)
+    runningScore = flatAverage;
+  }
+
+  // Pohon ketuntasan TP — proporsi KKTP per penilaian (keputusan terkunci #2)
+  const tpTree: TpMasteryItem[] = [...raw.learningObjectives]
+    .sort((a, b) => a.orderIndex - b.orderIndex)
+    .map((lo) => {
+      const linkedFinals = finals.filter((a) => a.learningObjectiveIds.includes(lo.id));
+      const withKktp = linkedFinals.filter((a) => a.minimumPassingScore !== null);
+      const mastered = withKktp.filter((a) => (a.finalScore as number) >= (a.minimumPassingScore as number));
+      const remedialCount = linkedFinals.reduce((acc, a) => acc + a.remedialScores.length, 0);
+      const latest = linkedFinals[linkedFinals.length - 1] ?? null;
+
+      let status: TpMasteryStatus;
+      if (linkedFinals.length === 0) {
+        status = "BELUM_DINILAI";
+      } else if (withKktp.length === 0) {
+        status = "TANPA_KKTP";
+      } else {
+        status = mastered.length === withKktp.length ? "TUNTAS" : "BELUM_TUNTAS";
+      }
+
+      const useLive = lo.status === "ACTIVE";
+      return {
+        learningObjectiveId: lo.id,
+        code: useLive ? lo.code : lo.fallbackCode ?? lo.code,
+        description: useLive ? lo.description : lo.fallbackDescription ?? lo.description,
+        status,
+        assessedCount: withKktp.length,
+        masteredCount: mastered.length,
+        averageScore: mean(linkedFinals.map((a) => a.finalScore as number)),
+        latestScore: latest ? (latest.finalScore as number) : null,
+        latestScoreDate: latest ? latest.assessmentDate.toISOString() : null,
+        remedialCount,
+      };
+    });
+
+  return {
+    teachingContextId: raw.teachingContextId,
+    subjectName: raw.subjectName,
+    teacherName: raw.teacherName,
+    runningScore,
+    scoringMode,
+    availableWeight,
+    flatAverage,
+    finalCount: finals.length,
+    trend: finals.map((a) => ({
+      assessmentId: a.id,
+      title: a.title,
+      date: a.assessmentDate.toISOString(),
+      score: a.finalScore as number,
+    })),
+    tpTree,
+  };
+}
+
+/** Ringkasan widget beranda (2.4) dari SubjectProgress. */
+export function buildSubjectSummary(p: SubjectProgress): SubjectProgressSummary {
+  const assessed = p.tpTree.filter((t) => t.status === "TUNTAS" || t.status === "BELUM_TUNTAS");
+  return {
+    teachingContextId: p.teachingContextId,
+    subjectName: p.subjectName,
+    runningScore: p.runningScore,
+    scoringMode: p.scoringMode,
+    tuntasTpCount: p.tpTree.filter((t) => t.status === "TUNTAS").length,
+    assessedTpCount: assessed.length,
+    hasFinalData: p.finalCount > 0,
+  };
+}
+
+/** Rekap presensi bulanan H/S/I/A; LATE dihitung H + lateCount (keputusan #4). */
+export function summarizeMonthlyAttendance(records: AttendanceRecordLite[]): MonthlyAttendanceRecap[] {
+  const byMonth = new Map<string, MonthlyAttendanceRecap>();
+
+  for (const r of records) {
+    const d = new Date(r.date);
+    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
+    let recap = byMonth.get(key);
+    if (!recap) {
+      recap = { year: d.getFullYear(), month: d.getMonth() + 1, hadir: 0, sakit: 0, izin: 0, alpa: 0, lateCount: 0 };
+      byMonth.set(key, recap);
+    }
+    switch (r.status) {
+      case "PRESENT":
+        recap.hadir++;
+        break;
+      case "LATE":
+        recap.hadir++; // hadir, terlambat — keterangan terpisah
+        recap.lateCount++;
+        break;
+      case "SICK":
+        recap.sakit++;
+        break;
+      case "PERMISSION":
+        recap.izin++;
+        break;
+      case "ABSENT":
+        recap.alpa++;
+        break;
+    }
+  }
+
+  return Array.from(byMonth.values()).sort((a, b) => b.year - a.year || b.month - a.month);
+}
```
