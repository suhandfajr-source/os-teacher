---
title: 'Rangkuman Elicitation — Story 6: Pengerasan, Rollover TA & Dokumentasi'
type: 'elicitation-summary'
created: '2026-09-23'
target: '{project-root}/_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.md'
methods:
  - Pre-mortem Analysis
  - Security Audit Personas
  - Boundary & Edge Case Sweep
  - Assumption Audit
  - Second-Order Thinking
result: '11 temuan — semua diterima & diterapkan ke bagian non-frozen; 3 usulan frozen ditandai sebagai Renegotiation Candidates'
---

# Rangkuman Elicitation — Story 6

## Ringkasan Bahasa Sederhana

Aplikasi sekolah ini sedang menyiapkan "pindah buku absen" dari tahun ajaran lama ke baru (rollover). Dokumen Story 6 adalah **gambar rencana renovasinya**. Elicitation ini = pemeriksaan gambar rencana memakai 5 kacamata berbeda **sebelum tukang mulai bekerja**. Hasilnya: 11 celah ditemukan, semua solusinya sudah ditulis ke dalam rencana. Bagian rencana yang sudah "ditandatangani pemilik" (frozen) tidak diubah — usulannya ditaruh di lembar terpisah menunggu persetujuan.

| Istilah | Permisalan |
|---|---|
| Periode ACTIVE/INACTIVE | Buku absen yang sedang dipakai vs sudah disimpan. Aturan: hanya boleh satu yang dipakai |
| NIS + PIN | Nomor absen + kunci loker pribadi siswa |
| Klaim ulang | Siswa lama pindah kelas, kunci loker lamanya tetap dipakai |
| Kode join | Tiket undangan masuk kelas |
| Lockout B3 | Salah kunci berkali-kali → loker terkunci sementara (15m→1j→24j) |
| AuditLog | Buku laporan satpam — tanpa mencatat rahasia |
| Saklar atomik | Satu tekan: lampu lama mati + lampu baru nyala barengan |
| Blok frozen | Bagian rencana yang sudah ditandatangani — haram diubah diam-diam |

---

## Metode & Temuan per Metode

### 1. Pre-mortem Analysis — "bayangkan rencana ini gagal total setahun lagi"
- **P1 — Jendela rollover:** saklar mematikan periode lama saat siswa masih mengerjakan kuis → attempt in-flight rusak. Belum ada aturan jendela waktu + drain check.
- **P2 — Kegagalan parsial:** saklar sukses tapi impor roster gagal → sekolah punya periode baru kosong. Recovery state parsial belum dirinci.
- **P3 — Typo NIS saat impor:** reuse by-NIS bisa menempel enrollment ke siswa yang salah → validasi NIS unik belum wajib di playbook.
- **P4 — Rollover tahun kedua:** idempotensi saklar belum teruji (test hanya sekali jalan).

### 2. Security Audit Personas — maling / satpam / auditor
- 🚨 **E7 (paling kritis):** cabang klaim ulang bisa mendarat di periode INACTIVE jika kode join rombel lama tersebar — menghidupkan kembali masalah "sesi periode lama" yang justru mau ditutup. Terverifikasi ke kode: validasi periode di `registerStudent` tidak menolak context periode INACTIVE.
- Pesan kegagalan klaim ulang belum dijamin satu bentuk (celah user-enumeration).
- DoS lockout: penyerang yang tahu NIS+nama bisa mengunci akun korban — trade-off perlu dinyatakan sadar.
- **Saklar periode tidak wajib ter-audit** — padahal event berdampak tertinggi di story ini.
- Sesi lama tidak dijamin di-invalidasi saat auto-login klaim ulang.

### 3. Boundary & Edge Case Sweep — cek pintu-pintu yang jarang dilewati
4 baris matriks I/O yang hilang:
1. Klaim ulang saat akun LOCKED (`lockedUntil` aktif)
2. PENDING ber-PIN submit kode join periode baru (semantik urutan cabang EC-11 belum jelas)
3. **Jalur mayoritas rollover:** guru impor dulu → siswa ACTIVE ber-PIN submit kode join → "login langsung" — apakah pesannya menjelaskan PIN lama tetap berlaku?
4. Race dua klaim ulang simultan (upsert `studentId_academicPeriodId`)

### 4. Assumption Audit — "kita anggap ini aman deh" diuji satu-satu
- **A2 (kritis):** ada **jalur KETIGA pen-set ACTIVE** yang lolos dari cakupan saklar — fallback pembuatan default-period hardcoded (`2024/2025`) di `classes.actions.ts`. Terverifikasi read-only ke kode.
- **A4:** return union `registerStudent` bertambah diskriminan baru, tapi **tidak ada task UI** untuk menanganinya di form pendaftaran.
- **A5:** fallback portal `classMemberships[0]` tanpa orderBy → urutan arbitrer untuk siswa yang belum enroll periode baru. Terverifikasi ke kode.
- A1 (PIN = bukti kepemilikan) — kuat berlapis, tapi trade-off DoS perlu dicatat; A3 (nol migrasi) — terverifikasi aman.

