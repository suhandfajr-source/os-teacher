---
id: SPEC-student-portal-auth
companions:
  - glossary.md
  - security-amendum.md
  - execution-stages.md
  - architecture-diagrams.md
  - portal-modules.md
sources:
  - ../../../docs/products/DEV_STAGE_11_STUDENT_PORTAL_AUTH.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# KLASSA Student Portal & Unified Auth (DEV STAGE 11)

## Why

KLASSA kini ekosistem 2-arah (Guru → Orang Tua) dan siswa adalah baris data pasif tanpa jalur login (temuan G4), sehingga guru menjadi bottleneck input administrasi: nilai kuis/ujian dimasukkan manual. Pain ini bertemu vision: ekosistem **3-arah (Guru ⇄ Siswa ⇄ Orang Tua)** dengan prinsip **"Activity Generates Data"** — aktivitas belajar siswa otomatis mengisi administrasi guru (nilai, ketuntasan, presensi kuis), bukan sebaliknya. Backdrop: fondasi DEV_STAGE_00–10 sudah ada (Better Auth guru, quiz engine lengkap, multi-sekolah), dan review kode 18 Sep 2026 menemukan celah dedup sekolah serta absennya primitif keamanan siswa — keduanya harus ditutup sebelum portal siswa dibuka.

## Capabilities

- **CAP-1**
  - **intent:** Siswa dapat bergabung ke rombel via kode dari guru dan login mandiri (NIS + PIN 4-digit) tanpa email.
  - **success:** State machine klaim teruji (L0 auto saat NIS ada & nama cocok; PENDING L1 saat mismatch/NIS baru; TOLAK bila sudah di rombel lain periode aktif); login NIS+PIN menghasilkan sesi siswa terpisah yang ko-eksis dengan sesi guru.
- **CAP-2**
  - **intent:** Guru dapat mencari sekolah (nama/NPSN) dan bergabung tanpa dapat menciptakan sekolah duplikat.
  - **success:** Empat skenario gerbang dedup (NPSN sudah ada; normalizedName exact; kemiripan ≥85%; lolos) lulus test; tidak ada jalur UI yang menghasilkan dua sekolah duplikat.
- **CAP-3**
  - **intent:** Guru dapat melihat siapa saja guru di sekolahnya, menerima notifikasi keanggotaan baru, dan me-revoke guru lain.
  - **success:** Panel member + notifikasi + revoke antar-guru berfungsi dan teruji; keanggotaan langsung aktif saat gabung (Mode Santai).
- **CAP-4**
  - **intent:** Klaim akun siswa disetujui melalui tangga bertingkat (L0 otomatis → L1 pengampu rombel → L2 semua guru → L3 superadmin) termasuk batch approve.
  - **success:** Setiap transisi tangga L1–L3 dan batch approve atomic teruji dengan jejak AuditLog; REJECTED dapat mendaftar ulang pada row Student yang sama.
- **CAP-5**
  - **intent:** Siswa melihat dashboard harian (pelajaran hari ini, deadline mendesak, ringkasan ketuntasan), jadwal mingguan rombel, dan profil + ganti PIN.
  - **success:** E2E: siswa login → daily stream tampil ter-scope periode aktif → ganti PIN dengan verifikasi PIN lama berhasil (rotasi sesi + keluar semua perangkat).
- **CAP-6**
  - **intent:** Siswa mengerjakan kuis dari portal dengan identitas yang di-derive dari sesi server, dan hasilnya mengalir otomatis ke leger guru.
  - **success:** E2E golden journey: guru publish quiz → siswa kerjakan dari portal → nilai muncul di dashboard guru tanpa input manual; security test membuktikan impersonasi via parameter klien mustahil (B1).
- **CAP-7**
  - **intent:** Guru menyetujui siswa pending (per-rombel/sekolah-wide, batch, highlight eskalasi, pindah rombel) dan superadmin menjalankan aksi backstop (force approve, ban guru, reset password guru, nonaktif sekolah).
  - **success:** Test tangga L1–L3 lulus; superadmin tidak dapat diciptakan via register (env allowlist); setiap aksi superadmin terisi AuditLog.
- **CAP-8**
  - **intent:** Rollover tahun ajaran berjalan tanpa kehilangan identitas siswa (impor ulang roster, klaim ulang, NIS & PIN tetap).
  - **success:** Playbook rollover tertulis (termasuk pengisian NIS siswa yang belum ber-NIS sebelum klaim ulang) dan klaim ulang L0 dengan NIS & PIN lama teruji.
- **CAP-9**
  - **intent:** Siswa melihat capaian belajarnya: nilai FINAL per mapel, pohon ketuntasan TP, rekap presensi bulanan, dan daftar tugas read-only.
  - **success:** Unit test agregasi ketuntasan lulus; nilai non-FINAL tidak pernah bocor ke siswa (definisi glosarium); E2E siswa melihat nilai setelah guru finalisasi assessment.
