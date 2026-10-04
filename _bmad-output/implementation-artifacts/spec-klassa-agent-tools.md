---
status: done
date: 2026-10-03
title: Klassa Agent Deterministic Tools & Scope Rombel B2
route: full
baseline_commit: '716ed5871c245f5f64973d4e4c87767a5a0451b5'
review_loop_iteration: 1
---

# Spec: Klassa Agent Deterministic Tools & Scope Rombel B2

<frozen-after-approval>
## Goal
Menyediakan rangkaian *tool definitions* (Vercel AI SDK compatible) yang deterministik untuk Klassa Agent. Tools ini memungkinkan agen menginspeksi data kelas, profil siswa, rekap presensi, asesmen, dan analisis performa akademik secara aman dengan penegakan otorisasi ketat Scope Rombel B2 (`isPengampuRombel` / `verifyTeacherClassAccess`). Seluruh perhitungan angka (persentase kehadiran, rata-rata nilai, batas KKM, deteksi siswa berisiko) dihitung 100% secara deterministik di server Next.js (TypeScript), bukan oleh LLM.

## Scope & Constraints
- **Scope**:
  - Tools Registry di `src/modules/agent/tools/`:
    1. `getTeacherClassesTool`: Mengambil daftar rombel dan mata pelajaran yang diampu guru yang sedang aktif.
    2. `getClassStudentsTool`: Mengambil daftar murid di suatu rombel (wajib pengampu rombel).
    3. `getStudentAttendanceSummaryTool`: Mengambil rekap presensi kelas/siswa dengan persentase kehadiran deterministik.
    4. `getStudentAcademicSummaryTool`: Mengambil rekap capaian nilai asesmen & kuis siswa dengan statistik rata-rata deterministik.
    5. `analyzeClassPerformanceTool`: Menghasilkan analisis deterministik: rata-rata kelas, tingkat ketuntasan KKM, dan daftar siswa yang memerlukan perhatian khusus/remedial.
  - Guard Keamanan Scope Rombel B2:
    - Jika guru meminta data dari rombel yang BUKAN kelas yang diampunya, tool mengembalikan error otorisasi eksplisit yang aman: `"Akses ditolak: Anda bukan pengampu rombel ini."`.
  - Deterministic Computation Standards:
    - Persentase kehadiran = `Math.round((hadir / totalPertemuan) * 100)`.
    - Rata-rata nilai = `Math.round((sumNilai / totalNilai) * 10) / 10`.
    - LLM dilarang melakukan aproksimasi atau kalkulasi sendiri; semua angka disuplai oleh tool.
- **Out of Scope (Deferred to Story 3 & 4)**:
  - Tools Mutasi permanen (catat presensi, buat tugas, post pengumuman) -> Story 3.
  - UI Streaming chat widget & visual rendering bubble -> Story 4.
- **Security & Architectural Invariants**:
  - Multi-tenant school & Teacher-scoped: Hanya data sekolah aktif guru yang dapat di-query.
  - Anti-enumeration & PII protection: Data siswa di luar kelas yang diampu guru tidak pernah dibocorkan.
</frozen-after-approval>

## Code Map
- `src/modules/agent/tools/`:
  - `agent-tools.types.ts`: Skema parameter Zod & tipe kembalian data deterministik.
  - `agent-query.tools.ts`: Implementasi tools Vercel AI SDK (`tool({ description, parameters, execute })`).
  - `agent-deterministic-math.ts`: Helper murni TypeScript untuk menghitung statistik (kehadiran %, rerata nilai, status KKM).
- `src/modules/agent/__tests__/`:
  - `agent-tools.test.ts`: Pengujian unit otorisasi Scope Rombel B2, kalkulasi matematika deterministik, dan penolakan akses kelas lain.

## Tasks & Acceptance
- [x] **Task 1: Deterministic Math Helper Module**
  - Given data kehadiran dan nilai siswa
  - When fungsi deterministik dipanggil
  - Then persentase kehadiran dan rata-rata nilai terhitung dengan presisi matematika tanpa pembulatan liar.
- [x] **Task 2: Query Tools Implementations with Zod Parameters**
  - Given pemanggilan tools Vercel AI SDK (`getTeacherClassesTool`, `getClassStudentsTool`, `getStudentAttendanceSummaryTool`, `getStudentAcademicSummaryTool`, `analyzeClassPerformanceTool`)
  - When parameter Zod divalidasi
  - Then tool mengeksekusi Prisma query yang teroptimasi.
- [x] **Task 3: Scope Rombel B2 Security Enforcement**
  - Given seorang guru yang mengampu Kelas 7A
  - When guru mencoba memanggil tool untuk Kelas 7B yang tidak diampunya
  - Then tool menolak eksekusi dan mengembalikan pesan `"Akses ditolak: Anda bukan pengampu rombel ini."`.
- [x] **Task 4: Automated Testing & Regresi**
  - Given test suite `src/modules/agent/__tests__/agent-tools.test.ts`
  - When dijalankan via Vitest
  - Then seluruh skenario pengujian tools dan matematika deterministik lulus 100%, dan seluruh test suite `npm test` tetap hijau tanpa regresi.

## I/O & Edge-Case Matrix
| Skenario | Input | Output / Perilaku yang Diharapkan |
|---|---|---|
| Query Kelas Pengampu | Guru login dengan 2 rombel aktif | Mengembalikan daftar 2 rombel beserta nama dan jenjang kelas |
| Query Murid Rombel Sendiri | `classId` milik rombel sendiri | Mengembalikan daftar siswa lengkap dengan NIS & nama |
| Query Rombel Guru Lain (B2 Violation) | `classId` milik rombel orang lain | Mengembalikan `{ error: "Akses ditolak: Anda bukan pengampu rombel ini." }` |
| Kalkulasi Presensi Tanpa Rekam Medis/Absen | Total pertemuan 0 | Mengembalikan total 0 pertemuan, persentase 0%, status "BELUM_ADA_DATA" |
| Kalkulasi Nilai di Bawah KKM (75) | Siswa dengan nilai [60, 70, 65] | Status "PERLU_REMEDIAL", rata-rata 65.0, selisih KKM -10 |

## Review Triage Log
| Finding / Issue | Layer | Severity | Resolution / Evidence |
|---|---|---|---|
| C-01: `verifyTeacherClassAccess` missing export | Runtime & Auth | HIGH | Menggunakan `verifyClassRosterAccess` dan mengekspor alias di `@/lib/authorization.ts` |
| C-02: Prisma model drift (`assessmentRecord`) | Schema Drift | HIGH | Disesuaikan dengan skema riil: `prisma.assessmentResult` (`finalScore`/`normalizedScore`) |
| M-01: Presensi over-fetching antar rombel/sesi | Scope B2 | MEDIUM | Difilter presisi via `teachingSession.teachingContext.classId` |
| AI SDK v7 tool signature | Type Safety | MEDIUM | Menggunakan `inputSchema` sesuai AI SDK v7, lulus `tsc --noEmit` (0 error) |
| L-01: Divide by zero & rounding check | Math Integrity | LOW | Terverifikasi aman: 0 data mengembalikan status aman, rata-rata 1 desimal |

## Completion Summary
Story 2 telah melalui 1 siklus review penuh (Blind Hunter + Edge-Case Hunter). Seluruh temuan blocker dan scope boundary telah diperbaiki (*hotfixed*), tervalidasi dengan `npx tsc --noEmit` (0 error), 14/14 unit tests passing, dan full suite regression 871/871 tests passing tanpa regresi. Status diubah menjadi `done`.
