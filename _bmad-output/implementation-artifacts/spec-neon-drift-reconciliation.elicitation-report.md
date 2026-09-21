# Elicitation Report — `spec-neon-drift-reconciliation.md`

| | |
|---|---|
| **Target** | `_bmad-output/implementation-artifacts/spec-neon-drift-reconciliation.md` (status: draft, route: full, review_loop_iteration: 0) |
| **Tanggal** | 2026-09-20 |
| **Metode** | Pre-mortem Analysis · Assumption Audit · Boundary & Edge Case Sweep |
| **Pendekatan** | Setiap klaim spec diverifikasi terhadap kondisi repo aktual (git history, isi `prisma/migrations/`, `schema.prisma`, `.env`, story 1a, deferred-work) — bukan sekadar pembacaan teks |
| **Verdict** | **Arsitektur spec BENAR dan siap dieksekusi — 1 temuan HIGH pada kriteria review di bagian frozen (nama index salah) + 3 temuan MEDIUM pada runbook & gate. Fondasi asumsi inti terverifikasi kuat via bukti.** |

---

## 1. Ringkasan Eksekutif

Spec ini adalah chore berisiko tinggi yang menyentuh **database produksi (Neon)** dan **rantai migrasi** — satu-satunya jalan keluar dari insiden 2 suite merah 2026-09-20. Pendekatannya (`migrate diff` via shadow DB → review manual → `resolve --applied` → gate verifikasi) adalah pola yang tepat dan didukung preseden sukses story 1a.

Hasil analisis tiga metode:

- **Kuat**: Asumsi "drift == delta f0be2d5 saja" **terverifikasi penuh** via git history — hanya f0be2d5 yang menyentuh `schema.prisma` tanpa file migrasi; migrasi #19 terbukti bersih dari objek schedule/prosem (grep kosong). Tidak ada drift gelap kedua.
- **Cacat (HIGH)**: Kriteria review manual di bagian frozen menyebut nama index lama yang **salah**: spec menulis `academic_plan_item_teaching_context_id_order_index_key`, sedangkan nama aktual di chain adalah `academic_plan_item_teachingContextId_orderIndex_idx` (`stage_07/migration.sql:86`). Karena review manual "harus persis delta" adalah gate kualitas utama spec ini, kriteria yang salah nama = review akan false-STOP atau, lebih buruk, developer "mengoreksi" file yang sudah benar.
- **Celah (MEDIUM)**: (a) tidak ada pre-flight `migrate status` sebelum `resolve`; (b) tidak ada baseline gate-run sebelum file dibuat (mendeteksi masalah tooling/naming-convention dini); (c) gate tidak di-wire ke hook apa pun — berisiko hanya dijalankan sekali lalu dilupakan, membuka pintu insiden drift berulang.

---

## 2. Basis Bukti — Verifikasi Klaim Spec vs Repo Aktual

