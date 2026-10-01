# 📋 LAPORAN SESI PENGEMBANGAN — QUIZ ONLINE + AI STUDIO PPT V3

> **Tanggal:** 2026-09-12 s.d. 2026-09-13
> **Branch:** `explore` (semua sudah ter-push ke `origin/explore`)
> **Disusun oleh:** sesi coding dengan AI agent (pi) — untuk konsultasi lanjutan dengan BMAD
> **Status terakhir:** MVP Quiz Online + Tahap 2 (PIN) + Analitik per-soal — **selesai & teruji**

---

## 1. KONTEKS PROYEK

**Aplikasi:** AI Teacher Assistant (a.k.a. Teacher OS) — aplikasi web untuk guru di Indonesia
**Stack:** Next.js 16.3.3 (App Router, Turbopack) • TypeScript • Prisma 7.9.1 + PostgreSQL (Neon) • Better Auth • Tailwind v4 • shadcn/ui • Gemini API (`gemini-3.6-flash`, key di `.env`)
**Pola arsitektur:** Server Actions dengan zod validation + `verifyTeachingContextAccess`/`verifyActiveSchoolMembership` untuk otorisasi guru. Tanpa akun siswa — siswa diakui lewat roster kelas + token/PIN.
**Konteks penting:** aplikasi berpusat guru; ada portal orang tua; siswa TIDAK punya akun; konteks kurikulum Indonesia (KKM, remedial, ulangan harian).

---

## 2. FITUR QUIZ ONLINE — YANG SUDAH JADI

### 2.1 Fungsi Inti (commit `ee6f3d0`)
- **Model Prisma baru:** `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAnswer`, `QuizStudentAccess` (lihat §4)
- **Guru:** daftar quiz (`/quiz`), builder (`/quiz/new`), detail+monitoring (`/quiz/[quizId]`)
- **Siswa:** halaman publik `/q/[token]` TANPA LOGIN — pilih nama dari roster → kerjakan MCQ → nilai instan
- **Pengaturan quiz:** timer per attempt, acak soal & acak opsi per siswa, standar nilai (KKM), deadline
- **Koreksi otomatis** MCQ, skor dinormalisasi 0–100
- **Remedial:** guru membuka ulang attempt siswa tertentu yang di bawah KKM
- **Gradebook:** skor quiz dapat diterbitkan ke `AssessmentResult` penilaian existing (upsert, status GRADED)

### 2.2 Integrasi AI
- **Generate soal langsung di builder** (`efcfd64`): guru tulis topik → AI (provider yang sama dengan AI Studio) menghasilkan MCQ JSON terstruktur, sadar mapel & jenjang — tanpa copy-paste dokumen
- **Konversi dokumen** (jalur kedua): tempel dokumen soal → AI ekstrak MCQ
- **AI Studio**: kartu "Quiz Online" (badge Interaktif) + tombol "Jadikan Quiz Online" pada draf soal → otomatis jadi quiz

### 2.3 Keamanan & Integritas (Tahap 2 — `204812b`)
- **PIN per siswa**: model `QuizStudentAccess` — PIN 4-digit unik per siswa per quiz
- PIN auto-generate saat quiz di-publish + lazy saat roster bertambah
- Siswa: pilih nama → input PIN (leading-zero dimaafkan via `normalizePin`) → verifikasi server
- Guru: badge PIN di roster + dialog "Daftar PIN" dengan tombol salin (format siap WhatsApp)

### 2.4 Snapshot Soal per Attempt (`84b684a`) — keputusan arsitektur kunci
Setiap attempt **memotret soal saat itu** (teks, opsi ter-shuffle + kunci ter-mapping, poin) ke `QuizAttempt.questionOrder` (JSON). Konsekuensi:
- Guru bebas **edit/hapus soal setelah publish** tanpa merusak riwayat jawaban
- Reset/remedial otomatis memakai **soal terbaru**
- `QuizAnswer.questionId` dibuat nullable + `onDelete: SetNull` (migrasi `20260913064058`)

### 2.5 Alur Edit Soal + Izin Ulang (kebijakan yang disepakati user)
```
Guru edit soal saat quiz PUBLISHED dan sudah ada yang mengerjakan
  → dialog: "Izinkan N siswa mengulang dengan soal terbaru?"
     Oke  → reset semua attempt (jawaban & nilai dikosongkan) — KEPUTUSAN USER: reset bersih
     Batal → perubahan hanya berlaku untuk pengerjaan berikutnya
```
- **Lihat Jawaban (guru)** (`8849686`): dialog per siswa — snapshot attempt, penanda KUNCI/JAWABAN SISWA per opsi, poin per soal
- **Hasil untuk siswa**: membuka ulang link setelah submit → lihat nilai sendiri + ✓/✗ per soal, **tanpa kunci jawaban** (dibahas guru di kelas)

