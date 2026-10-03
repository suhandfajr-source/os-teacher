---
title: 'Story 2 — Lampiran guru pada tugas (soal/LKPD via file)'
type: 'feature'
created: '2025-10-02'
status: 'done'
baseline_commit: '855a282'
route: 'full'
review_loop_iteration: 0
context:
  - '{project-root}/docs/product/assignment-file-blueprint.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Guru hanya bisa memberi instruksi tugas berupa teks — soal/LKPD/bacaan disebar lewat WhatsApp. Siswa butuh lampiran file yang nempel di tugas.

**Approach:** Guru melampirkan file (semua jenis kecuali blocklist, maks 25 MB × 5 file/tugas) saat membuat tugas dan kapan saja setelahnya (K8: lampiran = instruksi, bebas diubah walau sudah ada yang mengumpulkan). Seluruh siswa rombel aktif tugas itu boleh lihat/unduh. Infrastruktur Story 1 (adapter S3, presign, validasi) dipakai ulang.

## Boundaries & Constraints

**Always:**
- Aturan file identik Story 1: blocklist program/makro, 25 MB/file, maks 5 file per tugas (digabung lama+baru saat replace), sanitasi nama, pratinjau inline hanya tipe previewable (guard di route)
- Upload presigned POST langsung browser→storage di prefix `attachments/tmp/`; claim saat create/set action dengan HEAD-check ukuran; key liar ditolak
- Akses unduh: guru pemilik konteks (verifyTeachingContextAccess) ATAU siswa dengan membership aktif di rombel+periode tugas itu; kegagalan = 404 generik; HEAD pre-check sebelum redirect (error ramah)
- Hapus attachment = hapus row + objek storage (setelah commit; gagal hapus = log saja)
- Route upload presign kind=attachment wajib sesi guru pemilik konteks — sesi siswa ditolak

**Never:**
- Tidak mengubah perilaku submission siswa / review (Story 1 utuh)
- Tidak membuat editor tugas umum (edit judul/deskripsi) — hanya lampiran yang dikelola
- Tidak menaruh lampiran di level sesi/pertemuan
- Byte file tidak lewat server Next.js

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| BUAT + lampiran | Guru isi form + 2 file | Tugas terbuat, 2 row `AssignmentAttachment`, objek di storage | Validasi sama Story 1 |
| Kelola: tambah | Dialog lampiran tugas aktif, +1 file baru | Row baru; file lama tak tersentuh | Maks 5 gabungan (lama dipertahankan + baru) |
| Kelola: hapus | Hapus 1 dari 3 lampiran | Row hilang + objek dihapus dari storage | Gagal hapus objek → log, row tetap hilang |
| Ubah setelah ada submission | Ada 5 siswa sudah kumpul, guru ganti PDF soal | Berhasil — lampiran bukan data penilaian (K8) | Tanpa peringatan khusus |
| Siswa rombel benar akses | GET attachment tugas rombelnya aktif | 302 presigned (inline bila previewable, selain itu unduh) | HEAD null → 404 ramah |
| Siswa rombel lain | GET attachment tugas kelas beda | 404 generik | Tanpa bocor |
| Siswa request presign attachment | POST upload-url kind=attachment dgn sesi siswa | 403 (hanya guru) | Pesan jelas |
| Guru asing presign/akses | Guru non-pemilik konteks | 404 generik / 403 presign | Tanpa bocor |
| Duplikat key / key liar / ukuran bohong | Saat claim | Ditolak eksplisit (pesan spesifik) | Sama pola Story 1 |
| S3 tak dikonfigurasi | Env kosong | Presign 503; teks tugas tetap bisa dibuat tanpa lampiran | Mati anggun |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — tambah `AssignmentAttachment` (blueprint §3.1 persis) + relasi `attachments AssignmentAttachment[]` di `Assignment`; migrasi `assignment_attachment`
- `src/modules/storage/storage.service.ts` — `buildTmpStorageKey(name, kind)` + `isClaimableKey(key, kind)` (generalisasi prefix `submissions/tmp`|`attachments/tmp`) — REUSE presign/HEAD/delete
- `src/app/api/assignments/files/upload-url/route.ts` — body `{kind: "submission"|"attachment", teachingContextId?, assignmentId?}`: attachment → guard guru via `verifyTeachingContextAccess` (throw→404), presign prefix attachments
- `src/app/api/assignments/attachments/[fileId]/route.ts` — BARU: pola identik route [fileId] Story 1 (HEAD pre-check, inline guard, 404 generik); akses siswa = membership aktif rombel tugas
- `src/modules/assignments/assignment.actions.ts` — `createAssignment` terima `files?`; BARU `setAssignmentAttachmentsAction({teachingContextId, assignmentId, keepFileIds, newFiles})` (selective delete+insert, HEAD claim, hapus objek); `getAssignmentAttachmentsForRombel` helper query
- `src/app/(dashboard)/kelas/[teachingContextId]/tugas/page.tsx` — sertakan `attachments` di query → props TugasClient
- `src/app/(dashboard)/kelas/[teachingContextId]/tugas/TugasClient.tsx` — form create: file picker + daftar (reuse pola SubmitAssignmentForm, XHR+timeout+infer mime); row tugas: tombol "Lampiran (n)" buka dialog
- BARU `src/app/(dashboard)/kelas/[teachingContextId]/tugas/AssignmentAttachmentsDialog.tsx` — kelola: daftar lampiran, hapus, tambah, simpan via setAssignmentAttachmentsAction
- `src/app/siswa/portal/tugas/page.tsx` — sertakan `attachments`; kartu tugas: bagian Lampiran (unduh/pratinjau inline)
- `src/modules/student-portal/__tests__/story2-attachments.int.test.ts` — BARU, pola story-1 (mock storage S3 + authorization, DB nyata)

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `npx prisma migrate dev --name assignment_attachment` — model & tabel
- [x] `storage.service.ts` — generalisasi key builder/claim per kind + unit test update
- [x] `upload-url/route.ts` — dukung kind=attachment + guard guru — reuse validasi
- [x] `attachments/[fileId]/route.ts` — pintu akses + guard akses siswa rombel — pola Story 1
- [x] `assignment.actions.ts` — createAssignment(files?) + setAssignmentAttachmentsAction + include attachments di query page guru/siswa
- [x] `TugasClient.tsx` + `AssignmentAttachmentsDialog.tsx` — UI upload saat create & kelola kapan saja
- [x] `siswa/portal/tugas/page.tsx` — tampil lampiran di kartu tugas
- [ ] Int test story2: create dgn file, set replace/remove + hapus objek, akses 302/404, presign guru vs siswa, >5 gabungan, duplikat key, mati anggun
- [ ] Unit/regresi: jalankan suite assignments + storage + story-1 (tak boleh pecah)

