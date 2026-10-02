# Verification Gap Review — Findings (Story 1: Modul Tugas via File)

**Lens:** verification-gap · **Target:** diff Story 1 — Pengumpulan Tugas via File (`storage.service.ts`, `file-validation.ts`, `/api/assignments/files/*`, `student-submission.actions.ts`, `assignment.actions.ts`, `submission.service.ts`, UI `SubmitAssignmentForm.tsx` & `AssignmentRosterGradingView.tsx`) · **Tanggal:** 2026-10-02  
**Basis verifikasi repo:** working tree di atas `origin/explore`, `npm test` = `vitest run` (`src/**/*.test.ts`), tanpa CI workflow (`.github/workflows` tidak ada).

---

## Screening

- **Non-behavioral (di-skip):**
  - `TODO.md` — backlog documentation.
  - `_bmad-output/forge/modul-tugas-via-file/*` (`.memlog.md`, `forge-report.html`, `forged-idea.md`) — metadata & artifact eksplorasi.
  - `_bmad-output/implementation-artifacts/spec-assignment-file-submission.md` & `docs/product/assignment-file-blueprint.md` — dokumen spesifikasi dan blueprint produk.
  - `src/modules/assignments/README.md` — dokumentasi modul.
  - `prisma/migrations/20261002074643_submission_file/migration.sql` — file migration SQL statis.

- **Behavioral (di-review):**
  - `src/modules/storage/storage.service.ts` — adapter S3/R2 presigned upload/download & manajemen objek.
  - `src/modules/storage/file-validation.ts` — aturan validasi file (blocklist ekstensi, batasan ukuran, pratinjau inline).
  - `src/app/api/assignments/files/upload-url/route.ts` — route handler POST presigned URL upload file.
  - `src/app/api/assignments/files/[fileId]/route.ts` — route handler GET pengunduhan file terotorisasi.
  - `src/modules/student-portal/student-submission.actions.ts` — aksi submit tugas + klaim file & resubmit replace.
  - `src/modules/assignments/assignment.actions.ts` — `getSubmissionQueueAction` dengan penambahan kanal `files`.
  - `src/modules/assignments/submission.service.ts` — validasi multi-kanal (teks/link/file) dan view shaping.
  - `src/app/siswa/portal/tugas/page.tsx`, `SubmitAssignmentForm.tsx`, dan `AssignmentRosterGradingView.tsx` — layer UI siswa dan guru.

---

## Yang Sudah Terverifikasi (Bukan Temuan)

- **Validasi Murni File (`file-validation.test.ts`):** 28 unit test memverifikasi blocklist ekstensi executable/makro (K1), batas ukuran 25MB (K3), kuota maks 5 file (K3), deteksi file previewable (image/PDF vs SVG ditolak inline K2), sanitasi nama file (K9), dan deteksi ganda MIME/ekstensi.
- **Validasi Input Pengumpulan (`submission.service.test.ts`):** 11 unit test memverifikasi minimal salah satu kanal terisi (teks, link, file), penolakan file bermasalah, trim whitespace, validasi URL absolut, dan batas panjang teks.
- **Klaim File & Resubmit Replace (`story1-submission-file.int.test.ts`):**
  - Happy path submit dengan file ke real-DB dan pembuatan row `submission_file`.
  - Replace total file lama: objek lama di S3 dipanggil `deleteObjects` (K7) dan `keepFileIds` mempertahankan file yang dipilih.
  - Guard status `REVIEWED` mengunci resubmit.
  - Guard `storageKey` tidak valid (bukan prefix tmp), objek tidak ditemukan di S3 (`headObjectSize` null), atau ukuran tidak cocok dengan metadata.
  - Mati anggun ketika `isStorageConfigured()` false (submit file ditolak, submit teks tetap sukses).
- **Otorisasi Unduh File Route (`story1-submission-file.int.test.ts`):**
  - Siswa pemilik file mendapat redirect 302 ke presigned GET URL.
  - Siswa lain (bukan pemilik) mendapat 404 generik.
  - Pengguna tanpa sesi mendapat 404 generik.
  - Guru asing (bukan pengampu teaching context) mendapat 404 generik.

---

## Findings

### Route handler `POST /api/assignments/files/upload-url` tidak memiliki cakupan test otomatis sama sekali

- **Changed surface:** `src/app/api/assignments/files/upload-url/route.ts:1-125` — seluruh route handler pembuat presigned URL upload untuk siswa.
- **Impacted consumer or site:** Form pengumpulan tugas siswa di browser pada `src/modules/student-portal/components/SubmitAssignmentForm.tsx:139` (`fetch("/api/assignments/files/upload-url", ...)`).
- **Existing test evidence:** Pencarian simbol `upload-url` di seluruh folder `src/**/__tests__` menghasilkan 0 hasil. Tidak ada test file maupun assertion yang mengimpor atau memanggil method `POST` dari rute ini.
- **Missing verification:** Integration/route test untuk `POST /api/assignments/files/upload-url` yang menguji:
  1. Status 200 dengan payload `{ uploads: [...] }` saat siswa aktif mengunggah file untuk tugas di rombel aktifnya.
  2. Status 401 saat sesi siswa tidak ada/invalid.
  3. Status 403 saat siswa tidak terdaftar di rombel periode aktif atau jika terjadi pelanggaran same-origin.
  4. Status 404 saat tugas berstatus non-ACTIVE atau milik rombel/periode lain (pencegahan kebocoran data tugas).
  5. Status 400 saat format file tidak valid atau kuota melebihi 5 file.
  6. Status 503 saat storage S3 belum dikonfigurasi.
