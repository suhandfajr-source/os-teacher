# Blind Adversarial Review Report: Story 2 (Tools Query & Deterministic Math)

**Target Source Code:** `_bmad-output/implementation-artifacts/review-story2-blind-hunter-prompt.md` / `src/modules/agent/tools/`  
**Reviewer Role:** Lead Security & Adversarial Reviewer (Senior Principal Security Architect)  
**Tanggal Review:** 2026-10-03  
**Status Evaluasi:** Selesai  

---

## Ringkasan Eksekutif
Review adversarial (blind inspection) dilakukan terhadap kode implementasi **Story 2: Tools Query & Deterministic Math** (`agent-deterministic-math.ts` dan `agent-query.tools.ts`).

Meskipun helper matematika deterministik terbukti aman dari *divide-by-zero*, inspeksi kode nyata mendeteksi **2 Celah Kritis (Blocker Runtime)** dan **1 Celah Logika Scope Data** yang wajib diperbaiki sebelum kode ini dapat beroperasi di lingkungan produksi.

---

## 1. Critical Runtime Errors & Schema Drift (High Severity)

### C-01: Fungsi Otorisasi `verifyTeacherClassAccess` Tidak Ada di `@/lib/authorization`
- **Lokasi:** `src/modules/agent/tools/agent-query.tools.ts` (baris 5, 84, 126, 180, 231)
- **Deskripsi:**  
  File `agent-query.tools.ts` mengimpor `verifyTeacherClassAccess` dari `@/lib/authorization`:
  ```ts
  import {
    verifyActiveSchoolMembership,
    verifyTeacherClassAccess,
  } from "@/lib/authorization";
  ```
  Di dalam `src/lib/authorization.ts`, fungsi validasi rombel yang tersedia adalah `verifyClassRosterAccess(classId: string)`. Fungsi bernama `verifyTeacherClassAccess` **TIDAK ADA**.
- **Dampak:**  
  Unit test (`agent-tools.test.ts`) lolos hanya karena fungsi tersebut di-mock secara manual (`vi.mock("@/lib/authorization")`). Namun, pada runtime Next.js sesungguhnya, setiap pemanggilan tool akan crash seketika dengan pesan:  
  `TypeError: (0, authorization_1.verifyTeacherClassAccess) is not a function`.
- **Rekomendasi:**  
  Ganti impor dan pemanggilan menjadi `verifyClassRosterAccess(classId)` atau ekspor alias `verifyTeacherClassAccess = verifyClassRosterAccess` di `src/lib/authorization.ts`.

---

### C-02: Model Prisma Tidak Sesuai Skema (`prisma.assessmentRecord` vs `prisma.assessmentResult`)
- **Lokasi:** `src/modules/agent/tools/agent-query.tools.ts` (baris 189, 239)
- **Deskripsi:**  
  Pada tool `getStudentAcademicSummaryTool` dan `analyzeClassPerformanceTool`, query database memanggil model yang tidak ada di Prisma Client:
  ```ts
  // Baris 189:
  const assessments = await prisma.assessmentRecord.findMany({ where: whereClause });

  // Baris 239:
  include: { attendanceRecords: true, assessmentRecords: true }
  ```
  Pada `prisma/schema.prisma`, model penilaian yang sah adalah `AssessmentResult` (`prisma.assessmentResult`), bukan `assessmentRecord`. Selain itu, kolom nilai pada `AssessmentResult` adalah `finalScore` / `normalizedScore`, bukan `score`.
- **Dampak:**  
  Query penilaian akademik akan melempar unhandled exception / fatal crash di runtime database (`Cannot read properties of undefined (reading 'findMany')`).
- **Rekomendasi:**  
  Sesuaikan nama relasi dan model Prisma ke `prisma.assessmentResult` dengan field `finalScore`.

---

## 2. Scope Rombel B2 & Data Isolation Invariants (Medium Severity)

### M-01: Kebocoran Data Presensi Lintas-Konteks/Lintas-Semester (*Over-fetching Scope*)
- **Lokasi:** `src/modules/agent/tools/agent-query.tools.ts` (`getStudentAttendanceSummaryTool`)
- **Deskripsi:**  
  Filter pencarian presensi siswa saat ini:
  ```ts
  const whereClause = {
    student: {
      classMemberships: {
        some: { classId },
      },
    },
    ...(studentId ? { studentId } : {}),
  };
  const records = await prisma.attendanceRecord.findMany({ where: whereClause });
  ```
  Kondisi ini hanya mengecek apakah siswa terdaftar di `classId`. Query mengambil **seluruh** baris presensi siswa tersebut tanpa memfilter sesi pengajaran (`teachingSession`) dari kelas yang bersangkutan.
- **Dampak:**  
  Jika seorang siswa pernah berada di rombel lain pada tahun ajaran sebelumnya, atau memiliki catatan presensi dari guru/mapel lain, data presensi dari sesi luar akan ikut terhitung ke dalam statistik kelas saat ini.
- **Rekomendasi:**  
  Perketat relasi presensi agar difilter melalui sesi kelas terkait:
  ```ts
  where: {
    ...whereClause,
    teachingSession: {
      teachingContext: {
        classId,
      },
    },
  }
  ```

---

## 3. Deterministic Robustness (Low Severity / Math Check)

### L-01: Penanganan Nol Data & Divide-by-Zero (PASS)
- Fungsi `calculateAttendanceStats`:
  - Jika `total === 0`, mengembalikan `persentaseKehadiran: 0` dan kategori `"BELUM_ADA_DATA"`. Terlindungi dari `0 / 0 = NaN`.
- Fungsi `calculateAcademicGradeStats`:
  - Jika `scores.length === 0`, mengembalikan `totalItem: 0`, `rataRata: 0`, dan status `"BELUM_ADA_NILAI"`. Terlindungi dari `NaN`.
- Pembulatan desimal:
  - Menggunakan `Math.round((sum / totalItem) * 10) / 10` (1 digit di belakang koma) dan `Math.round((hadir / total) * 100)` (angka bulat). Akurasi deterministik terjamin.

---

## 4. Verdict & Action Items

| Kategori | Temuan | Status |
|---|---|---|
| Critical Runtime / Schema Drift | 2 (Missing function export & wrong Prisma model name) | **FAIL (Blocker)** |
| Scope Rombel B2 Isolation | 1 (Cross-session attendance over-fetching) | **NEEDS_FIX** |
| Deterministic Math & Divide-by-Zero | 0 (Penanganan nol data aman) | **PASS** |

### **Verdict: CHANGES_REQUESTED**
Implementasi matematika deterministik sudah tepat, namun kode tools query saat ini **akan langsung crash di runtime** akibat inkonsistensi nama fungsi otorisasi (`verifyTeacherClassAccess`) dan model database (`assessmentRecord`). 

Perlu dilakukan perbaikan cepat (*hotfix*) pada `agent-query.tools.ts` sebelum Story 2 dapat disahkan (*Approved*).
