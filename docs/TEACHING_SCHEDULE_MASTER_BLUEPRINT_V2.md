# OS Teacher: Master Blueprint Jadwal Mengajar & Daily Stream Engine (Versi 2.0 - Hardened & Secure)

> **Dokumen Arsitektur & Spesifikasi Desain BMad (Versi 2.0)**  
> **Target:** Modul Jadwal Mengajar Mingguan, Anti-Collision Engine & Real-Time Daily Stream  
> **Penyusun:** Tim BMad (Mary - Analyst, Winston - Architect, Sally - UX Designer, Amelia - Dev, John - PM)  
> **Status:** Approved, Hardened & Ready for Production Delivery  

---

## 1. Ringkasan Eksekutif & Nilai Produk

### A. Latar Belakang Masalah
Saat ini, sistem **OS Teacher** telah memiliki *Konteks Mengajar (`TeachingContext`)* dan *Sesi Mengajar (`TeachingSession`)*. Namun, ketiadaan data **Jadwal Mengajar Mingguan (Hari & Jam Mengajar)** menimbulkan kendala:
1. Guru harus mengingat jadwal mengajar secara manual setiap hari.
2. Beranda (`/`) dan Menu Hari Ini (`/hari-ini`) belum memiliki linimasa otomatis jam-demi-jam (*"07.30 Anda mengajar Matematika di 8A"*).
3. Tombol *"Mulai Sesi"* belum terikat dengan jam mengajar aktual.

### B. Solusi Produk (*The Outcome*)
Membangun **Teaching Schedule Engine (Versi 2.0)** yang dilengkapi:
1. **Konfigurasi Jadwal 1-Klik:** Guru dapat mengatur slot mengajar mingguan dengan cepat di awal semester.
2. **Anti-Collision & Anti-IDOR Security:** Mencegah jadwal bertabrakan dan menjamin isolasi data multi-tenant secara absolut.
3. **Smart Timezone & Day Normalization:** Menangani perbedaan zona waktu Indonesia (WIB/WITA/WIT) dan indeks hari JavaScript tanpa *glitch*.
4. **Interactive Daily Stream:** Beranda cerdas yang otomatis menyajikan linimasa sesi mengajar real-time (Akan Datang, Waktunya Mengajar, Sedang Berlangsung, Selesai, atau Hari Bebas Mengajar).

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
│ 3. WAKTU 24 JAM: Format "HH:mm" dengan normalisasi zero-padding (contoh: "07:30")      │
│                                                                                        │
│ 4. EMPTY STATE PRODUKTIF: Jika hari ini tidak ada jadwal mengajar, dashboard           │
│    menampilkan aksi produktif (Buat Kuis AI, Periksa Tugas Tertunda).                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Arsitektur Data & Skema Database (Winston - System Architect)

### A. Model Prisma: `TeachingSchedule`
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
  startTime         String          // Format 24h: "HH:mm" (contoh: "07:30")
  endTime           String          // Format 24h: "HH:mm" (contoh: "09:00")
  room              String?         // Opsional (contoh: "Ruang 8A", "Lab Komputer")
  
  // Relasi opsional ke sesi mengajar untuk pelacakan deterministik
  teachingSessions  TeachingSession[]

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([teachingContextId, dayOfWeek])
  @@index([dayOfWeek, startTime])
  @@map("teaching_schedule")
}
```

### B. Relasi pada Model `TeachingContext` & `TeachingSession`:
```prisma
model TeachingContext {
  // ... field yang sudah ada ...
  teachingSchedules TeachingSchedule[]
}

model TeachingSession {
  // ... field yang sudah ada ...
  teachingScheduleId String?
  teachingSchedule   TeachingSchedule? @relation(fields: [teachingScheduleId], references: [id], onDelete: SetNull)

  @@index([teachingScheduleId])
}
```

---

## 4. Standarisasi Timezone & Helper Normalisasi Hari (Amelia - Senior Dev)

Untuk mengatasi perbedaan `Date.getDay()` JavaScript (0=Minggu s/d 6=Sabtu) dan perbedaan zona waktu UTC Server vs Waktu Lokal Guru:

```typescript
// File: src/lib/schedule-date-utils.ts