- **Demonstration:** Ubah pengecekan header `validateSameOrigin` di `:20-37` agar selalu melempar atau memblokir, atau buat syntax error pada pemetaan `uploads.push(...)` di `:114` — seluruh 52 test di repo tetap lulus (PASS), namun tidak ada satu pun siswa yang bisa mengunggah file tugas dari browser di lingkungan produksi.
- **Consequence:** Titik masuk utama pengunggahan file siswa (infrastruktur presigned upload) dapat rusak atau gagal otorisasi di produksi tanpa terdeteksi oleh suite pengujian otomatis.
- **Disposition:** `patch` — tambahkan file test integrasi rute `src/app/api/assignments/files/__tests__/upload-url.route.test.ts` atau tambahkan skenario pengujian route handler ke `story1-submission-file.int.test.ts` dengan memanfaatkan pola request NextRequest seperti halnya route GET `[fileId]`.

---

### `getSubmissionQueueAction` tidak diverifikasi apakah memuat dan memetakan metadata `files` saat siswa mengumpulkan berkas

- **Changed surface:** `src/modules/assignments/assignment.actions.ts:88` (`include: { student: ..., files: true }`) dan `:107-113` (`files: r.files.map(...)`).
- **Impacted consumer or site:** Antrean koreksi tugas guru di `src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/page.tsx:28` dan komponen render tabel penilaian `AssignmentRosterGradingView.tsx:469-514`.
- **Existing test evidence:** `getSubmissionQueueAction` hanya dipanggil di `src/modules/student-portal/__tests__/story-8-submission-materi.int.test.ts:306,340`. Namun pada test tersebut, submission yang dibuat hanya berisi `textContent` dan `linkUrl` tanpa file. Di dalam `story1-submission-file.int.test.ts`, `getSubmissionQueueAction` sama sekali tidak diimpor maupun dipanggil.
- **Missing verification:** Pengecekan pada antrean guru bahwa setelah siswa mengumpulkan tugas via file, pemanggilan `getSubmissionQueueAction(teachingContextId, assignmentId)` mengembalikan item submission dengan properti `files` yang memuat metadata file (`id`, `originalName`, `mimeType`, `sizeBytes`, `isPreviewable: true/false`).
- **Demonstration:** Hapus `files: true` dari query `prisma.assignmentSubmission.findMany` di `assignment.actions.ts:88` atau ubah hasil mapping menjadi `files: []` — seluruh test di repo (termasuk `story-8-submission-materi.int.test.ts` dan `story1-submission-file.int.test.ts`) tetap lulus hijau, tetapi guru tidak akan melihat berkas apa pun di antrean penilaian.
- **Consequence:** Regresi pada query antrean guru dapat meloloskan rilis di mana guru tidak dapat melihat atau menilai file yang telah dikumpulkan siswa.
- **Disposition:** `patch` — tambahkan satu langkah test di `story1-submission-file.int.test.ts` yang memanggil `getSubmissionQueueAction(teachingContextId, assignmentId)` setelah `submitAssignmentAction` berhasil dan menegaskan bahwa `item.files` berisi berkas yang telah diunggah siswa.

---

### `getStudentSubmissionStatusAction` tidak memverifikasi pengembalian field `files` bagi siswa

- **Changed surface:** `src/modules/student-portal/student-submission.actions.ts:276` (`include: { files: true }`) dan `:296` (`files: submission.files.map(toFileView)`).
- **Impacted consumer or site:** Konsumen status submission siswa (misal saat polling, re-fetch status tugas, atau integrasi portal).
- **Existing test evidence:** `getStudentSubmissionStatusAction` hanya diuji di `story-8-submission-materi.int.test.ts:327`, yang hanya memverifikasi field `status`, `feedback`, `score`, dan `reviewedAt` pada submission teks murni. Test integrasi Story 1 (`story1-submission-file.int.test.ts`) tidak memanggil `getStudentSubmissionStatusAction`.
- **Missing verification:** Assertion bahwa pemanggilan `getStudentSubmissionStatusAction(assignmentId)` untuk tugas yang memiliki lampiran berkas mengembalikan daftar `files` yang lengkap dan terpetakan dengan benar.
- **Demonstration:** Hapus `include: { files: true }` pada baris 276 di `student-submission.actions.ts` atau kembalikan `files: []` — semua test vitest tetap hijau.
- **Consequence:** Siswa yang memeriksa kembali status tugasnya melalui server action ini akan menerima daftar berkas kosong, menimbulkan kebingungan seolah berkasnya hilang.
- **Disposition:** `patch` — tambahkan pemanggilan `getStudentSubmissionStatusAction(assignmentId)` di `story1-submission-file.int.test.ts` dan assert `res.submission.files` memiliki panjang dan atribut yang sesuai.

