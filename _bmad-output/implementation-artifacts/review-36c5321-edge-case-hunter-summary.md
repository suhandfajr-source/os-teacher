# Ringkasan Review: Edge Case Hunter — Portal Siswa Auth & Student Status Tracking

**Sumber diff:** `review-36c5321-edge-case-hunter-prompt.md`
**Commit:** `feat(portal-siswa): enhance student portal auth, approvals list, and teacher student status tracking`
**Cakupan:** 23 temuan (21 edge case, 1 deletion, 1 claim) — tanpa peringkat severity sesuai instruksi reviewer.

---

## Temuan Kritis (Keamanan / Blokir Fungsi)

### 1. Overwrite PIN tanpa verifikasi nama (account takeover) — `student-auth.actions.ts:684-700`
- Blok re-registration PENDING **tidak memverifikasi kecocokan nama** dengan pendaftar sebelumnya.
- Kombinasi dengan temuan #2 (roster publik): penyerang yang tahu NIS korban bisa menimpa `accessPinHash` korban saat status masih PENDING → menguasai akun setelah guru approve.
- **Fix:** guard `canonicalStudentName(existing) !== canonicalStudent(clean)` → tolak.

### 2. Kebocoran roster publik — `student-auth.actions.ts:54-79,106-113`
- `lookupJoinCode` sekarang mengembalikan **nama lengkap + NIS seluruh siswa aktif** tanpa autentikasi, tanpa rate-limit.
- **Fix:** jangan kirim `nis` di roster (client hanya butuh nama untuk dropdown), tambahkan rate-limit.

### 3. Siswa roster tanpa NIS tidak bisa daftar — `portal-siswa/page.tsx:164-176`
- `expectedNis` kosong → panjang default 4 → `regNis` tidak akan pernah sama dengan `""` → selalu MISMATCHED → **siswa tersebut permanen terblokir**.
- **Fix:** skip gate NIS bila roster NIS null.

### 4. Siswa di luar roster tidak bisa daftar — `portal-siswa/page.tsx:147-159,274-280`
- Client memaksa pilih nama dari roster; cabang server `NEW_STUDENT` jadi tidak terjangkau dari UI. Roster kosong = tidak ada yang bisa mendaftar.
- **Fix:** sediakan jalur input manual (name+NIS) saat roster kosong/tidak cocok.

### 5. False-positive konflik tanggal lahir — `student-auth.actions.ts:686-690`
- Perbandingan string eksak `cleanBirthDate === existingStudent.birthDate`; format campuran (DD/MM/YYYY vs YYYY-MM-DD dari `<input type="date">`) dianggap konflik padahal tanggal sama.
- **Fix:** normalisasi format sebelum bandingkan.

### 6. birthDate null menimpa data lama — `student-auth.actions.ts:757-775`
- Skenario (a) selalu set `birthDate: cleanBirthDate` — bila null (parameter opsional di API), **menghapus birthDate yang sudah ada** dan me-reset flag konflik.
- **Fix:** conditional spread, hanya set bila ada nilai.

---

## Temuan Fungsional / Logika

| # | Lokasi | Masalah | Dampak |
|---|--------|---------|--------|
| 7 | `approvals.actions.ts:215-230` | Filter OR baru mengizinkan PENDING dengan `accountRequestedAt` null (pin-only) | Matematika eskalasi terima null → NaN/TypeError di panel |
| 8 | `classes.actions.ts:122-136` | Loop 10 percobaan kode habis → `joinCode: null` diam-diam | Kelas dibuat tanpa kode rombel |
| 9 | `classes.actions.ts:129-140` | Race TOCTOU: `findUnique` → `create` tanpa catch P2002 | Kreasi kelas konkuren gagal 500 |
| 10 | `portal-siswa/page.tsx` (checkbox rememberMe) | State tidak pernah dipakai | Checkbox no-op, janji UI palsu |
| 11 | `portal-siswa/page.tsx` (onChange nama) | Ganti pilihan siswa tidak reset `regBirthDate`/`regPin` | Siswa B terdaftar pakai birthDate/PIN siswa A |
| 12 | `portal-siswa/page.tsx` (dropdown nama) | Tidak ada blur/outside-click/Esc handler | Dropdown tak pernah tertutup; Enter submit form |
| 13 | `siswa/[studentId]/page.tsx:130-143` | `REJECTED` & PENDING-tanpa-PIN jatuh ke label "Belum Registrasi" | Label menyesatkan guru |
| 14 | `SiswaListClient.tsx:70-74` | Stat card hitung `allStudents` tanpa dedup | Siswa multi-kelas terhitung ganda ≠ Total |
| 15 | `KelasOverviewClient.tsx:239-255` | `joinCodeLocked` tidak dicek saat menampilkan kode | Guru menyalin kode terkunci yang tak berfungsi |

## Temuan Clipboard & DOM

| # | Lokasi | Masalah | Dampak |
|---|--------|---------|--------|
| 16 | `KelasOverviewClient.tsx:241-247` | `navigator.clipboard` undefined (HTTP) / `writeText` reject tak di-guard | TypeError saat klik, tidak tersalin |
| 17 | `RuangMengajarClient.tsx:170-182` | Idem | Idem |
| 18 | `KelasOverviewClient.tsx:239-251` | `<button>` nested dalam `<Link>` (anchor) | Nesting DOM invalid → risiko hydration mismatch |

## Temuan Kode Mati / Lint

| # | Lokasi | Masalah |
|---|--------|---------|
| 19 | `(auth)/layout.tsx:5` | Import `ShieldCheck` tanpa pemakaian |
| 20 | `(auth)/login/page.tsx:10` | Import `GraduationCap` tanpa pemakaian |
| 21 | `student-auth.actions.ts:206-220` | `verifyStudentIdentity` tidak pernah dipanggil client; pesan "aktivasi otomatis" kontradiksi dengan flow PENDING baru |
| 22 | `admin/layout.tsx:3` (deletion) | Pemakaian `ShieldCheck` dihapus tapi import tersisa — orphaned import (confidence: medium) |

## Temuan Claim (Kind: claim, confidence: high)

**#23** — Narasi user: *"guru juga memiliki akses untuk melihat, **mengedit**, dan **menghapus** akses siswa"*.
- Diff hanya mengimplementasikan: **lihat** (status badge, filter, detail) + approve/reject.
- **Tidak ada** action edit akses (reset PIN, ubah status) maupun hapus akses (revoke).
- **Fix:** tambahkan `resetStudentAccess` / `revokeStudentAccess` server action + kontrol UI di halaman detail siswa.

---

## Prioritas Perbaikan yang Disarankan

1. **Segera:** #1 + #2 (rantai account takeover: roster publik → NIS → timpa PIN).
2. **Segera:** #3, #4 (siswa tertentu/kosong tidak bisa mendaftar sama sekali).
3. **Penting:** #5, #6, #7 (integritas data verifikasi tanggal lahir & panel approval).
4. **Bug UI:** #10–#18.
5. **Hygiene:** #19–#22, lalu #23 (gap requirement edit/hapus akses).
