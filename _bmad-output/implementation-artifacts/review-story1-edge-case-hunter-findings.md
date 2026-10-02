# Hasil Review: Edge Case Hunter — Story 1 (Pengumpulan Tugas via File S3-Compatible)

**Sumber Prompt:** `_bmad-output/implementation-artifacts/review-story1-edge-case-hunter-prompt.md`  
**Fitur:** Siswa mengumpulkan tugas via file (upload S3-compatible: Cloudflare R2 / MinIO)  
**Total Temuan:** 23 temuan (18 edge-case jalur eksekusi, 4 klaim spec yang terfalsifikasi, 1 regresi deletion contract)  
*(Sesuai panduan reviewer Edge Case Hunter: murni path tracer tanpa opini subjektif atau ranking severity acak)*

---

## 1. Ringkasan Temuan Kritis (Keamanan & Integritas Data)

### 1. Bypass Batas Maksimal 5 File Saat Resubmit (`student-submission.actions.ts:200-225`)
- **Masalah:** Validasi jumlah file (`validateFileList`) hanya menghitung panjang array file baru yang dikirim dalam request (`input.files.length <= 5`). Saat siswa melakukan resubmit dengan mempertahankan file lama melalui `keepFileIds` (misal 4 file lama) dan menambah 3 file baru, total file yang dimasukkan ke tabel `submission_file` menjadi 7 file.
- **Dampak:** Invarian bisnis `"maks 5 file per submission — divalidasi client DAN server"` ditembus di sisi server. Siswa bisa menyimpan hingga 10 file per submission.
- **Solusi:** Guard jumlah gabungan sebelum transaksi database:
  ```ts
  if (keptRows.length + fileRows.length > 5) {
    return { success: false, error: "Maksimal 5 file per pengumpulan." };
  }
  ```

### 2. Resubmit File Lama Tertolak Salah (Deadlock Pengumpulan File) (`submission.service.ts:75-77`)
- **Masalah:** Fungsi murni `validateSubmissionInput` hanya menerima `files?: SubmissionFileInput[]` dan tidak mengenali `keepFileIds`. Jika siswa membuka form edit tugas untuk menghapus 1 file lama tanpa mengunggah file baru dan tanpa mengisi teks/link, `SubmitAssignmentForm` mengirimkan `files: []` dan `keepFileIds: [id1]`. Baris validasi `if (!textContent && !linkUrl && (!files || files.length === 0))` menganggap submission kosong dan melempar error: *"Isi jawaban teks, tautan, atau lampirkan file terlebih dahulu."*
- **Dampak:** Siswa terblokir total dan tidak dapat menyimpan perubahan/penghapusan lampiran lama jika tidak mengetik teks jawaban.
- **Solusi:** Sertakan `keepFileIds?: string[]` di antarmuka `SubmissionInput` dan validasi konten minimal:
  ```ts
  const hasFiles = (files && files.length > 0) || (input.keepFileIds && input.keepFileIds.length > 0);
  if (!textContent && !linkUrl && !hasFiles) {
    return { ok: false, error: "Isi jawaban teks, tautan, atau lampirkan file terlebih dahulu." };
  }
  ```

### 3. Bypass Proteksi XSS K2: Route File Mengizinkan `disposition=inline` untuk File Sembarang (`route.ts:25-27`)
- **Masalah:** Blueprint dan helper `file-validation.ts` menetapkan bahwa file SVG dilarang dipratinjau inline untuk mencegah Stored XSS. Namun di route `/api/assignments/files/[fileId]/route.ts`, query parameter `?disposition=inline` langsung diterima tanpa memeriksa apakah `file.mimeType` tergolong `isPreviewable`.
- **Dampak:** Penyerang yang mengunggah file SVG (atau HTML jika lolos) dapat meminta pratinjau inline; S3 menyajikan konten inline dan skrip berbahaya dieksekusi di browser korban (guru atau siswa lain).
- **Solusi:** Kunci `disposition` hanya boleh `"inline"` bila `isPreviewable(file.mimeType)` bernilai `true`:
  ```ts
  const requestedInline = request.nextUrl.searchParams.get("disposition") === "inline";
  const disposition = requestedInline && isPreviewable(file.mimeType) ? "inline" : "attachment";
  ```

