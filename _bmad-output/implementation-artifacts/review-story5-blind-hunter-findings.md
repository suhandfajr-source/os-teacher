# Adversarial Blind Hunter Report: Story 5 (Guru Chat Interface, ActionConfirmCard, & Floating Launcher)

**Target Patch/Diff:** `_bmad-output/implementation-artifacts/diff-klassa-agent-ui.patch`  
**Target Prompt:** `_bmad-output/implementation-artifacts/review-story5-blind-hunter-prompt.md`  
**Reviewer Role:** Senior Principal Security & Systems Architect (Adversarial Blind Hunter)  
**Tanggal Review:** 2026-10-04  
**Status Evaluasi:** Selesai  

---

## Ringkasan Eksekutif
Inspeksi adversarial independen (blind review) dilakukan terhadap kode implementasi **Stage 12 Story 5: Guru Chat Interface, ActionConfirmCard, dan Floating Launcher**, mencakup rute streaming LLM (`src/app/api/agent/chat/route.ts`), antarmuka kartu konfirmasi aksi (`ActionConfirmCard.tsx`), launcher melayang (`FloatingAgentLauncher.tsx`), dan unit test terkait.

Secara keseluruhan, arsitektur antarmuka dan API streaming menunjukkan kepatuhan yang sangat baik terhadap batasan sesi (`verifyActiveSchoolMembership`), isolasi percakapan (`conversation.teacherProfileId === profile.id`), dan penegakan prinsip *Human-in-the-Loop* (HITL). Ditemukan satu kelemahan berperingkat **Major** terkait penanganan kegagalan asinkron pada persistensi pesan asisten yang perlu dimitigasi.

---

## 1. Temuan Berdasarkan Kategori

### [MAJOR] M-01: Silent Failure & Data Inconsistency pada Callback Asinkron `onFinish`
- **Lokasi:** `src/app/api/agent/chat/route.ts` (baris 131–150)
- **Deskripsi Masalah:**  
  Dalam pemanggilan `streamText`, persistensi respon asisten dan status `updatedAt` percakapan dijalankan di dalam callback `onFinish`:
  ```ts
  onFinish: async (event: any) => {
    try {
      await prisma.agentMessage.create({
        data: {
          conversationId: convId,
          role: "assistant",
          content: event.text,
          toolCalls: event.toolCalls ? (event.toolCalls as object) : undefined,
          toolResults: event.toolResults ? (event.toolResults as object) : undefined,
        },
      });
      await prisma.agentConversation.update({
        where: { id: convId },
        data: { updatedAt: new Date() },
      });
    } catch (dbErr) {
      console.error("Failed to persist assistant message:", dbErr);
    }
  }
  ```
  Pada lingkungan Next.js Serverless / Edge Runtime, ketika streaming respon HTTP selesai (`toTextStreamResponse()`), proses background yang belum selesai di `onFinish` dapat dihentikan secara tiba-tiba (*runtime freeze/termination*) atau jika terjadi error database, kesalahan hanya dicatat di `console.error` (*swallowed exception*).
- **Dampak:**  
  Guru melihat teks mengalir secara lengkap di layar obrolan, namun respon asisten beserta log `toolCalls`/proposal aksi gagal disimpan ke basis data PostgreSQL. Ketika guru me-refresh halaman atau membuka riwayat di sesi lain, pesan asisten dan kartu konfirmasi aksi hilang, mengakibatkan disinkronisasi riwayat obrolan (*ghost messages*).
- **Rekomendasi Perbaikan:**  
  Pastikan promise `onFinish` ditangani dengan aman atau gunakan `waitUntil` (jika di Next.js App Router serverless context) dan sertakan mekanisme retry/alerting log yang terstruktur.

---

### [MINOR] m-01: Validasi Karakter Panjang Input Pesan pada API Streaming
- **Lokasi:** `src/app/api/agent/chat/route.ts` (baris 21–27)
- **Deskripsi Masalah:**  
  Pemeriksaan input pesan saat ini hanya memvalidasi:
  ```ts
  if (!message || typeof message !== "string" || !message.trim()) { ... }
  ```
  Tidak ada batas panjang maksimum karakter (misal `message.length > 4000`).
