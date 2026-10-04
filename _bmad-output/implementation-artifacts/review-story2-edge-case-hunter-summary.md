# Hasil Review Edge-Case Hunter: Story 2 (Klassa Agent Deterministic Tools & Scope Rombel B2)

- **Sumber Prompt:** `_bmad-output/implementation-artifacts/review-story2-edge-case-hunter-prompt.md`
- **Spesifikasi Acuan:** `_bmad-output/implementation-artifacts/spec-klassa-agent-tools.md`
- **File Diff yang Diuji:** `_bmad-output/implementation-artifacts/diff-klassa-agent-tools.patch`
- **Peran:** Lead QA & Reliability Engineer (Edge-Case Hunter)
- **Tanggal:** 3 Oktober 2026

---

## 1. Analisis 4 Skenario Fokus Investigasi

### 1.1. Rombel Baru / Kosong (`ClassStudent = 0`)
- **Evaluasi Logika Murni:**
  - `calculateAcademicGradeStats([])` mengecek `scores.length === 0` dan mengembalikan nilai aman (`rataRata: 0`, `statusKetercapaian: "BELUM_ADA_NILAI"`). Tidak terjadi `Math.max(...[])` yang menghasilkan `-Infinity`.
  - `getClassStudentsTool` mengembalikan `totalSiswa: 0` dan `siswa: []`.
  - `analyzeClassPerformanceTool` menghasilkan `totalSiswa: 0`, `jumlahSiswaPerluPerhatian: 0`, dan `daftarSiswaPerluPerhatian: []`.
- **Temuan Kritis (Runtime Failure):**
  - Meskipun logika branching kosong aman, kode di `getClassStudentsTool` mencoba mengakses field skema yang **tidak ada** di tabel Prisma:
    - `cs.student.nisn` (field `nisn` tidak ada di model `Student`).
    - `cs.student.gender` (field `gender` tidak ada di model `Student`).
    - `cs.enrollmentStatus: cs.status` (field `status` tidak ada di model `ClassStudent`).
  - Hal ini menyebabkan eksekusi query gagal/undefined saat memetakan murid rombel.

---

### 1.2. Siswa Baru Tanpa Rekam Medis Presensi (`totalPertemuan = 0`)
- **Evaluasi Pembagian Nol (Divide-by-Zero):**
  - Pada `calculateAttendanceStats`:
    ```ts
    const total = counts.hadir + counts.sakit + counts.izin + counts.alpa;
    if (total === 0) {
      return {
        ...counts,
        totalPertemuan: 0,
        persentaseKehadiran: 0,
        kategori: "BELUM_ADA_DATA",
      };
    }
    ```
    Terverifikasi aman: tidak terjadi pembagian dengan nol (`0 / 0`) dan tidak menghasilkan `NaN`.
  - Pada `analyzeClassPerformanceTool`:
    ```ts
    const butuhPerhatian =
      (attStats.totalPertemuan > 0 && attStats.persentaseKehadiran < 75) ||
      (acadStats.totalItem > 0 && acadStats.rataRata < kkm);
    ```
    Terverifikasi aman: guard `attStats.totalPertemuan > 0` mencegah siswa baru (yang persentase kehadirannya 0%) salah terdeteksi sebagai "Siswa Bermasalah / Butuh Perhatian".
- **Celah Boundary Query (Cross-Class Leak):**
  - Query presensi di `getStudentAttendanceSummaryTool`:
    ```ts
    where: {
      student: { classMemberships: { some: { classId } } }
    }
    ```
    Query ini memfilter siswa yang pernah terdaftar di kelas tersebut, namun mengambil **seluruh** `attendanceRecord` siswa tersebut tanpa memfilter `teachingSession.teachingContext.classId`. Presensi dari rombel/mata pelajaran lain ikut terhitung.

---

### 1.3. Penilaian Asesmen Ekstrem (Nilai 0, 100, Desimal 77.33, & Custom KKM)
- **Evaluasi Pembulatan Matematika:**
  - Formula `Math.round((sum / totalItem) * 10) / 10` terbukti deterministik dan membulatkan tepat 1 desimal. Nilai `77.33` dibulatkan menjadi `77.3`.
  - Nilai batas ekstrem `0` dan `100` diproses secara benar.
  - Parameter `kkm` kustom (misal KKM = 80) dievaluasi dengan benar pada `s >= kkm`.
- **Temuan Kritis (Runtime Crash 500):**
  - Pada `getStudentAcademicSummaryTool` (baris 197) dan `analyzeClassPerformanceTool` (baris 239):
    ```ts
    const assessments = await prisma.assessmentRecord.findMany(...)
    ```
    Model `assessmentRecord` **tidak ada** di skema Prisma (`prisma/schema.prisma`). Model yang sebenarnya adalah `assessmentResult` atau `assessment`. Panggilan ini akan langsung melempar error runtime: `TypeError: Cannot read properties of undefined (reading 'findMany')`.

---

