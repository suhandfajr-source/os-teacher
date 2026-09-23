# Final Security Review — Story 6 & Penutupan spec-student-portal-auth (Tahap 6)

**Tanggal:** 2026-09-23
**Baseline:** `4f9f870` · **Reviewer:** Build agent Story 6 (forensic, evidence-based)
**Ruang lingkup:** Seluruh CAP-1..8 (Stories 1–6), Amendum Keamanan B1–B5, Penguatan N1–N9.
**Verdict: LOLOS** — tidak ada temuan blocking baru; seluruh kontrak keamanan terbukti oleh test otomatis (744/744 hijau, termasuk 18 test rollover real-db).
**Review independen:** lapisan blind-hunter, edge-case-hunter, dan verification-gap (artefak `review-6-*`) meninjau diff ini; temuan keamanan relevan (gate periode nondeterministik, race stale-hash vs reset PIN, bypass N5 via cabang update upsert, siswa archived, collapse kanonik nama) telah diverifikasi dan diperbaiki — lihat §9.

---

## 1. Bukti Eksekusi (Commands)

| Perintah | Hasil |
|---|---|
| `npm run verify:migrations` | ✅ exit 0 — "Migration chain matches schema.prisma perfectly. No drift detected." |
| `npx tsc --noEmit` | ✅ 0 error |
| `npx vitest run` (penuh) | ✅ **744/744** test hijau, 65 file (termasuk `story-6-rollover.int.test.ts` — 18 test real-db: A1–A6, B1–B12) |
| `npx eslint` (file tersentuh) | 36 problems = **identik baseline `4f9f870`** (diverifikasi via `git stash` → lint → `git stash pop`); **nol utang lint baru** dari Story 6. Sisa pelanggaran pra-existing: `no-explicit-any` pada file test unit (konvensi file) + `student: any` pada union type lama + 1 warning unused-var lama. |

## 2. Verifikasi Invariant Keamanan per Amendum

### B1 — Identitas quiz dari sesi server
- Signature `startQuizAttemptAction` TIDAK diubah (kontrak frozen Story 4/6). Varian `FromSession` tetap satu-satunya jalur portal. ✅ (regresi: 740 test hijau termasuk suite Story 4).

### B2 — Reset PIN terbatas pengampu
- Tidak tersentuh Story 6; regresi terlindungi suite Story 5 (positif/negatif kuasa). ✅

### B3 — Limiter persisten + lockout berlapis
- **Cabang klaim ulang baru (Story 6) mengikuti B3 penuh:**
  - `failedAttempts`/`lockedUntil` di DB — bukan in-memory. Test: 5x PIN salah → `lockedUntil` ≈15 menit (asersi 10–15 mnt), attempt saat LOCKED → **nol mutasi tambahan** (`failedAttempts` tetap 5), pesan generik, ter-audit (`STUDENT_RECLAIM_DENIED`/`LOCKED`).
  - Eskalasi formula identik `loginStudent` (15m→1j→24j, kode F6).
  - **Anti user-enumeration (RC-2):** semua kegagalan klaim (PIN salah & LOCKED) satu string pesan identik — di-assert equality di test B2.
- Timing: jalur klaim selalu menjalankan `verifyPin` riil (row ditemukan ber-hash), tanpa cabang cepat. ✅

### B4 — Fail-fast secret & cookie sesi
- Tidak ada perubahan konfigurasi secret/cookie. Rotasi `pinUpdatedAt` pada klaim ulang membuat token lama (ber-pinUpdatedAt lama) gagal `verifyStudentSession` — di-assert di test B1. **Tidak ada sesi ganda lintas periode.** ✅

### B5 — Siklus hidup sesi & aksi superadmin
- Tidak tersentuh Story 6; regresi terlindungi suite Story 5 (real-plugin ban/reset/revoke). ✅

## 3. Invariant Periode Akademik (§9.4 — akar `MULTIPLE_ACTIVE_PERIODS`)

**Bukti cakupan jalur pen-set ACTIVE (grep `status: "ACTIVE"` non-test, seluruh src):**

| # | Lokasi | Saklar + Audit? |
|---|---|---|
| 1 | `src/modules/classes/classes.actions.ts:148` (create periode baru) | ✅ `updateMany` tutup lain + `ACADEMIC_PERIOD_SWITCHED` (source `new_period`) |
| 2 | `src/modules/classes/classes.actions.ts:168` (reactivate reuse non-aktif) | ✅ idem (source `reuse_inactive`) |
| 3 | `src/modules/classes/classes.actions.ts:206` (fallback default-period) | ✅ idem (source `fallback_default`) — jalur ketiga hasil elicitation, tertutup |
| 4 | Jalur `academicPeriodId` eksplisit | ❌ disengaja (Never list — semantik backfill), **tidak mengubah status apa pun** — di-assert test A4 |

- Invariant "tepat satu ACTIVE" di-assert di test A1 (post-saklar), A2 (rollover tahun kedua — idempoten), A3 (reuse + tutup manual-ACTIVE lain).
- Event saklar ter-audit dengan `redactMetadata()` — metadata hanya berisi year/semester/source/closedActivePeriods/schoolId (tanpa secret), di-assert di A1/A3/A5.

## 4. Klaim Ulang Rollover (CAP-8) — Permukaan Serangan Diperiksa

