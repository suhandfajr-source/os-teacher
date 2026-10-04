---
status: done
date: 2026-10-04
title: Klassa Agent Guru Chat Interface, ActionConfirmCard & Floating Launcher
route: full
baseline_commit: '716ed5871c245f5f64973d4e4c87767a5a0451b5'
review_loop_iteration: 1
---  

---

## 1. Overview & Business Value
Setelah fondasi backend selesai (Core Runtime di Story 1, Deterministic Query Tools di Story 2, Human-in-the-Loop Action Confirmation Engine di Story 3, dan Teacher Memory di Story 4), Story 5 menghadirkan antarmuka visual (UI) interaktif bagi guru di portal Klassa OS:
1. **Halaman Khusus Asisten (`/asisten`):** Ruang konsultasi dan asisten operasional penuh dengan streaming token real-time, pemilihan model AI dinamis, riwayat percakapan guru, dan template pertanyaan praktis (*quick prompts*).
2. **Kartu Konfirmasi Aksi (`ActionConfirmCard`):** Komponen kartu interaktif di dalam bubble chat yang menampilkan draf mutasi data (Presensi Rombel, Publikasi Tugas, Pengumuman Kelas) dari `AgentActionProposal` dengan status badge (`PENDING`, `EXECUTED`, `CANCELLED`, `EXPIRED`) dan tombol konfirmasi/batal berpagar atomik.
3. **Floating Agent Launcher (`FloatingAgentLauncher`):** Tombol melayang di pojok kanan bawah pada seluruh halaman portal guru (`src/app/(dashboard)/layout.tsx`) yang membuka popover/drawer chat cepat tanpa harus meninggalkan halaman yang sedang aktif.
4. **Modal Pengaturan Memori Guru (`AgentSettingsModal`):** Dialog bagi guru untuk melihat dan mengubah gaya komunikasi (`RAMAH_SOPAN`, `LUGAS_RINGKAS`, `FORMAL`), fokus kurikulum, model bawaan, serta tombol reset ingatan asisten.

---

## 2. User Stories & Acceptance Criteria

### User Story 5.1: Streaming Chat di Halaman `/asisten`
- **Sebagai** guru yang sedang membuka portal Klassa OS,
- **Saya ingin** dapat membuka halaman `/asisten` dan mengobrol secara streaming dengan Klassa Agent,
- **Sehingga** saya mendapatkan bantuan administrasi kelas, analisis nilai siswa, dan rekomendasi modul ajar secara instan dan responsif.
- **Kriteria Penerimaan:**
  1. Halaman `/asisten` terlindungi sesi aktif guru via `verifyActiveSchoolMembership()`.
  2. Guru dapat memilih model AI yang aktif (`gemini-1.5-flash`, `gemini-1.5-pro`, `hermes-local`).
  3. Respons percakapan di-stream secara real-time via route API tepercaya (`/api/agent/chat`).
  4. Tersedia sidebar/drawer riwayat percakapan lampau guru dan tombol percakapan baru ("+ Obrolan Baru").
  5. Tersedia tombol *Quick Prompts* (misal: "Analisis kehadiran minggu ini", "Buatkan draf pengumuman ujian", "Strategi ajar siswa pasif").

### User Story 5.2: Kartu Interaktif Human-in-the-Loop (`ActionConfirmCard`)
- **Sebagai** guru yang meminta asisten melakukan mutasi (misal: "Catat kehadiran kelas 7A"),
- **Saya ingin** melihat kartu visual interaktif berisi ringkasan data sebelum disimpan ke database resmi,
- **Sehingga** saya memiliki kendali mutlak (Human-in-the-Loop) dan tidak ada perubahan data tanpa persetujuan saya.
- **Kriteria Penerimaan:**
  1. Saat agen memanggil proposal tool (kehadiran, pengumuman, draf tugas), sistem merender `ActionConfirmCard` di bubble pesan asisten.
  2. Kartu menampilkan: Jenis Aksi, Rombel/Kelas Sasaran, Ringkasan Detail, dan Status Badge (`Menunggu Konfirmasi`, `Berhasil Dieksekusi`, `Dibatalkan`, `Kedaluwarsa`).
  3. Tombol "Konfirmasi & Eksekusi" memanggil `executeAgentAction(proposalId)`. Jika sukses, badge berubah menjadi hijau `EXECUTED` secara instan tanpa reload halaman penuh.
  4. Tombol "Batalkan" memanggil `cancelAgentAction(proposalId)` dan mengubah status menjadi abu-abu `CANCELLED`.
  5. Menampilkan indikator TTL countdown jika proposal masih pending (15 menit).

