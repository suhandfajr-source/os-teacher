# BMAD MASTER BLUEPRINT: KONSOL & DASHBOARD SUPERADMIN KLASSA

**Dokumen**: Master Blueprint & Spesifikasi Teknis (BMAD Architecture)  
**Target**: Platform-Level Superadmin Cockpit, Global Analytics & Entity Lifecycle Management  
**Status**: PROPOSED (Ready for Review & Implementation)  
**Versi**: 1.0.0  
**Tanggal**: 25 September 2026  

---

## 1. Executive Summary & Problem Statement

### 1.1 Kondisi Saat Ini (Current State)
1. **Layout Masalah Responsivitas PC Desktop**:
   - Konsol `/admin` saat ini dibatasi oleh kontainer `max-w-6xl` dengan struktur kolom tunggal (*single column vertical stack*) sempit, menyebabkan ruang kosong putih masif di sisi kanan monitor PC desktop.
2. **Ketiadaan Analitik & Pemetaan Agregat**:
   - Belum ada dashboard visual untuk memantau metrik kunci platform: total sekolah terdaftar, total guru aktif, total siswa, dan pemetaan jenjang rombel (misal: jumlah kelas 7, 8, 9, dst beserta jumlah siswanya).
3. **Kontrol Entitas Terfragmentasi**:
   - Aksi superadmin saat ini terbatas pada form pencarian manual berbasis ID/email parsial tanpa antarmuka tabel data terintegrasi untuk operasi **Aktifkan, Nonaktifkan, Edit, dan Hapus/Arsip** untuk 4 entitas inti: **Sekolah, Guru, Siswa, dan Kelas**.

### 1.2 Target Solusi (Target State)
Membangun **Superadmin Cockpit KLASSA** dengan desain Desktop-First (Full-Width Responsive Shell bernuansa Edu-Teal & Dark Slate), dilengkapi:
- **Cockpit Ringkasan Eksekutif (KPI Cards)** dengan pembaruan data real-time.
- **Visual Matrix Pemetaan Jenjang Kelas (Grade Distribution Map)**.
- **Pusat Manajemen 4 Pilar Entitas (CRUD + Status Control)** yang aman dengan cascading guard & audit trail lengkap.
- **Omni-Search & Filter Multi-Tenant**.

---

## 2. Kernel Spesifikasi 5-Field (BMAD Spec Standard)

### 2.1 Why (Latar Belakang & Nilai Bisnis)
Superadmin platform membutuhkan pusat kendali terpadu untuk mengawasi skala pertumbuhan sekolah, mendeteksi anomali kapasitas kelas/siswa, serta melakukan intervensi administratif cepat (seperti reset password darurat, ban akun, kurasi sekolah baru, atau pembersihan data sampah) tanpa harus membuka database secara manual dan tetap mematuhi prinsip tata kelola data sekolah.

---

### 2.2 Capabilities (`CAP-N`)