### 4. Guru dengan Sesi Siswa Lama Terblokir 404 False-Positive (`route.ts:42-48`)
- **Masalah:** Di route `/api/assignments/files/[fileId]`, cabang autentikasi memeriksa `verifyStudentSession()` terlebih dahulu. Jika cookie sesi siswa ditemukan dan `studentId !== file.submission.studentId`, route langsung mengembalikan `notFound()` (404) tanpa pernah mengecek apakah ada sesi guru aktif (`teacherSession`).
- **Dampak:** Guru yang pernah melakukan login/pengujian di portal siswa pada browser yang sama (atau komputer sekolah bersama) akan selalu gagal membuka file submission siswa karena cookie siswa lama memblokir pengecekan otorisasi guru.
- **Solusi:** Jika sesi siswa tidak cocok dengan pemilik file, lanjutkan ke pemeriksaan sesi guru sebelum mengembalikan 404:
  ```ts
  if (studentSession && studentSession.studentId === file.submission.studentId) {
    // Sesi siswa pemilik sah
  } else {
    // Periksa sesi guru pemilik konteks
    const teacherSession = await auth.api.getSession({ headers: request.headers });
    // ... validasi guru ...
  }
  ```

### 5. Duplikasi `storageKey` Melempar P2002 Crash 500 (`student-submission.actions.ts:215-225`)
- **Masalah:** Kolom `storageKey` di tabel `submission_file` memiliki constraint `@unique`. Jika array `input.files` berisi item dengan `storageKey` yang sama (akibat bug client atau manipulasi request), pemanggilan `prisma.submissionFile.createMany` melempar Prisma Known Request Error P2002 yang tidak tertangani secara ramah dan menghasilkan HTTP 500.
- **Dampak:** Pengumpulan tugas gagal total dengan pesan kesalahan umum server.
- **Solusi:** Validasi bahwa setiap `storageKey` unik dalam batch input sebelum query database dijalankan:
  ```ts
  const uniqueKeys = new Set<string>();
  for (const f of validation.files) {
    if (uniqueKeys.has(f.storageKey)) {
      return { success: false, error: "Terdapat duplikasi file dalam lampiran." };
    }
    uniqueKeys.add(f.storageKey);
  }
  ```

---

## 2. Pemeriksaan Klaim Spesifikasi (Claims Check)

| # | Lokasi | Klaim Spec | Perilaku Nyata Kode | Hasil |
|---|--------|------------|---------------------|-------|
| 1 | `student-submission.actions.ts:140-145` | Acceptance: *"objek berada di prefix final (bukan tmp)"* | Objek di S3 tidak pernah dipindahkan atau di-copy; string `storageKey` disimpan langsung apa adanya dengan prefix `submissions/tmp/*`. | **FALSIFIED (High)** |
| 2 | `route.ts:60-65` | Matriks I/O: *"File hilang di storage ... Pratinjau/unduh menampilkan error ramah, tidak crash"* | Route langsung melakukan redirect HTTP 302 ke presigned URL S3 tanpa verifikasi keberadaan objek; browser menampilkan pesan error mentah XML `NoSuchKey` dari storage. | **FALSIFIED (High)** |
| 3 | `file-validation.ts:60-68` | Matriks I/O: *"Nama aneh ... dipotong 200 karakter"* | Jika nama memiliki ekstensi > 198 karakter, perhitungan `maxStem = 200 - ext.length - 1` bernilai negatif, menyebabkan slice menghasilkan nama sepanjang 450+ karakter. | **FALSIFIED (High)** |
| 4 | `route.ts:48-62` | Tasks: *"guru pemilik konteks (verifyTeachingContextAccess, tangkap throw -> 404)"* | Route tidak memanggil fungsi `verifyTeachingContextAccess`, melainkan mengulang query manual `teacherProfile.findFirst` dan `teachingContext.findUnique`. | **FALSIFIED (Medium)** |

---

## 3. Pemeriksaan Regresi Penghapusan (Deletion Check)

| # | Lokasi | Kontrak Lama | Dampak Perubahan | Hasil |
|---|--------|--------------|------------------|-------|
| 1 | `submission.service.ts:75-77` | Kontrak validasi submission lama memverifikasi keberadaan input mandiri per request. | Perubahan logika `(!files || files.length === 0)` tanpa memperhitungkan `keepFileIds` menyebabkan regresi di mana siswa yang sudah memiliki file lama tidak bisa menyimpan pengumpulan tanpa mengunggah file baru. | **REGRESSION (High)** |

