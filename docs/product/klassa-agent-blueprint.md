# Blueprint — Klassa Agent: Asisten Guru & Konsultan Kelas Ber-Data

## 1. Ringkasan Eksekutif

**Klassa Agent** adalah asisten cerdas berbasis percakapan (chat) yang terintegrasi langsung di seluruh ekosistem Klassa OS Portal Guru. Agen ini bertindak sebagai **kepanjangan tangan guru** untuk mengoperasikan berbagai fitur di Klassa serta menjadi rekan diskusi interaktif mengenai dinamika kelas.

Kelebihan utama Klassa Agent dibanding AI publik umum adalah **koneksi langsung ke database rombel guru** (profil siswa, catatan akademik, presensi, kuis, dan catatan monitoring) serta pemahaman mendalam terhadap alur kerja guru di sekolah Indonesia.

Agen ini memiliki 3 kapabilitas utama:
1. **Admin Cerdas & Analisis Data:** Membaca, merangkum, dan menganalisis data siswa dan rombel dalam bahasa manusia sehari-hari.
2. **Rekan Diskusi Pedagogi & Psikologi Siswa:** Teman bertukar pikiran untuk merancang penanganan masalah perilaku/akademik siswa dan merumuskan strategi pembelajaran aktif.
3. **Operator Seluruh Fitur Klassa:** Membantu mengeksekusi tugas administratif dan kegiatan kelas (presensi, rekap nilai, pembuatan tugas/kuis, materi ajar, hingga pengumuman) dengan prinsip **input minimal dari guru**.

Arsitektur agen dibangun di atas fondasi **Native Custom Agent** (Vercel AI SDK), memisahkan lapisan otak bahasa (*LLM*), lapisan alat bantu (*deterministic tools*), dan lapisan ingatan jangka panjang (*teacher memory store*).

---

## 2. Keputusan Produk (Locked)

### 2.1 Arsitektur Universal Multi-Model (Bebas Menggunakan LLM Apa Saja)
- Agen **100% bebas dari vendor lock-in**. Nama-nama model seperti Google Gemini, Claude, GPT-4o, DeepSeek, maupun Hermes/Ollama hanyalah **contoh acuan**.
- Pengembang/Owner **bebas memasang model LLM apa pun** di pasar, baik model komersial (API publik) maupun model open-weights yang di-hosting mandiri via endpoint standar (OpenAI-compatible protocol, Ollama, vLLM, Groq, Mistral, Together AI, Hugging Face, dsb.).
- Pergantian model dapat dilakukan secara dinamis di tengah jalan (per percakapan, per preferensi guru, atau via smart routing berdasarkan kompleksitas tugas) tanpa mengubah satu pun baris kode pada lapisan alat bantu (*tools*), hak akses (*security guards*), maupun memori.

### 2.2 Cakupan Tugas Luas & Matriks Konfirmasi (Human-in-the-Loop)
Agen dapat melakukan **semua tindakan yang bisa dilakukan guru di Klassa**, dengan pembagian tingkat risiko yang jelas:

| Kategori Aksi | Karakteristik | Contoh Aksi | Perilaku Agen |
|---|---|---|---|
| **Aksi Hijau (Aman / Read-Only / Draf)** | Membaca data, melakukan kalkulasi statistik, menyusun draf teks tanpa mengubah data permanen | Query absensi, analisis tren nilai, draf modul ajar/RPP, draf pesan orang tua | **Langsung dieksekusi** tanpa menunggu konfirmasi manual |
| **Aksi Kuning/Merah (Sensitif & Berdampak Besar)** | Menulis/mengubah database resmi, mempublikasikan materi ke siswa, mutasi data | Simpan rekap absensi resmi, simpan nilai asesmen, publikasikan kuis baru ke kelas, kirim pengumuman ke wali murid, ubah status siswa | **WAJIB Konfirmasi Eksplisit** via kartu interaktif di chat sebelum data disimpan |