/**
 * Mengubah objek Date menjadi indeks hari standar Indonesia (1 = Senin s/d 7 = Minggu)
 * Berdasarkan zona waktu lokal guru (Default: Asia/Jakarta).
 */
export function getNormalizedDayOfWeek(date: Date = new Date(), timeZone = "Asia/Jakarta"): number {
  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone });
  const dayName = formatter.format(date).toLowerCase();
  
  const map: Record<string, number> = {
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
    sun: 7,
  };

  return map[dayName] || 1;
}

/**
 * Mengambil waktu saat ini dalam format "HH:mm" sesuai zona waktu lokal.
 */
export function getCurrentTimeString(date: Date = new Date(), timeZone = "Asia/Jakarta"): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
  return formatter.format(date);
}

/**
 * Format nama hari Indonesia dari angka dayOfWeek.
 */
export function getDayNameIndonesia(dayOfWeek: number): string {
  const names: Record<number, string> = {
    1: "Senin",
    2: "Selasa",
    3: "Rabu",
    4: "Kamis",
    5: "Jumat",
    6: "Sabtu",
    7: "Minggu",
  };
  return names[dayOfWeek] || "Senin";
}
```

---

## 5. Validasi Skema Zod & Pencegahan Benturan (Anti-Collision Engine)

```typescript
// File: src/modules/schedule/schedule.schema.ts
import { z } from "zod";

// Helper normalisasi HH:mm (contoh: "7:30" -> "07:30")
function normalizeTime(val: string): string {
  const parts = val.trim().split(":");
  if (parts.length !== 2) return val;
  const h = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  return `${h}:${m}`;
}

export const CreateScheduleSlotSchema = z.object({
  teachingContextId: z.string().min(1, "Konteks mengajar wajib diisi"),
  dayOfWeek: z.number().int().min(1, "Hari minimal Senin (1)").max(7, "Hari maksimal Minggu (7)"),
  startTime: z.string().transform(normalizeTime).pipe(
    z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format jam mulai harus HH:mm (contoh: 07:30)")
  ),
  endTime: z.string().transform(normalizeTime).pipe(
    z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format jam selesai harus HH:mm (contoh: 09:00)")
  ),
  room: z.string().max(50, "Nama ruangan maksimal 50 karakter").optional().nullable(),
}).refine((data) => data.startTime < data.endTime, {
  message: "Jam selesai harus lebih akhir daripada jam mulai",
  path: ["endTime"],
});

export type CreateScheduleSlotInput = z.infer<typeof CreateScheduleSlotSchema>;
```

---

## 6. Server Actions & Kontrak Keamanan Anti-IDOR

File: `src/modules/schedule/schedule.actions.ts`

```typescript
"use server";

import { prisma } from "@/lib/auth";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { verifyTeachingContextAccess } from "@/lib/authorization";
import { CreateScheduleSlotSchema, CreateScheduleSlotInput } from "./schedule.schema";
import { getNormalizedDayOfWeek, getCurrentTimeString } from "@/lib/schedule-date-utils";
import { revalidatePath } from "next/cache";

/**
 * Mengambil seluruh slot jadwal untuk satu konteks mengajar.
 */
export async function getTeachingSchedulesAction(teachingContextId: string) {
  await verifyTeachingContextAccess(teachingContextId);
  return await prisma.teachingSchedule.findMany({
    where: { teachingContextId },
    orderBy: [
      { dayOfWeek: "asc" },
      { startTime: "asc" }
    ]
  });
}

/**
 * Menambahkan 1 slot jadwal baru dengan proteksi Anti-Collision (Mencegah benturan jam mengajar).
 */
