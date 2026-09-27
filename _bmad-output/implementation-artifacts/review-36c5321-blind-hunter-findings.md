# Review Findings — Diff 36c5321 (Blind Hunter)

**Sumber:** `review-36c5321-blind-hunter-prompt.md` (diff ~132 kB)
**Finding floor:** N = min(floor(√132) + 1, 10) = min(12, 10) = **10** → ditemukan **23** issue.

---

## Data & Schema

- **Migration tidak ada untuk field schema baru** — `prisma/schema.prisma` menambah `Student.birthDate`, `birthDateConflict`, `conflictBirthDates`, tetapi tidak ada file migration di `prisma/migrations/` (terakhir `20260926024031_add_teacher_revocation_request`). Deploy tanpa `migrate dev` manual akan melempar P2022 saat runtime di `approvals.actions.ts` / `registerStudent`.
- **`birthDate` disimpan sebagai `String?` bebas tanpa validasi format** — komentar schema bilang "DD/MM/YYYY atau YYYY-MM-DD", client mengirim `YYYY-MM-DD`, server hanya `data.birthDate?.trim() || null` (tanpa zod/format check), lalu mengandalkan string equality (`cleanBirthDate === existingStudent.birthDate`) untuk deteksi konflik. Input campur/abu-abu menghasilkan konflik palsu/terlewat. Seharusnya `DateTime` atau ISO string ternormalisasi.
- **`conflictBirthDates` hanya menyimpan pasangan terbaru** — komentar schema menjanjikan "Riwayat tanggal lahir bentrok", tapi tiap submission bentrok menimpa note (`"old vs new"`); percobaan ketiga menghapus bukti sebelumnya yang dibutuhkan guru untuk verifikasi. Sebaiknya di-append/akumulasi (mis. JSON array).
- **Tampilan tanggal mentah untuk guru** — `PersetujuanClient` merender `birthDate` dan note konflik sebagai string `YYYY-MM-DD` mentah tanpa format `id-ID` (DD/MM/YYYY).

## Keamanan & Privasi

- **Kebocoran PII tanpa autentikasi via `lookupJoinCode`** — include `classStudents` baru mengirim roster lengkap (fullName, nis, hasAccount, accountStatus) ke siapa pun yang memegang/menebak kode 6 karakter, tanpa rate limiting. Nama + NIS anak di bawah umur terbuka, dan gate NIS-matching di sisi client jadi kosmetik karena NIS asli terbaca dari JS bundle di devtools.
- **`verifyStudentIdentity` adalah oracle NIS→nama tanpa autentikasi dan tampak dead code** — mengembalikan "NIS X terdaftar di sekolah atas nama '<nama lengkap>'" untuk NIS arbitrer, tidak dipanggil di mana pun dalam diff ini (halaman portal memakai roster matching di sisi client sebagai gantinya), dan menduplikasi state machine server. Pesan "belum terdata di rombel ini" juga salah: lookup-nya school-wide (`schoolId + nis`), bukan per-rombel.
- **Akun aktif tetap bisa dipilih di dropdown roster** — entri berflag `hasAccount` ("Akun aktif (sudah punya PIN)") tetap bisa dipilih dan flow berlanjut; tidak ada disable/block di client, sehingga pencegahan takeover sepenuhnya bergantung pada proteksi F1 server (tidak terlihat) sementara UI sudah memberi nama + NIS.
- **Kontrak client/server berbeda soal siapa yang boleh mendaftar** — client kini mewajibkan pilih roster + NIS match (submit disabled selain itu), tapi server tetap mengimplementasikan pembuatan NEW_STUDENT dan jalur NEW_STUDENT `verifyStudentIdentity` — tidak terjangkau dari UI namun masih bisa dipanggil sebagai server action mentah (gate UI bisa dilewati). Entah branch server dead, atau gate tidak ditegakkan server-side.

## Bug Logika

