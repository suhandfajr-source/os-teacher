# Elicitation Report — Story 2: Gerbang Dedup Sekolah & Penguatan Alur Guru

| | |
|---|---|
| **Target Spec** | `_bmad-output/specs/spec-student-portal-auth/stories/2-gerbang-dedup-sekolah-penguatan-alur-guru.md` |
| **Tanggal Analisis** | 2026-09-21 |
| **Metodologi BMad** | **Comprehensive Multi-Dimensional Synthesis** (Risk & Adversarial · Technical & Algorithmic · Core & First Principles · Collaboration & Stakeholders · Framing & Architecture) |
| **Status Basis Data** | Prisma Client 7.9.1; Model `School`, `TeacherSchoolMembership`, `Student`, `AuditLog` sudah terpasang. |
| **Status Kode Live** | `students.actions.ts` mengekspos `accessPinHash` (VG-other2); `schools.actions.ts` memiliki celah re-aktivasi otomatis keanggotaan `REVOKED`. |
| **Status Rekomendasi** | **100% APPLIED** — Spec Story 2 telah diamandemen dan dikeraskan (*hardened*). |

---

## 1. Ringkasan Eksekutif

Story 2 mencakup gerbang deduplikasi sekolah saat onboarding/pembuatan sekolah baru, normalisasi nama v2 dengan kalkulasi kemiripan fuzzy, panel transparansi guru sekolah (Mode Santai), dan penguatan alur siswa (edit NIS dan proteksi hash kredensial).

Melalui sintesis multi-metode BMad, analisis ini menemukan **3 Celah Berstatus Kritis/Tinggi**, **2 Isu Performa & Skalabilitas**, serta **3 Area Tata Kelola & Integritas Data**. Seluruh temuan telah diverifikasi silang langsung ke kode repositori dan aturan database, lalu diterjemahkan menjadi klausul spesifikasi yang presisi.

---

## 2. Bedah Analisis Multi-Metode (Category Deep Dive)

### 2.1. Kategori Risk, Adversarial & Security (Metode 59, 60, 69, 63, 65)

#### 🔴 [F1 - CRITICAL] Celah Bypass Revoke via `joinSchool` (Red Team / Threat Modeling 69)
- **Bukti di Codebase (`src/modules/schools/schools.actions.ts:74-79`)**:
  ```typescript
  } else if (existingMembership.status === "REVOKED") {
    await prisma.teacherSchoolMembership.update({
      where: { id: existingMembership.id },
      data: { status: "ACTIVE" }
    });
  }
  ```
- **Vulnerability**: Jika seorang guru nakal/mencurigakan di-revoke oleh rekan guru di panel sekolah, guru tersebut cukup memanggil fungsi `joinSchool(schoolId)` kembali. Sistem langsung mengembalikan statusnya menjadi `ACTIVE` secara sepihak tanpa validasi atau persetujuan siapa pun.
- **Tindakan Perbaikan**: `joinSchool` diwajibkan memeriksa status keanggotaan existing; jika bernilai `REVOKED`, request **mutlak ditolak** dengan error spesifik (`"Keanggotaan Anda di sekolah ini telah dinonaktifkan. Hubungi pengelola sekolah."`).

#### 🔴 [F2 - CRITICAL] Privilege Inversion: Hostile Takeover Sekolah (Inversion 31 & Failure Mode 60)
- **Celah Desain**: Desain "Mode Santai" awal mengizinkan setiap guru aktif me-revoke rekan guru di sekolah yang sama, dengan satu-satunya proteksi adalah larangan me-revoke diri sendiri.
- **Skenario Serangan**: Guru baru dengan role `MEMBER` dapat me-revoke guru pendiri sekolah (`workspaceRole: OWNER`) atau me-revoke semua guru lain secara massal, mengakibatkan pengambilalihan workspace sekolah secara sepihak.
- **Tindakan Perbaikan**: Pasang guard otorisasi bertingkat: Role `MEMBER` **DILARANG me-revoke role `OWNER`** (`throw new Error("Hanya SuperAdmin atau pengelola sekolah yang dapat mengubah status Owner.")`).

---

### 2.2. Kategori Technical, Algorithm & Performance (Metode 71, 68, 70, 66)

#### 🔴 [F3 - CRITICAL] Cacat Algoritma Fuzzy Levenshtein 85% pada Nama Bernomor (Algorithm Olympics 68 & Boundary 71)
- **Masalah Formula**: Formula Levenshtein rasio sederhana `1 - (distance / max(lenA, lenB)) >= 0.85` gagal total saat diterapkan pada nama sekolah panjang yang hanya berbeda nomor institusi:
  - `"SMP Negeri 1 Surabaya"` (panjang 22) vs `"SMP Negeri 2 Surabaya"` (panjang 22):
    - Jarak karakter = `1` ('1' vs '2').
    - Rasio Kemiripan = $1 - (1 / 22) = 0.954$ (**95.4%** $\ge 85\%$).
    - **Dampak Fatal**: Sistem menganggap "SMP Negeri 2 Surabaya" adalah **duplikat typo** dari "SMP Negeri 1 Surabaya", memicu modal konfirmasi "Maksud Anda?" dan mengarahkan guru SMPN 2 untuk salah bergabung ke SMPN 1.
  - Sebaliknya pada nama pendek: `"SD 1"` vs `"SD 2"` (panjang 4) -> Rasio = $75\%$ (lolos tanpa peringatan).
