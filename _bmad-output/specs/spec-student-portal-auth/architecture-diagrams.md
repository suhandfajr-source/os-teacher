# Diagram Arsitektur & Alur

## Alur Guru (§3.1)

```
Register (email+password) → Onboarding:
  [1] Cari Sekolah (nama/NPSN) → GABUNG (Mode Santai, langsung MEMBER aktif)
      ATAU buat baru → GERBANG DEDUP:
        a) NPSN sudah ada        → tolak create, tawarkan GABUNG
        b) normalizedName exact  → tolak create, tawarkan GABUNG
        c) kemiripan nama ≥85%   → konfirmasi "Maksud Anda?"
        d) lolos a–c             → create + OWNER (metadata)
  [2] Periode Akademik → [3] Mapel → [4] Rombel → TeachingContext
→ Dashboard guru: kode rombel, siswa pending, panel guru sekolah

Login harian: /login (email+password)
  • onboardingCompleted=false → resume /onboarding (sekolah tersimpan)
  • Lupa password → backstop reset oleh Superadmin (SMTP menyusul)
```

## Alur Siswa (§3.2)

```
Kode Rombel dari guru → kartu konfirmasi konteks (sekolah/rombel/TA/guru pembagi)
→ Form kilat: Nama + NIS + PIN 4-digit (normalisasi NIS: trim/uppercase)
   (a) NIS ada & nama cocok   → ACTIVE  ⭐ L0 otomatis
   (b) NIS ada & nama beda    → PENDING L1 + catatan mismatch (guru memutuskan)
   (c) NIS baru               → PENDING L1 (approve pengampu rombel)
   (d) sudah di rombel lain periode aktif → TOLAK + pesan "minta guru pindahkan"

Login harian: /siswa → Sekolah (tersimpan) + NIS + PIN
  • Rate-limit (B3, storage persisten): per-akun 5x salah → 15 mnt, eskalasi 15m→1j→24j; plus limiter per-IP+sekolah
  • Pesan error generik "NIS atau PIN salah" (anti-enumerasi, timing seragam)
  • Lupa PIN → reset HANYA oleh pengampu rombel aktif atau Superadmin (B2)

State machine: (row tanpa PIN) ──klaim L0──► ACTIVE
               (daftar baru) ──► PENDING ──approve L1/L2/L3──► ACTIVE
                                    └──reject──► REJECTED (boleh coba kode baru)
Rollover TA: impor ulang roster → klaim ulang L0 ATAU kode rombel baru; NIS & PIN tetap.
```

## Superadmin (`/admin/*`) (§3.3)

Platform-scope, **backstop bukan gerbang harian**, seeded via script internal dari env allowlist, semua aksi tercatat `AuditLog`. Kuasa eksklusif: force approve/reject siswa pending, ban akun guru, **reset password guru**, nonaktifkan sekolah.

## Dashboard Beranda Portal Siswa (§4.1, mobile-first, Bottom Nav 5 item)

```
┌─────────────────────────────────────┐
│  Hai, Ahmad! 👋           [🔔] [⋮]  │
│  Rombel 8-B • SMPN 1 Madani         │
├─────────────────────────────────────┤
│  ⚡ HARI INI — 3 PELAJARAN          │
│  │ 07.30 IPA — Lab Sains       ✅   │
│  │ 09.15 MTK — R.12          🔴 LIVE│
│  │ 11.00 B. Indonesia         ⏳    │
│                                     │
│  ⏰ PERLU DIPERHATIKAN              │
│  📝 Kuis IPA berakhir malam 21.00   │
│  📚 Tugas Aljabar: sisa 2 hari      │
│                                     │
│  🌱 KETUNTASAN: 12/18 TP ✅  (G2+)  │
├─────────────────────────────────────┤
│ [🏠][🎒 Kelas][📝 Tugas][📊 Nilai][👤]│
└─────────────────────────────────────┘
```

**Aturan informasi bertingkat:** *sekarang* (jam ini) → *mendesak* (deadline ≤3 hari) → *capaian* (ketuntasan). Kuis akses ≤2 ketukan dari beranda. Tombol Keluar menonjol (skenario komputer lab bersama).