| Vektor | Kontrol | Bukti test |
|---|---|---|
| Takeover akun ber-PIN tanpa kepemilikan | `verifyPin` wajib sebelum mutasi (preseden EC-11/G-1) | B1 (PIN benar), B2 (PIN salah → nol mutasi) |
| DoS lockout via NIS+nama semi-publik | Trade-off disadari (Design Notes); mitigasi = reset PIN oleh guru (jalur existing B2) | B2 (eskalasi bekerja) |
| Klaim mendarat di periode INACTIVE (kode join lama tersebar) | Gate `academicPeriod.status === "ACTIVE"` (RC-3) | B4 |
| Bypass kuasa pindah rombel (N5) | Klaim hanya bila belum enroll periode aktif; sisanya F1 statis | B6, B9 |
| Enumerasi status akun | Pesan statis identik untuk seluruh kegagalan klaim + F1 statis untuk PENDING ber-PIN | B2, B5 |
| Sesi stale lintas periode | `resolveStudentSessionMembership` prioritas periode ACTIVE; rotasi pinUpdatedAt | B8, B9, B1 |
| Race dua klaim simultan | Conditional update `updateMany` + guard `accountStatus ACTIVE` (F5), `count !== 1` → gagal generik | pola F5 (regresi Story 5) + upsert N5 |
| Sekolah nonaktif | Fail-closed F7 existing tidak tersentuh; regresi hijau | suite Story 5 |

## 5. AuditLog Hygiene

- Seluruh penulisan baru (saklar periode, klaim sukses/tertunda/ditolak) melalui `redactMetadata()` — tidak ada PIN/hash/secret di metadata (N4 invariant).
- Konvensi aktor konsisten: `USER`+userId untuk aksi guru, `STUDENT`+studentId untuk aksi siswa.

## 6. Regresi Nol (N9)

- `/q/[token]`, `/parent/*`, `/siswa/portal/*`, onboarding, panel member Story 2, panel persetujuan/admin Story 5: **seluruh 744 test hijau** — tidak ada perubahan pada modul quiz publik dan parent (diff Story 6: `classes.actions.ts`, `student-auth.actions.ts`, `student-session.ts`, test, docs; `student-portal.actions.ts` TIDAK berubah — orderBy fallback ternyata sudah ada di baseline `4f9f870`, dikoreksi pasca-review EC-9/BH-2).

## 7. Utang yang Dikenal (non-blocking)

1. Lint pra-existing pada file test unit (`no-explicit-any`) & 1 unused-var — bukan regresi Story 6; pembenahan lintas-file termasuk hygiene harness (preseden defer VG-Other-2).
2. `npm run build` (Turbopack) lokal Windows tetap gagal dengan isu pra-existing (CSS worker 0xc0000142 — dibuktikan di Story 5 juga terjadi pada baseline bersih); build deploy Linux/CI tidak terdampak. `npx playwright test` lokal terblokir isu yang sama — E2E dijalankan saat lingkungan sehat/CI (preseden catatan Story 5).
3. Story-4 test "isLive" flake time-of-day — sudah terdokumentasi di deferred-work (preseden Story 5), bukan regresi baru.

## 8b. Perbaikan Hasil Review Independen (2026-09-23)

| Temuan | Perbaikan | Test |
|---|---|---|
| Gate klaim nondeterministik (BH-5/EC-3 — `take:1` tanpa orderBy pada class multi-periode) | Resolusi deterministik: context periode ACTIVE diprioritaskan; semua cabang memakai periode target yang sama | A1–B12 (semua klaim lewat gate deterministik) |
| Race stale-hash vs reset PIN guru (EC-5) | `updateMany` where += `accessPinHash` terverifikasi + `status ACTIVE` — reset guru tak tertimpa; klaim kalah race gagal generik | B1 (positif); B2 (lockout) |
| Bypass N5 via cabang `update` upsert (EC-4) | `create` + tangkap P2002 → klaim kalah race gagal generik, enrollment existing tak tersentuh | B10 (race simultan) |
| Siswa archived bisa ter-klaim (EC-6) | Gate + conditional update menuntut `status === "ACTIVE"` | Gate dieksekusi di seluruh test klaim |
| Kanonik nama tanpa collapse (BH-4/EC-8) | `canonicalStudentName()` trim+collapse+lowercase di jalur klaim | B1 (input double-space match) |
| Dua saklar konkuren → dua ACTIVE (BH-7/EC-2) | `SELECT ... FOR UPDATE` pada row school di awal transaksi | (serialisasi; invariant di-assert A1/A2/A3/A6) |
| Remediasi legacy terlewat saat reuse periode sudah ACTIVE (EC-1) | Saklar selalu berjalan di jalur tahun-ajaran baru; source audit `reuse_active_remediation` | A6 |
| Pesan gate periode INACTIVE menyesatkan (EC-10) | Pesan khusus "Minta kode join rombel yang baru" (selaras playbook §7) | B4 |

## 8. Kesimpulan

DoD Tahap 6 terpenuhi: **playbook tertulis** (`docs/PLAYBOOK-ROLLOVER-TA.md`, termasuk langkah N8 pra-klaim), **klaim ulang dengan NIS & PIN lama teruji** (suite real-db), dan **review keamanan lolos** (dokumen ini) — tanpa temuan blocking baru terhadap CAP-1..8, B1–B5, N1–N9.