### 2.3 Sistem Memori Komprehensif (Ekstraksi Intisari Obrolan Secara Umum)
Agar agen tidak "amnesia" dan semakin mengenal gurunya:
1. **Short-Term Memory (Context Window):** Obrolan yang sedang berjalan pada sesi chat aktif.
2. **Long-Term Memory (TeacherAgentMemory & General Chat Digest):**
   - **Bukan hanya preferensi kaku:** Sistem tidak hanya mencatat gaya bahasa atau format RPP, melainkan memiliki mesin perangkum otomatis (*background summarizer & memory extractor*) yang **mampu membaca dan merangkum intisari pembahasan chat guru secara umum**.
   - Meliputi: proyek atau materi ajar yang sedang digarap guru minggu ini, kendala siswa spesifik yang pernah dibahas, ide eksperimen kelas yang belum selesai, hingga preferensi pengajaran unik dari guru tersebut.
   - Intisari ini disintesis menjadi profil konteks yang kaya sehingga saat guru membuka obrolan baru beberapa minggu kemudian, agen tetap "nyambung" dengan perjalanan mengajar sang guru.
   - Guru memegang kendali penuh: dapat melihat intisari yang terekam, menyunting, atau mereset ingatan agen kapan saja di menu pengaturan asisten.

### 2.4 Perhitungan Presisi Total via Deterministic Tools
- LLM **dilarang keras menghitung angka, persentase, atau statistik secara mandiri**.
- LLM hanya bertindak sebagai penerjemah bahasa alami dan perumus rencana (*intent parser & orchestrator*).
- **Semua hal di KLASSA yang bisa dihitung/dikalkulasi WAJIB diproses oleh kode program Next.js yang deterministik (100% presisi):**
  - Kalkulasi nilai rata-rata, median, distribusi nilai, dan status KKM.
  - Persentase kehadiran, rekap sakit/izin/alfa, dan rasio keterlambatan siswa.
  - Jumlah pengumpulan tugas vs yang belum mengumpulkan, ranking/peringkat kelas, dan hitungan waktu tenggat (*deadline countdown*).
  - Durasi rata-rata pengerjaan kuis, analisis butir soal (daya pembeda, tingkat kesukaran), ambang batas remedial, hingga kuota dan audit aktivitas kelas.
  - LLM hanya menerima hasil angka matang dari sistem untuk kemudian dirangkai menjadi kalimat penjelasan yang komunikatif dan ramah.

### 2.5 Keamanan Hak Akses & Privasi Siswa
- **Isolasi Rombel (`isPengampuRombel` - B2):** Agen berjalan menggunakan kredensial guru yang login. Di tingkat fungsi kode (*server-side*), guru hanya dapat membaca dan memodifikasi data rombel yang diampunya pada semester aktif. Permintaan data rombel lain ditolak keras.
- **Transparansi Kontekstual:** Nama dan data siswa disertakan pada prompt agar dialog solutif ("Budi sering terlambat"), sementara metadata rahasia (PIN, token) disensor ketat pada `AuditLog` (`redactMetadata`).
- **Batasan Psikologi:** Agen menolak memberikan diagnosis medis/klinis anak (ADHD, spektrum autisme, dsb.) dan secara otomatis mengarahkan guru untuk berkoordinasi dengan Guru BK atau ahli psikologi.

### 2.6 Teacher Behavior & Classroom Insights Engine (Klassa Pulse)
- **Tujuan Riset & Bisnis:** Superadmin dan Owner dapat menarik pola percakapan guru secara makro untuk memahami dinamika, perilaku kerja, serta tantangan riil guru dan siswa di Indonesia.
- **Pagar Privasi & UU PDP (Anonimisasi Penuh):**
  - Superadmin **tidak membaca percakapan mentah guru per individu** (bukan pengintaian manual).
  - Sistem melakukan ekstraksi otomatis di latar belakang (*background topic & sentiment extraction*) yang hanya menyimpan kategori topik, jenjang kelas, mata pelajaran, dan wilayah sekolah.
  - Nama guru, nama siswa, nama sekolah, dan NIS dihapus total (*scrubbed*) sebelum disimpan ke tabel agregat analitik.
  - Dilengkapi klausul standar pada Kebijakan Privasi/ToS mengenai penggunaan data teranonimkan untuk pengembangan kualitas riset pendidikan.

### 2.7 Batasan Ruang Lingkup Topik & Kebijakan Jawaban Agen
1. **Topik Pendidikan di Luar Kelas (100% Dilayani & Didukung Penuh):**
   - Jika guru bertanya tentang isu pendidikan secara luas di luar kelasnya (misal: regulasi Kurikulum Merdeka, sertifikasi guru / PMM, metode pedagogi umum, penyusunan materi rapat komite sekolah, dsb.), agen **wajib menjawab secara komprehensif dan solutif**.
   - Agen tidak memanggil tools database kelas, melainkan memanfaatkan basis pengetahuan pendidikan untuk membantu guru sebagai rekan profesi.
