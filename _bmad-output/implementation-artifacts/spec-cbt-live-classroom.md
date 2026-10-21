---
spec_version: 1
title: CBT Live Classroom Monitoring
story_key: ''
status: 'done'
baseline_commit: '890c0725dc2d0585f95768c4b094629f21806d6b'
review_loop_iteration: 0
---

# CBT Live Classroom Monitoring (Tahap 2)

## Intent

Memberikan guru kendali penuh atas pelaksanaan ujian kelas serentak (CBT tatap muka/hybrid). Guru dapat:
1. Membuka "Sesi Ujian Langsung" (Live Session) dari kuis yang sudah dibuat dengan token dinamis 6-karakter.
2. Mengendalikan siklus ujian bersama: WAITING (siswa menunggu di lobi), ACTIVE (soal terbuka serentak), PAUSED (pembekuan ujian sementara), ENDED (selesai serentak).
3. Memantau "Live Cockpit" secara real-time: melihat siswa yang sudah masuk lobi, progres nomor soal saat ini, jawaban terisi, status pengerjaan (ONLINE, AWAY/TERLENCANG, TERKUNCI 3-STRIKE, SELESAI).
4. Melakukan intervensi guru langsung: membuka kembali attempt siswa yang terkunci (Unblock / Reset Strike), atau memaksa submit attempt siswa dari cockpit.
5. Siswa memiliki pengalaman lobi terpadu: memasukkan token kuis, menunggu guru memulai ujian, menerima pembekuan layar saat sesi di-pause, dan submit otomatis saat guru mengakhiri sesi.

## Boundaries & Constraints

- **Non-Destructive Schema**: Penambahan model `CbtSession` terhubung ke `Quiz`, `teachingContextId`, `User` (creator), serta relasi opsional `cbtSessionId` pada `QuizAttempt`. Dilarang menjalankan `prisma migrate reset`.
- **Realtime Architecture**: Menggunakan ultra-lightweight client-side polling interval (3-4 detik) dengan payload ringkas (hanya delta status & ringkasan progress siswa) tanpa membebani server/database.
- **Autorisasi Guru**: Semua endpoint cockpit live terikat verifikasi `verifyTeachingContextAccess` dan `User.id` guru pengampu kelas terkait.
- **Session Token Uniqueness**: Token 6 karakter alfanumerik uppercase (mis. `CBT92X`) unik di antara sesi yang berstatus `WAITING`, `ACTIVE`, atau `PAUSED`.

## I/O & Edge-Case Matrix

| Trigger | Input / Kondisi | Expected Output / Behavior |
|---|---|---|
| Guru membuat sesi CBT | `quizId`, `teachingContextId`, durasi (opsional override) | Record `CbtSession` terbuat, status `WAITING`, token 6 huruf unik di-generate, redirect ke Cockpit `/quiz/live/[sessionId]`. |
| Siswa masuk via token | Token 6-digit di `/portal-siswa/cbt` atau portal kuis | Validasi sesi `WAITING`/`ACTIVE`. Jika `WAITING`, siswa masuk halaman lobi ("Menunggu Guru Memulai Ujian"). |
| Siswa polling status di lobi | Status sesi berubah ke `ACTIVE` | Client siswa otomatis navigasi masuk ke `QuizRunnerClient` dan timer mulai serentak. |
| Guru menekan tombol "Mulai Ujian" | Sesi `WAITING` -> `ACTIVE` | `startedAt = now()`. Semua siswa di lobi menerima state ACTIVE pada polling berikutnya dan mulai mengerjakan. |
| Guru menekan tombol "Jeda Ujian (Pause)" | Sesi `ACTIVE` -> `PAUSED` | Layar pengerjaan siswa memunculkan overlay pembekuan ("Ujian Ditangguhkan Sementara oleh Guru"), input soal dinonaktifkan, timer berhenti. |
| Guru menekan "Lanjutkan Ujian" | Sesi `PAUSED` -> `ACTIVE` | Overlay pembekuan tertutup, siswa lanjut mengerjakan. |
| Guru menekan "Akhiri Ujian Serentak" | Sesi `ACTIVE`/`PAUSED` -> `ENDED` | `endedAt = now()`. Semua attempt siswa berstatus `IN_PROGRESS` otomatis di-finalize/submit dan diskor. Siswa diarahkan ke ringkasan nilai. |
| Siswa pindah nomor soal di runner | `recordStudentProgressAction(attemptId, currentQuestionIndex, answeredCount)` | Update field progress di attempt / cache sesi untuk dibaca polling guru. |
| Siswa terkena pelanggaran / strike | Episode away tercatat via Tahap 1 | Cockpit guru langsung menampilkan badge merah dan jumlah strike pada kartu siswa terkait. |
| Guru klik "Buka Kunci Siswa" | Attempt terkunci (strike 3x) | Guru mereset strike siswa ke 0, menghapus flag `lockdownLockedAt`, mengembalikan status attempt ke `IN_PROGRESS`, siswa dapat kembali masuk runner. |
| Guru klik "Paksa Selesai Siswa" | Siswa bermasalah / waktu habis lokal | Attempt di-submit paksa oleh guru dan dihitung skornya saat itu juga. |

