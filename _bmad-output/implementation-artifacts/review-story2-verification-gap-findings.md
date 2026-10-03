# Verification Gap Review — Findings (Story 2: Lampiran Guru pada Tugas)

**Lens:** verification-gap · **Target:** diff Story 2 — Lampiran Guru pada Tugas (Soal/LKPD via File) (`storage.service.ts`, `/api/assignments/attachments/[fileId]/route.ts`, `/api/assignments/files/upload-url/route.ts`, `assignment.actions.ts`, UI `AssignmentAttachmentsDialog.tsx`, `TugasClient.tsx`, `page.tsx`, dan `portal/tugas/page.tsx`) · **Tanggal:** 2026-10-03  
**Basis verifikasi repo:** working tree di atas branch aktif, `npm test` = `vitest run` (74 test files, 851 passed).

---

## Screening

- **Non-behavioral (di-skip):**
  - `_bmad-output/implementation-artifacts/spec-assignment-attachments.md` — dokumen spesifikasi fitur.
  - `prisma/migrations/20261003042826_assignment_attachment/migration.sql` — skrip migrasi SQL tabel `assignment_attachment`.
  - `prisma/schema.prisma` — schema model Prisma (tipe divalidasi oleh Prisma generator & TypeScript compiler).

- **Behavioral (di-review):**
  - `src/modules/storage/storage.service.ts` — generalisasi prefix dan guard claim key (`buildTmpStorageKey`, `isClaimableKey`, `isClaimableSubmissionKey`).
  - `src/app/api/assignments/files/upload-url/route.ts` — otorisasi pembuat presigned URL untuk `kind === "attachment"` (guru pemilik vs siswa).
  - `src/app/api/assignments/attachments/[fileId]/route.ts` — pintu akses unduh/pratinjau lampiran tugas (otorisasi guru vs siswa rombel aktif, HEAD pre-check, inline guard).
  - `src/modules/assignments/assignment.actions.ts` — helper `claimAttachmentFiles`, pembuatan tugas berlampiran di `createAssignment`, aksi kelola `setAssignmentAttachmentsAction`, dan query `getAssignmentAttachmentsAction`.
  - `src/app/(dashboard)/kelas/[teachingContextId]/tugas/*` & `src/app/siswa/portal/tugas/page.tsx` — integrasi UI guru dan portal siswa.

---

## Yang Sudah Terverifikasi (Bukan Temuan)

- **Generalisasi Key Storage (`storage.service.test.ts`):** 2 unit test memverifikasi prefix `attachments/tmp/`, isolasi claim key antar jenis (`attachment` tidak bisa diklaim sebagai `submission` dan sebaliknya), serta backward-compatibility default jenis `submission`.
- **Happy Path Pembuatan Tugas & Klaim Lampiran (`story2-attachments.int.test.ts:207`):** Pemanggilan `createAssignment` dengan 2 file lampiran berhasil membuat row `assignment_attachment` di real DB dengan atribut `isPreviewable` terpetakan secara benar.
- **K8 Fleksibilitas Lampiran Pasca-Submission (`story2-attachments.int.test.ts:222`):** Guru dapat memperbarui lampiran (`setAssignmentAttachmentsAction`) setelah ada submission siswa masuk, mempertahankan file terpilih (`keepFileIds`), menambahkan file baru, dan memicu `deleteObjects` pada storage key file yang dibuang.
- **Guard Batas Maksimal & Duplikasi Key (`story2-attachments.int.test.ts:237,244`):** Penolakan server-side jika total file melebihi 5, atau jika terdeteksi duplikasi `storageKey` maupun key asing (`submissions/tmp/`).
- **Otorisasi Presign Upload (`story2-attachments.int.test.ts:315-375`):** Route handler `upload-url` menolak sesi siswa dengan 403, mengizinkan guru pemilik konteks dengan 200 (prefix `attachments/tmp/`), menolak guru asing dengan 404, dan memvalidasi kelengkapan parameter `teachingContextId`.
- **Mati Anggun Penyimpanan (`story2-attachments.int.test.ts:384`):** Ketika `isStorageConfigured()` false, klaim lampiran ditolak dengan pesan informatif, namun pembuatan tugas tanpa file tetap berjalan normal.