### 2.6 Analitik Per-Soal (`359c960`)
- `getQuizAnalyticsAction`: agregat dari snapshot attempt — tingkat keberhasilan per soal + distribusi jawaban per opsi (agregasi by teks opsi, kebal acak per siswa)
- UI: kartu "Analitik Soal" di detail page, bar berwarna (🟢 ≥75%, 🟡 50–74%, 🔴 <50%) + distribusi opsi untuk evaluasi distraktor
- **Menu Quiz kini ada di BottomNav mobile** juga

### 2.7 Keamanan Anti-Curang yang Terpasang
| Ancaman | Mitigasi |
|---|---|
| Link ditebak | share token 32-char acak |
| Pemalsuan nama | **PIN per siswa** (server-side verify) |
| Mencontek tetangga | acak soal+opsi per siswa, 1 attempt |
| Timer dimanipulasi | startedAt disimpan server, validasi + grace 60s |
| Guru lain mengakses | ownership + school check di semua teacher action |

---

## 3. BUG BESAR YANG DITEMUKAN & DIPERBAIKI (pelajaran penting)

| # | Bug | Akar | Fix | Commit |
|---|---|---|---|---|
| 1 | **Skor 30 padahal jawab semua benar** (dibuktikan via query DB: koreksi naif 3/10 vs koreksi benar 10/10) | Attempt legacy: jawaban siswa (urutan tampil acak) dibandingkan kunci urutan master DB | Snapshot per attempt (kunci ter-mapping ke urutan tampil) + regrade satu-off (30→100) | `84b684a` |
| 2 | Opsi jawaban kosong tampil | AI output tidak divalidasi | Sanitasi server di semua jalur: trim + tolak opsi kosong/teks kosong, min 2 opsi | `7203fa6`, `b2358a3` |
| 3 | Kunci jawaban salah posisi di lembar jawaban | Attempt legacy tanpa snapshot → fallback urutan master | `reconstructLegacySnapshot` dari `questionIds`+`optionOrders` yang tersimpan + repair data | `82ae4ba` |
| 4 | Dialog jawaban tidak bisa scroll (3 iterasi) | **`max-h-[85vh]` tidak pernah di-generate Tailwind** (dibuktikan grep CSS bundle = 0) | Inline style `maxHeight/overflowY/minHeight` — JANGAN andalkan arbitrary class untuk perilaku kritis | `8a0b2c7` |
| 5 | Submit setelah reset saat halaman masih terbuka | Fallback koreksi urutan master bisa terulang | Submit ditolak dengan pesan "muat ulang" | `7203fa6` |
| 6 | Tombol duplikat / halaman siswa putih-di-atas-putih / tanpa entry point AI Studio | Refactor + desain hardcoded teks putih | 1 CTA per tab; rebuild dengan design token; kartu "Quiz Online" di AI Studio | `b2358a3` |

**⚠️ Gotcha teknis untuk agent berikutnya:**
1. Setelah `prisma migrate/generate` → **server dev HARUS di-restart** (error "Unknown field" = Prisma Client stale)
2. Jangan andalkan arbitrary Tailwind class untuk perilaku kritis — verifikasi ke CSS bundle bila ragu
3. Attempt legacy (pra-snapshot) yang sudah di-reset tidak bisa direkonstruksi — data repair sudah dijalankan untuk semua attempt existing

---

## 4. STRUKTUR KODE (peta file)

```
prisma/schema.prisma                      — Quiz*, QuizStudentAccess (migrations: 20260912080154, 20260913064058, 20260913102802)
src/modules/quiz/
  quiz.types.ts        — zod schemas + view types (PublicQuizView, AttemptResultView, dll)
  quiz.service.ts      — LOGIKA MURNI (testable): shuffle, shuffleOptions, gradeAttempt,
                         normalizeScore, generateShareToken, isAttemptExpired,
                         buildAttemptSnapshot, reconstructLegacySnapshot,
                         generateUniquePins, normalizePin
  quiz.actions.ts      — server actions: CRUD guru, publish, remedial, resetAllAttempts,
                         updateQuizQuestions, publishScoresToAssessment, getQuizAnalytics,
                         alur publik siswa (getPublicQuiz, startAttempt[pin], submit, hasil)
  quiz-convert.action.ts — generateQuizQuestionsAction (dari topik) +
                           convertDocumentToQuizAction (dari dokumen) + parseAiQuestionsJson
  __tests__/           — 15 test (service + snapshot regression 50 trial acak)
src/components/quiz/QuestionListEditor.tsx — editor soal bersama (create & edit)
src/app/(dashboard)/quiz/  — page.tsx (list), new/ (builder), [quizId]/ (detail+monitor+analitik)
src/app/q/[token]/         — halaman publik siswa (tema terang, token aplikasi)
src/lib/export/            — (fitur PPT, sesi terpisah, lihat §6)
```

