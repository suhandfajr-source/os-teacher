# Blueprint — Modul Tugas: File Jawaban Siswa & Lampiran Guru

> Status: **Disetujui untuk build** · Sumber: forge session `_bmad-output/forge/modul-tugas-via-file/` (HARDENED, 2 Okt 2025) · Ringkasan keputusan: `forged-idea.md` di folder yang sama

---

## 1. Ringkasan

Modul tugas KLASSA saat ini hanya menerima jawaban **teks** dan **link**. Blueprint ini menambahkan **file** ke dua arah:

```
Story 1 (V1a):  SISWA ──file jawaban──▶ GURU   (foto lembar jawaban, PDF, Word, dll.)
Story 2 (V1b):  GURU  ──file soal/materi──▶ SISWA  (foto soal, LKPD, bacaan)
```

Alasan utama: UI guru sudah menyuruh siswa "foto lembar jawaban dan upload ke portal siswa" — padahal portal belum bisa terima file; siswa terpaksa lewat Google Drive/WhatsApp.

## 2. Keputusan Produk (locked — dari sesi forge)

| # | Keputusan | Nilai |
|---|---|---|
| K1 | Jenis file | **Semua diterima KECUALI** program & makro: `.exe .msi .bat .cmd .scr .apk .jar .docm .dotm .xlsm .hta` |
| K2 | Pratinjau | Foto (JPG/PNG/HEIC) & PDF → inline. Lainnya → tombol **Unduh** + nama file asli |
| K3 | Limit | **25 MB/file, maks 5 file** per pengumpulan siswa / per tugas (lampiran guru) |
| K4 | Storage | Adapter **S3-compatible**. Sekarang **Cloudflare R2** (bucket dev & prod terpisah); nanti self-hosted **SeaweedFS** (MinIO terarsip Okt 2025) — pindah via env, tanpa ubah kode |
| K5 | Alur upload | Browser → **langsung ke storage** via presigned POST (file tidak lewat server Next.js) |
| K6 | Akses | Privat: siswa hanya file miliknya; guru hanya rombelnya; lampiran guru → seluruh siswa rombel aktif. Unduh via route terautentikasi → link berumur pendek. **Bukan public URL** |
| K7 | Resubmit siswa | Selama status SUBMITTED: file lama **dihapus** dari storage, diganti baru. Tidak ada arsip versi |
| K8 | Lampiran guru | Nempel di level **Assignment** (bukan sesi). Bebas diubah kapan saja (instruksi ≠ data penilaian). Terkunci otomatis mengikuti status assignment |
| K9 | Penamaan | Nama internal acak (cuid + ekstensi); nama asli = metadata tampilan |
| K10 | Rollover TA | Retensi file mengikuti playbook rollover — **perlu dicek saat implementasi** terhadap `docs/development/PLAYBOOK-ROLLOVER-TA.md` |

## 3. Arsitektur Teknis

### 3.1 Skema Prisma (2 tabel baru, relasi ke tabel existing)

```prisma
model SubmissionFile {
  id           String               @id @default(cuid())
  submissionId String
  submission   AssignmentSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  storageKey   String               // path objek di bucket, mis. submissions/<subId>/<cuid>.jpg
  originalName String               // nama tampilan, mis. Tugas3_Budi.docx
  mimeType     String
  sizeBytes    Int
  createdAt    DateTime             @default(now())

  @@index([submissionId])
  @@map("submission_file")
}

model AssignmentAttachment {
  id           String     @id @default(cuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  storageKey   String
  originalName String
  mimeType     String
  sizeBytes    Int
  createdAt    DateTime   @default(now())

  @@index([assignmentId])
  @@map("assignment_attachment")
}
```

`onDelete: Cascade` DB saja — **objek storage dihapus eksplisit oleh service** sebelum/bersamaan hapus row (storage tidak tahu FK).

### 3.2 Modul storage adapter — `src/modules/storage/`

```
storage/
  storage.service.ts   ← presignUploadPost(), presignGet(), deleteObject(), objectExists()
  file-validation.ts   ← blocklist K1, limit K3, previewable(), sanitizeOriginalName()
  __tests__/
```

