# Hasil Review Edge-Case Hunter: Story 5 (Klassa Agent Guru Chat Interface, ActionConfirmCard & Floating Launcher)

- **Sumber Prompt:** `_bmad-output/implementation-artifacts/review-story5-edge-case-hunter-prompt.md`
- **Spesifikasi Acuan:** `_bmad-output/implementation-artifacts/spec-klassa-agent-ui.md`
- **File Patch yang Diuji:** `_bmad-output/implementation-artifacts/diff-klassa-agent-ui.patch`
- **Peran:** Lead QA & Reliability Engineer (Edge-Case Hunter)
- **Tanggal:** 4 Oktober 2026

---

## 1. Analisis 4 Fokus Review Utama

### 1.1. Streaming & Network Disruption
- **Analisis Alur Eksekusi:**
  - Pada `AsistenClient.tsx` dan `FloatingAgentLauncher.tsx`:
    - Sebelum fetch dilakukan, state `isStreaming` diset `true` dan pesan asisten kosong ditambahkan secara optimistik.
    - Pembacaan stream dibungkus dalam blok `try ... catch ... finally`.
    - `finally` selalu memanggil `setIsStreaming(false)`.
  - **Skenario Gangguan Koneksi di Tengah Stream:**
    - Jika stream terputus saat membaca chunk (`reader.read()` melempar error atau koneksi drop), blok `catch` menangkap error dan mengupdate bubble asisten dengan pesan ramah: *"Maaf, terjadi kendala saat memproses jawaban. Silakan coba lagi."*
    - State `isStreaming` dikembalikan ke `false` sehingga tombol kirim dan textarea kembali aktif dan responsif (tidak macet atau terjebak dalam status loading selamanya).
  - **Skenario Unload / Tab Ditutup di Tengah Stream:**
    - Di sisi server (`route.ts`), callback `onFinish` menyimpan potongan respons teks yang berhasil digenerate ke database. Jika koneksi klien putus, Next.js abort controller membatalkan stream tanpa merusak transaksi database.
- **Tingkat Keparahan:** **PASS (Sangat Baik)**.

---

### 1.2. Action Proposal Sync & Status Transitions
- **Analisis Alur Eksekusi:**
  - Komponen `ActionConfirmCard.tsx` memiliki local state:
    `const [currentStatus, setCurrentStatus] = useState<string>(proposal.status);`
  - Saat guru mengklik tombol "Konfirmasi & Simpan":
    - Handler memanggil Server Action `executeAgentAction(proposal.id)`.
    - Jika sukses, local state `currentStatus` langsung diubah menjadi `"EXECUTED"`, badge warna hijau muncul instan, dan callback `onExecuted?.(proposal.id)` dipanggil.
    - Tidak perlu me-reload seluruh halaman browser.
  - Begitu pula saat dibatalkan ("Batalkan"):
    - Local state `currentStatus` langsung diubah menjadi `"CANCELLED"` dan badge abu-abu ditampilkan.
  - **Penanganan Proposal Kedaluwarsa (TTL 15 Menit):**
    - `ActionConfirmCard` memeriksa `currentStatus === "EXPIRED"`.
    - Jika waktu sudah lewat saat tombol konfirmasi diklik, backend `executeAgentAction` menolak dengan pesan error *"Masa berlaku konfirmasi aksi ini telah kedaluwarsa"*, status diubah menjadi `"EXPIRED"`, dan tombol dinonaktifkan.
- **Celah Boundary Sinkronisasi di AsistenClient:**
  - Pada `AsistenClient.tsx` (baris 94), saat riwayat pesan dimuat ulang dari database, proposal aksi dipasangkan ke pesan via indeks array: `const attachedProposal = loadedProposals[idx] || null;`.
  - **Risiko Boundary:** Pemetaan berdasarkan indeks array (`loadedProposals[idx]`) sangat rapuh terhadap pergeseran (*index misalignment*) jika satu percakapan memiliki pesan user tanpa proposal atau jika satu giliran asisten menghasilkan multi-turn proposals.
- **Tingkat Keparahan:** **MAJOR**.
- **Rekomendasi Guard:**
  Relasikan proposal secara eksplisit berdasarkan `message.toolCalls` / `proposal.id` atau simpan `proposalId` di `AgentMessage.pendingAction`, bukan berdasarkan kesamaan indeks array.

---