**Acceptance Criteria:**
- Given guru pemilik, when membuat tugas dengan 2 file, then tugas + 2 lampiran tersimpan dan siswa rombel melihatnya di portal
- Given tugas dengan 3 lampiran, when guru hapus 1 via dialog, then 2 tersisa; objek yang dihapus hilang dari storage
- Given sudah ada submission masuk, when guru menambah lampiran, then berhasil tanpa blokir
- Given siswa rombel aktif tugas itu, when GET attachment, then 302; siswa rombel lain → 404
- Given sesi siswa, when POST upload-url kind=attachment, then 403
- Given env S3 kosong, when buat tugas tanpa file, then sukses seperti biasa

## Design Notes

- Generalisasi key: `buildTmpStorageKey(name, "attachments")` → `attachments/tmp/{uuid}.{ext}`; `isClaimableKey(key, "attachments")` regex sama. Story 1 call-site diperbarui ke signature baru (perilaku tak berubah).
- Dialog kelola pakai pola keep+new persis Story 1 (id stabil, guard gabungan ≤5).
- Student portal: lampiran dirender sebagai chip nama file (ikon per tipe) — link `?disposition=inline` bila previewable, selain itu unduh.

## Verification

**Commands:**
- `npx tsc --noEmit` -- 0 error
- `npm test` -- semua hijau termasuk suite baru
- `npx prisma migrate dev --name assignment_attachment` -- diterapkan tanpa drift

**Manual checks:**
- Dev server lokal + SeaweedFS: guru buat tugas berlampiran → siswa unduh; guru ubah lampiran setelah ada submission

## Implementation Notes

- `toAssignmentAttachmentView` diekspor agar page server-component guru bisa memetakan row Prisma → view tanpa query N+1.
- Mock `verifyTeachingContextAccess` di int test HARUS mengembalikan `{ context: { id } }` — `createAssignment` memakai `auth.context.id` untuk revalidatePath (lesson dari kegagalan awal test).
- Route attachment: jalur guru dicek duluan (mock resolve), jalur siswa membership aktif sebagai fallback — siswa rombel benar tidak butuh verifyTeachingContextAccess.
- Presign kind=attachment menolak sesi siswa APA PUN (403) sebelum cek guru — sesi siswa tak boleh pernah bisa presign lampiran.
- Generalisasi key: `buildTmpStorageKey(name, kind)` + `isClaimableKey(key, kind)`; sekat kind diuji (key attachment tak bisa diklaim submission & sebaliknya). Call-site Story 1 diperbarui, perilaku tak berubah.
- Verifikasi: tsc 0 error; suite penuh 851/851 (74 file); int story-2 11/11; unit storage 31/31.

## Review Triage Log

**Pass 1 (3 layer eksternal Story 2, 3 Okt 2025)** — blind-hunter 13, edge-case 20, verification-gap 5+2 other. Verdict counts: high 5, medium 7, low 8, false 1, maybe-false 0.

