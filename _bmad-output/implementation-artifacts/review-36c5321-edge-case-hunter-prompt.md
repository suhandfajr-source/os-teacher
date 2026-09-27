Read the following reviewer instruction file contents (inlined below between the INSTRUCTION markers) completely and follow it as your review instructions.

===== BEGIN REVIEWER INSTRUCTION FILE (inlined) =====

# Edge Case Hunter Review

**Goal:** You are a pure path tracer. Never comment on whether code is good or bad; only list missing handling.
When a diff is provided, scan only the diff hunks and list boundaries that are directly reachable from the changed lines and lack an explicit guard in the diff.
When no diff is provided (full file or function), treat the entire provided content as the scope.
Ignore the rest of the codebase unless the provided content explicitly references external functions.
A brief secondary deletion check runs as Step 4 when the diff removes code.
A claims check runs as Step 5 when the launch message names a claims file.

**Inputs:**
- **content** — Content to review, or a path to read it from: diff, full file, or function
- **also_consider** (optional) — Areas to keep in mind during review alongside normal edge-case analysis
- **claims_file** (optional) — Path to the change's stated narrative. Do NOT read it before Step 5: the path tracing in Steps 2–3 must finish before the narrative is seen.

**MANDATORY: Execute steps in the Execution section IN EXACT ORDER. DO NOT skip steps or change the sequence. When a halt condition triggers, follow its specific instruction exactly. Each action within a step is a REQUIRED action to complete that step.**

**Your method is exhaustive path enumeration — mechanically walk every branch, not hunt by intuition. Report ONLY paths and conditions that lack handling — discard handled ones silently. Do NOT editorialize or add filler. Do not assign severity labels, rankings, or priority levels.**


## EXECUTION

### Step 1: Receive Content

- Take the content to review from the parent message that launched you — inline, or by reading the file it points to (never from this instruction file)
- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
- Identify content type (diff, full file, or function) to determine scope rules

### Step 2: Exhaustive Path Analysis

**Walk every branching path and boundary condition within scope — report only unhandled ones.**

- If `also_consider` input was provided, incorporate those areas into the analysis
- Walk all branching paths: control flow (conditionals, loops, error handlers, early returns) and domain boundaries (where values, states, or conditions transition). Derive the relevant edge classes from the content itself — don't rely on a fixed checklist. Examples: missing else/default, unguarded inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Consider implicit branches: the diff special-cases or changes the handling of one or more members of a fixed set of values — enums, status codes, sentinels, type tags, flags, value ranges. The rest of the set is implicit branches (e.g. the diff changes the `RED` and `YELLOW` cases of a `RED`/`YELLOW`/`GREEN` enum; `GREEN` is the implicit branch)
- Consider handle lifetime: when the changed code re-checks, re-fetches, or re-validates something it already held — a handle, index, id, pointer — the re-check exists because an intervening call can invalidate it. Identify that call, what it does to the thing held, and what the changed code silently skips when the re-check fails
- For each call site the diff adds or changes — in test files as well as production code — read the callee's declaration and check the call against it: argument count, order, types, and defaults. Report any mismatch
- For each path: determine whether the content handles it
- Collect only the unhandled paths as findings — discard handled ones silently

### Step 3: Validate Completeness

- Revisit every edge class from Step 2 — e.g., missing else/default, null/empty inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Add any newly found unhandled paths to findings; discard confirmed-handled ones

### Step 4: Deletion Check

If the diff removed or replaced meaningful code (ignore pure renames and whitespace): load `references/deletion-check.md` and follow it.

### Step 5: Claims Check

If the launch message provided a `claims_file` path and the file exists and is non-empty: load `references/claims-check.md` and follow it.

### Step 6: Present Findings

Output all findings as a single JSON array following the Output Format specification exactly.


## OUTPUT FORMAT

Return ONLY a valid JSON array of objects. Each edge-case finding contains exactly these four fields:

```json
[{
  "location": "file:start-end (or file:line when single line, or file:hunk when exact line unavailable)",
  "trigger_condition": "one-line description (max 15 words)",
  "guard_snippet": "minimal code sketch that closes the gap (single-line escaped string, no raw newlines or unescaped quotes)",
  "potential_consequence": "what could actually go wrong (max 15 words)"
}]
```

No extra text, no explanations, no markdown wrapping. An empty array `[]` is valid when nothing is found. Deletion findings from Step 4 and claim findings from Step 5, if any, go in the same array with the extra fields defined in `references/deletion-check.md` and `references/claims-check.md`.


## HALT CONDITIONS

- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
<reference path="references/deletion-check.md">
# Deletion Check

Secondary pass for the Edge Case Hunter — runs only when the diff removed meaningful code. Subordinate to the edge-case pass; findings are usually few or none.

For each chunk of removed or replaced code (ignore pure renames and whitespace), ask: did it carry behavior or a contract that the change neither re-established nor intentionally retired? Add a finding for any resulting regression, orphaned reference, or newly-dead code. Skip anything already covered by your edge-case findings.

Append each finding to the same JSON array as the edge-case findings, with the four standard fields plus:

- `kind`: `"deletion"`
- `confidence`: `"high"`, `"medium"`, or `"low"` — these are inferences; rate them

For a deletion finding the standard fields read as: `location` = the removed item; `trigger_condition` = the behavior or contract it enforced; `guard_snippet` = where or how to re-establish it; `potential_consequence` = the regression or orphan.

Add nothing if nothing qualifies.
</reference>
<reference path="references/claims-check.md">
# Claims Check

Final pass for the Edge Case Hunter — runs only when the message that launched you named a claims file. Read that file now, for the first time; the path tracing is finished and the claims cannot steer it retroactively.

The file holds the change's own narrative — commit messages and any stated description. The narrative is the author's testimony, not evidence: a claim repeated in a code comment is still the same claim, not confirmation. Extract each checkable claim — what the change does, what it preserves, ordering, arithmetic, and parity with existing code ("exactly as X does") — then try to falsify each one against the code you have already traced. Where your trace is not enough to decide, read the code that decides it: the compared-to function, the actual callee, the state the claim assumes.

Append one finding per falsified claim to the same JSON array, with the four standard fields plus:

- `kind`: `"claim"`
- `confidence`: `"high"`, `"medium"`, or `"low"`

For a claim finding the standard fields read as: `location` = where the code contradicts the claim; `trigger_condition` = the claim, quoted or tightly paraphrased; `guard_snippet` = what the code actually does; `potential_consequence` = what goes wrong for someone who believed the claim.

Verified claims produce nothing. Add nothing if nothing is falsified.
</reference>

## CONTENT SOURCE

"Review content:" in the message that launched you gives the content itself or a path to read it from. Read the file when it is a path; either way that is the content under review, and this instruction file never is.

===== END REVIEWER INSTRUCTION FILE =====

