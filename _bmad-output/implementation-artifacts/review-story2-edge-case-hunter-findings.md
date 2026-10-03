# Hasil Review: Edge Case Hunter — Story 2 (Lampiran Guru pada Tugas)

**Sumber Prompt:** `_bmad-output/implementation-artifacts/review-story2-edge-case-hunter-prompt.md`  
**Fitur:** Guru melampirkan file/materi/soal pada tugas (Assignment Attachments)  
**Total Temuan:** 20 temuan (15 edge-case jalur eksekusi & batas domain, 4 klaim spesifikasi terfalsifikasi, 1 regresi deletion contract)  
*(Sesuai panduan Edge Case Hunter: murni penelusuran jalur eksekusi/path tracer tanpa opini subjektif atau ranking prioritas acak)*

---

## 1. Ringkasan Temuan Kritis (Otorisasi, Keamanan & Integritas)

### 1. Guru Pemilik Terkunci 403 Akibat Sisa Cookie Sesi Siswa (`upload-url/route.ts:68-74`)
- **Kondisi:** Di route `upload-url`, pemeriksaan lampiran (`kind === "attachment"`) langsung mengecek `verifyStudentSession()`. Jika cookie siswa (`klassa_student_session`) ditemukan di browser, route langsung melempar 403: *"Hanya guru pemilik kelas yang dapat mengunggah lampiran."*
- **Dampak:** Guru yang pernah mencoba atau login ke portal siswa pada peramban yang sama (atau komputer laboratorium bersama) akan langsung terblokir total dari mengunggah lampiran tugas, meski memiliki sesi guru aktif yang sah.
- **Rekomendasi Guard:**
  ```ts
  const auth = await verifyTeachingContextAccess(teachingContextId).catch(() => null);
  if (!auth) {
    const studentSession = await verifyStudentSession();
    if (studentSession) {
      return NextResponse.json({ error: "Hanya guru pemilik kelas yang dapat mengunggah lampiran." }, { status: 403 });
    }
    return NextResponse.json({ error: "Kelas tidak tersedia." }, { status: 404 });
  }
  ```

### 2. Guru dengan Status Dibekukan (`isBanned`) Tetap Dapat Mengunduh & Mengubah Lampiran (`route.ts:52-58`, `assignment.actions.ts:646, 718`, `upload-url/route.ts:79-84`)
- **Kondisi:** `verifyTeachingContextAccess` tidak melempar error saat `isBanned === true`, melainkan mengembalikan properti `{ isBanned: true }`. Sementara `createAssignment` memanggil `assertNotBanned(auth)`, route unduhan `attachments/[fileId]`, aksi `setAssignmentAttachmentsAction`, `getAssignmentAttachmentsAction`, dan route `upload-url` sama sekali tidak memeriksa properti `auth.isBanned`.
- **Dampak:** Guru yang akun sekolahnya telah dinonaktifkan atau dibekukan oleh admin masih dapat mengunggah file baru ke S3, mengubah daftar lampiran tugas, melihat daftar lampiran, dan mengunduh berkas lampiran.
- **Rekomendasi Guard:**
  ```ts
  const auth = await verifyTeachingContextAccess(teachingContextId);
  if (auth.isBanned) throw new Error("Akun Anda telah dinonaktifkan.");
  ```

### 3. Siswa Dinonaktifkan Tetap Dapat Mengunduh Lampiran Tugas (`attachments/[fileId]/route.ts:61-73`)
- **Kondisi:** Validasi akses siswa di route attachment hanya memeriksa tabel `classStudent` dengan filter `academicPeriod: { status: "ACTIVE" }`. Berbeda dengan route `upload-url` (Story 1) yang memeriksa `student.status === "ACTIVE" && student.accountStatus === "ACTIVE"`, route ini tidak memeriksa status akun siswa.
- **Dampak:** Siswa yang telah dinonaktifkan, ditolak, atau diblokir dari sekolah tetap bisa mengunduh file materi/soal rahasia tugas kelas selama cookie JWT sesi siswa belum kadaluarsa.
- **Rekomendasi Guard:**
  ```ts
  const student = await prisma.student.findUnique({
    where: { id: studentSession.studentId },
    select: { status: true, accountStatus: true },
  });
  if (!student || student.status !== "ACTIVE" || student.accountStatus !== "ACTIVE") {
    return notFound();
  }
  ```

---

## 2. Temuan UI & Sinkronisasi State (Client-Side)

### 4. Hilangnya File Permanen Akibat Batal Hapus di Dialog (`AssignmentAttachmentsDialog.tsx:210-216`)
- **Kondisi:** Menghapus lampiran lama di dialog langsung memutasi state lokal `kept` via `setKept(kept.filter(...))`. Namun jika guru menutup modal dengan tombol `X` (`setOpen(false)`) tanpa mengklik simpan, state `kept` tidak pernah di-reset ke `initialAttachments`.
- **Dampak:** Saat guru membuka kembali dialog di kemudian hari dan menambah file baru lalu klik simpan, file yang sebelumnya tidak sengaja terhapus akan ikut terhapus permanen dari basis data dan storage S3 tanpa konfirmasi.
- **Rekomendasi Guard:**
  ```ts
  const handleClose = () => {
    setKept(initialAttachments);
    setPendingFiles([]);
    setOpen(false);
  };
  ```

