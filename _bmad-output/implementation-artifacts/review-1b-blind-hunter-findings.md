# Review 1b — Blind Hunter Findings

- **source_prompt:** `_bmad-output/implementation-artifacts/review-1b-blind-hunter-prompt.md` (self-contained; diff inlined ~24.7 kB)
- **content_class:** unified diff — Story 1b primitif PIN: `src/lib/student-pin.ts` (baru), `src/lib/__tests__/student-pin.test.ts` (baru), `.env.example`, `stories/1b-primitif-pin.md`, `deferred-work.md`
- **date:** 2026-09-20
- **arithmetic:** N = min(floor(sqrt(24.72) + 1), 10) = min(5, 10) = **5** → 11 findings (floor exceeded)

## Findings

1. **`resolvePinPepper` — gate fallback bertentangan dengan spec frozen dan `.env.example`.** Design Notes mematok fallback hanya aktif bila `NODE_ENV ∈ {development, test}` (dan `.env.example` mengulang "development/test falls back"), tetapi kode jatuh ke `DEV_ONLY_PIN_PEPPER` untuk *semua* nilai selain `"production"` — termasuk `undefined`, `"staging"`, atau typo `"produciton"`. Deploy produksi dengan `NODE_ENV` salah-konfigurasi/unset diam-diam memakai konstanta yang ter-commit publik sebagai HMAC key. Fail closed: throw untuk `nodeEnv` apa pun di luar `{development, test, production}`.

2. **Komentar `.env.example` "The server REFUSES TO BOOT in production" overpromise.** Fail-fast terjadi saat module *di-import*, dan belum ada yang meng-import `student-pin.ts` (pure util, diakui spec sendiri); bahkan nanti, Next.js lazy-load module per-route — tanpa import di jalur startup (mis. `instrumentation.ts` atau import entrypoint yang direncanakan di Story 3), kegagalan muncul di request pertama pada route yang menyentuh kode PIN, bukan saat boot. Pelankan komentar `.env.example`, atau catat pekerjaan boot-wiring sebagai tugas Story 3.

3. **Kebutuhan env saat build tidak terdokumentasi.** `next build` berjalan dengan `NODE_ENV=production` dan akan crash saat prerender/page-data collection bila `PIN_PEPPER` tidak ada di environment build. Baik `.env.example` maupun Implementation Notes tidak menyebut bahwa CI/build juga wajib punya `PIN_PEPPER` (atau sengaja menerima build gagal sebagai sinyal fail-fast).

4. **Aserasi `.rejects` mengambang (tidak di-await).** Di kedua blok `it.each` rejection ("rejects %j with PinFormatError" dan kasus digit Unicode) callback non-async dan `expect(hashPin(pin)).rejects.toBeInstanceOf(PinFormatError)` tidak di-await maupun di-return — aserasi bisa tidak selesai sebelum test berakhir, menutupi kegagalan atau memicu unhandled-rejection. Jadikan callback `async` dan `await expect(...)` (pola yang sudah benar dipakai di bagian lain file).

5. **Semantik whitespace/trim inkonsisten antar cabang, dan pepper dikembalikan tanpa di-trim.** Produksi menolak whitespace-only, tapi lalu mengembalikan `"  secret  "` (atau `\r` tertinggal dari `.env` ber-CRLF — repo ini dikembangkan di Windows) verbatim sebagai HMAC key; sementara cabang dev memperlakukan `"   "` sebagai truthy dan memakai tiga spasi sebagai pepper aktual. Trim sekali, pakai nilai trimmed di kedua cabang, fallback hanya bila trimmed-empty, plus test untuk kasus whitespace di dev.

6. **Tidak ada validasi kekuatan minimum `PIN_PEPPER`.** String non-blank apa pun (`"a"`) lolos di produksi, padahal seluruh premis desain adalah pepper membuat brute-force offline atas keyspace 10⁴ tak layak. Patok minimum (mis. ≥32 hex chars / ≥16 bytes) di `resolvePinPepper("production")` dan nyatakan minimumnya di `.env.example` di samping perintah generate.

7. **`p` tak dibatasi di `parseStoredHash` — CPU-time DoS di dalam kontrak "never throws/hangs".** Single memory rule hanya memeriksa `128*N*r`, sehingga `scrypt:16:1:1000000000:...` legal secara memori dan — bila Node/OpenSSL tidak menolaknya lewat `maxmem` — `verifyPin` berputar ber-menit alih-alih return `false`. Batasi `p` (atau total kerja `N*r*p`) saat parse; test over-budget saat ini hanya memvariasikan `N`, jadi tambahkan kasus corrupt-hash dengan `p` raksasa.

8. **Segmen hex panjang-ganjil diterima lalu silently truncated.** `/^[0-9a-f]+$/i` meloloskan `"abc"`, dan `Buffer.from("abc", "hex")` membuang setengah-byte — salt/hash tersimpan bisa ter-parse ke byte yang tidak round-trip dengan teks literalnya. Wajibkan hex panjang-genap (mis. `/^(?:[0-9a-f]{2})+$/i`).

9. **Test hilang justru di boundary NODE_ENV yang dijanjikan spec.** Tidak ada kasus `resolvePinPepper("staging")` atau `resolvePinPepper(undefined)` — input persis tempat kode saat ini menyimpang dari Design Notes frozen. Perilaku apa pun yang dipilih harus di-pin dengan test (termasuk `NODE_ENV` unset + `PIN_PEPPER` unset).

10. **Parsing hex case-insensitive tidak teruji dan setengah dispesifikasikan.** `scrypt:16384:8:1:AB:CD` (hex uppercase) lolos sementara `"SCRYPT:..."` ditolak; bila case-insensitivity disengaja, tambahkan ke matriks hash valid/corrupt; bila tidak, perketat regex. Hazard terkait di kemudian hari: test yang `vi.resetModules()` + dynamic re-import menciptakan kelas `PinFormatError` *kedua* — test masa depan yang meng-assert `instanceof` terhadap class hasil import statis lintas instance akan gagal senyap; layak diberi komentar atau sentinel bersama.

11. **Housekeeping spec:** `deferred-work.md` menghapus entri BH9 dan Spec Change Log mencatat konsumsinya, tapi tidak ada catatan bahwa *nilai* konstanta fallback kini load-bearing bagi persistensi data dev/test (mis. DB dev yang di-seed sebelum perubahan ini dengan pepper lain) — satu kalimat di Implementation Notes story yang menandai konstanta sebagai kontrak stabilitas akan mencegah "pembersihan tak berbahaya" di masa depan merusak login dev.