| ID | Kapabilitas | Deskripsi & Intent | Kriteria Sukses (Success Signal) |
| :--- | :--- | :--- | :--- |
| **CAP-ADM-01** | **Full-Width Desktop PC Shell** | Layout admin penuh (100% viewport width) dengan Sidebar navigasi tetap di kiri, Header informatif, dan area konten responsif. | Tampilan memenuhi layar monitor PC tanpa ada ruang putih kosong di kanan; rapi pada resolusi 1080p, 1440p, hingga 4K. |
| **CAP-ADM-02** | **Executive KPI Metrics Engine** | Komputasi server-side instan untuk 4 metrik platform: Total Sekolah (Aktif/Nonaktif), Total Guru, Total Siswa (Active/Pending), dan Total Kelas. | Angka agregat dihitung akurat dari database dan ter-render dalam < 300ms. |
| **CAP-ADM-03** | **Jenjang & Grade Mapping Matrix** | Visualisasi dan tabel pemetaan distribusi tingkat kelas (contoh: Tingkat 7, 8, 9 atau 10, 11, 12) berisi jumlah rombel, total siswa, dan rata-rata rasio kapasitas. | Menampilkan perincian rombel dan populasi siswa per tingkat kelas secara jelas. |
| **CAP-ADM-04** | **School Lifecycle Management** | Tabel dan aksi kontrol Sekolah: Cari (Nama/NPSN), Nonaktifkan (revoke sesi & clear NPSN), Reaktivasi, Edit NPSN, dan Hapus/Arsip Aman. | Superadmin dapat mengaktifkan/menonaktifkan atau mengarsipkan sekolah; aksi berbahaya dicegah jika ada data nilai terkunci. |
| **CAP-ADM-05** | **Teacher/User Lifecycle Management** | Tabel dan aksi kontrol Guru: Cari (Nama/Email), Ban/Unban, Reset Password Instan, Lepas Asosiasi Sekolah, dan Soft-Delete. | Guru bermasalah dapat di-ban seketika (seluruh sesi aktif hangus), dan password dapat direset aman. |
| **CAP-ADM-06** | **Student Lifecycle Management** | Tabel dan aksi kontrol Siswa: Cari (Nama/NIS/ID), Force Approve/Reject (L3), Reset PIN 4-Digit, Pindah Rombel, dan Hapus Data Siswa Duplikat. | Siswa dapat di-approve, direset PIN-nya secara aman, atau dipindahkan rombel lintas-sekolah. |
| **CAP-ADM-07** | **Class/Rombel Lifecycle Management** | Tabel dan aksi kontrol Kelas: Cari per Sekolah/Tingkat, Tambah Kelas, Ubah Tingkat/Nama Rombel, dan Hapus Rombel Kosong. | Rombel baru dapat dibuat atau dihapus jika tidak memiliki siswa aktif terdaftar. |
| **CAP-ADM-08** | **Real-Time Audit Trail Stream** | Pencatatan mutasi superadmin ke tabel `AuditLog` dan tampilan feed 10 aktivitas keamanan terbaru di dashboard utama. | Setiap aksi mutasi tercatat dengan detail `actorId`, `action`, `targetType`, `targetId`, dan timestamp. |
| **CAP-ADM-09** | **Multi-Tenant Filter & Omni-Search** | Dropdown filter sekolah global untuk membatasi analitik dan tabel pada satu sekolah spesifik atau melihat data keseluruhan. | Pencarian dan filter instan memperbarui tabel tanpa reload halaman penuh. |

---

### 2.3 Constraints (Batasan & Aturan Ketat)

1. **Keamanan & Guarding**:
   - Seluruh route `/admin/*` dan Server Actions superadmin wajib dilindungi oleh `requireSuperAdmin()`.
   - Akun dengan `platformRole: "ADMIN"` (Superadmin) tidak boleh di-ban atau direset sembarangan via UI untuk mencegah *lockout*.
2. **Integritas Data Relasional (Anti-Orphan & Safe Deletion)**:
   - **Sekolah**: Tidak boleh di-hard-delete jika memiliki rekaman transaksional aktif; gunakan status deaktivasi (`deactivatedAt`) atau isolasi.
   - **Guru**: Penghapusan akun guru yang memiliki riwayat penilaian (`Assessment`/`Grade`) dialihkan ke pemutusan `TeacherMembership` atau penonaktifan (`banned: true`).
   - **Siswa**: Siswa dengan catatan nilai rapor/ujian tidak boleh di-hard-delete sembarangan tanpa konfirmasi proteksi data.
3. **Desain Visual & Tema**:
   - Mengikuti standar desain **KLASSA Modern Dark Dashboard** (Latar: `slate-950`/`slate-900`, Aksen: `emerald-400`/`teal-500`, Border: `slate-800`).
   - Tidak menggunakan warna default kaku; gunakan badge status semantik (`emerald` untuk Aktif, `red` untuk Banned/Nonaktif, `amber` untuk Pending).