---

## 4. Tabel Seluruh Temuan Jalur Eksekusi (Path Analysis)

| No | Lokasi | Kondisi Pemicu (Trigger Condition) | Cuplikan Guard (Pencegahan) | Potensi Konsekuensi |
|:--:|--------|------------------------------------|-----------------------------|---------------------|
| 1 | `student-submission.actions.ts:200-225` | Siswa resubmit dengan `keepFileIds` dan `files` baru hingga total > 5 file | `if (keptRows.length + fileRows.length > 5) return { success: false, error: "Maksimal 5 file." };` | Batas maksimal 5 file ditembus di server (hingga 10 file) |
| 2 | `submission.service.ts:75-77` | Resubmit mempertahankan file lama tanpa upload baru dan tanpa teks/link | Sertakan `keepFileIds` dalam evaluasi minimal kelengkapan jawaban | Siswa gagal simpan perubahan file lama jika teks kosong |
| 3 | `route.ts:25-27` | Request `?disposition=inline` untuk file non-previewable (SVG/HTML) | `const disposition = reqInline && isPreviewable(file.mimeType) ? "inline" : "attachment";` | Bypass proteksi XSS K2: script inline dieksekusi di browser |
| 4 | `route.ts:42-48` | Guru memiliki cookie `studentSession` lama bukan milik file terkait | Jika sesi siswa bukan pemilik, lanjutkan ke pemeriksaan sesi guru | Guru pemilik rombel mendapat 404 false-positive |
| 5 | `student-submission.actions.ts:215-225` | Input `files` memuat `storageKey` duplikat melanggar `@unique` di DB | Validasi keunikan `storageKey` dalam array `input.files` sebelum transaksi | Prisma error P2002 tak tertangani, request crash HTTP 500 |
| 6 | `upload-url/route.ts:75-105` | Permintaan presigned URL untuk tugas yang submission-nya sudah `REVIEWED` | Tolak request presign jika submission siswa sudah berstatus `REVIEWED` | File berhasil diunggah ke storage padahal tugas terkunci |
| 7 | `SubmitAssignmentForm.tsx:76-88` | Penambahan file baru memutasi array state `files` secara langsung (`files.push`) | `setFiles((prev) => [...prev, ...newItems]);` | Mutasi in-place state React melanggar immutability, potensi bug render |
| 8 | `SubmitAssignmentForm.tsx:95` | Browser mobile mengirim `file.type === ""` untuk foto atau dokumen | Infer MIME type dari ekstensi file jika `file.type` kosong | Foto tugas jatuh ke octet-stream, pratinjau inline gagal |
| 9 | `AssignmentRosterGradingView.tsx:470-475` | Siswa upload foto iPhone format `image/heic` yang lolos ke tag `<img>` | Filter `isBrowserRenderable` (`image/jpeg`, `image/png`, dsb.) untuk tag `<img>` | Ikon gambar rusak di browser Chrome/Edge/Firefox |
| 10 | `SubmitAssignmentForm.tsx:120-135` | Upload multi-file terputus di tengah jalan pada file ke-2 | Catat status keberhasilan upload per file agar file sukses tidak diulang | File yang sudah berhasil diunggah dikirim ulang dari nol |
| 11 | `SubmitAssignmentForm.tsx:50-58` | Koneksi jaringan terputus diam-diam (silent TCP drop) saat XHR POST | Pasang `xhr.timeout = 60000; xhr.ontimeout = ...` pada XHR | Form tergantung selamanya dalam status pending (loading) |
| 12 | `storage.service.ts:60-65` | Ekstensi file valid lebih dari 20 karakter (misal `.applicationmanifest`) | Perlebar regex validator `isClaimableSubmissionKey` ke `{1,64}` | File sukses di storage tapi ditolak saat klaim submit |
| 13 | `student-submission.actions.ts:210-225` | Resubmit menghapus seluruh baris lalu meng-insert ulang baris yang dipertahankan | Hanya `deleteMany` baris yang tidak ada di `keepFileIds`, jangan recreate baris lama | ID file berganti baru, link aktif guru/siswa menjadi 404 |
| 14 | `file-validation.ts:39-44` | Nama file tanpa ekstensi dan tanpa spasi (misal `"jawaban"`) | Bersihkan blok `if` luar yang tidak melakukan aksi apa pun | Logika validasi mati mengevaluasi kondisi tanpa efek |
| 15 | `student-submission.actions.ts:130-136` | Storage S3/R2 mengalami HTTP 500 atau timeout saat pengecekan HEAD | Bedakan respons 404 (NoSuchKey) dengan kegagalan server S3 5xx | Masalah koneksi server disalahkan ke siswa sebagai belum selesai |
| 16 | `upload-url/route.ts:20-30` | Server di balik reverse proxy dengan `x-forwarded-host` berbeda dari `host` | Gunakan `request.headers.get("x-forwarded-host") || ...` | Request upload URL ditolak 403 Forbidden di reverse proxy |
| 17 | `SubmitAssignmentForm.tsx:110-140` | Siswa pilih file lalu klik tombol 'X' batal, kemudian buka modal lagi | Reset state form dan daftar file ke data `current` saat modal ditutup/dibuka | File yang dibatalkan tertinggal dan ikut terkirim di submit berikutnya |
| 18 | `storage.service.ts:40-48` | Cek HEAD dan operasi storage multi-file dijalankan berurutan | Gunakan singleton instance `S3Client` alih-alih instansiasi baru tiap fungsi | Instansiasi S3Client berulang kali memboroskan TCP dan memori |