- **Tindakan Perbaikan (Number-Aware Tokenizer + Veto)**:
  1. Pada tahap normalisasi, lakukan konversi angka Romawi (`"I"` $\rightarrow$ `"1"`, `"II"` $\rightarrow$ `"2"`, dst.) dan buang leading zeroes (`"01"` $\rightarrow$ `"1"`).
  2. Ekstrak seluruh token angka dari kedua nama sekolah.
  3. **Number-Aware Veto Rule**: Jika kedua nama memiliki token nomor/angka dan nomor tersebut **berbeda**, skor kemiripan langsung **di-veto menjadi 0%** (diperlakukan sebagai sekolah berbeda, lolos ke Skenario D).

#### 🟡 [F4 - MEDIUM] In-Memory Scan Bottleneck vs Skalabilitas DB (Performance Profiler 70)
- **Masalah**: Melakukan `findMany()` seluruh baris tabel `School` ke RAM Next.js server untuk dihitung Levenshtein ratio-nya akan menyebabkan CPU spike dan event loop blocking ketika jumlah sekolah mencapai ribuan (10.000+ baris).
- **Tindakan Perbaikan (Candidate Pre-Filtering)**:
  1. Cek index exact NPSN $\rightarrow$ jika match: Skenario A.
  2. Cek index exact `normalizedName` $\rightarrow$ jika match: Skenario B.
  3. Untuk fuzzy match (Skenario C): Tarik maksimal **50 kandidat terdekat** menggunakan filter SQL `city` atau token kata pertama (`name contains token`), baru hitung Levenshtein ratio in-memory pada subset kecil tersebut.

#### 🟡 [F5 - MEDIUM] Race Condition & Error Handling Prisma P2002 (Boundary Sweep 71)
- **Masalah**: Bila dua request mendaftarkan NPSN atau NIS yang sama secara bersamaan, PostgreSQL melempar error `P2002` (Unique constraint violation). Jika tidak ditangani di layer server action, frontend akan menerima HTTP 500 generik.
- **Tindakan Perbaikan**: Bungkus mutasi dalam `try/catch` Prisma, tangkap error `P2002`, dan kembalikan struktur response terstandarisasi `{ success: false, code: "NPSN_EXISTS" | "NIS_EXISTS", message: "..." }`.

---

### 2.3. Kategori Data Integrity & Security Projection (Metode 24, 30, 43, 47)

#### 🟡 [F6 - MEDIUM] Proteksi Kredensial Siswa (VG-other2 & Sanitasi NIS)
- **Bukti di Codebase (`src/modules/students/students.actions.ts:94`)**:
  - `getStudents()` saat ini menjalankan `prisma.student.findMany()` tanpa klausul `select`, mengekspos field `accessPinHash` (kredensial login portal siswa) ke response JSON klien.
- **Tindakan Perbaikan**:
  1. Wajibkan klausul `select` eksplisit di seluruh query `Student` (`getStudents`, `updateStudent`, `archiveStudent`, `addStudent`, `findOrCreateStudent`) yang secara tegas **tidak menyertakan `accessPinHash`**.
  2. Input NIS string kosong (`""` atau spasi) dinormalisasi menjadi `null` sebelum disimpan ke database agar tidak bentrok dengan `@@unique([schoolId, nis])`.

#### 🔵 [F7 - LOW] Standarisasi Schema Metadata `AuditLog` (Audit Persona 69)
- **Spesifikasi Log Aksi Revoke**:
  - `actorType`: `"USER"`
  - `actorId`: `session.user.id`
  - `action`: `"TEACHER_MEMBERSHIP_REVOKED"`
  - `targetType`: `"TEACHER_SCHOOL_MEMBERSHIP"`
  - `targetId`: `membership.id`
  - `metadata`: `{ schoolId, targetTeacherProfileId, targetTeacherName, targetWorkspaceRole }`

---

## 3. Matriks Komparasi Spesifikasi

| Parameter | Spesifikasi Awal (Draft) | Spesifikasi Hasil Elisitasi (Hardened) |
|---|---|---|
| **Perilaku Re-join Guru Revoked** | Tidak diatur (kode live auto-aktifkan kembali) | `joinSchool` **mutlak menolak** dan melempar error `REVOKED_CANNOT_REJOIN`. |
| **Hierarki Otorisasi Revoke** | Siapa saja bisa revoke siapa saja | **`MEMBER` dilarang keras me-revoke `OWNER`** (anti hostile takeover). |
| **Fuzzy Matching Sekolah** | Levenshtein 85% mentah | **Number-Aware Tokenizer + Veto 0%** jika nomor sekolah berbeda ("SMPN 1" vs "SMPN 2"). |
| **Normalisasi Nama Sekolah** | Alias jenjang kata saja | Alias jenjang + konversi Romawi (`"I"` $\rightarrow$ `"1"`) + sanitasi leading zeroes (`"01"` $\rightarrow$ `"1"`). |
| **Strategi Query DB** | Potensi scan full tabel ke RAM | **Candidate Pre-filtering** (maksimal 50 kandidat berbasis kota/token). |
| **Penanganan NIS Siswa** | Trim + uppercase | Trim + uppercase + konversi `""` $\rightarrow$ `null` + penangkapan graceful Prisma `P2002`. |
| **Keamanan Kolom Kredensial** | Disebut umum di boundaries | **Klausul `select` eksplisit wajib** di seluruh query siswa (proteksi mutlak `accessPinHash`). |
| **Backfill Script DB** | Disebut idempotent | Idempotent dengan **chunk batching (100 baris/iterasi)** untuk mencegah lock contention. |

---

## 4. Status Triage & Disposisi

Seluruh temuan di atas telah diterapkan (**Applied**) ke dalam dokumen spesifikasi:
`_bmad-output/specs/spec-student-portal-auth/stories/2-gerbang-dedup-sekolah-penguatan-alur-guru.md`.

Dokumen spec telah siap dijadikan acuan implementasi coding (Build Stage) tanpa risiko regresi keamanan maupun false duplicate pada database produksi.
