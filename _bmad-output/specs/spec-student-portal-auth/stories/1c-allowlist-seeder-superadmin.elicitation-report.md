# Elicitation Report — Story 1c Allowlist & Seeder Superadmin (Analisis Menyeluruh)

> **Sesi:** BMad Advanced Elicitation · 2026-09-20
> **Target:** `1c-allowlist-seeder-superadmin.md`
> **Permintaan user:** analisis menyeluruh & mendalam + rekomendasi, terutama apakah story layak di-split.
> **Format:** pass terkonsolidasi **13 metode** — Map Is Not the Territory · First Principles · Problem Decomposition · Inversion · Steelmanning · Subtraction · Boundary & Edge Case Sweep · Failure Mode Analysis · Pre-mortem · Security Audit Personas · Second-Order Thinking · Assumption Audit · Critique & Refine — satu report, satu gerbang Apply (anti-bengkak token, ala sesi trio).
> **Ground truth diverifikasi langsung ke repo:** `vitest.config.ts`, `package.json` (+ `npm ls dotenv`), `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/__tests__/`, `src/modules/imports/__tests__/import.db-concurrency.test.ts`, better-auth 1.6.29 `sign-up.mjs`, resolusi `node_modules/dotenv`, Node v22.23.2, `scripts/` (create-shadow-db.js ada), `.env.example`, `stories.yaml`.
> **Jejak sebelumnya:** sesi trio 1a/1b/1c → `1a-1b-1c.elicitation-report.md`; sesi Story 1 utama (5 ronde) → `1-fondasi-database-primitif-keamanan.elicitation-report.md`.

---

## Ringkasan Eksekutif

Story 1c diaudit menyeluruh dengan fokus pertanyaan split. Hasil: **nol temuan 🔴** (setelah 3 ronde elicitation sebelumnya, tidak ada yang menggagalkan eksekusi), **4 temuan 🟡** — semuanya pengerasan 1–2 baris di bagian non-frozen — dan **6 temuan 🔵** presisi/kontrak. Ground truth membongkar **satu premis keliru** ("repo tanpa dotenv" — kenyataannya `vitest.config.ts` memuat `.env` via dotenv transitive/phantom) tanpa membatalkan fix C1 yang dijustify-nya. **Pertanyaan inti dijawab: split DITOLAK** — bukan karena tidak bisa (bisa, di satu sumbu), melainkan karena pipeline story sekuensial (`stories.yaml`: "Urutan = urutan list") mematikan nilai paralelisme, dan 1c adalah story terkecil di trio. Granularitas review yang dicari lewat split diperoleh gratis lewat **urutan commit 3 tahap**. Seluruh usulan (7 item + SCL) **di-Apply**; blok frozen terverifikasi identik byte-per-byte pasca-edit.

---

## Ground Truth (Map Is Not the Territory)

| Klaim di 1c | Realita repo | Status |
|---|---|---|
| `src/lib/auth.ts` :5,:23,:27 (Pool/PrismaPg/PrismaClient) | :5 import PrismaPg · :23 `new PrismaPg(pool)` · :27 `new PrismaClient(...)` | ✅ eksak |
| BH8: better-auth 1.6.29 `sign-up.mjs:165,222` lowercase untuk lookup & createUser | `:164` `normalizedEmail = email.toLowerCase()` → `:165` findUserByEmail · `:221–222` `createUser({email: normalizedEmail})` | ✅ terverifikasi |
| Prasyarat 1a merged | `schema.prisma:163` `platformRole` · `:923` `model AuditLog` (actorType SYSTEM ✓) · `:170` `@@unique([email])` | ✅ |
| Node v22.23.2 · tsx belum ada · `.env.example` tanpa `SUPERADMIN_EMAILS` (PIN_PEPPER 1b utuh) · `scripts/create-shadow-db.js` ada · file superadmin belum ada | Semua benar | ✅ |
| **"repo TANPA dotenv"** (Code Map, justifikasi C1) | `vitest.config.ts:1` = `import "dotenv/config"` — dotenv **transitive/phantom** (`dotenv@17.4.2` via `prisma→@prisma/config→c12` dan `shadcn→@dotenvx/dotenvx`); nol di manifest, terpakai nyata | 🟡 **F1 — premis keliru, kesimpulan (fix C1) tetap benar** |
| Test referensi "ala `import.db-concurrency.test.ts`" | File ada di **`src/modules/imports/__tests__/`** (bukan `src/lib/__tests__/`); guard = flag `dbAvailable` dari try/catch `beforeAll` (bukan skipIf); test itu benar-benar membuat row School/User di DB nyata via `prisma` dari `@/lib/auth` | 🔵 **F7** |
| "vitest hanya mengambil `src/**/*.test.ts`" | Include: `src/**/*.test.ts` **+ `src/**/*.spec.ts`**; exclude `tests/**` (Playwright E2E: smoke, stage01–05) | 🔵 presisi redaksi |

**Dampak positif tak terduga (F1):** karena vitest memuat `.env` via config, test integrasi BH12 **mewarisi `DATABASE_URL` gratis** — implementer tidak perlu (dan tidak boleh) menambah plumbing env di test.

