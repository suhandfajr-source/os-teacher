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
title: 'Story 1 — Siswa mengumpulkan tugas via file (upload S3-compatible)'
type: 'feature'
created: '2025-10-02'
status: 'in-review'
baseline_commit: '10011c207c430723b43bd000695a880b0e9bc5e4'
route: 'full'
review_loop_iteration: 0
context:
  - '{project-root}/docs/product/assignment-file-blueprint.md'
  - '{project-root}/src/modules/assignments/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Portal siswa hanya bisa mengumpulkan tugas via teks/link, padahal UI guru sudah menyuruh siswa "foto lembar jawaban dan upload ke portal siswa" — siswa terpaksa lewat layanan eksternal.

**Approach:** Tambah kanal ketiga pengumpulan — **file** (semua jenis kecuali program/makro, maks 25 MB × 5 file). File diunggah **langsung dari browser ke storage S3-compatible** (Cloudflare R2 sekarang; MinIO di server sendiri nanti) via presigned POST; metadata tersimpan di tabel `submission_file`; akses unduh/pratinjau hanya via route terautentikasi (siswa: miliknya sendiri; guru: rombelnya). Blueprint keputusan: `docs/product/assignment-file-blueprint.md`.

## Boundaries & Constraints

**Always:**
- Semua jenis file diterima KECUALI blocklist: `.exe .msi .bat .cmd .scr .apk .jar .docm .dotm .xlsm .hta` (cek ekstensi nama asli, case-insensitive)
- Maks 25 MB/file, maks 5 file per submission — divalidasi client DAN server; ukuran juga dipaksa oleh policy presigned POST (`content-length-range`)
- Upload via presigned POST browser→storage; **byte file tidak pernah lewat server Next.js**
- Unduh/pratinjau wajib lewat route terautentikasi → redirect 302 ke presigned GET umur pendek (±5 menit); tidak ada public URL
- Resubmit saat status SUBMITTED: objek storage file lama dihapus eksplisit, row diganti
- Teks/link tetap valid; minimal salah satu dari teks/link/file harus terisi
- Nama objek storage acak; `originalName` (disanitasi) hanya metadata tampilan

