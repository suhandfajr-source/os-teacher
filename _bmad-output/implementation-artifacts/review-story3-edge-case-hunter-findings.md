# Hasil Review: Edge Case Hunter — Story 3 (Klassa Agent HITL Action Confirmation Engine)

**Sumber Prompt:** `_bmad-output/implementation-artifacts/review-story3-edge-case-hunter-prompt.md`  
**Spesifikasi:** `_bmad-output/implementation-artifacts/spec-klassa-agent-action-confirmation.md`  
**Patch Target:** `_bmad-output/implementation-artifacts/diff-klassa-agent-action-confirmation.patch`  
**Fitur:** Klassa Agent Human-in-the-Loop Action Confirmation Engine  

---

## 1. Temuan Kritis (Critical & Major)

### CRITICAL: Race Condition pada Double-Click Konfirmasi (`agent-action.actions.ts:47-75, 235`)
- **Pemicu:** Guru mengklik tombol "Konfirmasi" dua kali dalam selang waktu sangat singkat (atau request ganda dari dua tab).
- **Mekanisme:** Pemeriksaan status proposal (`proposal.status === "EXECUTED"`) dilakukan sebelum mutasi, sedangkan perubahan status ke `"EXECUTED"` baru dilakukan setelah seluruh mutasi selesai tanpa lock transaksi.
- **Dampak:** Dua request paralel dapat lolos validasi status secara bersamaan, menyebabkan duplikasi record `TeachingSession` dan `Assignment` di database.
- **Mitigasi:** Gunakan conditional update atomik sebagai *gate lock*:
  ```ts
  const affected = await prisma.agentActionProposal.updateMany({
    where: { id: proposalId, status: "PENDING" },
    data: { status: "EXECUTED", executedAt: new Date() },
  });
  if (affected.count === 0) {
    return { success: false, message: "Aksi sudah atau sedang diproses." };
  }
  ```

### MAJOR: Boundary Transaksi Parsial pada Pembuatan Penugasan (`agent-action.actions.ts:200-240`)
- **Pemicu:** Kegagalan jaringan atau timeout setelah `prisma.assignment.create` berhasil tetapi sebelum `prisma.agentActionProposal.update` dijalankan.
- **Dampak:** Assignment tersimpan di database, tetapi status proposal tetap `PENDING`. Guru yang mengklik ulang akan membuat tugas duplikat.
- **Mitigasi:** Satukan mutasi assignment dan update proposal ke dalam satu `prisma.$transaction`.

---

## 2. Temuan Minor & Catatan Desain

- **MINOR (Keanggotaan Rombel):** Array presensi `records` divalidasi foreign key ke tabel `Student`, namun belum memverifikasi apakah siswa benar-benar terdaftar di `ClassStudent` pada `classId` yang dituju.
- **MINOR (Aksi Pengumuman):** `CREATE_ANNOUNCEMENT` saat ini hanya menghasilkan response stub tanpa tabel persistensi pengumuman.

---

## 3. Evaluasi Invarian (PASS)

- **Payload Drift / Schema Validation (PASS):** Seluruh payload (`RECORD_ATTENDANCE`, `CREATE_ASSIGNMENT`, `CREATE_ANNOUNCEMENT`) divalidasi ulang dengan Zod `safeParse` sebelum dieksekusi.
- **Isolasi Multi-tenant & Otorisasi Rombel (PASS):** Divalidasi ketat terhadap `activeSchoolId`, `teacherProfileId`, dan `verifyClassRosterAccess`.
- **TTL Kedaluwarsa (PASS):** Proposal melewati batas 15 menit otomatis ditandai `EXPIRED` dan ditolak.
- **Rollback Presensi (PASS):** Pembuatan sesi dan seluruh item presensi dibungkus dalam `tx.$transaction` sehingga rollback berjalan atomik jika ada record yang gagal.

---

## 4. Verdict Akhir

**`NEEDS_HARDENING`**