---

## Temuan & Perbaikan yang Diterapkan

| # | Severity | Temuan | Perbaikan (semua di-Apply) |
|---|---|---|---|
| F1 | 🟡 | Premis "repo tanpa dotenv" keliru — phantom dotenv aktif di `vitest.config.ts:1`. Fix C1 (`--env-file-if-exists`) tetap benar untuk CLI, tapi rationale harus akurat & synergy .env-vitest dicatat (anti plumbing ganda di test). | Code Map (`package.json` bullet): premis dikoreksi; test integrasi dinyatakan mewarisi `DATABASE_URL` tanpa plumbing |
| F2 | 🟡 | Hard `process.exit(code)` berisiko **memotong stdout ter-pipe** (Windows/CI rawan) — padahal laporan adalah deliverable inti story ("laporan lengkap di stdout"). | Design Notes: `process.exitCode = code` + drain alami pasca `pool.end()`/`$disconnect()`; hard exit hanya fallback bila loop masih hidup |
| F3 | 🟡 | **Gerbang RT1 inert dalam praktik** — semua user `emailVerified=false` → tiap run nyata wajib `--allow-unverified` → perlindungan anti-perebutan tinggal penilaian manusia atas laporan. Second-order: habituation bypass. | Design Notes: laporan plan/drift menambah **sinyal akun** (platformRole saat ini, keberadaan TeacherProfile); bypass wajib meninggalkan `allowUnverified: true` di audit metadata + warning eksplisit di stdout (forensik + anti-habituation) |
| F4 | 🟡 | **Batas transaksi ambigu** — "validasi → apply dalam transaksi" tak menyebut apakah fase lookup di dalam tx yang sama (risiko TOCTOU antara plan dan apply); Prisma interactive tx default timeout **5 detik**. | Design Notes: lookup + UPDATE + insert audit dalam **SATU interactive transaction** + timeout eksplisit; edge concurrent-run (entri audit duplikat, state tetap konsisten) diterima sadar tanpa advisory lock |
| F5 | — | **Split** — lihat §Analisis Split. Verdict: ditolak; diganti urutan commit 3 tahap. | Implementation Notes (baru terisi): commit 1 primitif murni → commit 2 core+integrasi → commit 3 CLI+config |
| F6 | 🔵 | Kontrak parser tak presisi: collect-all vs fail-first ambigu; return shape tak didefinisikan; validator sinteks bebas interpretasi; env berkutip (CI YAML) tak terdokumentasi. | Design Notes Parser: **kumpulkan SEMUA entri invalid**, return `{emails: string[], invalid: string[]}`, validator dipatok (regex contoh diberikan), env berkutip = fail-fast terdokumentasi |
| F7 | 🔵 | Referensi test implikasinya salah path + pola guard tak disebut → implementer bisa mengarang pola skipIf baru. | Code Map + Design Notes: path asli `src/modules/imports/__tests__/import.db-concurrency.test.ts` + pola `dbAvailable`; include vitest dikoreksi |
| F8 | 🔵 | Run verification "tanpa env" tak membuktikan apa pun tentang flag `--env-file-if-exists` (env memang absen); asumsi tsx meneruskan flag node (conf. menengah-tinggi). | Verification: catatan C1 — dibuktikan oleh run env-valid; fallback `node --env-file-if-exists=.env --import tsx scripts/seed-superadmin.ts` |
| F9 | 🔵 | `mode:"insensitive"` pada Prisma 7 + driver adapter PrismaPg — seharusnya didukung, quirk kecil mungkin. | Dicatat di Verification/Design mindset fallback `LOWER()` raw (tidak diubah di file — risiko rendah, door criteria menangkap) |
| F10 | 🔵 | Exit code terdiferensiasi (2/3/4) untuk CI scripting. | **Sengaja TIDAK ditambahkan** (Subtraction): manfaat kecil, biaya kontrak nyata; story sudah ramping |

**Yang bertahan (strengths):** seluruh line-number Code Map eksak; BH8 terverifikasi langsung ke source better-auth; prasyarat 1a terkonfirmasi merged di schema; `--dry-run` + identitas DB target (blast-radius); idempotency teruji otomatis (BH12); pola guard DB-nyata sudah ada presedennya; TIDAK ADA yang bisa dibuang dari story (Subtraction: `--dry-run`, drift report BH7, `--allow-unverified`, redactMetadata semuanya memikul janji elicitation sebelumnya).

---

## Analisis Split (pertanyaan inti sesi)

**Seam dependensi riil (Problem Decomposition):**

```
parser (pure) ────────────┐
                          ├──> seeder core (DB: butuh 1a) ──> CLI + package.json + .env.example
redactMetadata (pure) ────┘    (dipakai core di jalur audit; konsumen lintas-story: Stories 3–5)
```

Hanya `redactMetadata` (BH6) punya konsumen lintas-story; parser & CLI murni melayani seeder.

**Tiga kandidat split:**