- **CAP-10**
  - **intent:** Siswa mengumpulkan tugas (teks/tautan) ke antrean koreksi guru dengan umpan balik, membaca materi yang dipublish guru, dan orang tua memantau read-only via Mode Keluarga di portal siswa.
  - **success:** E2E: guru buat tugas → siswa submit → guru beri umpan balik; materi publish terlihat siswa; Mode Keluarga read-only aman (tanpa jalur tulis).
- **CAP-11**
  - **intent:** Siswa dapat bertanya kepada AI tutor yang hanya menjawab dalam konteks materi publish dan TP guru.
  - **success:** AI menolak pertanyaan di luar konteks materi; rate-limit & audit log terisi. Gamifikasi mikro opsional — go/no-go berbasis data pemakaian nyata.

## Constraints

- Role user hanya **Guru & Siswa** (+ Superadmin platform-level non-registrable, seeded dari env allowlist).
- Identitas siswa: **NIS kanonik (trim+uppercase, unik per sekolah) + PIN 4-digit** — tanpa email; NIS wajib untuk klaim akun.
- Siswa bergabung per **ROMBEL** (bukan per mapel): 1x join → semua TeachingContext rombel muncul otomatis.
- **NPSN = data publik**: kunci pencarian & dedup, bukan gerbang keamanan; opsional, jika diisi dedup dipaksa.
- Sesi siswa = cookie terpisah `klassa_student_session` (httpOnly, signed, `STUDENT_SESSION_SECRET` fail-fast di production, `secure`, sameSite=lax, 30 hari cap + idle 7 hari sliding) — ko-eksis dengan sesi guru.
- **Amendum A (glosarium §9 + B1–B5 + N1–N9) mengikat semua tahap** dan menang bila bertentangan dengan teks lama; lihat `glossary.md` dan `security-amendum.md`.
- Nilai yang tampil ke siswa hanya **FINAL kanonik** (join Assessment + AssessmentResult); nilai draft/PENDING tidak boleh bocor.
- `StudentMonitoringNote` tidak ditampilkan mentah ke siswa; perubahan identitas siswa (nama/NIS) hanya via guru (integritas leger).
- Reset PIN siswa HANYA oleh pengampu rombel aktif di periode aktif atau Superadmin (B2).
- Semua limiter baru wajib persisten di DB dengan lockout berlapis & pesan error generik ber-timing seragam (B3).
- **Regresi nol**: seluruh alur `/q/[token]` dan `/parent/*` tetap hijau di setiap tahap (door criteria); akhir tahap wajib `tsc` bersih + semua test hijau.
- **N3 gate**: backfill NIS kanonik + laporan duplikat selesai sebelum actions siswa Tahap 3 aktif.
- Semua query portal siswa di-scope ke **periode aktif**; service layer memvalidasi maksimal satu periode aktif per sekolah.

## Non-goals

- Perubahan `/parent/*` (dipertahankan paralel; sunset dievaluasi setelah Mode Keluarga stabil pasca-Tahap 8).
- Reset password via email (butuh SMTP; backstop superadmin memadai untuk v1).
- Merge otomatis sekolah duplikat (dedup Tahap 2 membuatnya nyaris mustahil; sementara nonaktifkan via superadmin).
- Toggle "Rombel Terbuka" (auto-approve) — tunda sampai pola pemakaian terlihat.
- Unggah berkas tugas (file upload) — submission teks/tautan dulu di Tahap 8.
- Role wali kelas / admin sekolah / kepsek di fase awal.
- Prota/Prosem (`AcademicPlanItem`) dan pengumuman sekolah di portal siswa (belum ada sumber resmi).

## Success signal

Golden journey end-to-end lulus: siswa daftar via kode rombel → login NIS+PIN → mengerjakan kuis dari portal → nilai muncul otomatis di dashboard guru **tanpa satu pun input manual guru** — disertai bukti test: 4 skenario dedup, tangga L0–L3 berjejak audit, pohon ketuntasan hanya menampilkan nilai FINAL, `tsc` bersih, seluruh test lama & baru hijau.

## Assumptions

- Blueprint DEV_STAGE_11 (APPROVED & FINAL + Amendum A) diperlakukan otoritatif; distilasi tidak me-re-verifikasi kode baseline.
- Estimasi ±13–20 hari kerja fokus diterima sebagaimana adanya.
- Portal `/parent/*` dan quiz engine existing dianggap berfungsi (baseline DEV_STAGE_00–10 hijau).

## Open Questions

- Agregasi ketuntasan Tahap 7: skor flat, atau memperhitungkan `GradePolicy`/KKTP per TP? (dokumen hanya menulis "pertimbangkan".)
- Kepatuhan privasi data siswa di bawah umur (UU PDP) tidak disinggung blueprint — apakah perlu kebijakan retensi/izin ortu sebelum portal dibuka?
- Retensi `AuditLog` belum ditentukan (append-only disebut; durasi simpan tidak).