2. **Topik Non-Pendidikan / Luar Konteks (Penolakan Halus & Pengalihan):**
   - Jika guru menanyakan topik non-pendidikan (resep masakan, olahraga/sepak bola, politik praktis, gosip selebriti, otomotif, dsb.), agen **wajib menolak secara halus, santun, dan profesional (*polite deflection*)**.
   - Agen tidak melayani obrolan di luar ranah pendidikan dan mengalihkan kembali fokus guru ke persiapan ajar atau kebutuhan kelas, demi menjaga profesionalitas produk dan menghemat kuota komputasi.

---

## 3. Arsitektur Teknis

```
┌────────────────────────────────────────────────────────┐
│                   Portal Guru (UI)                     │
│   • Halaman Percakapan Utama (/asisten)               │
│   • Floating Action Launcher di Dashboard             │
│   • Kartu Interaktif Konfirmasi Aksi Sensitif          │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP Streaming / Server Action
┌───────────────────────────▼────────────────────────────┐
│         Klassa Agent Core (src/modules/agent)          │
│   • Agent Runtime (Vercel AI SDK streamText)          │
│   • Model Router / Provider Dispatcher                │
│   • Context & Memory Assembler (Short + Long Term)     │
│   • Guard Keamanan Scope Rombel (isPengampuRombel)    │
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
  [Tool Calling / Deterministic] [Dynamic Model Dispatch]
              │                           │
┌─────────────▼──────────────┐ ┌──────────▼──────────────┐
│     Klassa Tool Registry   │ │   AI Provider Factory   │
│ • tools/query/             │ │ • GeminiProvider        │
│   - get_student_records    │ │ • AnthropicProvider     │
│   - get_attendance_stats   │ │ • OpenAICompatible      │
│   - get_assessment_summary │ │   (Hermes/Ollama/vLLM)  │
│ • tools/mutation/          │ └─────────────────────────┘
│   - submit_attendance      │
│   - create_assignment      │
│   - post_announcement      │
│   - save_ai_studio_draft   │
└─────────────┬──────────────┘
              │
┌─────────────▼──────────────┐
│  Database Klassa (Neon PG) │
│  User, Student, Attendance,│
│  Assessment, AgentMemory   │
└────────────────────────────┘
```

### 3.1 Skema Prisma (Riwayat Chat & Memori Guru)

```prisma
// Riwayat sesi percakapan
model AgentConversation {
  id               String         @id @default(cuid())
  teacherProfileId String
  teacherProfile   TeacherProfile @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)
  title            String         @default("Percakapan Baru")
  modelUsed        String         @default("gemini-1.5-flash")
  classContextId   String?        // ID rombel jika fokus pada kelas tertentu
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  messages         AgentMessage[]

  @@index([teacherProfileId, updatedAt])
  @@map("agent_conversation")
}

// Pesan dalam obrolan
model AgentMessage {
  id             String            @id @default(cuid())
  conversationId String
  conversation   AgentConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           String            // 'user' | 'assistant' | 'system' | 'tool'
  content        String            @db.Text
  toolCalls      Json?             // Panggilan tools & argumen
  toolResults    Json?             // Output kalkulasi sistem
  pendingAction  Json?             // Proposal aksi berisiko yang menunggu konfirmasi
  actionStatus   String?           // 'NONE' | 'PENDING' | 'CONFIRMED' | 'REJECTED'
  createdAt      DateTime          @default(now())

  @@index([conversationId, createdAt])
  @@map("agent_message")
}

// Memori preferensi jangka panjang guru
model TeacherAgentMemory {
  id               String         @id @default(cuid())
  teacherProfileId String         @unique
  teacherProfile   TeacherProfile @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)
  communicationTone String        @default("RAMAH_SOPAN") // 'LUGAS_RINGKAS' | 'RAMAH_SOPAN' | 'FORMAL'
  preferredModel   String         @default("gemini-1.5-flash")
  pedagogyDefaults Json?          // Format RPP andalan, model belajar favorit
  customContext    String?        @db.Text // Catatan khusus yang ingin agen selalu ingat
  updatedAt        DateTime       @updatedAt

  @@map("teacher_agent_memory")
}

// Agregat analitik wawasan guru untuk Superadmin (Klassa Pulse)
model AgentInsightAggregate {
  id               String         @id @default(cuid())
  date             DateTime       @db.Date
  topicCategory    String         // 'KEDISIPLINAN' | 'LITERASI' | 'METODE_AJAR' | 'MOTIVASI' | 'ADMINISTRASI'
  subjectGroup     String?        // 'MATEMATIKA' | 'IPA' | 'BAHASA' | 'SOSIAL' | 'UMUM'
  gradeLevel       String?        // 'SD' | 'SMP' | 'SMA' | 'SMK'
  regionCode       String?        // Kode provinsi / kota (opsional)
  sentimentScore   String         // 'POSITIF' | 'NETRAL' | 'KEWALAHAN_STRES'
  frequency        Int            @default(1)
  activeHour       Int            // 0 - 23 (untuk jam sibuk kerja guru)
  createdAt        DateTime       @default(now())

  @@index([date, topicCategory])
  @@index([gradeLevel, subjectGroup])
  @@map("agent_insight_aggregate")
}
```