**Never:**
- Tidak mengubah alur review/REVIEWED yang ada (kunci tetap di `reviewSubmissionAction`)
- Tidak mengerjakan lampiran guru (Story 2, sudah dicatat di deferred-work.md)
- Tidak menyimpan file di filesystem lokal atau kolom DB
- Tidak menambah Vercel Blob / API penyimpanan proprietary
- Tanpa konfigurasi S3, fitur mati anggun dengan error jelas — tidak menjatuhkan submit teks/link yang lama

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Upload sukses | JPG 3 MB via presigned POST | Objek tersimpan di `submissions/tmp/{cuid}.jpg`; submit merelokasi & membuat row `SubmissionFile` | — |
| File terblokir | `virus.exe`, `makro.docm` | Ditolak di client (instan) DAN server route | 400 dengan pesan jenis file dilarang |
| Kebesaran | 30 MB | Ditolak client; policy POST menolak di storage | 400 + pesan maks 25 MB |
| Kelebihan jumlah | File ke-6 | Ditolak client & server | 400 + pesan maks 5 file |
| Resubmit | Ada 2 file lama, kirim 3 baru | Objek lama dihapus dari storage; row lama diganti | Kegagalan hapus objek dicatat log, row tetap diganti (orphan bukan kegagalan submit) |
| REVIEWED locked | Submission sudah dinilai | Tombol kirim nonaktif; action menolak | 400 "terkunci — sudah dinilai guru" |
| Unduh siswa lain | Siswa A minta file submission siswa B | 404 generik (tidak bocorkan keberadaan) | Tanpa detail |
| Guru beda rombel | Guru non-pemilik konteks akses file | 404 generik | Tanpa detail |
| S3 belum dikonfigurasi | Env `S3_*` kosong saat minta presign | 503 dengan pesan "penyimpanan belum dikonfigurasi" | Submit teks/link tetap jalan |
| File hilang di storage | Row ada, objek tidak (HEAD 404) | Pratinjau/unduh menampilkan error ramah | Tidak crash |
| Nama aneh | `../../etc/passwd` / 300 karakter / emoji | Disanitasi: strip path, buang karakter kontrol, potong 200 karakter | — |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — model `AssignmentSubmission` (L554–600): tambah relasi `files SubmissionFile[]` (Cascade); 2 model baru tapi Story 1 hanya `SubmissionFile`
- `src/modules/assignments/submission.service.ts` — murni tanpa DB; ekstensi `validateSubmissionInput` + tipe `SubmissionFileInput`/`SubmissionFileView` + `sanitizeOriginalName` + `isBlockedExtension` + `MAX_FILE_BYTES=25MB`, `MAX_FILES=5`
- `src/modules/student-portal/student-submission.actions.ts` — `submitAssignmentAction`: terima `files[]`, re-validasi, hapus objek lama, simpan row; `StudentSubmissionView` + `files`
- `src/modules/student-portal/components/SubmitAssignmentForm.tsx` — UI file input + progress + daftar file terkirim + state locked REVIEWED
- `src/app/siswa/portal/tugas/page.tsx` — L112 pass `submission.files` (tambah include `files` di query L40-an)
- `src/modules/assignments/assignment.actions.ts` — `getSubmissionQueueAction`: include `files`, map ke `TeacherQueueItem.files`
- `src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/AssignmentRosterGradingView.tsx` — tab ONLINE: tampilkan file (thumb gambar / unduh)
- `src/app/api/templates/docx/upload/route.ts` — POLA: `validateSameOrigin()` + content-length guard — tiru untuk route baru
- `src/lib/auth.ts` — export `prisma` (+ `auth` untuk session guru di route)
- `src/modules/student-auth/student-session.ts` — `verifyStudentSession()` untuk guard siswa
- `src/modules/student-portal/__tests__/submission.service.test.ts` — pola unit test service murni; `story-8-submission-materi.int.test.ts` — pola int test dengan mock `next/headers`
- `src/lib/authorization.ts` — `verifyTeachingContextAccess` (throw-based) untuk guard guru
- Baru: `src/modules/storage/storage.service.ts`, `src/modules/storage/file-validation.ts`, `src/app/api/assignments/files/upload-url/route.ts`, `src/app/api/assignments/files/[fileId]/route.ts`, `src/modules/storage/__tests__/file-validation.test.ts`
- Dep baru: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/s3-create-presigned-post`
- `PLAYBOOK-ROLLOVER-TA.md` — TIDAK menyentuh assignment/submission (cuma periode, roster, kuis) → tanpa konflik retensi; catat di Implementation Notes

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + migrasi `prisma migrate dev --name submission_file` — model `SubmissionFile` (submissionId FK Cascade, storageKey, originalName, mimeType, sizeBytes) — simpan metadata file
- [x] `src/modules/storage/file-validation.ts` — blocklist ekstensi, `MAX_FILE_BYTES`, `MAX_FILES`, `sanitizeOriginalName`, `isPreviewable` (image/* + application/pdf) — validasi single-source tanpa DB
- [x] `src/modules/storage/storage.service.ts` — klien S3 dari env (R2/MinIO via `S3_ENDPOINT`), `createPresignedPost` dengan `content-length-range`, `presignGet` (inline/attachment), `deleteObjects`, `headObject`; error jelas bila env kosong — adapter storage tunggal
- [x] `src/app/api/assignments/files/upload-url/route.ts` — POST JSON `{assignmentId, files:[{name,mimeType,size}]}`; guard: siswa valid + rombel aktif + tugas ACTIVE milik rombel (reuse logika cek di `student-submission.actions.ts`); balikin `[{storageKey, uploadUrl, fields}]`; same-origin guard — minta presign upload tanpa mengekspos kredensial
- [x] `src/app/api/assignments/files/[fileId]/route.ts` — GET `?disposition=inline|attachment`; cek row → `SubmissionFile` → submission → assignment → teachingContext; akses: siswa pemilik ATAU guru pemilik konteks (`verifyTeachingContextAccess`, tangkap throw → 404); 302 ke presigned GET — pintu tunggal akses file
- [x] `src/modules/assignments/submission.service.ts` — ekstensi tipe + `validateSubmissionInput` menerima `files` (validasi via file-validation; minimal teks/link/file terisi) — tetap murni unit-testable
- [x] `src/modules/student-portal/student-submission.actions.ts` — proses `files`: re-validasi server, HEAD-check size objek, transaksi upsert submission + replace rows `SubmissionFile`, hapus objek lama setelah commit — kebenaran data + kebersihan storage
- [x] `src/modules/student-portal/components/SubmitAssignmentForm.tsx` — file picker (accept semua, filter blocklist client-side), daftar file + ukuran, progress per-file, tampilan file terkirim, locked saat REVIEWED — UX siswa
- [x] `src/app/siswa/portal/tugas/page.tsx` — include `files` di query submission, pass ke form — data tersedia di UI
- [x] `src/modules/assignments/assignment.actions.ts` + `AssignmentRosterGradingView.tsx` — queue guru bawa `files`; tab ONLINE render pratinjau/unduh per file — guru bisa koreksi file
- [x] `.env.example` — blok `S3_ENDPOINT/S3_REGION/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY/S3_BUCKET` + komentar setup R2 & MinIO — onboarding storage
- [x] `src/modules/storage/__tests__/file-validation.test.ts` + ekstensi `submission.service.test.ts` — unit test matriks I/O (blocklist, size, jumlah, sanitasi nama, minimal satu kanal) — jaga regresi
- [ ] Int test `submitAssignmentAction` dengan files (mock storage service; pola story-8) — resubmit mengganti file, REVIEWED menolak — kebenaran alur

**Acceptance Criteria:**
- Given siswa aktif di rombel dengan tugas ACTIVE, when mengunggah JPG 3 MB lalu submit, then row `SubmissionFile` tersimpan dan objek berada di prefix final (bukan tmp)
- Given submission SUBMITTED berisi 2 file, when siswa resubmit dengan 3 file baru, then hanya 3 row/objek baru tersisa dan 2 objek lama terhapus dari storage
- Given siswa mencoba GET file submission siswa lain (beda fileId miliknya), when route diakses, then 404 tanpa kebocoran informasi
- Given env S3 kosong, when submit teks saja, then sukses seperti sebelumnya (fitur file menolak dengan 503 bila dipakai)
- Given file Word `.docx` terkirim, when guru membuka antrean koreksi, then file tampil sebagai tombol unduh bernama asli, bukan pratinjau inline
- Given file PDF terkirim, when pratinjau dibuka, then tampil inline via route terautentikasi (302 presigned, disposition inline)

## Implementation Notes

- Paket presigned-post ternyata bernama `@aws-sdk/s3-presigned-post` (bukan `s3-create-presigned-post` seperti draft Code Map) — sudah dikoreksi di package.json.
- Drift Prisma ditemukan saat migrasi: kolom `birthDate*` sudah ada di DB tapi migrasi 20260927 tak tercatat (dulu di-apply manual). Diselesaikan non-destruktif via `prisma migrate resolve --applied` — TANPA reset DB Neon.
- Perilaku keepFileIds: row file yang dipertahankan di-recreate (id baru) karena replace-all + createMany; identitas id file tidak stabil lintas resubmit — UI selalu baca ulang dari response, jadi aman.
- Playbook rollover TA (K10) TIDAK menyentuh assignment/submission — tidak ada konflik retensi; retensi file mengikuti umur assignment sebagaimana adanya.
- Audit matriks I/O: 2 baris awalnya tanpa test (guru asing → 404, S3 tak terkonfigurasi) — ditambahkan; kini 12 int test + 40 unit test meng-cover seluruh baris matriks.

## Design Notes

- **Presigned POST dipilih, bukan PUT**: policy POST mendukung `content-length-range` yang DIPAKSA storage — file kebesaran ditolak R2/MinIO sendiri, tidak bisa diakali client.
- **Dua-fase key**: presign ke `submissions/tmp/{cuid}{ext}`; setelah `submitAssignmentAction` memverifikasi (HEAD size ≤ 25 MB), copy ke `submissions/{submissionId}/{cuid}{ext}` (atau pin key tmp ke row + tak perlu copy — pilih yang paling sederhana: **langsung pin key tmp sebagai storageKey final**; prefix tmp hanya penanda orphan; clean-up orphan = utility scan prefix, non-blocking). Rationale: menghindari copyObject yang tidak semua endpoint dukung seragam.
- Blueprint `docs/product/assignment-file-blueprint.md` adalah sumber keputusan produk (K1–K10); jika spec ini bentrok dengan blueprint, blueprint menang untuk keputusan produk, spec menang untuk detail teknis.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: 0 error
- `npm test` -- expected: semua hijau termasuk test baru
- `npx prisma migrate dev --name submission_file` -- expected: migrasi diterapkan tanpa drift

**Manual checks (if no CLI):**
- Dengan R2 dev bucket terkonfigurasi: upload foto → submit → objek muncul di bucket; resubmit → objek lama hilang; guru buka antrean → thumbnail/unduh tampil

===== END-CLAIMS =====

===== BEGIN-DIFF =====

diff --git a/.env.example b/.env.example
index e4c1d16..f985528 100644
--- a/.env.example
+++ b/.env.example
@@ -28,3 +28,14 @@ SUPERADMIN_EMAILS=
 # Uncomment to enable AI image generation for key presentation slides.
 # Without it, exports fall back to the themed illustration panel.
 # GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
+
+# --- Assignment file storage (S3-compatible: Cloudflare R2 / MinIO) ---
+# Browser siswa mengunggah langsung ke storage via presigned POST.
+# Cloudflare R2 (gratis 10GB): endpoint = https://<account-id>.r2.cloudflarestorage.com
+# MinIO (server sendiri):     endpoint = http://localhost:9000 + forcePathStyle otomatis
+# Tanpa blok ini, fitur file tugas mati anggun — teks/link tetap jalan.
+S3_ENDPOINT=
+S3_REGION=auto
+S3_ACCESS_KEY_ID=
+S3_SECRET_ACCESS_KEY=
+S3_BUCKET=
diff --git a/TODO.md b/TODO.md
new file mode 100644
index 0000000..ce5c4c5
--- /dev/null
+++ b/TODO.md
@@ -0,0 +1,35 @@
+# Daftar Rencana Tugas / Backlog (TODO)
+
+Berikut adalah daftar tugas terencana yang akan dikerjakan:
+
+---
+
+## 1. Modul Tugas: Pengiriman via File
+- **Deskripsi:** Menambahkan kemampuan agar tugas dapat dikirim/dikumpulkan melalui file (PDF, gambar, dokumen, dll.).
+- **Status:** 📋 Direncanakan (Pending)
+- **Rincian Awal:**
+  - Mekanisme upload file dan penyimpanan file (storage handler).
+  - Validasi tipe file (mime type) dan pembatasan ukuran file (max file size).
+  - UI pengiriman tugas pada Portal Siswa.
+  - UI pratinjau / unduh berkas tugas siswa pada halaman penilaian tugas guru.
+
+---
+
+## 2. Klassa Agent
+- **Deskripsi:** Agent di dalam ekosistem Klassa yang membantu mengerjakan tugas-tugas guru dan menjadi ruang diskusi interaktif mengenai berbagai masalah di kelas.
+- **Status:** ⏳ Menunggu detailing lebih lanjut dari user
+- **Rincian Awal:**
+  - Integrasi AI agent dengan konteks data kelas (profil siswa, catatan akademik, presensi, masalah perilaku).
+  - Asistensi pengerjaan tugas rutin guru.
+  - Fitur konsultasi / diskusi problem-solving masalah kelas.
+
+---
+
+## 3. Perapihan Mode PC & Mobile Masing-Masing Portal
+- **Deskripsi:** Pembenahan tampilan dan pengalaman responsif (PC/Desktop vs Mobile) pada setiap portal agar nyaman dan rapi di semua perangkat.
+- **Status:** 📋 Direncanakan (Pending)
+- **Cakupan Portal:**
+  - **Portal Guru** (Dashboard, Manajemen Kelas, KBM, Penilaian, Jadwal, dsb.)
+  - **Portal Siswa** (Halaman tugas, kuis, nilai, presensi, jadwal)
+  - **Portal Orang Tua / Wali**
+  - **Portal Superadmin**
diff --git a/_bmad-output/forge/modul-tugas-via-file/.memlog.md b/_bmad-output/forge/modul-tugas-via-file/.memlog.md
new file mode 100644
index 0000000..bb337ff
--- /dev/null
+++ b/_bmad-output/forge/modul-tugas-via-file/.memlog.md
@@ -0,0 +1,14 @@
+---
+idea: Pengumpulan tugas via file upload di modul tugas KLASSA (saat ini hanya teks + link)
+goal: Mempertajam ide: menuntaskan keputusan desain yang masih terbuka (scope, jenis file, batas, storage, resubmit) sampai bisa dieksekusi
+status: complete
+updated: 2026-10-02T14:31
+---
+
+- (decision) Jenis file V1: foto (JPG/PNG/HEIC) + PDF + Word (.doc/.docx) — Word diminta user karena tugas esai/laporan sering dalam bentuk dokumen
+- (decision) Storage: API S3-compatible via adapter — sekarang Cloudflare R2 (10GB gratis, download gratis), nanti di server sendiri tinggal ganti env ke MinIO lokal. Upload langsung browser->storage (presigned URL), file tidak lewat server Next.js
+- (assumption) File submission bersifat privat: siswa hanya bisa akses file sendiri, guru hanya file rombelnya; unduh via route terautentikasi + link berumur pendek
+- (lock) Resubmit sebelum dinilai: file lama DIHAPUS dari storage, diganti file baru — tanpa arsip versi lama
+- (note) Sesi dibuka ulang: user ingin 'lampiran guru' dibahas sekalian, bukan ditunda. Cabang baru: attachment soal/materi pada tugas (guru->siswa).
+- (lock) Lampiran guru masuk scope: limit sama (25MB/file, maks 5 file/tugas), bebas diubah kapan saja (bukan data penilaian), hanya di level Assignment (bukan sesi)
+- (lock) Eksekusi berurutan: Story 1 = infra storage + file jawaban siswa; Story 2 = lampiran guru. Skema DB dirancang sekalian agar tidak diubah dua kali
diff --git a/_bmad-output/forge/modul-tugas-via-file/forge-report.html b/_bmad-output/forge/modul-tugas-via-file/forge-report.html
new file mode 100644
index 0000000..2896201
--- /dev/null
+++ b/_bmad-output/forge/modul-tugas-via-file/forge-report.html
@@ -0,0 +1,115 @@
+<!DOCTYPE html>
+<html lang="id">
+<head>
+<meta charset="UTF-8">
+<meta name="viewport" content="width=device-width, initial-scale=1.0">
+<title>Forge Report — Pengumpulan Tugas via File (KLASSA)</title>
+<style>
+  :root { --teal:#0d9488; --teal-dk:#0f766e; --ink:#0f172a; --mut:#64748b; --bg:#f8fafc; --card:#ffffff; --line:#e2e8f0; }
+  * { box-sizing:border-box; margin:0; padding:0; }
+  body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; background:var(--bg); color:var(--ink); line-height:1.6; padding:40px 16px; }
+  .wrap { max-width:760px; margin:0 auto; }
+  header { text-align:center; margin-bottom:28px; }
+  h1 { font-size:1.5rem; letter-spacing:-.02em; }
+  .sub { color:var(--mut); font-size:.9rem; margin-top:4px; }
+  .seal-band { display:flex; justify-content:center; margin:26px 0; }
+  section { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:22px 24px; margin-bottom:18px; }
+  h2 { font-size:1rem; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
+  h2 .dot { width:8px; height:8px; border-radius:50%; background:var(--teal); display:inline-block; }
+  ul { list-style:none; }
+  li { padding:7px 0; border-bottom:1px dashed var(--line); font-size:.92rem; display:flex; gap:10px; }
+  li:last-child { border-bottom:none; }
+  li .ic { flex:none; }
+  .lock li { border-bottom-color:#d1fae5; }
+  .rej li { border-bottom-color:#fee2e2; }
+  .weak li { border-bottom-color:#fef3c7; }
+  .rej li, .rej h2 .dot { background:#fee2e2; } .rej h2 .dot { background:#ef4444; }
+  .weak h2 .dot { background:#f59e0b; }
+  .tag { display:inline-block; font-size:.68rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; padding:2px 8px; border-radius:99px; margin-bottom:10px; }
+  .tag.ok { background:#ccfbf1; color:var(--teal-dk); }
+  .tag.no { background:#fee2e2; color:#b91c1c; }
+  .tag.warn { background:#fef3c7; color:#92400e; }
+  footer { text-align:center; color:var(--mut); font-size:.8rem; margin-top:26px; }
+  .cast { display:flex; gap:12px; flex-wrap:wrap; justify-content:center; margin-top:10px; }
+  .chip { background:var(--card); border:1px solid var(--line); border-radius:99px; padding:6px 14px; font-size:.82rem; }
+</style>
+</head>
+<body>
+<div class="wrap">
+
+  <header>
+    <h1>⚒️ Forge Report — Pengumpulan Tugas via File</h1>
+    <p class="sub">KLASSA · Modul Tugas · Sesi 2 Okt 2025</p>
+  </header>
+
+  <div class="seal-band">
+    <svg width="150" height="150" viewBox="0 0 150 150" role="img" aria-label="Segel HARDENED">
+      <circle cx="75" cy="75" r="70" fill="#0d9488"/>
+      <circle cx="75" cy="75" r="70" fill="none" stroke="#0f766e" stroke-width="4"/>
+      <circle cx="75" cy="75" r="58" fill="none" stroke="#5eead4" stroke-width="1.5" stroke-dasharray="4 3"/>
+      <g fill="#ffffff" font-family="Georgia,serif" text-anchor="middle">
+        <text x="75" y="70" font-size="21" font-weight="bold" letter-spacing="1">HARDENED</text>
+        <text x="75" y="90" font-size="9" letter-spacing="1.4">IDE MATANG · +LAMPIRAN GURU</text>
+      </g>
+      <path d="M60 100 q15 12 30 0" stroke="#5eead4" stroke-width="2" fill="none"/>
+      <circle cx="75" cy="75" r="72" fill="none" stroke="#134e4a" stroke-width="2" opacity=".5"/>
+    </svg>
+  </div>
+
+  <section class="lock">
+    <span class="tag ok">✅ Keputusan Terkunci</span>
+    <h2><span class="dot"></span>Yang diputuskan</h2>
+    <ul>
+      <li><span class="ic">🎯</span><span><b>Scope V1</b> — file untuk jawaban siswa saja; lampiran guru menyusul.</span></li>
+      <li><span class="ic">📦</span><span><b>Semua jenis file diterima</b> kecuali program &amp; makro (.exe, .apk, .bat, .docm, dll) — bukan kurir virus.</span></li>
+      <li><span class="ic">👁️</span><span><b>Pratinjau bertingkat</b> — foto &amp; PDF inline; Word/PPT/video/ZIP jadi tombol unduh dengan nama asli.</span></li>
+      <li><span class="ic">📏</span><span><b>Limit</b> — maks 25 MB per file, maks 5 file per pengumpulan.</span></li>
+      <li><span class="ic">🗄️</span><span><b>Storage S3-compatible</b> — Cloudflare R2 sekarang; MinIO di server sendiri nanti, pindah via env tanpa ubah kode.</span></li>
+      <li><span class="ic">🚀</span><span><b>Upload langsung</b> browser → storage (presigned URL); file tidak lewat server Next.js.</span></li>
+      <li><span class="ic">🔒</span><span><b>Privat</b> — siswa hanya file miliknya; guru hanya rombelnya; unduh via route terautentikasi.</span></li>
+      <li><span class="ic">🗑️</span><span><b>Resubmit</b> sebelum dinilai — file lama dihapus, diganti baru, tanpa arsip.</span></li>
+      <li><span class="ic">🏷️</span><span><b>Penamaan</b> — nama internal acak; nama asli jadi metadata tampilan.</span></li>
+      <li><span class="ic">📎</span><span><b>Lampiran guru</b> (Story 2) — file soal/LKPD di level tugas; limit sama (25 MB, 5 file); bebas diubah kapan saja; seluruh siswa rombel boleh akses.</span></li>
+      <li><span class="ic">🧱</span><span><b>Eksekusi berurutan</b> — Story 1: infra + jawaban siswa → Story 2: lampiran guru; skema DB sekalian.</span></li>
+    </ul>
+  </section>
+
+  <section class="rej">
+    <span class="tag no">❌ Ditolak</span>
+    <h2><span class="dot"></span>Yang dibuang &amp; alasannya</h2>
+    <ul>
+      <li><span class="ic">🚫</span><span><b>Vercel Blob</b> — API proprietary, pindah server = tulis ulang kode, kena biaya tiap foto dibuka.</span></li>
+      <li><span class="ic">🚫</span><span><b>Allowlist ketat (foto+PDF saja)</b> — terlalu kaku; diganti blocklist yang lebih luas namun tetap aman.</span></li>
+      <li><span class="ic">🚫</span><span><b>Limit 10 MB / 3 file</b> — proposal awal; dinaikkan ke 25 MB / 5 file karena jenis file dibebaskan.</span></li>
+      <li><span class="ic">🚫</span><span><b>Simpan file lama saat resubmit</b> — diputuskan hapus, demi storage bersih.</span></li>
+    </ul>
+  </section>
+
+  <section class="weak">
+    <span class="tag warn">⚠️ Masih Hidup</span>
+    <h2><span class="dot"></span>Titik lemah yang lolos scrutiny (bukan penghalang)</h2>
+    <ul>
+      <li><span class="ic">📄</span><span>.docx tak bisa pratinjau inline — guru harus unduh (trade-off disengaja).</span></li>
+      <li><span class="ic">📆</span><span>Retensi file saat rollover tahun ajaran belum diputuskan — cek PLAYBOOK-ROLLOVER-TA saat implementasi.</span></li>
+      <li><span class="ic">🎥</span><span>25 MB bisa sempit untuk video praktikum — knob mudah dinaikkan.</span></li>
+      <li><span class="ic">📱</span><span>HEIC tidak tampil di sebagian browser — perlu penanganan saat implementasi pratinjau.</span></li>
+    </ul>
+  </section>
+
+  <section>
+    <span class="tag ok">🎭 Pemeran</span>
+    <div class="cast">
+      <span class="chip">📋 John — PM (installed)</span>
+      <span class="chip">🎒 Sinta — Siswa Kelas 8 (generated)</span>
+      <span class="chip">⚒️ Forge Facilitator</span>
+    </div>
+  </section>
+
+  <footer>
+    Hasil lengkap: <b>forged-idea.md</b> · Log keputusan: <b>.memlog.md</b><br>
+    {_bmad-output}/forge/modul-tugas-via-file/ — BMad Method v6.13
+  </footer>
+
+</div>
+</body>
+</html>
diff --git a/_bmad-output/forge/modul-tugas-via-file/forged-idea.md b/_bmad-output/forge/modul-tugas-via-file/forged-idea.md
new file mode 100644
index 0000000..786d847
--- /dev/null
+++ b/_bmad-output/forge/modul-tugas-via-file/forged-idea.md
@@ -0,0 +1,45 @@
+# Forged Idea — Pengumpulan Tugas via File (KLASSA)
+
+Status: **HARDENED** — 2 Okt 2025 · Sesi: `_bmad-output/forge/modul-tugas-via-file/`
+
+## Keputusan (locked)
+
+### Story 1 — File jawaban siswa (V1a)
+
+- **Scope V1:** file hanya untuk **jawaban siswa**. Lampiran guru (soal/LKPD) menyusul, bukan satu paket.
+- **Jenis file:** **semua diterima KECUALI** program & makro (`.exe`, `.msi`, `.bat`, `.cmd`, `.scr`, `.apk`, `.jar`, `.docm`, `.dotm`, `.xlsm`, `.hta`).
+- **Pratinjau bertingkat:** foto (JPG/PNG/HEIC) & PDF → inline saat koreksi. Format lain (Word, PPT, ZIP, video) → tombol **Unduh** dengan nama file asli.
+- **Limit:** maks **25 MB per file**, maks **5 file per pengumpulan**.
+- **Storage:** adapter **S3-compatible**. Sekarang: **Cloudflare R2** (bucket dev & prod terpisah). Nanti di server sendiri: **MinIO** — pindah via env vars, tanpa ubah kode.
+- **Alur upload:** browser siswa → **langsung ke storage via presigned URL** (file tidak lewat server Next.js; menghindari limit body ±4,5 MB Vercel).
+- **Akses privat:** siswa hanya bisa buka file miliknya; guru hanya submission rombelnya. Unduh via route terautentikasi → redirect ke link berumur pendek. Bukan public URL.
+- **Resubmit** (status masih SUBMITTED): file lama **dihapus** dari storage, diganti yang baru. Tanpa arsip versi.
+- **Penamaan:** nama internal acak (anti tabrakan & aman); nama file asli disimpan sebagai metadata tampilan.
+
+### Story 2 — Lampiran guru (V1b, dibahas sekalian)
+
+- **Scope:** guru bisa menyertakan file (foto soal, LKPD, bacaan) pada **tugas (Assignment)** — bukan level sesi.
+- **Limit:** sama persis — 25 MB/file, maks 5 file per tugas. Blocklist yang sama.
+- **Ubah kapan saja:** tambah/hapus/ganti lampiran bebas, walau sudah ada yang mengumpulkan — lampiran = instruksi, bukan data penilaian. Kuncian tetap di jawaban siswa (REVIEWED).
+- **Akses:** seluruh siswa rombel aktif tugas itu boleh lihat/unduh.
+- **Eksekusi:** desain & skema sekalian; build berurutan (Story 1 → Story 2).
+
+## Ditolak + alasan
+
+- **Vercel Blob** — API proprietary; pindah ke server sendiri = tulis ulang kode; kena biaya egress tiap foto dibuka guru.
+- **Allowlist ketat (hanya foto+PDF)** — proposal awal; ditolak demi fleksibilitas ("semua file bisa dikirim, minimal bisa diunduh"). Diganti blocklist format berbahaya.
+- **Limit 10 MB / 3 file** — proposal awal; dinaikkan ke 25 MB / 5 file karena jenis file dibebaskan (termasuk video pendek).
+- **Simpan file lama saat resubmit** — ditolak user: dihapus.
+
+## Titik lemah yang masih hidup (bukan penghalang)
+
+1. `.docx`/format lain tak bisa pratinjau inline — guru wajib unduh dulu (trade-off disengaja).
+2. **Kebijakan retensi file saat rollover tahun ajaran belum diputuskan** — cek `docs/development/PLAYBOOK-ROLLOVER-TA.md` saat implementasi.
+3. 25 MB bisa sempit untuk video praktikum — knob konfigurasi, mudah dinaikkan.
+4. HEIC tidak tampil di sebagian browser — perlu dicek/konversi saat implementasi pratinjau.
+
+## Hand-off
+
+Input siap untuk `bmad-build` (build langsung) atau `bmad-spec` (kalau mau dipecah jadi cerita). Kode menyentuh: `prisma/schema.prisma`, `src/modules/assignments/`, `src/modules/student-portal/`, halaman koreksi guru.
+
+Blueprint teknis lengkap: `docs/product/assignment-file-blueprint.md`.
diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index 4c697e1..5de2d5c 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -86,5 +86,9 @@
 
 - **[high] Cabang PENDING registerStudent (baris 684) tidak pernah terjangkau** — guard F1 (student-auth.actions.ts:536-543) menelan semua siswa PENDING ber-PIN, dan tidak ada flow yang menghasilkan PENDING + accountRequestedAt + tanpa PIN; seluruh fitur deteksi konflik tanggal lahir (birthDateConflict/conflictBirthDates) tidak pernah dieksekusi. Perlu redesign jalur re-registrasi PENDING (relaksasi F1 dengan bukti kepemilikan) — security-sensitive.
 - **[high] Kebocoran PII roster di lookupJoinCode** — nama lengkap + NIS seluruh siswa kelas dikirim tanpa autentikasi/rate-limit ke siapa pun yang memegang kode 6 karakter; NIS dibutuhkan client untuk gate NIS-matching, jadi fix butuh keputusan desain (validasi server-side vs kirim NIS).
+  - **[SETTLED 2026-10-02 — keputusan user, risk-accept]** Nama + NIS boleh terlihat pemegang kode gabung; keamanan login dianggap cukup karena ada dua pintu: PIN untuk login dan tanggal lahir untuk verifikasi klaim NIS/nama. Tidak ada perubahan kode.
 - **[medium] Roster kosong/kontrak client-server** — UI mewajibkan pilih roster (roster kosong = tak ada yang bisa daftar) sementara server masih mengizinkan jalur NEW_STUDENT tanpa cek keanggotaan roster (raw action bisa bypass gate UI). Butuh keputusan: enforce roster server-side atau sediakan jalur input manual.
 - **[medium] Guru belum punya aksi edit/hapus akses siswa** — narasi user menuntut lihat/edit/hapus; ter implementasi: lihat + approve/reject; reset PIN pre-existing (story 5); tidak ada revoke/hapus akses untuk guru. Perlu desain fitur baru (resetStudentPinAction-style revokeStudentAccessAction).
+- source_spec: none
+  summary: Story 2 — Lampiran guru pada tugas (upload file soal/LKPD oleh guru, tampil di portal siswa)
+  evidence: Diputuskan di sesi forge (_bmad-output/forge/modul-tugas-via-file/): eksekusi berurutan, Story 1 (file jawaban siswa) didahulukan; blueprint lengkap ada di docs/product/assignment-file-blueprint.md bagian 3.6 & rencana eksekusi
diff --git a/_bmad-output/implementation-artifacts/spec-assignment-file-submission.md b/_bmad-output/implementation-artifacts/spec-assignment-file-submission.md
new file mode 100644
index 0000000..cd9022f
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/spec-assignment-file-submission.md
@@ -0,0 +1,115 @@
+---
+title: 'Story 1 — Siswa mengumpulkan tugas via file (upload S3-compatible)'
+type: 'feature'
+created: '2025-10-02'
+status: 'in-progress'
+baseline_commit: '10011c207c430723b43bd000695a880b0e9bc5e4'
+route: 'full'
+review_loop_iteration: 0
+context:
+  - '{project-root}/docs/product/assignment-file-blueprint.md'
+  - '{project-root}/src/modules/assignments/README.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** Portal siswa hanya bisa mengumpulkan tugas via teks/link, padahal UI guru sudah menyuruh siswa "foto lembar jawaban dan upload ke portal siswa" — siswa terpaksa lewat layanan eksternal.
+
+**Approach:** Tambah kanal ketiga pengumpulan — **file** (semua jenis kecuali program/makro, maks 25 MB × 5 file). File diunggah **langsung dari browser ke storage S3-compatible** (Cloudflare R2 sekarang; MinIO di server sendiri nanti) via presigned POST; metadata tersimpan di tabel `submission_file`; akses unduh/pratinjau hanya via route terautentikasi (siswa: miliknya sendiri; guru: rombelnya). Blueprint keputusan: `docs/product/assignment-file-blueprint.md`.
+
+## Boundaries & Constraints
+
+**Always:**
+- Semua jenis file diterima KECUALI blocklist: `.exe .msi .bat .cmd .scr .apk .jar .docm .dotm .xlsm .hta` (cek ekstensi nama asli, case-insensitive)
+- Maks 25 MB/file, maks 5 file per submission — divalidasi client DAN server; ukuran juga dipaksa oleh policy presigned POST (`content-length-range`)
+- Upload via presigned POST browser→storage; **byte file tidak pernah lewat server Next.js**
+- Unduh/pratinjau wajib lewat route terautentikasi → redirect 302 ke presigned GET umur pendek (±5 menit); tidak ada public URL
+- Resubmit saat status SUBMITTED: objek storage file lama dihapus eksplisit, row diganti
+- Teks/link tetap valid; minimal salah satu dari teks/link/file harus terisi
+- Nama objek storage acak; `originalName` (disanitasi) hanya metadata tampilan
+
+**Never:**
+- Tidak mengubah alur review/REVIEWED yang ada (kunci tetap di `reviewSubmissionAction`)
+- Tidak mengerjakan lampiran guru (Story 2, sudah dicatat di deferred-work.md)
+- Tidak menyimpan file di filesystem lokal atau kolom DB
+- Tidak menambah Vercel Blob / API penyimpanan proprietary
+- Tanpa konfigurasi S3, fitur mati anggun dengan error jelas — tidak menjatuhkan submit teks/link yang lama
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected Output / Behavior | Error Handling |
+|----------|--------------|---------------------------|----------------|
+| Upload sukses | JPG 3 MB via presigned POST | Objek tersimpan di `submissions/tmp/{cuid}.jpg`; submit merelokasi & membuat row `SubmissionFile` | — |
+| File terblokir | `virus.exe`, `makro.docm` | Ditolak di client (instan) DAN server route | 400 dengan pesan jenis file dilarang |
+| Kebesaran | 30 MB | Ditolak client; policy POST menolak di storage | 400 + pesan maks 25 MB |
+| Kelebihan jumlah | File ke-6 | Ditolak client & server | 400 + pesan maks 5 file |
+| Resubmit | Ada 2 file lama, kirim 3 baru | Objek lama dihapus dari storage; row lama diganti | Kegagalan hapus objek dicatat log, row tetap diganti (orphan bukan kegagalan submit) |
+| REVIEWED locked | Submission sudah dinilai | Tombol kirim nonaktif; action menolak | 400 "terkunci — sudah dinilai guru" |
+| Unduh siswa lain | Siswa A minta file submission siswa B | 404 generik (tidak bocorkan keberadaan) | Tanpa detail |
+| Guru beda rombel | Guru non-pemilik konteks akses file | 404 generik | Tanpa detail |
+| S3 belum dikonfigurasi | Env `S3_*` kosong saat minta presign | 503 dengan pesan "penyimpanan belum dikonfigurasi" | Submit teks/link tetap jalan |
+| File hilang di storage | Row ada, objek tidak (HEAD 404) | Pratinjau/unduh menampilkan error ramah | Tidak crash |
+| Nama aneh | `../../etc/passwd` / 300 karakter / emoji | Disanitasi: strip path, buang karakter kontrol, potong 200 karakter | — |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `prisma/schema.prisma` — model `AssignmentSubmission` (L554–600): tambah relasi `files SubmissionFile[]` (Cascade); 2 model baru tapi Story 1 hanya `SubmissionFile`
+- `src/modules/assignments/submission.service.ts` — murni tanpa DB; ekstensi `validateSubmissionInput` + tipe `SubmissionFileInput`/`SubmissionFileView` + `sanitizeOriginalName` + `isBlockedExtension` + `MAX_FILE_BYTES=25MB`, `MAX_FILES=5`
+- `src/modules/student-portal/student-submission.actions.ts` — `submitAssignmentAction`: terima `files[]`, re-validasi, hapus objek lama, simpan row; `StudentSubmissionView` + `files`
+- `src/modules/student-portal/components/SubmitAssignmentForm.tsx` — UI file input + progress + daftar file terkirim + state locked REVIEWED
+- `src/app/siswa/portal/tugas/page.tsx` — L112 pass `submission.files` (tambah include `files` di query L40-an)
+- `src/modules/assignments/assignment.actions.ts` — `getSubmissionQueueAction`: include `files`, map ke `TeacherQueueItem.files`
+- `src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/AssignmentRosterGradingView.tsx` — tab ONLINE: tampilkan file (thumb gambar / unduh)
+- `src/app/api/templates/docx/upload/route.ts` — POLA: `validateSameOrigin()` + content-length guard — tiru untuk route baru
+- `src/lib/auth.ts` — export `prisma` (+ `auth` untuk session guru di route)
+- `src/modules/student-auth/student-session.ts` — `verifyStudentSession()` untuk guard siswa
+- `src/modules/student-portal/__tests__/submission.service.test.ts` — pola unit test service murni; `story-8-submission-materi.int.test.ts` — pola int test dengan mock `next/headers`
+- `src/lib/authorization.ts` — `verifyTeachingContextAccess` (throw-based) untuk guard guru
+- Baru: `src/modules/storage/storage.service.ts`, `src/modules/storage/file-validation.ts`, `src/app/api/assignments/files/upload-url/route.ts`, `src/app/api/assignments/files/[fileId]/route.ts`, `src/modules/storage/__tests__/file-validation.test.ts`
+- Dep baru: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/s3-create-presigned-post`
+- `PLAYBOOK-ROLLOVER-TA.md` — TIDAK menyentuh assignment/submission (cuma periode, roster, kuis) → tanpa konflik retensi; catat di Implementation Notes
+
+## Tasks & Acceptance
+
+**Execution:**
+- [ ] `prisma/schema.prisma` + migrasi `prisma migrate dev --name submission_file` — model `SubmissionFile` (submissionId FK Cascade, storageKey, originalName, mimeType, sizeBytes) — simpan metadata file
+- [ ] `src/modules/storage/file-validation.ts` — blocklist ekstensi, `MAX_FILE_BYTES`, `MAX_FILES`, `sanitizeOriginalName`, `isPreviewable` (image/* + application/pdf) — validasi single-source tanpa DB
+- [ ] `src/modules/storage/storage.service.ts` — klien S3 dari env (R2/MinIO via `S3_ENDPOINT`), `createPresignedPost` dengan `content-length-range`, `presignGet` (inline/attachment), `deleteObjects`, `headObject`; error jelas bila env kosong — adapter storage tunggal
+- [ ] `src/app/api/assignments/files/upload-url/route.ts` — POST JSON `{assignmentId, files:[{name,mimeType,size}]}`; guard: siswa valid + rombel aktif + tugas ACTIVE milik rombel (reuse logika cek di `student-submission.actions.ts`); balikin `[{storageKey, uploadUrl, fields}]`; same-origin guard — minta presign upload tanpa mengekspos kredensial
+- [ ] `src/app/api/assignments/files/[fileId]/route.ts` — GET `?disposition=inline|attachment`; cek row → `SubmissionFile` → submission → assignment → teachingContext; akses: siswa pemilik ATAU guru pemilik konteks (`verifyTeachingContextAccess`, tangkap throw → 404); 302 ke presigned GET — pintu tunggal akses file
+- [ ] `src/modules/assignments/submission.service.ts` — ekstensi tipe + `validateSubmissionInput` menerima `files` (validasi via file-validation; minimal teks/link/file terisi) — tetap murni unit-testable
+- [ ] `src/modules/student-portal/student-submission.actions.ts` — proses `files`: re-validasi server, HEAD-check size objek, transaksi upsert submission + replace rows `SubmissionFile`, hapus objek lama setelah commit — kebenaran data + kebersihan storage
+- [ ] `src/modules/student-portal/components/SubmitAssignmentForm.tsx` — file picker (accept semua, filter blocklist client-side), daftar file + ukuran, progress per-file, tampilan file terkirim, locked saat REVIEWED — UX siswa
+- [ ] `src/app/siswa/portal/tugas/page.tsx` — include `files` di query submission, pass ke form — data tersedia di UI
+- [ ] `src/modules/assignments/assignment.actions.ts` + `AssignmentRosterGradingView.tsx` — queue guru bawa `files`; tab ONLINE render pratinjau/unduh per file — guru bisa koreksi file
+- [ ] `.env.example` — blok `S3_ENDPOINT/S3_REGION/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY/S3_BUCKET` + komentar setup R2 & MinIO — onboarding storage
+- [ ] `src/modules/storage/__tests__/file-validation.test.ts` + ekstensi `submission.service.test.ts` — unit test matriks I/O (blocklist, size, jumlah, sanitasi nama, minimal satu kanal) — jaga regresi
+- [ ] Int test `submitAssignmentAction` dengan files (mock storage service; pola story-8) — resubmit mengganti file, REVIEWED menolak — kebenaran alur
+
+**Acceptance Criteria:**
+- Given siswa aktif di rombel dengan tugas ACTIVE, when mengunggah JPG 3 MB lalu submit, then row `SubmissionFile` tersimpan dan objek berada di prefix final (bukan tmp)
+- Given submission SUBMITTED berisi 2 file, when siswa resubmit dengan 3 file baru, then hanya 3 row/objek baru tersisa dan 2 objek lama terhapus dari storage
+- Given siswa mencoba GET file submission siswa lain (beda fileId miliknya), when route diakses, then 404 tanpa kebocoran informasi
+- Given env S3 kosong, when submit teks saja, then sukses seperti sebelumnya (fitur file menolak dengan 503 bila dipakai)
+- Given file Word `.docx` terkirim, when guru membuka antrean koreksi, then file tampil sebagai tombol unduh bernama asli, bukan pratinjau inline
+- Given file PDF terkirim, when pratinjau dibuka, then tampil inline via route terautentikasi (302 presigned, disposition inline)
+
+## Design Notes
+
+- **Presigned POST dipilih, bukan PUT**: policy POST mendukung `content-length-range` yang DIPAKSA storage — file kebesaran ditolak R2/MinIO sendiri, tidak bisa diakali client.
+- **Dua-fase key**: presign ke `submissions/tmp/{cuid}{ext}`; setelah `submitAssignmentAction` memverifikasi (HEAD size ≤ 25 MB), copy ke `submissions/{submissionId}/{cuid}{ext}` (atau pin key tmp ke row + tak perlu copy — pilih yang paling sederhana: **langsung pin key tmp sebagai storageKey final**; prefix tmp hanya penanda orphan; clean-up orphan = utility scan prefix, non-blocking). Rationale: menghindari copyObject yang tidak semua endpoint dukung seragam.
+- Blueprint `docs/product/assignment-file-blueprint.md` adalah sumber keputusan produk (K1–K10); jika spec ini bentrok dengan blueprint, blueprint menang untuk keputusan produk, spec menang untuk detail teknis.
+
+## Verification
+
+**Commands:**
+- `npx tsc --noEmit` -- expected: 0 error
+- `npm test` -- expected: semua hijau termasuk test baru
+- `npx prisma migrate dev --name submission_file` -- expected: migrasi diterapkan tanpa drift
+
+**Manual checks (if no CLI):**
+- Dengan R2 dev bucket terkonfigurasi: upload foto → submit → objek muncul di bucket; resubmit → objek lama hilang; guru buka antrean → thumbnail/unduh tampil
diff --git a/docs/product/assignment-file-blueprint.md b/docs/product/assignment-file-blueprint.md
new file mode 100644
index 0000000..cfbf70e
--- /dev/null
+++ b/docs/product/assignment-file-blueprint.md
@@ -0,0 +1,141 @@
+# Blueprint — Modul Tugas: File Jawaban Siswa & Lampiran Guru
+
+> Status: **Disetujui untuk build** · Sumber: forge session `_bmad-output/forge/modul-tugas-via-file/` (HARDENED, 2 Okt 2025) · Ringkasan keputusan: `forged-idea.md` di folder yang sama
+
+---
+
+## 1. Ringkasan
+
+Modul tugas KLASSA saat ini hanya menerima jawaban **teks** dan **link**. Blueprint ini menambahkan **file** ke dua arah:
+
+```
+Story 1 (V1a):  SISWA ──file jawaban──▶ GURU   (foto lembar jawaban, PDF, Word, dll.)
+Story 2 (V1b):  GURU  ──file soal/materi──▶ SISWA  (foto soal, LKPD, bacaan)
+```
+
+Alasan utama: UI guru sudah menyuruh siswa "foto lembar jawaban dan upload ke portal siswa" — padahal portal belum bisa terima file; siswa terpaksa lewat Google Drive/WhatsApp.
+
+## 2. Keputusan Produk (locked — dari sesi forge)
+
+| # | Keputusan | Nilai |
+|---|---|---|
+| K1 | Jenis file | **Semua diterima KECUALI** program & makro: `.exe .msi .bat .cmd .scr .apk .jar .docm .dotm .xlsm .hta` |
+| K2 | Pratinjau | Foto (JPG/PNG/HEIC) & PDF → inline. Lainnya → tombol **Unduh** + nama file asli |
+| K3 | Limit | **25 MB/file, maks 5 file** per pengumpulan siswa / per tugas (lampiran guru) |
+| K4 | Storage | Adapter **S3-compatible**. Sekarang **Cloudflare R2** (bucket dev & prod terpisah); nanti **MinIO** di server sendiri — pindah via env, tanpa ubah kode |
+| K5 | Alur upload | Browser → **langsung ke storage** via presigned POST (file tidak lewat server Next.js) |
+| K6 | Akses | Privat: siswa hanya file miliknya; guru hanya rombelnya; lampiran guru → seluruh siswa rombel aktif. Unduh via route terautentikasi → link berumur pendek. **Bukan public URL** |
+| K7 | Resubmit siswa | Selama status SUBMITTED: file lama **dihapus** dari storage, diganti baru. Tidak ada arsip versi |
+| K8 | Lampiran guru | Nempel di level **Assignment** (bukan sesi). Bebas diubah kapan saja (instruksi ≠ data penilaian). Terkunci otomatis mengikuti status assignment |
+| K9 | Penamaan | Nama internal acak (cuid + ekstensi); nama asli = metadata tampilan |
+| K10 | Rollover TA | Retensi file mengikuti playbook rollover — **perlu dicek saat implementasi** terhadap `docs/development/PLAYBOOK-ROLLOVER-TA.md` |
+
+## 3. Arsitektur Teknis
+
+### 3.1 Skema Prisma (2 tabel baru, relasi ke tabel existing)
+
+```prisma
+model SubmissionFile {
+  id           String               @id @default(cuid())
+  submissionId String
+  submission   AssignmentSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
+  storageKey   String               // path objek di bucket, mis. submissions/<subId>/<cuid>.jpg
+  originalName String               // nama tampilan, mis. Tugas3_Budi.docx
+  mimeType     String
+  sizeBytes    Int
+  createdAt    DateTime             @default(now())
+
+  @@index([submissionId])
+  @@map("submission_file")
+}
+
+model AssignmentAttachment {
+  id           String     @id @default(cuid())
+  assignmentId String
+  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
+  storageKey   String
+  originalName String
+  mimeType     String
+  sizeBytes    Int
+  createdAt    DateTime   @default(now())
+
+  @@index([assignmentId])
+  @@map("assignment_attachment")
+}
+```
+
+`onDelete: Cascade` DB saja — **objek storage dihapus eksplisit oleh service** sebelum/bersamaan hapus row (storage tidak tahu FK).
+
+### 3.2 Modul storage adapter — `src/modules/storage/`
+
+```
+storage/
+  storage.service.ts   ← presignUploadPost(), presignGet(), deleteObject(), objectExists()
+  file-validation.ts   ← blocklist K1, limit K3, previewable(), sanitizeOriginalName()
+  __tests__/
+```
+
+- Library: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` + `@aws-sdk/s3-create-presigned-post` (standar S3; kompatibel R2 & MinIO tanpa kode khusus).
+- **Presigned POST** (bukan PUT) dipilih karena policy-nya bisa memaksa `content-length-range 1..25MB` → storage yang menolak file kebesaran, bukan cuma validasi client.
+- Semua env opsional saat dev — modul melempar error jelas saat dipakai tanpa konfigurasi (fitur mati anggun, tidak menjatuhkan app lama).
+
+### 3.3 Env baru
+
+```
+S3_ENDPOINT=            # R2: https://<account>.r2.cloudflarestorage.com ; MinIO: http://localhost:9000
+S3_REGION=auto          # R2 pakai "auto"
+S3_ACCESS_KEY_ID=
+S3_SECRET_ACCESS_KEY=
+S3_BUCKET=              # klassa-dev / klassa-prod
+```
+
+Pindah ke server sendiri nanti = ganti 5 baris ini. Nol perubahan kode.
+
+### 3.4 Route API baru
+
+| Route | Tugas | Guard |
+|---|---|---|
+| `POST /api/assignments/files/upload-url` | Terima metadata file (nama, mime, size, kind: `submission`\|`attachment`, assignmentId) → validasi server-side (K1, K3) → balikin `{fileId, uploadUrl, fields}` presigned POST | Siswa (session) untuk kind=submission; guru (auth) untuk kind=attachment |
+| `GET /api/assignments/files/[fileId]` | Cek hak akses (K6) → 302 ke presigned GET (umur ±5 menit, `response-content-disposition: inline` untuk pratinjau / `attachment; filename=...` untuk unduh) | Per-table lookup + verifikasi relasi |
+
+Orphan (file ter-upload tapi tak pernah diklaim): disimpan di prefix `tmp/` dengan TTL 24 jam pada nama key; claim = pindah row ke tabel + finalisasi key. Pembersihan orphan lintas-Instansi via scan prefix — **diimplementasikan sederhana di Story 1 sebagai utility, dijalankan manual/cron belakangan** (tidak blocking).
+
+### 3.5 Alur submit siswa (Story 1)
+
+1. Siswa pilih file di `SubmitAssignmentForm` → validasi client (K1, K3, feedback instan).
+2. Per file: minta presigned POST → browser PUT langsung ke R2 → dapat `storageKey`.
+3. Submit `submitAssignmentAction` dengan `files: [{storageKey, originalName, mimeType, sizeBytes}]`.
+4. Server re-validasi penuh (jangan percaya client), HEAD-check size objek, lalu dalam transaksi: upsert submission + create `SubmissionFile` rows + **hapus objek file lama** (K7).
+5. Text/link tetap valid — file jadi **kanal ketiga**, minimal salah satu dari teks/link/file harus ada.
+
+### 3.6 Alur lampiran guru (Story 2)
+
+1. Form buat tugas (`TugasClient`) + panel edit → upload file (flow presigned sama, kind=attachment).
+2. `setAssignmentAttachmentsAction` menyetel daftar lampiran (add/remove; remove = hapus objek + row).
+3. Portal siswa (detail tugas di `/siswa/portal/tugas`): bagian **Lampiran** — pratinjau inline foto/PDF, tombol unduh untuk lainnya.
+
+### 3.7 UI yang disentuh
+
+| Layar | Perubahan |
+|---|---|
+| `SubmitAssignmentForm` (portal siswa) | Input file + daftar file + progress; daftar file terkirim; badge terkunci saat REVIEWED |
+| `/siswa/portal/tugas` | Tampil lampiran guru (Story 2) |
+| `AssignmentRosterGradingView` tab ONLINE | Thumbnail/pratinjau + tombol unduh per file jawaban |
+| `TugasClient` + dialog edit | Upload & kelola lampiran (Story 2) |
+| Halaman detail tugas guru (optional ringan) | Tampilkan lampiran read-only |
+
+## 4. Rencana Eksekusi (2 story berurutan)
+
+**Story 1 — Infra + file jawaban siswa:** env & adapter storage → migrasi skema (`submission_file`) → route upload-url & download → ekstensi `submitAssignmentAction` + hapus file lama → UI SubmitAssignmentForm → UI grading view → unit test validasi + int test akses/hapus → cek rollover playbook (K10).
+
+**Story 2 — Lampiran guru:** migrasi (`assignment_attachment`) → `setAssignmentAttachmentsAction` → UI upload di TugasClient → tampilan lampiran portal siswa → int test akses rombel.
+
+Validasi tiap story: `npx tsc --noEmit`, `npm test`, dan smoke manual via dev server.
+
+## 5. Yang secara sadar TIDAK dikerjakan
+
+- Pratinjau inline .docx/.pptx (guru unduh dulu — trade-off disengaja)
+- Konversi/optimasi HEIC otomatis (dicek saat pratinjau; jika gagal tampil → fallback unduh)
+- Arsip versi file saat resubmit (K7: hapus)
+- Kuota per-sekolah / per-siswa, antivirus scan, watermark
+- Lampiran di level sesi mengajar
diff --git a/package.json b/package.json
index 348a9d7..b10a6f5 100644
--- a/package.json
+++ b/package.json
@@ -15,6 +15,9 @@
     "audit:nis": "tsx --env-file-if-exists=.env scripts/backfill-student-canonical-nis.ts"
   },
   "dependencies": {
+    "@aws-sdk/client-s3": "^3.1145.0",
+    "@aws-sdk/s3-presigned-post": "^3.1145.0",
+    "@aws-sdk/s3-request-presigner": "^3.1145.0",
     "@base-ui/react": "^1.7.0",
     "@google/genai": "^2.18.0",
     "@milkdown/crepe": "^7.22.2",
diff --git a/prisma/migrations/20261002074643_submission_file/migration.sql b/prisma/migrations/20261002074643_submission_file/migration.sql
new file mode 100644
index 0000000..9cc3ed8
--- /dev/null
+++ b/prisma/migrations/20261002074643_submission_file/migration.sql
@@ -0,0 +1,21 @@
+-- CreateTable
+CREATE TABLE "submission_file" (
+    "id" TEXT NOT NULL,
+    "submissionId" TEXT NOT NULL,
+    "storageKey" TEXT NOT NULL,
+    "originalName" TEXT NOT NULL,
+    "mimeType" TEXT NOT NULL,
+    "sizeBytes" INTEGER NOT NULL,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+
+    CONSTRAINT "submission_file_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateIndex
+CREATE UNIQUE INDEX "submission_file_storageKey_key" ON "submission_file"("storageKey");
+
+-- CreateIndex
+CREATE INDEX "submission_file_submissionId_idx" ON "submission_file"("submissionId");
+
+-- AddForeignKey
+ALTER TABLE "submission_file" ADD CONSTRAINT "submission_file_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "assignment_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index d7e6080..bae8d62 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -590,12 +590,28 @@ model AssignmentSubmission {
   createdAt           DateTime                   @default(now())
   updatedAt           DateTime                   @updatedAt
 
+  files               SubmissionFile[]
+
   @@unique([assignmentId, studentId])
   @@index([assignmentId, status])
   @@index([studentId])
   @@map("assignment_submission")
 }
 
+model SubmissionFile {
+  id           String               @id @default(cuid())
+  submissionId String
+  submission   AssignmentSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
+  storageKey   String               @unique
+  originalName String
+  mimeType     String
+  sizeBytes    Int
+  createdAt    DateTime             @default(now())
+
+  @@index([submissionId])
+  @@map("submission_file")
+}
+
 // -------------------------------------------------
 // ASSESSMENT & GRADING SCHEMA (DEV STAGE 04)
 // -------------------------------------------------
diff --git a/src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/AssignmentRosterGradingView.tsx b/src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/AssignmentRosterGradingView.tsx
index 1294bcf..e191794 100644
--- a/src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/AssignmentRosterGradingView.tsx
+++ b/src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/AssignmentRosterGradingView.tsx
@@ -7,6 +7,7 @@ import {
   Save,
   CheckCircle2,
   Clock,
+  Download,
   FileText,
   MessageSquare,
   AlertCircle,
@@ -448,7 +449,7 @@ export function AssignmentRosterGradingView({
                     </div>
                   </div>
 
-                  {(s.textContent || s.linkUrl) && (
+                  {(s.textContent || s.linkUrl || s.files.length > 0) && (
                     <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                       {s.textContent && (
                         <p className="text-sm whitespace-pre-wrap leading-relaxed">
@@ -465,6 +466,51 @@ export function AssignmentRosterGradingView({
                           🔗 {s.linkUrl}
                         </a>
                       )}
+                      {s.files.length > 0 && (
+                        <div className="flex flex-wrap gap-2 pt-1">
+                          {s.files.map((f) =>
+                            f.isPreviewable ? (
+                              <a
+                                key={f.id}
+                                href={`/api/assignments/files/${f.id}?disposition=inline`}
+                                target="_blank"
+                                rel="noopener noreferrer"
+                                className="group relative"
+                                title={`Lihat ${f.originalName}`}
+                              >
+                                {f.mimeType.startsWith("image/") ? (
+                                  /* eslint-disable-next-line @next/next/no-img-element */
+                                  <img
+                                    src={`/api/assignments/files/${f.id}?disposition=inline`}
+                                    alt={f.originalName}
+                                    className="h-20 w-20 rounded-lg border border-slate-200 bg-white object-cover group-hover:ring-2 group-hover:ring-teal-400"
+                                  />
+                                ) : (
+                                  <span className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100">
+                                    <FileText className="w-3.5 h-3.5" /> {f.originalName}
+                                  </span>
+                                )}
+                              </a>
+                            ) : (
+                              <a
+                                key={f.id}
+                                href={`/api/assignments/files/${f.id}`}
+                                target="_blank"
+                                rel="noopener noreferrer"
+                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-700"
+                              >
+                                <Download className="w-3.5 h-3.5 text-teal-600" />
+                                {f.originalName}
+                                <span className="text-[10px] font-normal text-muted-foreground">
+                                  {f.sizeBytes >= 1024 * 1024
+                                    ? `${(f.sizeBytes / 1024 / 1024).toFixed(1)} MB`
+                                    : `${Math.max(1, Math.round(f.sizeBytes / 1024))} KB`}
+                                </span>
+                              </a>
+                            )
+                          )}
+                        </div>
+                      )}
                     </div>
                   )}
 