- **Dampak:**  
  Pengguna jahat dapat mengirim string ratusan ribu karakter secara langsung via HTTP POST, membebani memori server dan kuota token LLM provider sebelum diproses.
- **Rekomendasi Perbaikan:**  
  Tambahkan validasi Zod atau batas maksimum karakter:
  ```ts
  if (message.length > 4000) {
    return NextResponse.json({ error: "Pesan terlalu panjang (maksimum 4000 karakter)." }, { status: 400 });
  }
  ```

---

### [MINOR] m-02: `classContextId` Belum Divalidasi Kepemilikannya saat Auto-Create Percakapan
- **Lokasi:** `src/app/api/agent/chat/route.ts` (baris 35)
- **Deskripsi Masalah:**  
  Ketika percakapan baru dibuat secara otomatis, nilai `classContextId` dari body request langsung disimpan ke `prisma.agentConversation.create` tanpa memverifikasi apakah `classContextId` tersebut adalah kelas sah di bawah wewenang guru yang bersangkutan.
- **Rekomendasi Perbaikan:**  
  Jika `classContextId` disertakan, lakukan verifikasi cepat dengan `verifyClassRosterAccess(classContextId)`.

---

### [PASS] P-01: Penegakan Batasan Sesi & Akses Percakapan
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  - Endpoint `/api/agent/chat` memanggil `verifyActiveSchoolMembership()` di awal eksekusi.
  - Jika `conversationId` dikirimkan, kepemilikan percakapan divalidasi secara tegas:
    ```ts
    if (!existingConv || existingConv.teacherProfileId !== profile.id) {
      return NextResponse.json({ error: "Akses percakapan ditolak atau tidak ditemukan." }, { status: 403 });
    }
    ```
  - Guru A secara absolut tidak dapat mengirim pesan atau mengakses percakapan milik Guru B.

---

### [PASS] P-02: Kepatuhan Penuh Human-in-the-Loop (HITL) pada UI
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  - Komponen `ActionConfirmCard` menampilkan status proposal secara transparan (`Menunggu`, `Dieksekusi`, `Dibatalkan`, `Kedaluwarsa`).
  - Tidak ada kode mutasi data otomatis yang berjalan di latar belakang tanpa penekanan tombol oleh guru.
  - Tombol aksi (`confirm-action-button` dan `cancel-action-button`) secara ketat menonaktifkan diri (`disabled={isLoading}`) dan menampilkan spinner saat request berlangsung, mencegah risiko race condition atau *double-click* dari pengguna di sisi klien.

---

### [PASS] P-03: Ketiadaan Kebocoran Data Sensitif (Data Exposure Check)
- **Status:** **PASS (Lolos)**
- **Analisis:**  
  - Header HTTP hanya mengembalikan `x-conversation-id`.
  - Tidak ada token API, password, atau credential sensitif yang diekspos ke DOM atau serialized JSON client.

---

## 2. Tabel Ringkasan Temuan

| ID | Kategori | Severity | Komponen | Status |
|---|---|---|---|---|
| M-01 | Async Persistence / Reliability | Major | `/api/agent/chat` (`onFinish`) | **NEEDS_FIX** (Potensi ghost message jika async diputus) |
| m-01 | Input Validation | Minor | `/api/agent/chat` | **RECOMMENDED** (Batas karakter pesan maks 4000) |
| m-02 | Scope Validation | Minor | `/api/agent/chat` | **RECOMMENDED** (Validasi `classContextId`) |
| P-01 | Session & Conversation Isolation | Pass | API Route | **SECURE** |
| P-02 | HITL Enforcement & Double Click | Pass | `ActionConfirmCard.tsx` | **SECURE** |
| P-03 | Sensitive Data Leakage | Pass | Chat UI & Route | **SECURE** |

---

## 3. Verdict Final

### **Verdict: APPROVE (With Fast-Follow Hardening on Async Persistence)**
Komponen antarmuka chat dan kartu konfirmasi aksi HITL dibangun dengan standar keamanan dan UX yang sangat baik. Celah **M-01** (pengamanan persistensi respon asisten pada callback asinkron) dan **m-01** disarankan untuk dimitigasi pada fase hardening berikutnya.
