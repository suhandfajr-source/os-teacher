# Review 5 — Blind Hunter Findings

- **source_prompt:** `_bmad-output/implementation-artifacts/review-5-blind-hunter-prompt.md` (self-contained; diff inlined ~192.5 kB)
- **content_class:** unified diff — Story 5 Panel Persetujuan Guru & Superadmin: `prisma/schema.prisma`, `prisma/migrations/20260923000000_story5_approval_superadmin_foundation/`, `src/lib/superadmin.ts` (baru), `src/lib/session-guards.ts` (baru), `src/modules/approvals/approvals.actions.ts` (baru), `src/modules/admin/admin.actions.ts` (baru), `src/modules/notifications/notifications.service.ts` (baru), `src/app/admin/*` (baru), `src/app/(dashboard)/persetujuan/*` (baru), `src/app/(dashboard)/siswa/*`, `src/modules/student-auth/*`, `src/modules/quiz/quiz.actions.ts`, `src/modules/parent/parent.service.ts`, `src/components/layout/*`, `src/proxy.ts`, `src/lib/auth.ts`, `src/lib/authorization.ts`, `src/lib/superadmin-seeder.ts`, integration/unit tests (baru), `stories/5-panel-persetujuan-guru-superadmin.md`
- **date:** 2026-09-23
- **arithmetic:** N = min(floor(sqrt(192.5) + 1), 10) = min(14, 10) = **10** → 18 findings (floor exceeded)

## Findings

1. **Batch reject hilang total.** Panel L2 menyediakan batch *approve* (`batchApproveStudentsAction`) tetapi tidak ada aksi maupun jalur UI untuk batch reject, meskipun entri checklist hanya menjanjikan batch approve; teks spec ("checklist batch") ambigu dan implementasi diam-diam memilih satu interpretasi tanpa mendokumentasikan mengapa reject-batch dikecualikan.

2. **Batch approve selalu mengirim notifikasi L2 meski seluruh baris approval L1 (pengampu).** `batchApproveStudentsAction` tidak pernah menghitung `approvalLevel` per baris (variabel `let approvalLevel: "L1" | "L2" = "L2"` dead: dideklarasikan, tak pernah di-reassign, dikembalikan sebagai konstanta "L2"), sehingga batch pengampu atas rombelnya sendiri menotifikasi seluruh guru sekolah sebagai "eskalasi L2" — bertentangan dengan kebijakan aksi individu di mana approve L1 tidak memicu notifikasi.

3. **`resetStudentPinAction` memuat kode dead yang kontradiktif.** `const isSuperadmin = false; // guru biasa di sini; superadmin memakai modul admin` berada di dalam docstring yang mengklaim "HANYA pengampu rombel siswa di periode terkait **atau superadmin**" — jalur superadmin seharusnya ada di sini, atau docstring dan cabang dead dihapus.

4. **`getAuditLogsAction` adalah dead code yang menyimpang dari satu-satunya konsumennya.** Halaman audit (`src/app/admin/audit/page.tsx`) mengimplementasi ulang query secara inline (tanpa dukungan `from`/`to`/`targetId`), sementara aksi ekspor dengan "filter aktor/aksi/target/rentang waktu" tidak pernah dipanggil — dua implementasi pagination/filter yang akan saling drift.

5. **AuditLog viewer tidak bisa menampilkan *alasan*.** `metadata` di-select, di-type `unknown`, dan tidak pernah di-render, sehingga alasan penolakan (`STUDENT_ACCOUNT_REJECTED`), alasan ban, alasan force-decision, dan laporan batch tidak terlihat di permukaan yang justru dibangun untuk memeriksanya; field `ip` juga di-select tapi tidak ditampilkan.

6. **Filter audit per `actorId` menuntut admin sudah mengetahui cuid mentah.** Tidak ada user/school picker atau tautan dari konsol user ke entri audit terfilter (`/admin/audit?actorId=...`), sehingga jejak audit ber-dedup praktis tak dapat dieksplorasi; `targetType` berupa input teks bebas alih-alih set enumerasi yang diisyaratkan placeholder.

7. **`deactivateSchoolAction` tidak transaksional dan penomoran komentarnya melompati satu langkah.** Tandai-nonaktif, revoke sesi (loop per-user dengan error yang ditelan), clear NPSN, dan AuditLog adalah operasi independen; kegagalan di tengah urutan meninggalkan state deactivated-but-sessions-alive atau npsn-uncleared tanpa kompensasi, dan langkah "(3)" fail-closed siswa/portal hanyalah komentar dalam daftar bernomor 1,2,4,5.