diff --git a/src/app/api/assignments/files/[fileId]/route.ts b/src/app/api/assignments/files/[fileId]/route.ts
new file mode 100644
index 0000000..badc2b8
--- /dev/null
+++ b/src/app/api/assignments/files/[fileId]/route.ts
@@ -0,0 +1,74 @@
+import { NextRequest, NextResponse } from "next/server";
+import { auth, prisma } from "@/lib/auth";
+import { verifyStudentSession } from "@/modules/student-auth/student-session";
+import { presignDownload } from "@/modules/storage/storage.service";
+
+/**
+ * Story 1 — pintu tunggal akses file jawaban (K6): row → submission →
+ * assignment → teachingContext. Siswa hanya file miliknya; guru hanya
+ * pemilik konteks. Lolos → 302 ke presigned GET umur pendek.
+ * Semua kegagalan akses = 404 generik (tidak membocorkan keberadaan).
+ */
+
+function notFound() {
+  return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
+}
+
+export async function GET(
+  request: NextRequest,
+  { params }: { params: Promise<{ fileId: string }> }
+) {
+  try {
+    const { fileId } = await params;
+    if (!fileId || typeof fileId !== "string") return notFound();
+
+    const disposition =
+      request.nextUrl.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
+
+    const file = await prisma.submissionFile.findUnique({
+      where: { id: fileId },
+      include: {
+        submission: {
+          select: {
+            studentId: true,
+            assignment: { select: { teachingContextId: true } },
+          },
+        },
+      },
+    });
+
+    if (!file) return notFound();
+
+    // Jalur 1: siswa — hanya file miliknya
+    const studentSession = await verifyStudentSession();
+    if (studentSession) {
+      if (studentSession.studentId !== file.submission.studentId) return notFound();
+    } else {
+      // Jalur 2: guru — pemilik teaching context tugas ini
+      const teacherSession = await auth.api.getSession({ headers: request.headers });
+      if (!teacherSession) return notFound();
+
+      const profile = await prisma.teacherProfile.findFirst({
+        where: { userId: teacherSession.user.id },
+        select: { id: true },
+      });
+      if (!profile) return notFound();
+
+      const ctx = await prisma.teachingContext.findUnique({
+        where: { id: file.submission.assignment.teachingContextId },
+        select: { teacherProfileId: true },
+      });
+      if (!ctx || ctx.teacherProfileId !== profile.id) return notFound();
+    }
+
+    const { url } = await presignDownload(file.storageKey, {
+      filename: file.originalName,
+      disposition,
+    });
+
+    return NextResponse.redirect(url, 302);
+  } catch (err) {
+    console.error("[submission file route]", err);
+    return NextResponse.json({ error: "Gagal mengakses file." }, { status: 500 });
+  }
+}
diff --git a/src/app/api/assignments/files/upload-url/route.ts b/src/app/api/assignments/files/upload-url/route.ts
new file mode 100644
index 0000000..328aa40
--- /dev/null
+++ b/src/app/api/assignments/files/upload-url/route.ts
@@ -0,0 +1,121 @@
+import { NextRequest, NextResponse } from "next/server";
+import { prisma } from "@/lib/auth";
+import { verifyStudentSession } from "@/modules/student-auth/student-session";
+import { validateFileList } from "@/modules/storage/file-validation";
+import {
+  StorageNotConfiguredError,
+  buildTmpStorageKey,
+  isStorageConfigured,
+  presignSubmissionUpload,
+} from "@/modules/storage/storage.service";
+
+/**
+ * Story 1 — minta presigned POST untuk upload file jawaban.
+ * Browser siswa mengunggah LANGSUNG ke storage; byte tidak lewat sini.
+ * Guard: sesi siswa valid + tugas ACTIVE milik rombel periode aktif siswa.
+ */
+
+function validateSameOrigin(request: NextRequest): boolean {
+  const origin = request.headers.get("origin");
+  const host = request.headers.get("host");
+  if (!origin || !host) {
+    const referer = request.headers.get("referer");
+    if (!referer) return true;
+    try {
+      return new URL(referer).host === host;
+    } catch {
+      return false;
+    }
+  }
+  try {
+    return new URL(origin).host === host;
+  } catch {
+    return false;
+  }
+}
+
+export async function POST(request: NextRequest) {
+  if (!validateSameOrigin(request)) {
+    return NextResponse.json({ error: "Forbidden: permintaan lintas-asal." }, { status: 403 });
+  }
+
+  if (!isStorageConfigured()) {
+    return NextResponse.json(
+      { error: "Penyimpanan file belum dikonfigurasi. Hubungi pengelola." },
+      { status: 503 }
+    );
+  }
+
+  try {
+    const session = await verifyStudentSession();
+    if (!session) {
+      return NextResponse.json({ error: "Sesi tidak valid atau telah berakhir." }, { status: 401 });
+    }
+
+    const body = await request.json().catch(() => null);
+    const assignmentId = typeof body?.assignmentId === "string" ? body.assignmentId : "";
+    const rawFiles = Array.isArray(body?.files) ? body.files : null;
+
+    if (!assignmentId || !rawFiles) {
+      return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
+    }
+
+    const validation = validateFileList(rawFiles);
+    if (!validation.ok) {
+      return NextResponse.json({ error: validation.error }, { status: 400 });
+    }
+
+    const student = await prisma.student.findUnique({
+      where: { id: session.studentId },
+      include: {
+        classMemberships: {
+          include: { academicPeriod: { select: { status: true } } },
+          orderBy: { createdAt: "desc" },
+        },
+      },
+    });
+
+    if (!student) {
+      return NextResponse.json({ error: "Data siswa tidak ditemukan." }, { status: 404 });
+    }
+
+    const activeMembership = student.classMemberships.find(
+      (cm) => cm.academicPeriod.status === "ACTIVE"
+    );
+    if (!activeMembership) {
+      return NextResponse.json(
+        { error: "Belum terdaftar di rombel periode aktif." },
+        { status: 403 }
+      );
+    }
+
+    const assignment = await prisma.assignment.findUnique({
+      where: { id: assignmentId },
+      include: { teachingContext: { select: { classId: true, academicPeriodId: true } } },
+    });
+
+    if (
+      !assignment ||
+      assignment.status !== "ACTIVE" ||
+      assignment.teachingContext.classId !== activeMembership.classId ||
+      assignment.teachingContext.academicPeriodId !== activeMembership.academicPeriodId
+    ) {
+      // Jangan bocorkan keberadaan tugas rombel lain
+      return NextResponse.json({ error: "Tugas tidak tersedia." }, { status: 404 });
+    }
+
+    const uploads = [];
+    for (const f of validation.files) {
+      const storageKey = buildTmpStorageKey(f.name);
+      uploads.push(await presignSubmissionUpload(storageKey, f.mimeType));
+    }
+
+    return NextResponse.json({ uploads });
+  } catch (err) {
+    if (err instanceof StorageNotConfiguredError) {
+      return NextResponse.json({ error: err.message }, { status: 503 });
+    }
+    console.error("[upload-url route]", err);
+    return NextResponse.json({ error: "Gagal menyiapkan unggahan." }, { status: 500 });
+  }
+}
diff --git a/src/app/siswa/portal/tugas/page.tsx b/src/app/siswa/portal/tugas/page.tsx
index 590ec45..e156a8a 100644
--- a/src/app/siswa/portal/tugas/page.tsx
+++ b/src/app/siswa/portal/tugas/page.tsx
@@ -3,7 +3,7 @@ import { verifyStudentSession } from "@/modules/student-auth/student-session";
 import { prisma } from "@/lib/auth";
 import { ClipboardList, Clock, BookOpen, AlertCircle } from "lucide-react";
 import { SubmitAssignmentForm } from "@/modules/student-portal/components/SubmitAssignmentForm";
