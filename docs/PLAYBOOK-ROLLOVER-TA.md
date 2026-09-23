# Playbook Rollover Tahun Ajaran (TA) — KLASSA

> **Audiens:** Guru / Admin sekolah pengguna KLASSA.
> **Tujuan:** Pindah buku besar dari tahun ajaran lama ke tahun ajaran baru **tanpa kehilangan identitas siswa** — NIS & PIN siswa tetap dipakai (CAP-8).
> **Prinsip:** Hanya boleh ada **SATU periode akademik ACTIVE** per sekolah. Seluruh langkah di bawah dirancang menjaga invariant itu.

---

## 0. Kapan Rollover Dilakukan & Siapa yang Menjalankan

| Kondisi | Penjelasan |
|---|---|
| **Kapan** | Akhir semester/tahun ajaran, saat nilai & presensi periode berjalan sudah tuntas (tidak ada kuis berjalan — lihat Langkah 2). |
| **Siapa** | Guru yang membuat rombel baru (pemegang akses buat kelas). Saklar periode berlaku **school-wide**: membuat rombel dengan tahun ajaran/semester baru otomatis menutup periode ACTIVE lama. |
| **Durasi** | ± 30–60 menit untuk satu sekolah (tergantung jumlah rombel & siswa). |

**Yang otomatis terjadi saat saklar (tidak perlu tindakan manual):**
- Periode baru dibuat berstatus ACTIVE; **semua periode ACTIVE lain sekolah otomatis menjadi INACTIVE** dalam satu transaksi.
- Event saklar tercatat di AuditLog (aktor, jumlah periode yang ditutup, sumber aksi).

---

## 1. Langkah 0 — Persiapan & Komunikasi

1. Pastikan seluruh guru sekolah tahu jadwal rollover.
2. Unduh/arsipkan laporan yang masih dibutuhkan dari periode lama (leger, rapor) — data historis tetap tersimpan, tetapi portal hanya menampilkan data periode aktif.
3. Siapkan daftar rombel baru per semester/tahun (nama kelas, tingkat, pengampu, mapel).

---

## 2. Langkah 1 — ⚠️ N8: Isi NIS Siswa yang Belum Ber-NIS (WAJIB SEBELUM KLAIM ULANG)

> **Siswa tanpa NIS tidak punya jalur klaim.** Klaim ulang (dan login) bermuara pada NIS; siswa imporan tanpa NIS tidak akan bisa mengakun-kan dirinya di periode baru.

1. Buka daftar siswa (menu **Siswa**) → filter/inspeksi siswa dengan kolom NIS kosong.
2. Isi NIS setiap siswa (menu edit siswa). NIS distandarkan otomatis (trim + huruf besar) dan harus **unik per sekolah**.
3. Jika menemukan **duplikat NIS** saat mengisi → hentikan, putuskan NIS yang benar, perbaiki sebelum lanjut. Duplikat membuat pemetaan impor ambigu.
4. Simpan daftar NIS final — akan dipakai siswa untuk login/klaim di periode baru.

---

## 3. Langkah 2 — Drain Check: Pastikan Tidak Ada Kuis Berjalan

Saklar periode mematikan periode lama. Attempt kuis yang sedang berjalan (LIVE) di periode lama akan terputus dari jadwal aktif.

1. Buka menu kuis per kelas; pastikan **tidak ada kuis berstatus LIVE** dan tidak ada siswa sedang mengerjakan.
2. Jika ada: tunggu selesai / tutup deadline kuis tersebut **sebelum** melanjutkan.

---

## 4. Langkah 3 — Saklar Periode (Buat Rombel TA Baru)

1. Masuk menu **Kelas** → **Buat Kelas**.
2. Isi nama kelas, lalu pilih **tahun ajaran & semester BARU** (mis. `2026/2027` — `Semester Genap`).
3. Simpan. Sistem akan:
   - membuat periode baru berstatus **ACTIVE** (atau menghidupkan ulang periode yang sudah pernah ada dengan tahun/semester tersebut),
   - menutup (INACTIVE) semua periode ACTIVE lain di sekolah,
   - mencatat event saklar ke AuditLog.
4. Ulangi untuk semua rombel yang dibutuhkan di periode baru.

> **Catatan teknis:** Jika memilih periode eksplisit yang sudah ada (mode backfill historis), saklar **tidak** dijalankan — jalur ini untuk kebutuhan data lampau, bukan rollover.

---

## 5. Langkah 4 — Verifikasi Antar-Saklar & Impor (Recovery State Parsial)

Setelah saklar, sebelum impor roster:

| Cek | Hasil yang benar |
|---|---|
| Panel **Persetujuan** terbuka tanpa error | Tidak ada `MULTIPLE_ACTIVE_PERIODS` — pasti satu periode aktif |
| Portal siswa (uji 1 akun) | Data harian kosong/rombel belum terpasang — **wajar**, karena enrollment periode baru belum dibuat |
| Guru login & membuat konten | Berjalan normal, ter-scope periode baru |

