# OS Teacher: Blueprint Spesifikasi Fitur Jadwal Mengajar & Daily Stream (Teaching Schedule Engine)

> **Dokumen Arsitektur & Spesifikasi Desain BMad**  
> **Versi:** 1.0  
> **Target:** Modul Jadwal Mengajar Mingguan & Daily Stream Beranda  
> **Tim Penyusun BMad:** Mary (Analyst), Sally (UX Designer), Winston (Architect), Amelia (Senior Dev)  
> **Status:** Siap Dieksekusi (*Ready for Phased Delivery*)  

---

## 1. Ringkasan Eksekutif & Nilai Produk

### A. Latar Belakang Masalah
Saat ini, sistem **OS Teacher** telah memiliki *Konteks Mengajar (`TeachingContext`)* dan *Sesi Mengajar (`TeachingSession`)*. Namun, sistem belum memiliki data **Jadwal Pelajaran Rutin Mingguan (Hari & Jam Mengajar)**.  
Akibatnya:
1. Guru harus mengingat secara manual kapan jadwal mengajarnya setiap hari.
2. Beranda (`/`) dan Menu Hari Ini (`/hari-ini`) belum dapat menampilkan linimasa jam-demi-jam otomatis (*"Hari ini jam 07.30 Anda mengajar di 8A"*).
3. Tombol *"Mulai Sesi"* belum terhubung dengan jam mengajar aktual.

### B. Solusi & Visi Produk (*The Outcome*)
Membangun **Teaching Schedule Engine** yang memungkinkan guru:
1. Mengatur jadwal mingguan secara cepat (1-klik per slot) di awal semester.
2. Membuka Beranda setiap pagi dan langsung disajikan **Linimasa Mengajar Real-Time** yang cerdas, mengetahui sesi yang sedang aktif, sesi berikutnya, maupun hari bebas mengajar.

---

## 2. Analisis Domain Sekolah di Indonesia (Mary - Business Analyst)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ATURAN BISNIS JADWAL MENGAJAR (INDONESIAN CURRICULUM REALITIES)                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. POLA MULTI-SLOT: 1 Mapel di 1 Kelas dapat diajar 2-3 kali seminggu                  │
│    Contoh: Matematika 8A ──► Senin (07.30 - 09.00) & Kamis (10.15 - 11.45)             │
│                                                                                        │
│ 2. SISTEM HARI: Mendukung sekolah 5 hari (Senin-Jumat) dan 6 hari (Senin-Sabtu)        │
│    dayOfWeek: 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu, 7=Minggu           │
│                                                                                        │
│ 3. WAKTU FLEKSIBEL: Format 24 jam (HH:mm) dengan validasi startTime < endTime          │
│                                                                                        │
│ 4. EMPTY STATE PRODUKTIF: Jika hari ini tidak ada jadwal mengajar, dashboard           │
│    memberi rekomendasi kegiatan produktif (koreksi tugas, buat materi AI).             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Arsitektur Data & Skema Database (Winston - System Architect)

### A. Model Prisma Baru: `TeachingSchedule`
Model diletakkan di `prisma/schema.prisma` di bawah domain *Stage 03 (Daily Teaching)*:

```prisma
// -------------------------------------------------
// TEACHING SCHEDULE (TIMETABLE ENGINE)
// -------------------------------------------------

model TeachingSchedule {
  id                String          @id @default(cuid())
  teachingContextId String
  teachingContext   TeachingContext @relation(fields: [teachingContextId], references: [id], onDelete: Cascade)
  
  dayOfWeek         Int             // 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu, 7 = Minggu
  startTime         String          // Format: "HH:mm" (contoh: "07:30")
  endTime           String          // Format: "HH:mm" (contoh: "09:00")
  room              String?         // Opsional (contoh: "Ruang 8A", "Lab Komputer")
  
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([teachingContextId, dayOfWeek])
  @@map("teaching_schedule")
}
```

### B. Relasi pada Model `TeachingContext`:
```prisma
model TeachingContext {
  // ... field yang sudah ada ...
  teachingSchedules TeachingSchedule[]
}
```

### C. Skema Validasi Zod (`src/modules/schedule/schedule.schema.ts`):
```typescript
import { z } from "zod";

export const CreateScheduleSlotSchema = z.object({
  teachingContextId: z.string().min(1, "Konteks mengajar wajib diisi"),
  dayOfWeek: z.number().int().min(1).max(7, "Hari tidak valid (1-7)"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format jam mulai harus HH:mm (contoh: 07:30)"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format jam selesai harus HH:mm (contoh: 09:00)"),
  room: z.string().max(50).optional().nullable(),
}).refine((data) => data.startTime < data.endTime, {
  message: "Jam selesai harus lebih akhir daripada jam mulai",
  path: ["endTime"],
});
```

---

## 4. Server Actions & API Contract (Amelia - Senior Developer)

File: `src/modules/schedule/schedule.actions.ts`

| Server Action | Input Parameters | Output / Return | Keterangan |
| :--- | :--- | :--- | :--- |
| `getTeachingSchedulesAction` | `teachingContextId: string` | `TeachingSchedule[]` | Mengambil seluruh slot jadwal untuk satu kelas |
| `createScheduleSlotAction` | `CreateScheduleSlotInput` | `TeachingSchedule` | Menambah 1 slot hari & jam mengajar |
| `deleteScheduleSlotAction` | `scheduleId: string` | `{ success: boolean }` | Menghapus 1 slot jadwal |
| `getTodayScheduleStreamAction`| `(Implicit Session)` | `TodayScheduleItem[]` | Mengambil seluruh jadwal mengajar guru hari ini diurutkan berdasarkan waktu |

---