-import { isSubmissionLate, type StudentSubmissionView } from "@/modules/assignments/submission.service";
+import { isSubmissionLate, isPreviewable, type StudentSubmissionView } from "@/modules/assignments/submission.service";
 
 export default async function StudentAssignmentsPage() {
   const session = await verifyStudentSession();
@@ -48,6 +48,7 @@ export default async function StudentAssignmentsPage() {
         },
         submissions: {
           where: { studentId: session.studentId },
+          include: { files: true },
         },
       },
       orderBy: [
@@ -120,6 +121,14 @@ export default async function StudentAssignmentsPage() {
                         status: item.submissions[0].status,
                         textContent: item.submissions[0].textContent,
                         linkUrl: item.submissions[0].linkUrl,
+                        files: item.submissions[0].files.map(
+                          (f: { id: string; originalName: string; mimeType: string; sizeBytes: number }) => ({
+                          id: f.id,
+                          originalName: f.originalName,
+                          mimeType: f.mimeType,
+                          sizeBytes: f.sizeBytes,
+                          isPreviewable: isPreviewable(f.mimeType),
+                        })),
                         feedback: item.submissions[0].feedback,
                         score: item.submissions[0].score,
                         submittedAt: item.submissions[0].submittedAt.toISOString(),
diff --git a/src/modules/assignments/README.md b/src/modules/assignments/README.md
index 3d9af39..95f7818 100644
--- a/src/modules/assignments/README.md
+++ b/src/modules/assignments/README.md
@@ -8,8 +8,11 @@ Penugasan siswa per pertemuan: pembuatan tugas, pengumpulan, dan penilaian submi
 assignments/
   components/
     SaveAsAssessmentDialog.tsx    ← dialog simpan tugas jadi penilaian
-  assignment.actions.ts           ← server actions tugas
-  submission.service.ts           ← logika pengumpulan & penilaian
+  assignment.actions.ts           ← server actions tugas (+queue koreksi dgn file)
+  submission.service.ts           ← logika validasi & shaping submission (+kanal file)
+
+(storage file jawaban: src/modules/storage/ — adapter S3 + validasi K1–K3;
+ route akses: src/app/api/assignments/files/*)
 ```
 
 ## Cara Pakai (untuk AI & manusia)
@@ -23,3 +26,11 @@ assignments/
 
 - ⚠️ Modul ini **belum punya unit test** — hati-hati mengubah `submission.service.ts`; andalkan typecheck (`npx tsc --noEmit`) + testing manual di halaman kelas
 - Terhubung erat dengan modul `assessment` (via SaveAsAssessmentDialog)
+
+## File Jawaban (Story 1)
+
+- Byte file TIDAK lewat server — browser siswa upload langsung ke S3-compatible (R2/MinIO) via presigned POST (`/api/assignments/files/upload-url`)
+- Klaim & penghapusan objek terjadi di `submitAssignmentAction` (prefix `submissions/tmp/`, guard `isClaimableSubmissionKey`)
+- Tanpa env `S3_*`, kanal file mati anggun — teks/link tetap jalan
+- Keputusan produk lengkap: `docs/product/assignment-file-blueprint.md`
+- Story 2 (lampiran guru) menunggu di `_bmad-output/implementation-artifacts/deferred-work.md`
diff --git a/src/modules/assignments/assignment.actions.ts b/src/modules/assignments/assignment.actions.ts
index 3f466f8..57bf85c 100644
--- a/src/modules/assignments/assignment.actions.ts
+++ b/src/modules/assignments/assignment.actions.ts
@@ -7,6 +7,7 @@ import { revalidatePath } from "next/cache";
 import {
   validateReviewInput,
   isSubmissionLate,
+  isPreviewable,
   type TeacherQueueItem,
 } from "@/modules/assignments/submission.service";
 
@@ -82,7 +83,10 @@ export async function getSubmissionQueueAction(
 
   const rows = await prisma.assignmentSubmission.findMany({
     where: { assignmentId },
-    include: { student: { select: { fullName: true, nis: true } } },
+    include: {
+      student: { select: { fullName: true, nis: true } },
+      files: true,
+    },
     orderBy: [
       // "desc" pada enum mengandalkan urutan leksikografis: SUBMITTED > REVIEWED,
       // sehingga antrean menunggu-koreksi selalu di atas. Jika enum bertambah
@@ -100,6 +104,13 @@ export async function getSubmissionQueueAction(
     status: r.status,
     textContent: r.textContent,
     linkUrl: r.linkUrl,
+    files: r.files.map((f) => ({
+      id: f.id,
+      originalName: f.originalName,
+      mimeType: f.mimeType,
+      sizeBytes: f.sizeBytes,
+      isPreviewable: isPreviewable(f.mimeType),
+    })),
     feedback: r.feedback,
     score: r.score,
     submittedAt: r.submittedAt.toISOString(),
diff --git a/src/modules/assignments/submission.service.ts b/src/modules/assignments/submission.service.ts
index c2a20ad..f5dfc90 100644
--- a/src/modules/assignments/submission.service.ts
+++ b/src/modules/assignments/submission.service.ts
@@ -1,11 +1,25 @@
 /**
  * Story 8 (Gelombang 3) — service validasi & shaping submission tugas.
  * Murni tanpa DB: unit-testable, dipakai oleh action siswa & guru.
+ *
+ * Story 1 (file) — ditambah kanal file: minimal salah satu teks/link/file.
  */
 
+import {
+  validateFileList,
+  isPreviewable,
+  type FileMetaInput,
+} from "@/modules/storage/file-validation";
+
 export interface SubmissionInput {
   textContent?: string | null;
   linkUrl?: string | null;
+  files?: SubmissionFileInput[];
+}
+
+/** Metadata file yang diklaim siswa — sudah terunggah ke storage via presign. */
+export interface SubmissionFileInput extends FileMetaInput {
+  storageKey: string;
 }
 
 export interface ReviewInput {
@@ -13,6 +27,8 @@ export interface ReviewInput {
   score?: number | null;
 }
 
+export { isPreviewable };
+
 /** URL wajib absolut http(s) — menolak javascript:, data:, dsb. */
 export function isValidHttpUrl(raw: string): boolean {
   try {
@@ -24,19 +40,41 @@ export function isValidHttpUrl(raw: string): boolean {
 }
 
 export type SubmissionValidation =
-  | { ok: true; textContent: string | null; linkUrl: string | null }
+  | {
+      ok: true;
+      textContent: string | null;
+      linkUrl: string | null;
+      /** undefined = file tidak disentuh (pertahankan yang ada); array = ganti total */
+      files: SubmissionFileInput[] | undefined;
+    }
   | { ok: false; error: string };
 
 /**
- * Validasi input submit siswa: minimal salah satu dari teks/tautan terisi,
+ * Validasi input submit siswa: minimal salah satu dari teks/tautan/file terisi,
  * link wajib URL http(s) valid. Trim dilakukan di sini agar single source.
+ * `files` bersifat opsional: undefined = jangan ubah file existing; array (termasuk
+ * kosong) = ganti seluruh set file submission dengan array tersebut.
  */
 export function validateSubmissionInput(input: SubmissionInput): SubmissionValidation {
   const textContent = (input.textContent ?? "").trim();
   const linkUrl = (input.linkUrl ?? "").trim();
 
-  if (!textContent && !linkUrl) {
-    return { ok: false, error: "Isi jawaban teks atau tautan terlebih dahulu." };
+  let files: SubmissionFileInput[] | undefined;
+  if (input.files !== undefined && input.files !== null) {
+    const listValidation = validateFileList(input.files);
+    if (!listValidation.ok) {
+      return { ok: false, error: listValidation.error };
+    }
+    files = input.files.map((f, i) => ({
+      ...f,
+      name: listValidation.files[i].name,
+      mimeType: listValidation.files[i].mimeType,
+      sizeBytes: listValidation.files[i].sizeBytes,
+    }));
+  }
+
+  if (!textContent && !linkUrl && (!files || files.length === 0)) {
+    return { ok: false, error: "Isi jawaban teks, tautan, atau lampirkan file terlebih dahulu." };
   }
 
   if (linkUrl && !isValidHttpUrl(linkUrl)) {
@@ -51,7 +89,7 @@ export function validateSubmissionInput(input: SubmissionInput): SubmissionValid
     return { ok: false, error: "Jawaban teks terlalu panjang (maks. 10.000 karakter)." };
   }
 
-  return { ok: true, textContent: textContent || null, linkUrl: linkUrl || null };
+  return { ok: true, textContent: textContent || null, linkUrl: linkUrl || null, files };
 }
 
 export type ReviewValidation =
@@ -89,6 +127,15 @@ export function isSubmissionLate(submittedAt: Date, dueDate?: Date | null): bool
   return submittedAt.getTime() > dueDate.getTime();
 }
 
+/** Bentuk tampilan file submission untuk siswa & guru. */
+export interface SubmissionFileView {
+  id: string;
+  originalName: string;
+  mimeType: string;
+  sizeBytes: number;
+  isPreviewable: boolean;
+}
+
 /** Bentuk tampilan status submission untuk siswa (halaman Tugas & Mode Keluarga). */
 export interface StudentSubmissionView {
   id: string;
@@ -96,6 +143,7 @@ export interface StudentSubmissionView {
   status: "SUBMITTED" | "REVIEWED";
   textContent: string | null;
   linkUrl: string | null;
+  files: SubmissionFileView[];
   feedback: string | null;
   score: number | null;
   submittedAt: string; // ISO
@@ -111,6 +159,7 @@ export interface TeacherQueueItem {
   status: "SUBMITTED" | "REVIEWED";
   textContent: string | null;
   linkUrl: string | null;
+  files: SubmissionFileView[];
   feedback: string | null;
   score: number | null;
   submittedAt: string; // ISO
diff --git a/src/modules/storage/__tests__/file-validation.test.ts b/src/modules/storage/__tests__/file-validation.test.ts
new file mode 100644
index 0000000..88e45d4
--- /dev/null
+++ b/src/modules/storage/__tests__/file-validation.test.ts
@@ -0,0 +1,125 @@
+import { describe, it, expect } from "vitest";
+import {
+  MAX_FILE_BYTES,
+  MAX_FILES,
+  getExtension,
+  isBlockedExtension,
+  isPreviewable,
+  sanitizeOriginalName,
+  validateFileList,
+  validateFileMeta,
+} from "../file-validation";
+
+describe("Story 1 — getExtension & isBlockedExtension (K1)", () => {
+  it("ekstensi dinormalkan lowercase", () => {
+    expect(getExtension("Foto.JPG")).toBe("jpg");
+    expect(getExtension("arsip.tar.gz")).toBe("gz");
+    expect(getExtension("tanpaext")).toBe("");
+    expect(getExtension(".gitignore")).toBe("");
+  });
+
+  it("blocklist: program & makro ditolak (case-insensitive)", () => {
+    for (const name of ["virus.exe", "Setup.MSI", "run.bat", "skrip.cmd", "x.scr", "app.apk", "lib.jar", "makro.docm", "tpl.dotm", "finansial.xlsm", "popup.hta"]) {
+      expect(isBlockedExtension(name)).toBe(true);
+    }
+  });
+
+  it("file normal lolos", () => {
+    for (const name of ["jawaban.jpg", "tugas.pdf", "laporan.docx", "video.mp4", "citra.heic"]) {
+      expect(isBlockedExtension(name)).toBe(false);
+    }
+  });
+});
+
+describe("Story 1 — isPreviewable (K2)", () => {
+  it("foto & PDF inline; svg DITOLAK (XSS)", () => {
+    expect(isPreviewable("image/jpeg")).toBe(true);
+    expect(isPreviewable("image/png")).toBe(true);
+    expect(isPreviewable("image/heic")).toBe(true);
+    expect(isPreviewable("application/pdf")).toBe(true);
+    expect(isPreviewable("image/svg+xml")).toBe(false);
+  });
+
+  it("dokumen & lainnya = tombol unduh", () => {
+    expect(isPreviewable("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(false);
+    expect(isPreviewable("application/zip")).toBe(false);
+    expect(isPreviewable("video/mp4")).toBe(false);
+    expect(isPreviewable("")).toBe(false);
+  });
+});
+
+describe("Story 1 — sanitizeOriginalName (K9)", () => {
+  it("path traversal dipangkas ke segmen terakhir", () => {
+    expect(sanitizeOriginalName("../../etc/passwd")).toBe("passwd");
+    expect(sanitizeOriginalName("C:\\Users\\Budi\\..\\tugas.docx")).toBe("tugas.docx");
+  });
+
+  it("karakter kontrol & kutip dibuang, spasi dirapikan", () => {
+    expect(sanitizeOriginalName("ja\x00wa\x1fban  final.pdf")).toBe("jawaban final.pdf");
+    expect(sanitizeOriginalName('we"ird\\name.pdf')).toBe("name.pdf"); // backslash = path separator
+    expect(sanitizeOriginalName('we"irdname.pdf')).toBe("weirdname.pdf");
+    expect(sanitizeOriginalName("  spasi   ganda  .docx ")).toBe("spasi ganda .docx");
+  });
+
+  it("nama super panjang dipotong maks 200 karakter (ekstensi dipertahankan)", () => {
+    const long = "a".repeat(300) + ".pdf";
+    const out = sanitizeOriginalName(long);
+    expect(out.length).toBeLessThanOrEqual(200);
+    expect(out.endsWith(".pdf")).toBe(true);
+  });
+
+  it("nama murni path kosong → string kosong", () => {
+    expect(sanitizeOriginalName("../../")).toBe("");
+    expect(sanitizeOriginalName("   ")).toBe("");
+  });
+});
+
+describe("Story 1 — validateFileMeta (K1–K3)", () => {
+  const base = { name: "jawaban.jpg", mimeType: "image/jpeg", sizeBytes: 1024 };
+
+  it("HAPPY: metadata valid", () => {
+    expect(validateFileMeta(base)).toEqual({ ok: true, ...base });
+  });
+
+  it("nama path-traversal disanitasi tapi tetap valid", () => {
+    const res = validateFileMeta({ ...base, name: "../x/jawaban.jpg" });
+    expect(res.ok).toBe(true);
+    if (res.ok) expect(res.name).toBe("jawaban.jpg");
+  });
+
+  it("ekstensi terblokir → error menyebut ekstensi", () => {
+    const res = validateFileMeta({ ...base, name: "makro.docm", mimeType: "application/msword" });
+    expect(res.ok).toBe(false);
+    if (!res.ok) expect(res.error).toContain("docm");
+  });
+
+  it("ukuran 0 / negatif / non-integer / >25MB → error", () => {
+    expect(validateFileMeta({ ...base, sizeBytes: 0 }).ok).toBe(false);
+    expect(validateFileMeta({ ...base, sizeBytes: -5 }).ok).toBe(false);
+    expect(validateFileMeta({ ...base, sizeBytes: 1.5 }).ok).toBe(false);
+    const over = validateFileMeta({ ...base, sizeBytes: MAX_FILE_BYTES + 1 });
+    expect(over.ok).toBe(false);
+    if (!over.ok) expect(over.error).toContain("25 MB");
+  });
+
+  it("mime kosong / kepanjangan → error", () => {
+    expect(validateFileMeta({ ...base, mimeType: "" }).ok).toBe(false);
+    expect(validateFileMeta({ ...base, mimeType: "a".repeat(256) }).ok).toBe(false);
+  });
+});
+
+describe("Story 1 — validateFileList (K3 jumlah)", () => {
+  const mk = (i: number) => ({ name: `f${i}.jpg`, mimeType: "image/jpeg", sizeBytes: 1000 });
+
+  it("tepat MAX_FILES lolos, satu lebih → error", () => {
+    expect(validateFileList(Array.from({ length: MAX_FILES }, (_, i) => mk(i))).ok).toBe(true);
+    const over = validateFileList(Array.from({ length: MAX_FILES + 1 }, (_, i) => mk(i)));
+    expect(over.ok).toBe(false);
+    if (!over.ok) expect(over.error).toContain("5 file");
+  });
+
+  it("satu file bermasalah menolak seluruh daftar", () => {
+    const res = validateFileList([mk(1), { name: "boom.exe", mimeType: "application/x-msdownload", sizeBytes: 10 }]);
+    expect(res.ok).toBe(false);
+  });
+});
diff --git a/src/modules/storage/file-validation.ts b/src/modules/storage/file-validation.ts
new file mode 100644
index 0000000..b28a00d
--- /dev/null
+++ b/src/modules/storage/file-validation.ts
@@ -0,0 +1,147 @@
+/**
+ * Story 1 — validasi file submission (murni, tanpa DB & tanpa SDK).
+ * Single source untuk aturan K1–K3 blueprint assignment-file:
+ * blocklist ekstensi, 25 MB/file, maks 5 file.
+ */
+
+export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
+export const MAX_FILES = 5;
+
+/** K1: format yang bisa "berjalan sendiri" di komputer — program & makro. */
+const BLOCKED_EXTENSIONS = new Set([
+  "exe",
+  "msi",
+  "bat",
+  "cmd",
+  "scr",
+  "apk",
+  "jar",
+  "docm",
+  "dotm",
+  "xlsm",
+  "hta",
+]);
+
+export function getExtension(name: string): string {
+  const idx = name.lastIndexOf(".");
+  if (idx <= 0 || idx === name.length - 1) return "";
+  return name.slice(idx + 1).toLowerCase();
+}
+
+export function isBlockedExtension(name: string): boolean {
+  return BLOCKED_EXTENSIONS.has(getExtension(name));
+}
+
+/**
+ * K2: boleh pratinjau inline. image/* + PDF — KECUALI SVG (skrip bisa
+ * diselundupkan ke halaman bila disajikan inline). Sisanya: tombol unduh.
+ */
+export function isPreviewable(mimeType: string): boolean {
+  const mt = (mimeType || "").toLowerCase();
+  if (mt === "image/svg+xml") return false;
+  return mt.startsWith("image/") || mt === "application/pdf";
+}
+
+/**
+ * K9: sanitasi nama tampilan — buang komponen path, karakter kontrol,
+ * rapikan spasi, potong 200 karakter. Nama asli hanya metadata tampilan.
+ */
+export function sanitizeOriginalName(raw: string): string {
+  // Ambil segmen terakhir dari path (unix & windows)
+  const base = raw.split(/[\\/]/).pop() ?? "";
+  let name = base
+    // karakter kontrol
+    .replace(/[\u0000-\u001f\u007f]/g, "")
+    // karakter yang berbahaya di header filename
+    .replace(/["\\]/g, "")
+    .trim()
+    // rapikan whitespace beruntun
+    .replace(/\s+/g, " ");
+  // buang titik/strip di ujung (Windows-era kebiasaan)
+  name = name.replace(/[.\s]+$/, "");
+  if (name.length > 200) {
+    const ext = getExtension(name);
+    if (ext) {
+      const maxStem = 200 - ext.length - 1;
+      name = `${name.slice(0, maxStem)}.${ext}`;
+    } else {
+      name = name.slice(0, 200);
+    }
+  }
+  return name;
+}
+
+export interface FileMetaInput {
+  name: string;
+  mimeType: string;
+  sizeBytes: number;
+}
+
+export type FileMetaValidation =
+  | {
+      ok: true;
+      name: string;
+      mimeType: string;
+      sizeBytes: number;
+    }
+  | { ok: false; error: string };
+
+export function validateFileMeta(file: FileMetaInput): FileMetaValidation {
+  const name = sanitizeOriginalName(file.name ?? "");
+  const mimeType = (file.mimeType ?? "").trim().toLowerCase();
+  const sizeBytes = Number(file.sizeBytes);
+
+  if (!name || name === "." || getExtension(name) === "" && !name.includes(" ")) {
+    // Nama kosong/tak berarti setelah sanitasi — contoh: "../../" atau "."
+    if (!name || name === ".") {
+      return { ok: false, error: "Nama file tidak valid." };
+    }
+  }
+
+  if (isBlockedExtension(name)) {
+    return {
+      ok: false,
+      error: `Jenis file .${getExtension(name)} tidak diperbolehkan (program/makro).`,
+    };
+  }
+
+  if (!Number.isFinite(sizeBytes) || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
+    return { ok: false, error: `Ukuran file "${name}" tidak valid.` };
+  }
+
+  if (sizeBytes > MAX_FILE_BYTES) {
+    return {
+      ok: false,
+      error: `File "${name}" melebihi 25 MB.`,
+    };
+  }
+
+  if (!mimeType || mimeType.length > 255) {
+    return { ok: false, error: `Tipe file "${name}" tidak valid.` };
+  }
+
+  return { ok: true, name, mimeType, sizeBytes };
+}
+
+export type FileListValidation =
+  | { ok: true; files: Array<{ name: string; mimeType: string; sizeBytes: number }> }
+  | { ok: false; error: string };
+
+export function validateFileList(files: FileMetaInput[]): FileListValidation {
+  if (!Array.isArray(files)) {
+    return { ok: false, error: "Daftar file tidak valid." };
+  }
+
+  if (files.length > MAX_FILES) {
+    return { ok: false, error: `Maksimal ${MAX_FILES} file per pengumpulan.` };
+  }
+
+  const validated = [];
+  for (const f of files) {
+    const res = validateFileMeta(f);
+    if (!res.ok) return res;
+    validated.push({ name: res.name, mimeType: res.mimeType, sizeBytes: res.sizeBytes });
+  }
+
+  return { ok: true, files: validated };
+}
diff --git a/src/modules/storage/storage.service.ts b/src/modules/storage/storage.service.ts
new file mode 100644
index 0000000..20fa4fc
--- /dev/null
+++ b/src/modules/storage/storage.service.ts
@@ -0,0 +1,152 @@
+/**
+ * Story 1 — adapter storage S3-compatible tunggal (K4–K5 blueprint).
+ * Cloudflare R2 sekarang, MinIO di server sendiri nanti: pindah cukup
+ * ganti env, tanpa ubah kode. Byte file TIDAK pernah lewat server Next.js:
+ * browser siswa mengunggah langsung via presigned POST, batas ukuran
+ * dipaksa oleh policy storage (content-length-range).
+ *
+ * Tanpa env S3_* modul ini mati anggun: isStorageConfigured() false,
+ * presign melempar StorageNotConfiguredError — submit teks/link tetap jalan.
+ */
+import { randomUUID } from "node:crypto";
+import {
+  DeleteObjectsCommand,
+  GetObjectCommand,
+  HeadObjectCommand,
+  S3Client,
+} from "@aws-sdk/client-s3";
+import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
+import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
+import { MAX_FILE_BYTES, getExtension, sanitizeOriginalName } from "./file-validation";
+
+export class StorageNotConfiguredError extends Error {
+  constructor() {
+    super("Penyimpanan file belum dikonfigurasi (S3_* kosong).");
+    this.name = "StorageNotConfiguredError";
+  }
+}
+
+const SUBMISSION_TMP_PREFIX = "submissions/tmp";
+
+export function isStorageConfigured(): boolean {
+  return Boolean(
+    process.env.S3_BUCKET &&
+      process.env.S3_ACCESS_KEY_ID &&
+      process.env.S3_SECRET_ACCESS_KEY
+  );
+}
+
+function requireEnv(): { bucket: string; client: S3Client } {
+  if (!isStorageConfigured()) throw new StorageNotConfiguredError();
+  const client = new S3Client({
+    endpoint: process.env.S3_ENDPOINT || undefined,
+    region: process.env.S3_REGION || "auto",
+    forcePathStyle: Boolean(process.env.S3_ENDPOINT), // MinIO & R2 path-style
+  });
+  return { bucket: process.env.S3_BUCKET as string, client };
+}
+
+/** Key sementara untuk upload siswa; dipin sebagai storageKey final saat submit. */
+export function buildTmpStorageKey(originalName: string): string {
+  const ext = getExtension(originalName);
+  const id = randomUUID();
+  return ext ? `${SUBMISSION_TMP_PREFIX}/${id}.${ext}` : `${SUBMISSION_TMP_PREFIX}/${id}`;
+}
+
+/** Hanya key keluaran buildTmpStorageKey yang boleh diklaim submission. */
+export function isClaimableSubmissionKey(storageKey: string): boolean {
+  return (
+    typeof storageKey === "string" &&
+    new RegExp(`^${SUBMISSION_TMP_PREFIX}/[0-9a-f-]{36}(\\.[a-z0-9]{1,20})?$`).test(storageKey)
+  );
+}
+
+export interface PresignedUpload {
+  storageKey: string;
+  uploadUrl: string;
+  fields: Record<string, string>;
+}
+
+/**
+ * Presigned POST dengan Content-Type terkunci + content-length-range —
+ * storage sendiri yang menolak file kebesaran/beda tipe.
+ */
+export async function presignSubmissionUpload(
+  storageKey: string,
+  mimeType: string
+): Promise<PresignedUpload> {
+  const { bucket, client } = requireEnv();
+  const { url, fields } = await createPresignedPost(client, {
+    Bucket: bucket,
+    Key: storageKey,
+    Conditions: [
+      ["content-length-range", 1, MAX_FILE_BYTES],
+      ["eq", "$Content-Type", mimeType],
+    ],
+    Fields: { "Content-Type": mimeType },
+    Expires: 600, // 10 menit cukup untuk HP lemot
+  });
+  return { storageKey, uploadUrl: url, fields };
+}
+
+export interface PresignedDownload {
+  url: string;
+}
+
+/** Presigned GET umur pendek (default 5 menit) untuk pratinjau/unduh. */
+export async function presignDownload(
+  storageKey: string,
+  opts: { filename?: string; disposition?: "inline" | "attachment"; expiresIn?: number } = {}
+): Promise<PresignedDownload> {
+  const { bucket, client } = requireEnv();
+  const disposition = opts.disposition ?? "attachment";
+  let contentDisposition: string = disposition;
+  if (disposition === "attachment" && opts.filename) {
+    const safe = sanitizeOriginalName(opts.filename).replace(/["\\\r\n]/g, "");
+    // ASCII fallback + UTF-8 extended (RFC 5987) untuk nama non-ASCII
+    const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
+    contentDisposition = `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
+  }
+  const url = await getSignedUrl(
+    client,
+    new GetObjectCommand({
+      Bucket: bucket,
+      Key: storageKey,
+      ResponseContentDisposition: contentDisposition,
+    }),
+    { expiresIn: opts.expiresIn ?? 300 }
+  );
+  return { url };
+}
+
+/** Ukuran objek di storage; null bila objek tidak ada (belum/ gagal upload). */
+export async function headObjectSize(storageKey: string): Promise<number | null> {
+  const { bucket, client } = requireEnv();
+  try {
+    const res = await client.send(
+      new HeadObjectCommand({ Bucket: bucket, Key: storageKey })
+    );
+    const size = res.ContentLength;
+    return typeof size === "number" ? size : null;
+  } catch {
+    return null;
+  }
+}
+
+/** Hapus objek (maks 1000/batch — cukup untuk resubmit). Kegagalan di-log pemanggil. */
+export async function deleteObjects(storageKeys: string[]): Promise<void> {
+  if (storageKeys.length === 0) return;
+  const { bucket, client } = requireEnv();
+  const chunks: string[][] = [];
+  for (let i = 0; i < storageKeys.length; i += 1000) {
+    chunks.push(storageKeys.slice(i, i + 1000));
+  }
+  for (const chunk of chunks) {
+    await client.send(
+      new DeleteObjectsCommand({
+        Bucket: bucket,
+        Delete: { Objects: chunk.map((Key) => ({ Key })) },
+      })
+    );
+  }
+}
diff --git a/src/modules/student-portal/__tests__/story1-submission-file.int.test.ts b/src/modules/student-portal/__tests__/story1-submission-file.int.test.ts
new file mode 100644
index 0000000..f4a8fef
--- /dev/null
+++ b/src/modules/student-portal/__tests__/story1-submission-file.int.test.ts
@@ -0,0 +1,295 @@
+import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
+
+/**
+ * Story 1 (file) — int test real-DB: klaim file presign → row submission_file,
+ * resubmit replace + hapus objek lama (K7), keepFileIds, guard REVIEWED,
+ * key tak-klaimable, objek hilang/ukuran bohong, mati-anggun tanpa S3,
+ * dan pintu akses file route (siswa pemilik vs siswa lain vs guru asing).
+ * Storage S3 di-mock — DB & logika bisnis nyata (pola story-8).
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
+// Mock hanya fungsi yang menyentuh S3 — validasi key murni tetap asli
+vi.mock("@/modules/storage/storage.service", async (importOriginal) => {
+  const actual = await importOriginal<typeof import("@/modules/storage/storage.service")>();
+  return {
+    ...actual,
+    isStorageConfigured: vi.fn(() => true),
+    headObjectSize: vi.fn(),
+    deleteObjects: vi.fn(async (_keys: string[]) => {}),
+    presignDownload: vi.fn(async () => ({ url: "https://storage.example/signed" })),
+  };
+});
+
+import { prisma, auth } from "@/lib/auth";
+import { hashPin } from "@/lib/student-pin";
+import { signStudentSessionToken } from "@/modules/student-auth/student-session";
+import { submitAssignmentAction } from "../student-submission.actions";
+import { headObjectSize, deleteObjects } from "@/modules/storage/storage.service";
+import { GET as submissionFileGET } from "@/app/api/assignments/files/[fileId]/route";
+import { NextRequest } from "next/server";
+
+const mockedHead = vi.mocked(headObjectSize);
+const mockedDelete = vi.mocked(deleteObjects);
+
+const KEY_A = "submissions/tmp/0e5e1e96-9bd6-4a8e-a108-4b0e7dd41111.jpg";
+const KEY_B = "submissions/tmp/1f5e1e96-9bd6-4a8e-a108-4b0e7dd42222.pdf";
+const KEY_C = "submissions/tmp/2f5e1e96-9bd6-4a8e-a108-4b0e7dd43333.docx";
+
+const FILE_A = { storageKey: KEY_A, name: "jawaban.jpg", mimeType: "image/jpeg", sizeBytes: 2048 };
+const FILE_B = { storageKey: KEY_B, name: "laporan.pdf", mimeType: "application/pdf", sizeBytes: 4096 };
+const FILE_C = { storageKey: KEY_C, name: "esai.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 8192 };
+
+function fileRequest(fileId: string, disposition?: string) {
+  const url = new URL(`http://localhost:3000/api/assignments/files/${fileId}`);
+  if (disposition) url.searchParams.set("disposition", disposition);
+  return new NextRequest(url);
+}
+
+describe("Story 1 Submission File — Real-DB Integration", { timeout: 60_000 }, () => {
+  let dbAvailable = false;
+  const timestamp = Date.now();
+
+  let schoolId: string;
+  let teachingContextId: string;
+  let studentId: string;
+  let otherStudentId: string;
+  let assignmentId: string;
+  let studentToken: string;
+  let otherStudentToken: string;
+  let savedFileId: string;
+
+  beforeAll(async () => {
+    try {
+      const school = await prisma.school.create({
+        data: {
+          name: `Sekolah FileStory1 ${timestamp}`,
+          normalizedName: `sekolah filestory1 ${timestamp}`,
+          npsn: `NPFS${timestamp.toString().slice(-5)}`,
+        },
+      });
+      schoolId = school.id;
+
+      const ap = await prisma.academicPeriod.create({
+        data: { schoolId, year: "2026/2027", semester: "Ganjil", status: "ACTIVE" },
+      });
+      const subject = await prisma.subject.create({ data: { name: `Fisika ${timestamp}`, schoolId } });
+
+      const tu = `teacher-fs1-${timestamp}`;
+      await prisma.user.create({
+        data: { id: tu, email: `${tu}@test.com`, name: "Guru FS1", emailVerified: true, createdAt: new Date(), updatedAt: new Date() },
+      });
+      const tp = await prisma.teacherProfile.create({
+        data: { userId: tu, activeSchoolId: schoolId, onboardingCompleted: true },
+      });
+
+      const cls = await prisma.class.create({
+        data: { schoolId, name: "7-F", gradeLevel: "7", joinCode: `FS1${timestamp.toString().slice(-4)}` },
+      });
+      const tc = await prisma.teachingContext.create({
+        data: { teacherProfileId: tp.id, schoolId, academicPeriodId: ap.id, subjectId: subject.id, classId: cls.id },
+      });
+      teachingContextId = tc.id;
+
+      const mkStudent = async (fullName: string, nis: string) => {
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
+        await prisma.classStudent.create({ data: { studentId: s.id, classId: cls.id, academicPeriodId: ap.id } });
+        return s;
+      };
+
+      const s1 = await mkStudent("Budi File Sender", `NISFS1${timestamp.toString().slice(-5)}`);
+      const s2 = await mkStudent("Ani Bukan Pemilik", `NISFS2${timestamp.toString().slice(-5)}`);
+      studentId = s1.id;
+      otherStudentId = s2.id;
+
+      const signToken = (s: typeof s1) =>
+        signStudentSessionToken({
+          studentId: s.id,
+          schoolId,
+          classId: cls.id,
+          academicPeriodId: ap.id,
+          nis: s.nis!,
+          fullName: s.fullName,
+          pinUpdatedAt: s.pinUpdatedAt!.toISOString(),
+        });
+      studentToken = signToken(s1);
+      otherStudentToken = signToken(s2);
+
+      const a = await prisma.assignment.create({
+        data: { teachingContextId: tc.id, title: "Tugas Foto Rangkaian", status: "ACTIVE", dueDate: new Date(Date.now() + 86_400_000) },
+      });
+      assignmentId = a.id;
+
+      currentCookieValue = studentToken;
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
+  it("HAPPY: submit dengan file → row submission_file + view berisi file", async () => {
+    if (!dbAvailable) return;
+    mockedHead.mockResolvedValue(FILE_A.sizeBytes);
+
+    const res = await submitAssignmentAction(assignmentId, { files: [FILE_A] });
+    expect(res.success).toBe(true);
+    expect(res.submission?.files).toHaveLength(1);
+    expect(res.submission?.files[0]).toMatchObject({
+      originalName: "jawaban.jpg",
+      mimeType: "image/jpeg",
+      sizeBytes: 2048,
+      isPreviewable: true,
+    });
+
+    const rows = await prisma.submissionFile.findMany({ where: { submission: { assignmentId, studentId } } });
+    expect(rows).toHaveLength(1);
+    expect(rows[0].storageKey).toBe(KEY_A);
+    savedFileId = rows[0].id;
+  });
+
+  it("RESUBMIT replace: 2 file lama diganti total → objek lama dihapus (K7)", async () => {
+    if (!dbAvailable) return;
+    mockedHead.mockReset().mockResolvedValue(FILE_B.sizeBytes);
+
+    // Set sekarang: tambah B (jadi A+B via keepFileIds)
+    const res1 = await submitAssignmentAction(assignmentId, {
+      files: [FILE_B],
+      keepFileIds: [savedFileId], // pertahankan A
+    });
+    expect(res1.success).toBe(true);
+    expect(res1.submission?.files).toHaveLength(2);
+
+    // Replace total: hanya C, tanpa keep
+    mockedHead.mockResolvedValue(FILE_C.sizeBytes);
+    const res2 = await submitAssignmentAction(assignmentId, { files: [FILE_C] });
+    expect(res2.success).toBe(true);
+    expect(res2.submission?.files).toHaveLength(1);
+    expect(res2.submission?.files[0].originalName).toBe("esai.docx");
+
+    const rows = await prisma.submissionFile.findMany({ where: { submission: { assignmentId, studentId } } });
+    expect(rows).toHaveLength(1);
+    expect(rows[0].storageKey).toBe(KEY_C);
+
+    // Objek A & B harus dihapus dari storage
+    expect(mockedDelete).toHaveBeenCalled();
+    const deletedKeys = mockedDelete.mock.calls.flat(2);
+    expect(deletedKeys).toContain(KEY_A);
+    expect(deletedKeys).toContain(KEY_B);
+  });
+
+  it("GUARD: REVIEWED → resubmit ditolak", async () => {
+    if (!dbAvailable) return;
+    await prisma.assignmentSubmission.updateMany({
+      where: { assignmentId, studentId },
+      data: { status: "REVIEWED", feedback: "Bagus", score: 90, reviewedAt: new Date() },
+    });
+    mockedHead.mockResolvedValue(FILE_A.sizeBytes);
+    const res = await submitAssignmentAction(assignmentId, { files: [FILE_A] });
+    expect(res.success).toBe(false);
+    if (!res.success) expect(res.error).toContain("terkunci");
+  });
+
+  it("GUARD: storageKey liar (bukan keluaran presign) → ditolak", async () => {
+    if (!dbAvailable) return;
+    await prisma.assignmentSubmission.updateMany({
+      where: { assignmentId, studentId },
+      data: { status: "SUBMITTED" },
+    });
+    const res = await submitAssignmentAction(assignmentId, {
+      files: [{ ...FILE_A, storageKey: "assignments/tmp/curi-key.jpg" }],
+    });
+    expect(res.success).toBe(false);
+    if (!res.success) expect(res.error).toContain("belum terunggah");
+  });
+
+  it("GUARD: objek hilang di storage (head null) → ditolak", async () => {
+    if (!dbAvailable) return;
+    mockedHead.mockResolvedValue(null);
+    const res = await submitAssignmentAction(assignmentId, { files: [FILE_A] });
+    expect(res.success).toBe(false);
+    if (!res.success) expect(res.error).toContain("belum selesai terunggah");
+  });
+
+  it("GUARD: ukuran objek bohong (≠ metadata) → ditolak", async () => {
+    if (!dbAvailable) return;
+    mockedHead.mockResolvedValue(999_999);
+    const res = await submitAssignmentAction(assignmentId, { files: [FILE_A] });
+    expect(res.success).toBe(false);
+    if (!res.success) expect(res.error).toContain("tidak sesuai");
+  });
+
+  it("GUARD: files [] tanpa teks/link → error minimal satu kanal", async () => {
+    if (!dbAvailable) return;
+    const res = await submitAssignmentAction(assignmentId, { files: [] });
+    expect(res.success).toBe(false);
+  });
+
+  it("ROUTE: siswa pemilik → 302 ke presigned URL", async () => {
+    if (!dbAvailable) return;
+    // Ambil id file TERKINI (row berganti id setiap replace)
+    const currentRow = await prisma.submissionFile.findFirst({
+      where: { submission: { assignmentId, studentId } },
+      orderBy: { createdAt: "desc" },
+    });
+    expect(currentRow).toBeTruthy();
+    currentCookieValue = studentToken;
+    const req = fileRequest(currentRow!.id, "inline");
+    const res = await submissionFileGET(req, { params: Promise.resolve({ fileId: currentRow!.id }) });
+    expect(res.status).toBe(302);
+    expect(res.headers.get("location")).toContain("storage.example");
+    savedFileId = currentRow!.id;
+  });
+
+  it("ROUTE: siswa lain (bukan pemilik) → 404 generik", async () => {
+    if (!dbAvailable) return;
+    currentCookieValue = otherStudentToken;
+    const req = fileRequest(savedFileId);
+    const res = await submissionFileGET(req, { params: Promise.resolve({ fileId: savedFileId }) });
+    expect(res.status).toBe(404);
+  });
+
+  it("ROUTE: tanpa sesi apa pun → 404 generik", async () => {
+    if (!dbAvailable) return;
+    currentCookieValue = null;
+    vi.spyOn(auth.api, "getSession").mockResolvedValue(null as never);
+    const req = fileRequest(savedFileId);
+    const res = await submissionFileGET(req, { params: Promise.resolve({ fileId: savedFileId }) });
+    expect(res.status).toBe(404);
+    vi.mocked(auth.api.getSession).mockRestore();
+  });
+});
diff --git a/src/modules/student-portal/__tests__/submission.service.test.ts b/src/modules/student-portal/__tests__/submission.service.test.ts
index d008259..c8cdae8 100644
--- a/src/modules/student-portal/__tests__/submission.service.test.ts
+++ b/src/modules/student-portal/__tests__/submission.service.test.ts
@@ -117,4 +117,69 @@ describe("Story 8 — isSubmissionLate (computed)", () => {
     expect(isSubmissionLate(new Date("2030-01-01T00:00:00Z"), null)).toBe(false);
     expect(isSubmissionLate(new Date("2030-01-01T00:00:00Z"), undefined)).toBe(false);
   });
-});
\ No newline at end of file
+});
+describe("Story 1 — validateSubmissionInput dengan kanal file", () => {
+  const fileA = {
+    storageKey: "submissions/tmp/0e5e1e96-9bd6-4a8e-a108-4b0e7dd41111.jpg",
+    name: "jawaban.jpg",
+    mimeType: "image/jpeg",
+    sizeBytes: 2048,
+  };
+
+  it("HAPPY: file saja → ok (tanpa teks/link)", () => {
+    const res = validateSubmissionInput({ files: [fileA] });
+    expect(res.ok).toBe(true);
+    if (res.ok) {
+      expect(res.textContent).toBeNull();
+      expect(res.linkUrl).toBeNull();
+      expect(res.files).toHaveLength(1);
+      expect(res.files?.[0].name).toBe("jawaban.jpg");
+    }
+  });
+
+  it("files undefined + kosong semua → error menyebut file", () => {
+    const res = validateSubmissionInput({});
+    expect(res.ok).toBe(false);
+    if (!res.ok) expect(res.error).toContain("file");
+  });
+
+  it("files: [] + kosong semua → error (set kosong bukan jawaban)", () => {
+    expect(validateSubmissionInput({ files: [] }).ok).toBe(false);
+  });
+
+  it("file terblokir di daftar → error blocklist", () => {
+    const res = validateSubmissionInput({
+      files: [{ ...fileA, name: "makro.docm", mimeType: "application/msword" }],
+    });
+    expect(res.ok).toBe(false);
+    if (!res.ok) expect(res.error).toContain("docm");
+  });
+
+  it("lebih dari 5 file → error jumlah", () => {
+    const many = Array.from({ length: 6 }, (_, i) => ({
+      ...fileA,
+      name: `f${i}.jpg`,
+    }));
+    const res = validateSubmissionInput({ files: many });
+    expect(res.ok).toBe(false);
+    if (!res.ok) expect(res.error).toContain("5 file");
+  });
+
+  it("file kebesaran (>25MB) → error ukuran", () => {
+    const res = validateSubmissionInput({
+      files: [{ ...fileA, sizeBytes: 26 * 1024 * 1024 }],
+    });
+    expect(res.ok).toBe(false);
+    if (!res.ok) expect(res.error).toContain("25 MB");
+  });
+
+  it("teks + file bersamaan → ok keduanya", () => {
+    const res = validateSubmissionInput({ textContent: "lihat foto", files: [fileA] });
+    expect(res.ok).toBe(true);
+  });
+
+  it("perilaku lama tetap: files undefined tidak divalidasi list", () => {
+    // Regresi Story 8 — input tanpa files tidak boleh rusak
+    expect(validateSubmissionInput({ textContent: "x" }).ok).toBe(true);
+  });
+});
diff --git a/src/modules/student-portal/components/SubmitAssignmentForm.tsx b/src/modules/student-portal/components/SubmitAssignmentForm.tsx
index a860e41..f81a095 100644
--- a/src/modules/student-portal/components/SubmitAssignmentForm.tsx
+++ b/src/modules/student-portal/components/SubmitAssignmentForm.tsx
@@ -6,13 +6,18 @@ import {
   Clock,
   Edit3,
   ExternalLink,
+  File as FileIcon,
+  Loader2,
   Lock,
+  Paperclip,
   Send,
   TimerReset,
+  Trash2,
   X,
 } from "lucide-react";
 import { toast } from "sonner";
 import { submitAssignmentAction } from "@/modules/student-portal/student-submission.actions";
+import { isBlockedExtension, MAX_FILES, MAX_FILE_BYTES } from "@/modules/storage/file-validation";
 import type { StudentSubmissionView } from "@/modules/assignments/submission.service";
 
 interface Props {
@@ -30,34 +35,178 @@ function fmtDateTime(iso: string): string {
   });
 }
 
+function fmtSize(bytes: number): string {
+  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
+  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
+}
+
+/** Item file di form: sudah tersimpan (punya id) atau pending upload. */
+type FileFormItem =
+  | { kind: "saved"; id: string; name: string; size: number; mimeType: string }
+  | { kind: "pending"; localId: string; name: string; size: number; mimeType: string; file: File };
+
+/** Upload langsung ke storage via presigned POST (XHR untuk progress). */
+function uploadToStorage(
+  uploadUrl: string,
+  fields: Record<string, string>,
+  file: File,
+  onProgress: (pct: number) => void
+): Promise<void> {
+  return new Promise((resolve, reject) => {
+    const xhr = new XMLHttpRequest();
+    xhr.open("POST", uploadUrl);
+    xhr.upload.onprogress = (e) => {
+      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
+    };
+    xhr.onload = () => {
+      if (xhr.status >= 200 && xhr.status < 300) resolve();
+      else reject(new Error(`Upload gagal (${xhr.status})`));
+    };
+    xhr.onerror = () => reject(new Error("Koneksi terputus saat mengunggah"));
+    const fd = new FormData();
+    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
+    fd.append("file", file);
+    xhr.send(fd);
+  });
+}
+
 export function SubmitAssignmentForm({ assignmentId, dueDateIso, submission }: Props) {
   const [open, setOpen] = useState(false);
   const [text, setText] = useState(submission?.textContent ?? "");
   const [link, setLink] = useState(submission?.linkUrl ?? "");
+  const [files, setFiles] = useState<FileFormItem[]>(() =>
+    (submission?.files ?? []).map((f) => ({
+      kind: "saved" as const,
+      id: f.id,
+      name: f.originalName,
+      size: f.sizeBytes,
+      mimeType: f.mimeType,
+    }))
+  );
+  const [progress, setProgress] = useState<Record<string, number>>({});
   const [pending, setPending] = useState(false);
   const [current, setCurrent] = useState<StudentSubmissionView | null>(submission);
 
   const locked = current?.status === "REVIEWED";
 
+  function validateLocal(f: File): string | null {
+    if (isBlockedExtension(f.name)) {
+      return `Jenis file ${f.name.split(".").pop()?.toUpperCase()} tidak diperbolehkan.`;
+    }
+    if (f.size > MAX_FILE_BYTES) return `File "${f.name}" melebihi 25 MB.`;
+    return null;
+  }
+
+  function handleAddFiles(list: FileList | null) {
+    if (!list) return;
+    for (const f of Array.from(list)) {
+      if (files.length >= MAX_FILES) {
+        toast.error(`Maksimal ${MAX_FILES} file per pengumpulan.`);
+        break;
+      }
+      const err = validateLocal(f);
+      if (err) {
+        toast.error(err);
+        continue;
+      }
+      files.push({
+        kind: "pending",
+        localId: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
+        name: f.name,
+        size: f.size,
+        mimeType: f.type || "application/octet-stream",
+        file: f,
+      });
+    }
+    setFiles([...files]);
+  }
+
+  function removeFile(item: FileFormItem) {
+    setFiles(files.filter((x) =>
+      item.kind === "pending" ? x.kind !== "pending" || x.localId !== item.localId : x.kind !== "saved" || x.id !== item.id
+    ));
+  }
+
   async function handleSubmit() {
     if (pending) return;
     setPending(true);
     try {
-      const res = await submitAssignmentAction(assignmentId, {
+      // 1. Upload file pending → presign → langsung ke storage
+      const pendingItems = files.filter((f): f is Extract<FileFormItem, { kind: "pending" }> => f.kind === "pending");
+      const uploaded: Array<{ storageKey: string; name: string; mimeType: string; sizeBytes: number }> = [];
+
+      if (pendingItems.length > 0) {
+        const res = await fetch("/api/assignments/files/upload-url", {
+          method: "POST",
+          headers: { "Content-Type": "application/json" },
+          body: JSON.stringify({
+            assignmentId,
+            files: pendingItems.map((f) => ({ name: f.name, mimeType: f.mimeType, sizeBytes: f.size })),
+          }),
+        });
+        const data = await res.json().catch(() => null);
+        if (!res.ok || !data?.uploads) {
+          toast.error(data?.error ?? "Gagal menyiapkan unggahan file.");
+          setPending(false);
+          return;
+        }
+
+        for (let i = 0; i < pendingItems.length; i++) {
+          const item = pendingItems[i];
+          const up = data.uploads[i];
+          try {
+            setProgress((p) => ({ ...p, [item.localId]: 1 }));
+            await uploadToStorage(up.uploadUrl, up.fields, item.file, (pct) =>
+              setProgress((prev) => ({ ...prev, [item.localId]: pct }))
+            );
+            uploaded.push({ storageKey: up.storageKey, name: item.name, mimeType: item.mimeType, sizeBytes: item.size });
+          } catch {
+            toast.error(`File "${item.name}" gagal diunggah — periksa koneksi.`);
+            setPending(false);
+            return;
+          }
+        }
+      }
+
+      // 2. Submit — set file final: upload baru (storageKey) + file lama yang
+      // dipertahankan (keepFileIds); sisanya dihapus oleh action (K7).
+      const saved = files
+        .filter((f): f is Extract<FileFormItem, { kind: "saved" }> => f.kind === "saved")
+        .map((f) => f.id);
+
+      const res2 = await submitAssignmentAction(assignmentId, {
         textContent: text,
         linkUrl: link,
+        files: uploaded.map((u) => ({
+          storageKey: u.storageKey,
+          name: u.name,
+          mimeType: u.mimeType,
+          sizeBytes: u.sizeBytes,
+        })),
+        keepFileIds: saved,
       });
-      if (res.success && res.submission) {
+
+      if (res2.success && res2.submission) {
         // isLate dihitung server (jam server vs dueDate) — jangan override pakai jam browser
-        setCurrent(res.submission);
+        setCurrent(res2.submission);
+        setFiles(
+          res2.submission.files.map((f) => ({
+            kind: "saved" as const,
+            id: f.id,
+            name: f.originalName,
+            size: f.sizeBytes,
+            mimeType: f.mimeType,
+          }))
+        );
+        setProgress({});
         setOpen(false);
         toast.success("Jawaban terkirim", {
-          description: res.submission.isLate
+          description: res2.submission.isLate
             ? "Terkirim setelah batas waktu — ditandai terlambat."
             : "Menunggu koreksi guru.",
         });
       } else {
-        toast.error(res.error ?? "Gagal menyimpan jawaban");
+        toast.error(res2.error ?? "Gagal menyimpan jawaban");
       }
     } catch {
       // Network/unexpected throw — jangan biarkan rejection tanpa feedback
@@ -74,6 +223,21 @@ export function SubmitAssignmentForm({ assignmentId, dueDateIso, submission }: P
           <CheckCircle2 className="w-3.5 h-3.5" />
           Sudah dinilai{current?.score != null ? ` — skor ${current.score}` : ""}
         </div>
+        {(current?.files?.length ?? 0) > 0 && (
+          <div className="flex flex-wrap gap-1.5">
+            {current!.files.map((f) => (
+              <a
+                key={f.id}
+                href={`/api/assignments/files/${f.id}`}
+                target="_blank"
+                rel="noopener noreferrer"
+                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50"
+              >
+                <FileIcon className="w-3 h-3" /> {f.originalName} ({fmtSize(f.sizeBytes)})
+              </a>
+            ))}
+          </div>
+        )}
         {current?.feedback && (
           <div className="rounded-lg bg-white border border-emerald-100 p-2.5">
             <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">
@@ -104,6 +268,21 @@ export function SubmitAssignmentForm({ assignmentId, dueDateIso, submission }: P
             </span>
           )}
         </div>
+        {current.files.length > 0 && (
+          <div className="flex flex-wrap gap-1.5">
+            {current.files.map((f) => (
+              <a
+                key={f.id}
+                href={f.id ? `/api/assignments/files/${f.id}` : "#"}
+                target="_blank"
+                rel="noopener noreferrer"
+                className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold text-amber-800 hover:bg-amber-100"
+              >
+                <FileIcon className="w-3 h-3" /> {f.originalName}
+              </a>
+            ))}
+          </div>
+        )}
         <button
           onClick={() => setOpen(true)}
           className="text-[10px] font-bold text-teal-700 flex items-center gap-1 hover:underline"
@@ -149,6 +328,45 @@ export function SubmitAssignmentForm({ assignmentId, dueDateIso, submission }: P
               className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
             />
           </div>
+
+          {/* File jawaban */}
+          <div className="space-y-1.5">
+            <label className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-500 cursor-pointer hover:border-teal-400 hover:text-teal-700">
+              <Paperclip className="w-3.5 h-3.5" />
+              Lampirkan file (foto/PDF/Word, maks {MAX_FILES} × 25 MB)
+              <input
+                type="file"
+                multiple
+                className="hidden"
+                onChange={(e) => {
+                  handleAddFiles(e.target.files);
+                  e.target.value = "";
+                }}
+              />
+            </label>
+            {files.map((f) => (
+              <div
+                key={f.kind === "pending" ? f.localId : f.id}
+                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
+              >
+                <FileIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
+                <span className="flex-1 min-w-0 truncate text-[10px] font-semibold text-slate-700">
+                  {f.name} <span className="text-slate-400">({fmtSize(f.size)})</span>
+                </span>
+                {f.kind === "pending" && progress[f.localId] != null && progress[f.localId] < 100 && (
+                  <Loader2 className="w-3 h-3 animate-spin text-teal-600" />
+                )}
+                <button
+                  onClick={() => removeFile(f)}
+                  aria-label={`Hapus ${f.name}`}
+                  className="text-slate-400 hover:text-rose-500"
+                >
+                  <Trash2 className="w-3 h-3" />
+                </button>
+              </div>
+            ))}
+          </div>
+
           {dueDateIso && (
             <p className="text-[9px] text-slate-400 flex items-center gap-1">
               <Clock className="w-2.5 h-2.5" />
@@ -160,7 +378,7 @@ export function SubmitAssignmentForm({ assignmentId, dueDateIso, submission }: P
             disabled={pending}
             className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-white text-[11px] font-bold py-2 hover:bg-teal-700 disabled:opacity-60 transition"
           >
-            <Send className="w-3.5 h-3.5" />
+            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
             {pending ? "Mengirim…" : current ? "Perbarui Jawaban" : "Kirim Jawaban"}
           </button>
         </div>
diff --git a/src/modules/student-portal/student-submission.actions.ts b/src/modules/student-portal/student-submission.actions.ts
index a4d00b1..8f80824 100644
--- a/src/modules/student-portal/student-submission.actions.ts
+++ b/src/modules/student-portal/student-submission.actions.ts
@@ -6,17 +6,49 @@ import { revalidatePath } from "next/cache";
 import {
   validateSubmissionInput,
   isSubmissionLate,
+  isPreviewable,
   type StudentSubmissionView,
+  type SubmissionFileInput,
 } from "@/modules/assignments/submission.service";
+import {
+  headObjectSize,
+  deleteObjects,
+  isClaimableSubmissionKey,
+  isStorageConfigured,
+} from "@/modules/storage/storage.service";
+
+function toFileView(f: {
+  id: string;
+  originalName: string;
+  mimeType: string;
+  sizeBytes: number;
+}): StudentSubmissionView["files"][number] {
+  return {
+    id: f.id,
+    originalName: f.originalName,
+    mimeType: f.mimeType,
+    sizeBytes: f.sizeBytes,
+    isPreviewable: isPreviewable(f.mimeType),
+  };
+}
 
 /**
  * Story 8 — action submit tugas dari portal siswa (teks/tautan).
- * Identitas selalu dari sesi siswa; tugas wajib ACTIVE & berada di rombel
- * periode aktif siswa. Resubmit hanya selama status SUBMITTED.
+ * Story 1 — + kanal file: upload presign terpisah, di sini file DIKLAIM:
+ * re-validasi server, HEAD-check ukuran objek, lalu replace atomik row +
+ * hapus objek lama (K7). Identitas selalu dari sesi siswa; tugas wajib
+ * ACTIVE & berada di rombel periode aktif siswa. Resubmit hanya selama
+ * status SUBMITTED.
  */
 export async function submitAssignmentAction(
   assignmentId: string,
-  input: { textContent?: string; linkUrl?: string }
+  input: {
+    textContent?: string;
+    linkUrl?: string;
+    files?: SubmissionFileInput[];
+    /** Id file existing yang dipertahankan saat replace (siswa edit jawaban). */
+    keepFileIds?: string[];
+  }
 ): Promise<{ success: boolean; error?: string; submission?: StudentSubmissionView }> {
   try {
     const session = await verifyStudentSession();
@@ -79,6 +111,42 @@ export async function submitAssignmentAction(
     }
 
     const now = new Date();
+
+    // Story 1 — klaim file SEBELUM tulis DB: key harus keluaran presign kita
+    // (prefix tmp), objek benar-benar ada, dan ukurannya jujur.
+    let fileRows: Array<{
+      storageKey: string;
+      originalName: string;
+      mimeType: string;
+      sizeBytes: number;
+    }> = [];
+    if (validation.files) {
+      if (validation.files.length > 0 && !isStorageConfigured()) {
+        return { success: false, error: "Penyimpanan file belum dikonfigurasi." };
+      }
+      for (const f of validation.files) {
+        if (!isClaimableSubmissionKey(f.storageKey)) {
+          return { success: false, error: `File "${f.name}" belum terunggah dengan benar.` };
+        }
+        const actualSize = await headObjectSize(f.storageKey);
+        if (actualSize == null) {
+          return {
+            success: false,
+            error: `File "${f.name}" belum selesai terunggah — coba lagi.`,
+          };
+        }
+        if (actualSize !== f.sizeBytes || actualSize > 25 * 1024 * 1024) {
+          return { success: false, error: `Ukuran file "${f.name}" tidak sesuai.` };
+        }
+        fileRows.push({
+          storageKey: f.storageKey,
+          originalName: f.name,
+          mimeType: f.mimeType,
+          sizeBytes: f.sizeBytes,
+        });
+      }
+    }
+
     // Guard race: update hanya bila masih SUBMITTED — review guru yang mendarat
     // di antara cek dan tulis tidak boleh tertimpa jadi SUBMITTED lagi.
     const updated = await prisma.assignmentSubmission.updateMany({
@@ -125,6 +193,45 @@ export async function submitAssignmentAction(
       return { success: false, error: "Gagal menyimpan jawaban. Coba lagi." };
     }
 
+    // Story 1 — replace set file bila dikirim (undefined = pertahankan semua).
+    // keepFileIds: id file lama yang tetap dipakai; sisanya dihapus (K7).
+    // Row dalam transaksi; objek lama dihapus SETELAH commit — kegagalan hapus
+    // hanya meninggalkan orphan (di-log), bukan kegagalan submit.
+    let currentFiles = await prisma.submissionFile.findMany({
+      where: { submissionId: saved.id },
+    });
+    if (validation.files) {
+      const keepIds = new Set(input.keepFileIds ?? []);
+      // Hanya id milik submission ini yang sah dipertahankan — id asing no-op.
+      const keptRows = currentFiles.filter((f) => keepIds.has(f.id));
+      const removedKeys = currentFiles
+        .filter((f) => !keepIds.has(f.id))
+        .map((f) => f.storageKey);
+      await prisma.$transaction([
+        prisma.submissionFile.deleteMany({ where: { submissionId: saved.id } }),
+        prisma.submissionFile.createMany({
+          data: [
+            ...keptRows.map((f) => ({
+              storageKey: f.storageKey,
+              originalName: f.originalName,
+              mimeType: f.mimeType,
+              sizeBytes: f.sizeBytes,
+              submissionId: saved.id,
+            })),
+            ...fileRows.map((f) => ({ ...f, submissionId: saved.id })),
+          ],
+        }),
+      ]);
+      currentFiles = await prisma.submissionFile.findMany({
+        where: { submissionId: saved.id },
+      });
+      if (removedKeys.length > 0) {
+        deleteObjects(removedKeys).catch((e) =>
+          console.error("[submitAssignmentAction] gagal hapus objek lama:", e)
+        );
+      }
+    }
+
     revalidatePath("/siswa/portal/tugas");
 
     return {
@@ -135,6 +242,7 @@ export async function submitAssignmentAction(
         status: saved.status,
         textContent: saved.textContent,
         linkUrl: saved.linkUrl,
+        files: currentFiles.map(toFileView),
         feedback: saved.feedback,
         score: saved.score,
         submittedAt: saved.submittedAt.toISOString(),
@@ -165,6 +273,7 @@ export async function getStudentSubmissionStatusAction(
       where: {
         assignmentId_studentId: { assignmentId, studentId: session.studentId },
       },
+      include: { files: true },
     });
 
     if (!submission) {
@@ -184,6 +293,7 @@ export async function getStudentSubmissionStatusAction(
         status: submission.status,
         textContent: submission.textContent,
         linkUrl: submission.linkUrl,
+        files: submission.files.map(toFileView),
         feedback: submission.feedback,
         score: submission.score,
         submittedAt: submission.submittedAt.toISOString(),

===== END-DIFF =====