---

## Findings

### Parameter `disposition` pada pemanggilan `presignDownload` di route GET lampiran tidak diverifikasi nilainya

- **Changed surface:** `src/app/api/assignments/attachments/[fileId]/route.ts:88-95` — logika penentuan header Content-Disposition inline vs attachment berdasarkan query param `disposition=inline` dan filter `isPreviewable(file.mimeType)`.
- **Impacted consumer or site:** Konsumen endpoint unduh/pratinjau lampiran tugas di `src/app/api/assignments/attachments/[fileId]/route.ts:92` yang memanggil `presignDownload(file.storageKey, { filename, disposition })`.
- **Existing test evidence:** Pada `src/modules/assignments/__tests__/story2-attachments.int.test.ts:272-277`, test memanggil `attachmentGET(attachmentRequest(target.id, "inline"))` dan hanya menegaskan `expect(res302.status).toBe(302)`. Modul `presignDownload` di-mock pada baris 37 tetapi tidak pernah diimpor maupun di-assert argumen pemanggilannya.
- **Missing verification:** Pengecekan eksplisit terhadap argumen kedua `presignDownload`:
  1. Memastikan file bertipe previewable (seperti PDF atau JPEG) menerima `{ disposition: "inline" }` saat `?disposition=inline` diminta.
  2. Memastikan file bertipe non-previewable (seperti DOCX pada `FILE_C`) tetap dipaksa menerima `{ disposition: "attachment" }` meskipun pengguna mengirim query `?disposition=inline`.
  3. Memastikan permintaan tanpa query param `disposition` menggunakan nilai default `"attachment"`.
- **Demonstration:** Ubah baris 89-90 di `route.ts` menjadi `const disposition = "attachment";` (atau sebaliknya hapus guard `isPreviewable(file.mimeType)` sehingga semua file dibuka inline). Seluruh test di `story2-attachments.int.test.ts` tetap PASS (hijau 100%) karena test hanya mengecek status HTTP 302 tanpa memeriksa opsi yang diteruskan ke S3 presigner.
- **Consequence:** Regresi pada pemilihan mode download/inline atau celah keamanan rendering file non-previewable dapat lolos ke produksi tanpa terdeteksi otomatis.
- **Disposition:** `patch` — impor `presignDownload` di `story2-attachments.int.test.ts`, bersihkan mock sebelum request, dan assert `mockedPresignDownload.mock.calls[0][1].disposition` bernilai `"inline"` untuk PDF dan `"attachment"` untuk file non-previewable atau request default.

---

### Validasi ketidaksesuaian ukuran file dan upload yang belum selesai pada `claimAttachmentFiles` tidak diuji

- **Changed surface:** `src/modules/assignments/assignment.actions.ts:85-93` — validasi ukuran objek via `headObjectSize`: penolakan jika objek belum selesai terunggah (`actualSize == null`) atau jika ukuran berbeda dari metadata yang diklaim (`actualSize !== f.sizeBytes || actualSize > 25MB`).
- **Impacted consumer or site:** Pemanggilan `claimAttachmentFiles` dari `createAssignment` (`assignment.actions.ts:120`) dan `setAssignmentAttachmentsAction` (`assignment.actions.ts:661`).
- **Existing test evidence:** Pencarian string `"tidak sesuai"` dan `"belum selesai"` pada `src/modules/assignments/__tests__/story2-attachments.int.test.ts` menghasilkan 0 hasil. Setup `mockedHead` pada baris 193 selalu mengembalikan ukuran yang persis sama dengan ukuran fixture.
- **Missing verification:** Unit/integration test yang memverifikasi penolakan aksi ketika:
  1. `headObjectSize` mengembalikan ukuran yang berbeda dari `sizeBytes` yang dikirim client.
  2. `headObjectSize` mengembalikan `null` (file gagal terunggah atau key tidak ada di bucket storage).
