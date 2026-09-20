# Peta Modul Portal Siswa — 4 Gelombang

## GELOMBANG 1 — Portal Hidup (melebur ke Tahap 4)

*Siswa punya alasan buka aplikasi setiap hari.*

| # | Modul | Sifat | Fondasi Data | Skema Baru |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | Beranda "Hari Ini" (daily stream) | Pasif | `TeachingSchedule` + `Quiz.deadline` + `Assignment.dueDate` | ✗ |
| 1.2 | Pusat Kuis & Ujian (+ riwayat, pembahasan `explanation`, badge remedial) | AKTIF | `Quiz` + `QuizAttempt` | ✗ |
| 1.3 | Jadwal Mingguan rombel | Pasif | `TeachingSchedule` | ✗ |
| 1.4 | Profil & Ganti PIN | AKTIF | `Student` (Tahap 1) | ✗ |

## GELOMBANG 2 — Portal Matang (Tahap 7)

*Transparansi capaian belajar.*

| # | Modul | Sifat | Fondasi Data | Skema Baru |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | Nilai & **Pohon Ketuntasan TP** (per mapel; hanya FINAL) | Pasif | `LearningObjective` + `AssessmentLearningObjective` + `AssessmentResult` + `RemedialAttempt` | ✗ (agregasi) |
| 2.2 | Presensi Saya (rekap bulanan H/S/I/A) | Pasif | `AttendanceRecord` | ✗ |
| 2.3 | Daftar Tugas read-only (judul/deskripsi/deadline) | Pasif | `Assignment` | ✗ |
| 2.4 | Widget ketuntasan ringkas di beranda | Pasif | idem 2.1 | ✗ |

## GELOMBANG 3 — Kolaborasi Dua Arah (Tahap 8)

| # | Modul | Sifat | Fondasi Data | Skema Baru |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | Pengumpulan Tugas (submission teks/tautan + antrean koreksi guru) | AKTIF | — | ✓ `AssignmentSubmission` |
| 3.2 | Materi Belajar (guru publish draf AI/ringkasan) | Pasif | `AiContentDraft` | ✓ flag publish |
| 3.3 | Mode Keluarga (tab pantauan ort. di portal siswa) | Pasif | reuse layanan baca parent | minor |

## GELOMBANG 4 — Cerdas (Tahap 9)

| # | Modul | Catatan |
| :--- | :--- | :--- |
| 4.1 | AI Tutor (tanya-jawab terkurasi materi guru) | Grounding ketat; "AI membantu, guru menentukan"; rate-limit + log |
| 4.2 | Gamifikasi mikro (streak, badge ketuntasan) | Opsional — setelah pola pemakaian terlihat |

## Pemetaan "Activity Generates Data" (§4.3)

| Aksi Siswa | Data Otomatis Mengalir ke Guru |
| :--- | :--- |
| Kerjakan kuis PG | Skor masuk `QuizAttempt` → leger (0 input manual) |
| Submit jawaban esai | Masuk antrean koreksi guru |
| Klaim akun via NIS | Roster terisi identitas login tanpa guru membuat akun |
| Pantau ketuntasan | Angka partisipasi kuis → sinyal kelas mana perlu perhatian |

## Sengaja Dikecualikan dari Portal Siswa (§4.4)

| Item | Alasan |
| :--- | :--- |
| `StudentMonitoringNote` mentah | Catatan internal guru; risiko nada/motivasi |
| Prota/Prosem (`AcademicPlanItem`) | Perencanaan internal guru |
| Sunting identitas mandiri | Integritas leger — via guru |
| Pengumuman sekolah | Belum ada sumber resmi (tanpa role kepsek); kandidat: pengumuman per-mapel dari guru |
