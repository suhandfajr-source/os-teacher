# Forged Idea — Pengumpulan Tugas via File (KLASSA)

Status: **HARDENED** — 2 Okt 2025 · Sesi: `_bmad-output/forge/modul-tugas-via-file/`

## Keputusan (locked)

### Story 1 — File jawaban siswa (V1a)

- **Scope V1:** file hanya untuk **jawaban siswa**. Lampiran guru (soal/LKPD) menyusul, bukan satu paket.
- **Jenis file:** **semua diterima KECUALI** program & makro (`.exe`, `.msi`, `.bat`, `.cmd`, `.scr`, `.apk`, `.jar`, `.docm`, `.dotm`, `.xlsm`, `.hta`).
- **Pratinjau bertingkat:** foto (JPG/PNG/HEIC) & PDF → inline saat koreksi. Format lain (Word, PPT, ZIP, video) → tombol **Unduh** dengan nama file asli.
- **Limit:** maks **25 MB per file**, maks **5 file per pengumpulan**.
- **Storage:** adapter **S3-compatible**. Sekarang: **Cloudflare R2** (bucket dev & prod terpisah). Nanti di server sendiri: **MinIO** — pindah via env vars, tanpa ubah kode.
- **Alur upload:** browser siswa → **langsung ke storage via presigned URL** (file tidak lewat server Next.js; menghindari limit body ±4,5 MB Vercel).
- **Akses privat:** siswa hanya bisa buka file miliknya; guru hanya submission rombelnya. Unduh via route terautentikasi → redirect ke link berumur pendek. Bukan public URL.
- **Resubmit** (status masih SUBMITTED): file lama **dihapus** dari storage, diganti yang baru. Tanpa arsip versi.
- **Penamaan:** nama internal acak (anti tabrakan & aman); nama file asli disimpan sebagai metadata tampilan.

### Story 2 — Lampiran guru (V1b, dibahas sekalian)

- **Scope:** guru bisa menyertakan file (foto soal, LKPD, bacaan) pada **tugas (Assignment)** — bukan level sesi.
- **Limit:** sama persis — 25 MB/file, maks 5 file per tugas. Blocklist yang sama.
- **Ubah kapan saja:** tambah/hapus/ganti lampiran bebas, walau sudah ada yang mengumpulkan — lampiran = instruksi, bukan data penilaian. Kuncian tetap di jawaban siswa (REVIEWED).
- **Akses:** seluruh siswa rombel aktif tugas itu boleh lihat/unduh.
- **Eksekusi:** desain & skema sekalian; build berurutan (Story 1 → Story 2).

## Ditolak + alasan

- **Vercel Blob** — API proprietary; pindah ke server sendiri = tulis ulang kode; kena biaya egress tiap foto dibuka guru.
- **Allowlist ketat (hanya foto+PDF)** — proposal awal; ditolak demi fleksibilitas ("semua file bisa dikirim, minimal bisa diunduh"). Diganti blocklist format berbahaya.
- **Limit 10 MB / 3 file** — proposal awal; dinaikkan ke 25 MB / 5 file karena jenis file dibebaskan (termasuk video pendek).
- **Simpan file lama saat resubmit** — ditolak user: dihapus.

## Titik lemah yang masih hidup (bukan penghalang)

1. `.docx`/format lain tak bisa pratinjau inline — guru wajib unduh dulu (trade-off disengaja).
2. **Kebijakan retensi file saat rollover tahun ajaran belum diputuskan** — cek `docs/development/PLAYBOOK-ROLLOVER-TA.md` saat implementasi.
3. 25 MB bisa sempit untuk video praktikum — knob konfigurasi, mudah dinaikkan.
4. HEIC tidak tampil di sebagian browser — perlu dicek/konversi saat implementasi pratinjau.

## Hand-off

Input siap untuk `bmad-build` (build langsung) atau `bmad-spec` (kalau mau dipecah jadi cerita). Kode menyentuh: `prisma/schema.prisma`, `src/modules/assignments/`, `src/modules/student-portal/`, halaman koreksi guru.

Blueprint teknis lengkap: `docs/product/assignment-file-blueprint.md`.