---

### 2.4 Non-goals (Di Luar Cakupan Tahap Ini)
- Tidak membuat sistem penagihan/billing otomatis (SaaS subscription) pada rilis ini.
- Tidak menggantikan fitur input harian guru di workspace sekolah masing-masing.
- Tidak mengizinkan bypass otentikasi tanpa audit trail.

---

### 2.5 Success Signal (Sinyal Keberhasilan Pengujian)
- Layout `/admin` memenuhi 100% lebar viewport pada resolusi desktop PC.
- Ringkasan statistik (Sekolah, Guru, Siswa, Kelas) dan grafik/tabel jenjang kelas muncul secara akurat.
- Seluruh 4 tab manajemen (Sekolah, Guru, Siswa, Kelas) berfungsi untuk pencarian, perubahan status (aktif/nonaktif), reset, dan penghapusan/arsip.
- Seluruh unit & integration test suite (`vitest`) lolos 100% dan TypeScript check `0 error`.

---

## 3. Arsitektur Antarmuka & Tata Letak (UI/UX Hierarchy)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR: [KLASSA Platform Admin]  |  [Global Omni-Search 🔍]  |  [Sekolah: Semua Sekolah ▼]  |  [Admin] │
├───────────────────┬────────────────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR           │ KONTEN UTAMA (FULL DESKTOP WIDTH)                                                  │
│                   │                                                                                    │
│ 📊 Ringkasan      │ ┌───────────────┬───────────────┬────────────────┬───────────────────────────────┐ │
│ 🏫 Sekolah        │ │ 🏫 12 Sekolah │ 👨‍🏫 84 Guru    │ 🎒 2,450 Siswa │ 📚 78 Rombel                  │ │
│ 👨‍🏫 Guru/Staf    │ │ 10 Aktif · 2  │ 82 Aktif · 2  │ 2.400 Aktif    │ Rata-rata 31 siswa/kelas      │ │
│ 🎒 Siswa          │ └───────────────┴───────────────┴────────────────┴───────────────────────────────┘ │
│ 📚 Kelas/Rombel   │                                                                                    │
│ 🛡️ Audit Log      │ ┌────────────────────────────────────────────────────────────────────────────────┐ │
│ ⚙️ Sistem & Kuota │ │ 📊 PEMETAAN JENJANG KELAS (Grade Level Distribution)                           │ │
│                   │ │ • Tingkat 7 : 8 Rombel  | 256 Siswa | [======                   ] 32 siswa/kls │ │
│                   │ │ • Tingkat 8 : 8 Rombel  | 250 Siswa | [======                   ] 31 siswa/kls │ │
│                   │ │ • Tingkat 9 : 8 Rombel  | 248 Siswa | [======                   ] 31 siswa/kls │ │
│                   │ └────────────────────────────────────────────────────────────────────────────────┘ │
│                   │                                                                                    │
│                   │ ┌────────────────────────────────────────────────────────────────────────────────┐ │
│                   │ │ 📋 TABEL MANAJEMEN TERINTEGRASI (Sekolah / Guru / Siswa / Kelas)               │ │
│                   │ │ [Search / Filter] [Tambah Baru / Batch Action]                                 │ │
│                   │ │ ┌────────────────────────────────────────────────────────────────────────────┐ │ │
│                   │ │ │ Entitas     | Info & Rincian        | Status   | Aksi Cepat                │ │ │
│                   │ │ │ SMPN 1      | NPSN: 10293848 · 24 K | [AKTIF]  | [Nonaktif] [Edit] [Arsip] │ │ │
│                   │ │ │ Budi, S.Pd  | budi@sekolah.id · Gr  | [AKTIF]  | [Ban] [Reset Pwd] [Lepas] │ │ │
│                   │ │ │ Ahmad Rizki | NIS: 2024001 · 7-A    | [ACTIVE] | [Reset PIN] [Pindah] [Del]│ │ │
│                   │ │ └────────────────────────────────────────────────────────────────────────────┘ │ │
│                   │ └────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────┴────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Rincian Desain Modul & Server Actions

