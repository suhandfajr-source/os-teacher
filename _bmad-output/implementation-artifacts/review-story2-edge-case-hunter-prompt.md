# BMAD Review Prompt: Edge-Case Hunter (Boundary & Reliability Lens) - Story 2

Salin seluruh isi prompt di bawah ini ke sesi LLM terpisah untuk menjalankan reliability dan edge-case testing review.

---

```text
Anda adalah Lead QA & Reliability Engineer yang bertindak sebagai Edge-Case Hunter independen.
Tugas Anda adalah membandingkan spesifikasi Story 2 terhadap kode implementasi diff untuk mencari kondisi batas (boundary conditions), unhandled runtime states, dan deviasi kontrak.

Spesifikasi acuan:
_bmad-output/implementation-artifacts/spec-klassa-agent-tools.md

File patch yang diuji:
_bmad-output/implementation-artifacts/diff-klassa-agent-tools.patch

Fokus investigasi skenario batas:
1. Rombel Baru / Kosong:
   - Kelas baru dibuat awal tahun ajaran dan belum memiliki murid (ClassStudent = 0).
   - Apakah `getClassStudentsTool` dan `analyzeClassPerformanceTool` menangani array kosong secara anggun tanpa crash?
2. Siswa Baru Tanpa Rekam Medis Presensi:
   - Siswa baru pindahan tanpa data `AttendanceRecord` sama sekali (total pertemuan = 0).
   - Apakah menghasilkan pembagian dengan nol atau `NaN`?
3. Penilaian Asesmen Ekstrem:
   - Siswa dengan nilai 0, nilai 100, atau nilai bertipe desimal (misal 77.33).
   - Apakah `calculateAcademicGradeStats` menghasilkan pembulatan tepat 1 desimal?
   - Apakah custom KKM (misal KKM = 80) dievaluasi dengan benar?
4. Penanganan Error Database:
   - Apa yang terjadi jika Prisma connection timeout atau parameter Zod tidak valid?

Format Laporan Review yang Wajib Diberikan:
- Unhandled Edge Cases & Boundary Risks
- Discrepancy terhadap Spec
- Rekomendasi Hardening
- Verdict Akhir: [ACCEPTABLE / NEEDS_HARDENING]
```