| Kandidat | Verdict | Alasan |
|---|---|---|
| A. Ekstrak BH6 `redactMetadata()` → story sendiri | ⚠️ satu-satunya yang defensible, tapi tetap ditolak | Non-frozen ✓ (BH6 hanya hidup di Code Map/Tasks/Design Notes), zero-dep DB ✓ — NAMU pipeline sekuensial membunuh nilai paralelnya, dan Stories 3–5 masih jauh (tak ada yang menunggu kontrak itu) |
| B. Parser split sendiri | ❌ | 2 baris Matriks I/O ada di **blok frozen** → renegosiasi frozen untuk modul ±30 baris; seeder tetap menunggu parser |
| C. CLI/ops split dari core | ❌ | CLI sengaja tipis (semua logika teruji dipindah ke core); menciptakan state antara tak-deployable; landmine C1/C2 justru harus diverifikasi bersama core |

**Steelman pro-split (kasus terkuat):** ekstrak `{parser + redactMetadata}` jadi story primitif murni → lane paralel, review unit-test terpisah dari integrasi DB, isolasi rework. **Rebuttal decisive:** `stories.yaml` menyatakan *"Urutan = urutan list"* — pipeline ini **sekuensial by convention** (1b paralel dengan 1a hanya karena dideklarasikan eksplisit). Wall-clock gain ≈ nol. Sisa nilai = isolasi review saja → instrumen gratis untuk itu adalah **urutan commit**.

**Inversion (apa yang menjamin split gagal):** (1) memecah di seam yang bukan batas dependensi; (2) dua story berbagi satu AC; (3) merenegosiasi frozen. B melanggar (3); C melanggar (1)+(2); A lolos ketiganya tapi kalah pada cost-benefit.

### VERDICT

> **JANGAN split 1c.** Story terkecil di trio (11,2 KB pra-sesi ini, 8 task, ±1 sesi dev), satu vertical slice utuh, nol 🔴. Pengganti split: **urutan commit 3 taham** — commit 1 = primitif murni (`audit-metadata.ts` + `superadmin-allowlist.ts` + unit test) → commit 2 = core seeder + test integrasi → commit 3 = CLI + `package.json` + `.env.example`. Granularitas review tanpa biaya governan (file story baru, entri stories.yaml, SCL, prasyarat) dan tanpa menyentuh frozen. **Pengecualian sah** bila kelak perlu merge kontrak audit sebelum 1c selesai: ekstrak BH6 saat itu, bukan sekarang.

---

## Subtraction & Second-Order

- **Subtraction: nol yang bisa dibuang.** Semua elemen memikul janji elicitation sebelumnya. F10 (exit codes terdiferensiasi) ditolak secara sadar demi keringkasan kontrak.
- **Second-order paling material = F3:** bypass yang jadi rutin mematung kanal pengamanan → mitigasi jejak audit (`allowUnverified:true`) + warning, bukan menahan flag.
- **Kaskade aman:** audit insert di dalam tx yang sama dengan promosi → tidak pernah ada promosi tanpa audit (kini eksplisit via F4).

## Assumption Audit (yang terlemah)

| Asumsi | Conf. | Jika salah |
|---|---|---|
| tsx meneruskan `--env-file-if-exists` ke runtime node | menengah-tinggi | Terlihat di run env-valid (F8); fallback `node --import tsx` terdokumentasi |
| `mode:"insensitive"` OK di Prisma 7 + PrismaPg | tinggi | Fallback `LOWER()` raw (F9) |
| Baseline 520/520 (tidak dijalankan ulang sesi ini) | tinggi (dibawa report trio) | Door criteria sendiri menangkap |
| Phantom dotenv tetap terhoisting | tinggi (2 jalur transitive) | Merusak 44 file test merata — bukan scope 1c, hanya dicatat |

---

## Dampak Kumulatif

| File | Perubahan | Ukuran |
|---|---|---|
| `1c-allowlist-seeder-superadmin.md` | 10 blok diedit (30 insertions, 10 deletions, 3 hunk): F1–F8 + Implementation Notes terisi + 1 entri SCL | 11,2 KB → **14,9 KB** |

**Integritas frozen:** blok `frozen-after-approval` (Intent → Matriks I/O) terverifikasi **identik byte-per-byte** terhadap HEAD pasca-Apply (`sed`-extract + `diff`). Seluruh perubahan berada di Code Map / Design Notes / Implementation Notes / Verification / SCL — semua non-frozen.

## Status Story 1c

| Aspek | Status |
|---|---|
| Kesiapan eksekusi | ✅ siap dieksekusi (nol 🔴; prasyarat 1a merged terverifikasi di schema) |
| Split | ❌ ditolak — diganti urutan commit 3 tahap (Implementation Notes) |
| Temuan paling mahal yang dicegah sesi ini | Laporan stdout terpotong di CI (F2) · promosi tanpa jejak audit saat bypass (F3) · TOCTOU plan-vs-apply (F4) · plumbing env ganda di test (F1) |

## Utang Amendum Tercatat (tidak berubah)

1. Hash PIN quiz plaintext (`QuizStudentAccess.pin`, `Quiz.classroomPin`).
2. Penegakan DB-level append-only `AuditLog` (REVOKE/trigger).
3. Retensi `AuditLog` (keputusan upstream).