### User Story 5.3: Floating Agent Launcher di Portal Guru
- **Sebagai** guru yang sedang berada di halaman kelas, nilai, atau jadwal,
- **Saya ingin** tombol melayang Klassa Agent di pojok kanan bawah,
- **Sehingga** saya dapat membuka drawer mini chat cepat untuk bertanya tanpa navigasi bolak-balik ke menu lain.
- **Kriteria Penerimaan:**
  1. Komponen `FloatingAgentLauncher` terpasang di `src/app/(dashboard)/layout.tsx`.
  2. Menampilkan ikon Klassa Agent elegan dengan status indikator online.
  3. Mengklik tombol membuka mini drawer / popover chat dengan fungsionalitas streaming yang sama dengan halaman utama.
  4. Memiliki tombol navigasi "Buka Layar Penuh" yang mengarahkan ke `/asisten`.

### User Story 5.4: Modal Pengaturan Preferensi Memori Guru
- **Sebagai** guru,
- **Saya ingin** dapat menyesuaikan gaya komunikasi asisten dan fokus kurikulum saya kapan saja,
- **Sehingga** asisten berbicara sesuai preferensi pribadi saya.
- **Kriteria Penerimaan:**
  1. Terdapat tombol ikon *Settings / Gerigi* di header obrolan yang membuka `AgentSettingsModal`.
  2. Menampilkan formulir: Pilihan Nada Bahasa (Radio Card: Ramah & Santun, Lugas & Ringkas, Formal Kedinasan), Pilihan Model AI Default, dan Catatan Preferensi Khusus.
  3. Terdapat tombol "Reset Ingatan Asisten" yang memanggil `resetTeacherAgentMemoryAction()` dengan dialog konfirmasi agar aman.

---

## 3. Architecture & Technical Design

### 3.1. Route & Component Tree
```text
src/
├── app/
│   ├── (dashboard)/
│   │   ├── asisten/
│   │   │   ├── page.tsx                     # Server component with auth check & initial data
│   │   │   └── AsistenClient.tsx            # Full-page interactive chat experience
│   │   └── layout.tsx                       # Injects FloatingAgentLauncher globally
│   └── api/
│       └── agent/
│           └── chat/
│               └── route.ts                 # Streaming route with tool execution & memory prompt
├── components/
│   └── agent/
│       ├── ActionConfirmCard.tsx            # Interactive confirmation card for proposals
│       ├── FloatingAgentLauncher.tsx        # Persistent floating launcher widget
│       ├── AgentSettingsModal.tsx           # Memory preferences & tone settings dialog
│       ├── ChatMessageBubble.tsx            # Message renderer with markdown & action cards
│       └── QuickPromptPills.tsx             # Shortcut suggestions for teachers
└── modules/
    └── agent/
        └── __tests__/
            └── agent-ui.test.ts             # Unit & component integration verification
```

### 3.2. Streaming Pipeline (`/api/agent/chat/route.ts`)
- Memvalidasi sesi guru via `verifyActiveSchoolMembership()`.
- Mengambil memori guru via `prisma.teacherAgentMemory.findUnique({ where: { teacherProfileId: profile.id } })`.
- Membangun system prompt dinamis via `buildAgentSystemPrompt({ memory })`.
- Menyediakan tools gabungan:
  - Query tools: `queryStudentSummaryTool`, `queryClassAttendanceSummaryTool`, `queryClassAssessmentSummaryTool`.
  - Action proposal tools: `proposeAttendanceLogTool`, `proposeClassAnnouncementTool`, `proposeAssignmentDraftTool`.
  - Memory tool: `updateTeacherMemoryPreferenceTool`.
- Menjalankan `streamText` dari AI SDK (`ai: ^7.0.127`) dengan `maxSteps: 5` untuk multi-step reasoning, lalu mengembalikan streaming response terstandarisasi.
- Menyimpan pesan asisten dan proposal aksi ke database secara otomatis.

---

## 4. Security & Privacy Guardrails
1. **Multi-Tenant Session Lock:** Route `/api/agent/chat` dan halaman `/asisten` memvalidasi `verifyActiveSchoolMembership()`. Tidak ada data atau proposal yang dapat dieksekusi lintas sekolah atau lintas profil guru.
2. **Atomic Confirmation Execution:** `ActionConfirmCard` memanggil `executeAgentAction` yang dilindungi Atomic Gate Lock (Story 3 TOCTOU defense). Tombol dinonaktifkan secara optimistik saat proses eksekusi berlangsung.
3. **Data Scrubbing on Render:** Nilai rahasia (hash, token autentikasi) tidak pernah dirender ke DOM.

---

## 5. Verification & Test Plan
1. **Route Security Test:** Memastikan `/api/agent/chat` menolak permintaan tanpa sesi guru yang valid (401 Unauthorized).
2. **ActionConfirmCard Test:** Memastikan status badge ter-render sesuai proposal (`PENDING`, `EXECUTED`, `CANCELLED`, `EXPIRED`) dan handler mutasi dipanggil dengan id proposal yang tepat.
3. **Settings Modal Test:** Memastikan form pengaturan memanggil `updateTeacherAgentMemoryAction` dan `resetTeacherAgentMemoryAction`.
4. **Full Regression Check:** Memastikan seluruh pengujian lama (893 tests) tetap 100% hijau.
