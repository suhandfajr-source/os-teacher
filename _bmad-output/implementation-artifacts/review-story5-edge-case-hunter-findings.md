# Hasil Review: Edge Case Hunter — Story 5 (Klassa Agent Guru Chat Interface, ActionConfirmCard & Floating Launcher)

**Sumber Prompt:** `_bmad-output/implementation-artifacts/review-story5-edge-case-hunter-prompt.md`  
**Spesifikasi:** `_bmad-output/implementation-artifacts/spec-klassa-agent-ui.md`  
**Patch Target:** `_bmad-output/implementation-artifacts/diff-klassa-agent-ui.patch`  
**Fitur:** Klassa Agent Guru Chat Interface, ActionConfirmCard & Floating Launcher  

---

## 1. Analisis 4 Fokus Review Utama

### 1.1. Streaming & Network Disruption (PASS)
- Jika stream terputus di tengah jalan (network failure atau user abort), blok `catch` menangkap error dan mengembalikan pesan ramah pengguna.
- Blok `finally` selalu mengeksekusi `setIsStreaming(false)` sehingga antarmuka tidak pernah terjebak dalam status loading tak terhingga.
- Sisi server (`route.ts`) menangani abort signal secara aman dan menyimpan token yang sudah berhasil digenerate via `onFinish`.

### 1.2. Action Proposal Sync & Status Transitions (MAJOR & PASS)
- **Status Transitions (PASS):** Eksekusi atau pembatalan proposal pada `ActionConfirmCard` memutasi state lokal secara instan (`EXECUTED` / `CANCELLED`), menampilkan toast notifikasi, dan tidak memerlukan reload halaman penuh. Penanganan TTL kedaluwarsa divalidasi aman di sisi backend.
- **Proposal History Alignment (MAJOR):** Di `AsistenClient.tsx`, proposal riwayat dipasangkan ke pesan chat menggunakan indeks array (`loadedProposals[idx]`). Pola ini rapuh terhadap pergeseran (*index misalignment*) jika rasio jumlah pesan dan proposal tidak 1:1. Disarankan memetakan berdasarkan ID proposal secara eksplisit.

### 1.3. Floating Launcher Context Conflict (PASS)
- Widget melayang `FloatingAgentLauncher` secara eksplisit memeriksa `pathname?.startsWith("/asisten")` dan me-return `null` saat guru berada di halaman obrolan penuh, mencegah redundansi visual ganda.
- Menggunakan CSS fixed positioning terisolasi sehingga tidak mempengaruhi layout dashboard utama saat navigasi antar menu.

### 1.4. Input Sanitization & Empty Messages (PASS)
- Klien memfilter string kosong dan spasi menggunakan `.trim()`. Tombol submit otomatis nonaktif saat teks kosong atau saat streaming sedang berjalan.
- Route server `/api/agent/chat` memvalidasi `!message.trim()` dan mengembalikan `400 Bad Request` sebagai lapisan pertahanan kedua.

---

## 2. Ringkasan Temuan Berdasarkan Kategori

| Kategori | Lokasi | Skenario Pemicu | Dampak | Rekomendasi |
|:---:|---|---|---|---|
| **MAJOR** | `AsistenClient.tsx:93-98` | Memuat ulang riwayat chat dengan banyak pesan tanpa proposal | Proposal kartu berpotensi terpasang ke bubble pesan yang salah akibat pemetaan `loadedProposals[idx]`. | Simpan dan kaitkan `proposalId` langsung di atribut pesan atau metadata tool call. |
| **MINOR** | `AsistenClient.tsx:252-264` | Pembuatan proposal baru dalam streaming chat | Menggunakan `setTimeout(..., 600)` untuk fetch proposal pasca-stream. | Sertakan metadata proposal di stream header / chunk akhir agar instan. |
| **PASS** | `AsistenClient.tsx:220-275` | Gangguan sinyal internet saat token mengalir | UI tetap responsif, state loading dilepas, pesan error ramah ditampilkan. | - |
| **PASS** | `ActionConfirmCard.tsx:75-115` | Transisi status kartu konfirmasi | Badge warna berubah instan tanpa me-reload browser. | - |
| **PASS** | `FloatingAgentLauncher.tsx:32-35` | Pengguna membuka rute `/asisten` | Launcher otomatis tersembunyi. | - |
| **PASS** | `route.ts:24-29` | Pengiriman pesan kosong atau whitespace | Ditolak di client dan server (HTTP 400). | - |

---

## 3. Verdict Akhir

**`ACCEPTABLE (with Hardening Notes)`**