### 5. Tombol Simpan Lampiran Tetap Aktif Pasca-Simpan (`AssignmentAttachmentsDialog.tsx:248-251`)
- **Kondisi:** Properti `disabled` menggunakan perbandingan panjang array: `disabled={busy || (pendingFiles.length === 0 && kept.length === initialAttachments.length)}`. Jika guru menghapus 1 file (misal dari 2 file awal menjadi 1 file) lalu sukses menyimpan, `kept.length` menjadi 1 sedangkan prop `initialAttachments.length` tetap bernilai 2.
- **Dampak:** `1 === 2` bernilai false, sehingga tombol "Simpan Lampiran" tetap menyala aktif meskipun data sudah tersimpan rapi di server. Guru dapat mengklik simpan berulang-ulang tanpa sadar.
- **Rekomendasi Guard:**
  ```ts
  const isDirty = pendingFiles.length > 0 || kept.length !== initialAttachments.length || !kept.every((k) => initialAttachments.some((init) => init.id === k.id));
  ```

### 6. Link Lampiran di Dialog Guru Memaksa Download (`AssignmentAttachmentsDialog.tsx:200-207`)
- **Kondisi:** Elemen `<a>` pada daftar lampiran yang dipertahankan menggunakan `href={`/api/assignments/attachments/${f.id}`}` tanpa menyertakan parameter `?disposition=inline`.
- **Dampak:** Format file pratinjau (seperti PDF atau gambar JPEG/PNG) tidak ditampilkan inline di tab baru melainkan langsung memicu unduhan browser, menyulitkan guru yang ingin mengecek isi soal sebelum disimpan.
- **Rekomendasi Guard:**
  ```tsx
  href={`/api/assignments/attachments/${f.id}${f.isPreviewable ? "?disposition=inline" : ""}`}
  ```

### 7. Layout Overflow Nama File Panjang di Portal Siswa (`siswa/portal/tugas/page.tsx:115-132`)
- **Kondisi:** Chip nama file pada kartu tugas siswa dirender tanpa pembatas lebar (`max-w`) dan tanpa utilitas `truncate` / `min-w-0`.
- **Dampak:** Guru yang mengunggah berkas dengan nama panjang (hingga 200 karakter) akan menyebabkan chip meluber keluar kartu pada layar ponsel siswa, memicu horizontal scrollbar yang merusak tampilan UI.
- **Rekomendasi Guard:**
  ```tsx
  <span className="truncate max-w-[160px] sm:max-w-[240px]" title={att.originalName}>
    {att.originalName}
  </span>
  ```

### 8. Orphan Files saat Kegagalan Unggah Parsial Multi-file (`AssignmentAttachmentsDialog.tsx:124-142`)
- **Kondisi:** Pada loop unggah berkas pending ke presigned S3, jika berkas ke-1 berhasil diunggah namun berkas ke-2 gagal (misal koneksi putus atau timeout), blok `catch` menghentikan alur tanpa membersihkan berkas ke-1 yang telah masuk ke bucket S3.
- **Dampak:** File sementara yatim menumpuk di prefix `attachments/tmp/` tanpa pernah diklaim di basis data ataupun dihapus oleh klien.
- **Rekomendasi Guard:**
  ```ts
  catch (err) {
    if (uploaded.length > 0) {
      deleteObjects(uploaded.map((u) => u.storageKey)).catch(console.error);
    }
    toast.error(`File "${pendingFiles[i].name}" gagal diunggah`);
    setBusy(false);
    return;
  }
  ```

---

## 3. Temuan Kontrak & Klaim Spesifikasi (Step 4 & 5)

| Jenis | Lokasi | Trigger / Klaim | Dampak Terverifikasi |
|---|---|---|---|
| **Claim (High)** | `route.ts:52-58` | Akses unduh guru via `verifyTeachingContextAccess` | Guru yang akunnya di-banned admin tetap bisa mengunduh lampiran karena `isBanned` diabaikan. |
| **Claim (High)** | `upload-url/route.ts:68-74` | Route presign kind=attachment wajib sesi guru pemilik | Guru sah ditolak 403 jika browser memiliki cookie siswa tersisa dari pengujian sebelumnya. |
| **Claim (High)** | `route.ts:61-73` | Akses siswa dengan membership aktif di rombel+periode | Siswa nonaktif / ditolak tetap bisa mengunduh materi karena status akun tidak divalidasi. |
| **Claim (Medium)** | `AssignmentAttachmentsDialog.tsx:200` | Pratinjau inline hanya tipe previewable | Dialog kelola guru selalu mengunduh file karena tautan tidak membawa `?disposition=inline`. |
| **Deletion (Medium)** | `upload-url/route.ts:50-54` | Kontrak 401 saat sesi tidak ada sebelum validasi body | Permintaan tanpa sesi yang mengirimkan body malformed kini menerima 400 Bad Request / 404 alih-alih 401. |

---

## 4. Daftar Lengkap Temuan (JSON Artifact)

File artefak terstruktur lengkap dengan format mesin telah disimpan di:  
`_bmad-output/implementation-artifacts/review-story2-edge-case-hunter-findings.json`
