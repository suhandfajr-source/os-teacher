# Forged Idea — Klassa Agent

Status: **HARDENED (REVISED)** — 2 Okt 2026 · Sesi: `_bmad-output/forge/klassa-agent/`

## Keputusan (Locked)

### 1. Karakter, Bentuk Produk & Universal Multi-Model
- **Bentuk:** Chatbot asisten percakapan cerdas di portal guru Klassa (halaman `/asisten` + tombol pintasan terapung di dashboard).
- **Substrate Teknis:** Agen kustom milik Klassa sendiri di atas Vercel AI SDK, memisahkan otak model dari logika alat bantu (*tools*).
- **Universal Multi-Model (Bebas LLM Apa Saja):** Agen bebas dari vendor lock-in. Model-model yang disebutkan (Gemini, Claude, GPT, DeepSeek, Hermes, Ollama) hanyalah acuan/contoh. Pengembang/sekolah bebas memasang LLM apa pun (komersial maupun open-weights lokal via OpenAI-compatible endpoint) tanpa merombak satu pun fungsi alat bantu.

### 2. Definisi Tugas Luas & Matriks Konfirmasi
- **Cakupan:** Meliputi **semua tindakan yang dapat dilakukan guru di Klassa** (mengelola absen, input nilai, pembuatan kuis/tugas, catatan monitoring, hingga komunikasi orang tua).
- **Matriks Aksi:**
  - *Aksi Hijau (Aman / Read-Only / Draf):* Dijalankan langsung (query data, kalkulasi tren, draf modul ajar/RPP).
  - *Aksi Kuning/Merah (Sensitif & Berdampak Besar):* Wajib persetujuan eksplisit guru via kartu interaktif di chat (simpan absen resmi, simpan nilai, rilis tugas baru, kirim pengumuman).
- **Kalkulasi Deterministik Komprehensif:** LLM dilarang berhitung mandiri. **Semua hal di Klassa yang bisa dikalkulasi** (nilai rata-rata, persentase absen, jumlah submit tugas, ranking/peringkat, durasi kuis, batas remedial, kuota) dihitung 100% presisi oleh fungsi kode program Next.js.

### 3. Sistem Memori Komprehensif (Rangkuman Obrolan Umum)
- **Short-Term Memory:** Konteks obrolan pada sesi aktif.
- **Long-Term Memory:** Mesin perangkum otomatis membaca dan merangkum intisari pembahasan chat guru secara umum (proyek mengajar, kendala spesifik siswa, preferensi pedagogis) agar agen senantiasa kontekstual terhadap dinamika mengajar guru. Guru memegang kendali penuh untuk menyunting/mereset ingatan agen.

### 4. Privasi, Kebijakan Topik & PII
- **Cakupan Kuasa (Authorization Scope):** Agen dibatasi ketat oleh fungsi otorisasi `isPengampuRombel` (B2) — guru hanya dapat mengakses data siswa dari rombel yang diampunya. Data rombel lain ditolak di level server.
- **Transparansi Kontekstual:** Nama dan NIS siswa dikirimkan apa adanya ke konteks model untuk kealamian percakapan ("Budi terlambat hari ini"), dengan pagar audit logging yang menyensor token/kredensial rahasia (`redactMetadata`).
- **Kebijakan Ruang Lingkup Topik:**
  - Pertanyaan pendidikan umum di luar kelas (Kurikulum Merdeka, sertifikasi PMM, pedagogi, rapat komite) dilayani dan dijawab 100%.
  - Pertanyaan non-pendidikan (resep, gosip, olahraga, politik) ditolak halus dan dialihkan kembali ke urusan kelas.
- **Pagar Pedagogis:** Menolak memberikan diagnosis klinis anak (ADHD, autisme, dsb.) dan mengarahkan guru ke Guru BK atau psikolog profesional.
- **Klassa Pulse (Riset Tren Guru Makro):** Superadmin/Owner memiliki dashboard visualisasi analitik makro (`/admin/insights`) untuk memetakan isu kelas, materi kurikulum tersulit, beban stres kerja, dan jam aktif guru. Wajib melalui proses ekstraksi teragregasi dan teranonimkan total (bebas nama guru/siswa/sekolah) demi kepatuhan UU PDP.

---

## Ditolak + Alasan

- **Vendor Model Lock-in (Hanya Gemini):** Ditolak; arsitektur dibuat provider-agnostic agar guru/sekolah dapat mengganti LLM sewaktu-waktu.
- **Otonomi Tanpa Konfirmasi pada Data Sensitif:** Ditolak keras demi mencegah kesalahan data resmi sekolah dan halusinasi AI.
- **Biarkan LLM Menghitung Angka Database:** Ditolak karena LLM rentan halusinasi angka; perhitungan didelegasikan ke fungsi kode deterministik.
- **Framework Berat (LangChain/LangGraph):** Ditolak demi kesederhanaan kode native di Next.js.