| # | Klaim Spec | Verifikasi | Status |
|---|-----------|-----------|--------|
| B1 | Chain = 19 file migrasi; terbaru `20260920135945` | `ls prisma/migrations` → 19 folder + `migration_lock.toml` (provider postgresql); terakhir `20260920135945_student_portal_foundation` | ✅ |
| B2 | Delta f0be2d5 = enum `PlanItemCategory`, tabel `teaching_schedule` + index/FK, kolom `teaching_session.teaching_schedule_id`, `academic_context_profile` ×3, `learning_objective` ×2, `academic_plan_item` ×4, swap index plan-item | `git show f0be2d5 -- prisma/schema.prisma` → seluruh delta cocok, termasuk `@@index([teachingContextId, orderIndex])` → `@@index([teachingContextId, targetSemester, orderIndex])` + `@@index([learningObjectiveId])` | ✅ |
| B3 | "Satu-satunya drop yang sah": `DROP INDEX academic_plan_item_teaching_context_id_order_index_key` | **Nama di spec SALAH.** Index lama dibuat oleh `20260823140000_stage_07/migration.sql:86` sebagai `CREATE INDEX "academic_plan_item_teachingContextId_orderIndex_idx"` — camelCase + suffix `_idx`, bukan snake_case + `_key` | ❌ **F1** |
| B4 | Index lama memang ada di hasil replay 19 file (design note) | Terkonfirmasi via stage_07 L86 — `DROP INDEX` pada file rekonsiliasi aman untuk fresh replay | ✅ |
| B5 | Delta f0be2d5 adalah satu-satunya drift | `git log --follow -- prisma/schema.prisma`: 19 commit menyentuh schema; semua punya migrasi di chain (stage 01–09, docx/xlsx, 5 quiz, 1a) **kecuali f0be2d5**; migrasi #19 (46 baris) grep `teaching_schedule|PlanItemCategory|targetSemester|...` → kosong | ✅ **kuat** |
| B6 | Neon `_prisma_migrations` = 19 baris | Story 1a Implementation Notes (state akhir bookkeeping, pasca-review): "Neon = 19 baris — rapi" | ✅ (dokumen) |
| B7 | `prisma.config.ts` sudah wiring `shadowDatabaseUrl` | Terkonfirmasi: `shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"]`; **tapi `SHADOW_DATABASE_URL` belum ada di `.env`** — siapa yang men-set saat invoke belum ditetapkan | ⚠️ F7 |
| B8 | Direct URL = host pooler minus `-pooler`, kredensial sama | `.env`: `DATABASE_URL=postgresql://neondb_owner:***@ep-wispy-meadow-b3lmlza4-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` → pola Neon standar; preseden 1a sudah sukses `db execute` + `resolve` via direct URL | ✅ |
| B9 | Preseden `scripts/create-shadow-db.js` (drop+create `shadow_db` @ 51214) ada; reuse untuk gate | File ada, pakai `pg` Client, hardcode `postgres://postgres:postgres@localhost:51214/template1` | ✅ (port hardcode → F6) |
| B10 | `verify-migrations.mjs` + npm script belum ada (task baru) | `ls scripts/` → belum ada; `package.json` scripts: `seed:superadmin` jadi preseden | ✅ |
| B11 | Prisma 7.9.1 | `npx prisma --version` → prisma 7.9.1, win32. `migrate diff --from-migrations` di v7 membutuhkan shadow database URL yang tersedia saat invoke | ✅ |
| B12 | Entri deferred-work untuk settle ada | `deferred-work.md` memuat entri "Rekonsiliasi drift Neon existing" + "Gate verifikasi otomatis" (blok Review 1a pass 1) | ✅ |

---

## 3. Metode 1 — Pre-mortem Analysis

*"Hari ini +3: rekonsiliasi dinyatakan selesai, tapi deploy pertama ke env fresh GAGAL / Neon bookkeeping kotor / gate merah permanen. Apa yang salah?"*

| ID | Skenario Kegagalan | Akar Penyebab | Pencegahan → Temuan |
|----|-------------------|---------------|---------------------|
| PM1 | Developer mereview file rekonsiliasi, tidak menemukan `DROP INDEX ..._key` seperti yang spec minta → **STOP palsu**; atau "memperbaiki" nama index di file hasil diff (melanggar Never: isi = output mentah) | Kriteria review frozen menyebut nama objek yang salah (B3) — nama CLI-generate akan selamanya ≠ nama di spec | Koreksi kriteria review menjadi referensi semantik + nama aktual dari chain → **F1** |
| PM2 | Gate merah **bukan karena drift** tapi karena tooling (shadow replay gagal, engine port berubah, naming-convention Prisma berubah antar versi) → developer salah diagnose, mengedit file rekonsiliasi yang sebenarnya benar | Tidak ada langkah "baseline run" yang memisahkan *drift nyata* dari *kerusakan tooling* sebelum file dibuat | Jalankan gate SEKALI sebelum file dibuat; harus exit 2 dengan diff == delta f0be2d5 murni → **F3** |
| PM3 | `resolve --applied` dijalankan, lalu `migrate status` ternyata masih "have failed migrations" / 18 baris + 1 failed → bookkeeping tidak lunas padahal baris ke-20 sudah masuk | Asumsi "Neon 19 baris rapi" hanya bersumber dari dokumen (B6), tidak dicek ulang saat eksekusi | Pre-flight `migrate status` (via direct URL) harus 19 applied / 0 failed SEBELUM resolve → **F2** |
| PM4 | 3 bulan lagi: developer lain `db push` ke Neon lagi (refleks lama), gate tidak pernah dijalankan lagi karena "sudah hijau dulu" → insiden drift berulang, kali ini lebih sulit dilacak | Gate hanya jadi npm script; tidak ada enforcement, padahal `db push` tidak meninggalkan jejak di chain | Wire gate ke hook bersyarat (pre-push saat `prisma/migrations/**` atau `schema.prisma` berubah) → **F4** |
| PM5 | Verifikasi from-url dilakukan via pooler / URL variant salah → hasil diff menyesatkan (false empty / false residue) → resolve dilakukan di atas bukti yang salah | Spec hanya mensyaratkan direct URL untuk `resolve`, eksplisit tidak untuk verifikasi from-url | Satukan runbook: **satu variabel `NEON_DIRECT_URL` dipakai untuk from-url diff, resolve, dan status** → **F8** |
| PM6 | `resolve --applied` dijalankan dua kali (mis. retry setelah output tak terbaca) atau nama migration typo → baris duplikat/nama salah di `_prisma_migrations` | Tidak ada guard idempotensi | Pre-flight status (PM3) menangkap typo; larangan double-run dicatat eksplisit → **F13** |

