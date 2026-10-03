Read the review instructions between the BEGIN-INSTRUCTIONS/END-INSTRUCTIONS markers completely and follow them as your review instructions.

claims_file (leave unread until your instructions call for it): the spec between the BEGIN-CLAIMS/END-CLAIMS markers below.

Review content: the unified diff between the BEGIN-DIFF/END-DIFF markers below.

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.

===== BEGIN-INSTRUCTIONS =====

# Edge Case Hunter Review

**Goal:** You are a pure path tracer. Never comment on whether code is good or bad; only list missing handling.
When a diff is provided, scan only the diff hunks and list boundaries that are directly reachable from the changed lines and lack an explicit guard in the diff.
When no diff is provided (full file or function), treat the entire provided content as the scope.
Ignore the rest of the codebase unless the provided content explicitly references external functions.
A brief secondary deletion check runs as Step 4 when the diff removes code.
A claims check runs as Step 5.

**Inputs:**
- **content** — Content to review, or a path to read it from: diff, full file, or function
- **also_consider** (optional) — Areas to keep in mind during review alongside normal edge-case analysis
- **claims_file** — Path to the spec this change was built from. Do NOT read it before Step 5: the path tracing in Steps 2–3 must finish before the claims are seen.

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

Load `references/claims-check.md` and follow it.

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

Final pass for the Edge Case Hunter. Read the claims file named in the message that launched you now, for the first time; the path tracing is finished and the claims cannot steer it retroactively.

It is the spec the change was built from. Read only its `## Intent` and `## Tasks & Acceptance` sections — the claims live there; ignore the rest of the file. The spec is the change's own account of itself: testimony, not evidence — a claim repeated in a code comment is still the same claim, not confirmation. Extract each checkable claim — what the change does, what it preserves, ordering, arithmetic, and parity with existing code ("exactly as X does") — then try to falsify each one against the code you have already traced. Where your trace is not enough to decide, read the code that decides it: the compared-to function, the actual callee, the state the claim assumes.

Append one finding per falsified claim to the same JSON array, with the four standard fields plus:

- `kind`: `"claim"`
- `confidence`: `"high"`, `"medium"`, or `"low"`

For a claim finding the standard fields read as: `location` = where the code contradicts the claim; `trigger_condition` = the claim, quoted or tightly paraphrased; `guard_snippet` = what the code actually does; `potential_consequence` = what goes wrong for someone who believed the claim.

Verified claims produce nothing. Add nothing if nothing is falsified.
</reference>

## CONTENT SOURCE

"Review content:" in the message that launched you gives the content itself or a path to read it from. Read the file when it is a path; either way that is the content under review, and this instruction file never is.

===== END-INSTRUCTIONS =====

===== BEGIN-CLAIMS =====

---
title: 'Story 2 — Lampiran guru pada tugas (soal/LKPD via file)'
type: 'feature'
created: '2025-10-02'
status: 'in-review'
baseline_commit: '855a282'
route: 'full'
review_loop_iteration: 0
context:
  - '{project-root}/docs/product/assignment-file-blueprint.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Guru hanya bisa memberi instruksi tugas berupa teks — soal/LKPD/bacaan disebar lewat WhatsApp. Siswa butuh lampiran file yang nempel di tugas.

**Approach:** Guru melampirkan file (semua jenis kecuali blocklist, maks 25 MB × 5 file/tugas) saat membuat tugas dan kapan saja setelahnya (K8: lampiran = instruksi, bebas diubah walau sudah ada yang mengumpulkan). Seluruh siswa rombel aktif tugas itu boleh lihat/unduh. Infrastruktur Story 1 (adapter S3, presign, validasi) dipakai ulang.

## Boundaries & Constraints

**Always:**
- Aturan file identik Story 1: blocklist program/makro, 25 MB/file, maks 5 file per tugas (digabung lama+baru saat replace), sanitasi nama, pratinjau inline hanya tipe previewable (guard di route)
- Upload presigned POST langsung browser→storage di prefix `attachments/tmp/`; claim saat create/set action dengan HEAD-check ukuran; key liar ditolak
- Akses unduh: guru pemilik konteks (verifyTeachingContextAccess) ATAU siswa dengan membership aktif di rombel+periode tugas itu; kegagalan = 404 generik; HEAD pre-check sebelum redirect (error ramah)
- Hapus attachment = hapus row + objek storage (setelah commit; gagal hapus = log saja)
- Route upload presign kind=attachment wajib sesi guru pemilik konteks — sesi siswa ditolak

**Never:**
- Tidak mengubah perilaku submission siswa / review (Story 1 utuh)
- Tidak membuat editor tugas umum (edit judul/deskripsi) — hanya lampiran yang dikelola
- Tidak menaruh lampiran di level sesi/pertemuan
- Byte file tidak lewat server Next.js

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| BUAT + lampiran | Guru isi form + 2 file | Tugas terbuat, 2 row `AssignmentAttachment`, objek di storage | Validasi sama Story 1 |
| Kelola: tambah | Dialog lampiran tugas aktif, +1 file baru | Row baru; file lama tak tersentuh | Maks 5 gabungan (lama dipertahankan + baru) |
| Kelola: hapus | Hapus 1 dari 3 lampiran | Row hilang + objek dihapus dari storage | Gagal hapus objek → log, row tetap hilang |
| Ubah setelah ada submission | Ada 5 siswa sudah kumpul, guru ganti PDF soal | Berhasil — lampiran bukan data penilaian (K8) | Tanpa peringatan khusus |
| Siswa rombel benar akses | GET attachment tugas rombelnya aktif | 302 presigned (inline bila previewable, selain itu unduh) | HEAD null → 404 ramah |
| Siswa rombel lain | GET attachment tugas kelas beda | 404 generik | Tanpa bocor |
| Siswa request presign attachment | POST upload-url kind=attachment dgn sesi siswa | 403 (hanya guru) | Pesan jelas |
| Guru asing presign/akses | Guru non-pemilik konteks | 404 generik / 403 presign | Tanpa bocor |
| Duplikat key / key liar / ukuran bohong | Saat claim | Ditolak eksplisit (pesan spesifik) | Sama pola Story 1 |
| S3 tak dikonfigurasi | Env kosong | Presign 503; teks tugas tetap bisa dibuat tanpa lampiran | Mati anggun |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — tambah `AssignmentAttachment` (blueprint §3.1 persis) + relasi `attachments AssignmentAttachment[]` di `Assignment`; migrasi `assignment_attachment`
- `src/modules/storage/storage.service.ts` — `buildTmpStorageKey(name, kind)` + `isClaimableKey(key, kind)` (generalisasi prefix `submissions/tmp`|`attachments/tmp`) — REUSE presign/HEAD/delete
- `src/app/api/assignments/files/upload-url/route.ts` — body `{kind: "submission"|"attachment", teachingContextId?, assignmentId?}`: attachment → guard guru via `verifyTeachingContextAccess` (throw→404), presign prefix attachments
- `src/app/api/assignments/attachments/[fileId]/route.ts` — BARU: pola identik route [fileId] Story 1 (HEAD pre-check, inline guard, 404 generik); akses siswa = membership aktif rombel tugas
- `src/modules/assignments/assignment.actions.ts` — `createAssignment` terima `files?`; BARU `setAssignmentAttachmentsAction({teachingContextId, assignmentId, keepFileIds, newFiles})` (selective delete+insert, HEAD claim, hapus objek); `getAssignmentAttachmentsForRombel` helper query
- `src/app/(dashboard)/kelas/[teachingContextId]/tugas/page.tsx` — sertakan `attachments` di query → props TugasClient
- `src/app/(dashboard)/kelas/[teachingContextId]/tugas/TugasClient.tsx` — form create: file picker + daftar (reuse pola SubmitAssignmentForm, XHR+timeout+infer mime); row tugas: tombol "Lampiran (n)" buka dialog
- BARU `src/app/(dashboard)/kelas/[teachingContextId]/tugas/AssignmentAttachmentsDialog.tsx` — kelola: daftar lampiran, hapus, tambah, simpan via setAssignmentAttachmentsAction
- `src/app/siswa/portal/tugas/page.tsx` — sertakan `attachments`; kartu tugas: bagian Lampiran (unduh/pratinjau inline)
- `src/modules/student-portal/__tests__/story2-attachments.int.test.ts` — BARU, pola story-1 (mock storage S3 + authorization, DB nyata)

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `npx prisma migrate dev --name assignment_attachment` — model & tabel
- [x] `storage.service.ts` — generalisasi key builder/claim per kind + unit test update
- [x] `upload-url/route.ts` — dukung kind=attachment + guard guru — reuse validasi
- [x] `attachments/[fileId]/route.ts` — pintu akses + guard akses siswa rombel — pola Story 1
- [x] `assignment.actions.ts` — createAssignment(files?) + setAssignmentAttachmentsAction + include attachments di query page guru/siswa
- [x] `TugasClient.tsx` + `AssignmentAttachmentsDialog.tsx` — UI upload saat create & kelola kapan saja
- [x] `siswa/portal/tugas/page.tsx` — tampil lampiran di kartu tugas
- [ ] Int test story2: create dgn file, set replace/remove + hapus objek, akses 302/404, presign guru vs siswa, >5 gabungan, duplikat key, mati anggun
- [ ] Unit/regresi: jalankan suite assignments + storage + story-1 (tak boleh pecah)

**Acceptance Criteria:**
- Given guru pemilik, when membuat tugas dengan 2 file, then tugas + 2 lampiran tersimpan dan siswa rombel melihatnya di portal
- Given tugas dengan 3 lampiran, when guru hapus 1 via dialog, then 2 tersisa; objek yang dihapus hilang dari storage
- Given sudah ada submission masuk, when guru menambah lampiran, then berhasil tanpa blokir
- Given siswa rombel aktif tugas itu, when GET attachment, then 302; siswa rombel lain → 404
- Given sesi siswa, when POST upload-url kind=attachment, then 403
- Given env S3 kosong, when buat tugas tanpa file, then sukses seperti biasa

## Design Notes

- Generalisasi key: `buildTmpStorageKey(name, "attachments")` → `attachments/tmp/{uuid}.{ext}`; `isClaimableKey(key, "attachments")` regex sama. Story 1 call-site diperbarui ke signature baru (perilaku tak berubah).
- Dialog kelola pakai pola keep+new persis Story 1 (id stabil, guard gabungan ≤5).
- Student portal: lampiran dirender sebagai chip nama file (ikon per tipe) — link `?disposition=inline` bila previewable, selain itu unduh.

## Verification

**Commands:**
- `npx tsc --noEmit` -- 0 error
- `npm test` -- semua hijau termasuk suite baru
- `npx prisma migrate dev --name assignment_attachment` -- diterapkan tanpa drift

**Manual checks:**
- Dev server lokal + SeaweedFS: guru buat tugas berlampiran → siswa unduh; guru ubah lampiran setelah ada submission

