# Adversarial Blind Hunter Report: Story 3 (Human-in-the-Loop Action Confirmation Engine)

**Target Patch:** `_bmad-output/implementation-artifacts/diff-klassa-agent-action-confirmation.patch`  
**Reviewer Role:** Adversarial Blind Hunter (Senior Principal Security & Systems Architect)  
**Tanggal Review:** 2026-10-03  
**Status Evaluasi:** Selesai  

---

## Ringkasan Eksekutif
Review ini menginspeksi implementasi **Stage 12 Story 3: Human-in-the-Loop (HITL) Action Confirmation Engine** pada Klassa Agent, yang mencakup mekanisme pengajuan proposal aksi mutasi (`proposeAttendanceLogTool`, `proposeClassAnnouncementTool`, `proposeAssignmentDraftTool`) dan eksekusi persetujuan oleh guru (`executeAgentAction`, `cancelAgentAction`, `getPendingActionProposals`).

Penerapan prinsip **Zero Autonomous Mutations** dan otorisasi multi-tenant terbukti kuat. Namun, ditemukan kerentanan **Race Condition / Double Execution (TOCTOU)** saat eksekusi konfirmasi aksi dan beberapa catatan status transition yang membutuhkan penguatan (*hardening*).

---

## 1. Temuan Berdasarkan Kategori

### [MAJOR] M-01: Race Condition & Double Mutation pada Eksekusi Proposal (TOCTOU)
- **Lokasi:** `src/modules/agent/agent-action.actions.ts` (`executeAgentAction`)
- **Deskripsi Masalah:**  
  Pemeriksaan status proposal dilakukan di awal (`if (proposal.status === "EXECUTED")`), namun pembaruan status ke `EXECUTED` baru dilakukan di akhir setelah proses mutasi data (pembuatan tugas / presensi) selesai:
  ```ts
  // 1. Cek status di awal (NON-ATOMIC)
  if (proposal.status === "EXECUTED") return ...;

  // 2. Eksekusi mutasi (misal: prisma.assignment.create)
  const assignment = await prisma.assignment.create(...);

  // 3. Update status proposal di akhir
  await prisma.agentActionProposal.update({
    where: { id: proposalId },
    data: { status: "EXECUTED", ... }
  });
  ```
- **Vektor Eksploitasi / Dampak:**  
  Jika seorang guru secara tidak sengaja melakukan *double-click* cepat pada tombol konfirmasi, atau terjadi re-submission jaringan konkuren:
  1. Permintaan 1 dan Permintaan 2 membaca proposal dengan status `PENDING` secara bersamaan.
  2. Kedua permintaan lolos pemeriksaan awal.
  3. Mutasi penugasan dijalankan dua kali, menghasilkan 2 record tugas duplikat di database (`Assignment`).
- **Rekomendasi Perbaikan:**  
  Gunakan pembaruan status kondisional atomik (*atomic conditional update*) sebelum atau di dalam transaksi eksekusi:
  ```ts
  const updatedProposal = await prisma.agentActionProposal.updateMany({
    where: {
      id: proposalId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    data: {
      status: "EXECUTED",
      executedAt: new Date(),
    },
  });

  if (updatedProposal.count === 0) {
    return {
      success: false,
      message: "Aksi tidak dapat dieksekusi (sudah dieksekusi, dibatalkan, atau kedaluwarsa).",
    };
  }
  ```

---

### [MINOR] m-01: Pemeriksaan Status Non-Pending Bersifat Longgar
- **Lokasi:** `src/modules/agent/agent-action.actions.ts` (`executeAgentAction`)
- **Deskripsi Masalah:**  
  `executeAgentAction` secara eksplisit memeriksa `proposal.status === "EXECUTED"` dan `proposal.status === "CANCELLED"`. Namun, jika proposal berada pada status selain itu (misalnya `EXPIRED` yang sudah tercatat sebelumnya), logika mengandalkan pengecekan waktu `now > proposal.expiresAt`.