- **Siswa roster dengan NIS null tidak akan pernah bisa mendaftar** — di `portal-siswa/page.tsx`, `expectedNis` fallback ke `""` dan `expectedNisLength` ke `4`; `nisValidationStatus` tidak mungkin mencapai `MATCHED`, sehingga field tanggal lahir, PIN, dan tombol submit ter-disable permanen tanpa penjelasan — jalan buntu senyap.
- **Re-registrasi saat PENDING membuang PIN baru secara diam-diam** — di branch "Skenario PENDING" baru, flag konflik/`accountRequestedAt` di-update tapi `accessPinHash` tidak (kecuali sub-branch tanpa birthDate sebelumnya, yang justru meng-update-nya). Siswa submit ulang dengan birth date berbeda, nanti disetujui, tapi PIN barunya tidak pernah tersimpan.
- **`reason: "MATCHED_ROSTER" as any`** — union `RegisterStudentResult` hanya mengizinkan `"MISMATCH_NAME" | "NEW_STUDENT"`; alih-alih melebarkan union type, kode meng-cast ke `any`, menyembunyikan type error dan membuat caller tak bisa mendiskriminasi state baru.
- **Lubang deteksi konflik untuk baris PENDING legacy** — branch early-return PENDING mensyaratkan `accountRequestedAt !== null`; siswa PENDING dengan `accountRequestedAt: null` (data legacy, kini muncul berkat filter `OR` baru di approvals) lolos ke branch (a), yang menimpa `birthDate` secara diam-diam dan mereset `birthDateConflict: false` tanpa penandaan.
- **Generate join code race + null senyap di `createClassAction`** — 10 pengecekan `findUnique` sekuensial lalu `create`: create bersamaan tetap bisa tabrakan di `joinCode` `@unique` (P2002 tidak ditangani), dan bila 10 percobaan habis kelas dibuat dengan `joinCode: null` namun `joinCodeUpdatedAt: new Date()` tetap di-set — kelas tanpa kode dengan timestamp menyesatkan dan tanpa feedback ke user.
- **Objek student basi di sub-branch PENDING 3** — setelah update `birthDate` + `accessPinHash`, kode mengembalikan `student: existingStudent` (snapshot pra-update) alih-alih baris ter-update, sehingga payload respons memuat nilai lama.

## UI/UX & Aksesibilitas

- **Nested interactive element invalid + rejection clipboard tak tertangani** — `<button>` salin kode di `KelasOverviewClient` berada di dalam `<Link>` pembungkus kartu (button-dalam-anchor invalid HTML & bahaya fokus keyboard meski ada `preventDefault`/`stopPropagation`); kedua tombol salin memanggil `navigator.clipboard.writeText` tanpa `.catch`, jadi di context non-secure (HTTP) promise reject tanpa tertangani dan toast sukses tak pernah muncul.
- **Kartu filter status hanya bisa mouse** — `<div onClick>` filter di `SiswaListClient` tanpa `role="button"`, `tabIndex`, dan handler keyboard; pengguna keyboard/screen-reader tidak bisa menerapkan filter status.
- **Dark mode tidak konsisten di UI portal/auth baru** — container root dapat varian `dark:` tapi elemen dalam hardcode `bg-white`/`text-slate-900`/`border-slate-200` (dropdown sekolah, dropdown roster, kartu notice, chip konfirmasi; badge kode rombel `teal-800/teal-50` di `KelasOverviewClient` tanpa varian dark) — teks/background tak terbaca di dark mode.
- **State sensitif tertinggal setelah batal** — jalur "Batal"/"Ganti Kode" mereset nama/NIS/tanggal lahir tapi tidak pernah menghapus `regPin`/`regPinConfirm`, meninggalkan PIN pilihan di state komponen setelah form ditinggalkan.
- **Checkbox "Ingat sesi saya" dekoratif** — state `rememberMe` dan UI baru, tapi `handleLoginSubmit` tidak meneruskannya ke `loginStudent` (signature hanya menerima `schoolId`, `nis`, `pin`), jadi toggle tidak berpengaruh.

## Konsistensi & Higienitas Kode

- **Semantik `accountStatus` tidak konsisten antar panel** — daftar siswa menurunkan PENDING sebagai `accountStatus === "PENDING" && hasPin` (selain itu UNREGISTERED), sedangkan query approvals kini juga memasukkan PENDING dengan `accountRequestedAt` terisi tapi tanpa PIN — siswa seperti itu tampil "Belum Registrasi" di Daftar Siswa namun muncul di panel persetujuan.
- **Hitungan ganda di kartu statistik status** — `countActive/Pending/Unregistered` melakukan flatMap `classGroups.students`, sehingga siswa yang terdaftar di dua rombel guru dihitung dua kali, berbeda dari `totalStudents` ter-dedupe server yang ditampilkan di kartu sebelahnya.
- **Import tak terpakai** — `GraduationCap` di `src/app/(auth)/login/page.tsx` dan `ShieldCheck` di `src/app/(auth)/layout.tsx` tidak digunakan; keduanya akan memicu `noUnusedLocals`/lint.
- **Tidak ada test untuk perilaku baru** — tidak ada cakupan untuk branch PENDING/konflik `registerStudent`, `verifyStudentIdentity`, mapping roster `lookupJoinCode`, atau loop retry join-code di `createClassAction`; satu-satunya perubahan test adalah reorder import di `class-join-code.actions.test.ts`.

---

*Direview dari unified diff saja; temuan diverifikasi silang terhadap repo untuk import tak terpakai, signature `loginStudent`, union type `RegisterStudentResult`, isi `prisma/migrations/`, dan kelas squircle di `globals.css`.*