## 5. Spesifikasi Desain Antarmuka & Ergonomi UX (Sally - UX Designer)

### A. Permukaan 1: Dialog Pengaturan Jadwal Kelas (`ScheduleConfigDialog.tsx`)
Dapat diakses melalui menu **Pengaturan (`/pengaturan/setup`)** atau tombol **Atur Jadwal** di kartu kelas:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🕒 Atur Jadwal Mengajar: Matematika — Kelas 8A                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Slot Jadwal Saat Ini:                                                       │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ • Senin  | 07.30 - 09.00 • Ruang 8A                       [ 🗑️ Hapus ] │ │
│ │ • Kamis  | 10.15 - 11.45 • Ruang 8A                       [ 🗑️ Hapus ] │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ➕ Tambah Hari & Jam Mengajar:                                               │
│ Hari:              Jam Mulai:      Jam Selesai:    Ruangan (Opsional):      │
│ [ Senin       ▼ ]  [ 07:30 ]  s/d  [ 09:00 ]       [ Ruang 8A            ]  │
│                                                                             │
│ [ Batal ]                                           [ 💾 Simpan Slot Jadwal]│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### B. Permukaan 2: Daily Stream di Beranda (`src/app/(dashboard)/page.tsx`)
Beranda secara otomatis mengenali waktu hari ini (`new Date().getDay()`) dan menampilkan kartu linimasa interaktif:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 📅 JADWAL & SESI HARI INI (Senin, 16 September 2025)                                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│ 🟢 07.30 - 09.00 • JAM KE 1-2 (SEDANG WAKTUNYA MENGAJAR)                               │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 📖 Matematika — Kelas 8A (Ruang 8A)                                                │ │
│ │ Target Materi: Teorema Pythagoras • 32 Siswa                                       │ │
│ │ [ ▶️ Mulai Sesi & Presensi Sekarang ]                 [ 📋 Rencana Materi ]        │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│ ⚪ 10.15 - 11.45 • JAM KE 4-5 (SESI BERIKUTNYA)                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 📖 IPA — Kelas 7B (Lab IPA)                                                        │ │
│ │ Target Materi: Klasifikasi Makhluk Hidup • 30 Siswa                                │ │
│ │ Status: ⏳ Dimulai pukul 10.15                         [ 📝 Siapkan LKPD / Kuis ]   │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│ 🌴 JIKA HARI INI TIDAK ADA JADWAL:                                                    │
│ "Hari ini Anda tidak memiliki jam mengajar tatap muka.                                 │
│  [ ✨ Buka AI Studio ]  atau  [ 📊 Periksa Rekap Nilai Siswa ]"                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### C. Matriks Status Berbasis Waktu Nyata (*Time-Aware State Machine*)

```text
┌─────────────────────────┐
│ Waktu Saat Ini (Now)    │
└────────────┬────────────┘
             │
             ├──► Sebelum Jam Mulai  ──► Status: "⏳ Akan Datang" (Tombol Pratinjau Materi)
             │
             ├──► Di Dalam Jam Mulai ──► Status: "🟢 Waktunya Mengajar" (Tombol Mulai Sesi)
             │
             ├──► Sesi Aktif Dibuat  ──► Status: "⚡ Sedang Berlangsung" (Tombol Lanjutkan)
             │
             ├──► Sesi Diselesaikan  ──► Status: "✅ Selesai (30/32 Hadir)" (Tombol Jurnal)
             │
             └──► Jam Lewat (No Sesi)──► Status: "⚠️ Terlewat" (Tombol Buat Sesi Susulan)
```

---

## 6. Rencana Eksekusi Bertahap (Phased Delivery Roadmap)

Sesuai metodologi BMad (*Tahap - Report, Tahap - Report*), implementasi dibagi ke dalam 3 langkah terukur:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PETA 3 LANGKAH EKSEKUSI JADWAL MENGAJAR                                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TAHAP 1: Database Model, Prisma Migration & Server Actions                             │
│ • Tambahkan model `TeachingSchedule` di schema.prisma & jalankan migrasi.              │
│ • Buat Server Actions CRUD di `src/modules/schedule/schedule.actions.ts`.              │
│ • Verifikasi 100% dengan Vitest Unit Tests.                                            │
│                                                                                        │
│ TAHAP 2: Antarmuka Konfigurasi Jadwal (Schedule Manager UI)                            │
│ • Buat komponen `ScheduleConfigDialog.tsx`.                                            │
│ • Integrasikan tombol [ 🕒 Atur Jadwal ] di menu `/pengaturan/setup` & Detail Kelas.   │
│                                                                                        │
│ TAHAP 3: Integrasi Daily Stream di Beranda & Menu Hari Ini                             │
│ • Pasang `TodayScheduleStream` di Beranda (`/`) dan Menu Hari Ini (`/hari-ini`).      │
│ • Uji coba status waktu nyata (Live / Selesai / Akan Datang).                          │
│ • Verifikasi akhir: Build Next.js 16 Clean & Vitest 100% Pass.                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Kriteria Keberhasilan (*Quality Gates*)

- [ ] Skema database terisolasi tanpa merusak data `TeachingContext` yang ada.
- [ ] Guru dapat menambah dan menghapus slot hari/jam mengajar dalam < 5 detik.
- [ ] Beranda otomatis menyajikan jadwal hari ini sesuai hari kalender (`new Date().getDay()`).
- [ ] Tombol *"Mulai Sesi"* di jadwal langsung membuat sesi dan membuka ruang presensi live.
- [ ] Seluruh pengujian Vitest & Next.js 16 Production Build lulus 100%.

---
*Master Blueprint ini siap dijadikan acuan resmi untuk eksekusi Tahap 1.*