---

## 4. Metode 2 — Assumption Audit

| ID | Asumsi | Keyakinan | Impact bila salah | Hasil stress-test |
|----|--------|-----------|-------------------|-------------------|
| A1 | Drift = delta f0be2d5 saja (tidak ada drift lain) | **Tinggi** | Fatal (rekonsiliasi tidak melunasi apa-apa) | **Terverifikasi via git** (B5) — asumsi terkuat di spec. Sisa risiko hanya perubahan Neon out-of-band (manual SQL), dan itu ditangkap oleh from-url diff pra-resolve ✅ |
| A2 | Neon saat ini == `schema.prisma` | Sedang-tinggi | Fatal → branch residue di spec sudah ada | Insiden 1a (test 475/475 hijau menyentuh Neon) + resolve 1a rapi mendukung. Verifikasi from-url tetap gerbang wajib — sudah ada di spec ✅ |
| A3 | Output `migrate diff` akan persis delta f0be2d5 | Sedang-tinggi | Review manual reject file benar | Satu ketidakpastian: penamaan objek oleh CLI 7.9.1 vs generator stage lama. Stage_07 di-generate era Prisma 7.x yang sama → kemungkinan konsisten; **baseline run (F3) memvalidasi ini secara murah** ⚠️ |
| A4 | Direct URL = pooler minus `-pooler`, kredensial sama | Tinggi | Resolve gagal koneksi | Pola Neon standar + preseden sukses 1a (db execute + resolve via direct URL) ✅. Catatan: pertahankan `sslmode=require`; `channel_binding=require` ikutsertakan bila didukung → F9 |
| A5 | Engine lokal selalu di port 51214 | Sedang | Gate gagal start / connect ke port salah | Konvensi tim + preseden script; tapi port hardcode rapuh — resolve dinamis via `prisma dev status` dengan fallback hardcode → **F6** |
| A6 | Exit code gate: 0 = bersih, 2 = drift | Tinggi | Gate salah klasifikasi | Sesuai perilaku CLI `--exit-code`. Yang TIDAK tercakup spec: **exit 1 = error tooling** harus dibedakan dari 2 di pesan gate → **F5** |
| A7 | Gate script bisa menyalakan engine sendiri | Tinggi | Gate gagal di mesin bersih | Preseden 1a `npx prisma dev start default` (51214) terdokumentasi ✅; tambahkan toleransi bila engine sudah jalan → F6 |
| A8 | `npm test` hijau = bukti rekonsiliasi sukses | Rendah (sebagai bukti rekonsiliasi) | False confidence | Test suite menyentuh **Neon**, bukan chain (evidence VG1 1a sendiri yang bilang begitu). Test = bukti non-regresi aplikasi; bukti rekonsiliasi = gate exit 0 + status 20 → **F10 (reframing)** |
| A9 | `klassa_dev` lokal dibiarkan scratch | Tinggi | (tidak material) | Konsisten dengan state akhir bookkeeping 1a (tanpa `_prisma_migrations`, P3005) ✅ |
| A10 | `resolve --applied` aman dijalankan | Tinggi | (prosedural) | Preseden 1a ✅; guard double-run → F13 |

---

## 5. Metode 3 — Boundary & Edge Case Sweep

Kasus batas yang **belum** tercakup I/O & Edge-Case Matrix spec:

