# Unified Diff Summary: Klassa Agent Deterministic Tools & Scope Rombel B2 (Story 2)

## 1. Overview Perubahan
- **Fitur:** Klassa Agent Deterministic Tools & Scope Rombel B2
- **Baseline Commit:** `716ed5871c245f5f64973d4e4c87767a5a0451b5`
- **Patch File:** `_bmad-output/implementation-artifacts/diff-klassa-agent-tools.patch`

---

## 2. File yang Dibuat / Dimodifikasi
1. **`src/modules/agent/tools/agent-deterministic-math.ts`** (NEW):
   - Perhitungan persentase kehadiran murni integer `Math.round((hadir / total) * 100)`.
   - Klasifikasi kategori kehadiran objektif (`SANGAT_BAIK`, `BAIK`, `PERLU_PERHATIAN`, `BELUM_ADA_DATA`).
   - Rata-rata nilai 1 angka di belakang koma `Math.round((sum / totalItem) * 10) / 10`.
   - Evaluasi KKM dinamis dan penanganan nol data tanpa divide-by-zero (`0/0`).

2. **`src/modules/agent/tools/agent-tools.types.ts`** (NEW):
   - Zod schemas untuk 5 query tools:
     - `getTeacherClassesSchema`
     - `getClassStudentsSchema`
     - `getStudentAttendanceSummarySchema`
     - `getStudentAcademicSummarySchema`
     - `analyzeClassPerformanceSchema`

3. **`src/modules/agent/tools/agent-query.tools.ts`** (NEW):
   - Implementasi 5 tool Vercel AI SDK compatible (`tool({ description, inputSchema, execute })`):
     - `getTeacherClassesTool`: Mendapatkan rombel pengampu guru aktif.
     - `getClassStudentsTool`: Daftar murid dalam rombel berpagar otorisasi B2.
     - `getStudentAttendanceSummaryTool`: Presensi sesi terisolasi per rombel pengampu.
     - `getStudentAcademicSummaryTool`: Capaian nilai asesmen melalui `assessmentResult`.
     - `analyzeClassPerformanceTool`: Analisis menyeluruh performa kelas & deteksi siswa berisiko/remedial.
   - Guard Otorisasi Scope Rombel B2 via `verifyClassRosterAccess(classId)`.
   - Error handler ramah dan seragam: `"Akses ditolak: Anda bukan pengampu rombel ini."`.

4. **`src/lib/authorization.ts`** (MODIFIED):
   - Menambahkan alias `export const verifyTeacherClassAccess = verifyClassRosterAccess;` untuk menjaga konsistensi penamaan dan stabilitas antar modul.

5. **`src/modules/agent/__tests__/agent-tools.test.ts`** (NEW):
   - 6 skenario test unit untuk kalkulasi matematika deterministik dan penolakan akses rombel orang lain.

6. **`src/modules/agent/__tests__/agent-core.test.ts`** (MODIFIED):
   - Penyelarasan tipe statis LanguageModel router.

---

## 3. Resolusi Temuan Review (Blind Hunter & Edge-Case Hunter)
| Temuan Review | Tindakan Perbaikan | Status |
|---|---|---|
| **C-01:** `verifyTeacherClassAccess` missing export | Menggunakan `verifyClassRosterAccess` dan mengekspor alias di `@/lib/authorization.ts` | RESOLVED |
| **C-02:** Model Prisma salah (`assessmentRecord`) | Disesuaikan dengan skema riil: `prisma.assessmentResult` dan field `finalScore` / `normalizedScore` | RESOLVED |
| **M-01:** Over-fetching presensi antar-rombel | Difilter secara presisi via `teachingSession.teachingContext.classId` | RESOLVED |
| **AI SDK v7 compatibility** | Menggunakan `inputSchema` alih-alih `parameters` sesuai AI SDK v7 (`ai@7.0.127`) | RESOLVED |

---

## 4. Status Verifikasi
- TypeScript Typecheck (`npx tsc --noEmit`): **0 Error**
- Unit Tests Modul Agent (`npx vitest run src/modules/agent`): **14/14 PASSING**
- Full Suite Regression (`npm test`): **871/871 PASSING (76 test files, 0 regresi)**
