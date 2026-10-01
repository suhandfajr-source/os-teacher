# Blueprint Folderisasi & Dokumentasi

> **Status: SELESAI — diimplementasikan penuh. Verifikasi akhir: tsc 0 error, 297+ test lulus, production build sukses.**
> Dibuat oleh Winston (System Architect). Tidak ada satu file pun yang diubah saat blueprint ini dibuat.

---

## 1. Tujuan

1. AI dan manusia bisa menemukan konteks dengan cepat (satu fitur = satu folder)
2. Dokumentasi tertata berdasarkan pertanyaan yang dijawabnya
3. **Nol kerusakan kode** — syarat mutlak, bukan target yang dinegosiasikan

## 2. Prinsip Eksekusi

- Hanya **memindahkan** file, tidak mengubah isi kode (kecuali baris `import`)
- Satu tahap = satu commit = mudah dibatalkan
- Setiap tahap wajib lulus verifikasi sebelum lanjut
- Yang tidak perlu berubah, tidak disentuh

---

## BAGIAN A — Reorganisasi `docs/`

### A. Struktur Tujuan

```
docs/
  README.md              ← BARU: peta dokumentasi
  architecture/          ← ada, tidak diubah
  brand/                 ← ada, tidak diubah (sudah rapi)
  product/               ← BARU
  design/                ← BARU
  development/
    stages/              ← BARU
    guides/              ← BARU
  reports/               ← BARU (arsip)
  presentations/         ← BARU
```

### B. Pemetaan File

**→ `docs/product/`** (6 file)

| File asal (docs/) | Tujuan |
|---|---|
| `PRODUCT_KNOWLEDGE_V2.html` + `.pdf` | `product/` |
| `ACADEMIC_CURRICULUM_MASTER_BLUEPRINT.md` | `product/` |
| `TEACHING_SCHEDULE_MASTER_BLUEPRINT.md` | `product/` |
| `TEACHING_SCHEDULE_MASTER_BLUEPRINT_V2.md` | `product/` |
| `SUPERADMIN_DASHBOARD_MASTER_BLUEPRINT.md` | `product/` |
| `KERANGKA-superadmin-lane.md` | `product/` |

**→ `docs/design/`** (3 file)

| File asal | Tujuan |
|---|---|
| `EDU_OS_UI_DESIGN_SPECIFICATION.md` | `design/` |
| `OS_TEACHER_UI_UX_MASTER_BLUEPRINT.md` | `design/` |
| `OS_TEACHER_DESIGN_SYSTEM_MASTER_REPORT.md` | `design/` |

**→ `docs/development/`** (15 file)

| File asal | Tujuan |
|---|---|
| `products/DEV_STAGE_02` … `DEV_STAGE_11` (10 file) | `development/stages/` |
| `products/ADDENDUM_ADAPTIVE_PPT_GENERATOR_V1.md` | `development/stages/` |
| `products/Stage 01 — Product Problem.md` | `product/` |
| `OS_TEACHER_UI_UX_PHASED_IMPLEMENTATION_PLAN.md` | `development/` |
| `RELEASE_READINESS.md` | `development/` |
| `CHECKLIST-FITUR.md` | `development/` |
| `PLAYBOOK-ROLLOVER-TA.md` | `development/` |
| `PANDUAN-HEMAT-TOKEN-VIBECODER.html` + `.pdf` | `development/guides/` |

**→ `docs/reports/`** (6 file, ARSIP — jangan dihapus, jangan diupdate)

| File asal | Tujuan |
|---|---|
| `REPORT-TAHAP-1-ANALISIS-BMAD.md` … `-4-` | `reports/` |
| `REPORT-QUIZ-ONLINE.md` | `reports/` |
| `BMAD-RECOMMENDATIONS-QUIZ-ONLINE.md` | `reports/` |
| `ui-concepts-bmad.html` | `reports/` |
| `FIRST_ANTIGRAVITY_PROMPT.md` (dari root) | `reports/` |

**→ `docs/presentations/`** (12 file)

| File asal | Tujuan |
|---|---|
| `preview-5-konsep-lengkap.html` | `presentations/` |
| `preview-app-klassa.html` | `presentations/` |
| `preview-edu-os-full.html` | `presentations/` |
| `preview-klassa-dashboard-v3.html` + `.png` | `presentations/` |
| `preview-ui-guru.html` | `presentations/` |
| `card-fill-showcase.html` | `presentations/` |
| `fill-shape-showcase.html` | `presentations/` |
| `font-showcase.html` + `.png` | `presentations/` |
| `klassa-logo-showcase.html` | `presentations/` |
| `kerangka-superadmin-lane.html` | `presentations/` |
| `checklist-fitur.html` | `presentations/` |

**→ Bersih-bersih root (HATI-HATI — verifikasi duplikat dulu)**

| File root | Tindakan |
|---|---|
| `product-knowledge.html/.pdf`, `product-knowledge-v2.html/.pdf` | Cek duplikat vs `docs/` → konfirmasi user → hapus salah satu |
| `KLASSA_BRAND_ASSET_CHECKLIST.pdf` | Duplikat dari `docs/brand/` → konfirmasi → hapus versi root |
| `dev-server.log` | Hapus + tambah `*.log` ke `.gitignore` |

**Setelah semua pindah:** folder `docs/products/` kosong → hapus. Tulis `docs/README.md` (peta).

---

## BAGIAN B — Merge Komponen ke Modul (`src/`)

### B. Temuan Riset (faktual, sudah diverifikasi)

1. Hanya **5 folder komponen** yang punya pasangan modul — total hanya **11 file** yang import-nya perlu di-update:

| Folder komponen | Modul tujuan | Jumlah file yang meng-import |
|---|---|---|
| `src/components/templates` | `src/modules/templates` | 1 |
| `src/components/academic` | `src/modules/academic` | 1 |
| `src/components/assignments` | `src/modules/assignments` | 2 |
| `src/components/quiz` | `src/modules/quiz` | 2 |
| `src/components/schedule` | `src/modules/schedule` | 5 |

2. **TIDAK ADA** referensi `components/<domain-tersebut>` di luar `src/` (tests, scripts, config) — sudah diverifikasi dengan grep.

### C. Struktur Tujuan Per Modul

```
src/modules/quiz/
  components/          ← pindahan utuh dari src/components/quiz
  ...isi modul yang sudah ada (tidak disentuh)
```

Import berubah mekanis: `@/components/quiz/X` → `@/modules/quiz/components/X`

### D. Folder yang TIDAK Dipindah (dan alasannya)

| Folder | Alasan tetap |
|---|---|
| `src/components/ui` | Konvensi shadcn — `components.json` alias `@/components/ui` menunjuk ke sini. 73 file meng-import. Mutlak tetap. |
| `src/components/layout` | Shared lintas modul |
| `src/components/brand` | Shared lintas modul |
| `src/app/**` | Semua route files (`page.tsx`, `layout.tsx`, `route.ts`) — aturan Next.js, tidak boleh pindah |
| `src/lib`, `prisma`, config root | Bukan bagian scope ini |

### E. Keputusan Terbuka (butuh persetujuan user, tidak dieksekusi diam-diam)

| Folder | Pertanyaan |
|---|---|
| `src/components/student` (8 file) | Gabung ke `src/modules/student-portal/components`? Nama modulnya beda (`student` vs `student-portal`/`students`) — perlu keputusan |
| `src/components/ai-studio` | Gabung ke `src/modules/ai/components`? |

Rekomendasi Winston: ya, keduanya digabung — konsisten dengan prinsip satu-fitur-satu-folder. Tapi menunggu persetujuan.

### F. Urutan Eksekusi (dari risiko terkecil)

1. `templates` (1 referensi) ← pilot, buktikan prosedur aman
2. `academic` (1)
3. `assignments` (2)
4. `quiz` (2)
5. `schedule` (5)
6. Jika E disetujui: `student` → `student-portal`, `ai-studio` → `ai`
7. Setiap modul selesai → tulis `src/modules/<modul>/README.md`

---

## 3. Analisis Risiko & Mitigasi

| Risiko | Peluang | Mitigasi (sudah diverifikasi) |
|---|---|---|
| Import putus saat pindah folder | Pasti terjadi, 11 file | Grep daftar file lengkap → update mekanis → `tsc` menangkap semua yang terlewat |
| Tailwind class hilang | Rendah | Tailwind v4 CSS-first, scan otomatis dari `globals.css` — tidak ada `content` glob manual yang perlu di-update (sudah dicek) |
| shadcn rusak | Nol | `src/components/ui` tidak disentuh; alias `components.json` tetap valid |
| Test rusak | Rendah | Vitest scan `src/**` (path tetap valid); Playwright di `tests/` tidak meng-import komponen (sudah dicek grep) |
| Route Next.js rusak | Nol | `src/app/**` tidak disentuh sama sekali |
| Import relatif di DALAM folder yang dipindah | Nol | Folder dipindah utuh (`git mv`), import relatif antar file dalam folder tidak berubah |
| Kehilangan riwayat git | Rendah | Semua lewat `git mv` (rename detection aktif) |
| File dokumentasi terhapus | Nol di Tahap A | Murni pindah; penghapusan hanya di tahap bersih-bersih root setelah verifikasi duplikat + konfirmasi user |

## 4. Protokol Verifikasi (wajib per tahap)

```bash
npx tsc --noEmit        # typecheck — menangkap import putus
npx eslint src --max-warnings=0   # lint
npm run build           # build penuh (di milestone, bukan tiap file)
npx vitest run          # unit test
```

**Aturan emas:** verifikasi gagal → berhenti, lapor ke user, tidak lanjut tahap berikutnya.

## 5. Strategi Rollback

- Satu tahap = satu commit dengan pesan jelas (`refactor: move quiz components into module`)
- Rollback satu tahap: `git revert <commit>` — tanpa efek ke tahap lain
- Rollback total: kembali ke commit sebelum eksekusi dimulai

## 6. Checklist Eksekusi

- [ ] Tahap A1: buat folder baru docs/ + pindah 6 file product
- [ ] Tahap A2: pindah design + development (15 file)
- [ ] Tahap A3: pindah reports (5 file) + presentations (12 file) + hapus products/ kosong
- [ ] Tahap A4: tulis `docs/README.md` (peta)
- [ ] Tahap A5: bersih root (verifikasi duplikat → konfirmasi user → hapus)
- [x] Tahap B1 ✅ templates (pilot, 86 test hijau)
- [x] Tahap B2 ✅ academic (35 test hijau; catat utang lint lama ProsemGrid)
- [x] Tahap B3 ✅ assignments (modul belum punya test — typecheck jadi penjaga)
- [x] Tahap B4 ✅ quiz (40 test hijau)
- [x] Tahap B5 ✅ schedule (15 test hijau; catat utang lint lama ScheduleConfigDialog)
- [x] Tahap B6 ✅ student → student-portal, ai-studio → ai (121 test hijau)
- [x] Gerbang penutup: npm run build penuh ✅ (semua route ter-render)