| ID | Kasus batas | Kondisi saat ini | Rekomendasi |
|----|-------------|------------------|-------------|
| EC1 | **Hapus baris yang jadi dependensi replay** (mis. `CREATE TYPE PlanItemCategory`) → replay chain ERROR, `migrate diff` exit **1**, bukan 2. Acceptance "dihapus satu baris → exit 2" tidak universal | Acceptance #2 spec menuntut exit 2 | Ubah ekspektasi acceptance: "exit **non-zero** dengan pesan yang membedakan drift (2) vs tooling error (1)"; gate script wajib map dua kasus → **F5** |
| EC2 | **Timestamp/nama folder rekonsiliasi** — harus lexically sort SETELAH `20260920135945`; bentrok detik yang sama = urutan replay nondeterministik | Spec hanya bilang "timestamp >" | Tulis eksplisit: nama folder dipilih manual (mis. `20260921000000_reconcile_schedule_prosem_drift`), bukan hasil `date` real-time — hindari tabrakan |
| EC3 | **Dua proses gate berjalan bersamaan** → race pada drop/create `shadow_db` | Belum ada | Serialisasi murah: cek koneksi aktif ke `shadow_db` dulu, atau nama shadow unik per run + drop di akhir. Prioritas rendah (solo dev) |
| EC4 | **Diff kosong tapi berisi whitespace/komentar** → gate salah anggap drift | Tidak ada | Trim + cek panjang output sebelum menyatakan drift |
| EC5 | **Engine sudah jalan saat gate start** → `prisma dev start default` mungkin error "already running" | Belum ada | Cek `prisma dev status` dulu; start hanya bila mati → F6 |
| EC6 | **Neon compute suspended (idle)** → from-url diff / status timeout di awal | Belum ada | Retry sekali + pesan "Neon cold start" di gate/runbook; prioritas rendah |
| EC7 | **`SHADOW_DATABASE_URL` bocar ke file yang di-commit** | `.env` tidak di-commit (pola .env.local/.env terpisah); `.env.example` hanya `DATABASE_URL=` | Gate script set env var **in-memory** (`process.env`), tidak menulis ke `.env` → F7 |
| EC8 | **`migrate status` pasca-resolve via pooler** | Spec tidak eksplisit | Konsisten direct URL untuk seluruh operasi bookkeeping → F8 |
| EC9 | File rekonsiliasi mengandung statement di luar prediksi (mis. `ALTER TYPE`, default aneh) | Sudah tercakup kriteria review manual (STOP, lapor) ✅ | — |
| EC10 | npm script lintas-platform (Windows dev) | Script `.mjs` Node murni + npm script `node scripts/verify-migrations.mjs` | Sudah tepat; jangan perintah shell inline → sudah begitu di spec ✅ |

---

## 6. Temuan Ter-triage

| ID | Severity | Temuan | Rekomendasi |
|----|----------|--------|-------------|
| **F1** | **HIGH** (frozen) | Kriteria review manual menyebut nama index lama salah: `..._teaching_context_id_order_index_key` vs aktual `academic_plan_item_teachingContextId_orderIndex_idx` (stage_07 L86). Index pengganti juga akan bernama `academic_plan_item_teachingContextId_targetSemester_orderIndex_idx`, bukan varian snake_case | Koreksi kriteria: rujuk **semantik delta f0be2d5 + nama aktual objek dari chain**; prinsip "nama objek DB mengikuti output diff CLI, review memverifikasi struktur/semantik, bukan menghafal nama dari spec". *Perlu persetujuan human (bagian frozen)* |
| **F2** | MEDIUM | Tidak ada pre-flight `migrate status` sebelum resolve — asumsi "Neon 19 baris rapi" tak dicek saat eksekusi (PM3/PM6) | Tambah Always: pre-flight `migrate status` (direct URL) = 19 applied / 0 failed / 0 pending, sebelum from-url diff & resolve |
| **F3** | MEDIUM | Tidak ada baseline gate-run sebelum file rekonsiliasi dibuat — kerusakan tooling tak terpisah dari drift nyata (PM2, A3) | Tambah urutan: **(0) jalankan gate baseline** → harus exit 2 dengan diff == delta f0be2d5 murni. Ini juga membuktikan "gate tidak inert" sebelum file ada — memperkuat acceptance #2 |
| **F4** | MEDIUM | Gate hanya npm script tanpa enforcement — risiko tidak pernah dijalankan lagi; `db push` kedua tak terdeteksi (PM4) | Tambah task/hook: pre-push (atau pre-commit) bersyarat menjalankan gate saat ada perubahan `prisma/migrations/**` atau `prisma/schema.prisma`. Minimal: catat di SCL 1a sebagai kebijakan tim |
| **F5** | LOW-MED | Acceptance #2 salah ekspektasi untuk kasus replay-error (exit 1 ≠ 2); gate belum diwajibkan membedakan error tooling vs drift (A6, EC1) | Gate script: exit 2 = drift (pesan: perbaiki chain/schema), exit 1 = tooling (pesan: perbaiki setup lokal); acceptance di-reword ke "exit non-zero dengan pesan sesuai jenis" |
| **F6** | LOW | Port engine hardcode 51214; start tidak toleran bila engine sudah jalan (A5, EC5) | Gate script: resolve port via `prisma dev status` → fallback 51214; start hanya bila mati |
| **F7** | LOW | `SHADOW_DATABASE_URL` belum ada di `.env`; siapa yang men-set saat invoke belum ditetapkan (B7, EC7) | Tegaskan di spec: gate script set var in-memory (preseden `seed:superadmin` env-override CLI), tidak menulis `.env`; tambahkan komentar di `.env.example` |
| **F8** | LOW | Verifikasi from-url tidak eksplisit pakai direct URL (PM5, EC8) | Runbook satu sumber: `NEON_DIRECT_URL` dipakai untuk from-url diff + resolve + status. Query param `sslmode=require` dipertahankan (F9 menyatu di sini) |
| **F10** | LOW (reframing) | Acceptance #4 (`npm test` hijau) berisiko dibaca sebagai bukti rekonsiliasi — padahal test menyentuh Neon, bukan chain (A8) | Reword: "bukti non-regresi aplikasi" — bukti rekonsiliasi = gate exit 0 + status 20 up-to-date |
| **F13** | LOW | Guard double-resolve tidak eksplisit (PM6) | Always: resolve dijalankan tepat satu kali; jika ragu, `migrate status` dulu |