### 5. Second-Order Thinking — efek domino pasca-saklar
- **Approval PENDING L1 periode lama pasca-saklar:** disetujui → masuk periode INACTIVE? Perilaku lintas-rollover belum didefinisikan.
- Visibilitas historis parent portal pasca-saklar belum diasersi (N9 hanya menjamin alur hijau).
- Idempotensi & akumulasi tahunan — minor, dicatat.

---

## Rekap 11 Temuan (sesuai Review Triage Log)

| # | Temuan | Metode asal | Status |
|---|--------|-------------|--------|
| 1 | Klaim ulang bisa mendarat di periode INACTIVE | Boundary Sweep | ✅ Task gate periode target ACTIVE + RC-1 |
| 2 | Tidak ada task UI untuk respon klaim ulang baru | Assumption Audit | ✅ Task UI baru |
| 3 | Saklar periode tidak wajib ter-audit | Security Personas | ✅ Task audit + RC-2 |
| 4 | Jalur ketiga pen-set ACTIVE di luar cakupan saklar | Assumption Audit | ✅ Task cakupan + grep bukti |
| 5 | 4 baris matriks hilang (LOCKED, PENDING ber-PIN, approval lintas rollover, impor→login) | Boundary + Second-Order | ✅ RC-1 + task keputusan approval |
| 6 | Playbook belum memuat jendela rollover, drain check, recovery parsial, validasi NIS | Pre-mortem | ✅ Task playbook tambahan |
| 7 | Kegagalan klaim ulang belum anti-enumerasi | Security Personas | ✅ Task + RC-2 |
| 8 | Fallback portal urutan arbitrer | Assumption Audit | ✅ orderBy + Design Notes |
| 9 | Sesi lama tak di-invalidasi saat auto-login | Security Personas | ✅ Task + Design Notes |
| 10 | Idempotensi, race upsert, visibilitas parent belum teruji | Pre-mortem + Second-Order | ✅ Task test tambahan |
| 11 | DoS lockout belum dinyatakan sadar | Security Personas | ✅ Design Notes |

---

## Perubahan yang Diterapkan ke Story 6 (2026-09-23)

**Diedit langsung (non-frozen):**
- **Code Map** — 3 catatan elicitation (jalur ketiga ACTIVE, gate periode target + regenerasi sesi, fallback portal arbitrer) + scope playbook diperluas
- **Tasks & Acceptance** — 7 task baru + 3 Acceptance Criteria baru
- **Spec Change Log** — 1 entri elicitation pass
- **Review Triage Log** — terisi: 11 temuan × metode × tindakan
- **Design Notes** — 3 keputusan sadar baru (DoS lockout, fallback deterministik, invalidasi sesi)

**TIDAK diedit (frozen) — menunggu persetujuan manusia:**
- **RC-1**: 4 baris matriks I/O baru
- **RC-2**: 2 poin Always (anti-enumerasi; audit saklar)
- **RC-3**: penegasan Approach (klaim ulang hanya bila periode target ACTIVE)

Usulan frozen terdokumentasi di bagian `## Renegotiation Candidates` dalam dokumen Story 6. Blok frozen tetap utuh.

---

## Cara Verifikasi Elicitation Ini

- Klaim teknis dokumen dicek **read-only** ke kode sumber (`classes.actions.ts`, `student-auth.actions.ts`, `approvals.actions.ts`, `student-portal.actions.ts`) — semua referensi baris & formula (F1, F6, BH-14) akurat.
- Dokumen lain tidak disentuh; tidak ada kode yang diubah.

## STATUS PENUTUP (append 2026-09-23)

Semua langkah di atas telah tuntas: RC-1/RC-2/RC-3 **disetujui human** dan digabung ke blok frozen Story 6; keputusan approval PENDING lintas-rollover diputuskan (tetap sah, re-attachment via klaim ulang). Bagian "Renegotiation Candidates" di dokumen Story 6 telah dihapus karena tergabung — lihat Spec Change Log Story 6. Bagian "Langkah Berikutnya" di bawah adalah rekam jejak waktu penulisan dokumen ini, bukan kondisi terkini.

## Langkah Berikutnya (untuk manusia)

1. Review & setujui/tolak **RC-1, RC-2, RC-3** di dokumen Story 6 → jika disetujui, gabungkan ke blok frozen.
2. Putuskan perilaku approval PENDING lintas rollover (task khusus sudah ada di daftar tugas).
3. Setelah itu story siap masuk implementasi.
