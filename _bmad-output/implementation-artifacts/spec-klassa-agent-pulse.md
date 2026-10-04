---
status: done
date: 2026-10-04
title: Klassa Pulse Aggregation Engine & Superadmin Analytics Dashboard
route: full
baseline_commit: '716ed5871c245f5f64973d4e4c87767a5a0451b5'
review_loop_iteration: 1
---

# Spec: Story 6 — Klassa Pulse Aggregation Engine & Superadmin Analytics Dashboard

## 1. Overview & Business Context
Sebagai penutup rangkaian **Stage 12: Klassa Agent**, **Story 6: Klassa Pulse** menghadirkan mesin intelijen agregat makro (*Teacher Behavior & Classroom Insights Engine*) yang dirancang untuk Superadmin dan pimpinan platform KLASSA.

Klassa Pulse menyintesis pola percakapan guru, kendala belajar siswa, hambatan kurikulum, jam kerja operasional guru (lembur di luar sekolah), dan indikator stres/burnout tanpa mengorbankan privasi individu guru maupun siswa (100% mematuhi UU Pelindungan Data Pribadi / UU PDP).

---

## 2. Pagar Privasi & Kepatuhan UU PDP (Zero-PII Anonymization)
1. **Tidak Ada Akses Percakapan Mentah (Zero Raw Chat Access):**
   - Superadmin sama sekali **tidak memiliki akses membaca log obrolan guru perorangan**.
2. **Pembersihan Identitas Mutlak (Absolute Scrubbing):**
   - Nama guru, nama siswa, NISN, ID rombel spesifik, dan teks bebas disingkirkan sebelum dicatat ke tabel analitik agregat (`agent_insight_aggregate`).
3. **Agregasi Berbasis Metrik & Periode:**
   - Data disimpan dalam unit periode waktu (mingguan `YYYY-[W]WW` atau bulanan `YYYY-MM`), kategori metrik, skor sentimen numerik, dan waktu aktif (jam 0–23).

---

## 3. Data Model & Skema Penyimpanan
Menggunakan model `AgentInsightAggregate` yang telah terdaftar pada `prisma/schema.prisma`:
```prisma
model AgentInsightAggregate {
  id           String   @id @default(cuid())
  schoolId     String?  // Opsional: Untuk filter analitik per sekolah atau lintas sekolah (null = global)
  period       String   // e.g. "2026-W40", "2026-10"
  category     String   // "CURRICULUM_BOTTLENECK" | "BURNOUT_RISK" | "STUDENT_STRUGGLE" | "OPERATIONAL_HOURS"
  metricKey    String   // e.g. "Pecahan Aljabar", "Tugas Menumpuk", "Jam Lembur 20-22", "Siswa Pasif"
  metricValue  Float    // Frekuensi, persentase stres, atau skor intensitas
  sampleCount  Int      @default(1)
  tags         String[] // e.g. ["MATEMATIKA", "SMP", "FASE_D"]
  metadata     Json?    // Statistik tambahan non-PII
  anonymizedAt DateTime @default(now())

  @@index([schoolId])
  @@index([category, period])
  @@map("agent_insight_aggregate")
}
```

---

## 4. Arsitektur Modul (`src/modules/agent/pulse/`)

### 4.1. Aggregation Engine (`pulse.service.ts`)
- **`recordAnonymizedInsight(input)`**:
  - Menyimpan atau meng-upsert metrik anonim ke `agent_insight_aggregate`.
  - Mengelompokkan berdasarkan kategori (`CURRICULUM_BOTTLENECK`, `BURNOUT_RISK`, `STUDENT_STRUGGLE`, `OPERATIONAL_HOURS`).
- **`getPulseSummaryMetrics(period?: string, schoolId?: string)`**:
  - Total sampel konsultasi anonim.
  - Indeks Burnout Guru (Rata-rata skor stres: Rendah, Waspada, Kritis).
  - Jam Sibuk Dominan (Peak Operational Hours).
  - Topik Paling Banyak Dikeluhkan.