**Temuan positif yang wajib bertahan (KEEP):** asumsi drift tunggal terverifikasi git (B5); larangan `db execute` file rekonsiliasi ke Neon; urutan file-dulu → verify → resolve → gate → commit; sumber SQL = diff CLI bukan rekonstruksi manual; `klassa_dev` dibiarkan scratch; gate lintas-platform via Node script.

---

## 7. Rekomendasi Perubahan Spec

### 7a. Bagian frozen — perlu renegosiasi human

1. **[F1]** Koreksi bullet pertama "Always": ganti frasa nama index menjadi — *"satu-satunya drop yang sah: index plan-item lama `[teachingContextId, orderIndex]` (dibuat stage_07 sebagai `academic_plan_item_teachingContextId_orderIndex_idx`) diganti `[teachingContextId, targetSemester, orderIndex]`; nama objek final mengikuti output diff CLI"*.
2. **[F2]** Tambah bullet Always pre-flight: `migrate status` (direct URL) = 19 applied / 0 failed sebelum from-url diff & resolve.

### 7b. Bagian non-frozen — bisa langsung diterapkan

1. **[F3]** Tasks: sisipkan langkah 0 "baseline gate run" (exit 2, diff == delta f0be2d5 murni) sebelum generate file.
2. **[F4]** Tasks/Design Notes: hook pre-push bersyarat untuk gate; fallback = kebijakan tim di SCL 1a.
3. **[F5]** Acceptance #2 reword: exit **non-zero** dengan pesan per jenis (2 = drift, 1 = tooling); gate script memetakan keduanya.
4. **[F6, F7, F8, F13]** Implementation Notes: port dinamis + toleransi engine jalan; `SHADOW_DATABASE_URL` in-memory oleh script; satu `NEON_DIRECT_URL` untuk from-url/resolve/status; larangan double-resolve; nama folder rekonsiliasi manual `> 20260920135945` (EC2).
5. **[F10]** Reword acceptance #4 sebagai bukti non-regresi, bukan bukti rekonsiliasi.

---

## 8. Verdict

Spec **layak dieksekusi setelah F1 dikoreksi** (karena review manual adalah gerbang kualitas utamanya) dan F2–F3 ditambahkan (murah, menutup dua jalur kegagalan eksekusi yang paling mungkin). F4 menentukan apakah utang ini benar-benar lunas *permanen* atau hanya lunas *hari ini*. Sisa temuan adalah pengerasan prosedural berbiaya rendah.

Tidak ada temuan yang membalik arsitektur: pendekatan diff-CLI → resolve → gate tetap satu-satunya jalur yang benar untuk situasi ini.
