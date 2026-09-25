# Checklist Fitur Komprehensif — KLASSA (per Role)

Panduan uji manual di lokal. Centang setiap item setelah diverifikasi bekerja.
Prasyarat env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GEMINI_API_KEY` (`.env`); `SUPERADMIN_EMAILS` untuk seeding superadmin.

---

## 0. Persiapan

- [ ] `npx prisma migrate dev` — skema sinkron (chain 21+ migrasi)
- [ ] `npm run seed:superadmin` — superadmin ter-seed dari `SUPERADMIN_EMAILS`
- [ ] `npm run dev` — server jalan di http://localhost:3000
- [ ] `npm test` — 68 file / 760 test hijau (baseline)

---

## 1. SUPERADMIN (platform, non-registrable)

Login: akun yang emailnya ada di `SUPERADMIN_EMAILS`.

- [ ] `/admin` — panel persetujuan guru terbuka; guru pending tampil
- [ ] Setujui / tolak pendaftar guru → guru bisa/tidak bisa login
- [ ] Force approve eskalasi (backstop) berfungsi
- [ ] Ban guru → sesi guru ter-revoke, akses ditolak
- [ ] Reset password guru → guru login dengan password baru
- [ ] Nonaktifkan sekolah → guru & siswa sekolah itu fail-closed (sesi ditolak)
- [ ] Reaktifkan sekolah → akses kembali normal
- [ ] `/admin/audit` — setiap aksi superadmin tercatat di AuditLog
- [ ] Negatif: register via `/register` TIDAK bisa menghasilkan superadmin (allowlist env saja)

### Single-Admin Lane (kerangka 2026-09-24, terimplementasi)

- [ ] Login superadmin → otomatis dilempar ke `/admin` (bukan wizard onboarding guru)
- [ ] Negatif: superadmin diblok dari jalur guru (`/dashboard`, `/onboarding` → redirect `/admin`)
- [ ] Negatif: register dengan email allowlist DITOLAK (reserved, I3)
- [ ] Negatif: seeder menolak akun ber-TeacherProfile & akun pintu publik (I2 — abort nol row)
- [ ] Seeder create-when-missing: `SUPERADMIN_INITIAL_PASSWORD` + `--create-name` → akun lahir dari seeder (I1)
- [ ] `registrationOrigin` akunmu = `PLATFORM_SEED` (cek via `--dry-run`: `origin=PLATFORM_SEED`)

## 2. GURU

### Onboarding & akun
- [ ] `/register` → akun pending → disetujui superadmin → masuk onboarding
- [ ] `/onboarding` — setup sekolah → periode aktif → mapel → rombel (join code)
- [ ] `/onboarding/mid-semester` — alur tengah semester
- [ ] `/pengaturan`, `/pengaturan/setup` — profil & konfigurasi

### Beranda & kelas
- [ ] `/dashboard` — metric cards (konteks mengajar, sesi hari ini, siswa terdaftar) angka nyata
- [ ] `/kelas` — daftar teaching context; buat konteks baru
- [ ] Tab kelas: Pertemuan, Absensi, Penilaian, Tugas, Monitoring, Akademik, Import, Jurnal, Laporan, Pengaturan Nilai

### Sesi & presensi
- [ ] `/kelas/[id]/pertemuan` — buat sesi, isi topik rencana/aktual
- [ ] `/kelas/[id]/pertemuan/[sessionId]` — detail sesi
- [ ] `/kelas/[id]/absensi` — catat H/L/S/I/A per siswa
- [ ] Tandai sesi COMPLETED → muncul di Aktivitas Belajar Mode Keluarga

### Penilaian
- [ ] `/kelas/[id]/penilaian` + `/assessment/new` — buat assessment (tipe, KKM, max skor)
- [ ] `/kelas/[id]/pengaturan-nilai` — GradePolicy/KKTP
- [ ] Input nilai → finalisasi → status GRADED/FINAL → muncul di Nilai siswa & Mode Keluarga
- [ ] Negatif: nilai non-FINAL tidak bocor ke siswa

### Tugas (Story 8)
- [ ] `/kelas/[id]/tugas` — buat tugas (judul, deskripsi, tenggat)
- [ ] Badge "Antrean koreksi N" — hitung hanya submission SUBMITTED
- [ ] `/kelas/[id]/tugas/[assignmentId]` — antrean koreksi: isi feedback (wajib) + skor (opsional 0–100)
- [ ] Re-review: tombol "Perbarui" setelah REVIEWED — feedback/skor ter-edit, skor bisa dikosongkan
- [ ] Badge terlambat muncul untuk submit lewat tenggat

### Quiz
- [ ] `/quiz/new` — buat quiz; `/quiz`, `/quiz/[quizId]` — kelola
- [ ] Share token `/q/[token]` — tautan kuis bisa dibuka siswa

### AI Studio
- [ ] `/ai-studio` — generate konten (Gemini): materi ajar / RPP / dll
- [ ] Simpan draf; arsip draf
- [ ] Publish / Tarik materi LEARNING_MATERIAL → tampil/hilang di `/siswa/portal/materi`
- [ ] Negatif: non-LEARNING_MATERIAL & draf tanpa rombel tak bisa dipublish

### Siswa & monitoring
- [ ] `/kelas/[id]/import` — impor roster siswa (NIS)
- [ ] `/kelas/[id]/monitoring` + `/monitoring/[studentId]` — pantau siswa
- [ ] `/persetujuan` — setujui siswa pending (satu/batch), pindah rombel
- [ ] Reset PIN siswa (terbatas pengampu)
- [ ] `/siswa`, `/siswa/[studentId]` — direktori & detail siswa

### Lain-lain
- [ ] `/akademik`, `/kelas/[id]/akademik` — Prota/Prosem
- [ ] `/kelas/[id]/jurnal`, `/kelas/[id]/laporan`, `/laporan`, `/laporan/print`
- [ ] `/hari-ini` — ringkasan harian
- [ ] Rollover TA: saklar periode baru → siswa klaim ulang NIS+PIN tetap (playbook story 6)

## 3. SISWA

### Masuk
- [ ] `/portal-siswa` — login NIS + PIN 4 digit
- [ ] Negatif: NIS/PIN salah ditolak; sesi kedaluwarsa → kembali login

### Portal
- [ ] `/siswa/portal` — beranda: jadwal, widget capaian, kartu Materi
- [ ] `/siswa/portal/jadwal` — jadwal pelajaran
- [ ] `/siswa/portal/tugas` — daftar tugas; **Kumpulkan** (teks/tautan); edit sebelum dinilai
- [ ] Submit terlambat → badge "Terlambat" (tetap terkirim)
- [ ] Setelah dinilai: feedback + skor tampil, jawaban TERKUNCI (resubmit ditolak)
- [ ] Negatif: link non-http(s), kosong, teks >10.000 char ditolak
- [ ] `/siswa/portal/materi` — baca materi published (expand/collapse)
- [ ] `/siswa/portal/quiz` — kerjakan quiz dari share token; `/quiz/[shareToken]/review` — lihat pembahasan
- [ ] `/siswa/portal/nilai` — nilai FINAL per mapel + pohon ketuntasan TP
- [ ] `/siswa/portal/profil` — profil; ganti PIN

### Mode Keluarga (dari kartu di Profil)
- [ ] `/siswa/portal/keluarga` — hero pantauan ortu
- [ ] Nilai per mapel + TP tuntas x/y
- [ ] Presensi bulanan (H/L/S/I/A)
- [ ] **Rincian Penilaian** per mapel: judul, tanggal, KKM, skor (merah bila di bawah KKM, "Menunggu nilai" bila belum GRADED)
- [ ] **Aktivitas Belajar**: topik per sesi terakhir + status kehadiran
- [ ] Status tugas + umpan balik guru
- [ ] Read-only: tidak ada tombol aksi tulis apa pun

## 4. Lintas-Role & Regresi

- [ ] `/parent` & `/parent/:path*` → redirect ke `/portal-siswa` (sunset ortu)
- [ ] Guru membuka `/admin` → ditolak (deny-by-default, ter-audit)
- [ ] Siswa membuka `/dashboard` → ditolak / dilempar ke portal
- [ ] Inactivity guard sesi siswa aktif
- [ ] `/q/[token]` — quiz share tetap hijau (N9)

---

Dibuat 2026-09-24 pasca-sunset portal ortu (`9af533e`). Sumber kebenaran fitur: stories 1a–8 di `_bmad-output/specs/spec-student-portal-auth/`.