- **`getTopClassroomStruggles(limit?: number, schoolId?: string)`**:
  - Daftar 5–10 isu kelas tertinggi di Indonesia (misal: "Literasi Rendah", "Siswa Pasif / Kurang Fokus", "Keterlambatan Presensi", "Manajemen Waktu Kuis").
- **`getCurriculumBottlenecks(limit?: number, schoolId?: string)`**:
  - Materi/mata pelajaran yang paling sering membuat guru buntu dalam perancangan materi ajar.
- **`getActivityHeatmapData(period?: string, schoolId?: string)`**:
  - Matriks 7 hari x 24 jam untuk memetakan beban lembur guru (apakah guru sering bekerja pada pukul 20:00–02:00 di rumah).
- **`seedPulseDemoData(schoolId?: string)`**:
  - Inisialisasi data sampel agregat realistis untuk memudahkan visualisasi langsung pada tahap evaluasi superadmin.

### 4.2. Superadmin Server Actions (`pulse.actions.ts`)
- Proteksi mutlak menggunakan `verifySuperadmin()`:
  - `getKlassaPulseAnalyticsAction(filter)`: Mengambil seluruh analitik Klassa Pulse teragregasi.
  - `seedKlassaPulseDataAction(schoolId?)`: Seeding sampel analitik anonim.

---

## 5. Antarmuka Visual Superadmin (`KlassaPulseTab.tsx`)
Diintegrasikan ke dalam `src/app/admin/AdminConsoleClient.tsx` sebagai tab baru:
- **Tab Baru:** `{ id: "klassa-pulse", label: "Klassa Pulse", icon: Activity, badge: "AI Insights" }`.
- **Panel Visualisasi:**
  1. **Statistik Kartu Utama (KPI Cards):**
     - Total Interaksi Teranonimkan.
     - Burnout Risk Index (Status visual: Hijau/Aman, Kuning/Perhatian, Merah/Tinggi).
     - Jam Puncak Lembur (e.g. "20:00 - 22:00 WIB").
     - Isu Pedagogi Utama.
  2. **Top Classroom Struggles (Horizontal Progress Bar):**
     - Distribusi isu kelas (Literasi, Disiplin, Motivasi, dsb.) dengan bar visual Tailwind.
  3. **Curriculum Bottlenecks Grid:**
     - Matriks mata pelajaran & materi tersulit beserta level jenjang (SD/SMP/SMA/SMK).
  4. **Activity Peak Heatmap (7 Hari × 24 Jam):**
     - Grid interaktif intensitas kerja guru (warna teal lembut hingga teal pekat) untuk mengidentifikasi pola jam lembur.
  5. **Privacy Banner (UU PDP Compliance Notice):**
     - Penjelasan eksplisit jaminan keamanan privasi & ketiadaan data personal perorangan.

---

## 6. Rencana Pengujian & Validasi
1. **Unit & Integration Test (`src/modules/agent/__tests__/agent-pulse.test.ts`):**
   - Verifikasi isolasi Superadmin: Non-superadmin ditolak (`HTTP 403 / Error`).
   - Verifikasi integritas anonimitas: Memastikan tidak ada kolom guru/siswa yang disimpan pada `agent_insight_aggregate`.
   - Perhitungan metrik agregat (Burnout Index, Heatmap 24 Jam, Top Struggles) akurat secara deterministik.
2. **Typecheck & Regresi Penuh:**
   - `npx tsc --noEmit`: 0 error.
   - Vitest suite: 100% lulus (termasuk 79 file tes yang ada).

---

## 7. Checkpoint 1
Spesifikasi Story 6 siap ditinjau.
Silakan konfirmasi langkah berikutnya:
- **"Approve and continue"**: Lanjut ke implementasi Story 6.
- **"Approve and stop"**: Setujui spec dan jeda pengerjaan.
- **"Review spec"**: Berikan saran perbaikan atau penyesuaian pada spesifikasi.