### 3.2 Struktur Direktori Modul (`src/modules/agent/`)

```
src/modules/agent/
├── agent.types.ts           # Definisi tipe pesan, action proposal, status konfirmasi
├── agent.config.ts          # Template system prompt & konfigurasi model
├── agent.actions.ts         # Server actions (buat obrolan, eksekusi konfirmasi aksi)
├── agent.runtime.ts         # Engine streamText & orkestrasi tools AI SDK
├── memory/
│   ├── memory.service.ts    # Baca & tulis TeacherAgentMemory
│   └── memory.extractor.ts  # Ekstraksi preferensi otomatis dari obrolan
├── tools/
│   ├── index.ts             # Registri seluruh tools
│   ├── query/
│   │   ├── students.tool.ts     # Ambil profil, NIS, data perwalian
│   │   ├── attendance.tool.ts   # Kalkulasi persentase hadir, alfa, izin
│   │   ├── assessment.tool.ts   # Perhitungan nilai rata-rata, KKM, tren
│   │   └── monitoring.tool.ts   # Catatan perkembangan karakter siswa
│   └── mutation/
│       ├── attendance.mut.ts    # Input absensi resmi (Perlu Konfirmasi)
│       ├── assignment.mut.ts    # Buat tugas/kuis (Perlu Konfirmasi)
│       ├── announcement.mut.ts  # Publikasi pengumuman (Perlu Konfirmasi)
│       └── content-draft.mut.ts # Simpan modul/RPP ke AI Studio (Draf - Langsung)
└── components/
    ├── AgentChatView.tsx        # Tampilan utama chat
    ├── AgentMessageBubble.tsx   # Render balon teks & markdown
    ├── ActionConfirmCard.tsx    # Kartu persetujuan aksi berdampak besar
    ├── ModelSelectorDropdown.tsx# Pemilih model LLM aktif
    └── FloatingAgentLauncher.tsx# Tombol pemicu melayang di sudut layar
```

### 3.3 Alur Konfirmasi Aksi (Contoh Kasus Absensi)

1. Guru mengetik: *"Tolong catat absensi kelas 8-B hari ini. Semua masuk, kecuali Rizky izin dan Doni sakit."*
2. Agen memanggil tool query `get_my_classes` untuk memverifikasi hak mengajar guru di 8-B.
3. Agen menyusun parameter absensi dan memanggil tool mutasi `prepare_attendance_record`.
4. Sistem tidak langsung menyimpan ke database `Attendance`, melainkan mengembalikan proposal aksi dan merender **Kartu Konfirmasi** di UI:
   ```
   ┌───────────────────────────────────────────────────────────────┐
   │ 📋 Usulan Catat Presensi: Kelas 8-B (Hari Ini)                │
   │ • Hadir: 30 Siswa                                             │
   │ • Izin: 1 Siswa (Rizky Pratama)                               │
   │ • Sakit: 1 Siswa (Doni Kurniawan)                             │
   │                                                               │
   │ Status: ⚠️ Menunggu persetujuan guru                          │
   │ [ Simpan Presensi Resmi ]            [ Batalkan / Ubah ]      │
   └───────────────────────────────────────────────────────────────┘
   ```
5. Ketika guru menekan tombol **"Simpan Presensi Resmi"**, klien memanggil Server Action `confirmAgentAction(messageId)`.
6. Server memverifikasi ulang session guru, mengeksekusi pencatatan data presensi ke tabel resmi, mencatat riwayat di `AuditLog`, dan mengubah status kartu menjadi `CONFIRMED`.

---

## 4. Rencana Eksekusi Bertahap (Sprint Roadmap)

