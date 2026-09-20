# Review 1a — Blind Hunter Findings

- **source_prompt:** `_bmad-output/implementation-artifacts/review-1a-blind-hunter-prompt.md` (self-contained; diff inlined ~35.7 kB)
- **content_class:** unified diff (docs + schema/migration) — Story 1a split (1a/1b/1c), `prisma/schema.prisma`, `prisma/migrations/20260920135945_student_portal_foundation/migration.sql`, story files, `deferred-work.md`, `stories.yaml`, `.memlog.md`
- **date:** 2026-09-20
- **arithmetic:** N = min(floor(sqrt(35.7) + 1), 10) = min(6, 10) = **6** → 12 findings (floor exceeded)

## Findings

1. **`prisma/schema.prisma` (Student/Class/User, AuditLog) + `migration.sql`** — nilai kanonik (`accountStatus ∈ {PENDING,ACTIVE,REJECTED}`, `platformRole ∈ {USER,ADMIN}`, `actorType`) hanya hidup di komentar & dokumen; tidak ada penegakan DB (mis. `ADD CONSTRAINT ... CHECK (...) NOT VALID` + `VALIDATE` — tetap murni aditif). Typo atau `"admin"` lowercase tersimpan diam-diam; guard Story 5 yang deny-by-default `platformRole === "ADMIN"` jadi bergantung pada disiplin penulis data, bukan DB.

2. **`stories/1a-schema-fondasi-migrasi.md` — Verification vs Implementation Notes kontradiktif.** Verification menyuruh `npx prisma migrate dev --name student_portal_foundation` "applied bersih tanpa warning", padahal catatan insiden di file yang sama mencatat `migrate dev` menuntut RESET (drift nyata) dan alur aktual = `migrate diff` + `db execute`. Siapa pun yang mengikuti Verification pada checkout baru akan menghadapi prompt reset terhadap DB ber-drift; jalur aman yang benar tidak diangkat menjadi prosedur resmi.

3. **Rapat `migrate dev` dead-end tapi tetap diinstruksikan ke story berikutnya.** Catatan 1a menyimpulkan engine lokal "hanya layak sebagai shadow/scratch, bukan target migrate", namun `invoke_dev_with` 1a dan 1c masih memerintahkan "migrate dev hanya DB lokal". Tidak ada satu pun DB yang bisa menjadi target aman `migrate dev` — resep untuk Story 1c/2+ perlu diganti (diff+execute) atau engine diperbaiki dulu.

4. **State `_prisma_migrations` klassa_dev ambigu dan 1a tidak di-resolve di lokal.** Langkah 2 insiden: 18 migrasi "di-replay via `migrate deploy`" (seharusnya membuat tabel `_prisma_migrations`); langkah 3: "engine TIDAK menyimpan `_prisma_migrations` (P3005)" — dua-duanya sulit benar sekaligus, dan `migrate resolve --applied` untuk 1a hanya disebut untuk Neon. Kondisi bookkeeping lokal pasca-story tidak bisa direkonstruksi dari dokumen — persis jenis ambiguitas yang memicu reset/re-apply di sesi berikutnya.

5. **Utang rekonsiliasi drift (schedule/prosem) tanpa aturan sequencing.** `deferred-work.md` mencatat kebutuhan migrasi rekonsiliasi, tapi tidak ada constraint urutan: harus land sebelum `migrate deploy` pertama ke env fresh/CI, dan sebelum migrasi mana pun yang menyentuh objek drift. Sampai lunas, fresh replay 19 file menghasilkan schema ≠ Neon ≠ `schema.prisma` (env/test baru gagal diam-diam), dan migrasi berikutnya yang menyentuh `teaching_schedule` dkk. akan conflict di Neon.

6. **Append-only `AuditLog` + larangan secret di `metadata` hanya konvensi komentar — tanpa mitigation interim.** Enforcement DB (REVOKE/trigger) di-defer (diakui), tapi tidak ada helper `redactMetadata()`/sanitizer + test yang dispesifikasikan di 1c — padahal 1c adalah penulis `AuditLog` pertama. Jendela Stories 3–5 menulis audit tanpa enforcement mekanis maupun tooling redaksi.

7. **`stories/1c` — seeder tidak punya jalur demosi/drift-report.** Email dihapus dari `SUPERADMIN_EMAILS` → ADMIN lama tetap ADMIN selamanya (seeder hanya promote; re-run = no-op). Matriks I/O tidak punya baris "allowlist menyusut / ADMIN existing di luar allowlist". Minimal: laporan drift ADMIN-not-in-allowlist tiap run, atau keputusan demosi eksplisit dicatat.

8. **`stories/1c` — asumsi case email di DB tidak dipatok.** Normalisasi trim+lowercase hanya di sisi allowlist; bila DB menyimpan email mixed-case, lookup normalized akan miss ("email tidak dikenal" palsu), dan dua row yang berbeda hanya case-nya membuat match ambigu. Perlu lookup `mode: "insensitive"` atau invariant "Better Auth selalu menyimpan lowercase" diverifikasi + baris matriks stored-mixed-case.

9. **`stories/1b` — nilai fallback `PIN_PEPPER` dev/test tidak dispesifikasikan.** "Fallback dev-only aktif bila `NODE_ENV ∈ {development, test}`" tanpa menentukan nilainya deterministik. Bila fallback acak per proses, hash dari run sebelumnya tak terverifikasi lagi — login dev gagal misterius. Patokan konstanta tetap + assert di test.

10. **`stories.yaml` — field `spec_checkpoint`/`done_checkpoint` hilang pada 1b dan 1c.** Story "1" lama memilikinya; hanya 1a mewarisi. Bila gerbang Tahap 1 berarti tiga pecahan selesai, semantik gate hilang dari tracker — dan keputusan (sengaja atau terlewat) tidak tercatat di memlog maupun story mana pun.

11. **Index akses-antisipasi absen.** Panel Story 5 hampir pasti memfilter `AuditLog` berdasarkan `action`, dan antrean persetujuan akan query `Student` by `accountStatus (+ createdAt)`; dua-nya tidak terindeks. Menambah nanti tetap aditif, tapi menambahkannya sekarang gratis dan menghindarkan migrasi tambahan di tengah jalannya Stories 3–5.

12. **`stories/1c` — jaminan inti seeder (all-or-nothing, idempotent-no-audit, `--dry-run`, identitas DB target) hanya diverifikasi manual.** `superadmin-allowlist.test.ts` menguji parser saja. Minimal satu test integrasi idempotensi (run 2× → 0 entri audit baru) dan transaksi-rollback (email tak dikenal di tengah daftar → nol row berubah) — ini properti keamanan, bukan kenyamanan.
