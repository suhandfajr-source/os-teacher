---
title: 'Story 1 — Siswa mengumpulkan tugas via file (upload S3-compatible)'
type: 'feature'
created: '2025-10-02'
status: 'done'
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

## Review Triage Log

**Pass 1 (3 layer eksternal, 2 Okt 2025)** — blind-hunter 12, edge-case 23, verification-gap 5+2 other. Verdict counts: high 4, medium 6, low 12, false 2, maybe-false 0.

| Temuan | Verdict | Route | Bukti/ringkas |
|---|---|---|---|
| BH1/E1 bypass MAX_FILES via keepFileIds (kept+new>5) | high | patch | `validateSubmissionInput` hanya hitung `input.files`; action gabung kept+new tanpa guard — aturan frozen "maks 5 file, validasi server" tertembus |
| BH2/E2/D1 resubmit keep-only (files:[] + keepFileIds) ditolak "isi jawaban dulu" | high | patch | Form kirim `files: []` saat siswa hanya edit/hapus file lama; validasi tak kenal keepFileIds → siswa terkunci. Frozen intent "minimal satu kanal" — file yang dipertahankan = kanal file |
| E3 route izinkan `disposition=inline` untuk non-previewable (SVG/HTML) | high | patch | Route tak cek `isPreviewable`; meski redirect ke domain storage (bukan domain app), ini menembus K2 — guard inline wajib |
| C2 objek hilang di storage → XML mentah NoSuchKey (bukan "error ramah" sesuai matriks frozen) | high | patch | Route 302 langsung; matriks frozen minta error ramah — tambah HEAD pre-check |
| BH5/E9 HEIC ditandai previewable tapi tak bisa dirender <img> di Chrome/Firefox/Edge | medium | patch | Guru Windows lihat broken image; pakai set browser-renderable untuk <img>, HEIC jadi chip unduh (blueprint WP#4 sudah mengantisipasi) |
| E4 guru dgn cookie sesi siswa lama → 404 false-positive | medium | patch | Mismatch siswa langsung 404 tanpa cek jalur guru — fall-through ke jalur guru |
| E5 storageKey duplikat → P2002 (bukan crash 500, tapi error generik + orphan) | low | patch | Guard dedupe sebelum transaksi (2 baris) |
| E8 file.type kosong (beberapa picker mobile) → octet-stream, preview hilang | medium | patch | Infer mime dari ekstensi di helper murni + unit test |
| E11 XHR tanpa timeout → form menggantung selamanya saat silent drop | medium | patch | `xhr.timeout = 60_000` + `ontimeout` |
| E12/C3 ekstensi >20 karakter: claim-regex vs builder tak sinkron; sanitize negative-slice saat ext >198 | low | patch | Clamp ext ≤20 di buildTmpStorageKey; guard maxStem<1 di sanitize |
| E13/BH4/VG-other1 replace-all → id file tak stabil, link terbuka jadi 404 | medium | patch | Delete selektif `notIn keepIds` + insert hanya file baru — id stabil |
| BH9 route unduh tak cek isStorageConfigured → 500 generik | low | patch | Catch StorageNotConfiguredError → 503 |
| BH12 query teachingContext redundan di route | low | patch (merged) | Digantikan adopsi `verifyTeachingContextAccess` (C4) yang sekaligus bawa cek banned/membership |
| C4 spec minta verifyTeachingContextAccess, kode query manual | medium | patch | Adopsi helper dalam try/catch → 404; lebih aman (ban check) |
| BH3/E7 mutasi in-place state React (files.push) | low | patch | Functional update |
| E14 blok if mati di validateFileMeta | low | patch | Bersihkan |
| E18 S3Client di-instansiasi per panggilan | low | patch | Singleton lazy |
| VG1 route upload-url nol test | high | patch | Tambah test route: 200/401/403-rombel-lain/404/400-blocklist/400->5file/503 |
| VG2 queue guru `files` tak ter-assert | high | patch | Assert `getSubmissionQueueAction` bawa files di int test |
| VG3 getStudentSubmissionStatusAction `files` tak ter-assert | medium | patch | Assert files di int test |
| VG4 storage.service tanpa unit test (policy POST, RFC5987, batching) | medium | patch | storage.service.test.ts dgn SDK di-mock |
| BH6/E10 file ter-upload di batch gagal → orphan tanpa rollback | low | reject→defer | Orphan di tmp DITOLERANSI per Design Notes; utility cleanup → deferred-work |
| BH7 tanpa lifecycle cleanup prefix tmp | low | defer | → deferred-work (utility scan prefix) |
| VG5 UI component tests tidak ada infra (@testing-library/jsdom) | low | defer | → deferred-work (infra adopsi, bukan bagian story) |
| BH8 superadmin/wali kelas tak bisa akses file | false-by-intent | reject | K6 frozen: "guru hanya rombelnya" — eksplisit di-lock user |
| BH10 MIME eq mismatch bikin 403 storage | false | reject | Client mengirim string MIME yang sama persis ke presign & FormData — mismatch tak mungkin dari klien kita |
| BH11 input file tanpa atribut accept | false-by-intent | reject | K1: SEMUA jenis diterima kecuali blocklist — accept tak bisa ekspresikan blocklist |
| C1 AC "prefix final (bukan tmp)" vs Design Notes "pin key tmp" | low | reject | Fix-nya = edit spec ini sendiri (AC wording); desain pin-tmp terdokumentasi & dipilih — ditolak per aturan |
| E6 presign masih bisa untuk submission REVIEWED | low | reject | UI locked saat REVIEWED (form read-only); hanya via API rakit; orphan ditoleransi |
| E15 HEAD 5xx disalahkan ke siswa "belum terunggah" | low | reject | Sinyal salah hanya saat outage S3; pesan tetap actionable (coba lagi) |
| E16 x-forwarded-host → 403 di reverse proxy | low | reject | Konsisten dgn pola validateSameOrigin modul templates (pre-existing); Vercel set host benar |
| E17 file pending tertinggal saat modal ditutup | low | reject | Daftar file tampil & bisa dihapus saat form dibuka lagi (draft persist, bukan silent) |
| VG-other2 same-origin lolos bila origin&referer kosong | low | reject | Butuh cookie siswa curian; kerusakan ≈ kerusakan eksisting action routes |

Tidak ada intent_gap / bad_spec → tidak ada loopback. Patch diterapkan langsung (implementer = sesi ini).

**Pass 1 patch (sesi ini)** — 21 temuan patch-class diterapkan: guard gabungan MAX_FILES, validasi keep-aware (keepFileIds di SubmissionInput), dedupe storageKey, delete selektif (id stabil), guard inline non-previewable, fall-through guru + adopsi verifyTeachingContextAccess, HEAD pre-check error ramah, 503 StorageNotConfigured, infer MIME ekstensi, set browser-renderable untuk <img>, XHR timeout, clamp ekstensi key, sanitasi ekstensi tak wajar, singleton S3Client, functional update React, cleanup dead code. Test tambahan: +3 deskrip unit (infer mime, renderable, sanitize), storage.service.test.ts (10), int +13 (keep-only, gabungan >5, dedupe, id stabil, queue/status files, route upload-url ×5, inline guard, HEAD 404, guru pemilik). Verifikasi akhir: tsc bersih; vitest 835/835 (73 file) setelah Neon pulih dari suspend (kegagalan lintas-modul sebelumnya = infra "Can't reach database server", bukan kode — story-5/6 flaky saat DB throttle, hijau kembali di run final).

**Post-done patch (uji lokal 2 Okt):** smoke-test end-to-end vs SeaweedFS lokal menemukan bug nyata yang lolos unit test (SDK di-mock): S3Client tidak meneruskan kredensial env kustom S3_* (SDK hanya membaca AWS_* default) → presign gagal "Could not load credentials". Fixed: credentials eksplisit di requireEnv(). Alur penuh terverifikasi lokal: presign POST → upload cross-origin 204 → HEAD cocok → GET presigned dgn Content-Disposition benar → delete ok. MinIO terarsip (dl.min.io 410) → rekomendasi self-host diganti SeaweedFS 4.48 (binary Windows, di C:\Users\<user>\seaweedfs, server jalan di 127.0.0.1:8333, kredensial klassa-dev). .env dev sudah diisi.
