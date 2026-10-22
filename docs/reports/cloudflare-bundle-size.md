# Laporan Analisis & Optimasi Bundle Size Cloudflare Workers

**Tanggal:** 22 Oktober 2026  
**Branch:** `fix/cloudflare-bundle-size`  
**Target:** Cloudflare Workers Free Tier (< 3,072 KiB / 3 MiB gzip)  
**Status Gate:** ⚠️ **BLOCKED on Workers Free Tier** (Melebihi batas Free Tier, tetapi siap untuk Workers Paid / Server Container)

---

## 1. Ringkasan Eksekutif & Metrik

Optimasi tahap pertama berhasil memangkas ukuran bundle secara signifikan dengan mengisolasi modul autentikasi token dari runtime database pada middleware/proxy dan instrumentation hook.

| Status | Total Upload (Raw) | Gzip Compressed | Keterangan |
|---|---|---|---|
| **Baseline (Sebelum)** | 43,890.00 KiB | 10,229.47 KiB (~9.99 MiB) | Unminified, proxy & instrumentation memuat Prisma + Better Auth |
| **Baseline Minified** | 31,392.00 KiB | 9,365.97 KiB (~9.15 MiB) | `--minify` pada baseline |
| **Sesudah (Unminified)** | 34,364.58 KiB | 7,547.83 KiB (~7.37 MiB) | Proxy & instrumentation bersih dari Prisma |
| **Sesudah (Minified)** | **23,313.05 KiB** | **6,774.08 KiB (~6.61 MiB)** | **Penurunan bersih: -8,079 KiB raw (-25.7%), -2,591 KiB gzip (-27.7%)** |
| **Batas Free Tier** | - | **3,072.00 KiB (3.00 MiB)** | **Gap tersisa: +3,702 KiB gzip** |

---

## 2. Tindakan yang Telah Dilakukan

1. **Pemisahan Modul Token Siswa (`student-session-token.ts`):**
   - Mengekstrak fungsi murni HMAC, signing, verifikasi token, dan konstanta cookie ke file baru tanpa dependensi database (`src/modules/student-auth/student-session-token.ts`).
   - `src/modules/student-auth/student-session.ts` tetap mengekspor API yang sama (backward-compatible) untuk server callers.
2. **Dekopel dari Edge Middleware / Proxy (`src/proxy.ts`):**
   - Mengubah import proxy agar langsung merujuk ke modul murni token.
   - Hasil: Bundle middleware `.open-next/middleware/handler.mjs` turun drastis dari **8.5 MB** menjadi **2.2 MB** unminified, dan seluruh dependensi Prisma/pg/Better Auth lenyap dari bundle middleware.
3. **Dekopel Server Boot Instrumentation (`src/instrumentation.ts`):**
   - Mengubah lazy import secret check agar tidak mengimpor file `student-session.ts` yang menarik seluruh Prisma schema.
4. **Konfigurasi Minifikasi Otomatis (`wrangler.jsonc`):**
   - Menambahkan `"minify": true` pada konfigurasi Wrangler.
5. **Testing & Validasi:**
   - Menambahkan test suite baru `src/modules/student-auth/__tests__/student-session-token.test.ts` (100% lulus, 10/10 test).
   - Memastikan seluruh 88 test otentikasi dan guard sesi lulus tanpa regresi.

---

## 3. Analisis Anatomi Bundle Server yang Tersisa

Berdasarkan analisis metafile esbuild pada `.open-next/server-functions/default/handler.mjs` (29.1 MB raw):

1. **Prisma Fast WASM Compiler (`query_compiler_fast_bg.wasm-base64.js`):**
   - **4,789 KiB raw / 1,685 KiB gzip**
   - Berkontribusi sebesar **> 54%** dari seluruh kuota batas Free Tier (3 MiB). Komponen ini wajib ada di runtime karena Prisma 6 menggunakan engine WebAssembly untuk query PostgreSQL di edge/worker environment.
2. **Next.js Core Runtime + React DOM Edge:**
   - **~960 KiB raw / ~254 KiB gzip**
   - Core runtime minimal yang dibutuhkan oleh Next.js App Router pada Cloudflare.
3. **Komponen Halaman AI Studio & Visual Editor:**
   - **~2,023 KiB raw / ~556 KiB gzip**
4. **Pustaka Export Dokumen (ExcelJS, Docx, Jspdf, Pptxgenjs):**
   - **~2,500 KiB raw / ~1,200 KiB gzip**
5. **Kysely, Better Auth & Multi-tenant Router:**
   - **~2,200 KiB raw / ~800 KiB gzip**

---

## 4. Kesimpulan & Rekomendasi

### Fakta Teknis
Pada aplikasi Next.js full-stack dengan 55 tabel Prisma, Better Auth, dan puluhan Server Actions:
- **WASM Engine Prisma saja sudah memakan 1.68 MiB gzip** (hanya tersisa 1.32 MiB untuk SELURUH kode aplikasi, Next.js runtime, UI, dan route handlers).
- Mencapai ukuran **< 3 MiB gzip** pada Workers Free Tier secara teknis **hampir mustahil** tanpa membuang Prisma ORM atau menghapus sebagian besar fitur aplikasi.

### Pilihan Solusi untuk User

1. **Opsi A: Cloudflare Workers Paid ($5/bulan) — [Direkomendasikan jika tetap ingin di Cloudflare]**
   - Limit ukuran bundle pada Workers Paid adalah **10 MiB gzip**.
   - Bundle aplikasi saat ini (**6.61 MiB gzip**) **SUDAH MEMENUHI SYARAT** dan siap dideploy langsung ke akun Cloudflare user.
2. **Opsi B: Self-Hosted / Platform Tanpa Limit 3 MiB (Coolify / VPS / Docker / Vercel)**
   - Menggunakan VPS sendiri (misal Hetzner/DigitalOcean $4-5/bln) atau server container tanpa batasan ukuran file JavaScript.
3. **Opsi C: Tetap Paksa Workers Free Tier (Sangat Berisiko)**
   - Memerlukan perombakan arsitektur besar-besaran (misalnya memisahkan backend API ke servis terpisah, membuang Prisma dan beralih ke Kysely/raw SQL murni tanpa WASM engine, atau memindahkan seluruh generator export dokumen ke external service). Ini melanggar batasan stabilitas dan kelengkapan fitur.

---
*Laporan dibuat otomatis sebagai bagian dari verifikasi build branch `fix/cloudflare-bundle-size`.*