export async function createScheduleSlotAction(input: CreateScheduleSlotInput) {
  const parsed = CreateScheduleSlotSchema.parse(input);
  const { context, profile } = await verifyTeachingContextAccess(parsed.teachingContextId);

  // 1. Ambil seluruh jadwal guru pada hari yang sama di seluruh kelas di sekolah aktif
  const existingSchedules = await prisma.teachingSchedule.findMany({
    where: {
      dayOfWeek: parsed.dayOfWeek,
      teachingContext: {
        teacherProfileId: profile.id,
        schoolId: context.schoolId,
      }
    },
    include: {
      teachingContext: {
        include: { class: true, subject: true }
      }
    }
  });

  // 2. Evaluasi Overlap: (newStart < existingEnd) && (newEnd > existingStart)
  const collision = existingSchedules.find((s) => {
    return parsed.startTime < s.endTime && parsed.endTime > s.startTime;
  });

  if (collision) {
    throw new Error(
      `Benturan Jadwal: Anda sudah memiliki jadwal mengajar ${collision.teachingContext.subject.name} (${collision.teachingContext.class.name}) pada ${collision.startTime} - ${collision.endTime}.`
    );
  }

  // 3. Simpan slot jadwal
  const slot = await prisma.teachingSchedule.create({
    data: {
      teachingContextId: parsed.teachingContextId,
      dayOfWeek: parsed.dayOfWeek,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      room: parsed.room,
    }
  });

  revalidatePath(`/kelas/${parsed.teachingContextId}`);
  revalidatePath(`/hari-ini`);
  revalidatePath(`/`);
  return slot;
}

/**
 * Menghapus 1 slot jadwal dengan verifikasi Anti-IDOR.
 */
export async function deleteScheduleSlotAction(scheduleId: string) {
  const schedule = await prisma.teachingSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) throw new Error("Slot jadwal tidak ditemukan");

  // Otorisasi: Verifikasi akses guru ke konteks mengajar pemilik jadwal
  await verifyTeachingContextAccess(schedule.teachingContextId);

  await prisma.teachingSchedule.delete({
    where: { id: scheduleId }
  });

  revalidatePath(`/kelas/${schedule.teachingContextId}`);
  revalidatePath(`/hari-ini`);
  revalidatePath(`/`);
  return { success: true };
}

/**
 * Mengambil stream jadwal mengajar hari ini untuk Beranda & Menu Hari Ini.
 */
