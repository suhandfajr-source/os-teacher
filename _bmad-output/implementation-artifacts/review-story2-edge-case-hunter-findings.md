# Hasil Review: Edge Case Hunter — Story 2 (Klassa Agent Deterministic Tools & Scope Rombel B2)

**Sumber Prompt:** `_bmad-output/implementation-artifacts/review-story2-edge-case-hunter-prompt.md`  
**Spesifikasi:** `_bmad-output/implementation-artifacts/spec-klassa-agent-tools.md`  
**Patch Target:** `_bmad-output/implementation-artifacts/diff-klassa-agent-tools.patch`  
**Fitur:** Klassa Agent Deterministic Tools & Scope Rombel B2  

---

## 1. Unhandled Edge Cases & Boundary Risks

1. **Broken Module Import (`agent-query.tools.ts:5`)**:
   - `verifyTeacherClassAccess` diimpor dari `@/lib/authorization`, tetapi fungsi tersebut tidak ada di modul tersebut (yang ada adalah `verifyClassRosterAccess`).
   - Menyebabkan kompilasi TypeScript gagal (`TS2305`) dan runtime crash saat modul di-load.

2. **Model Prisma Fiktif (`agent-query.tools.ts:197, 239`)**:
   - Menggunakan `prisma.assessmentRecord` yang tidak ada dalam skema Prisma (model sebenarnya adalah `AssessmentResult`).
   - Menyebabkan crash runtime 500 saat LLM memanggil `getStudentAcademicSummaryTool` atau `analyzeClassPerformanceTool`.

3. **Field Siswa Non-Eksisten (`agent-query.tools.ts:102-105`)**:
   - Memetakan `nisn`, `gender` dari `Student` dan `status` dari `ClassStudent` yang tidak ada di `schema.prisma`.

4. **Kebocoran Scope Presensi Antar Rombel (`agent-query.tools.ts:135-155`)**:
   - Query `attendanceRecord` hanya memfilter `student.classMemberships.some.classId` tanpa membatasi `teachingSession.teachingContext.classId`. Presensi dari mata pelajaran atau rombel lain ikut terhitung.

---

## 2. Discrepancy terhadap Spesifikasi

- **Klaim Otorisasi Scope Rombel B2**: Spec menyebutkan penggunaan `verifyTeacherClassAccess`, padahal fungsi tersebut belum dibuat atau seharusnya memanggil `verifyClassRosterAccess`.
- **Klaim Rekap Nilai Akademik**: Spec mengasumsikan ketersediaan model `assessmentRecord`, sedangkan skema riil menggunakan `assessmentResult` yang berelasi ke `assessment`.

---

## 3. Investigasi 4 Skenario Kondisi Batas

1. **Rombel Baru / Kosong (`ClassStudent = 0`)**:
   - Helper matematika aman: `scores.length === 0` mengembalikan status `BELUM_ADA_NILAI` tanpa `-Infinity`.
   - Namun query murid gagal karena akses field skema yang tidak cocok.
2. **Siswa Baru Tanpa Rekam Medis Presensi (`totalPertemuan = 0`)**:
   - Terverifikasi aman dari *divide-by-zero* / `NaN`.
   - Guard `attStats.totalPertemuan > 0` mencegah siswa baru salah dikategorikan sebagai butuh perhatian.
3. **Penilaian Asesmen Ekstrem (0, 100, 77.33, Custom KKM)**:
   - Pembulatan desimal `Math.round((sum / totalItem) * 10) / 10` tepat 1 desimal (`77.33 -> 77.3`).
   - Namun eksekusi query nilai crash karena salah nama model Prisma.
4. **Penanganan Error Database**:
   - Test suite sebelumnya lulus semu karena melakukan mock pada fungsi yang tidak ada di kode produksi.

---

## 4. Rekomendasi Hardening

1. Ganti import ke `verifyClassRosterAccess` dari `@/lib/authorization`.
2. Ubah query asesmen ke model `prisma.assessmentResult`.
3. Batasi query presensi agar terisolasi per `teachingSession.teachingContext.classId`.
4. Sesuaikan pemetaan field `Student` dengan `schema.prisma`.

---

## 5. Verdict Akhir

**`NEEDS_HARDENING`**
