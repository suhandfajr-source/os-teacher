# Amendum Keamanan — 5 Temuan BLOCKING

> Wajib sebelum eksekusi fitur terkait. (Amendum A §10)

## B1. Integrasi quiz: identitas dari SESI server, bukan parameter klien

`startQuizAttemptAction(token, studentId, pin?)` (quiz.actions.ts) menerima `studentId` dari klien — itu desain alur `/q/[token]` lama dan **signature-nya tidak boleh diubah**. Portal siswa wajib memakai variant baru (mis. `startQuizAttemptFromSessionAction(token)`):

- `studentId` di-derive dari `verifyStudentSession()`; parameter identitas dari klien **diabaikan sepenuhnya**;
- roster check tetap dijalankan;
- `accessMode = INDIVIDUAL_PIN` → otomatis terpenuhi oleh sesi terautentikasi (dokumentasikan di kode sebagai pengecualian yang disengaja);
- `accessMode = CLASSROOM_PIN` → portal men-skip PIN kelas; kendali akses tetap via `status PUBLISHED` + `validFrom` + `deadline` (keputusan eksplisit, dicatat di kode).

**Konsekuensi bila dilanggar:** siswa yang login dapat menuliskan nilai atas nama teman sekelas (cukup tahu PIN kelas) — manipulasi leger senyap.

## B2. Reset PIN & kuasa L2 dipersempit

- **Reset PIN siswa**: HANYA pengampu rombel siswa tersebut di periode aktif (atau Superadmin) — bukan "semua guru sekolah".
- **Approve L2** (eskalasi): tetap terbuka semua guru sekolah, namun setiap aksi L2 memicu notifikasi ke semua guru + `AuditLog`.

Alasan: Mode Santai memungkinkan akun guru mana pun bergabung bebas ke sekolah; reset PIN adalah kunci impersonasi siswa.

## B3. Rate-limit persisten + lockout berlapis

Semua limiter baru wajib disimpan di DB — **bukan** Map in-memory (mati di serverless multi-instance; preseden `checkPinRateLimit` di quiz.service.ts tidak boleh ditiru untuk fitur baru):

- **Per-akun** (`failedAttempts`/`lockedUntil` pada `Student`): 5x salah → kunci 15 menit; pelanggaran beruntun eskalasi 15m → 1j → 24j.
- **Per-IP+sekolah** (tabel limiter kecil): menahan spraying lintas banyak NIS dari satu sumber.
- **Kode rombel**: 10x/jam/IP pada storage yang sama.
- Pesan error seragam "NIS atau PIN salah" untuk NIS-tak-ditemukan maupun PIN-salah + dummy-verify agar timing tidak membocorkan keberadaan NIS.

## B4. Fail-fast `STUDENT_SESSION_SECRET` + atribut cookie

Mirror pola `getAuthSecret()` (src/lib/auth.ts): **throw di production** bila unset/empty — tanpa fallback secret apa pun. Cookie `klassa_student_session`: httpOnly, signed, `secure` di production, `sameSite=lax`, 30 hari absolute cap + idle 7 hari (sliding).

## B5. Siklus hidup sesi & aksi superadmin

- **Ganti PIN**: wajib verifikasi PIN lama (dengan lockout sama seperti login) + rotasi session id + tombol "Keluar semua perangkat".
- **Ban guru / reset password guru**: wajib revoke SEMUA sesi Better Auth aktif milik user (`revokeUserSessions`; perlu admin plugin di src/lib/auth.ts — belum terpasang).
- **Nonaktifkan sekolah**: semua login guru & siswa sekolah itu gagal + sesi existing di-invalidate; **clear `npsn`** saat deaktivasi — jika tidak, NPSN sah terkunci permanen oleh `School.npsn @unique`.