> **Recovery parsial:** Jika proses berhenti di tengah (mis. saklar sukses tapi impor gagal), sekolah berada pada state yang aman: periode baru kosong menunggu isi. Ulangi Langkah 5 dari awal; tidak perlu rollback periode.

---

## 6. Langkah 5 — Impor Ulang Roster (Reuse by NIS)

1. Menu kelas periode baru → **Impor Siswa** (template Excel).
2. Kolom wajib: **Nama**; kolom **NIS sangat disarankan** (tanpa NIS, siswa tak punya jalur klaim — lihat Langkah 1).
3. Saat layar pratinjau:
   - Siswa dengan **NIS yang cocok** → otomatis dipakai-ulang (reuse): **identitas & PIN lama tetap**, hanya rombel periode baru yang ditautkan.
   - Siswa dengan **nama sama tapi NIS kosong/berbeda** → sistem meminta konfirmasi eksplisit. **Pilih reuse** hanya jika benar-benar siswa yang sama; salah menempel ke siswa lain = data nilai tercampur.
4. Selesaikan impor per rombel.

---

## 7. Langkah 6 — Distribusi Kode Join & Instruksi ke Siswa

Bagikan ke tiap siswa: **kode join rombel baru**, NIS, dan pesan:

> "Login seperti biasa dengan **NIS + PIN lama** di portal siswa. Kalau kamu belum pernah bikin akun, daftar pakai kode join ini."

**Perilaku sistem per kondisi siswa (matriks):**

| Kondisi siswa | Apa yang terjadi |
|---|---|
| Sudah punya akun (ACTIVE + PIN), diimpor via roster | Langsung **login NIS + PIN lama** → masuk rombel baru. Submit kode join tidak diperlukan. |
| Sudah punya akun, TIDAK diimpor (jalur mandiri) | Submit **kode join rombel baru** + NIS + nama (harus persis data sekolah) + **PIN lama** → langsung ACTIVE di rombel baru. |
| Nama yang diketik berbeda dari data sekolah | Masuk antrean **persetujuan guru** (L1) untuk verifikasi identitas. |
| Belum pernah punya akun (row imporan tanpa PIN) | Daftar via kode join + NIS + nama persis → aktif otomatis (klaim L0). |
| Akun pernah ditolak (REJECTED) | Daftar ulang via kode join + NIS + **PIN lama** sebagai bukti; menunggu persetujuan guru. Lupa PIN? Minta guru meng-reset PIN. |
| Salah PIN berulang | 5x salah → akun terkunci 15 menit (berikutnya 1 jam, 24 jam). Diamkan / minta guru reset PIN. |
| **Tanpa NIS** | **Tidak punya jalur klaim** — kembali ke Langkah 1 (guru isi NIS dulu). |
| Sudah terdaftar di rombel lain periode aktif | Kode join ditolak — perpindahan rombel hanya lewat guru (panel persetujuan). |
| Menerima kode join rombel periode LAMA | Ditolak — minta kode join rombel periode aktif dari guru. |

---

## 8. Langkah 7 — Checklist Verifikasi Pasca-Rollover

- [ ] Panel **Persetujuan** terbuka tanpa error (satu periode aktif).
- [ ] Dashboard guru menampilkan rombel periode baru.
- [ ] Uji 1 siswa jalur impor: login NIS+PIN lama → dashboard rombel baru muncul.
- [ ] Uji 1 siswa jalur klaim ulang: kode join + PIN lama → langsung aktif.
- [ ] Uji 1 siswa baru: daftar via kode join → masuk antrean persetujuan → guru approve → login sukses.
- [ ] Kuis uji coba dibuat & dikerjakan 1 siswa → nilai muncul di leger guru.
- [ ] AuditLog (superadmin) memuat event `ACADEMIC_PERIOD_SWITCHED`.

---

## 9. Rollback

Rollover **tidak destruktif** — data periode lama tidak dihapus:

1. Salah saklar (periode baru keliru)? Minta superadmin memperbaiki status periode di database, atau buat rombel dengan kombinasi tahun/semester yang benar (saklar akan memindahkan status ACTIVE ke periode yang benar).
2. Siswa salah menempel rombel? Gunakan panel persetujuan (pindah rombel) atau koreksi impor.
3. Pinjaman data (nilai/presensi) periode lama tetap utuh dan dapat diekspor kapan pun.

---

## 10. Lampiran Teknis — Jalur yang Mengubah Status Periode (untuk Auditor)

| Jalur | Saklar + Audit? | Keterangan |
|---|---|---|
| Buat kelas dengan tahun ajaran & semester baru | ✅ | Jalur rollover utama |
| Buat kelas pada kombinasi tahun/semester yang sudah ada (reuse, sebelumnya non-aktif) | ✅ | Dihidupkan ulang + tutup yang lain |
| Buat kelas tanpa periode & sekolah tanpa periode aktif | ✅ | Fallback default-period + audit |
| Buat kelas dengan memilih periode eksplisit | ❌ (disengaja) | Semantik backfill historis — tidak mengubah status apa pun |