8. **`banTeacherAction` mem-ban sembarang user non-ADMIN, bukan hanya guru.** Parent (dan user platform mana pun) lolos guard `platformRole === "ADMIN"`, sehingga aksi "ban guru" dapat membungkam akun parent tanpa sengaja; tidak ada pemeriksaan teacherProfile/membership atau aksi terpisah, dan bagian UI diberi label manajemen guru.

9. **Checkbox E2E dicentang `[x]` padahal catatan mengatakan E2E "dilakukan saat lingkungan build sehat/CI".** Item Fase 4 `Test E2E F1` ditandai selesai meskipun diff dan Catatan Implementasi mengakui Playwright tidak pernah berjalan lokal; checklist mengklaim verifikasi yang belum terjadi — status in-review seharusnya menampakkannya, bukan menyembunyikannya.

10. **Logika panel L1 diduplikasi inline di `/siswa/page.tsx` alih-alih memakai ulang `getPendingStudentsForMyClassesAction`.** Halaman mengimplementasi ulang query pengampu-class, threshold eskalasi, dan mapping (dan membuang field `reason`, sehingga kartu L1 tidak bisa menampilkan MISMATCH_NAME vs NEW_STUDENT), menjamin drift dengan lapisan aksi yang dicerminkannya.

11. **Tidak ada `router.refresh()` setelah mutasi apa pun di `SiswaListClient` / `PersetujuanClient`.** Menyetujui siswa dari kartu pending menghapusnya dari daftar pending tetapi siswa tidak pernah muncul di `classGroups` hingga reload manual penuh; sama untuk pindah rombel (di-patch lokal) dan operasi batch, sehingga state server dan UI bisa saling bertentangan antar-panel.

12. **`NotificationBell` menandai semua terbaca saat dibuka, tidak pernah polling, dan mengabaikan `payload.link`.** Badge di-nol-kan begitu dropdown terbuka (sebelum item benar-benar terlihat), feed tidak pernah diperbarui selama halaman terbuka (satu fetch di mount), dan field `link` yang disertakan cermat di setiap payload notifikasi tidak pernah di-render sebagai navigasi.

13. **`UserRow.memberships.school.deactivatedAt` di-type `boolean | null`** di `AdminConsoleClient` padahal schema dan select aksi mengembalikan `DateTime` — kebohongan tipe di interface klien (saat ini tak dipakai untuk rendering, tetapi akan menyesatkan konsumen berikutnya).

14. **`getActivePeriod` mengklaim "service layer wajib memvalidasi maksimal satu periode aktif" tetapi tidak memvalidasi.** Ia diam-diam mengambil `periods[0]` ketika beberapa periode ACTIVE ada, sehingga invariant yang dinyatakan tidak ditegakkan di mana pun.

15. **`assertSessionCreationAllowed` meninggalkan celah fail-open untuk guru multi-sekolah.** Guru dengan `activeSchoolId = null` tetapi hanya punya membership ACTIVE di sekolah nonaktif lolos dari hook (hanya `activeSchoolId` yang dicek), sehingga guru sekolah nonaktif yang belum menyelesaikan onboarding dapat mencetak sesi baru; loop revoke saat deaktivasi menutup sesi yang ada, bukan yang baru.

16. **Indeks untuk `notification.schoolId` hilang.** Migrasi menambahkan FK `notification_schoolId_fkey` tetapi tidak ada index pada `schoolId`; Postgres tidak meng-indeks kolom FK secara otomatis, sehingga query notifikasi per-sekolah (dan cascade delete notifikasi saat sekolah dihapus) akan full-scan.

17. **`forceApproveStudentAction` / `forceRejectStudentAction` tidak mempertimbangkan status aktivasi sekolah.** Superadmin dapat force-approve siswa dari sekolah yang dinonaktifkan (mengaktifkan kembali akun tanpa mengaktifkan sekolah) — interaksi antara L3 dan siklus deaktivasi yang tidak dicakup guard maupun test.

18. **Copy eskalasi hardcoded di satu panel dan diparameterisasi di panel lain.** `SiswaListClient` men-hardcode "merah = >48 jam" / "Eskalasi >48 jam" sementara `PersetujuanClient` merender `escalatedThresholdHours` dari props; jika `ESCALATION_L1_HOURS` berubah suatu saat, teks panel L1 diam-diam menjadi salah.