**Daftar commit sesi quiz (urut):**
`ee6f3d0` MVP → `efcfd64` generate-inline → `b2358a3` UX fixes → `84b684a` edit+snapshot → `7203fa6` audit → `8849686` answer sheet → `82ae4ba` legacy fix → `b9cc25e`+`8a0b2c7` scroll → `2633879` hide questions → `204812b` PIN → `359c960` analitik

**Test:** 15 unit test quiz; total project 98; TS & ESLint bersih.

---

## 5. FITUR PPT V3 (sesi sebelum quiz, konteks)

- **Dibatalkan rencana hapus PPT** — akar masalah ternyata bukan prompt AI melainkan renderer lama (pptxgenjs flat). Dibangun renderer baru: 8 tema adaptif mapel → template HTML per tipe slide (9 tipe) → rasterisasi `foreignObject` client-side → PPTX full-bleed + speaker notes asli (`8511b61`)
- **Pipeline ilustrasi AI** (`92cc616`): slide kunci (CONTENT/STORY) dengan tag `[Visual:]` → slot visual; image-gen Gemini **siap tapi nonaktif** — env `GEMINI_IMAGE_MODEL` dikomentari di `.env` karena tier gratis = kuota 0 (keputusan user: fallback panel ilustrasi dulu, billing nanti)
- Bug `[Role: Concept]` tidak terpetakan → fixed; Speaker Notes kini dibawa sampai PPT
- Sample visual: `_ppt_sample/` (TIDAK di-commit — perlu keputusan: commit/gitignore/hapus)

---

## 6. HAL TERSENGGANTUNG / KEPUTUSAN TERBUKA

### 6.1 Menunggu keputusan user
- [ ] **Fase 2 Quiz — Skenario A (serentak terjadwal)**: quiz terbuka hanya dalam rentang waktu; perlu desain (jam server vs jam siswa, sinkronisasi mulai)
- [ ] **Fase 2 — Essay/isian**: butuh alur antrian koreksi manual guru
- [ ] **Fase 3 — Live mode ala Kahoot**: real-time, perubahan arsitektur terbesar
- [ ] **PPT Fase 2**: aktifkan `GEMINI_IMAGE_MODEL` (perlu billing Gemini) — pipeline sudah siap, tinggal uncomment env

### 6.2 housekeeping kecil
- [ ] Folder `_ppt_sample/` (sample visual PPT) — commit / gitignore / hapus?
- [ ] Folder `problem/` (screenshot bug user) — sebaiknya di-gitignore
- [ ] File `skills-lock.json` + `.agents/skills/bmad-*` (29 skill BMAD terinstal) — belum di-commit; user juga berencana konsultasi BMAD
- [ ] `.env` lokal punya `GEMINI_MODEL=gemini-3.6-flash`; kunci API **tidak** boleh ter-commit (cek .gitignore sudah menutup `.env`)

### 6.3 Risiko/limitasi yang diketahui (by design, sudah dikomunikasikan ke user)
- Teks slide PPT = gambar (tidak editable di PowerPoint; revisi via aplikasi; speaker notes tetap editable)
- Attempt legacy pra-snapshot: detail ✓/✗ per soal tidak dapat direkonstruksi sempurna (sudah tidak ada — semua di-reset/direpair)
- Ekspor PPTX memakan waktu ±1–2 detik per slide (render gambar)

---

## 7. SARAN LANGKAH BERIKUTNYA (untuk BMAD)

1. **Validasi arah Fase 2 Quiz**: pilih Skenario A vs C vs Essay sebagai sprint berikutnya (§6.1)
2. **Refinement PIN**: pertimbangkan PIN permanen per siswa per periode (bukan per quiz) agar guru tidak membagikan PIN baru tiap quiz
3. **Teknis**: pertimbangkan menyatukan prompt-builder AI (generate vs convert) agar konsisten saat model di-upgrade
4. **Housekeeping repo** (§6.2) sebelum terlalu banyak file liar menumpuk

---

*Dibuat otomatis dari sesi pengembangan; semua klaim terverifikasi via git log, query database, dan test suite (98 test lulus per akhir sesi).*