### Story 1: Fondasi Agent Runtime & Multi-Model
- Instalasi dependensi Vercel AI SDK (`ai`, `@ai-sdk/google`, provider adapters).
- Migrasi Prisma: penambahan tabel `agent_conversation`, `agent_message`, dan `teacher_agent_memory`.
- Implementasi `ModelRouter` yang mendukung pergantian model (Gemini, model OpenAI-compatible).
- UI dasar percakapan di `/asisten` dengan mekanisme streaming.

### Story 2: Memory Store & Tools Query Data Kelas
- Implementasi `memory.service.ts` untuk memuat preferensi guru ke system prompt.
- Pembuatan deterministic query tools: `students.tool.ts`, `attendance.tool.ts`, `assessment.tool.ts`.
- Penerapan guard mutlak `isPengampuRombel` (B2) pada seluruh pemanggilan data.
- Unit & integration tests untuk mencegah kebocoran data lintas rombel.

### Story 3: Skill Pedagogi & Pagar Keamanan Psikologis
- Penyusunan panduan respons pedagogis (pemberian solusi belajar, penanganan anak pasif/aktif).
- Guardrail sistemik: penolakan diagnosis medis/psikiatri anak dan otomatisasi rujukan ke Guru BK.
- Integrasi audit logging tersensor (`redactMetadata`) untuk setiap query percakapan.

### Story 4: Action Mutation & Kartu Konfirmasi Interaktif
- Implementasi komponen UI `ActionConfirmCard` di dalam bubble chat.
- Pembuatan tools mutasi berkonfirmasi: input presensi rombel, publikasi tugas, dan pengumuman.
- Integrasi penyimpanan draf konten otomatis ke modul AI Studio (`saveAiDraftAction`).

### Story 5: Polish, Floating Widget & Settings
- Pembuatan widget melayang `FloatingAgentLauncher` di dashboard guru.
- Halaman pengaturan preferensi asisten: pemilihan gaya komunikasi, reset ingatan agen, dan pemilihan model default.
- Dokumentasi panduan konfigurasi model mandiri (Hermes/vLLM) bagi sekolah *on-premise*.

### Story 6: Admin Console — Klassa Pulse Insights & Visualisasi Data Guru
- **Pipa Ekstraksi Tren (Background Aggregator):**
  - Ekstraksi otomatis topik, mata pelajaran, sentimen emosional, dan jam percakapan secara teranonimkan saat percakapan selesai.
  - Penyimpanan data ke tabel agregat `agent_insight_aggregate` (bebas identitas personal siswa/guru).
- **Halaman Visualisasi Superadmin (`/admin/insights`):**
  - **Top 10 Isu Kelas Indonesia:** Grafik batang horizontal dan Word Cloud interaktif mengenai masalah siswa yang paling sering dikonsultasikan.
  - **Geographical Heatmap:** Peta sebaran tantangan ruang kelas per provinsi/kota (misal: isu gawai vs isu sarana ajar).
  - **Treemap Kurikulum Paling Menantang:** Visualisasi kotak bertingkat materi mata pelajaran yang paling sering membuat guru buntu dalam merancang metode belajar (misal: Pecahan Aljabar, Trigonometri).
  - **Radar Sentimen & Beban Kerja (Burnout Gauge):** Pengukur persentase stres/kelelahan guru dari sentimen obrolan untuk memetakan puncak beban administrasi (periode UTS/PTS/Rapor).
  - **Heatmap Jam Kerja Guru (Activity Peak Grid):** Matriks kalender 7 hari x 24 jam (gaya kontribusi GitHub) untuk memetakan jam lembur guru di luar sekolah.
  - Implementasi komponen visualisasi cepat & responsif menggunakan **Recharts** di Next.js.

---

## 5. Yang Secara Sadar TIDAK Dikerjakan di V1

1. **Eksekusi Aksi Sensitif Tanpa Izin:** Agen sama sekali tidak diizinkan mempublikasikan tugas resmi, mengubah nilai rapor, atau memutasi data kehadiran tanpa persetujuan tombol dari guru.
2. **Koneksi Suara / Audio Live:** Interaksi V1 berfokus pada chat teks dan kartu aksi visual.
3. **Akses untuk Siswa & Orang Tua:** Klassa Agent fase ini dikhususkan sebagai asisten operasional dan konsultan pribadi guru.
4. **Autonomous Cron Agent:** Agen hanya bertindak saat diajak bicara oleh guru (reaktif), tidak menjalankan pemindaian mandiri di latar belakang tanpa pemicu guru.