claims_file (leave unread until your instructions call for it): the claims contents, inlined below between the CLAIMS markers (this session shares no filesystem with the parent, so treat the marked block as the claims file's contents):

===== BEGIN CLAIMS FILE (inlined) =====

Commit message: feat(portal-siswa): enhance student portal auth, approvals list, and teacher student status tracking

User narrative (verbatim): "saya telah melakukan perubahan pada sistem dan auth register siswa, dimana siswa register melalui kode rombel guru, dan diverifikasi dengan tanggal lahir, guru memverifikasi dan approval, seharusnya guru juga memiliki akses untuk melihat, mengedit, dan menghapus akses siswa, saya ingin BMAD menganalisis perubahan tersebut, kira-kira masih ada celah dimana, dan kemudian apakah sudah terintegrasi dengan baik dengan portal guru"

===== END CLAIMS FILE =====

Review content: the unified diff below, inlined between the DIFF markers (this session shares no filesystem with the parent). It is the content under review.

===== BEGIN DIFF (inlined) =====

```diff
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 4087ab3..d7e6080 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -331,6 +331,11 @@ model Student {
   accountRequestedAt DateTime? // Story 5 F2 — waktu pengajuan akun (sumber tunggal eskalasi)
   approvedBy         User?     @relation("StudentApprover", fields: [approvedById], references: [id])
 
+  // Tanggal lahir & deteksi anomali pendaftaran
+  birthDate          String?   // Tanggal lahir (DD/MM/YYYY atau YYYY-MM-DD)
+  birthDateConflict  Boolean   @default(false)
+  conflictBirthDates String?   // Riwayat tanggal lahir bentrok jika ada multiple submission
+
   classMemberships      ClassStudent[]
   attendanceRecords     AttendanceRecord[]
   assessmentResults     AssessmentResult[]
diff --git a/src/app/(auth)/layout.tsx b/src/app/(auth)/layout.tsx
index 85bf114..3fe659d 100644
--- a/src/app/(auth)/layout.tsx
+++ b/src/app/(auth)/layout.tsx
@@ -2,6 +2,7 @@ import { getRscAuthContext } from "@/lib/rsc-auth-context";
 import { redirect } from "next/navigation";
 import { KlassaLogo, ModularCockpitArtwork } from "@/components/brand";
 import Link from "next/link";
+import { ShieldCheck } from "lucide-react";
 
 export default async function AuthLayout({ children }: { children: React.ReactNode }) {
   let authContext = null;
@@ -22,34 +23,44 @@ export default async function AuthLayout({ children }: { children: React.ReactNo
   }
 
   return (
-    <div className="min-h-screen w-full bg-white text-slate-900 flex flex-col lg:flex-row relative overflow-x-hidden font-sans selection:bg-teal-500 selection:text-white">
+    <div className="min-h-screen w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row relative overflow-x-hidden font-sans selection:bg-teal-500 selection:text-white">
       
       {/* ─────────────────────────────────────────────────────────────
-          SISI KIRI: FORM & BRANDING (50% VIEWPORT EDGE-TO-EDGE)
+          SISI KIRI: FORM & BRANDING (DEKAT DENGAN GARIS GELOMBANG)
       ───────────────────────────────────────────────────────────── */}
-      <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 pb-10 sm:pb-12 lg:pb-12 pl-8 sm:pl-12 lg:pl-16 flex flex-col justify-between z-10 bg-white min-h-screen">
+      <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 flex flex-col justify-between z-10 bg-white dark:bg-slate-950 min-h-screen">
         
-        {/* Top Brand Logo */}
-        <div>
-          <Link href="/" className="inline-flex items-center hover:opacity-90 transition-opacity">
+        {/* Top Brand Logo (Aligned with Form) */}
+        <div className="w-full max-w-[380px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 pt-1">
+          <Link 
+            href="/" 
+            className="inline-flex items-center hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all"
+            aria-label="Beranda KLASSA"
+          >
             <KlassaLogo variant="horizontal" size="xs" priority />
           </Link>
         </div>
 
-        {/* Form Content Area */}
-        <div className="my-auto py-4 max-w-[360px] w-full">
+        {/* Form Content Area (Didekatkan ke garis gelombang sisi kanan) */}
+        <div className="my-auto py-6 w-full max-w-[380px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14">
           {children}
         </div>
 
-        {/* Bottom Micro Switcher & Copyright with Safe Elevation */}
-        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
-          <span>&copy; {new Date().getFullYear()} KLASSA &bull; Naik Kelas Bersama</span>
+        {/* Bottom Micro Switcher & Copyright (Aligned with Form) */}
+        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 w-full max-w-[380px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 pb-1">
+          <span>&copy; {new Date().getFullYear()} KLASSA &bull; Guru</span>
+          <Link
+            href="/portal-siswa"
+            className="font-bold text-[#0F766E] dark:text-teal-400 hover:underline"
+          >
+            Masuk Portal Siswa &rarr;
+          </Link>
         </div>
 
       </div>
 
       {/* ─────────────────────────────────────────────────────────────
-          SISI KANAN: 50% VIEWPORT S-CURVE WAVE + 3D MODULAR COCKPIT
+          SISI KANAN: S-CURVE WAVE + 3D MODULAR COCKPIT (MENYATU DENGAN BACKGROUND PUTIH)
       ───────────────────────────────────────────────────────────── */}
       <ModularCockpitArtwork theme="teal" portalType="teacher" />
 
diff --git a/src/app/(auth)/login/page.tsx b/src/app/(auth)/login/page.tsx
index 64e4a57..e092b8f 100644
--- a/src/app/(auth)/login/page.tsx
+++ b/src/app/(auth)/login/page.tsx
@@ -7,7 +7,7 @@ import { authClient } from "@/lib/auth-client";
 import { useRouter } from "next/navigation";
 import Link from "next/link";
 import { toast } from "sonner";
-import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
+import { Eye, EyeOff, Mail, Lock, ArrowRight, GraduationCap } from "lucide-react";
 
 export default function LoginPage() {
   const router = useRouter();
diff --git a/src/app/(dashboard)/kelas/KelasOverviewClient.tsx b/src/app/(dashboard)/kelas/KelasOverviewClient.tsx
index 49d3957..59aa6dd 100644
--- a/src/app/(dashboard)/kelas/KelasOverviewClient.tsx
+++ b/src/app/(dashboard)/kelas/KelasOverviewClient.tsx
@@ -27,6 +27,8 @@ import {
   Calendar,
   Clock,
   Edit3,
+  KeyRound,
+  Copy,
 } from "lucide-react";
 import { ScheduleConfigDialog } from "@/components/schedule/ScheduleConfigDialog";
 
@@ -37,6 +39,8 @@ interface ContextItem {
     id: string;
     name: string;
     gradeLevel: string | null;
+    joinCode?: string | null;
+    joinCodeLocked?: boolean;
     _count: { classStudents: number };
   };
   academicPeriod: { id: string; year: string; semester: string };
@@ -230,8 +234,28 @@ export function KelasOverviewClient({ contexts, schoolMaster, schoolName }: Prop
 
               {/* Main Card Content as Link to class detail */}
               <Link href={`/kelas/${ctx.id}`} className="block flex-1 cursor-pointer">
-                {/* Top Status Tag */}
-                <div className="flex items-center justify-end mb-3">
+                {/* Top Status Tag & Kode Rombel */}
+                <div className="flex items-center justify-between gap-1.5 mb-3">
+                  {ctx.class.joinCode ? (
+                    <button
+                      type="button"
+                      onClick={(e) => {
+                        e.preventDefault();
+                        e.stopPropagation();
+                        navigator.clipboard.writeText(ctx.class.joinCode!);
+                        toast.success(`Kode rombel ${ctx.class.name} (${ctx.class.joinCode}) disalin!`);
+                      }}
+                      className="inline-flex items-center gap-1 text-[11px] font-mono font-extrabold text-teal-800 bg-teal-50 hover:bg-teal-100/90 active:scale-95 px-2 py-0.5 rounded-lg border border-teal-200/80 transition-all cursor-pointer"
+                      title="Klik untuk salin kode rombel siswa"
+                    >
+                      <KeyRound className="w-3 h-3 text-teal-600" />
+                      <span>{ctx.class.joinCode}</span>
+                      <Copy className="w-2.5 h-2.5 text-teal-600 opacity-60 ml-0.5" />
+                    </button>
+                  ) : (
+                    <span />
+                  )}
+
                   {ctx.class.gradeLevel ? (
                     <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">
                       Tingkat {ctx.class.gradeLevel}
diff --git a/src/app/(dashboard)/kelas/[teachingContextId]/RuangMengajarClient.tsx b/src/app/(dashboard)/kelas/[teachingContextId]/RuangMengajarClient.tsx
index d47c4c6..b74bfbe 100644
--- a/src/app/(dashboard)/kelas/[teachingContextId]/RuangMengajarClient.tsx
+++ b/src/app/(dashboard)/kelas/[teachingContextId]/RuangMengajarClient.tsx
@@ -28,7 +28,9 @@ import {
   Sparkles,
   Edit3,
   ExternalLink,
-  GraduationCap
+  GraduationCap,
+  KeyRound,
+  Copy,
 } from "lucide-react";
 
 export type SessionWithAttendance = {
@@ -57,6 +59,7 @@ interface RuangMengajarClientProps {
     subjectName: string;
     academicPeriodYear: string;
     academicPeriodSemester: string;
+    joinCode?: string | null;
   };
   sessions: SessionWithAttendance[];
   roster: RosterItem[];
@@ -161,10 +164,25 @@ export default function RuangMengajarClient({
               <BookOpen className="w-5 h-5" />
             </div>
             <div>
-              <div className="flex items-center gap-2">
+              <div className="flex items-center gap-2 flex-wrap">
                 <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/30 text-emerald-300 uppercase tracking-wider border border-emerald-500/40">
                   Ruang Mengajar Terpadu
                 </span>
+                {context.joinCode && (
+                  <button
+                    type="button"
+                    onClick={() => {
+                      navigator.clipboard.writeText(context.joinCode!);
+                      toast.success(`Kode rombel ${context.className} (${context.joinCode}) disalin!`);
+                    }}
+                    className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-teal-200 bg-teal-900/60 hover:bg-teal-800/80 active:scale-95 px-2.5 py-0.5 rounded-full border border-teal-500/40 transition-all cursor-pointer"
+                    title="Klik untuk salin kode rombel siswa"
+                  >
+                    <KeyRound className="w-3 h-3 text-teal-400" />
+                    <span>Kode Rombel: {context.joinCode}</span>
+                    <Copy className="w-2.5 h-2.5 text-teal-400 opacity-70 ml-0.5" />
+                  </button>
+                )}
               </div>
               <h2 className="text-base font-bold text-white mt-1">
                 Mulai Pembelajaran Hari Ini — {context.className}
diff --git a/src/app/(dashboard)/kelas/[teachingContextId]/page.tsx b/src/app/(dashboard)/kelas/[teachingContextId]/page.tsx
index 4171448..b5a9c4e 100644
--- a/src/app/(dashboard)/kelas/[teachingContextId]/page.tsx
+++ b/src/app/(dashboard)/kelas/[teachingContextId]/page.tsx
@@ -122,6 +122,7 @@ export default async function KelasDetailPage({
         subjectName: fullContext.subject.name,
         academicPeriodYear: fullContext.academicPeriod.year,
         academicPeriodSemester: fullContext.academicPeriod.semester,
+        joinCode: fullContext.class.joinCode,
       }}
       sessions={sessions}
       roster={roster}
diff --git a/src/app/(dashboard)/persetujuan/PersetujuanClient.tsx b/src/app/(dashboard)/persetujuan/PersetujuanClient.tsx
index 45a975a..78aad9f 100644
--- a/src/app/(dashboard)/persetujuan/PersetujuanClient.tsx
+++ b/src/app/(dashboard)/persetujuan/PersetujuanClient.tsx
@@ -30,6 +30,8 @@ import {
   ArrowRightLeft,
   KeyRound,
   ListChecks,
+  Calendar,
+  AlertTriangle,
 } from "lucide-react";
 
 interface ClassOption {
@@ -212,6 +214,18 @@ export function PersetujuanClient({ initialPending, escalatedThresholdHours, cla
                   <div className="flex items-center gap-2 flex-wrap">
                     <span className="font-semibold truncate">{p.fullName}</span>
                     {p.nis && <Badge variant="outline">NIS {p.nis}</Badge>}
+                    {p.birthDate && (
+                      <Badge variant="outline" className="text-teal-700 border-teal-200 bg-teal-50/50">
+                        <Calendar className="h-3 w-3 mr-1" />
+                        Lahir: {p.birthDate}
+                      </Badge>
+                    )}
+                    {p.birthDateConflict && (
+                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
+                        <AlertTriangle className="h-3 w-3 mr-1" />
+                        Konflik Tgl Lahir: {p.conflictBirthDates || p.birthDate}
+                      </Badge>
+                    )}
                     <Badge variant="secondary">
                       <Users className="h-3 w-3 mr-1" />
                       {p.className}
diff --git a/src/app/(dashboard)/siswa/SiswaListClient.tsx b/src/app/(dashboard)/siswa/SiswaListClient.tsx
index 142df9c..3fea050 100644
--- a/src/app/(dashboard)/siswa/SiswaListClient.tsx
+++ b/src/app/(dashboard)/siswa/SiswaListClient.tsx
@@ -22,12 +22,18 @@ import {
   Hourglass,
   Check,
   X,
+  CheckCircle2,
+  UserCheck,
+  UserX,
+  ShieldAlert,
 } from "lucide-react";
 
 interface StudentItem {
   id: string;
   fullName: string;
   nis: string | null;
+  accountStatus: "ACTIVE" | "PENDING" | "UNREGISTERED";
+  hasPin: boolean;
 }
 
 interface ClassGroup {
@@ -56,19 +62,26 @@ interface Props {
 export function SiswaListClient({ classGroups, totalStudents, pendingStudents = [] }: Props) {
   const router = useRouter();
   const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
+  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
   const [searchQuery, setSearchQuery] = useState<string>("");
   const [pending, setPending] = useState<PendingStudentItem[]>(pendingStudents);
   const [isPendingTransition, startTransition] = useTransition();
 
   const q = searchQuery.toLowerCase().trim();
 
+  // Compute status metrics across all students
+  const allStudents = classGroups.flatMap((cg) => cg.students);
+  const countActive = allStudents.filter((s) => s.accountStatus === "ACTIVE").length;
+  const countPending = allStudents.filter((s) => s.accountStatus === "PENDING").length;
+  const countUnregistered = allStudents.filter((s) => s.accountStatus === "UNREGISTERED").length;
+
   const handleApprove = (studentId: string) => {
     startTransition(async () => {
       const res = await approveStudentAction(studentId);
       if (res.success) {
         toast.success("Siswa disetujui. Akun aktif seketika.");
         setPending((prev) => prev.filter((p) => p.studentId !== studentId));
-        router.refresh(); // BH-11: roster & panel server-side ikut sinkron
+        router.refresh();
       } else {
         toast.error(res.message || "Aksi gagal.");
       }
@@ -94,33 +107,107 @@ export function SiswaListClient({ classGroups, totalStudents, pendingStudents =
     });
   };
 
-  // Filter classes & students
+  // Filter classes & students by class, status, and query
   const filteredGroups = classGroups
     .filter((cg) => selectedClassId === "ALL" || cg.id === selectedClassId)
     .map((cg) => ({
       ...cg,
-      students: cg.students.filter(
-        (s) =>
-          !q ||
-          s.fullName.toLowerCase().includes(q) ||
-          (s.nis && s.nis.toLowerCase().includes(q))
-      ),
+      students: cg.students.filter((s) => {
+        // Status filter
+        if (selectedStatus !== "ALL" && s.accountStatus !== selectedStatus) {
+          return false;
+        }
+        // Search query
+        if (q) {
+          const matchName = s.fullName.toLowerCase().includes(q);
+          const matchNis = s.nis && s.nis.toLowerCase().includes(q);
+          return matchName || matchNis;
+        }
+        return true;
+      }),
     }))
-    .filter((cg) => cg.students.length > 0 || !q);
+    .filter((cg) => cg.students.length > 0 || (!q && selectedStatus === "ALL"));
 
   return (
-    <div className="space-y-6 max-w-5xl mx-auto">
+    <div className="space-y-6 max-w-5xl mx-auto pb-12">
       {/* Header */}
       <div>
         <h1 className="text-3xl font-bold tracking-tight">Daftar Siswa</h1>
         <p className="text-muted-foreground mt-1">
-          Daftar seluruh siswa terkelompok rapi berdasarkan kelas yang Anda ampu.
+          Daftar seluruh siswa terkelompok rapi berdasarkan kelas yang Anda ampu beserta status akun portal.
         </p>
       </div>
 
+      {/* Overview Stat Cards */}
+      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
+        <div
+          onClick={() => setSelectedStatus("ALL")}
+          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
+            selectedStatus === "ALL"
+              ? "bg-primary/10 border-primary ring-1 ring-primary"
+              : "bg-card hover:bg-muted/50"
+          }`}
+        >
+          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
+            <span>Total Siswa</span>
+            <Users className="h-4 w-4 text-primary" />
+          </div>
+          <div className="text-2xl font-bold mt-1 text-foreground">{totalStudents}</div>
+          <div className="text-[11px] text-muted-foreground mt-0.5">Semua rombel diampu</div>
+        </div>
+
+        <div
+          onClick={() => setSelectedStatus("ACTIVE")}
+          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
+            selectedStatus === "ACTIVE"
+              ? "bg-emerald-500/15 border-emerald-500 ring-1 ring-emerald-500"
+              : "bg-card hover:bg-muted/50"
+          }`}
+        >
+          <div className="flex items-center justify-between text-xs font-medium text-emerald-700 dark:text-emerald-400">
+            <span>Akun Aktif</span>
+            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
+          </div>
+          <div className="text-2xl font-bold mt-1 text-emerald-800 dark:text-emerald-300">{countActive}</div>
+          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Bisa login portal</div>
+        </div>
+
+        <div
+          onClick={() => setSelectedStatus("PENDING")}
+          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
+            selectedStatus === "PENDING"
+              ? "bg-amber-500/15 border-amber-500 ring-1 ring-amber-500"
+              : "bg-card hover:bg-muted/50"
+          }`}
+        >
+          <div className="flex items-center justify-between text-xs font-medium text-amber-700 dark:text-amber-400">
+            <span>Menunggu Approval</span>
+            <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
+          </div>
+          <div className="text-2xl font-bold mt-1 text-amber-800 dark:text-amber-300">{countPending}</div>
+          <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">Perlu konfirmasi guru</div>
+        </div>
+
+        <div
+          onClick={() => setSelectedStatus("UNREGISTERED")}
+          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
+            selectedStatus === "UNREGISTERED"
+              ? "bg-slate-500/15 border-slate-500 ring-1 ring-slate-500"
+              : "bg-card hover:bg-muted/50"
+          }`}
+        >
+          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
+            <span>Belum Registrasi</span>
+            <UserX className="h-4 w-4 text-slate-500" />
+          </div>
+          <div className="text-2xl font-bold mt-1 text-muted-foreground">{countUnregistered}</div>
+          <div className="text-[11px] text-muted-foreground mt-0.5">Belum buat PIN mandiri</div>
+        </div>
+      </div>
+
       {/* Story 5 — Panel L1: Menunggu Persetujuan (per-rombel pengampu) */}
       {pending.length > 0 && (
-        <Card className="border-amber-300/60 bg-amber-50/40">
+        <Card className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20">
           <CardHeader className="pb-2">
             <CardTitle className="flex items-center gap-2 text-base">
               <Hourglass className="h-4 w-4 text-amber-600" />
@@ -135,7 +222,7 @@ export function SiswaListClient({ classGroups, totalStudents, pendingStudents =
               <div
                 key={p.studentId}
                 className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 ${
-                  p.escalated ? "border-red-300 bg-red-50/60" : "bg-white"
+                  p.escalated ? "border-red-300 bg-red-50/60 dark:bg-red-950/30" : "bg-card"
                 }`}
               >
                 <div className="min-w-0">