---

## 5. Salinan Format Data Mentah JSON (Review Contract)

```json
[
  {
    "location": "src/modules/student-portal/student-submission.actions.ts:200-225",
    "trigger_condition": "Siswa resubmit dengan keepFileIds dan files baru hingga total melebihi MAX_FILES (5)",
    "guard_snippet": "if (keptRows.length + fileRows.length > 5) return { success: false, error: \"Maksimal 5 file per pengumpulan.\" };",
    "potential_consequence": "Batas 5 file jebol di server, siswa bisa simpan hingga 10 file per submission"
  },
  {
    "location": "src/modules/assignments/submission.service.ts:75-77",
    "trigger_condition": "Siswa resubmit pertahankan file lama tanpa upload baru dan tanpa teks/link (files: [])",
    "guard_snippet": "if (!textContent && !linkUrl && (!files || files.length === 0) && (!input.keepFileIds || input.keepFileIds.length === 0))",
    "potential_consequence": "Siswa gagal simpan perubahan file lama jika tidak mengisi teks jawaban"
  },
  {
    "location": "src/app/api/assignments/files/[fileId]/route.ts:25-27",
    "trigger_condition": "Permintaan GET ?disposition=inline untuk file non-previewable (seperti SVG atau HTML)",
    "guard_snippet": "const disposition = request.nextUrl.searchParams.get(\"disposition\") === \"inline\" && isPreviewable(file.mimeType) ? \"inline\" : \"attachment\";",
    "potential_consequence": "Bypass proteksi XSS K2: script berbahaya dalam SVG/HTML dieksekusi di browser pengguna"
  },
  {
    "location": "src/app/api/assignments/files/[fileId]/route.ts:42-48",
    "trigger_condition": "Guru memiliki cookie studentSession lama di browser yang bukan pemilik file yang diakses",
    "guard_snippet": "if (studentSession && studentSession.studentId === file.submission.studentId) { /* ok */ } else { /* cek teacherSession */ }",
    "potential_consequence": "Guru pemilik rombel mendapat 404 false-positive saat memeriksa file siswa"
  },
  {
    "location": "src/modules/student-portal/student-submission.actions.ts:215-225",
    "trigger_condition": "Array files membawa storageKey duplikat yang melanggar constraint @unique di tabel submission_file",
    "guard_snippet": "const uniqueKeys = new Set(); for (const f of validation.files) { if (uniqueKeys.has(f.storageKey)) return { success: false, error: \"Duplikasi file.\" }; uniqueKeys.add(f.storageKey); }",
    "potential_consequence": "Prisma melempar error P2002 tak tertangani dan pengumpulan tugas crash 500"
  },
  {
    "location": "src/app/api/assignments/files/upload-url/route.ts:75-105",
    "trigger_condition": "Siswa meminta presigned upload URL untuk tugas yang status submission-nya sudah REVIEWED",
    "guard_snippet": "const existing = await prisma.assignmentSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId: session.studentId } } }); if (existing?.status === \"REVIEWED\") return NextResponse.json({ error: \"Tugas sudah dinilai.\" }, { status: 400 });",
    "potential_consequence": "Siswa bisa mengunggah file ke storage meskipun status tugas sudah terkunci permanen"
  },
  {
    "location": "src/modules/student-portal/components/SubmitAssignmentForm.tsx:76-88",
    "trigger_condition": "Siswa menambahkan file baru ke dalam form dialog pengumpulan tugas",
    "guard_snippet": "setFiles((prev) => [...prev, ...newPendingFiles]);",
    "potential_consequence": "Mutasi in-place array state React (files.push) melanggar immutability dan memicu render glitch"
  },
  {
    "location": "src/modules/student-portal/components/SubmitAssignmentForm.tsx:95",
    "trigger_condition": "Browser mobile mengirimkan file.type kosong (\"\") untuk foto atau dokumen",
    "guard_snippet": "mimeType: f.type || getMimeFromExtension(f.name) || \"application/octet-stream\",",
    "potential_consequence": "Foto tugas jatuh ke octet-stream sehingga tidak bisa dipratinjau inline oleh guru"
  },
  {
    "location": "src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/AssignmentRosterGradingView.tsx:470-475",
    "trigger_condition": "Siswa mengunggah foto Apple iPhone berformat image/heic yang lolos ke tag <img>",
    "guard_snippet": "const isBrowserRenderable = [\"image/jpeg\", \"image/png\", \"image/webp\", \"image/gif\"].includes(f.mimeType);",
    "potential_consequence": "Guru melihat ikon gambar rusak karena browser Chrome/Edge/Firefox tidak mendukung render HEIC"
  },
  {
    "location": "src/modules/student-portal/components/SubmitAssignmentForm.tsx:120-135",
    "trigger_condition": "Siswa upload beberapa file dan salah satu file gagal karena gangguan koneksi sesaat",
    "guard_snippet": "/* Simpan penanda uploaded per item agar tidak re-upload file yang sudah sukses */",
    "potential_consequence": "File yang sudah terunggah diunggah ulang dari nol saat klik coba lagi"
  },
  {
    "location": "src/modules/student-portal/components/SubmitAssignmentForm.tsx:50-58",
    "trigger_condition": "Koneksi jaringan terputus diam-diam (silent TCP drop) saat proses upload XHR ke S3",
    "guard_snippet": "xhr.timeout = 60000; xhr.ontimeout = () => reject(new Error(\"Unggahan melebihi batas waktu (timeout)\"));",
    "potential_consequence": "Tombol form tergantung selamanya dalam status pending tanpa umpan balik ke siswa"
  },
  {
    "location": "src/modules/storage/storage.service.ts:60-65",
    "trigger_condition": "File memiliki ekstensi valid lebih dari 20 karakter (misal .applicationmanifest)",
    "guard_snippet": "new RegExp(`^${SUBMISSION_TMP_PREFIX}/[0-9a-f-]{36}(\\\\.[a-z0-9]{1,64})?$`).test(storageKey)",
    "potential_consequence": "File berhasil diunggah ke storage namun ditolak saat klaim submit dengan error belum terunggah"
  },
  {
    "location": "src/modules/student-portal/student-submission.actions.ts:210-225",
    "trigger_condition": "Siswa resubmit dan mempertahankan file lama (seluruh row dihapus lalu di-insert ulang)",
    "guard_snippet": "/* Hanya deleteMany file yang tidak ada di keepFileIds, jangan re-create keptRows */",
    "potential_consequence": "ID file berganti baru sehingga link unduh/pratinjau yang sedang dibuka guru menjadi 404"
  },
  {
    "location": "src/modules/storage/file-validation.ts:39-44",
    "trigger_condition": "Nama file tanpa ekstensi dan tidak mengandung karakter spasi (misal nama jawaban)",
    "guard_snippet": "if (!name || name === \".\") return { ok: false, error: \"Nama file tidak valid.\" };",
    "potential_consequence": "Kondisi terluar dievaluasi sia-sia tanpa efek, menyamarkan logika validasi yang dimaksud"
  },
  {
    "location": "src/modules/student-portal/student-submission.actions.ts:130-136",
    "trigger_condition": "Server storage S3/R2 mengalami gangguan internal (HTTP 500) saat verifikasi HEAD",
    "guard_snippet": "/* Bedakan error 404 NoSuchKey dengan kesalahan infrastruktur S3 5xx */",
    "potential_consequence": "Masalah koneksi storage dituduhkan ke siswa sebagai file belum selesai terunggah"
  },
  {
    "location": "src/app/api/assignments/files/upload-url/route.ts:20-30",
    "trigger_condition": "Aplikasi berjalan di balik reverse proxy dengan header x-forwarded-host berbeda dari host",
    "guard_snippet": "const host = request.headers.get(\"x-forwarded-host\") || request.headers.get(\"host\");",
    "potential_consequence": "Semua request upload presigned POST ditolak 403 Forbidden pada lingkungan production proxy"
  },
  {
    "location": "src/modules/student-portal/components/SubmitAssignmentForm.tsx:110-140",
    "trigger_condition": "Siswa memilih file lalu klik tombol X (tutup modal) tanpa submit, kemudian buka lagi",
    "guard_snippet": "function handleClose() { setOpen(false); setFiles(getSavedFiles(current)); }",
    "potential_consequence": "File yang dibatalkan tertinggal di state form dan ikut terkirim di pengumpulan berikutnya"
  },
  {
    "location": "src/modules/storage/storage.service.ts:40-48",
    "trigger_condition": "Verifikasi submit memeriksa hingga 5 file secara berurutan dalam satu request",
    "guard_snippet": "let cachedClient: S3Client | null = null; function getClient() { return cachedClient ??= new S3Client(...); }",
    "potential_consequence": "Instansiasi S3Client baru berulang kali memboroskan memori dan koneksi TCP"
  },
  {
    "location": "src/modules/student-portal/student-submission.actions.ts:140-145",
    "kind": "claim",
    "confidence": "high",
    "trigger_condition": "objek berada di prefix final (bukan tmp)",
    "guard_snippet": "fileRows.push({ storageKey: f.storageKey /* disimpan langsung dengan prefix submissions/tmp/* */ })",
    "potential_consequence": "Objek tetap berada di prefix tmp selamanya, berisiko terhapus otomatis oleh lifecycle/cleanup rule"
  },
  {
    "location": "src/app/api/assignments/files/[fileId]/route.ts:60-65",
    "kind": "claim",
    "confidence": "high",
    "trigger_condition": "File hilang di storage ... Pratinjau/unduh menampilkan error ramah",
    "guard_snippet": "/* Route langsung 302 ke presigned URL tanpa cek keberadaan objek */ return NextResponse.redirect(url, 302);",
    "potential_consequence": "Pengguna diarahkan langsung ke error mentah XML NoSuchKey dari Cloudflare R2 / S3"
  },
  {
    "location": "src/modules/storage/file-validation.ts:60-68",
    "kind": "claim",
    "confidence": "high",
    "trigger_condition": "Disanitasi: strip path, buang karakter kontrol, potong 200 karakter",
    "guard_snippet": "const maxStem = Math.max(1, 200 - ext.length - 1); name = `${name.slice(0, maxStem)}.${ext}`.slice(0, 200);",
    "potential_consequence": "Ekstensi panjang (>198 karakter) menghasilkan nama 450+ karakter yang melanggar batas 200 karakter"
  },
  {
    "location": "src/app/api/assignments/files/[fileId]/route.ts:48-62",
    "kind": "claim",
    "confidence": "medium",
    "trigger_condition": "akses: siswa pemilik ATAU guru pemilik konteks (verifyTeachingContextAccess, tangkap throw -> 404)",
    "guard_snippet": "/* Menggunakan query manual teacherProfile + teachingContext alih-alih helper verifyTeachingContextAccess */",
    "potential_consequence": "Pengecekan akses guru terduplikasi secara manual dan tidak mewarisi kebijakan otorisasi terpusat"
  },
  {
    "location": "src/modules/assignments/submission.service.ts:75-77",
    "kind": "deletion",
    "confidence": "high",
    "trigger_condition": "Kontrak sebelumnya memvalidasi input secara independen per kanal tanpa menghalangi resubmit file yang ada",
    "guard_snippet": "Perluas antarmuka SubmissionInput dengan field keepFileIds agar submit hanya file lama tetap valid",
    "potential_consequence": "Siswa tidak dapat melakukan resubmit pengumpulan tugas yang hanya berisi file lampiran sebelumnya"
  }
]
```