- **Demonstration:** Komentari atau hapus pengecekan baris 91 di `assignment.actions.ts`:
  ```ts
  // if (actualSize !== f.sizeBytes || actualSize > 25 * 1024 * 1024)
  ```
  Jalankan `npm test` — seluruh test di `story2-attachments.int.test.ts` tetap lulus, membuktikan branch deteksi manipulasi ukuran tidak dijaga oleh test mana pun.
- **Consequence:** Manipulasi metadata ukuran file atau klaim file yang belum selesai/gagal diunggah tidak terdeteksi, berpotensi menciptakan row lampiran "hantu" di database yang rusak saat diakses siswa.
- **Disposition:** `patch` — tambahkan satu test case di `story2-attachments.int.test.ts` yang mengatur `mockedHead.mockResolvedValueOnce(999999)` (mismatch) dan `mockedHead.mockResolvedValueOnce(null)` saat memanggil `setAssignmentAttachmentsAction`, lalu pastikan aksi mengembalikan error yang sesuai.

---

### Route GET `[fileId]` lampiran tidak memverifikasi penolakan pengguna tanpa sesi dan guru tanpa hak akses

- **Changed surface:** `src/app/api/assignments/attachments/[fileId]/route.ts:48-77` — otorisasi akses file lampiran yang mewajibkan pengguna terverifikasi sebagai guru pemilik konteks atau siswa rombel aktif.
- **Impacted consumer or site:** Route handler `GET /api/assignments/attachments/[fileId]` di `src/app/api/assignments/attachments/[fileId]/route.ts:23`.
- **Existing test evidence:** Pada `story2-attachments.int.test.ts:252-280`, pengujian 404 hanya dilakukan dengan token siswa dari rombel lain (`otherRombelStudentToken`). Tidak ada skenario pengujian dengan `currentCookieValue = null` di mana otorisasi guru juga gagal.
- **Missing verification:** Assertion bahwa ketika request datang dari:
  1. Pengunjung anonim (tanpa cookie sesi siswa dan tanpa sesi guru).
  2. Guru dari sekolah atau konteks lain (`verifyTeachingContextAccess` melempar Error dan tanpa sesi siswa).
  Endpoint merespons dengan HTTP status 404 (generik tanpa kebocoran data).
- **Demonstration:** Jika pada `route.ts:77` logika otorisasi diubah menjadi `if (!authorized && studentSession) return notFound();` (sehingga request tanpa sesi siswa secara keliru lolos), test `otherRombelStudentToken` tetap lulus (karena memiliki sesi), dan semua test lainnya tetap lulus karena test guru selalu me-resolve mock auth.
- **Consequence:** Kerentanan akses publik tanpa autentikasi ke file lampiran tugas guru dapat lolos pengujian otomatis.
- **Disposition:** `patch` — tambahkan skenario di `story2-attachments.int.test.ts` di mana `currentCookieValue = null` dan `mockedVerifyContext.mockImplementation(() => { throw new Error("Forbidden"); })`, lalu assert `attachmentGET` menghasilkan status 404.

---

### Pembuatan tugas baru berlampiran (`createAssignment`) tidak memiliki pengujian kondisi kegagalan klaim berkas