@@ -144,7 +231,7 @@ export function SiswaListClient({ classGroups, totalStudents, pendingStudents =
                     {p.nis && <Badge variant="outline">NIS {p.nis}</Badge>}
                     <Badge variant="secondary">{p.className}</Badge>
                     {p.escalated && (
-                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
+                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
                         Eskalasi &gt;{ESCALATION_L1_HOURS} jam
                       </Badge>
                     )}
@@ -153,6 +240,7 @@ export function SiswaListClient({ classGroups, totalStudents, pendingStudents =
                 <div className="flex items-center gap-2 shrink-0">
                   <Button
                     size="sm"
+                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                     disabled={isPendingTransition}
                     onClick={() => handleApprove(p.studentId)}
                   >
@@ -235,7 +323,7 @@ export function SiswaListClient({ classGroups, totalStudents, pendingStudents =
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                 {cg.students.map((s) => (
                   <Link href={`/siswa/${s.id}`} key={s.id} className="group">
-                    <Card className="hover:border-primary transition-all duration-150 hover:shadow-xs cursor-pointer h-full">
+                    <Card className="hover:border-primary transition-all duration-150 hover:shadow-xs cursor-pointer h-full flex flex-col justify-between">
                       <CardHeader className="p-4 pb-2">
                         <div className="flex items-start justify-between gap-2">
                           <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors flex items-center gap-2">
@@ -245,13 +333,46 @@ export function SiswaListClient({ classGroups, totalStudents, pendingStudents =
                           <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                         </div>
                       </CardHeader>
-                      <CardContent className="p-4 pt-0">
+
+                      <CardContent className="p-4 pt-0 space-y-2">
                         <div className="flex items-center justify-between text-xs text-muted-foreground">
                           <span>NIS: {s.nis || "—"}</span>
                           <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-medium">
                             {cg.name}
                           </span>
                         </div>
+
+                        {/* Status Akun Badge */}
+                        <div className="pt-1 flex items-center justify-between border-t border-dashed text-xs">
+                          <span className="text-[11px] text-muted-foreground">Status Portal:</span>
+                          {s.accountStatus === "ACTIVE" && (
+                            <Badge
+                              variant="outline"
+                              className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[11px] font-medium gap-1 py-0 px-2"
+                            >
+                              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
+                              Akun Aktif
+                            </Badge>
+                          )}
+                          {s.accountStatus === "PENDING" && (
+                            <Badge
+                              variant="outline"
+                              className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 text-[11px] font-medium gap-1 py-0 px-2"
+                            >
+                              <Hourglass className="h-3 w-3 text-amber-600 dark:text-amber-400" />
+                              Menunggu Approval
+                            </Badge>
+                          )}
+                          {s.accountStatus === "UNREGISTERED" && (
+                            <Badge
+                              variant="outline"
+                              className="bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 text-[11px] font-normal gap-1 py-0 px-2"
+                            >
+                              <UserX className="h-3 w-3 text-slate-400" />
+                              Belum Registrasi
+                            </Badge>
+                          )}
+                        </div>
                       </CardContent>
                     </Card>
                   </Link>
@@ -259,7 +380,7 @@ export function SiswaListClient({ classGroups, totalStudents, pendingStudents =
               </div>
             ) : (
               <p className="text-xs text-muted-foreground italic py-2">
-                Tidak ada siswa di kelas ini yang cocok dengan pencarian.
+                Tidak ada siswa di kelas ini yang cocok dengan filter atau pencarian.
               </p>
             )}
           </section>
@@ -277,6 +398,8 @@ export function SiswaListClient({ classGroups, totalStudents, pendingStudents =
             <p className="text-sm text-muted-foreground max-w-sm mx-auto">
               {searchQuery
                 ? `Tidak ada siswa yang sesuai dengan kata kunci "${searchQuery}".`
+                : selectedStatus !== "ALL"
+                ? "Tidak ada siswa dengan filter status yang dipilih."
                 : "Belum ada data siswa di kelas yang Anda ampu."}
             </p>
           </div>
diff --git a/src/app/(dashboard)/siswa/[studentId]/page.tsx b/src/app/(dashboard)/siswa/[studentId]/page.tsx
index c88bdb2..6ceb832 100644
--- a/src/app/(dashboard)/siswa/[studentId]/page.tsx
+++ b/src/app/(dashboard)/siswa/[studentId]/page.tsx
@@ -117,13 +117,31 @@ export default async function SiswaDetailPage({
               <div className="text-sm font-medium text-muted-foreground">Nama Lengkap</div>
               <div className="text-lg font-semibold">{student.fullName}</div>
             </div>
-            <div>
-              <div className="text-sm font-medium text-muted-foreground">NIS</div>
-              <div className="text-lg">{student.nis || "-"}</div>
+            <div className="grid grid-cols-2 gap-2">
+              <div>
+                <div className="text-sm font-medium text-muted-foreground">NIS</div>
+                <div className="text-lg">{student.nis || "-"}</div>
+              </div>
+              <div>
+                <div className="text-sm font-medium text-muted-foreground">Status Rombel</div>
+                <div className="text-lg">{student.status === "ACTIVE" ? "Aktif" : "Diarsipkan"}</div>
+              </div>
             </div>
             <div>
-              <div className="text-sm font-medium text-muted-foreground">Status</div>
-              <div className="text-lg">{student.status === "ACTIVE" ? "Aktif" : "Diarsipkan"}</div>
+              <div className="text-sm font-medium text-muted-foreground mb-1">Status Akun Portal Siswa</div>
+              {student.accountStatus === "ACTIVE" ? (
+                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
+                  ✓ Akun Aktif (PIN Terdaftar)
+                </Badge>
+              ) : student.accountStatus === "PENDING" && student.accessPinHash ? (
+                <Badge className="bg-amber-100 text-amber-800 border-amber-200">
+                  ⏳ Menunggu Persetujuan Guru
+                </Badge>
+              ) : (
+                <Badge variant="outline" className="text-slate-500 bg-slate-50">
+                  Belum Registrasi Mandiri
+                </Badge>
+              )}
             </div>
           </CardContent>
         </Card>
diff --git a/src/app/(dashboard)/siswa/page.tsx b/src/app/(dashboard)/siswa/page.tsx
index 28dd27f..6282e07 100644
--- a/src/app/(dashboard)/siswa/page.tsx
+++ b/src/app/(dashboard)/siswa/page.tsx
@@ -48,10 +48,20 @@ export default async function SiswaPage() {
       .filter((cs) => cs.student.status === "ACTIVE")
       .map((cs) => {
         uniqueStudentIds.add(cs.student.id);
+        const hasPin = cs.student.accessPinHash !== null;
+        let accountStatus: "ACTIVE" | "PENDING" | "UNREGISTERED" = "UNREGISTERED";
+        if (cs.student.accountStatus === "ACTIVE") {
+          accountStatus = "ACTIVE";
+        } else if (cs.student.accountStatus === "PENDING" && hasPin) {
+          accountStatus = "PENDING";
+        }
+
         return {
           id: cs.student.id,
           fullName: cs.student.fullName,
           nis: cs.student.nis,
+          accountStatus,
+          hasPin,
         };
       });
 
diff --git a/src/app/admin/AdminConsoleClient.tsx b/src/app/admin/AdminConsoleClient.tsx
index 3077994..119bf76 100644
--- a/src/app/admin/AdminConsoleClient.tsx
+++ b/src/app/admin/AdminConsoleClient.tsx
@@ -729,10 +729,10 @@ export function AdminConsoleClient({
           </p>
         </div>
 
-        {/* Multi-Tenant School Filter */}
-        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl shadow-xs">
-          <Building className="h-4 w-4 text-teal-600 dark:text-teal-400 ml-2" />
-          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Filter Sekolah:</span>
+      {/* Multi-Tenant School Filter */}
+        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-2 rounded-2xl shadow-2xs">
+          <Building className="h-4 w-4 text-teal-700 dark:text-teal-400 ml-1.5" />
+          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Filter Sekolah:</span>
           <select
             value={selectedSchoolFilter}
             onChange={(e) => {
@@ -744,7 +744,7 @@ export function AdminConsoleClient({
                 reloadClasses(undefined, undefined, val);
               }, 50);
             }}
-            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-teal-500 transition-colors max-w-xs"
+            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl px-3 py-1.5 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 transition-colors max-w-xs cursor-pointer"
           >
             <option value="ALL">🌐 Semua Sekolah (Platform Global)</option>
             {allSchools.map((s) => (
@@ -757,7 +757,7 @@ export function AdminConsoleClient({
       </div>
 
       {/* Navigation Pills */}
-      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
+      <div className="flex flex-wrap gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
         {navTabs.map((tab) => {
           const Icon = tab.icon;
           const isActive = activeTab === tab.id;
@@ -765,20 +765,20 @@ export function AdminConsoleClient({
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id as any)}
-              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
+              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                 isActive
-                  ? "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-500/30 shadow-xs"
-                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent"
+                  ? "bg-[#0F766E] text-white shadow-md shadow-teal-900/15 border border-teal-700"
+                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-2xs"
               }`}
             >
-              <Icon className={`h-4 w-4 ${isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400 dark:text-slate-500"}`} />
+              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
               <span>{tab.label}</span>
               {tab.badge !== null && (
                 <span
-                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
+                  className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                     isActive
-                      ? "bg-teal-200 dark:bg-teal-400/20 text-teal-800 dark:text-teal-300"
-                      : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400"
+                      ? "bg-teal-800 text-teal-100 border border-teal-600/40"
+                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                   }`}
                 >
                   {tab.badge}
@@ -797,18 +797,18 @@ export function AdminConsoleClient({
           {/* 4 KPI Cards */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             {/* Total Sekolah */}
-            <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs">
+            <Card className="bg-white dark:bg-slate-900 rounded-3xl border-slate-200/80 dark:border-slate-800 hover:border-teal-200 dark:hover:border-teal-800 transition-all shadow-squircle-card hover:shadow-squircle-card-hover">
               <CardContent className="p-5">
                 <div className="flex items-center justify-between">
-                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Sekolah</span>
-                  <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400">
+                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Sekolah</span>
+                  <div className="p-2 rounded-2xl bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-900/40">
                     <Building2 className="h-5 w-5" />
                   </div>
                 </div>
                 <div className="mt-3">
-                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.schools.total}</div>
-                  <div className="flex items-center gap-2 mt-2 text-xs">
-                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
+                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stats.schools.total}</div>
+                  <div className="flex items-center gap-2 mt-2 text-xs font-semibold">
+                    <span className="text-teal-700 dark:text-teal-400">
                       ● {stats.schools.active} Aktif
                     </span>
                     {stats.schools.inactive > 0 && (
@@ -822,18 +822,18 @@ export function AdminConsoleClient({
             </Card>
 
             {/* Total Guru */}
-            <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs">
+            <Card className="bg-white dark:bg-slate-900 rounded-3xl border-slate-200/80 dark:border-slate-800 hover:border-teal-200 dark:hover:border-teal-800 transition-all shadow-squircle-card hover:shadow-squircle-card-hover">
               <CardContent className="p-5">
                 <div className="flex items-center justify-between">
-                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Guru & Staf</span>
-                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
+                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Guru & Staf</span>
+                  <div className="p-2 rounded-2xl bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-900/40">
                     <Users className="h-5 w-5" />
                   </div>
                 </div>
                 <div className="mt-3">
-                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.teachers.total}</div>
-                  <div className="flex items-center gap-2 mt-2 text-xs">
-                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
+                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stats.teachers.total}</div>
+                  <div className="flex items-center gap-2 mt-2 text-xs font-semibold">
+                    <span className="text-teal-700 dark:text-teal-400">
                       ● {stats.teachers.active} Aktif
                     </span>
                     {stats.teachers.banned > 0 && (
@@ -850,27 +850,27 @@ export function AdminConsoleClient({
             </Card>
 
             {/* Total Siswa */}
-            <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs">
+            <Card className="bg-white dark:bg-slate-900 rounded-3xl border-slate-200/80 dark:border-slate-800 hover:border-teal-200 dark:hover:border-teal-800 transition-all shadow-squircle-card hover:shadow-squircle-card-hover">
               <CardContent className="p-5">
                 <div className="flex items-center justify-between">
-                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Siswa</span>
-                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
+                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Siswa</span>
+                  <div className="p-2 rounded-2xl bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-900/40">
                     <GraduationCap className="h-5 w-5" />
                   </div>
                 </div>
                 <div className="mt-3">
-                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.students.total}</div>
-                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
-                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
+                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stats.students.total}</div>
+                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-semibold">
+                    <span className="text-teal-700 dark:text-teal-400">
                       ● {stats.students.active} Aktif
                     </span>
                     {stats.students.pending > 0 && (
-                      <span className="text-amber-500 dark:text-amber-400 font-medium">
+                      <span className="text-amber-600 dark:text-amber-400">
                         ● {stats.students.pending} Pending
                       </span>
                     )}
                     {stats.students.rejected > 0 && (
-                      <span className="text-red-500 dark:text-red-400 font-medium">
+                      <span className="text-red-500 dark:text-red-400">
                         ● {stats.students.rejected} Ditolak
                       </span>
                     )}
@@ -880,17 +880,17 @@ export function AdminConsoleClient({
             </Card>
 
             {/* Total Rombel */}
-            <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs">
+            <Card className="bg-white dark:bg-slate-900 rounded-3xl border-slate-200/80 dark:border-slate-800 hover:border-teal-200 dark:hover:border-teal-800 transition-all shadow-squircle-card hover:shadow-squircle-card-hover">
               <CardContent className="p-5">
                 <div className="flex items-center justify-between">
-                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Rombongan Belajar</span>
-                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
+                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Rombongan Belajar</span>
+                  <div className="p-2 rounded-2xl bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-900/40">
                     <Layers className="h-5 w-5" />
                   </div>
                 </div>
                 <div className="mt-3">
-                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.classes.total}</div>
-                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
+                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{stats.classes.total}</div>
+                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                     <span>{stats.classes.totalEnrollments} Siswa Terdaftar di Kelas</span>
                   </div>
                 </div>
@@ -900,20 +900,20 @@ export function AdminConsoleClient({
 
           {/* Quick AI & Activity Insights banner */}
           {aiStats && (
-            <Card className="bg-gradient-to-r from-teal-900/40 via-indigo-950/40 to-slate-900 border border-teal-500/30 dark:border-teal-500/20 shadow-md">
-              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
-                <div className="flex items-center gap-3">
-                  <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
-                    <Sparkles className="h-6 w-6 text-teal-300" />
+            <Card className="rounded-3xl bg-gradient-to-r from-[#0F766E] via-[#115E59] to-[#042F2E] text-white border border-teal-600/40 shadow-md">
+              <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
+                <div className="flex items-center gap-3.5">
+                  <div className="p-3 bg-white/10 text-teal-200 rounded-2xl border border-white/20 backdrop-blur-md">
+                    <Sparkles className="h-6 w-6 text-teal-200" />
                   </div>
                   <div>
-                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
+                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                       Pemantauan AI & Token Studio KLASSA
-                      <Badge variant="outline" className="bg-teal-500/10 text-teal-300 border-teal-500/30 text-[10px]">
+                      <Badge variant="outline" className="bg-teal-400/20 text-teal-200 border-teal-300/40 text-[10px] font-bold">
                         Live Monitored
                       </Badge>
                     </h3>
-                    <p className="text-xs text-slate-300 mt-0.5">
+                    <p className="text-xs text-teal-100/90 mt-0.5 font-medium leading-relaxed">
                       Telah diproses <strong>{aiStats.summary.totalEstimatedTokens.toLocaleString("id-ID")} token</strong> (~Rp {aiStats.summary.estimatedCostIdr.toLocaleString("id-ID")}) dari <strong>{aiStats.summary.totalDrafts} dokumen AI</strong> yang dibuat oleh <strong>{aiStats.summary.activeAiTeachers} guru aktif</strong>.
                     </p>
                   </div>
@@ -921,7 +921,7 @@ export function AdminConsoleClient({
                 <Button
                   size="sm"
                   onClick={() => setActiveTab("ai-usage")}
-                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-4 shrink-0"
+                  className="bg-white hover:bg-teal-50 text-teal-900 font-extrabold text-xs px-4 py-2.5 rounded-2xl shrink-0 shadow-sm transition-all"
                 >
                   Buka AI Studio Cockpit <ChevronRight className="h-3.5 w-3.5 ml-1" />
                 </Button>
diff --git a/src/app/admin/layout.tsx b/src/app/admin/layout.tsx
index 510d959..c69ddd4 100644
--- a/src/app/admin/layout.tsx
+++ b/src/app/admin/layout.tsx
@@ -3,6 +3,7 @@ import Link from "next/link";
 import { ShieldCheck, FileText, ArrowLeft } from "lucide-react";
 import { requireSuperAdmin } from "@/lib/superadmin";
 import { prisma } from "@/lib/auth";
+import { KlassaLogo } from "@/components/brand";
 import { ThemeToggle } from "@/components/ThemeToggle";
 
 export const dynamic = "force-dynamic";
@@ -10,7 +11,7 @@ export const dynamic = "force-dynamic";
 /**
  * Story 5 + Superadmin PC Desktop Redesign (CAP-ADM-01).
  * Layout full-width responsive desktop shell untuk area backstop superadmin `/admin/*`.
- * Mendukung Dark Mode & Light Mode dengan tombol ThemeToggle terintegrasi.
+ * Mendukung Dark Mode & Light Mode dengan standar tema Modern Edu-Teal KLASSA.
  */
 export default async function AdminLayout({ children }: { children: React.ReactNode }) {
   let userEmail = "Superadmin";
@@ -26,28 +27,23 @@ export default async function AdminLayout({ children }: { children: React.ReactN
   }
 
   return (
-    <div className="w-full min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white flex-1 overflow-x-hidden transition-colors duration-200">
+    <div className="w-full min-h-screen bg-[#F6F8F8] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white flex-1 overflow-x-hidden transition-colors duration-200">
       {/* Topbar Global Desktop */}
-      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md transition-colors">
+      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md transition-colors">
         <div className="w-full px-6 py-3 flex items-center justify-between">
           <div className="flex items-center gap-4">
-            <Link href="/admin" className="flex items-center gap-2.5 group">
-              <div className="h-8 w-8 rounded-lg bg-teal-500/10 dark:bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 group-hover:scale-105 transition-transform">
-                <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
-              </div>
-              <div>
-                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
-                  KLASSA <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-800/50 font-medium">SUPERADMIN</span>
-                </span>
-                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Platform Backstop & Multi-Tenant Cockpit</p>
-              </div>
+            <Link href="/admin" className="flex items-center gap-3 group">
+              <KlassaLogo variant="horizontal" size="xs" priority />
+              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/60 shadow-xs">
+                SUPERADMIN
+              </span>
             </Link>
           </div>
 
           <div className="flex items-center gap-3">
-            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full">
-              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
-              <span>Login sebagai: <strong className="text-slate-800 dark:text-slate-200">{userEmail}</strong></span>
+            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-3 py-1.5 rounded-full font-medium">
+              <span className="h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
+              <span>Login: <strong className="text-slate-900 dark:text-slate-200 font-semibold">{userEmail}</strong></span>
             </div>
 
             {/* Theme Toggle Button (Light / Dark Mode) */}
@@ -55,7 +51,7 @@ export default async function AdminLayout({ children }: { children: React.ReactN
 
             <Link
               href="/admin/audit"
-              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors flex items-center gap-1.5"
+              className="px-3 py-1.5 rounded-xl text-xs font-bold text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60 bg-teal-50/50 dark:bg-slate-900 border border-teal-200/60 dark:border-slate-800 transition-colors flex items-center gap-1.5"
             >
               <FileText className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
               AuditLog
@@ -63,7 +59,7 @@ export default async function AdminLayout({ children }: { children: React.ReactN
 
             <Link
               href="/"
-              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors flex items-center gap-1.5"
+              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-slate-900/50 hover:bg-slate-200 dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800 transition-colors flex items-center gap-1.5"
             >
               <ArrowLeft className="h-3.5 w-3.5" />
               Kembali ke Aplikasi
diff --git a/src/app/portal-siswa/page.tsx b/src/app/portal-siswa/page.tsx
index 196a02b..8ec30a9 100644
--- a/src/app/portal-siswa/page.tsx
+++ b/src/app/portal-siswa/page.tsx
@@ -1,13 +1,12 @@
 "use client";
 
-import React, { useState, useEffect } from "react";
+import React, { useState, useEffect, useMemo } from "react";
 import { useRouter } from "next/navigation";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 import { toast } from "sonner";
 import { 
-  GraduationCap, 
   School, 
   KeyRound, 
   User, 
@@ -21,15 +20,18 @@ import {
   Eye, 
   EyeOff, 
   Sparkles,
-  BookOpen
+  Calendar,
+  AlertCircle
 } from "lucide-react";
 import { 
   loginStudent, 
   lookupJoinCode, 
   registerStudent, 
-  type JoinCodeContext 
+  type JoinCodeContext
 } from "@/modules/student-auth/student-auth.actions";
 import { searchSchools } from "@/modules/schools/schools.actions";
+import { KlassaLogo, ModularCockpitArtwork } from "@/components/brand";
+import Link from "next/link";
 
 type SchoolOption = {
   id: string;
@@ -45,11 +47,13 @@ type PendingNotice = {
   message: string;
 };
 
+type RosterStudent = JoinCodeContext["roster"][0];
+
 export default function PortalSiswaAuthPage() {
   const router = useRouter();
 
-  // Active tab: "login" | "join"
-  const [activeTab, setActiveTab] = useState<"login" | "join">("login");
+  // Mode: "login" | "join"
+  const [mode, setMode] = useState<"login" | "join">("login");
 
   // Notice state for PENDING or REJECTED students
   const [notice, setNotice] = useState<PendingNotice | null>(null);
@@ -64,6 +68,7 @@ export default function PortalSiswaAuthPage() {
   const [loginNis, setLoginNis] = useState("");
   const [loginPin, setLoginPin] = useState("");
   const [showLoginPin, setShowLoginPin] = useState(false);
+  const [rememberMe, setRememberMe] = useState(true);
   const [loginError, setLoginError] = useState("");
   const [loginLoading, setLoginLoading] = useState(false);
 
@@ -73,8 +78,13 @@ export default function PortalSiswaAuthPage() {
   const [joinChecking, setJoinChecking] = useState(false);
   const [joinError, setJoinError] = useState("");
 
+  // Progressive Registration Form State
   const [regFullName, setRegFullName] = useState("");
+  const [selectedRosterStudent, setSelectedRosterStudent] = useState<RosterStudent | null>(null);
+  const [showNameDropdown, setShowNameDropdown] = useState(false);
+
   const [regNis, setRegNis] = useState("");
+  const [regBirthDate, setRegBirthDate] = useState("");
   const [regPin, setRegPin] = useState("");
   const [regPinConfirm, setRegPinConfirm] = useState("");
   const [showRegPin, setShowRegPin] = useState(false);
@@ -134,6 +144,36 @@ export default function PortalSiswaAuthPage() {
     }
   };
 
+  // --- LIVE NAME MATCHING IN ROSTER ---
+  const matchingRoster = useMemo(() => {
+    if (!joinContext?.roster || !regFullName.trim()) return [];
+    const q = regFullName.trim().toLowerCase();
+    return joinContext.roster.filter((s) => s.fullName.toLowerCase().includes(q));
+  }, [joinContext?.roster, regFullName]);
+
+  const isNameUnregistered = useMemo(() => {
+    if (!joinContext?.roster || !regFullName.trim()) return false;
+    if (selectedRosterStudent && selectedRosterStudent.fullName === regFullName) return false;
+    return matchingRoster.length === 0;
+  }, [joinContext?.roster, regFullName, selectedRosterStudent, matchingRoster.length]);
+
+  // --- NIS VALIDATION LOGIC ---
+  const expectedNis = selectedRosterStudent?.nis || "";
+  const expectedNisLength = expectedNis.length > 0 ? expectedNis.length : 4;
+
+  const nisValidationStatus = useMemo<"IDLE" | "MATCHED" | "MISMATCHED">(() => {
+    if (!selectedRosterStudent || !regNis) return "IDLE";
+    if (regNis.length < expectedNisLength) {
+      return "IDLE"; // Belum mencapai jumlah angka maksimal -> tidak ada keterangan
+    }
+    if (regNis.toUpperCase() === expectedNis.toUpperCase()) {
+      return "MATCHED";
+    }
+    return "MISMATCHED";
+  }, [selectedRosterStudent, regNis, expectedNisLength, expectedNis]);
+
+  const isNisMatched = nisValidationStatus === "MATCHED";
+
   // --- SUBMIT LOGIN ---
   const handleLoginSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
@@ -196,6 +236,12 @@ export default function PortalSiswaAuthPage() {
     e.preventDefault();
     setJoinError("");
     setJoinContext(null);
+    setSelectedRosterStudent(null);
+    setRegFullName("");
+    setRegNis("");
+    setRegBirthDate("");
+    setRegPin("");
+    setRegPinConfirm("");
 
     const clean = joinCode.trim().toUpperCase();
     if (clean.length < 6) {
@@ -225,12 +271,16 @@ export default function PortalSiswaAuthPage() {
     setJoinError("");
 
     if (!joinContext) return;
-    if (!regFullName.trim()) {
-      setJoinError("Nama lengkap wajib diisi.");
+    if (!selectedRosterStudent || !regFullName.trim()) {
+      setJoinError("Silakan pilih nama siswa dari daftar rombel.");
+      return;
+    }
+    if (!isNisMatched) {
+      setJoinError("NIS belum sesuai dengan data rombel.");
       return;
     }
-    if (!regNis.trim()) {
-      setJoinError("Nomor Induk Siswa (NIS) wajib diisi.");
+    if (!regBirthDate) {
+      setJoinError("Tanggal lahir wajib diisi sebagai bahan pertimbangan persetujuan guru.");
       return;
     }
     if (!/^\d{4}$/.test(regPin.trim())) {
@@ -248,6 +298,7 @@ export default function PortalSiswaAuthPage() {
         joinCode: joinCode.trim().toUpperCase(),
         fullName: regFullName.trim(),
         nis: regNis.trim(),
+        birthDate: regBirthDate,
         pin: regPin.trim(),
       });
 
@@ -276,440 +327,624 @@ export default function PortalSiswaAuthPage() {
   };
 
   return (
-    <div className="min-h-screen bg-[#EBF1F6] bg-ambient-pattern flex flex-col justify-center items-center p-3 sm:p-4 md:p-6 selection:bg-teal-500 selection:text-white">
-      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-5 sm:p-7 space-y-5">
+    <div className="min-h-screen w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row relative overflow-x-hidden font-sans selection:bg-teal-500 selection:text-white">
+      
+      {/* ─────────────────────────────────────────────────────────────
+          SISI KIRI: FORM & BRANDING (MENYATU PUTIH & DEKAT DENGAN GELOMBANG)
+      ───────────────────────────────────────────────────────────── */}
+      <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 flex flex-col justify-between z-10 bg-white dark:bg-slate-950 min-h-screen">
         
-        {/* Top Header Badge & Branding */}
-        <div className="text-center space-y-1.5">
-          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-[#0F766E] text-[10px] font-extrabold tracking-wider uppercase border border-teal-200/70">
-            <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
-            <span>PORTAL SISWA KLASSA</span>
-          </div>
-
-          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
-            Ruang Belajar Siswa
-          </h1>
-          <p className="text-[12px] text-slate-500 max-w-xs mx-auto leading-relaxed">
-            Akses jadwal pelajaran harian, kuis & tugas, serta pantau capaian belajarmu secara mandiri.
-          </p>
+        {/* Top Brand Logo */}
+        <div className="w-full max-w-[420px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 pt-1">
+          <Link 
+            href="/" 
+            className="inline-flex items-center hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] transition-all"
+            aria-label="Beranda KLASSA"
+          >
+            <KlassaLogo variant="horizontal" size="xs" priority />
+          </Link>
         </div>
 
-        {/* Notice Card for PENDING or REJECTED students */}
-        {notice ? (
-          <div className="space-y-4 pt-2">
-            <div className={`p-4 rounded-2xl border ${
-              notice.type === "PENDING" 
-                ? "bg-amber-50/90 border-amber-200 text-amber-900" 
-                : "bg-rose-50/90 border-rose-200 text-rose-900"
-            }`}>
-              <div className="flex items-start gap-3">
-                {notice.type === "PENDING" ? (
-                  <Clock className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
-                ) : (
-                  <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
-                )}
-                <div className="space-y-1">
-                  <h3 className="font-bold text-sm">
-                    {notice.type === "PENDING" ? "Menunggu Persetujuan Guru" : "Pendaftaran Belum Disetujui"}
-                  </h3>
-                  <p className="text-xs text-slate-700 leading-relaxed">
-                    Halo <span className="font-semibold text-slate-900">{notice.studentName}</span>, {notice.message}
-                  </p>
-                  <div className="text-[11px] text-slate-500 pt-1">
-                    Sekolah: <span className="font-medium text-slate-700">{notice.schoolName}</span>
+        {/* Form Content Area */}
+        <div className="my-auto py-6 w-full max-w-[420px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 space-y-4">
+          
+          {/* Header Text & Branding */}
+          <div className="space-y-1.5">
+            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-[#0F766E] text-[11px] font-extrabold tracking-wider uppercase border border-teal-200/60">
+              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
+              <span>{mode === "join" ? "PENDAFTARAN & GABUNG ROMBEL" : "PORTAL BELAJAR SISWA"}</span>
+            </div>
+
+            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
+              {mode === "join" ? (
+                <>
+                  Gabung Rombel Baru, <br />
+                  <span className="shimmer-text">Mulai Belajar Bersama Guru.</span>
+                </>
+              ) : (
+                <>
+                  Ruang Belajar Siswa, <br />
+                  <span className="shimmer-text">Akses Tugas & Capaian Belajar.</span>
+                </>
+              )}
+            </h1>
+
+            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
+              {mode === "join"
+                ? "Daftarkan identitas dan buat PIN untuk bergabung ke rombel kelas."
+                : "Pantau materi, kumpulkan tugas mandiri, dan pantau progres belajarmu di KLASSA."}
+            </p>
+          </div>
+
+          {/* Notice Card for PENDING or REJECTED students */}
+          {notice ? (
+            <div className="space-y-3 pt-1">
+              <div className={`p-4 rounded-2xl border ${
+                notice.type === "PENDING" 
+                  ? "bg-amber-50/90 border-amber-200 text-amber-900" 
+                  : "bg-rose-50/90 border-rose-200 text-rose-900"
+              }`}>
+                <div className="flex items-start gap-3">
+                  {notice.type === "PENDING" ? (
+                    <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
+                  ) : (
+                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
+                  )}
+                  <div className="space-y-1">
+                    <h3 className="font-bold text-xs">
+                      {notice.type === "PENDING" ? "Menunggu Persetujuan Guru" : "Pendaftaran Belum Disetujui"}
+                    </h3>
+                    <p className="text-xs text-slate-700 leading-relaxed">
+                      Halo <span className="font-semibold text-slate-900">{notice.studentName}</span>, {notice.message}
+                    </p>
+                    <div className="text-[11px] text-slate-500 pt-0.5">
+                      Sekolah: <span className="font-medium text-slate-700">{notice.schoolName}</span>
+                    </div>
                   </div>
                 </div>
               </div>
-            </div>
 
-            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
-              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
-                <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Tips Tindak Lanjut:
-              </span>
-              <p>
-                {notice.type === "PENDING"
-                  ? "Beri tahu guru pengampu rombel di kelas untuk menyetujui akunmu melalui panel guru."
-                  : "Periksa kembali kode rombel yang diberikan oleh gurumu atau hubungi guru di sekolah."}
-              </p>
-            </div>
+              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
+                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
+                  <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Tips Tindak Lanjut:
+                </span>
+                <p className="text-[11px] text-slate-500">
+                  {notice.type === "PENDING"
+                    ? "Beri tahu gurumu di kelas untuk memeriksa tanggal lahir dan menyetujui akun melalui panel persetujuan guru."
+                    : "Periksa kembali kode rombel dari gurumu atau hubungi guru di sekolah."}
+                </p>
+              </div>
 
-            <Button
-              type="button"
-              variant="outline"
-              onClick={() => {
-                setNotice(null);
-                setJoinContext(null);
-                setLoginNis("");
-                setLoginPin("");
-              }}
-              className="w-full h-11 rounded-xl font-bold text-xs text-slate-700"
-            >
-              Kembali ke Halaman Masuk
-            </Button>
-          </div>
-        ) : (
-          <>
-            {/* Tab Switcher */}
-            <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 text-xs font-bold text-slate-600">
-              <button
+              <Button
                 type="button"
+                variant="outline"
                 onClick={() => {
-                  setActiveTab("login");
-                  setJoinError("");
+                  setNotice(null);
+                  setJoinContext(null);
+                  setMode("login");
+                  setLoginNis("");
+                  setLoginPin("");
                 }}
-                className={`py-2 rounded-xl transition-all ${
-                  activeTab === "login"
-                    ? "bg-white text-teal-800 shadow-sm font-extrabold"
-                    : "hover:text-slate-900"
-                }`}
+                className="w-full h-12 rounded-2xl font-bold text-xs text-slate-700 hover:bg-slate-50"
               >
-                Masuk (NIS & PIN)
-              </button>
-              <button
-                type="button"
-                onClick={() => {
-                  setActiveTab("join");
-                  setLoginError("");
-                }}
-                className={`py-2 rounded-xl transition-all ${
-                  activeTab === "join"
-                    ? "bg-white text-teal-800 shadow-sm font-extrabold"
-                    : "hover:text-slate-900"
-                }`}
-              >
-                Gabung Rombel
-              </button>
+                Kembali ke Halaman Masuk
+              </Button>
             </div>
+          ) : mode === "login" ? (
+            /* ─────────────────────────────────────────────────────────────
+               DEFAULT: FORM LOGIN SISWA (IDENTIK FONT & ACTION ROW GURU)
+            ───────────────────────────────────────────────────────────── */
+            <form onSubmit={handleLoginSubmit} className="space-y-3">
+              {loginError && (
+                <Alert variant="destructive" className="rounded-2xl py-2 px-3 border-red-300 bg-red-50 text-red-900">
+                  <AlertDescription className="text-xs flex items-center gap-1.5">
+                    <ShieldAlert className="w-4 h-4 shrink-0" />
+                    <span>{loginError}</span>
+                  </AlertDescription>
+                </Alert>
+              )}
+
+              {/* Sekolah Selector */}
+              <div className="space-y-1 relative">
+                <div className="relative">
+                  <School className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
+                  <Input
+                    type="text"
+                    placeholder="Ketik minimal 3 huruf nama sekolah..."
+                    value={schoolQuery}
+                    onChange={(e) => {
+                      setSchoolQuery(e.target.value);
+                      if (selectedSchool && selectedSchool.name !== e.target.value) {
+                        setSelectedSchool(null);
+                      }
+                    }}
+                    onFocus={() => {
+                      if (schoolResults.length > 0) setShowSchoolDropdown(true);
+                    }}
+                    className="w-full h-11 pl-11 pr-8 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
+                  />
+                  {isSearchingSchool && (
+                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
+                      <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
+                    </div>
+                  )}
+                </div>
 
-            {/* TAB 1: LOGIN */}
-            {activeTab === "login" && (
-              <form onSubmit={handleLoginSubmit} className="space-y-3.5 pt-1">
-                {loginError && (
-                  <Alert variant="destructive" className="rounded-xl py-2 px-3">
-                    <AlertDescription className="text-xs flex items-center gap-1.5">
-                      <ShieldAlert className="w-4 h-4 shrink-0" />
-                      <span>{loginError}</span>
-                    </AlertDescription>
-                  </Alert>
+                {/* Dropdown Hasil Pencarian Sekolah */}
+                {showSchoolDropdown && schoolResults.length > 0 && (
+                  <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-lg border border-slate-200 max-h-44 overflow-y-auto divide-y divide-slate-100">
+                    {schoolResults.map((s) => (
+                      <button
+                        key={s.id}
+                        type="button"
+                        onClick={() => handleSelectSchool(s)}
+                        className="w-full px-4 py-2.5 text-left hover:bg-teal-50 transition-colors flex flex-col"
+                      >
+                        <span className="font-bold text-xs text-slate-800">{s.name}</span>
+                        <span className="text-[10px] text-slate-500">{s.city || "Kota belum diset"} {s.npsn ? `• NPSN: ${s.npsn}` : ""}</span>
+                      </button>
+                    ))}
+                  </div>
                 )}
 
-                {/* Sekolah Selector */}
-                <div className="space-y-1 relative">
-                  <label className="text-[11px] font-bold text-slate-700 block">
-                    Sekolah Asal <span className="text-rose-500">*</span>
-                  </label>
-                  <div className="relative">
-                    <School className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
-                    <Input
-                      type="text"
-                      placeholder="Ketik minimal 3 huruf nama sekolah..."
-                      value={schoolQuery}
-                      onChange={(e) => {
-                        setSchoolQuery(e.target.value);
-                        if (selectedSchool && selectedSchool.name !== e.target.value) {
-                          setSelectedSchool(null);
-                        }
-                      }}
-                      onFocus={() => {
-                        if (schoolResults.length > 0) setShowSchoolDropdown(true);
-                      }}
-                      className="pl-9 pr-8 h-11 text-xs rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
-                    />
-                    {isSearchingSchool && (
-                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
-                        <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
-                      </div>
-                    )}
+                {selectedSchool && (
+                  <div className="flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50/80 px-3 py-1.5 rounded-xl border border-teal-200/50 font-medium">
+                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
+                    <span className="truncate">Sekolah: <b>{selectedSchool.name}</b></span>
                   </div>
+                )}
+              </div>
 
-                  {/* Dropdown Hasil Pencarian Sekolah */}
-                  {showSchoolDropdown && schoolResults.length > 0 && (
-                    <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
-                      {schoolResults.map((s) => (
-                        <button
-                          key={s.id}
-                          type="button"
-                          onClick={() => handleSelectSchool(s)}
-                          className="w-full px-3 py-2 text-left hover:bg-teal-50 transition-colors flex flex-col"
-                        >
-                          <span className="font-bold text-xs text-slate-800">{s.name}</span>
-                          <span className="text-[10px] text-slate-500">{s.city || "Kota belum diset"} {s.npsn ? `• NPSN: ${s.npsn}` : ""}</span>
-                        </button>
-                      ))}
-                    </div>
-                  )}
-
-                  {selectedSchool && (
-                    <div className="flex items-center gap-1.5 text-[10px] text-teal-700 bg-teal-50/80 px-2 py-1 rounded-lg border border-teal-200/50">
-                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
-                      <span className="truncate">Terpilih: <b>{selectedSchool.name}</b></span>
-                    </div>
-                  )}
+              {/* Input NIS */}
+              <div className="space-y-1">
+                <div className="relative">
+                  <Hash className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
+                  <Input
+                    type="text"
+                    placeholder="Nomor Induk Siswa (NIS)"
+                    value={loginNis}
+                    onChange={(e) => setLoginNis(e.target.value.toUpperCase())}
+                    className="w-full h-11 pl-11 pr-4 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-mono font-bold tracking-wider text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none uppercase"
+                  />
                 </div>
+              </div>
 
-                {/* Input NIS */}
-                <div className="space-y-1">
-                  <label className="text-[11px] font-bold text-slate-700 block">
-                    Nomor Induk Siswa (NIS) <span className="text-rose-500">*</span>
-                  </label>
-                  <div className="relative">
-                    <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
-                    <Input
-                      type="text"
-                      placeholder="Contoh: 20260101"
-                      value={loginNis}
-                      onChange={(e) => setLoginNis(e.target.value.toUpperCase())}
-                      className="pl-9 h-11 text-xs font-mono font-bold tracking-wider rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white uppercase"
-                    />
-                  </div>
+              {/* Input PIN 4-Digit */}
+              <div className="space-y-1">
+                <div className="relative">
+                  <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
+                  <Input
+                    type={showLoginPin ? "text" : "password"}
+                    maxLength={4}
+                    placeholder="PIN Keamanan (4 Digit)"
+                    value={loginPin}
+                    onChange={(e) => {
+                      const val = e.target.value.replace(/\D/g, "").slice(0, 4);
+                      setLoginPin(val);
+                    }}
+                    className="w-full h-11 pl-11 pr-11 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-mono font-black tracking-widest text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
+                  />
+                  <button
+                    type="button"
+                    onClick={() => setShowLoginPin(!showLoginPin)}
+                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
+                    aria-label={showLoginPin ? "Sembunyikan PIN" : "Lihat PIN"}
+                  >
+                    {showLoginPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
+                  </button>
                 </div>
+              </div>
 
-                {/* Input PIN 4-Digit */}
-                <div className="space-y-1">
-                  <div className="flex justify-between items-center">
-                    <label className="text-[11px] font-bold text-slate-700">
-                      PIN Keamanan (4 Digit) <span className="text-rose-500">*</span>
-                    </label>
-                    <span className="text-[10px] text-slate-400">Lupa PIN? Hubungi Guru</span>
-                  </div>
-                  <div className="relative">
-                    <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
-                    <Input
-                      type={showLoginPin ? "text" : "password"}
-                      maxLength={4}
-                      placeholder="••••"
-                      value={loginPin}
-                      onChange={(e) => {
-                        const val = e.target.value.replace(/\D/g, "").slice(0, 4);
-                        setLoginPin(val);
-                      }}
-                      className="pl-9 pr-9 h-11 text-sm font-mono tracking-widest font-black rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
-                    />
-                    <button
-                      type="button"
-                      onClick={() => setShowLoginPin(!showLoginPin)}
-                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
-                    >
-                      {showLoginPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
-                    </button>
-                  </div>
-                </div>
+              {/* Remember Me & Help */}
+              <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-0.5">
+                <label className="flex items-center gap-1.5 cursor-pointer select-none">
+                  <input
+                    type="checkbox"
+                    checked={rememberMe}
+                    onChange={(e) => setRememberMe(e.target.checked)}
+                    className="w-3.5 h-3.5 rounded border-slate-300 text-teal-700 focus:ring-teal-500 accent-teal-700 cursor-pointer"
+                  />
+                  <span>Ingat sesi saya</span>
+                </label>
+                <span className="text-teal-700 font-medium">
+                  Lupa PIN? Hubungi Guru
+                </span>
+              </div>
 
-                {/* Submit Button */}
+              {/* ACTION ROW (MASUK + GABUNG ROMBEL) */}
+              <div className="flex items-center gap-3 pt-2">
                 <Button
                   type="submit"
                   disabled={loginLoading}
-                  className="w-full h-11 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs tracking-wide shadow-md shadow-teal-900/10 transition-all active:scale-[0.99] mt-2"
+                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] hover:from-[#0D635C] hover:to-[#0F9E8E] text-white text-xs font-extrabold shadow-lg shadow-teal-700/25 hover:shadow-teal-700/35 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                 >
                   {loginLoading ? (
-                    <div className="flex items-center gap-2">
-                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
-                      <span>Memverifikasi Identitas...</span>
-                    </div>
+                    <span>Memverifikasi...</span>
                   ) : (
-                    <div className="flex items-center justify-center gap-1.5">
+                    <>
                       <span>Masuk ke Portal Siswa</span>
                       <ArrowRight className="w-4 h-4" />
-                    </div>
+                    </>
                   )}
                 </Button>
-              </form>
-            )}
-
-            {/* TAB 2: GABUNG ROMBEL VIA KODE */}
-            {activeTab === "join" && (
-              <div className="space-y-4 pt-1">
-                {joinError && (
-                  <Alert variant="destructive" className="rounded-xl py-2 px-3">
-                    <AlertDescription className="text-xs flex items-center gap-1.5">
-                      <ShieldAlert className="w-4 h-4 shrink-0" />
-                      <span>{joinError}</span>
-                    </AlertDescription>
-                  </Alert>
-                )}
-
-                {/* Step 1: Input & Lookup Kode Rombel */}
-                {!joinContext ? (
-                  <form onSubmit={handleCheckJoinCode} className="space-y-3">
-                    <div className="space-y-1">
-                      <label className="text-[11px] font-bold text-slate-700 block">
-                        Masukkan Kode Rombel dari Guru <span className="text-rose-500">*</span>
-                      </label>
-                      <div className="relative">
-                        <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
-                        <Input
-                          type="text"
-                          maxLength={8}
-                          placeholder="CONTOH: 7K2M9P"
-                          value={joinCode}
-                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
-                          className="pl-9 h-11 text-sm font-mono font-black tracking-widest rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white uppercase text-center"
-                        />
-                      </div>
-                      <p className="text-[10px] text-slate-400 leading-tight">
-                        Kode rombel terdiri dari 6 karakter alfanumerik yang dibagikan oleh gurumu di kelas.
-                      </p>
+                <Button
+                  type="button"
+                  variant="outline"
+                  onClick={() => {
+                    setMode("join");
+                    setLoginError("");
+                  }}
+                  className="px-5 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 border-none text-slate-700 text-xs font-bold transition-all flex items-center justify-center"
+                >
+                  Gabung Rombel
+                </Button>
+              </div>
+            </form>
+          ) : (
+            /* ─────────────────────────────────────────────────────────────
+               MODE: GABUNG ROMBEL (PROGRESSIVE ROSTER & NIS VALIDATION)
+            ───────────────────────────────────────────────────────────── */
+            <div className="space-y-3.5 pt-0.5">
+              {joinError && (
+                <Alert variant="destructive" className="rounded-2xl py-2 px-3 border-red-300 bg-red-50 text-red-900">
+                  <AlertDescription className="text-xs flex items-center gap-1.5">
+                    <ShieldAlert className="w-4 h-4 shrink-0" />
+                    <span>{joinError}</span>
+                  </AlertDescription>
+                </Alert>
+              )}
+
+              {!joinContext ? (
+                /* STEP 1: INPUT KODE ROMBEL */
+                <form onSubmit={handleCheckJoinCode} className="space-y-3">
+                  <div className="space-y-1.5">
+                    <label className="text-xs font-bold text-slate-700 block">
+                      Masukkan Kode Rombel dari Guru <span className="text-rose-500">*</span>
+                    </label>
+                    <div className="relative">
+                      <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
+                      <Input
+                        type="text"
+                        maxLength={8}
+                        placeholder="CONTOH: 7K2M9P"
+                        value={joinCode}
+                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
+                        autoFocus
+                        className="w-full h-11 pl-11 pr-4 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-sm font-mono font-black tracking-widest text-slate-900 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none uppercase text-center"
+                      />
                     </div>
+                    <p className="text-[11px] text-slate-400 leading-tight">
+                      Kode rombel terdiri dari 6 karakter alfanumerik yang dibagikan gurumu di kelas.
+                    </p>
+                  </div>
 
+                  <div className="flex items-center gap-3 pt-2">
                     <Button
                       type="submit"
                       disabled={joinChecking || joinCode.trim().length < 6}
-                      className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs tracking-wide shadow-md transition-all active:scale-[0.99]"
+                      className="flex-1 h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                     >
                       {joinChecking ? (
-                        <div className="flex items-center gap-2">
-                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
-                          <span>Memeriksa Kode Rombel...</span>
-                        </div>
+                        <span>Memeriksa Kode...</span>
                       ) : (
-                        <div className="flex items-center justify-center gap-1.5">
+                        <>
                           <span>Periksa Kode Rombel</span>
                           <Search className="w-4 h-4" />
-                        </div>
+                        </>
                       )}
                     </Button>
-                  </form>
-                ) : (
-                  /* Step 2: Konfirmasi Rombel & Formulir Pendaftaran Siswa */
-                  <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
-                    {/* Kartu Konfirmasi Rombel */}
-                    <div className="p-3 bg-teal-50/80 rounded-2xl border border-teal-200/70 space-y-1.5">
-                      <div className="flex justify-between items-start">
-                        <div>
-                          <span className="text-[10px] font-black uppercase text-teal-800 tracking-wider">
-                            Rombel Ditemukan
-                          </span>
-                          <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
-                            {joinContext.className} ({joinContext.gradeLevel || "Kelas"})
-                          </h4>
-                        </div>
-                        <button
-                          type="button"
-                          onClick={() => setJoinContext(null)}
-                          className="text-[10px] font-bold text-teal-700 hover:underline"
-                        >
-                          Ganti Kode
-                        </button>
+                    <Button
+                      type="button"
+                      variant="outline"
+                      onClick={() => {
+                        setMode("login");
+                        setJoinError("");
+                      }}
+                      className="px-5 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 border-none text-slate-700 text-xs font-bold transition-all"
+                    >
+                      Batal
+                    </Button>
+                  </div>
+                </form>
+              ) : (
+                /* STEP 2: PENDAFTARAN DENGAN LIVE AUTOCOMPLETE NAMA, NIS MATCHING & TANGGAL LAHIR */
+                <form onSubmit={handleRegisterSubmit} className="space-y-3">
+                  {/* Kartu Rombel Terkonfirmasi */}
+                  <div className="p-3 bg-teal-50/90 rounded-2xl border border-teal-200/70 space-y-1.5">
+                    <div className="flex justify-between items-start">
+                      <div>
+                        <span className="text-[10px] font-black uppercase text-teal-800 tracking-wider">
+                          Rombel Terverifikasi
+                        </span>
+                        <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
+                          {joinContext.className} ({joinContext.gradeLevel || "Kelas"})
+                        </h4>
                       </div>
-                      <div className="text-[11px] text-slate-600 space-y-0.5 pt-0.5">
-                        <div className="flex items-center gap-1">
-                          <School className="w-3.5 h-3.5 text-teal-600 shrink-0" />
-                          <span className="truncate">{joinContext.schoolName}</span>
-                        </div>
-                        <div className="flex items-center gap-1">
-                          <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
-                          <span className="truncate">Guru: {joinContext.teacherName}</span>
-                        </div>
+                      <button
+                        type="button"
+                        onClick={() => {
+                          setJoinContext(null);
+                          setSelectedRosterStudent(null);
+                          setRegFullName("");
+                          setRegNis("");
+                          setRegBirthDate("");
+                        }}
+                        className="text-[11px] font-bold text-teal-700 hover:underline"
+                      >
+                        Ganti Kode
+                      </button>
+                    </div>
+                    <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
+                      <div className="flex items-center gap-1.5 truncate">
+                        <School className="w-3.5 h-3.5 text-teal-600 shrink-0" />
+                        <span className="truncate">{joinContext.schoolName}</span>
+                      </div>
+                      <div className="flex items-center gap-1.5 truncate">
+                        <User className="w-3.5 h-3.5 text-teal-600 shrink-0" />
+                        <span className="truncate">Guru: {joinContext.teacherName}</span>
                       </div>
                     </div>
+                  </div>
 
-                    {/* Nama Lengkap */}
-                    <div className="space-y-1">
-                      <label className="text-[11px] font-bold text-slate-700 block">
-                        Nama Lengkap Siswa <span className="text-rose-500">*</span>
-                      </label>
+                  {/* INPUT 1: NAMA LENGKAP DENGAN LIVE SEARCH & AUTOCOMPLETE */}
+                  <div className="space-y-1 relative">
+                    <label className="text-xs font-bold text-slate-700 block">
+                      1. Nama Lengkap Siswa <span className="text-rose-500">*</span>
+                    </label>
+                    <div className="relative">
+                      <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                       <Input
                         type="text"
                         placeholder="Ketik nama sesuai daftar hadir..."
                         value={regFullName}
-                        onChange={(e) => setRegFullName(e.target.value)}
-                        className="h-10 text-xs rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
+                        onChange={(e) => {
+                          const val = e.target.value;
+                          setRegFullName(val);
+                          setShowNameDropdown(true);
+                          if (selectedRosterStudent && selectedRosterStudent.fullName !== val) {
+                            setSelectedRosterStudent(null);
+                            setRegNis("");
+                          }
+                        }}
+                        onFocus={() => {
+                          if (matchingRoster.length > 0 && !selectedRosterStudent) {
+                            setShowNameDropdown(true);
+                          }
+                        }}
+                        className="w-full h-11 pl-11 pr-4 bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs font-semibold text-slate-800 rounded-2xl border border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all outline-none"
                       />
                     </div>
 
-                    {/* NIS */}
-                    <div className="space-y-1">
-                      <label className="text-[11px] font-bold text-slate-700 block">
-                        Nomor Induk Siswa (NIS) <span className="text-rose-500">*</span>
-                      </label>
+                    {/* Keterangan Jika Huruf Diketik Tidak Cocok Rombel */}
+                    {isNameUnregistered && (
+                      <div className="flex items-center gap-1 text-xs text-rose-600 font-bold px-1 pt-0.5 animate-in fade-in duration-200">
+                        <XCircle className="w-3.5 h-3.5 shrink-0" />
+                        <span>Siswa tidak terdaftar</span>
+                      </div>
+                    )}
+
+                    {/* Dropdown Nama Siswa yang Cocok */}
+                    {showNameDropdown && matchingRoster.length > 0 && !selectedRosterStudent && (
+                      <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-48 overflow-y-auto divide-y divide-slate-100">
+                        <div className="p-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 rounded-t-2xl">
+                          Pilih Nama Anda Dari Rombel:
+                        </div>
+                        {matchingRoster.map((s) => (
+                          <button
+                            key={s.id}
+                            type="button"
+                            onClick={() => {
+                              setSelectedRosterStudent(s);
+                              setRegFullName(s.fullName);
+                              setShowNameDropdown(false);
+                              setRegNis("");
+                            }}
+                            className="w-full px-4 py-2.5 text-left hover:bg-teal-50 transition-colors flex items-center justify-between group"
+                          >
+                            <div>
+                              <div className="font-bold text-xs text-slate-800 group-hover:text-teal-900">
+                                {s.fullName}
+                              </div>
+                              {s.hasAccount && (
+                                <div className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
+                                  <AlertCircle className="w-3 h-3" /> Akun aktif (sudah punya PIN)
+                                </div>
+                              )}
+                            </div>
+                            <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg group-hover:bg-teal-100">
+                              Pilih
+                            </span>
+                          </button>
+                        ))}
+                      </div>
+                    )}
+
+                    {selectedRosterStudent && (
+                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-medium">
+                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
+                        <span>Nama terkonfirmasi: <b>{selectedRosterStudent.fullName}</b></span>
+                      </div>
+                    )}
+                  </div>
+
+                  {/* INPUT 2: NIS (HANYA AKTIF SETELAH PILIH NAMA, VALIDASI HANYA SAAT JUMLAH DIGIT PENUH) */}
+                  <div className="space-y-1">
+                    <label className="text-xs font-bold text-slate-700 block">
+                      2. Nomor Induk Siswa (NIS) <span className="text-rose-500">*</span>
+                    </label>
+                    <div className="relative">
+                      <Hash className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                       <Input
                         type="text"
-                        placeholder="Contoh: 20260101"
+                        disabled={!selectedRosterStudent}
+                        placeholder={
+                          selectedRosterStudent
+                            ? `Ketik ${expectedNisLength} digit NIS Anda...`
+                            : "Pilih nama siswa di atas terlebih dahulu"
+                        }
                         value={regNis}
-                        onChange={(e) => setRegNis(e.target.value.toUpperCase())}
-                        className="h-10 text-xs font-mono font-bold uppercase rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
+                        onChange={(e) => setRegNis(e.target.value.toUpperCase().replace(/\s/g, ""))}
+                        className={`w-full h-11 pl-11 pr-4 text-xs font-mono font-bold uppercase rounded-2xl border transition-all outline-none ${
+                          !selectedRosterStudent
+                            ? "bg-slate-100/50 text-slate-400 border-transparent cursor-not-allowed"
+                            : "bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-slate-800 border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
+                        }`}
+                      />
+                    </div>
+
+                    {/* Keterangan NIS Cocok / Tidak Cocok (Hanya muncul saat jumlah angka diketik >= maksimal) */}
+                    {selectedRosterStudent && (
+                      <div className="pt-0.5">
+                        {nisValidationStatus === "MATCHED" && (
+                          <div className="flex items-center gap-1 text-xs text-emerald-600 font-bold animate-in fade-in duration-200">
+                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
+                            <span>NIS cocok</span>
+                          </div>
+                        )}
+                        {nisValidationStatus === "MISMATCHED" && (
+                          <div className="flex items-center gap-1 text-xs text-rose-600 font-bold animate-in fade-in duration-200">
+                            <XCircle className="w-3.5 h-3.5 shrink-0" />
+                            <span>NIS tidak cocok</span>
+                          </div>
+                        )}
+                      </div>
+                    )}
+                  </div>
+
+                  {/* INPUT 3: TANGGAL LAHIR (BAHAN VERIFIKASI PERTIMBANGAN GURU) */}
+                  <div className="space-y-1">
+                    <label className="text-xs font-bold text-slate-700 block">
+                      3. Tanggal Lahir Siswa <span className="text-rose-500">*</span>
+                    </label>
+                    <div className="relative">
+                      <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
+                      <Input
+                        type="date"
+                        disabled={!isNisMatched}
+                        value={regBirthDate}
+                        onChange={(e) => setRegBirthDate(e.target.value)}
+                        className={`w-full h-11 pl-11 pr-4 text-xs font-semibold rounded-2xl border transition-all outline-none ${
+                          !isNisMatched
+                            ? "bg-slate-100/50 text-slate-400 border-transparent cursor-not-allowed"
+                            : "bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-slate-800 border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
+                        }`}
                       />
                     </div>
+                    <p className="text-[11px] text-slate-400 leading-tight">
+                      Tanggal lahir digunakan guru sebagai bahan pertimbangan persetujuan akun.
+                    </p>
+                  </div>
 
-                    {/* PIN & Konfirmasi PIN */}
+                  {/* INPUT 4: BUAT PIN 4-DIGIT & KONFIRMASI PIN */}
+                  <div className="space-y-1">
+                    <label className="text-xs font-bold text-slate-700 block">
+                      4. Buat PIN Keamanan (4 Angka) <span className="text-rose-500">*</span>
+                    </label>
                     <div className="grid grid-cols-2 gap-2">
-                      <div className="space-y-1">
-                        <label className="text-[11px] font-bold text-slate-700 block">
-                          Buat PIN (4 Angka) <span className="text-rose-500">*</span>
-                        </label>
+                      <div>
                         <Input
                           type={showRegPin ? "text" : "password"}
                           maxLength={4}
-                          placeholder="••••"
+                          disabled={!regBirthDate}
+                          placeholder="PIN (4 Angka)"
                           value={regPin}
                           onChange={(e) => setRegPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
-                          className="h-10 text-xs font-mono font-black tracking-widest text-center rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
+                          className={`w-full h-11 px-3 text-xs font-mono font-black tracking-widest text-center rounded-2xl border transition-all outline-none ${
+                            !regBirthDate
+                              ? "bg-slate-100/50 text-slate-400 border-transparent cursor-not-allowed"
+                              : "bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-slate-800 border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
+                          }`}
                         />
                       </div>
-                      <div className="space-y-1">
-                        <label className="text-[11px] font-bold text-slate-700 block">
-                          Ulangi PIN <span className="text-rose-500">*</span>
-                        </label>
+                      <div>
                         <Input
                           type={showRegPin ? "text" : "password"}
                           maxLength={4}
-                          placeholder="••••"
+                          disabled={!regBirthDate}
+                          placeholder="Ulangi PIN"
                           value={regPinConfirm}
                           onChange={(e) => setRegPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
-                          className="h-10 text-xs font-mono font-black tracking-widest text-center rounded-xl bg-slate-50/60 border-slate-200 focus:bg-white"
+                          className={`w-full h-11 px-3 text-xs font-mono font-black tracking-widest text-center rounded-2xl border transition-all outline-none ${
+                            !regBirthDate
+                              ? "bg-slate-100/50 text-slate-400 border-transparent cursor-not-allowed"
+                              : "bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-slate-800 border-transparent focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
+                          }`}
                         />
                       </div>
                     </div>
+                  </div>
 
-                    <div className="flex justify-between items-center text-[10px] text-slate-400">
-                      <span>Gunakan 4 digit angka yang mudah kamu ingat.</span>
-                      <button
-                        type="button"
-                        onClick={() => setShowRegPin(!showRegPin)}
-                        className="text-teal-700 font-bold hover:underline"
-                      >
-                        {showRegPin ? "Sembunyikan" : "Perlihatkan"}
-                      </button>
-                    </div>
+                  <div className="flex justify-between items-center text-[11px] text-slate-400">
+                    <span>Gunakan 4 digit angka rahasia.</span>
+                    <button
+                      type="button"
+                      onClick={() => setShowRegPin(!showRegPin)}
+                      className="text-teal-700 font-bold hover:underline"
+                    >
+                      {showRegPin ? "Sembunyikan" : "Perlihatkan PIN"}
+                    </button>
+                  </div>
 
+                  {/* ACTION ROW (SUBMIT + BATAL) */}
+                  <div className="flex items-center gap-3 pt-2">
                     <Button
                       type="submit"
-                      disabled={regSubmitting}
-                      className="w-full h-11 rounded-xl bg-[#0F766E] hover:bg-[#0D655E] text-white font-bold text-xs tracking-wide shadow-md shadow-teal-900/10 transition-all active:scale-[0.99] mt-2"
+                      disabled={
+                        regSubmitting ||
+                        !selectedRosterStudent ||
+                        !isNisMatched ||
+                        !regBirthDate ||
+                        regPin.length !== 4 ||
+                        regPin !== regPinConfirm
+                      }
+                      className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-[#0F766E] to-[#14B8A6] hover:from-[#0D635C] hover:to-[#0F9E8E] text-white text-xs font-extrabold shadow-lg shadow-teal-700/25 hover:shadow-teal-700/35 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       {regSubmitting ? (
-                        <div className="flex items-center gap-2">
-                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
-                          <span>Mendaftarkan Akun Siswa...</span>
-                        </div>
+                        <span>Mendaftarkan Akun...</span>
                       ) : (
-                        <div className="flex items-center justify-center gap-1.5">
+                        <>
                           <span>Daftar & Gabung Rombel</span>
                           <ArrowRight className="w-4 h-4" />
-                        </div>
+                        </>
                       )}
                     </Button>
-                  </form>
-                )}
-              </div>
-            )}
-          </>
-        )}
-
-        {/* Footer Link to Teacher Login */}
-        <div className="pt-2 border-t border-slate-100 text-center">
-          <p className="text-[11px] text-slate-400">
-            Anda seorang Guru atau Wali Kelas?{" "}
-            <a
-              href="/login"
-              className="font-bold text-[#0F766E] hover:underline"
-            >
-              Masuk ke Ruang Guru
-            </a>
-          </p>
+                    <Button
+                      type="button"
+                      variant="outline"
+                      onClick={() => {
+                        setJoinContext(null);
+                        setMode("login");
+                      }}
+                      className="px-5 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 border-none text-slate-700 text-xs font-bold transition-all"
+                    >
+                      Batal
+                    </Button>
+                  </div>
+                </form>
+              )}
+            </div>
+          )}
+
+        </div>
+
+        {/* Bottom Footer & Link to Teacher Login */}
+        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 w-full max-w-[420px] mx-auto lg:ml-auto lg:mr-8 xl:mr-14 pb-1">
+          <span>&copy; {new Date().getFullYear()} KLASSA &bull; Siswa</span>
+          <a
+            href="/login"
+            className="font-bold text-[#0F766E] hover:underline"
+          >
+            Masuk Ruang Guru &rarr;
+          </a>
         </div>
 
       </div>
+
+      {/* ─────────────────────────────────────────────────────────────
+          SISI KANAN: S-CURVE WAVE + 3D MODULAR COCKPIT SISWA (MENYATU PUTIH)
+      ───────────────────────────────────────────────────────────── */}
+      <ModularCockpitArtwork theme="teal" portalType="student" />
+
     </div>
   );
 }
diff --git a/src/components/brand/ModularCockpitArtwork.tsx b/src/components/brand/ModularCockpitArtwork.tsx
index dd49120..2289ddc 100644
--- a/src/components/brand/ModularCockpitArtwork.tsx
+++ b/src/components/brand/ModularCockpitArtwork.tsx
@@ -5,12 +5,14 @@ import { Sparkles, FileSpreadsheet, LayoutGrid, ShieldCheck } from "lucide-react
 
 export interface ModularCockpitArtworkProps {
   theme?: "teal" | "emerald";
-  portalType?: "teacher" | "parent";
+  portalType?: "teacher" | "parent" | "student";
+  className?: string;
 }
 
 export function ModularCockpitArtwork({
   theme = "teal",
   portalType = "teacher",
+  className = "",
 }: ModularCockpitArtworkProps) {
   const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
 
@@ -26,13 +28,14 @@ export function ModularCockpitArtwork({
   }, []);
 
   const isParent = portalType === "parent";
+  const isStudent = portalType === "student";
   const isEmerald = theme === "emerald" || isParent;
 
   return (
     <div
       onMouseMove={handleMouseMove}
       onMouseLeave={handleMouseLeave}
-      className="w-full lg:w-1/2 relative flex items-center justify-center p-8 lg:p-12 xl:p-16 overflow-hidden bg-gradient-to-br from-slate-50 to-teal-50/40 select-none min-h-[440px] lg:min-h-screen"
+      className={`w-full lg:w-1/2 relative flex items-center justify-center p-6 sm:p-8 lg:p-12 xl:p-16 overflow-hidden bg-white dark:bg-slate-950 select-none min-h-[440px] lg:min-h-screen ${className}`}
     >
       {/* 1. PURE SVG ORGANIC S-CURVE WAVE BACKGROUND */}
       <div className="absolute inset-0 pointer-events-none z-0">
@@ -119,22 +122,40 @@ export function ModularCockpitArtwork({
           >
             <div className="flex items-center justify-between text-[10px]">
               <span className="font-bold text-teal-300">
-                {isParent ? "Kehadiran Putra/Putri Anda" : "Jadwal Mengajar Hari Ini"}
+                {isParent
+                  ? "Kehadiran Putra/Putri Anda"
+                  : isStudent
+                  ? "Jadwal Belajar & Tugas Siswa"
+                  : "Jadwal Mengajar Hari Ini"}
               </span>
               <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
             </div>
             <div className="space-y-1 text-center py-1">
               <div className="text-xs font-bold text-white">
-                {isParent ? "Ahmad Fauzi • XI RPL 1" : "Biologi XI RPL 1"}
+                {isParent
+                  ? "Ahmad Fauzi • XI RPL 1"
+                  : isStudent
+                  ? "Matematika • VIII-B"
+                  : "Biologi XI RPL 1"}
               </div>
               <div className="text-[10px] text-slate-400">
-                {isParent ? "Tercatat Hadir (07:15 WIB)" : "07:30 - 09:00 WIB • Lab 2"}
+                {isParent
+                  ? "Tercatat Hadir (07:15 WIB)"
+                  : isStudent
+                  ? "Tugas: Bab 3 Geometri & Aljabar"
+                  : "07:30 - 09:00 WIB • Lab 2"}
               </div>
             </div>
             <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-800 pt-1.5">
-              <span>{isParent ? "Status: 100% Hadir" : "Presensi 1-Klik"}</span>
+              <span>
+                {isParent
+                  ? "Status: 100% Hadir"
+                  : isStudent
+                  ? "Status: Aktif Belajar"
+                  : "Presensi 1-Klik"}
+              </span>
               <span className={isEmerald ? "text-emerald-400 font-bold" : "text-teal-400 font-bold"}>
-                {isParent ? "Tepat Waktu" : "Mulai Kelas →"}
+                {isParent ? "Tepat Waktu" : isStudent ? "Buka Materi →" : "Mulai Kelas →"}
               </span>
             </div>
           </div>
@@ -161,10 +182,20 @@ export function ModularCockpitArtwork({
           >
             <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800">
               <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
-              <span>{isParent ? "Ringkasan Nilai .PDF" : "Rekap Nilai .XLSX"}</span>
+              <span>
+                {isParent
+                  ? "Ringkasan Nilai .PDF"
+                  : isStudent
+                  ? "Portofolio Nilai Siswa"
+                  : "Rekap Nilai .XLSX"}
+              </span>
             </div>
             <div className="text-[9px] text-slate-500 mt-0.5">
-              {isParent ? "Capaian Belajar Transparan" : "Format Kurikulum Merdeka"}
+              {isParent
+                ? "Capaian Belajar Transparan"
+                : isStudent
+                ? "Transparan & Terintegrasi"
+                : "Format Kurikulum Merdeka"}
             </div>
           </div>
 
@@ -181,6 +212,11 @@ export function ModularCockpitArtwork({
               <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
               <span>Portal Keluarga Modern</span>
             </>
+          ) : isStudent ? (
+            <>
+              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
+              <span>Ruang Belajar Siswa Mandiri</span>
+            </>
           ) : (
             <>
               <LayoutGrid className="w-3.5 h-3.5 text-teal-600" />
diff --git a/src/modules/approvals/approvals.actions.ts b/src/modules/approvals/approvals.actions.ts
index 446a984..05149ba 100644
--- a/src/modules/approvals/approvals.actions.ts
+++ b/src/modules/approvals/approvals.actions.ts
@@ -128,6 +128,9 @@ export interface PendingStudentView {
   studentId: string;
   fullName: string;
   nis: string | null;
+  birthDate?: string | null;
+  birthDateConflict?: boolean;
+  conflictBirthDates?: string | null;
   classId: string;
   className: string;
   academicPeriodId: string;
@@ -144,6 +147,9 @@ function toPendingView(
       id: string;
       fullName: string;
       nis: string | null;
+      birthDate?: string | null;
+      birthDateConflict?: boolean;
+      conflictBirthDates?: string | null;
       accountRequestedAt: Date | null;
     };
     class: { id: string; name: string };
@@ -156,6 +162,9 @@ function toPendingView(
     studentId: row.student.id,
     fullName: row.student.fullName,
     nis: row.student.nis,
+    birthDate: row.student.birthDate ?? null,
+    birthDateConflict: row.student.birthDateConflict ?? false,
+    conflictBirthDates: row.student.conflictBirthDates ?? null,
     classId: row.class.id,
     className: row.class.name,
     academicPeriodId: row.academicPeriod.id,
@@ -173,6 +182,9 @@ const PENDING_INCLUDE = {
       id: true,
       fullName: true,
       nis: true,
+      birthDate: true,
+      birthDateConflict: true,
+      conflictBirthDates: true,
       accountRequestedAt: true,
       status: true,
       accountStatus: true,
@@ -203,7 +215,15 @@ export async function getPendingStudentsForClassAction(classId: string) {
     where: {
       classId,
       academicPeriodId: activePeriod.id,
-      student: { accountStatus: "PENDING", status: "ACTIVE", schoolId: activeSchoolId },
+      student: {
+        accountStatus: "PENDING",
+        status: "ACTIVE",
+        schoolId: activeSchoolId,
+        OR: [
+          { accountRequestedAt: { not: null } },
+          { accessPinHash: { not: null } },
+        ],
+      },
     },
     include: PENDING_INCLUDE,
     orderBy: [{ student: { accountRequestedAt: "asc" } }],
@@ -226,7 +246,14 @@ export async function getPendingStudentsForSchoolAction() {
   const rows = await prisma.classStudent.findMany({
     where: {
       class: { schoolId: activeSchoolId },
-      student: { accountStatus: "PENDING", status: "ACTIVE" },
+      student: {
+        accountStatus: "PENDING",
+        status: "ACTIVE",
+        OR: [
+          { accountRequestedAt: { not: null } },
+          { accessPinHash: { not: null } },
+        ],
+      },
     },
     include: PENDING_INCLUDE,
     orderBy: [{ student: { accountRequestedAt: "asc" } }],
diff --git a/src/modules/classes/__tests__/class-join-code.actions.test.ts b/src/modules/classes/__tests__/class-join-code.actions.test.ts
index 3e9622d..78d301d 100644
--- a/src/modules/classes/__tests__/class-join-code.actions.test.ts
+++ b/src/modules/classes/__tests__/class-join-code.actions.test.ts
@@ -17,8 +17,8 @@ vi.mock("@/lib/authorization", () => ({
 
 import { prisma } from "@/lib/auth";
 import { verifyActiveSchoolMembership } from "@/lib/authorization";
+import { generateRandomJoinCode } from "../class-join-code.utils";
 import {
-  generateRandomJoinCode,
   generateClassJoinCode,
   rotateClassJoinCode,
   lockClassJoinCode,
diff --git a/src/modules/classes/class-join-code.actions.ts b/src/modules/classes/class-join-code.actions.ts
index 95b8819..f3dcdd1 100644
--- a/src/modules/classes/class-join-code.actions.ts
+++ b/src/modules/classes/class-join-code.actions.ts
@@ -1,25 +1,8 @@
 "use server";
 
-import { randomInt } from "node:crypto";
 import { prisma } from "@/lib/auth";
 import { verifyActiveSchoolMembership } from "@/lib/authorization";
-
-// 32 karakter alfanumerik tanpa karakter ambigu (0, O, 1, I)
-const JOIN_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
-const JOIN_CODE_LENGTH = 6;
-
-/**
- * Menghasilkan kode acak 6 karakter dengan entropi kriptografis tinggi.
- * 32^6 = 1.073.741.824 kombinasi unik.
- */
-export function generateRandomJoinCode(): string {
-  let code = "";
-  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
-    const idx = randomInt(0, JOIN_CODE_CHARSET.length);
-    code += JOIN_CODE_CHARSET[idx];
-  }
-  return code;
-}
+import { generateRandomJoinCode } from "./class-join-code.utils";
 
 /**
  * Membuat kode rombel baru untuk kelas tertentu.
diff --git a/src/modules/classes/class-join-code.utils.ts b/src/modules/classes/class-join-code.utils.ts
new file mode 100644
index 0000000..484bc63
--- /dev/null
+++ b/src/modules/classes/class-join-code.utils.ts
@@ -0,0 +1,18 @@
+import { randomInt } from "node:crypto";
+
+// 32 karakter alfanumerik tanpa karakter ambigu (0, O, 1, I)
+export const JOIN_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
+export const JOIN_CODE_LENGTH = 6;
+
+/**
+ * Menghasilkan kode acak 6 karakter dengan entropi kriptografis tinggi.
+ * 32^6 = 1.073.741.824 kombinasi unik.
+ */
+export function generateRandomJoinCode(): string {
+  let code = "";
+  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
+    const idx = randomInt(0, JOIN_CODE_CHARSET.length);
+    code += JOIN_CODE_CHARSET[idx];
+  }
+  return code;
+}
diff --git a/src/modules/classes/classes.actions.ts b/src/modules/classes/classes.actions.ts
index 542efb3..07a7a83 100644
--- a/src/modules/classes/classes.actions.ts
+++ b/src/modules/classes/classes.actions.ts
@@ -3,6 +3,7 @@
 import { prisma } from "@/lib/auth";
 import { verifyActiveSchoolMembership } from "@/lib/authorization";
 import { redactMetadata } from "@/lib/audit-metadata";
+import { generateRandomJoinCode } from "./class-join-code.utils";
 import type { Prisma } from "@prisma/client";
 
 export async function getClassRoster(classId: string, academicPeriodId: string) {
@@ -119,12 +120,25 @@ export async function createClassAction(input: CreateClassActionInput) {
     });
 
     if (!classEntity) {
+      let uniqueCode: string | null = null;
+      for (let attempt = 0; attempt < 10; attempt++) {
+        const candidate = generateRandomJoinCode();
+        const exists = await tx.class.findUnique({ where: { joinCode: candidate } });
+        if (!exists) {
+          uniqueCode = candidate;
+          break;
+        }
+      }
+
       classEntity = await tx.class.create({
         data: {
           schoolId: activeSchoolId,
           name: className,
           normalizedName: normalizedClassName,
           gradeLevel: input.gradeLevel?.trim() || null,
+          joinCode: uniqueCode,
+          joinCodeLocked: false,
+          joinCodeUpdatedAt: new Date(),
         },
       });
     }
diff --git a/src/modules/student-auth/student-auth.actions.ts b/src/modules/student-auth/student-auth.actions.ts
index fa5b08e..563061d 100644
--- a/src/modules/student-auth/student-auth.actions.ts
+++ b/src/modules/student-auth/student-auth.actions.ts
@@ -51,6 +51,29 @@ export async function lookupJoinCode(code: string) {
         },
         take: 1,
       },
+      classStudents: {
+        where: {
+          student: {
+            status: "ACTIVE",
+          },
+        },
+        include: {
+          student: {
+            select: {
+              id: true,
+              fullName: true,
+              nis: true,
+              accessPinHash: true,
+              accountStatus: true,
+            },
+          },
+        },
+        orderBy: {
+          student: {
+            fullName: "asc",
+          },
+        },
+      },
     },
   });
 
@@ -83,6 +106,13 @@ export async function lookupJoinCode(code: string) {
       academicYear: primaryContext?.academicPeriod.year || "2026/2027",
       semester: primaryContext?.academicPeriod.semester || "Semester Ganjil",
       teacherName: primaryContext?.teacherProfile.user.name || "Guru Pengampu",
+      roster: (classRecord.classStudents || []).map((cs) => ({
+        id: cs.student.id,
+        fullName: cs.student.fullName,
+        nis: cs.student.nis,
+        hasAccount: cs.student.accessPinHash !== null && cs.student.accountStatus === "ACTIVE",
+        accountStatus: cs.student.accountStatus,
+      })),
     },
   };
 }
@@ -98,6 +128,13 @@ export type JoinCodeContext = {
   academicYear: string;
   semester: string;
   teacherName: string;
+  roster: Array<{
+    id: string;
+    fullName: string;
+    nis: string | null;
+    hasAccount: boolean;
+    accountStatus: string | null;
+  }>;
 };
 
 export type RegisterStudentResult =
@@ -112,7 +149,106 @@ function canonicalStudentName(value: string): string {
   return value.trim().replace(/\s+/g, " ").toLowerCase();
 }
 
+export type VerifyStudentIdentityResult =
+  | {
+      success: true;
+      status: "MATCHED_ROSTER" | "ALREADY_REGISTERED" | "NAME_MISMATCH" | "NEW_STUDENT";
+      message: string;
+      studentName?: string;
+      officialName?: string;
+    }
+  | {
+      success: false;
+      message: string;
+    };
+
+/**
+ * Memverifikasi kecocokan Nama dan NIS terhadap data master sekolah / rombel
+ * sebelum siswa membuat PIN 4-digit.
+ */
+export async function verifyStudentIdentity(data: {
+  joinCode: string;
+  fullName: string;
+  nis: string;
+}): Promise<VerifyStudentIdentityResult> {
+  if (!data.joinCode || data.joinCode.trim().length < 6) {
+    return { success: false, message: "Kode rombel tidak valid." };
+  }
+  if (!data.fullName || !data.fullName.trim()) {
+    return { success: false, message: "Nama lengkap wajib diisi." };
+  }
+  if (!data.nis || !data.nis.trim()) {
+    return { success: false, message: "NIS wajib diisi." };
+  }
+
+  const cleanNis = data.nis.trim().toUpperCase();
+  const cleanFullName = data.fullName.trim();
+  const cleanCode = data.joinCode.trim().toUpperCase();
+
+  const classRecord = await prisma.class.findUnique({
+    where: { joinCode: cleanCode },
+    include: {
+      school: {
+        select: { id: true, name: true, deactivatedAt: true },
+      },
+    },
+  });
+
+  if (!classRecord || classRecord.school?.deactivatedAt) {
+    return { success: false, message: "Kode rombel tidak ditemukan." };
+  }
+
+  if (classRecord.joinCodeLocked) {
+    return { success: false, message: "Kode rombel telah dikunci oleh guru." };
+  }
+
+  const existingStudent = await prisma.student.findFirst({
+    where: {
+      schoolId: classRecord.schoolId,
+      nis: { equals: cleanNis, mode: "insensitive" },
+    },
+  });
+
+  if (!existingStudent) {
+    return {
+      success: true,
+      status: "NEW_STUDENT",
+      message: "NIS belum terdata di rombel ini. Akun Anda akan didaftarkan sebagai siswa baru dan memerlukan persetujuan guru pengampu.",
+    };
+  }
+
+  // Sudah punya akun aktif & PIN (kecuali REJECTED)
+  if (existingStudent.accessPinHash !== null && existingStudent.accountStatus !== "REJECTED") {
+    return {
+      success: true,
+      status: "ALREADY_REGISTERED",
+      studentName: existingStudent.fullName,
+      message: `Akun siswa dengan NIS ${cleanNis} (${existingStudent.fullName}) sudah terdaftar dan aktif. Silakan langsung masuk menggunakan NIS dan PIN Anda.`,
+    };
+  }
+
+  // Cek kecocokan nama kanonik
+  const isMatch = canonicalStudentName(existingStudent.fullName) === canonicalStudentName(cleanFullName);
+
+  if (isMatch) {
+    return {
+      success: true,
+      status: "MATCHED_ROSTER",
+      studentName: existingStudent.fullName,
+      message: `Identitas terverifikasi di rombel! Nama "${existingStudent.fullName}" terdaftar pada sistem sekolah. Silakan buat PIN 4-digit di bawah untuk aktivasi otomatis.`,
+    };
+  } else {
+    return {
+      success: true,
+      status: "NAME_MISMATCH",
+      officialName: existingStudent.fullName,
+      message: `NIS ${cleanNis} terdaftar di sekolah atas nama "${existingStudent.fullName}". Karena nama yang Anda ketik berbeda, pendaftaran akan diteruskan ke guru untuk persetujuan (Pending).`,
+    };
+  }
+}
+
 /**
+
  * Pendaftaran akun siswa via kode rombel dengan state machine 4 cabang (A-D)
  * dan proteksi Re-registration Account Takeover (F1).
  */
@@ -121,6 +257,7 @@ export async function registerStudent(data: {
   fullName: string;
   nis: string;
   pin: string;
+  birthDate?: string;
 }): Promise<RegisterStudentResult> {
   // 1. Validasi format PIN 4-digit (Throws PinFormatError if invalid)
   validatePinFormat(data.pin);
@@ -136,6 +273,7 @@ export async function registerStudent(data: {
   const cleanNis = data.nis.trim().toUpperCase();
   const cleanFullName = data.fullName.trim();
   const cleanCode = data.joinCode.trim().toUpperCase();
+  const cleanBirthDate = data.birthDate?.trim() || null;
 
   // 2. Ambil data rombel & sekolah
   const classRecord = await prisma.class.findUnique({
@@ -543,22 +681,74 @@ export async function registerStudent(data: {
     };
   }
 
-  // Skenario (a): NIS ada, accessPinHash null, nama cocok exact (case-insensitive) -> L0 ACTIVE
+  // Skenario PENDING: Siswa mendaftar ulang saat pengajuan sebelumnya masih PENDING
+  if (existingStudent && existingStudent.accountStatus === "PENDING" && existingStudent.accountRequestedAt !== null) {
+    // Jika tanggal lahir sama persis -> beri notifikasi akun sudah tercatat & menunggu persetujuan
+    if (cleanBirthDate && existingStudent.birthDate && cleanBirthDate === existingStudent.birthDate) {
+      return {
+        success: true,
+        status: "PENDING",
+        reason: "MISMATCH_NAME",
+        student: existingStudent,
+        message: "Pendaftaran akun Anda sudah tercatat dan sedang menunggu persetujuan guru pengampu.",
+      };
+    }
+    // Jika tanggal lahir berbeda -> beri tanda konflik tanggal lahir untuk verifikasi guru
+    if (cleanBirthDate && existingStudent.birthDate && cleanBirthDate !== existingStudent.birthDate) {
+      const conflictNote = `${existingStudent.birthDate} vs ${cleanBirthDate}`;
+      const updated = await prisma.student.update({
+        where: { id: existingStudent.id },
+        data: {
+          birthDateConflict: true,
+          conflictBirthDates: conflictNote,
+          accountRequestedAt: now,
+        },
+        select: SAFE_STUDENT_SELECT,
+      });
+      return {
+        success: true,
+        status: "PENDING",
+        reason: "MISMATCH_NAME",
+        student: updated,
+        message:
+          "Pendaftaran tercatat. Terdapat perbedaan data tanggal lahir dengan pendaftaran sebelumnya, guru pengampu akan memverifikasi saat persetujuan.",
+      };
+    }
+    // Jika data tanggal lahir belum ada sebelumnya, simpan data baru
+    if (cleanBirthDate && !existingStudent.birthDate) {
+      await prisma.student.update({
+        where: { id: existingStudent.id },
+        data: { birthDate: cleanBirthDate, accessPinHash: pinHash },
+      });
+    }
+    return {
+      success: true,
+      status: "PENDING",
+      reason: "MISMATCH_NAME",
+      student: existingStudent,
+      message: "Pendaftaran akun Anda sudah tercatat dan sedang menunggu persetujuan guru pengampu.",
+    };
+  }
+
+  // Skenario (a): NIS dan nama cocok dengan data rombel -> PENDING (Memerlukan verifikasi & persetujuan guru)
   if (
     existingStudent &&
     existingStudent.accountStatus !== "REJECTED" &&
     existingStudent.fullName.trim().toLowerCase() === cleanFullName.toLowerCase()
   ) {
-    const updatedStudent = await prisma.$transaction(async (tx) => {
+    const pendingStudent = await prisma.$transaction(async (tx) => {
       const s = await tx.student.update({
         where: { id: existingStudent.id },
         data: {
           accessPinHash: pinHash,
-          accountStatus: "ACTIVE",
+          accountStatus: "PENDING",
+          birthDate: cleanBirthDate,
+          birthDateConflict: false,
+          conflictBirthDates: null,
           pinUpdatedAt: now,
-          lastLoginAt: now,
           failedAttempts: 0,
           lockedUntil: null,
+          accountRequestedAt: now, // Story 5 F2 — waktu pengajuan pendaftaran untuk panel persetujuan
         },
         select: SAFE_STUDENT_SELECT,
       });
@@ -583,23 +773,12 @@ export async function registerStudent(data: {
       return s;
     });
 
-    // Buat cookie sesi siswa seketika (Auto-login L0)
-    await setStudentSessionCookie({
-      studentId: updatedStudent.id,
-      schoolId: classRecord.schoolId,
-      classId: classRecord.id,
-      academicPeriodId,
-      nis: cleanNis,
-      fullName: updatedStudent.fullName,
-      pinUpdatedAt: now.toISOString(),
-    });
-
     return {
       success: true,
-      status: "ACTIVE",
-      student: updatedStudent,
-      redirect: "/siswa/portal",
-      message: "Pendaftaran berhasil! Akun Anda aktif otomatis.",
+      status: "PENDING",
+      reason: "MATCHED_ROSTER" as any,
+      student: pendingStudent,
+      message: "Pendaftaran terkirim! Akun Anda sedang menunggu verifikasi tanggal lahir & persetujuan guru pengampu.",
     };
   }
 
@@ -611,6 +790,9 @@ export async function registerStudent(data: {
         data: {
           accessPinHash: pinHash,
           accountStatus: "PENDING",
+          birthDate: cleanBirthDate,
+          birthDateConflict: false,
+          conflictBirthDates: null,
           pinUpdatedAt: now,
           failedAttempts: 0,
           lockedUntil: null,
@@ -656,6 +838,9 @@ export async function registerStudent(data: {
         schoolId: classRecord.schoolId,
         fullName: cleanFullName,
         nis: cleanNis,
+        birthDate: cleanBirthDate,
+        birthDateConflict: false,
+        conflictBirthDates: null,
         accessPinHash: pinHash,
         accountStatus: "PENDING",
         pinUpdatedAt: now,
```
===== END DIFF =====

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. If the instruction file is unreadable, report that exact failure and stop. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.