### 1.3. Floating Launcher Context Conflict
- **Analisis Alur Eksekusi:**
  - Pada `FloatingAgentLauncher.tsx`:
    ```tsx
    const pathname = usePathname();
    if (pathname?.startsWith("/asisten")) {
      return null;
    }
    ```
    Terverifikasi aman: widget melayang secara otomatis menghilang saat guru bernavigasi ke halaman `/asisten`, mencegah tampilan ganda atau redundansi antarmuka.
  - **Stabilitas Layout Dashboard:**
    - Launcher menggunakan container berpembatas `fixed bottom-6 right-6 z-50`.
    - Tidak mengintervensi flow DOM reguler halaman utama (`position: fixed`).
    - Popover chat memiliki dimensi terisolasi (`w-[380px] sm:w-[420px] max-h-[580px]`) dengan bayangan dan border mandiri, sehingga perpindahan halaman tidak merusak layout dashboard sekolah.
- **Tingkat Keparahan:** **PASS (Sangat Baik)**.

---

### 1.4. Input Sanitization & Empty Messages
- **Analisis Boundary:**
  - Di sisi Klien (`AsistenClient.tsx` & `FloatingAgentLauncher.tsx`):
    ```ts
    const text = (textToSend || inputMessage).trim();
    if (!text || isStreaming) return;
    ```
    Input yang hanya terdiri dari whitespace, enter berulang, atau string kosong tidak akan pernah mentrigger fetch ke API.
  - Di sisi Server (`/api/agent/chat/route.ts`):
    ```ts
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });
    }
    ```
    Permintaan HTTP langsung ditolak dengan status 400 Bad Request jika klien mem-bypass validasi antarmuka.
  - Sanitasi Konten: Pesan di-trim sebelum disimpan ke tabel `agent_message` dan `agent_conversation`.
- **Tingkat Keparahan:** **PASS (Sangat Baik)**.

---

## 2. Tabel Ringkasan Temuan Review

| Kategori | Lokasi | Skenario Pemicu | Dampak | Rekomendasi Mitigasi |
|:---:|---|---|---|---|
| **MAJOR** | `AsistenClient.tsx:93-98` | Reload riwayat obrolan di mana jumlah pesan tidak 1:1 dengan jumlah proposal | Proposal terpasang ke bubble pesan yang salah akibat pemetaan `loadedProposals[idx]`. | Petakan proposal berdasarkan ID relasi di `message.toolResults` atau `pendingAction`. |
| **MINOR** | `AsistenClient.tsx:252-264` | Pembuatan proposal baru via tool dalam streaming chat | `setTimeout(..., 600)` mengasumsikan proposal selesai ditulis dalam 600ms; jika jaringan lambat kartu konfirmasi baru muncul setelah refresh. | Kirimkan event/metadata `proposalId` di akhir response stream header atau SSE chunk. |
| **PASS** | `AsistenClient.tsx:220-275` | Stream terputus di tengah jalan akibat gangguan sinyal | Error tertangkap, pesan ramah ditampilkan, state `isStreaming` kembali `false` tanpa macet. | Terverifikasi aman. |
| **PASS** | `ActionConfirmCard.tsx:75-115` | Guru klik tombol "Konfirmasi" atau "Batalkan" | Local state terupdate instan, badge berubah tanpa reload halaman penuh. | Terverifikasi aman. |
| **PASS** | `FloatingAgentLauncher.tsx:32-35` | Pengguna membuka URL `/asisten` | Floating widget otomatis `return null` (tersembunyi) mencegah redundansi UI. | Terverifikasi aman. |
| **PASS** | `route.ts:24-29` | Pengguna mengirim pesan spasi atau string kosong | Ditolak di client dan server dengan 400 Bad Request. | Terverifikasi aman. |

---

## 3. Verdict Akhir

### **Verdict: ACCEPTABLE (with Hardening Notes)**

**Justifikasi:**
Antarmuka pengguna Klassa Agent pada Story 5 memiliki kualitas UX yang sangat baik, streaming yang tangguh terhadap pemutusan jaringan, pencegahan input kosong berlapis, dan integrasi Floating Launcher yang bersih tanpa merusak tata letak dashboard. 

Temuan **MAJOR** terkait pemetaan proposal riwayat berbasis indeks array (`loadedProposals[idx]`) tidak memicu crash runtime, namun perlu dirapikan dengan relasi ID eksplisit agar kartu konfirmasi selalu melekat pada bubble pesan yang tepat saat riwayat obrolan lama dimuat ulang.
