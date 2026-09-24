# Sunset Portal Orang Tua (`/parent/*`)

Tanggal: 2026-09-24 · Disetujui human (obrolan pasca-story 8)

## Keputusan

1. **Portal ortu dihapus total** — fungsinya digantikan Mode Keluarga di portal siswa (story 8). Hanya ada satu pintu: portal siswa.
2. **Gap fitur dimigrasikan dulu ke Mode Keluarga**: (a) rincian penilaian per mapel, (b) aktivitas belajar per sesi — via `getStudentFamilyDetailAction` (baru).
3. **Tabel database DIPERTAHANKAN** (ParentProfile, ParentStudentRelation, ParentInvitation, ParentTeachingAccess) — konsisten track record nol-drop; drop bisa jadi migrasi terpisah kelak bila yakin tak ada data berharga.

## Yang dihapus

- `src/app/parent/**` (8 halaman: login/register/undangan/anak/konteks)
- `src/app/(dashboard)/kelas/[teachingContextId]/orang-tua/**` (tab manajemen akses guru)
- `src/modules/parent/**` (service/actions/types/utils + 2 suite test, 40 test)
- `tests/stage08-parent-portal.spec.ts` (e2e)
- Helper otorisasi parent di `src/lib/authorization.ts` (verifyParentSession/StudentRelation/TeachingAccess — jadi dead code)
- Tab "Akses Orang Tua" di KelasTabs; link "Portal Orang Tua" di layout auth; smoke mobile `/parent/login` di stage10 e2e
- Test F7 & VG-1/F7 (layanan baca parent fail-closed) di story5-session-guards — menguji helper yang dihapus

## Yang dipertahankan (disengaja)

- **Tabel + relasi Prisma** — data historis aman; `session-guards.ts` tetap memvalidasi persona parent (G-5, sekolah nonaktif → deny) sebagai pertahanan untuk sesi ortu lama yang masih hidup
- **Pembersihan tabel parent saat deaktivasi sekolah** di `admin.actions.ts` (masih benar selama tabel ada; teruji story-5)
- Test e2e stage10 #7 (otorisasi kontekstual Binding Amendment 5) & #8 (privasi data) — murni semantik in-memory, tetap valid untuk model data

## Adaptasi

- `story-6-rollover.int.test.ts`: asersi bacaan historis parent kini via query langsung `parentTeachingAccess` (kontrak rollover tak menghapus akses tetap terpin)
- Redirect: `/parent` & `/parent/:path*` → `/portal-siswa` (next.config.ts, non-permanent) — tautan undangan lama mendarat aman
- Mode Keluarga + `getStudentFamilyDetailAction`: kontrak query meniru `getParentContextDetail` (Assessment COMPLETED + result GRADED = nilai FINAL; sesi COMPLETED dengan bukti partisipan — Binding Amendment 6)

## Verifikasi

- `tsc` bersih; `eslint` bersih; `npm test` 68 file / 760 test hijau (3 test baru: penilaian/aktivitas/tanpa sesi)
- `npm run build` hijau; route `/parent/*` hilang dari output build

## Nilai

- −1.357+ baris kode permukaan ortu (8 halaman + modul + 2 suite) yang harus diamankan & dirawat paralel
- Satu sumber kebenaran pantauan ortu = Mode Keluarga
- Ditunggu keluhan lapangan: bila ortu butuh akses mandiri tanpa HP anak, itu sinyal story baru (bukan menghidupkan ulang portal lama)
