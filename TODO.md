# Daftar Rencana Tugas / Backlog (TODO)

Berikut adalah daftar tugas terencana yang akan dikerjakan:

---

## 1. Modul Tugas: Pengiriman via File
- **Deskripsi:** Menambahkan kemampuan agar tugas bisa dikirim/dikumpulkan melalui file (semua jenis kecuali program/makro, maks 25 MB × 5 file) ke dua arah: jawaban siswa dan lampiran guru.
- **Status:** ✅ Selesai
  - ✅ **Story 1 — File jawaban siswa**: skema `submission_file`, adapter S3-compatible (R2/MinIO/SeaweedFS), presigned upload direct-browser, route akses terautentikasi, UI portal siswa + koreksi guru.
  - ✅ **Story 2 — Lampiran guru**: skema `assignment_attachment`, upload presign guru, dialog kelola lampiran di portal guru (ubah kapan saja), tampilan chip lampiran di portal siswa.
  - ✅ **Pengujian Lokal**: didukung SeaweedFS lokal di `127.0.0.1:8333`, 857/857 unit & integration test passing.
  - Blueprint: `docs/product/assignment-file-blueprint.md`

---

## 2. Klassa Agent
- **Deskripsi:** Agent kustom di dalam ekosistem Klassa yang membantu mengerjakan tugas-tugas guru dan menjadi ruang diskusi interaktif mengenai berbagai masalah di kelas.
- **Status:** ✅ Selesai (Semua Story 1–6 Selesai & Terverifikasi Penuh via BMAD Build)
- **Stage Dokumentasi:** `docs/development/stages/DEV_STAGE_12_KLASSA_AGENT.md`
- **Ringkasan Arsitektur & Keputusan:**
  - **Universal Multi-Model:** 100% bebas lock-in vendor, bebas dipasang model komersial (Gemini, Claude, GPT) maupun model lokal (Hermes/vLLM) via protokol standar.
  - **3 Kapabilitas Utama:** Admin Ber-Data (kalkulasi deterministik untuk SEMUA hal yang bisa dihitung), Pedagogi Solutif (non-klinis), Operasional (semua fitur Klassa).
  - **Matriks Aksi (Human-in-the-Loop):** Aksi baca/draf langsung jalan; aksi tulis resmi/sensitif wajib persetujuan guru via kartu interaktif di chat dengan Atomic Gate Lock anti-TOCTOU.
  - **Memori Komprehensif:** Mengingat preferensi ajar dan merangkum intisari percakapan umum guru agar agen selalu nyambung dari waktu ke waktu dengan sanitasi tag XML.
  - **Klassa Pulse (Admin Console):** Visualisasi makro isu guru Indonesia, kurikulum tersulit, beban stres, dan jam lembur guru secara teranonimkan (Zero-PII UU PDP).
  - Blueprint: `docs/product/klassa-agent-blueprint.md` (+ versi web: `klassa-agent-blueprint.html`)
  - Hasil forge & laporan visual: `_bmad-output/forge/klassa-agent/` (`forged-idea.md` & `forge-report.html`)
  - Patch & Artefak Review: `_bmad-output/implementation-artifacts/diff-klassa-agent-*.patch`
  - Hasil Pengujian: 55/55 agent tests passing, 910/910 full suite regression passing (0 regressions).

---

## 3. Perapihan Mode PC & Mobile Masing-Masing Portal
- **Deskripsi:** Pembenahan tampilan dan pengalaman responsif (PC/Desktop vs Mobile) pada setiap portal agar nyaman dan rapi di semua perangkat.
- **Status:** 🟡 Sedang Berjalan (Portal Siswa SELESAI — verified via git: 3e5efc4, 6a667ac, e5d3499)
- **Cakupan Portal:**
  - ✅ **Portal Siswa** — SELESAI SEMUA (3/3 story)
    - ✅ Story 1 — Responsive Shell & Dual-Mode Navigation (commit `3e5efc4`)
    - ✅ Story 2 — Bento Grid Dashboard & Jadwal Mingguan (commit `6a667ac`, spec: `spec-student-portal-bento-dashboard-and-weekly-schedule.md`)
    - ✅ Story 3 — Card Grid Tugas & Layar Pengerjaan Kuis CBT (commit `e5d3499`, spec: `spec-student-portal-dual-mode-tugas-quiz-cbt.md`)
  - ✅ **Portal Guru** — dianggap selesai oleh owner (perubahan responsif sudah dilakukan sebelumnya; story kelas-mobile dibatalkan 2026-10-21 karena tidak diperlukan lagi)
  - 📋 **Portal Orang Tua / Wali** — belum dimulai
  - 📋 **Portal Superadmin** — belum dimulai

---

## 4. Setup Stack & Deployment (Neon + PostHog + Cloudflare + Composio)
- **Deskripsi:** Setup infrastruktur production untuk Klassa: database Neon, analytics PostHog, deploy ke Cloudflare (fallback: Vercel), lalu menghubungkan semua akun ke Composio dan agent pi via MCP.
- **Status:** 🔴 PRIORITAS #1 — ⏳ Menunggu Credential (Neon API key, PostHog key + host, info domain)