| Temuan | Verdict | Route | Bukti/ringkas |
|---|---|---|---|
| E1/C2 guru dengan sisa cookie siswa terblokir 403 di upload-url | high | patch | `upload-url/route.ts` cek `verifyStudentSession` duluan; guru yg pernah test portal siswa di browser sama tertolak 403. Solusi: cek otorisasi guru dulu |
| BH1/E2/C1 guru diblokir (`isBanned`) lolos mutasi & akses lampiran | high | patch | `verifyTeachingContextAccess` tidak melempar error saat banned; `setAssignmentAttachmentsAction`, `getAssignmentAttachmentsAction`, dan routes lampiran wajib `assertNotBanned` |
| BH2 assignment status non-ACTIVE tetap bisa diunduh | medium | patch | `attachments/[fileId]` query tidak cek `assignment.status === "ACTIVE"`. Tambah filter status |
| BH3/E3 siswa nonaktif (`accountStatus !== "ACTIVE"`) lolos unduh lampiran | high | patch | Route attachment hanya cek membership tanpa validasi `student.status === "ACTIVE" && student.accountStatus === "ACTIVE"` |
| BH4 ketiadaan `Cache-Control: no-store` pada redirect 302 presigned download | medium | patch | Redirect 302 tanpa anti-cache berisiko di-cache browser/proxy hingga URL S3 kedaluwarsa. Pasang `Cache-Control: no-store, max-age=0` |
| BH5/E4 dialog kelola lampiran tidak reset saat ditutup tombol X | medium | patch | Menutup modal tanpa simpan meninggalkan state `kept` terpotong. Pasang handler close/buka yang me-reset ke data server |
| BH5b dialog tidak sinkron balik ke parent (`TugasClient`) pasca simpan | medium | patch | Tambah callback `onAttachmentsUpdated` agar list tugas di parent langsung terbarui tanpa refresh |
| E6 link lampiran di dialog guru tidak membawa `?disposition=inline` | low | patch | File previewable (PDF/gambar) dipaksa unduh alih-alih pratinjau. Pasang query inline jika `f.isPreviewable` |
| E7 overflow nama file panjang di kartu tugas portal siswa | low | patch | Tambah `truncate max-w-[160px] sm:max-w-[240px]` pada chip nama lampiran |
| BH6 HEAD check dilakukan serial waterfall di `claimAttachmentFiles` | low | patch | Ubah loop serial menjadi `Promise.all` paralel untuk menekan latensi S3 |
| BH7 validasi kuota gabungan > 5 dieksekusi setelah pemanggilan S3 HEAD | low | patch | Pindahkan pengecekan `keepFileIds.length + newFiles.length > 5` ke awal fungsi sebelum S3 HEAD |
| VG1 parameter `disposition` presignDownload tidak diverifikasi nilainya di test | high | patch | Tambah assertion nilai `disposition` di `story2-attachments.int.test.ts` (inline untuk PDF/gambar, attachment untuk DOCX/default) |
| VG2 validasi ukuran mismatch dan file belum selesai belum teruji di story2 | high | patch | Tambah test case mismatch size dan HEAD null di `story2-attachments.int.test.ts` |
| VG3 route GET attachments belum menguji penolakan tanpa sesi & guru asing | medium | patch | Tambah test case request tanpa sesi dan verifyContext throw -> 404 di `story2-attachments.int.test.ts` |
| VG4 createAssignment gagal klaim file belum teruji | medium | patch | Tambah test case `createAssignment` gagal klaim (duplikat key) melempar error dan tidak membuat assignment |
| BH8/E8 file orphan saat partial upload gagal di dialog/create | low | defer | Sudah tercakup di deferred-work.md (utility scan prefix tmp) |
| BH9 revalidasi sesi mengajar tidak lengkap di setAssignmentAttachmentsAction | low | patch | Revalidasi path `/kelas/[id]/pertemuan/[sessionId]` bila tugas terhubung ke sesi |
| BH10 input file tanpa atribut accept | false | reject | Sesuai K1 blueprint: semua tipe diterima kecuali blocklist program/makro |
| BH11 target="_blank" pada download attachment di portal siswa | low | reject | Browser modern menangani unduhan target="_blank" tanpa meninggalkan tab kosong pada disposition attachment |
| BH12 pesan error jumlah file "per pengumpulan" bukan "per tugas" | low | patch | Sesuaikan pesan error khusus attachment: "Maksimal 5 file per tugas." |
| VG5 otorisasi periode akademik nonaktif pada route GET | low | defer | Siklus hidup siswa dibatasi tahun ajaran aktif; defer ke audit rollover TA |
| Other1 getAssignmentAttachmentsAction dead export | low | reject | Action server tetap berguna untuk API/konsumsi programmatic di masa depan |