## Implementation Notes

- `toAssignmentAttachmentView` diekspor agar page server-component guru bisa memetakan row Prisma → view tanpa query N+1.
- Mock `verifyTeachingContextAccess` di int test HARUS mengembalikan `{ context: { id } }` — `createAssignment` memakai `auth.context.id` untuk revalidatePath (lesson dari kegagalan awal test).
- Route attachment: jalur guru dicek duluan (mock resolve), jalur siswa membership aktif sebagai fallback — siswa rombel benar tidak butuh verifyTeachingContextAccess.
- Presign kind=attachment menolak sesi siswa APA PUN (403) sebelum cek guru — sesi siswa tak boleh pernah bisa presign lampiran.
- Generalisasi key: `buildTmpStorageKey(name, kind)` + `isClaimableKey(key, kind)`; sekat kind diuji (key attachment tak bisa diklaim submission & sebaliknya). Call-site Story 1 diperbarui, perilaku tak berubah.
- Verifikasi: tsc 0 error; suite penuh 851/851 (74 file); int story-2 11/11; unit storage 31/31.

===== END-CLAIMS =====

===== BEGIN-DIFF =====

diff --git a/_bmad-output/implementation-artifacts/spec-assignment-attachments.md b/_bmad-output/implementation-artifacts/spec-assignment-attachments.md
new file mode 100644
index 0000000..f0fdb91
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-assignment-attachments.md
@@ -0,0 +1,101 @@
+---
+title: 'Story 2 — Lampiran guru pada tugas (soal/LKPD via file)'
+type: 'feature'
+created: '2025-10-02'
+status: 'in-progress'
+baseline_commit: '855a282'
+route: 'full'
+review_loop_iteration: 0
+context:
+  - '{project-root}/docs/product/assignment-file-blueprint.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** Guru hanya bisa memberi instruksi tugas berupa teks — soal/LKPD/bacaan disebar lewat WhatsApp. Siswa butuh lampiran file yang nempel di tugas.
+
+**Approach:** Guru melampirkan file (semua jenis kecuali blocklist, maks 25 MB × 5 file/tugas) saat membuat tugas dan kapan saja setelahnya (K8: lampiran = instruksi, bebas diubah walau sudah ada yang mengumpulkan). Seluruh siswa rombel aktif tugas itu boleh lihat/unduh. Infrastruktur Story 1 (adapter S3, presign, validasi) dipakai ulang.
+
+## Boundaries & Constraints
+
+**Always:**
+- Aturan file identik Story 1: blocklist program/makro, 25 MB/file, maks 5 file per tugas (digabung lama+baru saat replace), sanitasi nama, pratinjau inline hanya tipe previewable (guard di route)
+- Upload presigned POST langsung browser→storage di prefix `attachments/tmp/`; claim saat create/set action dengan HEAD-check ukuran; key liar ditolak
+- Akses unduh: guru pemilik konteks (verifyTeachingContextAccess) ATAU siswa dengan membership aktif di rombel+periode tugas itu; kegagalan = 404 generik; HEAD pre-check sebelum redirect (error ramah)
+- Hapus attachment = hapus row + objek storage (setelah commit; gagal hapus = log saja)
+- Route upload presign kind=attachment wajib sesi guru pemilik konteks — sesi siswa ditolak
+
+**Never:**
+- Tidak mengubah perilaku submission siswa / review (Story 1 utuh)
+- Tidak membuat editor tugas umum (edit judul/deskripsi) — hanya lampiran yang dikelola
+- Tidak menaruh lampiran di level sesi/pertemuan
+- Byte file tidak lewat server Next.js
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected Output / Behavior | Error Handling |
+|----------|--------------|---------------------------|----------------|
+| BUAT + lampiran | Guru isi form + 2 file | Tugas terbuat, 2 row `AssignmentAttachment`, objek di storage | Validasi sama Story 1 |
+| Kelola: tambah | Dialog lampiran tugas aktif, +1 file baru | Row baru; file lama tak tersentuh | Maks 5 gabungan (lama dipertahankan + baru) |
+| Kelola: hapus | Hapus 1 dari 3 lampiran | Row hilang + objek dihapus dari storage | Gagal hapus objek → log, row tetap hilang |
+| Ubah setelah ada submission | Ada 5 siswa sudah kumpul, guru ganti PDF soal | Berhasil — lampiran bukan data penilaian (K8) | Tanpa peringatan khusus |
+| Siswa rombel benar akses | GET attachment tugas rombelnya aktif | 302 presigned (inline bila previewable, selain itu unduh) | HEAD null → 404 ramah |
+| Siswa rombel lain | GET attachment tugas kelas beda | 404 generik | Tanpa bocor |
+| Siswa request presign attachment | POST upload-url kind=attachment dgn sesi siswa | 403 (hanya guru) | Pesan jelas |
+| Guru asing presign/akses | Guru non-pemilik konteks | 404 generik / 403 presign | Tanpa bocor |
+| Duplikat key / key liar / ukuran bohong | Saat claim | Ditolak eksplisit (pesan spesifik) | Sama pola Story 1 |
+| S3 tak dikonfigurasi | Env kosong | Presign 503; teks tugas tetap bisa dibuat tanpa lampiran | Mati anggun |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `prisma/schema.prisma` — tambah `AssignmentAttachment` (blueprint §3.1 persis) + relasi `attachments AssignmentAttachment[]` di `Assignment`; migrasi `assignment_attachment`
+- `src/modules/storage/storage.service.ts` — `buildTmpStorageKey(name, kind)` + `isClaimableKey(key, kind)` (generalisasi prefix `submissions/tmp`|`attachments/tmp`) — REUSE presign/HEAD/delete
+- `src/app/api/assignments/files/upload-url/route.ts` — body `{kind: "submission"|"attachment", teachingContextId?, assignmentId?}`: attachment → guard guru via `verifyTeachingContextAccess` (throw→404), presign prefix attachments
+- `src/app/api/assignments/attachments/[fileId]/route.ts` — BARU: pola identik route [fileId] Story 1 (HEAD pre-check, inline guard, 404 generik); akses siswa = membership aktif rombel tugas
+- `src/modules/assignments/assignment.actions.ts` — `createAssignment` terima `files?`; BARU `setAssignmentAttachmentsAction({teachingContextId, assignmentId, keepFileIds, newFiles})` (selective delete+insert, HEAD claim, hapus objek); `getAssignmentAttachmentsForRombel` helper query
+- `src/app/(dashboard)/kelas/[teachingContextId]/tugas/page.tsx` — sertakan `attachments` di query → props TugasClient
+- `src/app/(dashboard)/kelas/[teachingContextId]/tugas/TugasClient.tsx` — form create: file picker + daftar (reuse pola SubmitAssignmentForm, XHR+timeout+infer mime); row tugas: tombol "Lampiran (n)" buka dialog
+- BARU `src/app/(dashboard)/kelas/[teachingContextId]/tugas/AssignmentAttachmentsDialog.tsx` — kelola: daftar lampiran, hapus, tambah, simpan via setAssignmentAttachmentsAction
+- `src/app/siswa/portal/tugas/page.tsx` — sertakan `attachments`; kartu tugas: bagian Lampiran (unduh/pratinjau inline)
+- `src/modules/student-portal/__tests__/story2-attachments.int.test.ts` — BARU, pola story-1 (mock storage S3 + authorization, DB nyata)
+
+## Tasks & Acceptance
+
+**Execution:**
+- [ ] `prisma/schema.prisma` + `npx prisma migrate dev --name assignment_attachment` — model & tabel
+- [ ] `storage.service.ts` — generalisasi key builder/claim per kind + unit test update
+- [ ] `upload-url/route.ts` — dukung kind=attachment + guard guru — reuse validasi
+- [ ] `attachments/[fileId]/route.ts` — pintu akses + guard akses siswa rombel — pola Story 1
+- [ ] `assignment.actions.ts` — createAssignment(files?) + setAssignmentAttachmentsAction + include attachments di query page guru/siswa
+- [ ] `TugasClient.tsx` + `AssignmentAttachmentsDialog.tsx` — UI upload saat create & kelola kapan saja
+- [ ] `siswa/portal/tugas/page.tsx` — tampil lampiran di kartu tugas
+- [ ] Int test story2: create dgn file, set replace/remove + hapus objek, akses 302/404, presign guru vs siswa, >5 gabungan, duplikat key, mati anggun
+- [ ] Unit/regresi: jalankan suite assignments + storage + story-1 (tak boleh pecah)
+
+**Acceptance Criteria:**
+- Given guru pemilik, when membuat tugas dengan 2 file, then tugas + 2 lampiran tersimpan dan siswa rombel melihatnya di portal
+- Given tugas dengan 3 lampiran, when guru hapus 1 via dialog, then 2 tersisa; objek yang dihapus hilang dari storage
+- Given sudah ada submission masuk, when guru menambah lampiran, then berhasil tanpa blokir
+- Given siswa rombel aktif tugas itu, when GET attachment, then 302; siswa rombel lain → 404
+- Given sesi siswa, when POST upload-url kind=attachment, then 403
+- Given env S3 kosong, when buat tugas tanpa file, then sukses seperti biasa
+
+## Design Notes
+
+- Generalisasi key: `buildTmpStorageKey(name, "attachments")` → `attachments/tmp/{uuid}.{ext}`; `isClaimableKey(key, "attachments")` regex sama. Story 1 call-site diperbarui ke signature baru (perilaku tak berubah).
+- Dialog kelola pakai pola keep+new persis Story 1 (id stabil, guard gabungan ≤5).
+- Student portal: lampiran dirender sebagai chip nama file (ikon per tipe) — link `?disposition=inline` bila previewable, selain itu unduh.
+
+## Verification
+
+**Commands:**
+- `npx tsc --noEmit` -- 0 error
+- `npm test` -- semua hijau termasuk suite baru
+- `npx prisma migrate dev --name assignment_attachment` -- diterapkan tanpa drift
+
+**Manual checks:**
+- Dev server lokal + SeaweedFS: guru buat tugas berlampiran → siswa unduh; guru ubah lampiran setelah ada submission
diff --git a/prisma/migrations/20261003042826_assignment_attachment/migration.sql b/prisma/migrations/20261003042826_assignment_attachment/migration.sql
new file mode 100644
index 0000000..4b9c277
--- /dev/null
+++ b/prisma/migrations/20261003042826_assignment_attachment/migration.sql
@@ -0,0 +1,21 @@
+-- CreateTable
+CREATE TABLE "assignment_attachment" (
+    "id" TEXT NOT NULL,
+    "assignmentId" TEXT NOT NULL,
+    "storageKey" TEXT NOT NULL,
+    "originalName" TEXT NOT NULL,
+    "mimeType" TEXT NOT NULL,
+    "sizeBytes" INTEGER NOT NULL,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+
+    CONSTRAINT "assignment_attachment_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateIndex
+CREATE UNIQUE INDEX "assignment_attachment_storageKey_key" ON "assignment_attachment"("storageKey");
+
+-- CreateIndex
+CREATE INDEX "assignment_attachment_assignmentId_idx" ON "assignment_attachment"("assignmentId");
+
+-- AddForeignKey
+ALTER TABLE "assignment_attachment" ADD CONSTRAINT "assignment_attachment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 0baf4a1..7200935 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -562,6 +562,7 @@ model Assignment {
   updatedAt         DateTime         @updatedAt
 
   submissions AssignmentSubmission[]
+  attachments AssignmentAttachment[]
 
   @@index([teachingContextId])
   @@index([teachingSessionId])
@@ -609,6 +610,20 @@ model SubmissionFile {
   @@map("submission_file")
 }
 
+model AssignmentAttachment {
+  id           String     @id @default(cuid())
+  assignmentId String
+  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
+  storageKey   String     @unique
+  originalName String
+  mimeType     String
+  sizeBytes    Int
+  createdAt    DateTime   @default(now())
+
+  @@index([assignmentId])
+  @@map("assignment_attachment")
+}
+
 // -------------------------------------------------
 // ASSESSMENT & GRADING SCHEMA (DEV STAGE 04)
 // -------------------------------------------------
diff --git a/src/app/(dashboard)/kelas/[teachingContextId]/tugas/AssignmentAttachmentsDialog.tsx b/src/app/(dashboard)/kelas/[teachingContextId]/tugas/AssignmentAttachmentsDialog.tsx
new file mode 100644
index 0000000..0c3e6dd
--- /dev/null
+++ b/src/app/(dashboard)/kelas/[teachingContextId]/tugas/AssignmentAttachmentsDialog.tsx
@@ -0,0 +1,257 @@
+"use client";
+
+import { useState } from "react";
+import { File as FileIcon, Loader2, Paperclip, Trash2, Upload, X } from "lucide-react";
+import { toast } from "sonner";
+import { Button } from "@/components/ui/button";
+import { isBlockedExtension, inferMimeFromExtension, MAX_FILE_BYTES, MAX_FILES } from "@/modules/storage/file-validation";
+import { setAssignmentAttachmentsAction, type AssignmentAttachmentView } from "@/modules/assignments/assignment.actions";
+
+/**
+ * Story 2 — dialog kelola lampiran tugas (guru). Pola keep+new:
+ * upload presign dulu (browser→storage), lalu setAssignmentAttachmentsAction.
+ * K8: bebas diubah kapan saja, walau sudah ada yang mengumpulkan.
+ */
+
+type PendingItem = {
+  localId: string;
+  name: string;
+  size: number;
+  mimeType: string;
+  file: File;
+};
+
+function fmtSize(bytes: number): string {
+  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
+  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
+}
+
+function uploadToStorage(
+  uploadUrl: string,
+  fields: Record<string, string>,
+  file: File
+): Promise<void> {
+  return new Promise((resolve, reject) => {
+    const xhr = new XMLHttpRequest();
+    xhr.open("POST", uploadUrl);
+    xhr.timeout = 60_000;
+    xhr.onload = () =>
+      xhr.status >= 200 && xhr.status < 300
+        ? resolve()
+        : reject(new Error(`Upload gagal (${xhr.status})`));
+    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah"));
+    xhr.ontimeout = () => reject(new Error("Unggahan terlalu lama — periksa koneksi"));
+    const fd = new FormData();
+    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
+    fd.append("file", file);
+    xhr.send(fd);
+  });
+}
+
+export function AssignmentAttachmentsDialog({
+  teachingContextId,
+  assignmentId,
+  assignmentTitle,
+  initialAttachments,
+}: {
+  teachingContextId: string;
+  assignmentId: string;
+  assignmentTitle: string;
+  initialAttachments: AssignmentAttachmentView[];
+}) {
+  const [open, setOpen] = useState(false);
+  const [kept, setKept] = useState<AssignmentAttachmentView[]>(initialAttachments);
+  const [pendingFiles, setPendingFiles] = useState<PendingItem[]>([]);
+  const [busy, setBusy] = useState(false);
+
+  const total = kept.length + pendingFiles.length;
+
+  function addFiles(list: FileList | null) {
+    if (!list) return;
+    setPendingFiles((prev) => {
+      const next = [...prev];
+      for (const f of Array.from(list)) {
+        if (next.length + kept.length >= MAX_FILES) {
+          toast.error(`Maksimal ${MAX_FILES} file per tugas.`);
+          break;
+        }
+        if (isBlockedExtension(f.name)) {
+          toast.error(`Jenis file ${f.name.split(".").pop()?.toUpperCase()} tidak diperbolehkan.`);
+          continue;
+        }
+        if (f.size > MAX_FILE_BYTES) {
+          toast.error(`File "${f.name}" melebihi 25 MB.`);
+          continue;
+        }
+        next.push({
+          localId: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
+          name: f.name,
+          size: f.size,
+          mimeType: f.type || inferMimeFromExtension(f.name) || "application/octet-stream",
+          file: f,
+        });
+      }
+      return next;
+    });
+  }
+
+  async function handleSave() {
+    if (busy) return;
+    setBusy(true);
+    try {
+      // 1. Upload file pending → presign → langsung ke storage
+      const uploaded: Array<{ storageKey: string; name: string; mimeType: string; sizeBytes: number }> = [];
+      if (pendingFiles.length > 0) {
+        const res = await fetch("/api/assignments/files/upload-url", {
+          method: "POST",
+          headers: { "Content-Type": "application/json" },
+          body: JSON.stringify({
+            kind: "attachment",
+            teachingContextId,
+            files: pendingFiles.map((f) => ({ name: f.name, mimeType: f.mimeType, sizeBytes: f.size })),
+          }),
+        });
+        const data = await res.json().catch(() => null);
+        if (!res.ok || !data?.uploads) {
+          toast.error(data?.error ?? "Gagal menyiapkan unggahan.");
+          setBusy(false);
+          return;
+        }
+        for (let i = 0; i < pendingFiles.length; i++) {
+          try {
+            await uploadToStorage(data.uploads[i].uploadUrl, data.uploads[i].fields, pendingFiles[i].file);
+            uploaded.push({
+              storageKey: data.uploads[i].storageKey,
+              name: pendingFiles[i].name,
+              mimeType: pendingFiles[i].mimeType,
+              sizeBytes: pendingFiles[i].size,
+            });
+          } catch {
+            toast.error(`File "${pendingFiles[i].name}" gagal diunggah — periksa koneksi.`);
+            setBusy(false);
+            return;
+          }
+        }
+      }
+
+      // 2. Set final: keep + new
+      const result = await setAssignmentAttachmentsAction({
+        teachingContextId,
+        assignmentId,
+        keepFileIds: kept.map((f) => f.id),
+        newFiles: uploaded,
+      });
+      if (result.success && result.attachments) {
+        setKept(result.attachments);
+        setPendingFiles([]);
+        toast.success("Lampiran tersimpan", { description: `Total ${result.attachments.length} file.` });
+      } else {
+        toast.error(result.error ?? "Gagal menyimpan lampiran");
+      }
+    } catch {
+      toast.error("Gagal menyimpan — periksa koneksi lalu coba lagi.");
+    } finally {
+      setBusy(false);
+    }
+  }
+
+  return (
+    <>
+      <button
+        onClick={() => setOpen(true)}
+        className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline"
+      >
+        <Paperclip className="w-4 h-4" />
+        Lampiran{kept.length > 0 ? ` (${kept.length})` : ""}
+      </button>
+
+      {open && (
+        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog">
+          <div className="bg-white rounded-xl border shadow-lg w-full max-w-md max-h-[85vh] overflow-y-auto">
+            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
+              <div>
+                <h3 className="font-semibold text-sm">Lampiran Tugas</h3>
+                <p className="text-xs text-muted-foreground truncate max-w-[280px]">{assignmentTitle}</p>
+              </div>
+              <button onClick={() => setOpen(false)} aria-label="Tutup" className="text-muted-foreground hover:text-foreground">
+                <X className="w-4 h-4" />
+              </button>
+            </div>
+
+            <div className="p-4 space-y-3">
+              <p className="text-[11px] text-muted-foreground">
+                Soal, LKPD, atau bahan lain. Bisa diubah kapan saja — walau sudah ada yang mengumpulkan.
+              </p>
+
+              {kept.length === 0 && pendingFiles.length === 0 && (
+                <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg border-dashed">
+                  Belum ada lampiran.
+                </p>
+              )}
+
+              {kept.map((f) => (
+                <div key={f.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
+                  <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
+                  <a
+                    href={`/api/assignments/attachments/${f.id}`}
+                    target="_blank"
+                    rel="noopener noreferrer"
+                    className="flex-1 min-w-0 truncate text-xs font-medium hover:underline"
+                    title={f.originalName}
+                  >
+                    {f.originalName}
+                    <span className="text-muted-foreground font-normal"> ({fmtSize(f.sizeBytes)})</span>
+                  </a>
+                  <button
+                    onClick={() => setKept(kept.filter((x) => x.id !== f.id))}
+                    aria-label={`Hapus ${f.originalName}`}
+                    className="text-muted-foreground hover:text-rose-500"
+                  >
+                    <Trash2 className="w-3.5 h-3.5" />
+                  </button>
+                </div>
+              ))}
+
+              {pendingFiles.map((f) => (
+                <div key={f.localId} className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/50 px-3 py-2">
+                  <FileIcon className="w-4 h-4 text-teal-600 shrink-0" />
+                  <span className="flex-1 min-w-0 truncate text-xs font-medium">
+                    {f.name} <span className="text-muted-foreground font-normal">({fmtSize(f.size)})</span>
+                  </span>
+                  <button
+                    onClick={() => setPendingFiles(pendingFiles.filter((x) => x.localId !== f.localId))}
+                    aria-label={`Batal ${f.name}`}
+                    className="text-muted-foreground hover:text-rose-500"
+                  >
+                    <Trash2 className="w-3.5 h-3.5" />
+                  </button>
+                </div>
+              ))}
+
+              {total < MAX_FILES && (
+                <label className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:border-teal-400 hover:text-teal-700">
+                  <Upload className="w-4 h-4" />
+                  Tambah file (maks {MAX_FILES} × 25 MB)
+                  <input
+                    type="file"
+                    multiple
+                    className="hidden"
+                    onChange={(e) => {
+                      addFiles(e.target.files);
+                      e.target.value = "";
+                    }}
+                  />
+                </label>
+              )}
+
+              <Button onClick={handleSave} disabled={busy || (pendingFiles.length === 0 && kept.length === initialAttachments.length)} className="w-full">
+                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
+                {busy ? "Menyimpan…" : "Simpan Lampiran"}
+              </Button>
+            </div>
+          </div>
+        </div>
+      )}
+    </>
+  );
+}
diff --git a/src/app/(dashboard)/kelas/[teachingContextId]/tugas/TugasClient.tsx b/src/app/(dashboard)/kelas/[teachingContextId]/tugas/TugasClient.tsx
index 0d05115..a3a58c2 100644
--- a/src/app/(dashboard)/kelas/[teachingContextId]/tugas/TugasClient.tsx
+++ b/src/app/(dashboard)/kelas/[teachingContextId]/tugas/TugasClient.tsx
@@ -1,7 +1,7 @@
 "use client";
 
 import { useState } from "react";
-import { createAssignment } from "@/modules/assignments/assignment.actions";
+import { createAssignment, type AssignmentAttachmentView } from "@/modules/assignments/assignment.actions";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
@@ -11,7 +11,9 @@ import { toast } from "sonner";
 import { format } from "date-fns";
 import { id } from "date-fns/locale";
 import Link from "next/link";
-import { ClipboardCheck } from "lucide-react";
+import { ClipboardCheck, File as FileIcon, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
+import { isBlockedExtension, inferMimeFromExtension, MAX_FILE_BYTES, MAX_FILES } from "@/modules/storage/file-validation";
+import { AssignmentAttachmentsDialog } from "./AssignmentAttachmentsDialog";
 
 type AssignmentData = {
   id: string;
@@ -21,6 +23,7 @@ type AssignmentData = {
   dueDate?: Date | null;
   createdAt: Date | string;
   pendingSubmissions?: number;
+  attachments?: AssignmentAttachmentView[];
 };
 type SessionData = {
   id: string;
@@ -37,6 +40,75 @@ export default function TugasClient({ teachingContextId, initialAssignments, ses
   const [description, setDescription] = useState("");
   const [dueDateStr, setDueDateStr] = useState("");
   const [sessionId, setSessionId] = useState<string>("none");
+  // Story 2 — lampiran saat buat tugas: upload presign dulu, claim di createAssignment
+  const [newFiles, setNewFiles] = useState<Array<{ localId: string; name: string; size: number; mimeType: string; file: File }>>([]);
+  const [uploading, setUploading] = useState(false);
+
+  function addFiles(list: FileList | null) {
+    if (!list) return;
+    setNewFiles((prev) => {
+      const next = [...prev];
+      for (const f of Array.from(list)) {
+        if (next.length >= MAX_FILES) {
+          toast.error(`Maksimal ${MAX_FILES} file per tugas.`);
+          break;
+        }
+        if (isBlockedExtension(f.name)) {
+          toast.error(`Jenis file ${f.name.split(".").pop()?.toUpperCase()} tidak diperbolehkan.`);
+          continue;
+        }
+        if (f.size > MAX_FILE_BYTES) {
+          toast.error(`File "${f.name}" melebihi 25 MB.`);
+          continue;
+        }
+        next.push({
+          localId: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
+          name: f.name,
+          size: f.size,
+          mimeType: f.type || inferMimeFromExtension(f.name) || "application/octet-stream",
+          file: f,
+        });
+      }
+      return next;
+    });
+  }
+
+  async function uploadPending(): Promise<Array<{ storageKey: string; name: string; mimeType: string; sizeBytes: number }>> {
+    if (newFiles.length === 0) return [];
+    const res = await fetch("/api/assignments/files/upload-url", {
+      method: "POST",
+      headers: { "Content-Type": "application/json" },
+      body: JSON.stringify({
+        kind: "attachment",
+        teachingContextId,
+        files: newFiles.map((f) => ({ name: f.name, mimeType: f.mimeType, sizeBytes: f.size })),
+      }),
+    });
+    const data = await res.json().catch(() => null);
+    if (!res.ok || !data?.uploads) {
+      throw new Error(data?.error ?? "Gagal menyiapkan unggahan lampiran.");
+    }
+    const uploaded: Array<{ storageKey: string; name: string; mimeType: string; sizeBytes: number }> = [];
+    for (let i = 0; i < newFiles.length; i++) {
+      const item = newFiles[i];
+      const up = data.uploads[i];
+      await new Promise<void>((resolve, reject) => {
+        const xhr = new XMLHttpRequest();
+        xhr.open("POST", up.uploadUrl);
+        xhr.timeout = 60_000;
+        xhr.onload = () =>
+          xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload gagal (${xhr.status})`));
+        xhr.onerror = () => reject(new Error("Koneksi terputus"));
+        xhr.ontimeout = () => reject(new Error("Unggahan terlalu lama"));
+        const fd = new FormData();
+        for (const [k, v] of Object.entries(up.fields as Record<string, string>)) fd.append(k, v);
+        fd.append("file", item.file);
+        xhr.send(fd);
+      });
+      uploaded.push({ storageKey: up.storageKey, name: item.name, mimeType: item.mimeType, sizeBytes: item.size });
+    }
+    return uploaded;
+  }
 
   const handleCreate = async () => {
     if (!title.trim()) {
@@ -46,26 +118,33 @@ export default function TugasClient({ teachingContextId, initialAssignments, ses
 
     try {
       setLoading(true);
+      if (newFiles.length > 0) setUploading(true);
+      const files = await uploadPending();
       const newAssignment = await createAssignment({
         teachingContextId,
         title,
         description,
         dueDate: dueDateStr ? new Date(dueDateStr) : undefined,
         teachingSessionId: sessionId !== "none" ? sessionId : undefined,
+        files,
       });
 
       setAssignments([newAssignment, ...assignments]);
-      toast.success("Tugas berhasil ditambahkan");
+      toast.success("Tugas berhasil ditambahkan", {
+        description: files.length > 0 ? `Dengan ${files.length} lampiran.` : undefined,
+      });
       
       // reset
       setTitle("");
       setDescription("");
       setDueDateStr("");
       setSessionId("none");
+      setNewFiles([]);
     } catch (e: unknown) {
       toast.error(e instanceof Error ? e.message : "Gagal membuat tugas");
     } finally {
       setLoading(false);
+      setUploading(false);
     }
   };
 
@@ -106,8 +185,49 @@ export default function TugasClient({ teachingContextId, initialAssignments, ses
           </Select>
         </div>
 
-        <Button onClick={handleCreate} disabled={loading} className="w-full">
-          Tambah Tugas
+        {newFiles.length > 0 && (
+          <div className="space-y-1.5">
+            {newFiles.map((f) => (
+              <div key={f.localId} className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50/50 px-2.5 py-1.5">
+                <FileIcon className="w-3.5 h-3.5 text-teal-600 shrink-0" />
+                <span className="flex-1 min-w-0 truncate text-xs font-medium">
+                  {f.name}{" "}
+                  <span className="text-muted-foreground font-normal">
+                    ({f.size >= 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`})
+                  </span>
+                </span>
+                <button
+                  onClick={() => setNewFiles(newFiles.filter((x) => x.localId !== f.localId))}
+                  aria-label={`Hapus ${f.name}`}
+                  className="text-muted-foreground hover:text-rose-500"
+                >
+                  <Trash2 className="w-3.5 h-3.5" />
+                </button>
+              </div>
+            ))}
+          </div>
+        )}
+
+        <div className="space-y-2">
+          <Label>Lampiran — soal/LKPD (opsional)</Label>
+          <label className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:border-teal-400 hover:text-teal-700">
+            <Upload className="w-4 h-4" />
+            Pilih file (maks {MAX_FILES} × 25 MB)
+            <input
+              type="file"
+              multiple
+              className="hidden"
+              onChange={(e) => {
+                addFiles(e.target.files);
+                e.target.value = "";
+              }}
+            />
+          </label>
+        </div>
+
+        <Button onClick={handleCreate} disabled={loading || uploading} className="w-full">
+          {loading || uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
+          {uploading ? "Mengunggah lampiran…" : "Tambah Tugas"}
         </Button>
       </div>
 
@@ -132,18 +252,26 @@ export default function TugasClient({ teachingContextId, initialAssignments, ses
                       Tenggat: {format(new Date(assignment.dueDate), "dd MMM yyyy", { locale: id })}
                     </p>
                   )}
-                  <Link
-                    href={`/kelas/${teachingContextId}/tugas/${assignment.id}`}
-                    className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline"
-                  >
-                    <ClipboardCheck className="w-4 h-4" />
-                    Antrean koreksi
-                    {(assignment.pendingSubmissions ?? 0) > 0 && (
-                      <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200">
-                        {assignment.pendingSubmissions}
-                      </span>
-                    )}
-                  </Link>
+                  <div className="mt-2 flex flex-col sm:items-end gap-1.5">
+                    <Link
+                      href={`/kelas/${teachingContextId}/tugas/${assignment.id}`}
+                      className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800 hover:underline"
+                    >
+                      <ClipboardCheck className="w-4 h-4" />
+                      Antrean koreksi
+                      {(assignment.pendingSubmissions ?? 0) > 0 && (
+                        <span className="ml-0.5 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200">
+                          {assignment.pendingSubmissions}
+                        </span>
+                      )}
+                    </Link>
+                    <AssignmentAttachmentsDialog
+                      teachingContextId={teachingContextId}
+                      assignmentId={assignment.id}
+                      assignmentTitle={assignment.title}
+                      initialAttachments={assignment.attachments ?? []}
+                    />
+                  </div>
                 </div>
               </div>
             ))
diff --git a/src/app/(dashboard)/kelas/[teachingContextId]/tugas/page.tsx b/src/app/(dashboard)/kelas/[teachingContextId]/tugas/page.tsx
index 0ca8fe0..1b9fe40 100644
--- a/src/app/(dashboard)/kelas/[teachingContextId]/tugas/page.tsx
+++ b/src/app/(dashboard)/kelas/[teachingContextId]/tugas/page.tsx
@@ -1,5 +1,6 @@
 import { prisma } from "@/lib/auth";
 import { verifyTeachingContextAccess } from "@/lib/authorization";
+import { toAssignmentAttachmentView } from "@/modules/assignments/assignment.actions";
 import TugasClient from "./TugasClient";
 
 export default async function TugasPage({ params }: { params: Promise<{ teachingContextId: string }> }) {
@@ -11,6 +12,7 @@ export default async function TugasPage({ params }: { params: Promise<{ teaching
     orderBy: { createdAt: "desc" },
     include: {
       teachingSession: true,
+      attachments: { orderBy: { createdAt: "asc" } },
       _count: {
         select: { submissions: { where: { status: "SUBMITTED" } } },
       },
@@ -35,6 +37,7 @@ export default async function TugasPage({ params }: { params: Promise<{ teaching
         teachingContextId={teachingContextId} 
         initialAssignments={assignments.map((a) => ({
           ...a,
+          attachments: a.attachments.map(toAssignmentAttachmentView),
           pendingSubmissions: a._count.submissions,
         }))} 
         sessions={sessions}
diff --git a/src/app/api/assignments/attachments/[fileId]/route.ts b/src/app/api/assignments/attachments/[fileId]/route.ts
new file mode 100644
index 0000000..a00268b
--- /dev/null
+++ b/src/app/api/assignments/attachments/[fileId]/route.ts
@@ -0,0 +1,101 @@
+import { NextRequest, NextResponse } from "next/server";
+import { prisma } from "@/lib/auth";
+import { verifyStudentSession } from "@/modules/student-auth/student-session";
+import { verifyTeachingContextAccess } from "@/lib/authorization";
+import { isPreviewable } from "@/modules/storage/file-validation";
+import {
+  StorageNotConfiguredError,
+  headObjectSize,
+  presignDownload,
+} from "@/modules/storage/storage.service";
+
+/**
+ * Story 2 — pintu akses LAMPIRAN tugas (K6/K8): row → assignment →
+ * teachingContext. Guru pemilik konteks ATAU siswa dengan membership aktif
+ * di rombel+periode tugas itu. Semua kegagalan akses = 404 generik;
+ * HEAD pre-check untuk error ramah; inline hanya tipe previewable.
+ */
+
+function notFound(message = "Lampiran tidak ditemukan.") {
+  return NextResponse.json({ error: message }, { status: 404 });
+}
+
+export async function GET(
+  request: NextRequest,
+  { params }: { params: Promise<{ fileId: string }> }
+) {
+  let fileId = "";
+  try {
+    const resolved = await params;
+    fileId = resolved.fileId;
+    if (!fileId) return notFound();
+
+    const file = await prisma.assignmentAttachment.findUnique({
+      where: { id: fileId },
+      include: {
+        assignment: {
+          select: {
+            teachingContextId: true,
+            teachingContext: {
+              select: { classId: true, academicPeriodId: true },
+            },
+          },
+        },
+      },
+    });
+
+    if (!file) return notFound();
+
+    const ctx = file.assignment.teachingContext;
+    let authorized = false;
+
+    // Jalur 1: guru pemilik teaching context
+    try {
+      await verifyTeachingContextAccess(file.assignment.teachingContextId);
+      authorized = true;
+    } catch {
+      authorized = false;
+    }
+
+    // Jalur 2: siswa dengan membership AKTIF di rombel+periode tugas ini
+    if (!authorized) {
+      const studentSession = await verifyStudentSession();
+      if (studentSession) {
+        const membership = await prisma.classStudent.findFirst({
+          where: {
+            studentId: studentSession.studentId,
+            classId: ctx.classId,
+            academicPeriodId: ctx.academicPeriodId,
+            academicPeriod: { status: "ACTIVE" },
+          },
+          select: { id: true },
+        });
+        authorized = Boolean(membership);
+      }
+    }
+
+    if (!authorized) return notFound();
+
+    const objectSize = await headObjectSize(file.storageKey);
+    if (objectSize == null) {
+      return notFound("Lampiran tidak lagi tersedia di penyimpanan.");
+    }
+
+    const requestedInline = request.nextUrl.searchParams.get("disposition") === "inline";
+    const disposition =
+      requestedInline && isPreviewable(file.mimeType) ? "inline" : "attachment";
+
+    const { url } = await presignDownload(file.storageKey, {
+      filename: file.originalName,
+      disposition,
+    });
+
+    return NextResponse.redirect(url, 302);
+  } catch (err) {
+    if (err instanceof StorageNotConfiguredError) {
+      return NextResponse.json({ error: err.message }, { status: 503 });
+    }
+    console.error("[assignment attachment route]", fileId, err);
+    return NextResponse.json({ error: "Gagal mengakses lampiran." }, { status: 500 });
+  }
+}
diff --git a/src/app/api/assignments/files/upload-url/route.ts b/src/app/api/assignments/files/upload-url/route.ts
index 328aa40..7e4c950 100644
--- a/src/app/api/assignments/files/upload-url/route.ts
+++ b/src/app/api/assignments/files/upload-url/route.ts
@@ -1,6 +1,7 @@
 import { NextRequest, NextResponse } from "next/server";
 import { prisma } from "@/lib/auth";
 import { verifyStudentSession } from "@/modules/student-auth/student-session";
+import { verifyTeachingContextAccess } from "@/lib/authorization";
 import { validateFileList } from "@/modules/storage/file-validation";
 import {
   StorageNotConfiguredError,
@@ -10,9 +11,9 @@ import {
 } from "@/modules/storage/storage.service";
 
 /**
- * Story 1 — minta presigned POST untuk upload file jawaban.
- * Browser siswa mengunggah LANGSUNG ke storage; byte tidak lewat sini.
- * Guard: sesi siswa valid + tugas ACTIVE milik rombel periode aktif siswa.
+ * Story 1 — minta presigned POST untuk upload file jawaban SISWA.
+ * Story 2 — + kind=attachment untuk LAMPIRAN GURU (guard: guru pemilik konteks).
+ * Browser mengunggah LANGSUNG ke storage; byte tidak lewat sini.
  */
 
 function validateSameOrigin(request: NextRequest): boolean {
@@ -47,16 +48,11 @@ export async function POST(request: NextRequest) {
   }
 
   try {
-    const session = await verifyStudentSession();
-    if (!session) {
-      return NextResponse.json({ error: "Sesi tidak valid atau telah berakhir." }, { status: 401 });
-    }
-
     const body = await request.json().catch(() => null);
-    const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
+    const kind = body?.kind === "attachment" ? "attachment" : "submission";
     const rawFiles = Array.isArray(body?.files) ? body.files : null;
 
-    if (!assignmentId || !rawFiles) {
+    if (!rawFiles) {
       return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
     }
 
@@ -65,6 +61,46 @@ export async function POST(request: NextRequest) {
       return NextResponse.json({ error: validation.error }, { status: 400 });
     }
 
+    let uploads = [];
+
+    if (kind === "attachment") {
+      // ── Story 2: guru pemilik konteks — sesi siswa ditolak eksplisit ──
+      const studentSession = await verifyStudentSession();
+      if (studentSession) {
+        return NextResponse.json(
+          { error: "Hanya guru pemilik kelas yang dapat mengunggah lampiran." },
+          { status: 403 }
+        );
+      }
+      const teachingContextId =
+        typeof body?.teachingContextId === "string" ? body.teachingContextId : "";
+      if (!teachingContextId) {
+        return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
+      }
+      try {
+        await verifyTeachingContextAccess(teachingContextId);
+      } catch {
+        // Konteks tak ditemukan / bukan milik guru — jangan bocorkan mana
+        return NextResponse.json({ error: "Kelas tidak tersedia." }, { status: 404 });
+      }
+      for (const f of validation.files) {
+        const storageKey = buildTmpStorageKey(f.name, "attachment");
+        uploads.push(await presignSubmissionUpload(storageKey, f.mimeType));
+      }
+      return NextResponse.json({ uploads });
+    }
+
+    // ── Story 1: siswa — tugas ACTIVE milik rombel periode aktifnya ──
+    const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
+    if (!assignmentId) {
+      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
+    }
+
+    const session = await verifyStudentSession();
+    if (!session) {
+      return NextResponse.json({ error: "Sesi tidak valid atau telah berakhir." }, { status: 401 });
+    }
+
     const student = await prisma.student.findUnique({
       where: { id: session.studentId },
       include: {
@@ -104,9 +140,8 @@ export async function POST(request: NextRequest) {
       return NextResponse.json({ error: "Tugas tidak tersedia." }, { status: 404 });
     }
 
-    const uploads = [];
     for (const f of validation.files) {
-      const storageKey = buildTmpStorageKey(f.name);
+      const storageKey = buildTmpStorageKey(f.name, "submission");
       uploads.push(await presignSubmissionUpload(storageKey, f.mimeType));
     }
 
diff --git a/src/app/siswa/portal/tugas/page.tsx b/src/app/siswa/portal/tugas/page.tsx
index e156a8a..9974a5f 100644
--- a/src/app/siswa/portal/tugas/page.tsx
+++ b/src/app/siswa/portal/tugas/page.tsx
@@ -1,7 +1,7 @@
 import React from "react";
 import { verifyStudentSession } from "@/modules/student-auth/student-session";
 import { prisma } from "@/lib/auth";
-import { ClipboardList, Clock, BookOpen, AlertCircle } from "lucide-react";
+import { ClipboardList, Clock, BookOpen, AlertCircle, FileText } from "lucide-react";
 import { SubmitAssignmentForm } from "@/modules/student-portal/components/SubmitAssignmentForm";
 import { isSubmissionLate, isPreviewable, type StudentSubmissionView } from "@/modules/assignments/submission.service";
 
@@ -36,6 +36,7 @@ export default async function StudentAssignmentsPage() {
         status: "ACTIVE",
       },
       include: {
+        attachments: { orderBy: { createdAt: "asc" } },
         teachingContext: {
           include: {
             subject: { select: { name: true } },
@@ -107,6 +108,33 @@ export default async function StudentAssignmentsPage() {
                   {item.description}
                 </p>
               )}
+              {(item.attachments?.length ?? 0) > 0 && (
+                <div className="flex flex-wrap gap-1.5">
+                  <span className="text-[9px] font-bold uppercase text-slate-400 self-center">Lampiran:</span>
+                  {item.attachments.map(
+                    (att: { id: string; originalName: string; mimeType: string; sizeBytes: number }) => {
+                      const previewable = isPreviewable(att.mimeType);
+                      return (
+                        <a
+                          key={att.id}
+                          href={`/api/assignments/attachments/${att.id}${previewable ? "?disposition=inline" : ""}`}
+                          target="_blank"
+                          rel="noopener noreferrer"
+                          className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50/60 px-2 py-1 text-[10px] font-semibold text-teal-800 hover:bg-teal-100"
+                        >
+                          <FileText className="w-3 h-3" />
+                          {att.originalName}
+                          <span className="font-normal text-slate-400">
+                            {att.sizeBytes >= 1024 * 1024
+                              ? `${(att.sizeBytes / 1024 / 1024).toFixed(1)} MB`
+                              : `${Math.max(1, Math.round(att.sizeBytes / 1024))} KB`}
+                          </span>
+                        </a>
+                      );
+                    }
+                  )}
+                </div>
+              )}
               <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
                 <span>Guru: {item.teachingContext.teacherProfile.user.name}</span>
               </div>
diff --git a/src/modules/assignments/__tests__/story2-attachments.int.test.ts b/src/modules/assignments/__tests__/story2-attachments.int.test.ts
new file mode 100644
index 0000000..ca22eae
--- /dev/null
+++ b/src/modules/assignments/__tests__/story2-attachments.int.test.ts
@@ -0,0 +1,404 @@
+import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
+
+/**
+ * Story 2 (lampiran guru) — int test real-DB: createAssignment dgn file,
+ * setAssignmentAttachmentsAction replace/remove + hapus objek, akses route
+ * (siswa rombel benar 302 / rombel lain 404 / guru asing 404), presign
+ * kind=attachment (guru vs sesi siswa 403), guard >5 gabungan, duplikat key,
+ * mati anggun tanpa S3. Storage S3 & otorisasi di-mock — DB nyata (pola story-1).
+ */
+
+let currentCookieValue: string | null = null;
+const mockCookieStore = {
+  get: vi.fn((name: string) =>
+    name === "klassa_student_session" && currentCookieValue
+      ? { name, value: currentCookieValue }
+      : undefined
+  ),
+  set: vi.fn(),
+  delete: vi.fn(),
+};
+
+vi.mock("next/headers", () => ({
+  cookies: vi.fn(async () => mockCookieStore),
+}));
+
+vi.mock("next/cache", () => ({
+  revalidatePath: vi.fn(),
+}));
+
+vi.mock("@/modules/storage/storage.service", async (importOriginal) => {
+  const actual = await importOriginal<typeof import("@/modules/storage/storage.service")>();
+  return {
+    ...actual,
+    isStorageConfigured: vi.fn(() => true),
+    headObjectSize: vi.fn(),
+    deleteObjects: vi.fn(async (_keys: string[]) => {}),
+    presignDownload: vi.fn(async () => ({ url: "https://storage.example/signed" })),
+    presignSubmissionUpload: vi.fn(async (storageKey: string, mimeType: string) => ({
+      storageKey,
+      uploadUrl: "https://storage.example/upload",
+      fields: { "Content-Type": mimeType },
+    })),
+  };
+});
+
+// verifyTeachingContextAccess default: pemilik sah (guru fixture) — test asing men-override
+vi.mock("@/lib/authorization", () => ({
+  verifyTeachingContextAccess: vi.fn(),
+}));
+
+import { prisma } from "@/lib/auth";
+import { hashPin } from "@/lib/student-pin";
+import { signStudentSessionToken } from "@/modules/student-auth/student-session";
+import {
+  createAssignment,
+  setAssignmentAttachmentsAction,
+  getAssignmentAttachmentsAction,
+} from "../../assignments/assignment.actions";
+import { headObjectSize, deleteObjects, isStorageConfigured } from "@/modules/storage/storage.service";
+import { verifyTeachingContextAccess } from "@/lib/authorization";
+import { GET as attachmentGET } from "@/app/api/assignments/attachments/[fileId]/route";
+import { POST as uploadUrlPOST } from "@/app/api/assignments/files/upload-url/route";
+import { NextRequest } from "next/server";
+
+const mockedHead = vi.mocked(headObjectSize);
+const mockedDelete = vi.mocked(deleteObjects);
+const mockedIsStorageConfigured = vi.mocked(isStorageConfigured);
+const mockedVerifyContext = vi.mocked(verifyTeachingContextAccess);
+
+const KEY_A = "attachments/tmp/0e5e1e96-9bd6-4a8e-a108-4b0e7dd41111.pdf";
+const KEY_B = "attachments/tmp/1f5e1e96-9bd6-4a8e-a108-4b0e7dd42222.jpg";
+const KEY_C = "attachments/tmp/2f5e1e96-9bd6-4a8e-a108-4b0e7dd43333.docx";
+const FILE_A = { storageKey: KEY_A, name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 2048 };
+const FILE_B = { storageKey: KEY_B, name: "lkpd.jpg", mimeType: "image/jpeg", sizeBytes: 1024 };
+const FILE_C = { storageKey: KEY_C, name: "bacaan.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 8192 };
+
+function attachmentRequest(fileId: string, disposition?: string) {
+  const url = new URL(`http://localhost:3000/api/assignments/attachments/${fileId}`);
+  if (disposition) url.searchParams.set("disposition", disposition);
+  return new NextRequest(url);
+}
+function uploadUrlRequest(body: unknown) {
+  return new NextRequest("http://localhost:3000/api/assignments/files/upload-url", {
+    method: "POST",
+    headers: { "Content-Type": "application/json" },
+    body: JSON.stringify(body),
+  });
+}
+
+describe("Story 2 Lampiran Guru — Real-DB Integration", { timeout: 60_000 }, () => {
+  let dbAvailable = false;
+  const timestamp = Date.now();
+
+  let schoolId: string;
+  let teachingContextId: string;
+  let otherContextId: string;
+  let studentId: string;
+  let rombelStudentToken: string;
+  let otherRombelStudentToken: string;
+  let assignmentId: string;
+  let attachmentIdA: string;
+
+  beforeAll(async () => {
+    try {
+      const school = await prisma.school.create({
+        data: {
+          name: `Sekolah AttStory2 ${timestamp}`,
+          normalizedName: `sekolah attstory2 ${timestamp}`,
+          npsn: `NPAT${timestamp.toString().slice(-5)}`,
+        },
+      });
+      schoolId = school.id;
+
+      const ap = await prisma.academicPeriod.create({
+        data: { schoolId, year: "2026/2027", semester: "Ganjil", status: "ACTIVE" },
+      });
+      const subject = await prisma.subject.create({ data: { name: `Matematika ${timestamp}`, schoolId } });
+
+      const tu = `teacher-att2-${timestamp}`;
+      await prisma.user.create({
+        data: { id: tu, email: `${tu}@test.com`, name: "Guru Att2", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
+      });
+      const tp = await prisma.teacherProfile.create({
+        data: { userId: tu, activeSchoolId: schoolId, onboardingCompleted: true },
+      });
+
+      const mkClass = async (name: string, joinCode: string) =>
+        prisma.class.create({ data: { schoolId, name, gradeLevel: "8", joinCode } });
+
+      const cls = await mkClass("8-ATT", `AT2${timestamp.toString().slice(-4)}`);
+      const otherCls = await mkClass("8-ATX", `ATX${timestamp.toString().slice(-4)}`);
+
+      const tc = await prisma.teachingContext.create({
+        data: { teacherProfileId: tp.id, schoolId, academicPeriodId: ap.id, subjectId: subject.id, classId: cls.id },
+      });
+      teachingContextId = tc.id;
+
+      // Default: verifyTeachingContextAccess sukses (guru pemilik fixture) —
+      // actions memakai auth.context.id untuk revalidatePath
+      mockedVerifyContext.mockReset().mockImplementation(async () => ({
+        context: { id: tc.id },
+      } as never));
+      const otherTc = await prisma.teachingContext.create({
+        data: { teacherProfileId: tp.id, schoolId, academicPeriodId: ap.id, subjectId: subject.id, classId: otherCls.id },
+      });
+      otherContextId = otherTc.id;
+
+      const mkStudent = async (fullName: string, nis: string, classId: string) => {
+        const s = await prisma.student.create({
+          data: {
+            schoolId,
+            fullName,
+            nis,
+            accessPinHash: await hashPin("1234"),
+            accountStatus: "ACTIVE",
+            status: "ACTIVE",
+            pinUpdatedAt: new Date(),
+          },
+        });
+        await prisma.classStudent.create({ data: { studentId: s.id, classId, academicPeriodId: ap.id } });
+        return s;
+      };
+
+      const s1 = await mkStudent("Siswa Rombel Benar", `NISAT1${timestamp.toString().slice(-5)}`, cls.id);
+      studentId = s1.id;
+      const s2 = await mkStudent("Siswa Rombel Lain", `NISAT2${timestamp.toString().slice(-5)}`, otherCls.id);
+
+      const signToken = (s: typeof s1, classId: string) =>
+        signStudentSessionToken({
+          studentId: s.id,
+          schoolId,
+          classId,
+          academicPeriodId: ap.id,
+          nis: s.nis!,
+          fullName: s.fullName,
+          pinUpdatedAt: s.pinUpdatedAt!.toISOString(),
+        });
+      // token untuk siswa rombel LAIN (untuk uji 404) — disimpan sbg currentCookie saat tes
+      otherRombelStudentToken = signToken(s2, otherCls.id);
+      rombelStudentToken = signToken(s1, cls.id);
+
+      // Default verifyTeachingContextAccess di-set setelah fixture (lihat atas)
+      mockedHead.mockReset().mockImplementation(async (key: string) =>
+        key === KEY_A ? FILE_A.sizeBytes : key === KEY_B ? FILE_B.sizeBytes : key === KEY_C ? FILE_C.sizeBytes : key?.startsWith("attachments/tmp/") ? 1024 : null
+      );
+
+      dbAvailable = true;
+    } catch (err) {
+      console.warn("Real database not reachable, skipping live DB tests:", err);
+      dbAvailable = false;
+    }
+  });
+
+  afterAll(async () => {
+    if (dbAvailable) {
+      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
+    }
+  });
+
+  it("HAPPY: createAssignment dengan 2 lampiran → row + view isPreviewable", async () => {
+    if (!dbAvailable) return;
+    const assignment = await createAssignment({
+      teachingContextId,
+      title: "Tugas Berlampiran",
+      description: "Kerjakan LKPD terlampir",
+      files: [FILE_A, FILE_B],
+    });
+    assignmentId = assignment.id;
+    expect(assignment.attachments).toHaveLength(2);
+    expect(assignment.attachments[0]).toMatchObject({
+      originalName: "soal.pdf",
+      isPreviewable: true,
+    });
+
+    const rows = await prisma.assignmentAttachment.findMany({ where: { assignmentId } });
+    expect(rows.map((r) => r.storageKey).sort()).toEqual([KEY_A, KEY_B].sort());
+    attachmentIdA = rows.find((r) => r.storageKey === KEY_A)!.id;
+  });
+
+  it("K8: setelah ada submission, guru masih bisa mengubah lampiran", async () => {
+    if (!dbAvailable) return;
+    // Simulasikan siswa sudah mengumpulkan
+    await prisma.assignmentSubmission.create({
+      data: { assignmentId, studentId, status: "SUBMITTED", textContent: "sudah dikerjakan" },
+    });
+
+    const res = await setAssignmentAttachmentsAction({
+      teachingContextId,
+      assignmentId,
+      keepFileIds: [attachmentIdA],
+      newFiles: [FILE_C],
+    });
+    expect(res.success).toBe(true);
+    expect(res.attachments).toHaveLength(2);
+
+    const rows = await prisma.assignmentAttachment.findMany({ where: { assignmentId } });
+    expect(rows).toHaveLength(2);
+    // KEY_B (lkpd.jpg) dihapus dari storage
+    expect(mockedDelete).toHaveBeenCalled();
+    const deleted = mockedDelete.mock.calls.flat(2);
+    expect(deleted).toContain(KEY_B);
+    expect(deleted).not.toContain(KEY_A);
+  });
+
+  it("GUARD: kept + baru > 5 → ditolak server", async () => {
+    if (!dbAvailable) return;
+    const res = await setAssignmentAttachmentsAction({
+      teachingContextId,
+      assignmentId,
+      keepFileIds: [attachmentIdA],
+      newFiles: [FILE_B, FILE_C, { ...FILE_B, storageKey: "attachments/tmp/3f5e1e96-9bd6-4a8e-a108-4b0e7dd44444.jpg", sizeBytes: 1024 }, { ...FILE_C, storageKey: "attachments/tmp/4f5e1e96-9bd6-4a8e-a108-4b0e7dd45555.docx", sizeBytes: 1024, name: "bacaan2.docx" }, { ...FILE_A, storageKey: "attachments/tmp/5f5e1e96-9bd6-4a8e-a108-4b0e7dd46666.pdf", sizeBytes: 1024, name: "tambahan.pdf" }],
+    });
+    expect(res.success).toBe(false);
+    if (!res.success) expect(res.error).toContain("Maksimal 5");
+  });
+
+  it("GUARD: duplikat storageKey & key liar → ditolak", async () => {
+    if (!dbAvailable) return;
+    const dup = await setAssignmentAttachmentsAction({
+      teachingContextId,
+      assignmentId,
+      keepFileIds: [],
+      newFiles: [FILE_A, { ...FILE_A, name: "duplikat.pdf" }],
+    });
+    expect(dup.success).toBe(false);
+    if (!dup.success) expect(dup.error).toContain("duplikasi");
+
+    const liar = await setAssignmentAttachmentsAction({
+      teachingContextId,
+      assignmentId,
+      keepFileIds: [],
+      newFiles: [{ ...FILE_A, storageKey: "submissions/tmp/0e5e1e96-9bd6-4a8e-a108-4b0e7dd41111.pdf" }],
+    });
+    expect(liar.success).toBe(false);
+    if (!liar.success) expect(liar.error).toContain("belum terunggah");
+  });
+
+  it("getAssignmentAttachmentsAction: daftar utk guru", async () => {
+    if (!dbAvailable) return;
+    const list = await getAssignmentAttachmentsAction(teachingContextId, assignmentId);
+    expect(list.length).toBeGreaterThanOrEqual(1);
+    expect(list[0].originalName).toBeTruthy();
+  });
+
+  it("ROUTE: siswa rombel tugas → 302; siswa rombel lain → 404", async () => {
+    if (!dbAvailable) return;
+    // Ambil id lampiran terkini
+    const rows = await prisma.assignmentAttachment.findMany({ where: { assignmentId } });
+    const target = rows[0];
+
+    // Rombel benar: token siswa s1 (member 8-ATT) → 302
+    currentCookieValue = rombelStudentToken;
+    mockedVerifyContext.mockReset().mockImplementation(() => {
+      throw new Error("Forbidden: You do not own this teaching context");
+    });
+    mockedHead.mockReset().mockResolvedValue(2048);
+    const res302siswa = await attachmentGET(attachmentRequest(target.id), {
+      params: Promise.resolve({ fileId: target.id }),
+    });
+    expect(res302siswa.status).toBe(302);
+
+    // Rombel lain → 404
+    currentCookieValue = otherRombelStudentToken;
+    const res404 = await attachmentGET(attachmentRequest(target.id), {
+      params: Promise.resolve({ fileId: target.id }),
+    });
+    expect(res404.status).toBe(404);
+
+    // Guru pemilik → 302
+    currentCookieValue = null;
+    mockedVerifyContext.mockReset().mockResolvedValue({} as never);
+    const res302 = await attachmentGET(attachmentRequest(target.id, "inline"), {
+      params: Promise.resolve({ fileId: target.id }),
+    });
+    expect(res302.status).toBe(302);
+  });
+
+  it("ROUTE: objek hilang → 404 ramah", async () => {
+    if (!dbAvailable) return;
+    mockedVerifyContext.mockReset().mockResolvedValue({} as never);
+    mockedHead.mockReset().mockResolvedValue(null);
+    const res = await attachmentGET(attachmentRequest(attachmentIdA), {
+      params: Promise.resolve({ fileId: attachmentIdA }),
+    });
+    expect(res.status).toBe(404);
+    const body = await res.json();
+    expect(body.error).toContain("tidak lagi tersedia");
+  });
+
+  it("PRESIGN: sesi siswa minta kind=attachment → 403", async () => {
+    if (!dbAvailable) return;
+    currentCookieValue = otherRombelStudentToken; // sesi siswa apa pun ditolak
+    mockedVerifyContext.mockReset().mockResolvedValue({} as never);
+    const res = await uploadUrlPOST(
+      uploadUrlRequest({
+        kind: "attachment",
+        teachingContextId,
+        files: [{ name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 10 }],
+      })
+    );
+    expect(res.status).toBe(403);
+    currentCookieValue = null;
+  });
+
+  it("PRESIGN: guru pemilik kind=attachment → 200 prefix attachments/tmp", async () => {
+    if (!dbAvailable) return;
+    currentCookieValue = null; // tanpa sesi siswa → jatuh ke jalur guru (mock sukses)
+    mockedVerifyContext.mockReset().mockResolvedValue({} as never);
+    const res = await uploadUrlPOST(
+      uploadUrlRequest({
+        kind: "attachment",
+        teachingContextId,
+        files: [{ name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 10 }],
+      })
+    );
+    expect(res.status).toBe(200);
+    const data = await res.json();
+    expect(data.uploads[0].storageKey).toMatch(/^attachments\/tmp\//);
+  });
+
+  it("PRESIGN: guru asing (verify throw) → 404; context kosong → 400", async () => {
+    if (!dbAvailable) return;
+    currentCookieValue = null;
+    mockedVerifyContext.mockReset().mockImplementation(() => {
+      throw new Error("Forbidden");
+    });
+    const res404 = await uploadUrlPOST(
+      uploadUrlRequest({
+        kind: "attachment",
+        teachingContextId,
+        files: [{ name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 10 }],
+      })
+    );
+    expect(res404.status).toBe(404);
+
+    const res400 = await uploadUrlPOST(
+      uploadUrlRequest({
+        kind: "attachment",
+        files: [{ name: "soal.pdf", mimeType: "application/pdf", sizeBytes: 10 }],
+      })
+    );
+    expect(res400.status).toBe(400);
+  });
+
+  it("MATI ANGGERUN: S3 tak dikonfigurasi → claim tolak; create tanpa file tetap jalan", async () => {
+    if (!dbAvailable) return;
+    mockedVerifyContext.mockReset().mockImplementation(async () => ({
+      context: { id: teachingContextId },
+    } as never));
+    mockedIsStorageConfigured.mockReturnValue(false);
+    const withFiles = await setAssignmentAttachmentsAction({
+      teachingContextId,
+      assignmentId,
+      keepFileIds: [],
+      newFiles: [FILE_A],
+    });
+    expect(withFiles.success).toBe(false);
+    if (!withFiles.success) expect(withFiles.error).toContain("belum dikonfigurasi");
+
+    const plain = await createAssignment({ teachingContextId, title: "Tugas Tanpa Lampiran" });
+    expect(plain.id).toBeTruthy();
+    mockedIsStorageConfigured.mockReturnValue(true);
+  });
+});
diff --git a/src/modules/assignments/assignment.actions.ts b/src/modules/assignments/assignment.actions.ts
index 57bf85c..8fcdf29 100644
--- a/src/modules/assignments/assignment.actions.ts
+++ b/src/modules/assignments/assignment.actions.ts
@@ -10,6 +10,94 @@ import {
   isPreviewable,
   type TeacherQueueItem,
 } from "@/modules/assignments/submission.service";
+import { validateFileList, type FileMetaInput } from "@/modules/storage/file-validation";
+import {
+  headObjectSize,
+  deleteObjects,
+  isClaimableKey,
+  isStorageConfigured,
+} from "@/modules/storage/storage.service";
+
+/** Metadata lampiran guru yang diklaim — sudah terunggah via presign. */
+export interface AssignmentAttachmentInput extends FileMetaInput {
+  storageKey: string;
+}
+
+/** Bentuk tampilan lampiran untuk guru & portal siswa. */
+export interface AssignmentAttachmentView {
+  id: string;
+  originalName: string;
+  mimeType: string;
+  sizeBytes: number;
+  isPreviewable: boolean;
+}
+
+function toAttachmentView(f: {
+  id: string;
+  originalName: string;
+  mimeType: string;
+  sizeBytes: number;
+}): AssignmentAttachmentView {
+  return {
+    id: f.id,
+    originalName: f.originalName,
+    mimeType: f.mimeType,
+    sizeBytes: f.sizeBytes,
+    isPreviewable: isPreviewable(f.mimeType),
+  };
+}
+
+/** Mapper publik untuk page server-component yang memetakan row Prisma → view. */
+export function toAssignmentAttachmentView(row: {
+  id: string;
+  originalName: string;
+  mimeType: string;
+  sizeBytes: number;
+}): AssignmentAttachmentView {
+  return toAttachmentView(row);
+}
+
+/**
+ * Claim lampiran: validasi list + key claimable + HEAD-check ukuran.
+ * Dipakai createAssignment & setAssignmentAttachmentsAction (Story 2).
+ */
+async function claimAttachmentFiles(
+  files: AssignmentAttachmentInput[]
+): Promise<{ ok: true; rows: Array<{ storageKey: string; originalName: string; mimeType: string; sizeBytes: number }> } | { ok: false; error: string }> {
+  const validation = validateFileList(files);
+  if (!validation.ok) return validation;
+
+  if (files.length > 0 && !isStorageConfigured()) {
+    return { ok: false, error: "Penyimpanan file belum dikonfigurasi." };
+  }
+
+  const seen = new Set<string>();
+  const rows = [];
+  for (let i = 0; i < files.length; i++) {
+    const f = files[i];
+    if (seen.has(f.storageKey)) {
+      return { ok: false, error: "Terdapat duplikasi file dalam lampiran." };
+    }
+    seen.add(f.storageKey);
+    if (!isClaimableKey(f.storageKey, "attachment")) {
+      return { ok: false, error: `File "${validation.files[i].name}" belum terunggah dengan benar.` };
+    }
+    const actualSize = await headObjectSize(f.storageKey);
+    if (actualSize == null) {
+      return { ok: false, error: `File "${validation.files[i].name}" belum selesai terunggah — coba lagi.` };
+    }
+    if (actualSize !== f.sizeBytes || actualSize > 25 * 1024 * 1024) {
+      return { ok: false, error: `Ukuran file "${validation.files[i].name}" tidak sesuai.` };
+    }
+    rows.push({
+      storageKey: f.storageKey,
+      originalName: validation.files[i].name,
+      mimeType: validation.files[i].mimeType,
+      sizeBytes: validation.files[i].sizeBytes,
+    });
+  }
+  return { ok: true, rows };
+}
 
 function assertNotBanned(authContext: { isBanned?: boolean }) {
   if (authContext.isBanned) {
@@ -23,11 +111,23 @@ export async function createAssignment(data: {
   title: string;
   description?: string;
   dueDate?: Date;
+  files?: AssignmentAttachmentInput[];
 }) {
   const auth = await verifyTeachingContextAccess(data.teachingContextId);
   assertNotBanned(auth);
   const { context } = auth;
 
+  // Story 2 — claim lampiran SEBELUM tugas dibuat (gagal claim = gagal total,
+  // tidak meninggalkan tugas tanpa lampiran yang dijanjikan)
+  let attachmentRows: Array<{ storageKey: string; originalName: string; mimeType: string; sizeBytes: number }> = [];
+  if (data.files && data.files.length > 0) {
+    const claimed = await claimAttachmentFiles(data.files);
+    if (!claimed.ok) {
+      throw new Error(claimed.error);
+    }
+    attachmentRows = claimed.rows;
+  }
+
   if (data.teachingSessionId) {
     const session = await prisma.teachingSession.findUnique({
       where: { id: data.teachingSessionId },
@@ -50,7 +150,16 @@ export async function createAssignment(data: {
       description: data.description,
       dueDate: data.dueDate,
       status: "ACTIVE",
+      attachments: {
+        create: attachmentRows.map((f) => ({
+          storageKey: f.storageKey,
+          originalName: f.originalName,
+          mimeType: f.mimeType,
+          sizeBytes: f.sizeBytes,
+        })),
+      },
     },
+    include: { attachments: { orderBy: { createdAt: "asc" } } },
   });
 
   revalidatePath(`/kelas/${context.id}/tugas`);
@@ -58,7 +167,10 @@ export async function createAssignment(data: {
     revalidatePath(`/kelas/${context.id}/pertemuan/${data.teachingSessionId}`);
   }
 
-  return assignment;
+  return {
+    ...assignment,
+    attachments: assignment.attachments.map(toAttachmentView),
+  };
 }
 
 /**
@@ -521,3 +633,102 @@ export async function batchSaveDirectAssignmentScoresAction(data: {
     };
   }
 }
+
+/**
+ * Story 2 — kelola lampiran tugas kapan saja (K8: lampiran = instruksi,
+ * bukan data penilaian — bebas diubah walau sudah ada yang mengumpulkan).
+ * Pola keep+new Story 1: delete selektif (id stabil) + insert file baru;
+ * objek yang dilepas dihapus dari storage SETELAH commit (gagal = log saja).
+ */
+export async function setAssignmentAttachmentsAction(data: {
+  teachingContextId: string;
+  assignmentId: string;
+  keepFileIds: string[];
+  newFiles: AssignmentAttachmentInput[];
+}): Promise<{ success: boolean; error?: string; attachments?: AssignmentAttachmentView[] }> {
+  try {
+    await verifyTeachingContextAccess(data.teachingContextId);
+
+    const assignment = await prisma.assignment.findUnique({
+      where: { id: data.assignmentId },
+      select: { id: true, teachingContextId: true },
+    });
+    if (!assignment || assignment.teachingContextId !== data.teachingContextId) {
+      return { success: false, error: "Tugas tidak ditemukan." };
+    }
+
+    // Claim file baru SEBELUM mutasi DB
+    let newRows: Array<{ storageKey: string; originalName: string; mimeType: string; sizeBytes: number }> = [];
+    if (data.newFiles.length > 0) {
+      const claimed = await claimAttachmentFiles(data.newFiles);
+      if (!claimed.ok) return { success: false, error: claimed.error };
+      newRows = claimed.rows;
+    }
+
+    const current = await prisma.assignmentAttachment.findMany({
+      where: { assignmentId: data.assignmentId },
+    });
+    const keepIds = new Set(data.keepFileIds);
+    const keptRows = current.filter((f) => keepIds.has(f.id));
+    const removedRows = current.filter((f) => !keepIds.has(f.id));
+
+    // Guard jumlah GABUNGAN — maks 5 file per tugas (server-side)
+    if (keptRows.length + newRows.length > 5) {
+      return {
+        success: false,
+        error: `Maksimal 5 file per tugas (dipertahankan ${keptRows.length} + baru ${newRows.length}).`,
+      };
+    }
+
+    await prisma.$transaction([
+      prisma.assignmentAttachment.deleteMany({
+        where: { assignmentId: data.assignmentId, id: { notIn: keptRows.map((f) => f.id) } },
+      }),
+      prisma.assignmentAttachment.createMany({
+        data: newRows.map((f) => ({ ...f, assignmentId: data.assignmentId })),
+      }),
+    ]);
+
+    const removedKeys = removedRows.map((f) => f.storageKey);
+    if (removedKeys.length > 0) {
+      deleteObjects(removedKeys).catch((e) =>
+        console.error("[setAssignmentAttachmentsAction] gagal hapus objek:", e)
+      );
+    }
+
+    const final = await prisma.assignmentAttachment.findMany({
+      where: { assignmentId: data.assignmentId },
+      orderBy: { createdAt: "asc" },
+    });
+
+    revalidatePath(`/kelas/${data.teachingContextId}/tugas`);
+    revalidatePath("/siswa/portal/tugas");
+
+    return { success: true, attachments: final.map(toAttachmentView) };
+  } catch (err) {
+    console.error("[setAssignmentAttachmentsAction]", err);
+    return { success: false, error: "Gagal menyimpan lampiran. Coba lagi." };
+  }
+}
+
+/** Story 2 — daftar lampiran satu tugas (untuk dialog kelola guru). */
+export async function getAssignmentAttachmentsAction(
+  teachingContextId: string,
+  assignmentId: string
+): Promise<AssignmentAttachmentView[]> {
+  await verifyTeachingContextAccess(teachingContextId);
+
+  const assignment = await prisma.assignment.findUnique({
+    where: { id: assignmentId },
+    select: { id: true, teachingContextId: true },
+  });
+  if (!assignment || assignment.teachingContextId !== teachingContextId) {
+    throw new Error("Assignment not found");
+  }
+
+  const rows = await prisma.assignmentAttachment.findMany({
+    where: { assignmentId },
+    orderBy: { createdAt: "asc" },
+  });
+  return rows.map(toAttachmentView);
+}
diff --git a/src/modules/storage/__tests__/storage.service.test.ts b/src/modules/storage/__tests__/storage.service.test.ts
index 08a171b..b4190e5 100644
--- a/src/modules/storage/__tests__/storage.service.test.ts
+++ b/src/modules/storage/__tests__/storage.service.test.ts
@@ -32,6 +32,7 @@ import {
   buildTmpStorageKey,
   deleteObjects,
   isClaimableSubmissionKey,
+  isClaimableKey,
   isStorageConfigured,
   presignDownload,
   presignSubmissionUpload,
@@ -155,3 +156,19 @@ describe("Story 1 — key builder & claim guard (E12 sinkron)", () => {
     expect(isClaimableSubmissionKey("")).toBe(false);
   });
 });
+
+describe("Story 2 — key builder kind=attachment", () => {
+  it("prefix attachments/tmp & claimable untuk kind yang benar saja", () => {
+    const key = buildTmpStorageKey("soal.pdf", "attachment");
+    expect(key).toMatch(/^attachments\/tmp\/[0-9a-f-]{36}\.pdf$/);
+    expect(isClaimableKey(key, "attachment")).toBe(true);
+    // Key attachment TIDAK boleh diklaim sebagai submission (sekat kind)
+    expect(isClaimableKey(key, "submission")).toBe(false);
+    const subKey = buildTmpStorageKey("jawaban.jpg", "submission");
+    expect(isClaimableKey(subKey, "attachment")).toBe(false);
+  });
+
+  it("default kind tetap submission (back-compat Story 1)", () => {
+    expect(buildTmpStorageKey("a.jpg")).toMatch(/^submissions\/tmp\//);
+  });
+});
diff --git a/src/modules/storage/storage.service.ts b/src/modules/storage/storage.service.ts
index d1929d4..83b6c6b 100644
--- a/src/modules/storage/storage.service.ts
+++ b/src/modules/storage/storage.service.ts
@@ -26,7 +26,6 @@ export class StorageNotConfiguredError extends Error {
   }
 }
 
-const SUBMISSION_TMP_PREFIX = "submissions/tmp";
 
 export function isStorageConfigured(): boolean {
   return Boolean(
@@ -55,23 +54,37 @@ function requireEnv(): { bucket: string; client: S3Client } {
   return { bucket: process.env.S3_BUCKET as string, client: cachedClient };
 }
 
-/** Key sementara untuk upload siswa; dipin sebagai storageKey final saat submit. */
-export function buildTmpStorageKey(originalName: string): string {
-  // Ekstensi di-clamp 20 karakter — sinkron dengan regex isClaimableSubmissionKey
+const TMP_PREFIXES = {
+  submission: "submissions/tmp",
+  attachment: "attachments/tmp",
+} as const;
+
+export type StorageKind = keyof typeof TMP_PREFIXES;
+
+/** Key sementara untuk upload (siswa/guru); dipin sebagai storageKey final saat claim. */
+export function buildTmpStorageKey(
+  originalName: string,
+  kind: StorageKind = "submission"
+): string {
+  // Ekstensi di-clamp 20 karakter — sinkron dengan regex isClaimableKey
   const rawExt = getExtension(originalName).slice(0, 20);
   const ext = rawExt.replace(/[^a-z0-9]/g, "");
   const id = randomUUID();
-  return ext ? `${SUBMISSION_TMP_PREFIX}/${id}.${ext}` : `${SUBMISSION_TMP_PREFIX}/${id}`;
+  const prefix = TMP_PREFIXES[kind];
+  return ext ? `${prefix}/${id}.${ext}` : `${prefix}/${id}`;
 }
 
-/** Hanya key keluaran buildTmpStorageKey yang boleh diklaim submission. */
-export function isClaimableSubmissionKey(storageKey: string): boolean {
+/** Hanya key keluaran buildTmpStorageKey kind tsb yang boleh di-claim. */
+export function isClaimableKey(storageKey: string, kind: StorageKind = "submission"): boolean {
   return (
     typeof storageKey === "string" &&
-    new RegExp(`^${SUBMISSION_TMP_PREFIX}/[0-9a-f-]{36}(\\.[a-z0-9]{1,20})?$`).test(storageKey)
+    new RegExp(`^${TMP_PREFIXES[kind]}/[0-9a-f-]{36}(\\.[a-z0-9]{1,20})?$`).test(storageKey)
   );
 }
 
+/** Back-compat Story 1 — call-site eksplisit tetap jelas maknanya. */
+export const isClaimableSubmissionKey = (k: string) => isClaimableKey(k, "submission");
+
 export interface PresignedUpload {
   storageKey: string;
   uploadUrl: string;

===== END DIFF =====