- **Rekomendasi Perbaikan:**  
  Gunakan pengecekan *whitelist* status yang ketat:
  ```ts
  if (proposal.status !== "PENDING") {
    return {
      success: false,
      message: `Proposal tidak dapat dieksekusi karena berstatus ${proposal.status}.`,
    };
  }
  ```

---

### [MINOR] m-02: `CREATE_ANNOUNCEMENT` Belum Memiliki Persistensi Entitas Database
- **Lokasi:** `src/modules/agent/agent-action.actions.ts` (baris 218–236)
- **Deskripsi Masalah:**  
  Pada eksekusi aksi tipe `CREATE_ANNOUNCEMENT`, data tidak disimpan ke tabel pengumuman resmi melainkan hanya menghasilkan log di objek `executionResultData` pada proposal itu sendiri.
- **Dampak:**  
  Tidak ada kebocoran data atau risiko keamanan, namun pengumuman tidak tersimpan di modul pengumuman sekolah/kelas permanen.
- **Rekomendasi Perbaikan:**  
  Jika skema pengumuman resmi sudah tersedia di masa mendatang, tautkan penyimpanan ke entitas database terkait atau integrasikan dengan webhook/notifikasi sekolah.

---

### [PASS] P-01: Penegakan Human-in-the-Loop (Zero Autonomous Mutations)
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  - Seluruh tool mutasi (`proposeAttendanceLogTool`, `proposeClassAnnouncementTool`, `proposeAssignmentDraftTool`) hanya menyusun draf proposal dengan status `PENDING` dan `requiresConfirmation: true`.
  - Tidak ada mutasi langsung ke tabel `AttendanceRecord`, `TeachingSession`, atau `Assignment` dari dalam tool LLM.
  - Fungsi `executeAgentAction` berada di file server action terpisah dan **tidak** didaftarkan sebagai tool agen yang bisa dipanggil mandiri oleh LLM.

---

### [PASS] P-02: Otorisasi Multi-Tenant & Scope Rombel B2
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  - **Isolasi Sekolah:** `executeAgentAction` memvalidasi `proposal.schoolId !== activeSchoolId`.
  - **Kepemilikan Guru:** `proposal.teacherProfileId !== profile.id` memblokir percobaan guru A untuk mengeksekusi proposal guru B.
  - **Scope Rombel B2:** Memanggil `verifyClassRosterAccess(proposal.classId)` sebelum mutasi dijalankan.

---

### [PASS] P-03: TTL Kedaluwarsa Proposal
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  Proposal secara default diberi masa aktif 15 menit (`PROPOSAL_TTL_MINUTES = 15`). Jika proposal dieksekusi setelah waktu kedaluwarsa, sistem otomatis mengubah status menjadi `EXPIRED` dan menolak eksekusi.

---

## 2. Tabel Ringkasan Temuan

| ID | Kategori | Severity | Komponen | Status |
|---|---|---|---|---|
| M-01 | Anti-Replay / Concurrency | Major | `executeAgentAction` | **NEEDS_FIX** (Double-submit race condition) |
| m-01 | State Transition | Minor | `executeAgentAction` | **RECOMMENDED** (Gunakan whitelist `status !== 'PENDING'`) |
| m-02 | Data Persistence | Minor | `CREATE_ANNOUNCEMENT` | **INFO** (Log-only result) |
| P-01 | HITL Enforcement | Pass | Tools Propose | **SECURE** |
| P-02 | Tenant & Rombel Isolation | Pass | Actions & Scope | **SECURE** |
| P-03 | Anti-Replay TTL | Pass | Action Expiry | **SECURE** |

---

## 3. Verdict Final

### **Verdict: APPROVE (With Fast-Follow Hardening on Concurrency)**
Implementasi arsitektur **Human-in-the-Loop** pada Story 3 sudah sangat kokoh secara konsep dan pengamanan otorisasi. Agen 100% terkunci dari mutasi liar tanpa persetujuan guru. Temuan **M-01** (pencegahan race condition double-submit) direkomendasikan untuk diterapkan via conditional update atomik pada fase hardening.
