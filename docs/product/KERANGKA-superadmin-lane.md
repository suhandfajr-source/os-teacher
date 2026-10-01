# Kerangka: Jalur Terpisah Superadmin (Single-Admin Lane)

> Status: **DIIMPLEMENTASIKAN 2026-09-25** (akun suhandfajr5 sudah `PLATFORM_SEED` via --adopt; migrasi `user_registration_origin`; 766 tes hijau)
> Penulis: 2026-09-24, pasca-pembuatan akun superadmin pertama.

---

## 1. Alur Sekarang (dan kenapa harus ganti)

### Register guru (jalan saat ini)
```
/register (publik, siapa saja)
  → better-auth sign-up → User biasa (role "user", platformRole "USER")
  → login → /dashboard → wizard onboarding
      → completeTeacherOnboarding() membuat TeacherProfile + Sekolah + Kelas
  → (persetujuan guru oleh superadmin di /admin)
```

### Superadmin (jalan saat ini)
```
.env: SUPERADMIN_EMAILS=... (allowlist)
  → daftar dulu via pintu publik yang SAMA dengan guru  ← masalah
  → set emailVerified manual
  → npm run seed:superadmin → promosikan akun → platformRole ADMIN
```

### Empat celah
| # | Celah | Dampak |
|---|-------|--------|
| C1 | Seeder tidak peduli akun itu guru — akun **ber-TeacherProfile bisa dipromosikan** jadi superadmin | Guru bisa jadi superadmin ← yang kamu larang |
| C2 | Akun superadmin **lahir dari pintu publik** (`/register` / API signup) — tidak ada pemisahan identitas sejak lahir | Identitas admin = identitas pendaftar biasa |
| C3 | Email dalam allowlist **tidak di-reserve** di `/register` | Orang lain bisa mendaftarkan emailmu duluan (squatting) |
| C4 | Superadmin **bisa ikut onboarding guru** (jadi hibrida admin+guru) | Batas lane kabur |

## 2. Invariant Baru

- **I1 — Lahir dari seeder saja.** Superadmin hanya diciptakan lewat `SUPERADMIN_EMAILS` + seeder (bootstrap env). Tidak pernah dari `/register`.
- **I2 — Guru tidak pernah naik.** Akun yang dibuat via pintu publik (`registrationOrigin = PUBLIC_REGISTER`) **tidak bisa dipromosikan** — seeder abort, nol baris berubah. Termasuk akun guru (ber-TeacherProfile) maupun akun publik tanpa profil.
- **I3 — Email reserved.** Email yang terdaftar di `SUPERADMIN_EMAILS` ditolak di `/register` dan API signup (pesan jelas, tidak membocorkan daftar).
- **I4 — Lane terpisah penuh.**
  - Superadmin: login → **`/admin`** (bukan `/dashboard`), tidak bisa masuk onboarding/jalur guru.
  - Guru: tidak bisa masuk `/admin` (sudah ada — `requireSuperAdmin`, dipertahankan).
- **I5 — Satu superadmin: kamu.** Allowlist berisi tepat **1 email** (`suhandfajr5@gmail.com`). Kode tetap mendukung multi-email untuk DR, tapi tidak dipakai.

## 3. Desain Teknis

### 3.1 Skema (migrasi kecil)
```prisma
model User {
  // baru:
  registrationOrigin RegistrationOrigin?  // PUBLIC_REGISTER | PLATFORM_SEED
}
enum RegistrationOrigin { PUBLIC_REGISTER PLATFORM_SEED }
```
- User lama (semua) → `PUBLIC_REGISTER` (default via migrasi `UPDATE`).
- Seeder menulis `PLATFORM_SEED` untuk akun yang ia ciptakan/adopsi.

### 3.2 Seeder (`superadmin-seeder.ts` + CLI)
1. **Create-when-missing**: email allowlist tak ditemukan → **seeder yang membuat akunnya**
   - Nama dari argumen/env; password dari `SUPERADMIN_INITIAL_PASSWORD` env atau **prompt interaktif** (tidak pernah di-log)
   - Hash memakai helper better-auth (scrypt, konsisten dengan login)
   - `emailVerified: true`, `registrationOrigin: PLATFORM_SEED`, promote `platformRole ADMIN` + `role admin` — **satu transaksi + entri audit**
2. **Promote-existing hanya untuk `PLATFORM_SEED`**: akun `PUBLIC_REGISTER` → **SeedAbortError** (laporan drift tercetak, nol row) — menutup C1+C2.
3. Drift report ADMIN-di-luar-allowlist tetap (BH7, tidak auto-demosi).

### 3.3 Register / API signup
- Validasi di server action register **dan** hook `user.create.before` better-auth: email ∈ allowlist → tolak. Menutup C3.

### 3.4 Routing & guard pasca-login
- Redirect pasca-login: `platformRole = ADMIN` → `/admin`.
- Guard jalur guru (`onboarding`, `/kelas/**`, server action onboarding): tolak `platformRole ADMIN` → lempar `/admin`. Menutup C4.
- `/admin` tetap `requireSuperAdmin` (tanpa perubahan).

### 3.5 Migrasi akunmu (sekali jalan)
- Akun `suhandfajr5@gmail.com` hari ini dibuat via pintu publik → `PUBLIC_REGISTER`.
- Solusi: flag seeder **`--adopt <email>`** — set `origin = PLATFORM_SEED` hanya bila akun **belum punya TeacherProfile** (punyamu belum — belum onboarding) → transaksi + audit. Setelah adopsi, I2 mengunci permanen.

## 4. Test Matrix (int, gaya story lama)

| Skenario | Ekspektasi |
|---|---|
| Register dengan email allowlist | Ditolak (action + hook) |
| Seeder create-when-missing | Akun jadi, `sign-in` sukses dengan password bootstrap |
| Seeder + akun PUBLIC_REGISTER | Abort, nol row, lapor |
| Seeder + akun ber-TeacherProfile | Abort, nol row |
| `--adopt` akun bersih | origin berubah, ter-audit |
| `--adopt` akun guru | Abort |
| Login ADMIN → redirect `/admin` | Ya |
| ADMIN buka onboarding | Ditolak → `/admin` |
| Guru buka `/admin` | Ditolak (regresi story 5 tetap hijau) |

## 5. Out of Scope
- Multi-superadmin / undang admin / UI kelola allowlist / 2FA.

## 6. Urutan Implementasi
1. Migrasi skema `registrationOrigin` (default user lama → PUBLIC_REGISTER)
2. Seeder `--adopt` → jalankan untuk akunmu
3. Seeder create-when-missing + gate origin (I1+I2)
4. Tolak email reserved di register/signup (I3)
5. Redirect & guard lane (I4)
6. Tests + update `docs/CHECKLIST-FITUR.md` (bagian Superadmin)

---

**Konfirmasi yang kubutuhkan sebelum eksekusi:**
- [ ] Setuju password superadmin = yang sekarang (tidak diubah)?
- [ ] `--adopt` untuk akun `suhandfajr5@gmail.com` (belum ber-TeacherProfile, aman)?
- [ ] Urutan 1–6 di atas?