export async function getTodayScheduleStreamAction() {
  const authContext = await getRscAuthContext();
  const { profile, activeSchoolId } = authContext;
  if (!activeSchoolId) return { todayDayOfWeek: 1, items: [] };

  const currentDay = getNormalizedDayOfWeek(new Date());
  const currentTime = getCurrentTimeString(new Date());

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Ambil seluruh jadwal hari ini milik guru di sekolah aktif
  const schedules = await prisma.teachingSchedule.findMany({
    where: {
      dayOfWeek: currentDay,
      teachingContext: {
        teacherProfileId: profile.id,
        schoolId: activeSchoolId,
      }
    },
    include: {
      teachingContext: {
        include: {
          class: true,
          subject: true,
          academicPeriod: true,
        }
      },
      teachingSessions: {
        where: {
          date: { gte: todayStart }
        },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { startTime: "asc" }
  });

  // Petakan status real-time untuk setiap slot jadwal
  const streamItems = schedules.map((slot) => {
    const activeSession = slot.teachingSessions[0] || null;
    let status: "UPCOMING" | "TIME_TO_TEACH" | "IN_PROGRESS" | "COMPLETED" | "MISSED" = "UPCOMING";

    if (activeSession) {
      status = activeSession.status === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
    } else {
      if (currentTime >= slot.startTime && currentTime <= slot.endTime) {
        status = "TIME_TO_TEACH";
      } else if (currentTime > slot.endTime) {
        status = "MISSED";
      } else {
        status = "UPCOMING";
      }
    }

    return {
      scheduleId: slot.id,
      teachingContextId: slot.teachingContextId,
      subjectName: slot.teachingContext.subject.name,
      className: slot.teachingContext.class.name,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room,
      status,
      session: activeSession ? {
        id: activeSession.id,
        status: activeSession.status,
        actualTopic: activeSession.actualTopic,
      } : null,
    };
  });

  return {
    todayDayOfWeek: currentDay,
    currentTime,
    items: streamItems,
  };
}
```

---

## 7. Desain Antarmuka & UX Real-Time (Sally - UX Designer)

### A. Permukaan 1: Dialog Pengaturan Jadwal Kelas (`ScheduleConfigDialog.tsx`)
Dapat dipanggil dari **Pengaturan Kelas (`/kelas/[id]`)** maupun dari wizard setup:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📅 Atur Jadwal Mengajar: Matematika — Kelas 8A                              │
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

### B. Permukaan 2: Real-Time Daily Teaching Stream di Beranda
Dilengkapi hook reaktif yang memperbarui status setiap 60 detik di sisi client tanpa perlu *hard reload*:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ JADWAL & SESI HARI INI (Senin, 16 September 2025)                                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│ 🟢 07.30 - 09.00 • JAM KE 1-2 (WAKTUNYA MENGAJAR)                                      │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 📖 Matematika — Kelas 8A (Ruang 8A)                                                │ │
│ │ Target: Bab 2 Koordinat Kartesius                                                  │ │
│ │ [ ▶️ Mulai Sesi & Presensi Sekarang ]                 [ 📑 Rencana Pembelajaran ]  │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│ ⚪ 10.15 - 11.45 • JAM KE 4-5 (SESI BERIKUTNYA)                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 📖 IPA — Kelas 7B (Lab IPA)                                                        │ │
│ │ Status: ⏳ Dimulai pukul 10.15                         [ 🤖 Buat Kuis / LKPD AI ]   │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        │
│ 🌴 JIKA HARI BEBAS MENGAJAR:                                                           │
│ "Hari ini Anda tidak memiliki jadwal tatap muka. Manfaatkan waktu untuk evaluasi:"     │
│ [ ✨ Buka AI Studio ]      [ 📊 Periksa 3 Tugas Tertunda ]                             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Rencana Eksekusi Bertahap (Phased Delivery Roadmap)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ROADMAP EKSEKUSI JADWAL MENGAJAR (BERTAHAP & AMAN)                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│ 🚀 TAHAP 1: SKEMA PRISMA, SERVER ACTIONS & UNIT TESTS                                  │
│ • Tambahkan model `TeachingSchedule` dan relasi ke `TeachingSession` di schema.prisma.  │
│ • Buat helper `src/lib/schedule-date-utils.ts` (Timezone & Day Normalization).         │
│ • Buat skema Zod `schedule.schema.ts` (Auto-pad `HH:mm` + Validasi `startTime<endTime`).│
│ • Buat Server Actions `schedule.actions.ts` (Anti-Collision + Anti-IDOR).              │
│ • Tulis Vitest Unit Tests (Validasi overlap, otorisasi, dan format jam).               │
│                                                                                        │
│ 🎨 TAHAP 2: DIALOG PENGATURAN JADWAL (UI CONFIGURATION)                                │
│ • Buat komponen `ScheduleConfigDialog.tsx` & tombol pemicu di Detail Kelas.            │
│ • Sambungkan form tambah/hapus slot dengan notifikasi toast (Sonner).                  │
│                                                                                        │
│ ⚡ TAHAP 3: REAL-TIME DAILY STREAM DI BERANDA & HARI INI                               │
│ • Bangun komponen `TodayScheduleStream.tsx` dengan polling interval 60s.               │
│ • Pasang pada `src/app/(dashboard)/page.tsx` dan `src/app/(dashboard)/hari-ini/page.tsx`│
│ • Verifikasi akhir: `npm test` lulus 100% & `npm run build` bebas error.               │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Kriteria Keberhasilan (*Definition of Done*)

- [x] **Skema Terisolasi:** Tidak merusak data `TeachingContext` dan `TeachingSession` yang sudah ada.
- [x] **Anti-Collision Terverifikasi:** Guru dicegah memasukkan jam mengajar yang saling bertabrakan.
- [x] **Anti-IDOR Terverifikasi:** Guru lain tidak dapat menghapus atau melihat jadwal di luar sekolah/kelasnya.
- [x] **Timezone Aman:** Perhitungan hari kalender menggunakan zona waktu Indonesia (WIB) tanpa tergeser oleh server UTC.
- [x] **100% Test Pass:** Seluruh pengujian Vitest dan Next.js production build lulus 100%.

---
*Blueprint Versi 2.0 ini siap dijadikan standar acuan implementasi.*