## Code Map

- `prisma/schema.prisma`:
  - Enum `CbtSessionStatus { WAITING, ACTIVE, PAUSED, ENDED }`
  - Model `CbtSession` (id, quizId, teachingContextId, createdById, token, status, startedAt, endedAt, createdAt, updatedAt)
  - Field relasi opsional `cbtSessionId` pada `QuizAttempt`
- `prisma/migrations/20261011160000_cbt_live_session/migration.sql`: DDL migrasi non-destruktif
- `src/modules/cbt-live/cbt-live.types.ts`: DTO status sesi, event live cockpit, progress siswa
- `src/modules/cbt-live/cbt-live.actions.ts`:
  - `createCbtSessionAction(quizId, teachingContextId)`
  - `getCbtSessionCockpitAction(sessionId)`
  - `updateCbtSessionStatusAction(sessionId, status: "ACTIVE" | "PAUSED" | "ENDED")`
  - `joinCbtSessionByTokenAction(token)`
  - `getStudentLobbyStatusAction(sessionId)`
  - `unblockStudentAttemptAction(sessionId, attemptId)`
  - `forceSubmitStudentAttemptAction(sessionId, attemptId)`
- `src/app/(dashboard)/quiz/live/[sessionId]/page.tsx` & `CbtLiveCockpitClient.tsx`:
  - Antarmuka visual live cockpit guru: ringkasan metrik (Hadir, Mengerjakan, Selesai, Terkunci), grid kartu siswa real-time, kontrol status sesi (Start, Pause, Resume, Stop).
- `src/app/siswa/portal/cbt/page.tsx` & `CbtLobbyClient.tsx`:
  - Pintu masuk siswa via PIN/Token 6 karakter, ruang tunggu (lobi) interaktif dengan animasi status menunggu guru.
- Integrasi `QuizRunnerClient.tsx`:
  - Polling status sesi berkala (jika attempt memiliki `cbtSessionId`): respon pause freeze overlay, dan auto-submit saat sesi ENDED.

## Tasks & Acceptance

- [x] Schema database & migrasi enum `CbtSessionStatus`, model `CbtSession`, relasi `cbtSessionId` pada `QuizAttempt`.
- [x] Server actions modul `src/modules/cbt-live/cbt-live.actions.ts` dengan autorisasi guru & sesi siswa.
- [x] UI Live Cockpit Guru (`/quiz/live/[sessionId]`) dengan visual monitor modern, kontrol sesi (Mulai/Jeda/Selesai), dan aksi intervensi per siswa (Buka Kunci / Paksa Kumpul).
- [x] UI Siswa: Input token di portal siswa (`/siswa/portal/cbt`) dan ruang tunggu lobi ujian (`CbtLobbyClient.tsx`).
- [x] Integrasi listener sesi pada `QuizRunnerClient.tsx` (lapor progress nomor soal aktif ke guru).
- [x] Unit & integration tests untuk alur sesi live di `src/modules/cbt-live/__tests__/cbt-live.actions.test.ts`.

## Design Notes

- **Aesthetic Modern Cockpit**: Cockpit guru menggunakan layout grid kartu bento dengan aksen visual Klassa (purple/slate), status dot berdenyut (Pulse green untuk online aktif, amber untuk paused, red untuk pelanggaran/terkunci).
- **Graceful Token Input**: Input token siswa mendukung auto-uppercase dan format tebal per huruf.

## Verification

**Commands:**
- `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` -> verifikasi DDL
- `npx prisma db execute --file ...`
- `npx tsc --noEmit` -> 0 error
- `npx vitest run src/modules/cbt-live` -> semua test lulus