### 4.1 Modul Statistik & Pemetaan Jenjang (`admin-stats.service.ts`)
Fungsi server untuk menghitung:
```typescript
interface SuperadminOverviewStats {
  schools: { total: number; active: number; inactive: number };
  teachers: { total: number; active: number; banned: number };
  students: { total: number; active: number; pending: number };
  classes: { total: number; totalEnrollments: number };
  gradeDistribution: Array<{
    gradeLevel: string; // e.g., "7", "8", "9" atau nama custom
    classCount: number;
    studentCount: number;
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    actorEmail: string;
    targetType: string;
    createdAt: Date;
  }>;
}
```

### 4.2 Modul Manajemen Sekolah (`schools-admin.actions.ts`)
1. `listSchoolsForAdminAction(query, statusFilter, page)`
2. `deactivateSchoolAction(schoolId)`
3. `reactivateSchoolAction(schoolId)`
4. `updateSchoolNpsnAction(schoolId, npsn)`
5. `deleteOrArchiveSchoolAction(schoolId, confirmationName)`

### 4.3 Modul Manajemen Guru / Pengguna (`users-admin.actions.ts`)
1. `listTeachersForAdminAction(query, schoolId, statusFilter, page)`
2. `banTeacherAction(userId, reason)`
3. `unbanTeacherAction(userId)`
4. `resetTeacherPasswordAction(userId, newPassword)`
5. `disassociateTeacherFromSchoolAction(membershipId)`
6. `deleteTeacherAccountAction(userId)` (dengan guard pengecekan relasi asesmen)

### 4.4 Modul Manajemen Siswa (`students-admin.actions.ts`)
1. `listStudentsForAdminAction(query, schoolId, classId, statusFilter, page)`
2. `forceApproveStudentAction(studentId)`
3. `forceRejectStudentAction(studentId, reason)`
4. `forceResetStudentPinAction(studentId, newPin)`
5. `transferStudentClassAction(studentId, targetClassId)`
6. `deleteStudentAdminAction(studentId)` (dengan guard integritas nilai)

### 4.5 Modul Manajemen Kelas / Rombel (`classes-admin.actions.ts`)
1. `listClassesForAdminAction(query, schoolId, gradeFilter, page)`
2. `createClassAdminAction(schoolId, academicPeriodId, name, gradeLevel)`
3. `updateClassAdminAction(classId, name, gradeLevel)`
4. `deleteClassAdminAction(classId)` (khusus rombel tanpa siswa terdaftar)

---

## 5. Rencana Pentahapan Implementasi (Action Plan)

1. **Fase 1: Layout & Core Shell**
   - Perbarui `src/app/admin/layout.tsx` menjadi Full-Width Desktop Shell dengan Sidebar navigasi superadmin modern.
2. **Fase 2: Backend Query Aggregator & Service**
   - Buat fungsi pengambil metrik agregat platform & pemetaan grade level (`getSuperadminDashboardStats`).
3. **Fase 3: Widget Statistik & Pemetaan Jenjang**
   - Implementasikan 4 KPI Cards dan Visualisasi Bar Grid untuk distribusi jenjang kelas 7, 8, 9, 10, 11, 12.
4. **Fase 4: Tab Manajemen Terintegrasi (CRUD + Actions)**
   - Buat tab interaktif untuk Sekolah, Guru, Siswa, dan Kelas dengan fitur pencarian, filter, modal edit/tambah, dan tombol aksi cepat.
5. **Fase 5: Pengujian & Quality Gate**
   - Jalankan verifikasi TypeScript, validasi keamanan, dan unit test suite.