- Library: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` + `@aws-sdk/s3-create-presigned-post` (standar S3; kompatibel R2 & SeaweedFS tanpa kode khusus).
- **Presigned POST** (bukan PUT) dipilih karena policy-nya bisa memaksa `content-length-range 1..25MB` → storage yang menolak file kebesaran, bukan cuma validasi client.
- Semua env opsional saat dev — modul melempar error jelas saat dipakai tanpa konfigurasi (fitur mati anggun, tidak menjatuhkan app lama).

### 3.3 Env baru

```
S3_ENDPOINT=            # R2: https://<account>.r2.cloudflarestorage.com ; lokal: http://127.0.0.1:8333 (SeaweedFS)
S3_REGION=auto          # R2 pakai "auto"
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_BUCKET=              # klassa-dev / klassa-prod
```

Pindah ke server sendiri nanti = ganti 5 baris ini. Nol perubahan kode.

### 3.4 Route API baru

| Route | Tugas | Guard |
|---|---|---|
| `POST /api/assignments/files/upload-url` | Terima metadata file (nama, mime, size, kind: `submission`\|`attachment`, assignmentId) → validasi server-side (K1, K3) → balikin `{fileId, uploadUrl, fields}` presigned POST | Siswa (session) untuk kind=submission; guru (auth) untuk kind=attachment |
| `GET /api/assignments/files/[fileId]` | Cek hak akses (K6) → 302 ke presigned GET (umur ±5 menit, `response-content-disposition: inline` untuk pratinjau / `attachment; filename=...` untuk unduh) | Per-table lookup + verifikasi relasi |

Orphan (file ter-upload tapi tak pernah diklaim): disimpan di prefix `tmp/` dengan TTL 24 jam pada nama key; claim = pindah row ke tabel + finalisasi key. Pembersihan orphan lintas-Instansi via scan prefix — **diimplementasikan sederhana di Story 1 sebagai utility, dijalankan manual/cron belakangan** (tidak blocking).

### 3.5 Alur submit siswa (Story 1)

1. Siswa pilih file di `SubmitAssignmentForm` → validasi client (K1, K3, feedback instan).
2. Per file: minta presigned POST → browser PUT langsung ke R2 → dapat `storageKey`.
3. Submit `submitAssignmentAction` dengan `files: [{storageKey, originalName, mimeType, sizeBytes}]`.
4. Server re-validasi penuh (jangan percaya client), HEAD-check size objek, lalu dalam transaksi: upsert submission + create `SubmissionFile` rows + **hapus objek file lama** (K7).
5. Text/link tetap valid — file jadi **kanal ketiga**, minimal salah satu dari teks/link/file harus ada.

### 3.6 Alur lampiran guru (Story 2)

1. Form buat tugas (`TugasClient`) + panel edit → upload file (flow presigned sama, kind=attachment).
2. `setAssignmentAttachmentsAction` menyetel daftar lampiran (add/remove; remove = hapus objek + row).
3. Portal siswa (detail tugas di `/siswa/portal/tugas`): bagian **Lampiran** — pratinjau inline foto/PDF, tombol unduh untuk lainnya.

### 3.7 UI yang disentuh

| Layar | Perubahan |
|---|---|
| `SubmitAssignmentForm` (portal siswa) | Input file + daftar file + progress; daftar file terkirim; badge terkunci saat REVIEWED |
| `/siswa/portal/tugas` | Tampil lampiran guru (Story 2) |
| `AssignmentRosterGradingView` tab ONLINE | Thumbnail/pratinjau + tombol unduh per file jawaban |
| `TugasClient` + dialog edit | Upload & kelola lampiran (Story 2) |
| Halaman detail tugas guru (optional ringan) | Tampilkan lampiran read-only |

## 4. Rencana Eksekusi (2 story berurutan)

**Story 1 — Infra + file jawaban siswa:** env & adapter storage → migrasi skema (`submission_file`) → route upload-url & download → ekstensi `submitAssignmentAction` + hapus file lama → UI SubmitAssignmentForm → UI grading view → unit test validasi + int test akses/hapus → cek rollover playbook (K10).

**Story 2 — Lampiran guru:** migrasi (`assignment_attachment`) → `setAssignmentAttachmentsAction` → UI upload di TugasClient → tampilan lampiran portal siswa → int test akses rombel.

Validasi tiap story: `npx tsc --noEmit`, `npm test`, dan smoke manual via dev server.

## 5. Yang secara sadar TIDAK dikerjakan

- Pratinjau inline .docx/.pptx (guru unduh dulu — trade-off disengaja)
- Konversi/optimasi HEIC otomatis (dicek saat pratinjau; jika gagal tampil → fallback unduh)
- Arsip versi file saat resubmit (K7: hapus)
- Kuota per-sekolah / per-siswa, antivirus scan, watermark
- Lampiran di level sesi mengajar
