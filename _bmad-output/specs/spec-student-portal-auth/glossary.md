# Glosarium & Definisi Kanonik

> Sumber ketidaksepakatan lintas tahap diselesaikan di sini, bukan di kode. (Amendum A §9)

## "Nilai FINAL"

**Tidak ada status `FINAL` pada schema.** Enum nyata: `AssessmentResultStatus = PENDING | GRADED | ABSENT | EXCUSED` dan `AssessmentStatus = DRAFT | IN_PROGRESS | COMPLETED | ARCHIVED`. Definisi kanonik mengikat:

> **Nilai FINAL** = `AssessmentResult.status === 'GRADED'` **DAN** parent-nya `Assessment.status === 'COMPLETED'`.

Semua penyebutan "FINAL"/"hanya FINAL" (modul Nilai, Pohon Ketuntasan, dsb.) mengacu definisi ini. Query wajib join `Assessment` dan memeriksa keduanya — memfilter `AssessmentResult` saja tidak cukup (nilai GRADED pada assessment yang masih IN_PROGRESS tetap tersembunyi).

## Dua field status siswa — jangan dicampur

| Field | Rentang | Makna |
| :--- | :--- | :--- |
| `Student.status` (existing, `EntityStatus`) | ACTIVE / ARCHIVED | Keberadaan siswa di leger sekolah (data) |
| `Student.accountStatus` (baru) | PENDING / ACTIVE / REJECTED | Hak login portal siswa (akun) |

Login & akses portal = `accountStatus === 'ACTIVE'` **dan** `status === 'ACTIVE'`. Riwayat eks-siswa (REJECTED/ARCHIVED) hanya terlihat via Mode Keluarga, tidak via login siswa.

**Transisi REJECTED → daftar ulang:** reuse row `Student` yang sama (jangan buat baru) → set `accountStatus = PENDING`, reset `failedAttempts`/`lockedUntil`, catat attempt kedua di `AuditLog`.

## NIS kanonik

Bentuk kanonik: `trim()` + `uppercase()` (tanpa transformasi lain). Lookup klaim/login selalu exact terhadap bentuk kanonik.

⚠️ **Prasyarat data:** `Student.nis` lama tersimpan raw (import mencocokkan case-insensitive tapi menyimpan apa adanya) dan `@@unique([schoolId, nis])` case-sensitive → tanpa backfill, "0123" dan " 0123 " menjadi dua baris siswa berbeda. Wajib: migrasi backfill normalisasi seluruh NIS existing + laporan duplikat (resolve manual oleh guru) **sebelum actions siswa Tahap 3 aktif** (N3 gate).

## "Periode aktif"

= `AcademicPeriod.status === 'ACTIVE'` pada sekolah tersebut. Schema (`status String`) TIDAK menjamin satu periode aktif per sekolah — service layer wajib memvalidasi maksimal satu, dan semua query portal siswa (daily stream, jadwal, tugas, deadline) wajib di-scope ke periode aktif agar data TA lama tidak tampil.

## Kecocokan nama klaim L0

Exact match setelah normalisasi (trim, collapse whitespace, case-insensitive). **Bukan** fuzzy/similarity — ambang kemiripan ≥85% hanya berlaku untuk dedup nama sekolah. Alasan: mencegah pihak yang mengetahui NIS+nama teman membajak akun.