---

### Integrasi AWS SDK S3 pada `storage.service.ts` tidak memiliki unit/contract test langsung

- **Changed surface:** `src/modules/storage/storage.service.ts:60-148` (`presignSubmissionUpload`, `presignDownload`, `headObjectSize`, `deleteObjects`, `requireEnv`).
- **Impacted consumer or site:** Seluruh operasi storage S3 di `upload-url/route.ts`, `[fileId]/route.ts`, dan `student-submission.actions.ts`.
- **Existing test evidence:** Pada `story1-submission-file.int.test.ts:39-49`, modul `@/modules/storage/storage.service` di-mock seluruhnya (`headObjectSize`, `deleteObjects`, `presignDownload`, `isStorageConfigured`). Tidak ada file `storage.service.test.ts` di direktori `src/modules/storage/__tests__/`.
- **Missing verification:** Unit test yang memverifikasi pembentukan parameter ke AWS SDK (`@aws-sdk/s3-presigned-post`, `@aws-sdk/client-s3`, dan `@aws-sdk/s3-request-presigner`), khususnya:
  1. Batasan `content-length-range` dan kesesuaian `Content-Type` pada `createPresignedPost`.
  2. Format RFC 5987 `Content-Disposition` pada `presignDownload` (termasuk nama file dengan spasi/karakter khusus UTF-8).
  3. Batching chunk maksimal 1000 objek pada `deleteObjects`.
- **Demonstration:** Ubah format header RFC 5987 pada `presignDownload` atau batasan ukuran pada `presignSubmissionUpload` (misalnya batas byte salah hitung) — semua test di suite vitest tetap lulus karena fungsi-fungsi ini di-stub saat integrasi DB.
- **Consequence:** Kesalahan konfigurasi policy S3 atau pembentukan presigned URL dapat lolos ke staging/produksi tanpa peringatan dari automated testing.
- **Disposition:** `patch` — buat unit test `src/modules/storage/__tests__/storage.service.test.ts` dengan me-mock client SDK S3 (`@aws-sdk/client-s3` dan helper terkait) untuk memastikan parameter dan format URL yang dihasilkan presigner selalu tepat.

---

### Layer UI komponen baru (`SubmitAssignmentForm.tsx` & `AssignmentRosterGradingView.tsx`) tidak memiliki cakupan pengujian otomatis

- **Changed surface:** `src/modules/student-portal/components/SubmitAssignmentForm.tsx` (state manajemen upload file lokal, progress bar, multi-file form) dan `src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/AssignmentRosterGradingView.tsx:469-514` (render thumbnail preview gambar/PDF dan link download Word).
- **Impacted consumer or site:** Antarmuka siswa di `/siswa/portal/tugas` dan antarmuka guru di halaman penilaian tugas.
- **Existing test evidence:** Pencarian `*.test.tsx` atau `*.spec.tsx` di seluruh repositori menghasilkan 0 file. Repositori tidak menginstal `@testing-library/react`, `jsdom`, atau `happy-dom`.
- **Missing verification:** Component testing untuk interaksi penambahan berkas, progress upload, penghapusan item pending, dan rendering kartu file di UI.
- **Demonstration:** Terjadi runtime exception di browser pada fungsi upload XHR atau kesalahan pembacaan properti pada list berkas — suite vitest tidak mendeteksi karena hanya menjalankan pengujian backend/logic Node.js.
- **Consequence:** Regresi antarmuka pengguna hanya dapat terdeteksi melalui pengujian manual (human QA).
- **Disposition:** `defer` — repositori KLASSA saat ini belum mengadopsi infrastruktur pengujian komponen React/DOM; logika bisnis inti, validasi, dan otorisasi telah terisolasi dan diuji di level service dan server action.

---

## Other findings

- **Instabilitas ID file pada resubmit replace (`student-submission.actions.ts:209-228`):** Pada saat siswa memperbarui jawaban tugas dengan mempertahankan beberapa file (`keepFileIds`), implementasi saat ini menjalankan `prisma.submissionFile.deleteMany` lalu me-recreate baris lama via `prisma.submissionFile.createMany`. Hal ini menyebabkan semua file yang "dipertahankan" mendapatkan `id` baru (`cuid()`). Jika guru atau siswa masih membuka tab dengan ID lama, tautan unduhan lama tersebut langsung menjadi 404. Direkomendasikan untuk melakukan delete selektif (`where: { submissionId, id: { notIn: keepFileIds } }`) dan hanya melakukan insert untuk berkas yang baru, sehingga ID berkas lama tetap stabil.
- **Penanganan origin/referer pada `upload-url/route.ts`:** Fungsi `validateSameOrigin` mengizinkan request jika `origin` dan `referer` sama-sama kosong (`!origin || !host` lalu `!referer` mengembalikan `true`). Meskipun ini mencegah false-positive pada klien tertentu, pemanggil tanpa header origin/referer (misalnya request script non-browser yang membawa cookie) dapat meminta URL upload tanpa batasan same-origin.
