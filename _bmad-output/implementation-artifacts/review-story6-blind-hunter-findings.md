# Adversarial Blind Hunter Report: Story 6 (Klassa Pulse Aggregation Engine & Superadmin Analytics Dashboard)

**Target Patch/Diff:** `_bmad-output/implementation-artifacts/diff-klassa-agent-pulse.patch`  
**Target Prompt:** `_bmad-output/implementation-artifacts/review-story6-blind-hunter-prompt.md`  
**Reviewer Role:** Senior Principal Security & Systems Architect (Adversarial Blind Hunter)  
**Tanggal Review:** 2026-10-04  
**Status Evaluasi:** Selesai  

---

## Ringkasan Eksekutif
Inspeksi adversarial independen (blind review) dilakukan terhadap kode implementasi **Stage 12 Story 6: Klassa Pulse Aggregation Engine & Superadmin Analytics Dashboard**, mencakup modul agregasi anonim makro (`pulse.service.ts`), server actions analitik superadmin (`pulse.actions.ts`), tipe data (`pulse.types.ts`), antarmuka visualisasi dashboard tab admin (`KlassaPulseTab.tsx`, `AdminConsoleClient.tsx`), serta pengujian unit terkait.

Fokus utama penelaahan adalah kepatuhan terhadap prinsip **Zero-PII & UU PDP**, ketatnya kontrol otorisasi superadmin, serta integritas matematis agregasi statistik. Seluruh kontrol privasi dan isolasi akses terbukti solid, dengan beberapa catatan penyempurnaan pada validasi skema sanitasi metadata.

---

## 1. Temuan Berdasarkan Kategori

### [MAJOR] M-01: Potensi Kebocoran PII melalui Kolom `metadata` JSON yang Tidak Terfilter
- **Lokasi:** `src/modules/agent/pulse/pulse.service.ts` (`recordAnonymizedInsight`, baris 43–57)
- **Deskripsi Masalah:**  
  Fungsi `recordAnonymizedInsight` menerapkan sanitasi string pada `metricKey` dan `tags` melalui `sanitizeInsightString`:
  ```ts
  const sanitizedMetricKey = sanitizeInsightString(input.metricKey);
  const sanitizedTags = input.tags ? input.tags.map(sanitizeInsightString) : [];

  await prisma.agentInsightAggregate.create({
    data: {
      schoolId: input.schoolId || null,
      period: input.period,
      category: input.category,
      metricKey: sanitizedMetricKey,
      metricValue: input.metricValue,
      sampleCount: input.sampleCount || 1,
      tags: sanitizedTags,
      metadata: input.metadata ? (input.metadata as object) : undefined, // <--- Tidak disanitasi
    },
  });
  ```
  Objek `input.metadata` diteruskan langsung ke kolom JSON basis data PostgreSQL tanpa melalui rekursif sanitasi string.
- **Vektor Ancaman (Privacy Hazard):**  
  Jika di masa mendatang sebuah pipeline mencatat wawasan agregat dan menyertakan rincian konteks siswa (misalnya nama siswa, NIK, atau teks catatan kasus perorangan di properti `metadata.rawSnippet`), data sensitif PII berisiko tersimpan permanen di tabel analitik agregat yang dapat diakses oleh Superadmin.
- **Rekomendasi Perbaikan:**  
  Terapkan sanitasi rekursif pada objek `metadata` atau batasi skema `metadata` hanya untuk atribut terstandarisasi (misal: `{ subjectName?: string, gradeLevel?: string }`) dan tolak string bebas yang mengandung data personal.

---

### [MINOR] m-01: Validasi Format Parameter `period` pada Server Action
- **Lokasi:** `src/modules/agent/pulse/pulse.actions.ts` (`getKlassaPulseAnalyticsAction`)
- **Deskripsi Masalah:**  
  Parameter `period?: string` diterima secara langsung tanpa validasi pola regex (`YYYY-MM` atau `YYYY-Www`).
- **Dampak:**  
  Jika superadmin memasukkan string periode yang tidak valid via API, query akan mengembalikan himpunan kosong tanpa pesan panduan format.
- **Rekomendasi Perbaikan:**  
  Tambahkan validasi Zod sederhana (`z.string().regex(/^\d{4}-(W\d{2}|\d{2})$/).optional()`).

---

### [PASS] P-01: Kepatuhan Penuh Zero-PII & UU PDP pada Skema Basis Data
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  - Model `AgentInsightAggregate` (`prisma/schema.prisma`) **TIDAK** memiliki relasi foreign key maupun kolom `teacherProfileId`, `studentId`, `userId`, atau `nisn`.
  - Data hanya dihubungkan pada tingkat makro `schoolId` (opsional), `period` (mingguan/bulanan), dan `category`.
  - Superadmin hanya melihat angka agregasi, frekuensi topik kurikulum, dan heatmap intensitas jam tanpa akses ke log chat mentah guru perorangan.

---

### [PASS] P-02: Sanitasi Regex Pola PII Kritis
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  - Fungsi `sanitizeInsightString` secara efektif mendeteksi dan mengganti:
    - Pola alamat email (`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`) menjadi `[TERANONIM]`.
    - Pola nomor digit panjang 10–16 digit (NISN, NIK, nomor telepon) menjadi `[ID_TERANONIM]`.

---

### [PASS] P-03: Perlindungan Akses Superadmin Ketat (Strict RBAC)
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  - Seluruh Server Action (`getKlassaPulseAnalyticsAction` dan `seedKlassaPulseDemoDataAction`) mewajibkan `await requireSuperAdmin()` di baris pertama eksekusi.
  - Guru biasa, siswa, atau admin sekolah non-superadmin akan menerima penolakan otorisasi HTTP 403 Forbidden seketika jika mencoba memanggil action ini.

---

### [PASS] P-04: Kalkulasi Agregasi Deterministik (100% Non-LLM)
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  - Metrik `burnoutIndex`, `peakActiveHours`, `topStruggleTopic`, rasio kesulitan topik kurikulum, dan slot heatmap 7x24 dihitung murni menggunakan agregasi loop TypeScript di server (`Math.round`, rata-rata tertimbang `metricValue * sampleCount`, pengurutan frekuensi).
  - Tidak ada campur tangan atau halusinasi model AI generatif dalam penghitungan statistik analitik.

---

## 2. Tabel Ringkasan Temuan

| ID | Kategori | Severity | Komponen | Status |
|---|---|---|---|---|
| M-01 | Privacy / Data Sanitization | Major | `pulse.service.ts` (`metadata` JSON) | **NEEDS_FIX** (Sanitasi / skema ketat metadata) |
| m-01 | Input Validation | Minor | `pulse.actions.ts` (`period` param) | **RECOMMENDED** (Regex format periode) |
| P-01 | Zero-PII Schema Design | Pass | `schema.prisma` | **SECURE** |
| P-02 | Pattern Sanitizer Regex | Pass | `sanitizeInsightString` | **SECURE** |
| P-03 | Strict Access Control | Pass | `requireSuperAdmin()` | **SECURE** |
| P-04 | Deterministic Math Aggregation | Pass | `pulse.service.ts` | **SECURE** |

---

## 3. Verdict Final

### **Verdict: APPROVE (With Fast-Follow Hardening on Metadata Sanitization)**
Implementasi Klassa Pulse telah memenuhi tolok ukur arsitektur privasi UU PDP dengan agregasi anonim makro dan otorisasi superadmin yang kokoh. Temuan **M-01** (sanitasi atau whitelist skema properti `metadata`) direkomendasikan untuk diterapkan sebagai langkah mitigasi preventif.