### 1.4. Penanganan Error Database & Boundary Otorisasi
- **Temuan Kritis (Broken Module Import):**
  - File `src/modules/agent/tools/agent-query.tools.ts` mengimpor `verifyTeacherClassAccess`:
    ```ts
    import {
      verifyActiveSchoolMembership,
      verifyTeacherClassAccess,
    } from "@/lib/authorization";
    ```
  - Namun pada `src/lib/authorization.ts`, fungsi `verifyTeacherClassAccess` **tidak pernah didefinisikan / tidak diekspor**. Fungsi yang tersedia di modul otorisasi adalah `verifyClassRosterAccess(classId)`.
  - Test suite `agent-tools.test.ts` berhasil lulus hanya karena melakukan *mocking* `auth.verifyTeacherClassAccess`, menyembunyikan fakta bahwa impor pada kode produksi rusak total.

---

## 2. Unhandled Edge Cases & Boundary Risks

| No | Lokasi | Kondisi Pemicu (Trigger) | Dampak Nyata |
|:--:|--------|--------------------------|--------------|
| 1 | `agent-query.tools.ts:5` | Import modul `verifyTeacherClassAccess` saat aplikasi Next.js boot/run | Runtime crash: `Module "@/lib/authorization" has no exported member 'verifyTeacherClassAccess'`. |
| 2 | `agent-query.tools.ts:197, 239` | Tool asesmen / analisis kelas dipanggil untuk query nilai | Runtime crash: `prisma.assessmentRecord` tidak terdefinisi pada PrismaClient (model di skema adalah `AssessmentResult`). |
| 3 | `agent-query.tools.ts:102-105` | `getClassStudentsTool` dipanggil untuk menampilkan murid kelas | Akses properti non-eksisten (`nisn`, `gender` pada Student; `status` pada ClassStudent) menghasilkan data `undefined`. |
| 4 | `agent-query.tools.ts:135-155` | Siswa memiliki histori di multi-rombel atau banyak mata pelajaran | Rekap presensi mencampuradukkan sesi dari mata pelajaran dan rombel lain karena tidak ada filter `teachingSession.teachingContext.classId`. |
| 5 | `agent-query.tools.ts:24-32` | Error non-Error instance dilempar oleh database adapter | `formatToolError` salah melabeli error koneksi DB sebagai `"Akses ditolak: Anda bukan pengampu rombel ini."`. |

---

## 3. Discrepancy terhadap Spesifikasi (`spec-klassa-agent-tools.md`)

1. **Klaim Otorisasi Scope Rombel B2**:
   - Spec mengklaim: *"Guard Keamanan Scope Rombel B2: Jika guru meminta data dari rombel yang BUKAN kelas yang diampunya, tool mengembalikan error otorisasi eksplisit via `verifyTeacherClassAccess`."*
   - Realita: Fungsi `verifyTeacherClassAccess` tidak ada di codebase. Seharusnya menggunakan fungsi resmi `verifyClassRosterAccess(classId)` yang sudah ada di `src/lib/authorization.ts`.
2. **Klaim Rekap Nilai Akademik**:
   - Spec mengklaim query teroptimasi pada tabel asesmen.
   - Realita: Menggunakan nama model Prisma khayalan (`assessmentRecord`) sehingga fitur rekap akademik sama sekali tidak dapat berfungsi.

---

## 4. Rekomendasi Hardening (Actionable Fixes)

1. **Ganti Impor Otorisasi ke Fungsi yang Sah:**
   Gunakan `verifyClassRosterAccess` di `src/modules/agent/tools/agent-query.tools.ts`:
   ```ts
   import {
     verifyActiveSchoolMembership,
     verifyClassRosterAccess,
   } from "@/lib/authorization";
   ```
2. **Koreksi Model Asesmen ke `assessmentResult`:**
   Sesuaikan query dengan relasi skema Prisma yang sebenarnya:
   ```ts
   const results = await prisma.assessmentResult.findMany({
     where: {
       student: { classMemberships: { some: { classId } } },
       assessment: { teachingContext: { classId } },
     },
     select: { score: true },
   });
   ```
3. **Koreksi Field Murid pada `getClassStudentsTool`:**
   Sesuaikan dengan field model `Student` (`nis`, `fullName`, tanpa `nisn`/`gender` jika belum ada di schema).
4. **Isolasi Presensi ke Rombel Terkait:**
   Tambahkan filter sesi pengajaran rombel:
   ```ts
   where: {
     studentId: studentId || undefined,
     teachingSession: { teachingContext: { classId } },
   }
   ```

---

## 5. Verdict Akhir

### **Verdict: NEEDS_HARDENING**

**Alasan:**
Walaupun logika matematika deterministik (`agent-deterministic-math.ts`) dirancang dengan baik dan tahan terhadap kondisi pembagian nol / boundary ekstrem, kode implementasi tools (`agent-query.tools.ts`) mengalami kegagalan kompilasi TypeScript dan crash runtime akibat:
1. Mengimpor fungsi otorisasi yang tidak ada di `@/lib/authorization`.
2. Memanggil model `prisma.assessmentRecord` yang tidak ada di Prisma Client.
3. Mengakses properti skema yang tidak sesuai dengan `schema.prisma`.