- **Changed surface:** `src/modules/assignments/assignment.actions.ts:118-125` — transaksi pra-klaim lampiran sebelum pembuatan entitas tugas.
- **Impacted consumer or site:** Form pembuatan tugas guru di `src/app/(dashboard)/kelas/[teachingContextId]/tugas/TugasClient.tsx:122` (`createAssignment(...)`).
- **Existing test evidence:** `story2-attachments.int.test.ts:207-220` hanya menguji happy path `createAssignment` dengan 2 file valid. Guard kuota > 5 file dan duplikasi key di baris 237-250 hanya diuji pada `setAssignmentAttachmentsAction`, bukan pada `createAssignment`.
- **Missing verification:** Pengecekan bahwa saat `createAssignment` menerima array `files` yang tidak valid (misalnya duplikat key, file > 25MB, atau key palsu), fungsi melempar error dan memastikan tidak ada record `Assignment` kosong yang terbentuk di database.
- **Demonstration:** Hapus `throw new Error(claimed.error)` di `assignment.actions.ts:122` dan biarkan proses berlanjut dengan `attachmentRows = []`. Tidak ada test untuk `createAssignment` yang gagal, sehingga regresi pembentukan tugas cacat (tugas terbuat tanpa lampiran yang diunggah guru) tidak akan tertangkap.
- **Consequence:** Jika klaim lampiran gagal sebagian atau diabaikan, tugas tetap terbuat di sistem tanpa lampiran yang dimaksud oleh guru, membingungkan siswa yang membaca instruksi tugas.
- **Disposition:** `patch` — tambahkan satu test case di `story2-attachments.int.test.ts` yang memanggil `createAssignment` dengan duplikat `storageKey` dan assert bahwa pemanggilan tersebut melempar Error serta tidak ada row `assignment` baru yang tersimpan di DB.

---

### Otorisasi status periode akademik aktif pada route GET `[fileId]` lampiran belum teruji

- **Changed surface:** `src/app/api/assignments/attachments/[fileId]/route.ts:69` — klausa `academicPeriod: { status: "ACTIVE" }` pada verifikasi membership siswa.
- **Impacted consumer or site:** Route handler `GET /api/assignments/attachments/[fileId]/route.ts`.
- **Existing test evidence:** Fixture pada `story2-attachments.int.test.ts:122` membuat `AcademicPeriod` dengan `status: "ACTIVE"`. Tidak ada test case yang menyimulasikan periode berstatus `ARCHIVED` atau `INACTIVE`.
- **Missing verification:** Assertion bahwa siswa yang terdaftar di kelas yang tepat namun periode akademiknya sudah non-aktif/arsip akan menerima respons 404 saat mencoba mengakses lampiran tugas.
- **Demonstration:** Hapus baris `academicPeriod: { status: "ACTIVE" }` pada query `findFirst` di `route.ts:69`. Seluruh 851 test vitest tetap lulus tanpa kegagalan.
- **Consequence:** Siswa pada periode semester lalu dapat tetap mengunduh berkas tugas dari periode yang sudah selesai/diarsipkan.
- **Disposition:** `defer` — risiko rendah karena siklus hidup siswa di portal umumnya dibatasi oleh konteks tahun ajaran aktif, dapat ditambahkan saat pengujian siklus pengarsipan periode akademik.

---

## Other findings

- **Pengecekan akun dinonaktifkan (`assertNotBanned`) terlewat pada `setAssignmentAttachmentsAction` dan `getAssignmentAttachmentsAction`:** Pada `assignment.actions.ts:633-745`, fungsi `setAssignmentAttachmentsAction` dan `getAssignmentAttachmentsAction` memanggil `verifyTeachingContextAccess` tetapi tidak memanggil `assertNotBanned(auth)`. Berbeda dengan `createAssignment` (baris 113) dan aksi guru lainnya yang secara konsisten memblokir akun yang di-ban, guru yang statusnya dinonaktifkan oleh admin sekolah secara teori masih bisa memperbarui atau mengambil lampiran tugas.
- **`getAssignmentAttachmentsAction` merupakan Dead Export:** Fungsi `getAssignmentAttachmentsAction` di `assignment.actions.ts:717` dibuat dan diuji dalam test integrasi, tetapi tidak digunakan sama sekali oleh komponen antarmuka mana pun (`AssignmentAttachmentsDialog` sepenuhnya mengandalkan props `initialAttachments` dari server page).