### Keputusan Arsitektur (FINAL — jangan dibantah lagi 😄)
- ✅ **Database: tetap Prisma + PostgreSQL di Neon** (free tier: 100 CU-hrs/bln, 1 GB storage/project — cukup untuk launch, tanpa batas waktu). `schema.prisma` vendor-agnostic: ganti vendor Postgres lain = ganti connection string saja.
- ❌ **SKIP Convex** — bukan vendor Postgres, itu engine/ekosistem berbeda (Convex functions, bukan SQL/Prisma). Migrasi = rewrite 55 model + 152 file (~40% codebase) + re-test semua stage. Tidak ada keuntungan fungsional untuk app ini.
- ❌ **SKIP WorkOS** — better-auth sudah jalan & terintegrasi; WorkOS overkill (fokus enterprise SSO).
- ✅ **PostHog** — tambahan aman, tidak bentrok (SDK `posthog-js`).
- ✅ **Cloudflare untuk hosting** — catatan: butuh adapter OpenNext (`@opennextjs/cloudflare`), dan ada risiko penyesuaian untuk fitur Node (Prisma/pg, S3). Jika macet total → fallback **Vercel** (sudah ada `vercel.json`).
- ✅ **Composio** → connect tools ke agent pi via MCP (tidak tergantung pilihan hosting).

### Urutan Kerja
1. **Neon** — bikin project + database → ganti `DATABASE_URL` → jalankan 33 migrations + seed → pastikan app jalan.
2. **PostHog** — install SDK → event dasar (login, signup, generate AI) → test.
3. **Cloudflare** — setup OpenNext → deploy → sambungkan domain custom → HTTPS otomatis.
4. **Composio** — install MCP ke agent pi → connect tools → test.
5. **Rapiin `.env` production** + verifikasi semua fitur di domain production (termasuk better-auth `BETTER_AUTH_URL`/trusted origins).

### Yang Dibutuhkan dari Owner (belum dikirim)
- [ ] **Neon API key** (bikin akun dulu + verifikasi email → Settings → API Keys) — bukan password
- [ ] **PostHog Project API key + host** (`us.i.posthog.com` / `eu.i.posthog.com`)
- [ ] Info **domain**: nama domain + di mana dibeli (Cloudflare langsung / registrar lain)
- [ ] Saat step Cloudflare: approve popup `wrangler login` di browser
- [ ] Saat step Composio: approve popup `composio login` di browser

### Catatan Keamanan Akses
- Prinsip: **API key/OAuth popup, tanpa share password utama**. Semua key bisa di-revoke sendiri dari dashboard masing-masing service.

---

## 5. Fix Klassa Agent Router + Persempit Scope
- **Deskripsi:** Akar masalah error "⚠️ seluruh jalur model AI sedang sibuk": failover router hanya dalam 1 provider (GLM→GLM semua) + endpoint bigmodel.cn lambat dari Indonesia. Fix: cross-provider failover (GLM mati → Gemini). Sekalian persempit scope Klassa Agent jadi **teman diskusi + tutorial** via prompt & feature flag (kode admin-ber-data/operasional ditidurkan, TIDAK dihapus).
- **Status:** 🟡 PRIORITAS #2 — bisa dikerjakan SEKARANG (tanpa credential)
- **File kunci:** `src/modules/agent/agent.router.ts`, `src/app/api/agent/chat/route.ts`

---

## 6. Ticketing Bug
- **Deskripsi:** Sistem tiket bug untuk user melaporkan masalah setelah app live. Loop quality sebelum monetisasi.
- **Status:** ✅ Selesai (commit `84236ac`)
  - Skema Prisma: model `BugReport`, enum `BugReportCategory`, `BugReportStatus`, `BugReportPriority`, nomor tiket berurutan `TICK-YYMM-XXXX`.
  - Frontend User: Floating trigger & modal pelaporan `BugReportWidget` di root layout (auto-capture URL & device info).
  - Superadmin Console: Halaman `/admin/bugs` dengan filter status, filter kategori, search bar, dan modal resolusi/update tiket.
  - Test Suite: 3/3 unit tests passing. Migration `20261026071203_add_bug_report_model` applied.


---

## 7. Payment Gateway
- **Deskripsi:** Monetisasi. Kandidat provider lokal: Midtrans/Xendit (QRIS, VA, e-wallet). Butuh URL production stabil + HTTPS + webhook.
- **Status:** ⏳ PRIORITAS #4 — setelah ticketing & app stabil

---

## 8. Video Tutorial YouTube
- **Deskripsi:** Video tutorial fitur Klassa, di-embed/link dari app ke YouTube. Direkam PALING AKHIR (UX final + sekalian tutorial cara bayar) supaya tidak rekam ulang.
- **Status:** ⏳ PRIORITAS #5 — terakhir

---

## 9. Perapihan Output Hasil Download
- **Deskripsi:** Pembenahan hasil ekspor/download dokumen (report/nilai/dokumen Word-Excel-PDF via docx, docxtemplater, exceljs, jspdf) agar output rapi, konsisten, dan profesional sebelum dilihat user secara luas.
- **Cakupan (rinci saat mulai pengerjaan):** layout/format file hasil download, konsistensi template, penamaan file, dsb.
- **Status:** ⏳ Bisa dikerjakan kapan saja — idealnya selesai sebelum #7 (Payment) bersama #3

---

## Urutan Eksekusi Disepakati
1. **#4 Deployment** (fondasi semua — BLOCKED: nunggu credential owner)
2. **#5 Fix Router Klassa** (tidak butuh credential — bisa jalan paralel sambil nunggu)
3. **#6 Ticketing Bug** → 4. **#7 Payment** → 5. **#8 Video Tutorial**
- #3 Perapihan Responsive (sedang berjalan) & **#9 Perapihan Output Download** boleh dikerjakan kapan saja, idealnya selesai sebelum #7 (user bayar = UX harus rapi).
