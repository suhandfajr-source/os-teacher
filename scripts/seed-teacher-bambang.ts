/**
 * Seeder demo: Pak Bambang Prasetyo, S.Pd., M.Kom. — Guru Informatika
 * SMA Negeri 1 Nusantara, TA 2026/2027 Semester Ganjil.
 *
 * Cakupan data (100% saling terkait, deterministik — bukan random generator):
 * - 4 rombel: XI-MIPA-1 (28), XI-MIPA-2 (28), XII-MIPA-1 (30), XII-MIPA-2 (30) = 116 siswa
 * - Jadwal mingguan + 12 pertemuan per rombel (14 Juli – 3 Okt 2026) + presensi lengkap
 * - TP (LearningObjective), PROTA ringkas (AcademicPlanItem), GradePolicy aktif
 * - Asesmen: Tugas 1, UH 1, Tugas 2, STS (semua COMPLETED + nilai) & Kuis CBT (Quiz PUBLISHED + attempts + jawaban)
 * - Assignment + submissions (dinilai + feedback), Proyek akhir (deadline mendatang, belum dikumpulkan)
 * - Catatan monitoring siswa (remedial, prestasi, sakit berulang)
 * - Memori Klassa Agent guru
 *
 * Idempoten: pembersihan scoped by ID/NIS lalu recreate.
 * Jalankan: npm run seed:teacher-bambang
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, AttendanceStatus } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 120_000,
  connectionTimeoutMillis: 30_000,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// PIN_PEPPER membaca NODE_ENV — seed lokal setara "development".
// Harus di-set SEBELUM lazy-import student-pin (resolvePinPepper jalan di top-level module).
(process.env as Record<string, string | undefined>).NODE_ENV = process.env.NODE_ENV || "development";

// ─────────────────────────────────────────────────────────────
// KONSTANTA UTAMA
// ─────────────────────────────────────────────────────────────
const SCHOOL_ID = "cmutkyj1j0000houtqbqsgi7o"; // SMA Negeri 1 Nusantara (NPSN 20108899)
const PERIOD_ID = "cmutkzwc40001tgutdmxebh9x"; // 2026/2027 GANJIL ACTIVE
const TEACHER = {
  userId: "seed_user_bambang_prasetyo",
  accountId: "seed_acc_bambang_prasetyo",
  profileId: "seed_tp_bambang_prasetyo",
  name: "Bambang Prasetyo, S.Pd., M.Kom.",
  email: "guru.bambang@klassa.id",
  password: "GuruKlassa2026!",
  preferredName: "Pak Bambang",
};
const SUBJECT_ID = "seed_sub_informatika_ff";
const STUDENT_PIN = "1234";
const SEMESTER_START_MONDAY = new Date("2026-07-13T00:00:00Z"); // Senin pekan 1
const WEEKS = 12; // pekan efektif terlaksana sampai awal Oktober 2026
const TZ = "+07:00"; // WIB

function mondayOfWeek(w: number): Date {
  const d = new Date(SEMESTER_START_MONDAY);
  d.setUTCDate(d.getUTCDate() + (w - 1) * 7);
  return d;
}
function sessionDate(week: number, dayOfWeek: number): Date {
  // dayOfWeek: 1=Senin … 5=Jumat (skema Prisma)
  const d = mondayOfWeek(week);
  d.setUTCDate(d.getUTCDate() + (dayOfWeek - 1));
  return d;
}
function atTime(date: Date, hhmm: string): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T${hhmm}:00${TZ}`);
}
const pad = (n: number) => String(n).padStart(2, "0");
const clamp = (v: number, lo = 45, hi = 100) => Math.max(lo, Math.min(hi, Math.round(v)));

// ─────────────────────────────────────────────────────────────
// ROSTER SISWA (nama realistis + kemampuan akademik dasar)
// ability: proyeksi nilai dasar siswa (tugas/UH akan bergeser kecil & deterministik)
// ─────────────────────────────────────────────────────────────
interface RosterStudent {
  name: string;
  nis: string;
  ability: number;
  birthDate: string;
}
interface Roster {
  key: string; // xi1 | xi2 | xii1 | xii2
  className: string;
  normalizedName: string;
  gradeLevel: string;
  joinCode: string;
  dayOfWeek: number;
  startTime: string; // "07:30"
  endTime: string; // "09:00"
  nisPrefix: string;
  birthYearBase: number;
  students: RosterStudent[];
  incidents: { idx: number; week: number; status: AttendanceStatus }[];
}

const XI_NAMES: [string, number][] = [
  ["Aditya Pratama Wirawan", 88], ["Aisyah Nur Fadilah", 82], ["Bagas Dwi Saputra", 76],
  ["Bunga Aulia Rahma", 90], ["Daffa Hidayatullah", 71], ["Dinda Maharani Putri", 79],
  ["Dimas Arya Saputra", 85], ["Eka Ramadhani", 67], ["Farah Nabila Zahra", 93],
  ["Fikri Haikal Alfarizi", 74], ["Gita Permatasari", 86], ["Hafiz Al Ghifari", 62],
  ["Ilham Nur Ramadhan", 78], ["Intan Puspita Dewi", 91], ["Joko Susilo Wibowo", 69],
  ["Kirana Ayu Lestari", 84], ["Luthfi Zharif Ramadhan", 77], ["Mawar Melati Kusuma", 81],
  ["Muhammad Rizky Fadillah", 87], ["Nadia Salsabila", 73], ["Naufal Arkan Maulana", 66],
  ["Putri Ayu Wulandari", 89], ["Raihan Ahmad Fauzi", 80], ["Rani Oktaviani", 75],
  ["Reyhan Bintang Pamungkas", 83], ["Salsabila Aprilia", 92], ["Wahyu Ramadhan", 70],
  ["Zahra Amelia Putri", 78],
];

const XI2_NAMES: [string, number][] = [
  ["Ahnaf Dzaki Wirawan", 85], ["Alya Mukhbita Rahma", 89], ["Arka Dhani Pratama", 77],
  ["Aulia Safitri", 82], ["Bayu Kurniawan Setiawan", 74], ["Bella Safira Andini", 91],
  ["Danish Alfarizqi", 68], ["Desi Ratnasari", 80], ["Dwi Cahyo Nugroho", 72],
  ["Elvira Damayanti", 86], ["Farel Saputra", 79], ["Fina Andriani", 83],
  ["Galang Ramadhan Syah", 65], ["Hana Puspita Sari", 90], ["Ibnu Syahputra", 76],
  ["Jasmin Aurelia", 88], ["Kevin Aditya Pratama", 71], ["Laila Nur Azizah", 84],
  ["Muhammad Arif Hidayat", 78], ["Mela Yuliana", 73], ["Naia Ghassani", 92],
  ["Nanda Pratama Wijaya", 81], ["Nayla Putri Ramadhani", 87], ["Raka Adinata", 70],
  ["Reza Firmansyah", 66], ["Sari Melati Anggraini", 85], ["Tegar Adi Nugroho", 75],
  ["Vanya Kirania Putri", 89],
];

const XII1_NAMES: [string, number][] = [
  ["Ahmad Fauzan Alghifari", 87], ["Aldi Firmansyah", 75], ["Aletta Oriana Dewi", 92],
  ["Amelia Puspita Sari", 83], ["Andre Saputra", 71], ["Anisa Rahmawati", 86],
  ["Aulia Dharmawan", 68], ["Bikra Alfarizi", 79], ["Citra Ayu Lestari", 90],
  ["Damar Wicaksono", 77], ["Della Puspita", 82], ["Dimas Prayoga", 66],
  ["Diva Amara Syakira", 89], ["Fadhil Ikhsan Maulana", 74], ["Fitriani Nur Azizah", 85],
  ["Gilang Ramadhan", 78], ["Hana Salsabila", 91], ["Harits Abdurrahman", 80],
  ["Ifa Kurnia Indah", 73], ["Irfan Hakim Lubis", 88], ["Joshua Simatupang", 76],
  ["Kaysa Syakira Rahma", 93], ["Lukman Hakim Alfarizi", 70], ["Marsha Kirana Agustina", 84],
  ["Muhamad Ilham Akbar", 81], ["Nabila Chika Ayu", 87], ["Novita Sari Br Tarigan", 72],
  ["Panji Setiawan", 69], ["Rizka Dwi Aprilia", 83], ["Syahrul Gunawan", 77],
];

const XII2_NAMES: [string, number][] = [
  ["Abyan Fachri Ramadhan", 84], ["Agnes Natasya", 89], ["Aisyah Putri Kirana", 86],
  ["Alfiansyah Putra", 73], ["Amanda Yuliani", 80], ["Ananta Dwi Cahyo", 77],
  ["Arman Dwi Saputra", 70], ["Aulia Rahma Dhiani", 91], ["Bimo Prasetyo Utomo", 78],
  ["Calya Puspita Hening", 85], ["Dafa Alfaruq", 67], ["Dewi Anggraini", 82],
  ["Dhia Zahra Nurhaliza", 90], ["Elsa Fitriani", 75], ["Fahmi Idris", 79],
  ["Fanya Syifa Kamila", 88], ["Farrel Erlangga", 72], ["Gendhis Putri Maharani", 93],
  ["Ghifari Occa Pratama", 76], ["Hanifah Maulida", 87], ["Ilham Maulana Ibrahim", 81],
  ["Indah Permatasari", 84], ["Yeremi Anugrah", 69], ["Kavya Talita Zahra", 90],
  ["Ilkaf Wafi Ardiansyah", 66], ["Nadhira Ayu Shabrina", 86], ["Noval Saputra", 74],
  ["Rangga Yudha Perkasa", 80], ["Sava Azkia Putri", 89], ["Yonathan Eka Prasetya", 78],
];

function buildRoster(
  key: string,
  className: string,
  normalizedName: string,
  gradeLevel: string,
  joinCode: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  nisPrefix: string,
  birthYearBase: number,
  names: [string, number][],
  incidents: Roster["incidents"]
): Roster {
  return {
    key, className, normalizedName, gradeLevel, joinCode,
    dayOfWeek, startTime, endTime, nisPrefix, birthYearBase,
    students: names.map(([name, ability], i) => ({
      name,
      nis: `${nisPrefix}${pad(i + 1)}`,
      ability,
      birthDate: `${birthYearBase + (i % 2)}-${pad(1 + (i % 12))}-${pad(1 + ((i * 7) % 28))}`,
    })),
    incidents,
  };
}

const ROSTERS: Roster[] = [
  buildRoster(
    "xi1", "XI-MIPA-1", "11-mipa-1", "11", "INF11A",
    2, "07:30", "09:00", "2025110", 2009, XI_NAMES,
    [
      { idx: 3, week: 2, status: "SICK" },
      { idx: 3, week: 9, status: "SICK" },
      { idx: 10, week: 6, status: "PERMISSION" },
      { idx: 17, week: 9, status: "ABSENT" },
      { idx: 22, week: 4, status: "SICK" },
      { idx: 25, week: 7, status: "PERMISSION" },
      { idx: 5, week: 11, status: "LATE" },
    ]
  ),
  buildRoster(
    "xi2", "XI-MIPA-2", "11-mipa-2", "11", "INF11B",
    2, "09:15", "10:45", "2025210", 2009, XI2_NAMES,
    [
      { idx: 2, week: 3, status: "SICK" },
      { idx: 8, week: 5, status: "ABSENT" },
      { idx: 14, week: 3, status: "SICK" },
      { idx: 19, week: 6, status: "PERMISSION" },
      { idx: 26, week: 10, status: "SICK" },
    ]
  ),
  buildRoster(
    "xii1", "XII-MIPA-1", "12-mipa-1", "12", "INF12A",
    3, "07:30", "09:00", "2024110", 2008, XII1_NAMES,
    [
      { idx: 6, week: 2, status: "SICK" },
      { idx: 11, week: 7, status: "PERMISSION" },
      { idx: 16, week: 4, status: "SICK" },
      { idx: 21, week: 9, status: "ABSENT" },
      { idx: 27, week: 11, status: "SICK" },
    ]
  ),
  buildRoster(
    "xii2", "XII-MIPA-2", "12-mipa-2", "12", "INF12B",
    4, "10:15", "11:45", "2024210", 2008, XII2_NAMES,
    [
      { idx: 4, week: 3, status: "PERMISSION" },
      { idx: 9, week: 8, status: "SICK" },
      { idx: 15, week: 10, status: "ABSENT" },
      { idx: 20, week: 2, status: "SICK" },
      { idx: 24, week: 12, status: "SICK" },
    ]
  ),
];

// ─────────────────────────────────────────────────────────────
// TUJUAN PEMBELAJARAN (Kurikulum Merdeka — Informatika Fase F)
// ─────────────────────────────────────────────────────────────
const TP_XI = [
  { code: "11.1.1", desc: "Peserta didik mampu menerapkan dekomposisi masalah dan pengenalan pola dalam penyelesaian persoalan komputasional.", hours: 8 },
  { code: "11.1.2", desc: "Peserta didik mampu menyusun algoritma (sekuens, seleksi, repetisi) dalam bentuk pseudocode dan flowchart untuk persoalan sederhana.", hours: 12 },
  { code: "11.1.3", desc: "Peserta didik mampu menggunakan struktur data dasar (array satu/t dua dimensi dan rekaman) dalam representasi data.", hours: 10 },
  { code: "11.1.4", desc: "Peserta didik mampu merancang model basis data relasional sederhana melalui ERD dan menerapkan kunci primer/asing.", hours: 8 },
  { code: "11.1.5", desc: "Peserta didik mampu menuliskan query SQL dasar (SELECT, WHERE, ORDER BY) untuk mengambil data dari basis data.", hours: 6 },
];
const TP_XII = [
  { code: "12.1.1", desc: "Peserta didik mampu menjelaskan tahapan SDLC dan menyusun analisis kebutuhan aplikasi berbasis user story.", hours: 8 },
  { code: "12.1.2", desc: "Peserta didik mampu membangun halaman web dengan HTML5 semantik dan layout CSS responsif.", hours: 12 },
  { code: "12.1.3", desc: "Peserta didik mampu menerapkan JavaScript dasar (variabel, kontrol alur, DOM, event) untuk interaktivitas halaman web.", hours: 10 },
  { code: "12.1.4", desc: "Peserta didik mampu menerapkan praktik keamanan digital dan etika penggunaan teknologi informasi.", hours: 6 },
  { code: "12.1.5", desc: "Peserta didik mampu merancang dan membangun prototipe aplikasi web sebagai bagian dari portofolio.", hours: 8 },
];

// Rencana 12 pertemuan per jenjang: [tpIndex(1-based), topik, aktivitas, refleksi]
const SESSIONS_XI: [number, string, string, string][] = [
  [1, "Orientasi Informatika Fase F & kontrak belajar", "Ice-breaking, kontrak kelas, pre-test diagnostik berpikir komputasional, pembagian kelompok belajar.", "Antusiasme tinggi; hasil pre-test menunjukkan sebagian besar siswa belum mengenal dekomposisi masalah secara formal."],
  [1, "Dekomposisi masalah & pengenalan pola", "Praktik memecah kasus sehari-hari (jadwal piket, kasir warung) menjadi sub-masalah; latihan identifikasi pola berkelompok.", "Kelompok mampu memecah masalah, namun pengenalan pola masih perlu latihan tambahan; 2 kelompok sudah sangat sigap."],
  [2, "Algoritma: sekuens & pseudocode", "Penyusunan pseudocode langkah demi langkah (resep masakan, prosedur presensi); Tugas 1 dibagikan.", "Sebagian besar sudah menulis pseudocode runtut; kesalahan umum: langkah implisit tidak dituliskan."],
  [2, "Seleksi: if-then-else & studi kasus penentuan kategori", "Latihan kasus penentukan grade nilai dan kelayakan KIP; UH 1 dilaksanakan 30 menit terakhir.", "UH 1 rata-rata baik; kasus seleksi bersarang masih menjadi PR beberapa siswa."],
  [2, "Repetisi: for, while, dan nested loop", "Simulasi manual perulangan (tabel perkalian, pola bintang); demonstrasi nested loop di papan tulis.", "Nested loop paling menantang; siswa dengan kemampuan tinggi diberi soal pengayaan pola segitiga Pascal."],
  [3, "Array satu dimensi & pengaksesan indeks", "Praktik representasi daftar nilai siswa sebagai array; Tugas 2 (studi kasus array kehadiran) dibagikan.", "Konsep indeks mulai nempel setelah analogi nomor absen; perlu pengingat bahwa indeks dimulai dari 0."],
  [3, "Array dua dimensi & rekaman (record)", "Pemodelan matriks nilai dan data diri siswa sebagai record; kuis lisan antar kelompok.", "Pemahaman membaik; beberapa siswa masih tertukar baris-kolom — ditindaklanjuti lewat pendampingan."],
  [1, "Sumatif Tengah Semester (STS) — TP 11.1.1 s.d. 11.1.3", "Pelaksanaan STS tertulis 90 menit.", "Hasil STS sesuai ekspektasi; 4 siswa di bawah KKTP akan mengikuti remedial pekan depan."],
  [4, "Konsep basis data & perancangan ERD", "Identifikasi entitas-atribut dari kasus perpustakaan sekolah; penggambaran ERD di kertas.", "Siswa cepat memahami entitas; relasi kardinalitas masih perlu penguatan dengan contoh nyata."],
  [5, "Relasi tabel: kunci primer & kunci asing + Kuis CBT", "Penjelasan relasi one-to-many, dilanjutkan Kuis CBT Basis Data & SQL di lab komputer.", "Kuis CBT berjalan lancar; koneksi lab stabil; skor akan dibahas pembuka pertemuan berikutnya."],
  [5, "SQL dasar: SELECT, WHERE, ORDER BY", "Praktik query di lab menggunakan dataset nilai kelas; tantangan 5 soal bertingkat.", "Semakin banyak siswa berani mencoba; siswa yang tampak pasif diberi pendampingan langsung."],
  [5, "SQL lanjutan & kick-off Proyek Basis Data Sekolah", "Pembahasan hasil kuis CBT, latihan query gabungan, dan pembentukan tim proyek basis data.", "Kick-off proyek antusias; pembagian peran tim sudah ditetapkan; laporan progres pekan depan."],
];

const SESSIONS_XII: [number, string, string, string][] = [
  [1, "Orientasi proyek portofolio & review SDLC", "Pembahasan roadmap portofolio kelas XII, review tahapan SDLC, dan penjelasan rubrik proyek akhir.", "Kesadaran pentingnya portofolio untuk kelas XII cukup tinggi; beberapa siswa langsung mengusulkan ide aplikasi."],
  [1, "Analisis kebutuhan & user story", "Praktik menyusun user story untuk aplikasi absensi kelas; format \"Sebagai ... saya ingin ...\".", "User story pertama umumnya terlalu teknis; setelah contoh kedua pemahaman meningkat signifikan."],
  [2, "HTML5 semantik: struktur & elemen bermakna", "Praktik membangun kerangka halaman profil dengan header, nav, main, article, footer; Tugas 1 dibagikan.", "Struktur semantik cepat dipahami; kebiasaan lama menggunakan div semua masih muncul."],
  [2, "CSS layout: flexbox & responsive", "Latihan layout kartu profil dengan flexbox, media query dasar; UH 1 dilaksanakan 30 menit terakhir.", "UH 1 hasil memuaskan; kasus flex-wrap dan justify-content masih sering tertukar."],
  [2, "Praktik slicing halaman profil (mini-workshop)", "Workshop menyalin desain mockup ke HTML-CSS; review antar teman sebangku.", "Hasil slicing beragam; 5 karya terbaik dipresentasikan sebagai inspirasi kelas."],
  [3, "JavaScript dasar: variabel, tipe, kontrol alur", "Praktik console.log, kondisi, dan perulangan untuk validasi sederhana; Tugas 2 dibagikan.", "Transisi dari CSS ke logika JS terasa berat bagi sebagian; pendampingan intensif diberikan."],
  [3, "DOM manipulation & event handling", "Praktik tombol hitung umur dan toggle dark mode sederhana; eksperimen bebas 20 menit.", "Eksperimen bebas paling disukai; muncul pertanyaan tingkat lanjut tentang event listener ganda."],
  [1, "Sumatif Tengah Semester (STS) — TP 12.1.1 s.d. 12.1.3", "Pelaksanaan STS tertulis 90 menit.", "Hasil sesuai prediksi kemampuan kelas; remedial dijadwalkan pekan depan untuk yang di bawah KKTP."],
  [4, "Keamanan digital: ancaman, phishing & proteksi data", "Studi kasus kasus phishing viral, praktik cek kekuatan sandi, diskusi 2FA.", "Diskusi sangat hidup; banyak siswa baru menyadari pentingnya 2FA setelah simulasi."],
  [4, "Etika digital & jejak digital + Kuis CBT", "Refleksi jejak digital pribadi, dilanjutkan Kuis CBT Web, JS & Keamanan Digital.", "Kuis CBT berjalan tertib; hasil dikonfirmasi cukup baik, dibahas di akhir sesi singkat."],
  [5, "Workshop prototipe aplikasi (wireframe ke MVP)", "Kerja tim membangun prototipe aplikasi web pilihan masing-masing; sprint review mini.", "Semua tim punya wireframe; 3 tim sudah mulai koding struktur halaman — laju bagus."],
  [5, "Uji coba prototipe & iterasi feedback", "Uji coba silang antar tim, pencatatan umpan balik pengguna, dan penyusunan backlog perbaikan.", "Feedback antar tim konstruktif; deadline proyek akhir disepakati 16 Oktober 2026."],
];

// ─────────────────────────────────────────────────────────────
// BANK SOAL KUIS CBT (10 PG × 10 poin, KKTP 75)
// ─────────────────────────────────────────────────────────────
interface QuizQ {
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
const QUIZ_XI: QuizQ[] = [
  { text: "Kumpulan fakta mentah yang belum diolah dan belum memiliki konteks disebut ...", options: ["Data", "Informasi", "Pengetahuan", "Laporan"], correctIndex: 0, explanation: "Data adalah fakta mentah; menjadi informasi setelah diolah dan diberi konteks." },
  { text: "Perangkat lunak yang digunakan untuk menyimpan, mengelola, dan mengambil data secara terstruktur disebut ...", options: ["Spreadsheet", "DBMS", "Compiler", "Web server"], correctIndex: 1, explanation: "DBMS (Database Management System) contohnya PostgreSQL, MySQL." },
  { text: "Kunci yang secara unik mengidentifikasi setiap baris pada sebuah tabel adalah ...", options: ["Foreign key", "Candidate key", "Primary key", "Composite key"], correctIndex: 2, explanation: "Primary key bersifat unik dan tidak boleh NULL." },
  { text: "Relasi one-to-many antara tabel siswa dan tabel nilai berarti ...", options: ["Satu siswa hanya boleh satu nilai", "Satu siswa dapat memiliki banyak nilai", "Banyak siswa harus berbagi satu nilai", "Tidak boleh ada relasi"], correctIndex: 1, explanation: "Satu siswa (satu baris di tabel siswa) dapat punya banyak baris nilai." },
  { text: "Perintah SQL yang tepat untuk menampilkan kolom nama dan nis dari tabel siswa adalah ...", options: ["SELECT nama, nis FROM siswa;", "SHOW nama, nis OF siswa;", "GET nama FROM siswa;", "PRINT nama, nis FROM siswa;"], correctIndex: 0, explanation: "Bentuk dasar: SELECT kolom FROM tabel." },
  { text: "Klausa SQL untuk memfilter baris berdasarkan suatu kondisi adalah ...", options: ["ORDER BY", "GROUP BY", "WHERE", "HAVING"], correctIndex: 2, explanation: "WHERE menyaring baris sebelum pengelompokan." },
  { text: "Perintah ORDER BY nilai DESC akan ...", options: ["Mengurutkan nilai dari kecil ke besar", "Mengurutkan nilai dari besar ke kecil", "Menghapus data duplikat", "Menjumlahkan kolom nilai"], correctIndex: 1, explanation: "DESC = descending (terbesar ke terkecil)." },
  { text: "Pada ERD, simbol belah ketupat (diamond) merepresentasikan ...", options: ["Atribut", "Entitas", "Relasi", "Kunci"], correctIndex: 2, explanation: "Diamond = relasi antar entitas; persegi = entitas; elips = atribut." },
  { text: "Tujuan utama proses normalisasi basis data adalah ...", options: ["Mempercepat koneksi internet", "Mengurangi redundansi dan anomali data", "Membuat tampilan tabel lebih menarik", "Menambah jumlah tabel sebanyak mungkin"], correctIndex: 1, explanation: "Normalisasi menekan duplikasi data agar konsisten." },
  { text: "Hasil dari query SELECT COUNT(*) FROM siswa; adalah ...", options: ["Jumlah kolom pada tabel", "Jumlah baris pada tabel", "Nilai terbesar", "Rata-rata nilai"], correctIndex: 1, explanation: "COUNT(*) menghitung banyaknya baris." },
];
const QUIZ_XII: QuizQ[] = [
  { text: "Tag HTML5 yang tepat untuk membungkus struktur navigasi halaman adalah ...", options: ["<div>", "<nav>", "<section>", "<aside>"], correctIndex: 1, explanation: "<nav> adalah elemen semantik untuk navigasi." },
  { text: "Properti CSS untuk menata item secara horizontal dengan ukuran fleksibel adalah ...", options: ["display: flex", "float: left", "position: absolute", "z-index"], correctIndex: 0, explanation: "Flexbox dirancang untuk layout satu dimensi yang fleksibel." },
  { text: "Media query pada CSS digunakan untuk ...", options: ["Membuat animasi", "Menerapkan gaya sesuai ukuran/kondisi layar", "Menghubungkan ke database", "Memvalidasi form"], correctIndex: 1, explanation: "Contoh: @media (max-width: 768px) { ... }." },
  { text: "document.getElementById('judul').textContent berfungsi untuk ...", options: ["Mengubah warna elemen", "Mengambil/mengubah teks pada elemen ber-ID judul", "Menyimpan data ke server", "Membuat elemen baru"], correctIndex: 1, explanation: "textContent membaca atau menimpa teks di dalam elemen." },
  { text: "Event yang terjadi ketika pengguna menekan tombol submit pada form adalah ...", options: ["onclick", "onsubmit", "onload", "onchange"], correctIndex: 1, explanation: "onsubmit menempel pada elemen form." },
  { text: "Kata kunci JavaScript untuk mendeklarasikan variabel yang nilainya tidak dapat diubah adalah ...", options: ["var", "let", "const", "static"], correctIndex: 2, explanation: "const mendeklarasikan binding yang tidak dapat di-assignment ulang." },
  { text: "Serangan yang mengelabui pengguna agar menyerahkan data sensitif melalui tautan palsu disebut ...", options: ["Phishing", "Firewall", "Enkripsi", "Backup"], correctIndex: 0, explanation: "Phishing memanfaatkan rekayasa sosial, bukan celah teknis." },
  { text: "Praktik pembuatan kata sandi yang paling aman adalah ...", options: ["Menggunakan tanggal lahir", "Kata singkat yang mudah diingat", "Kombinasi panjang huruf-angka-simbol dan unik tiap layanan", "Satu sandi yang sama untuk semua akun"], correctIndex: 2, explanation: "Sandi panjang, kompleks, dan unik per layanan." },
  { text: "Contoh jejak digital (digital footprint) yang positif adalah ...", options: ["Membagikan data pribadi teman", "Menyebarkan hoaks", "Berkomentar sopan dan faktual di ruang publik", "Mengunggah konten sensitif"], correctIndex: 2, explanation: "Jejak positif membangun reputasi digital yang baik." },
  { text: "Pada SDLC, tahap yang dilaksanakan setelah analisis kebutuhan adalah ...", options: ["Testing", "Deployment", "Perancangan (design)", "Maintenance"], correctIndex: 2, explanation: "Urutan umum: analisis → design → implementasi → testing → deployment → maintenance." },
];

// ─────────────────────────────────────────────────────────────
// MESIN NILAI DETERMINISTIK (koheren antar asesmen & presensi)
// ─────────────────────────────────────────────────────────────
// offset: Tugas +3, UH 0, STS -2, Kuis +1; penalti kehadiran utk siswa ≥2 ketidakhadiran.
function scoreFor(ability: number, studentIdx: number, key: number, kind: "tugas" | "uh" | "sts" | "kuis", absences: number): number {
  const kindOffset = kind === "tugas" ? 3 : kind === "uh" ? 0 : kind === "sts" ? -2 : 1;
  const jitter = ((studentIdx * 13 + key * 7) % 9) - 4; // -4..+4, stabil per (siswa, asesmen)
  const penalty = absences >= 2 ? -4 : 0;
  return clamp(ability + kindOffset + jitter + penalty);
}

async function main() {
  const { hashPin } = await import("../src/lib/student-pin");
  const pinHash = await hashPin(STUDENT_PIN);
  const passwordHash = await hashPassword(TEACHER.password);
  const tcIds = ROSTERS.map((r) => `seed_tc_bambang_${r.key}`);
  const classIds = ROSTERS.map((r) => `seed_cls_${r.key}`);

  console.log("🧹 Membersihkan data seeder lama (scoped)...");
  // Anak-anak dulu (urut FK)
  await prisma.quizAnswer.deleteMany({ where: { attempt: { quiz: { teachingContextId: { in: tcIds } } } } });
  await prisma.quizAttempt.deleteMany({ where: { quiz: { teachingContextId: { in: tcIds } } } });
  await prisma.quizStudentAccess.deleteMany({ where: { quiz: { teachingContextId: { in: tcIds } } } });
  await prisma.quiz.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.assignmentSubmission.deleteMany({ where: { assignment: { teachingContextId: { in: tcIds } } } });
  await prisma.assignment.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.assessmentResult.deleteMany({ where: { assessment: { teachingContextId: { in: tcIds } } } });
  await prisma.assessmentLearningObjective.deleteMany({ where: { assessment: { teachingContextId: { in: tcIds } } } });
  await prisma.assessment.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.attendanceRecord.deleteMany({ where: { teachingSession: { teachingContextId: { in: tcIds } } } });
  await prisma.teachingSessionLearningObjective.deleteMany({ where: { teachingSession: { teachingContextId: { in: tcIds } } } });
  await prisma.teachingSession.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.studentMonitoringNote.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.academicPlanItem.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.learningObjective.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.gradePolicyItem.deleteMany({ where: { gradePolicy: { teachingContextId: { in: tcIds } } } });
  await prisma.gradePolicy.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.assessmentType.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.teachingSchedule.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.academicContextProfile.deleteMany({ where: { teachingContextId: { in: tcIds } } });
  await prisma.teachingContext.deleteMany({ where: { id: { in: tcIds } } });
  await prisma.classStudent.deleteMany({ where: { classId: { in: classIds } } });
  await prisma.student.deleteMany({
    where: { schoolId: SCHOOL_ID, nis: { in: ROSTERS.flatMap((r) => r.students.map((s) => s.nis)) } },
  });
  await prisma.class.deleteMany({ where: { id: { in: classIds } } });
  await prisma.subject.deleteMany({ where: { id: SUBJECT_ID } });
  await prisma.teacherAgentMemory.deleteMany({ where: { teacherProfileId: TEACHER.profileId } });
  await prisma.teacherSchoolMembership.deleteMany({ where: { teacherProfileId: TEACHER.profileId } });
  await prisma.teacherProfile.deleteMany({ where: { id: TEACHER.profileId } });
  await prisma.account.deleteMany({ where: { id: TEACHER.accountId } });
  await prisma.user.deleteMany({ where: { id: TEACHER.userId } });

  console.log("👤 Membuat akun guru:", TEACHER.name);
  await prisma.user.create({
    data: {
      id: TEACHER.userId, name: TEACHER.name, email: TEACHER.email,
      emailVerified: true, platformRole: "USER", role: "USER",
      registrationOrigin: "PUBLIC_REGISTER", createdAt: new Date("2026-07-01T02:00:00Z"), updatedAt: new Date(),
    },
  });
  await prisma.account.create({
    data: {
      id: TEACHER.accountId, accountId: TEACHER.userId, providerId: "credential",
      userId: TEACHER.userId, password: passwordHash,
      createdAt: new Date("2026-07-01T02:00:00Z"), updatedAt: new Date(),
    },
  });
  await prisma.teacherProfile.create({
    data: {
      id: TEACHER.profileId, userId: TEACHER.userId, activeSchoolId: SCHOOL_ID,
      preferredName: TEACHER.preferredName, onboardingCompleted: true,
    },
  });
  await prisma.teacherSchoolMembership.create({
    data: {
      teacherProfileId: TEACHER.profileId, schoolId: SCHOOL_ID,
      status: "ACTIVE", workspaceRole: "MEMBER",
      createdAt: new Date("2026-07-06T02:00:00Z"), updatedAt: new Date("2026-07-06T02:00:00Z"),
    },
  });
  await prisma.teacherAgentMemory.create({
    data: {
      teacherProfileId: TEACHER.profileId,
      communicationTone: "RAMAH_SOPAN",
      preferredModel: "gemini-3.5-flash",
      customContext:
        "Saya Bambang Prasetyo, guru Informatika SMA Negeri 1 Nusantara (Kurikulum Merdeka, Fase F). Semester ganjil 2026/2027 mengampu 4 rombel: XI-MIPA-1, XI-MIPA-2 (materi berpikir komputasional → basis data → SQL) dan XII-MIPA-1, XII-MIPA-2 (rekayasa web → keamanan digital → proyek portofolio). KKTP mapel ini 75. Saya rutin pakai Kuis CBT di lab komputer dan menyimpan nilai tugas/UH/STS di Klassa OS. Proyek akhir semester dikumpulkan 16 Oktober 2026.",
    },
  });

  console.log("📚 Membuat mata pelajaran Informatika (Fase F)...");
  const subject = await prisma.subject.create({
    data: {
      id: SUBJECT_ID, schoolId: SCHOOL_ID,
      name: "Informatika", normalizedName: "informatika-fase-f", shortName: "INF",
    },
  });

  // ── Per rombel ─────────────────────────────────────────────
  for (const roster of ROSTERS) {
    const tcId = `seed_tc_bambang_${roster.key}`;
    const isXI = roster.key.startsWith("xi");
    const tpList = isXI ? TP_XI : TP_XII;
    const sessionPlan = isXI ? SESSIONS_XI : SESSIONS_XII;
    const quizBank = isXI ? QUIZ_XI : QUIZ_XII;

    console.log(`🏫 ${roster.className} — ${roster.students.length} siswa`);

    // Kelas + siswa (batch)
    const cls = await prisma.class.create({
      data: {
        id: `seed_cls_${roster.key}`, schoolId: SCHOOL_ID, name: roster.className,
        normalizedName: roster.normalizedName, gradeLevel: roster.gradeLevel,
        joinCode: roster.joinCode, joinCodeLocked: true,
      },
    });

    await prisma.student.createMany({
      data: roster.students.map((s) => ({
        id: `seed_stu_${s.nis}`, schoolId: SCHOOL_ID, fullName: s.name, nis: s.nis,
        status: "ACTIVE", accountStatus: "ACTIVE", accessPinHash: pinHash,
        pinUpdatedAt: new Date("2026-07-20T02:00:00Z"),
        createdByTeacherProfileId: TEACHER.profileId,
        approvedById: TEACHER.userId, approvedAt: new Date("2026-07-20T02:00:00Z"),
        birthDate: s.birthDate,
      })),
    });
    await prisma.classStudent.createMany({
      data: roster.students.map((s) => ({
        studentId: `seed_stu_${s.nis}`, classId: cls.id, academicPeriodId: PERIOD_ID,
      })),
    });

    const students = roster.students.map((s, i) => ({
      id: `seed_stu_${s.nis}`, nis: s.nis, name: s.name, ability: s.ability,
      absences: roster.incidents.filter((inc) => inc.idx === i).length,
    }));

    // Teaching context + jadwal + profil akademik
    await prisma.teachingContext.create({
      data: {
        id: tcId, teacherProfileId: TEACHER.profileId, schoolId: SCHOOL_ID,
        academicPeriodId: PERIOD_ID, subjectId: subject.id, classId: cls.id,
      },
    });
    await prisma.teachingSchedule.create({
      data: {
        id: `seed_sched_${roster.key}`, teachingContextId: tcId,
        dayOfWeek: roster.dayOfWeek, startTime: roster.startTime, endTime: roster.endTime,
      },
    });
    await prisma.academicContextProfile.create({
      data: {
        teachingContextId: tcId, curriculumName: "Kurikulum Merdeka", phase: "F",
        hoursPerWeek: 2, effectiveWeeksSem1: 18, effectiveWeeksSem2: 16,
        cpText:
          "Peserta didik mampu menerapkan cara berpikir komputasional dan mengintegrasikan keterampilan procedural untuk membangun kecakapan digital sesuai perkembangan teknologi.",
        academicNote: `${roster.className} — Informatika ${isXI ? "(Berpikir Komputasional, Algoritma, Struktur Data, Basis Data)" : "(Rekayasa Web, JavaScript, Keamanan Digital, Proyek Portofolio)"}. Lab komputer digunakan pada pekan praktik & CBT.`,
      },
    });

    // TP + PROTA ringkas + bobot nilai (batch, ID deterministik)
    const loIds = tpList.map((_, i) => `seed_lo_${roster.key}_${i + 1}`);
    await prisma.learningObjective.createMany({
      data: tpList.map((tp, i) => ({
        id: loIds[i], teachingContextId: tcId, code: tp.code, description: tp.desc,
        orderIndex: i + 1, targetSemester: 1, allocatedHours: tp.hours,
      })),
    });
    await prisma.academicPlanItem.createMany({
      data: tpList.map((tp, i) => ({
        id: `seed_prota_${roster.key}_${i + 1}`, teachingContextId: tcId,
        learningObjectiveId: loIds[i], planType: "PROTA",
        title: `${tp.code} — ${tp.desc.slice(0, 60)}...`,
        targetMonth: 7 + i * 2 > 12 ? 12 : 7 + i * 2, targetSemester: 1,
        allocatedHours: tp.hours, orderIndex: i + 1,
        notes: `Alokasi ${tp.hours} JP; pekan ${i * 2 + 1}-${i * 2 + 2}.`,
      })),
    });

    const mkTypes = (
      rows: { slug: string; name: string; category: "ASSIGNMENT" | "SUMMATIVE" | "MIDTERM" | "PRACTICE" }[]
    ) => rows.map((r) => ({ id: `seed_at_${roster.key}_${r.slug}`, teachingContextId: tcId, name: r.name, normalizedName: r.slug, category: r.category, isActive: true }));
    await prisma.assessmentType.createMany({
      data: mkTypes([
        { slug: "tugas", name: "Tugas", category: "ASSIGNMENT" },
        { slug: "ulangan-harian", name: "Ulangan Harian", category: "SUMMATIVE" },
        { slug: "sts", name: "Sumatif Tengah Semester", category: "MIDTERM" },
        { slug: "kuis-cbt", name: "Kuis CBT (Lab)", category: "PRACTICE" },
      ]),
    });
    const typeIds = {
      tugas: `seed_at_${roster.key}_tugas`,
      uh: `seed_at_${roster.key}_ulangan-harian`,
      sts: `seed_at_${roster.key}_sts`,
      kuis: `seed_at_${roster.key}_kuis-cbt`,
    };

    const gp = await prisma.gradePolicy.create({
      data: { id: `seed_gp_${roster.key}`, teachingContextId: tcId, status: "ACTIVE" },
    });
    await prisma.gradePolicyItem.createMany({
      data: [
        { gradePolicyId: gp.id, assessmentTypeId: typeIds.tugas, weight: 30, sortOrder: 1 },
        { gradePolicyId: gp.id, assessmentTypeId: typeIds.uh, weight: 25, sortOrder: 2 },
        { gradePolicyId: gp.id, assessmentTypeId: typeIds.sts, weight: 25, sortOrder: 3 },
        { gradePolicyId: gp.id, assessmentTypeId: typeIds.kuis, weight: 20, sortOrder: 4 },
      ],
    });

    // 12 pertemuan + presensi (batch)
    const sessions = Array.from({ length: WEEKS }, (_, k) => {
      const w = k + 1;
      return { id: `seed_sess_${roster.key}_${w}`, week: w, date: sessionDate(w, roster.dayOfWeek) };
    });
    await prisma.teachingSession.createMany({
      data: sessionPlan.map((sp, k) => {
        const w = k + 1;
        const [, topic, activity, reflection] = sp;
        const date = sessionDate(w, roster.dayOfWeek);
        return {
          id: sessions[k].id, teachingContextId: tcId,
          teachingScheduleId: `seed_sched_${roster.key}`,
          date, startedAt: atTime(date, roster.startTime), endedAt: atTime(date, roster.endTime),
          attendanceRecordedAt: atTime(date, roster.endTime),
          plannedTopic: topic, actualTopic: topic,
          activitySummary: activity,
          reflection: `${reflection}${w === WEEKS ? " [Pertemuan terakhir sebelum laporan tengah semester.]" : ""}`,
          status: "COMPLETED" as const,
        };
      }),
    });
    await prisma.teachingSessionLearningObjective.createMany({
      data: sessionPlan.map((sp, k) => {
        const tpIdx = sp[0];
        return {
          teachingSessionId: sessions[k].id, learningObjectiveId: loIds[tpIdx - 1],
          snapshotCode: tpList[tpIdx - 1].code, snapshotDescription: tpList[tpIdx - 1].desc,
        };
      }),
    });
    await prisma.attendanceRecord.createMany({
      data: sessions.flatMap((sess) =>
        students.map((st, i) => {
          const incident = roster.incidents.find((inc) => inc.idx === i && inc.week === sess.week);
          return {
            teachingSessionId: sess.id, studentId: st.id,
            status: incident ? incident.status : ("PRESENT" as AttendanceStatus),
          };
        })
      ),
    });

    // ── Asesmen terjadwal (nilai koheren dgn kemampuan & kehadiran; batch) ──
    const assessPlan: {
      slug: string; typeId: string; title: string; desc: string; week: number;
      kind: "tugas" | "uh" | "sts" | "kuis"; keySeed: number; loIdx: number;
    }[] = [
      {
        slug: "tugas1", typeId: typeIds.tugas,
        title: isXI ? "Tugas 1: Pseudocode Prosedur Harian" : "Tugas 1: Halaman Profil HTML5 Semantik",
        desc: isXI ? "Menyusun pseudocode 10-15 langkah dari satu prosedur harian pilihan siswa." : "Membangun halaman profil pribadi satu file dengan struktur semantik HTML5.",
        week: 3, kind: "tugas", keySeed: 1, loIdx: 1,
      },
      {
        slug: "uh1", typeId: typeIds.uh,
        title: isXI ? "UH 1: Algoritma & Seleksi" : "UH 1: HTML5 & CSS Layout",
        desc: isXI ? "5 soal uraian singkat pseudocode + 2 kasus if-then-else." : "10 PG + 2 praktik singkat flexbox & media query.",
        week: 4, kind: "uh", keySeed: 2, loIdx: 1,
      },
      {
        slug: "tugas2", typeId: typeIds.tugas,
        title: isXI ? "Tugas 2: Studi Kasus Array Kehadiran" : "Tugas 2: Skrip Validasi Form JavaScript",
        desc: isXI ? "Representasi data kehadiran kelompok dalam array 2D dan analisis sederhananya." : "Membuat validasi form sederhana (wajib isi, batas usia) dengan JavaScript DOM.",
        week: 6, kind: "tugas", keySeed: 3, loIdx: 2,
      },
      {
        slug: "sts", typeId: typeIds.sts,
        title: "Sumatif Tengah Semester Ganjil 2026/2027",
        desc: isXI ? "Materi TP 11.1.1-11.1.3: berpikir komputasional, algoritma, struktur data." : "Materi TP 12.1.1-12.1.3: SDLC, HTML5-CSS, JavaScript dasar.",
        week: 8, kind: "sts", keySeed: 4, loIdx: 0,
      },
      {
        slug: "kuis", typeId: typeIds.kuis,
        title: isXI ? "Kuis CBT: Basis Data & SQL" : "Kuis CBT: Web, JavaScript & Keamanan Digital",
        desc: "Kuis CBT 10 soal pilihan ganda di lab komputer; dibahas bersama di pertemuan berikutnya.",
        week: 10, kind: "kuis", keySeed: 5, loIdx: 4,
      },
    ];
    const assessmentIds = Object.fromEntries(assessPlan.map((a) => [a.slug, `seed_as_${roster.key}_${a.slug}`]));
    await prisma.assessment.createMany({
      data: assessPlan.map((a) => ({
        id: assessmentIds[a.slug], teachingContextId: tcId, assessmentTypeId: a.typeId,
        teachingSessionId: sessions[a.week - 1].id, title: a.title, description: a.desc,
        assessmentDate: sessions[a.week - 1].date, maxScore: 100, minimumPassingScore: 75,
        status: "COMPLETED" as const, participantsInitializedAt: sessions[a.week - 1].date,
      })),
    });
    await prisma.assessmentLearningObjective.createMany({
      data: assessPlan.map((a) => ({
        assessmentId: assessmentIds[a.slug], learningObjectiveId: loIds[a.loIdx],
        snapshotCode: tpList[a.loIdx].code, snapshotDescription: tpList[a.loIdx].desc,
      })),
    });
    await prisma.assessmentResult.createMany({
      data: assessPlan.flatMap((a) =>
        students.map((st, i) => {
          const sc = scoreFor(st.ability, i, a.keySeed, a.kind, st.absences);
          return {
            assessmentId: assessmentIds[a.slug], studentId: st.id, status: "GRADED" as const,
            rawScore: sc, normalizedScore: sc, finalScore: sc,
            note: sc < 75 ? "Remedial: mengerjakan ulang versi paralel pekan depan." : null,
          };
        })
      ),
    });

    const sessOf = (w: number) => sessions[w - 1];

    // ── Assignment + submissions (batch) ──
    const asgDefs = [
      {
        id: `seed_asg_${roster.key}_tugas1`,
        title: isXI ? "Tugas 1: Pseudocode Prosedur Harian" : "Tugas 1: Halaman Profil HTML5 Semantik",
        desc: isXI
          ? "Pilih satu prosedur harian (bangun tidur → berangkat sekolah). Tulis pseudocode 10-15 langkah, tandai langkah seleksi bila ada. Format: PDF/Google Docs."
          : "Buat halaman profil pribadi satu file index.html dengan header, nav, main, article, footer. Sertakan foto/avatar dan 3 paragraf perkenalan. Kumpulkan tautan atau lampiran.",
        issueWeek: 3,
      },
      {
        id: `seed_asg_${roster.key}_tugas2`,
        title: isXI ? "Tugas 2: Studi Kasus Array Kehadiran" : "Tugas 2: Skrip Validasi Form JavaScript",
        desc: isXI
          ? "Kelompok 4 orang. Representasikan rekap kehadiran 2 pekan ke dalam array 2D, lalu hitung persentase kehadiran tiap anggota. Lampirkan tabel hasil."
          : "Buat satu halaman form pendaftaran (nama, usia, email) dengan validasi JavaScript: wajib isi, usia 10-19. Tampilkan pesan error di bawah field.",
        issueWeek: 6,
      },
    ];
    await prisma.assignment.createMany({
      data: [
        ...asgDefs.map((a) => ({
          id: a.id, teachingContextId: tcId, teachingSessionId: sessOf(a.issueWeek).id,
          title: a.title, description: a.desc,
          dueDate: atTime(mondayOfWeek(a.issueWeek + 1), "23:59"), status: "ACTIVE" as const,
          createdAt: sessOf(a.issueWeek).date, updatedAt: new Date(),
        })),
        {
          id: `seed_asg_${roster.key}_proyek`, teachingContextId: tcId,
          teachingSessionId: sessOf(12).id,
          title: isXI ? "Proyek Akhir: Basis Data Sekolah (Kelompok)" : "Proyek Portofolio: Prototipe Aplikasi Web",
          description: isXI
            ? "Rancang ERD + implementasi 3-4 tabel (siswa, kelas, mapel, nilai) beserta 10 query SQL analitik. Presentasi 10 menit per kelompok."
            : "Publikasikan prototipe aplikasi web kelompok (min. 3 halaman responsif + 1 interaksi JS + halaman dokumentasi singkat). Deploy bebas (Netlify/GitHub Pages).",
          dueDate: new Date("2026-10-16T16:59:00Z"), status: "ACTIVE" as const,
          createdAt: sessOf(12).date, updatedAt: sessOf(12).date,
        },
      ],
    });

    const submissionTexts1 = isXI
      ? ["Berikut lampiran pseudocode prosedur berangkat sekolah, sudah saya tandai 2 langkah seleksi (cek hujan & cek jam).", "Pak, saya pilih prosedur memasak nasi. Pseudocode 14 langkah terlampir.", "Lampiran: pseudocode rutinitas belajar malam dengan 1 seleksi (kalo PR banyak)."]
      : ["Pak, ini tautan halaman profil saya: https://sma1nusantara.github.io/profil/[nama]. Sudah pakai nav dan article.", "Lampiran index.html profil pribadi, footer berisi kontak.", "Tautan halaman profil sudah online, mohon dicek Pak Bambang."];
    const submissionTexts2 = isXI
      ? ["Lampiran rekap array kehadiran kelompok + tabel persentase. Ada 1 anggota yang sakit 2x.", "Berikut laporan studi kasus array 2D kehadiran kelompok kami (tabel 14 hari × 4 orang).", "Tabel kehadiran dan perhitungan persentase terlampir."]
      : ["Tautan form pendaftaran + validasi JS sudah jalan: wajib isi & usia 10-19 tampil error merah.", "Lampiran file form-daftar.html + script.js. Validasi sudah dites.", "Form validasi selesai Pak, error message muncul di bawah field."];
    const feedbackGood = ["Rapi dan runtut — pertahankan. Catatan kecil: konsistenkan penamaan variabel/langkah.", "Struktur sudah benar; nilai penuh di bagian kerapian. Teruskan.", "Sangat baik, tepat instruksi. Coba level lebih menantang berikutnya."];
    const feedbackMid = ["Secara garis besar benar; ada 2 langkah yang terlewat — perhatikan detail instruksi.", "Sudah oke, namun format penulisan perlu lebih konsisten.", "Cukup baik; sering-sering cek ulang sebelum mengumpulkan."];

    await prisma.assignmentSubmission.createMany({
      data: asgDefs.flatMap((asg, defIdx) => {
        const texts = defIdx === 0 ? submissionTexts1 : submissionTexts2;
        const keySeed = defIdx === 0 ? 1 : 3;
        const due = atTime(mondayOfWeek(asg.issueWeek + 1), "23:59");
        const noSubmitIdx = defIdx === 1 ? (roster.students.length > 15 ? 8 : 3) : -1;
        const lateIdx = defIdx === 0 ? 21 : -1;
        return students
          .map((st, i) => {
            if (i === noSubmitIdx) return null; // 1 siswa lupa mengumpulkan via portal
            const sc = scoreFor(st.ability, i, keySeed, "tugas", st.absences);
            const isLate = i === lateIdx;
            const reviewed = !isLate;
            const submittedAt = new Date(due.getTime() - (isLate ? 0 : ((i + 1) * 3600 * 1000) % (48 * 3600 * 1000)));
            return {
              assignmentId: asg.id, studentId: st.id,
              textContent: texts[i % texts.length],
              status: (reviewed ? "REVIEWED" : "SUBMITTED") as "REVIEWED" | "SUBMITTED",
              score: reviewed ? sc : null,
              feedback: reviewed ? (sc >= 85 ? feedbackGood[i % feedbackGood.length] : feedbackMid[i % feedbackMid.length]) : null,
              submittedAt,
              reviewedAt: reviewed ? new Date(due.getTime() + ((i % 5) + 1) * 24 * 3600 * 1000) : null,
              reviewedByProfileId: TEACHER.profileId,
              createdAt: submittedAt, updatedAt: new Date(),
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
      }),
    });

    // ── Kuis CBT (Quiz) + akses + attempt + jawaban koheren (batch) ──
    const quizId = `seed_quiz_${roster.key}`;
    await prisma.quiz.create({
      data: {
        id: quizId, teachingContextId: tcId,
        title: isXI ? "Kuis CBT Informatika — Basis Data & SQL" : "Kuis CBT Informatika — Web, JavaScript & Keamanan Digital",
        description: "10 soal pilihan ganda, dikerjakan individu di lab komputer. Nilai langsung muncul setelah submit.",
        status: "PUBLISHED", durationMinutes: 40,
        shareToken: `CBT-${roster.key.toUpperCase()}-2026`,
        standardScore: 75,
        validFrom: atTime(sessOf(10).date, roster.startTime),
        deadline: atTime(sessOf(10).date, "23:59"),
        accessMode: "CLASSROOM_PIN", classroomPin: "2026",
      },
    });
    await prisma.quizQuestion.createMany({
      data: quizBank.map((q, i) => ({
        id: `seed_qq_${roster.key}_${i + 1}`, quizId, order: i + 1,
        type: "MULTIPLE_CHOICE" as const, text: q.text, options: q.options,
        correctIndex: q.correctIndex, points: 10, explanation: q.explanation,
      })),
    });
    await prisma.quizStudentAccess.createMany({
      data: students.map((s) => ({ quizId, studentId: s.id, pin: STUDENT_PIN })),
    });
    // Siswa ABSENT di pekan 10 tidak ikut kuis
    const absentW10Idx = new Set(roster.incidents.filter((i) => i.week === 10).map((i) => i.idx));
    const attemptRows = students
      .map((st, i) => {
        if (absentW10Idx.has(i)) return null;
        const sc = scoreFor(st.ability, i, 5, "kuis", st.absences);
        const correctCount = Math.round(sc / 10);
        const started = new Date(atTime(sessOf(10).date, roster.startTime).getTime() + ((i * 3) % 12) * 60 * 1000);
        const durationMin = 22 + ((i * 5) % 16); // 22-37 menit
        return {
          id: `seed_qa_${roster.key}_${i + 1}`, quizId, studentId: st.id,
          status: "SUBMITTED" as const, startedAt: started,
          submittedAt: new Date(started.getTime() + durationMin * 60 * 1000),
          score: sc, isRemedial: sc < 75,
          questionOrder: Array.from({ length: quizBank.length }, (_, k) => ((k + i) % quizBank.length) + 1),
          correctCount,
          i,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    await prisma.quizAttempt.createMany({
      data: attemptRows.map((a) => {
        const { correctCount: _correctCount, i: _studentIdx, ...attempt } = a;
        void _correctCount; void _studentIdx;
        return attempt;
      }),
    });
    await prisma.quizAnswer.createMany({
      data: attemptRows.flatMap(({ id, i, correctCount }) =>
        quizBank.map((q, j) => {
          const isCorrect = j < correctCount;
          const ci = q.correctIndex;
          const selected = isCorrect ? ci : (ci + 1 + (i % 3)) % q.options.length;
          return {
            attemptId: id, questionId: `seed_qq_${roster.key}_${j + 1}`,
            selectedIndex: selected, isCorrect,
            score: isCorrect ? 10 : 0,
            feedback: isCorrect ? q.explanation : `Kurang tepat. ${q.explanation}`,
          };
        })
      ),
    });

    // ── Catatan monitoring siswa (kasus nyata; batch) ──
    const idxLow = students.findIndex((s) => s.ability <= 70);
    const idxTop = students.findIndex((s) => s.ability >= 92);
    const idxSick = roster.incidents[0].idx;
    const incAbsent = roster.incidents.find((i) => i.status === "ABSENT");
    const idxAlfa = incAbsent ? incAbsent.idx : 5;
    const noteDefs = [
      {
        idx: idxLow,
        content: `Hasil STS ${students[idxLow]?.name ?? "siswa"} di bawah KKTP 75. Sudah dijadwalkan remedial versi paralel pekan ini dan diberi pendampingan mandiri sebelum praktikum. Perlu pantau konsistensi tugas berikutnya.`,
        followUp: true, resolved: false, date: "2026-09-04T02:00:00Z",
      },
      {
        idx: idxTop,
        content: `${students[idxTop]?.name ?? "Siswa"} menunjukkan potensi kuat (nilai stabil di atas 90). Sudah diarahkan mendaftar seleksi tim OSK Informatika dan diberi materi pengayaan struktur data lanjut.`,
        followUp: false, resolved: true, date: "2026-09-10T02:00:00Z",
      },
      {
        idx: idxSick,
        content: `${roster.students[idxSick].name} absen sakit lebih dari satu kali (surat dokter diwali kelas). Nilai tugas tetap terkumpul tepat waktu. Koordinasi dengan wali kelas untuk memantau kondisi kesehatannya.`,
        followUp: true, resolved: false, date: "2026-09-18T02:00:00Z",
      },
      {
        idx: idxAlfa,
        content: `${roster.students[idxAlfa].name} tercatat alfa satu pertemuan tanpa keterangan. Sudah dikonfirmasi ke wali kelas dan diminta surat pernyataan; diberi tugas penyama materi agar tidak tertinggal.`,
        followUp: true, resolved: true, date: "2026-09-25T02:00:00Z",
      },
    ].filter((n) => n.idx >= 0 && students[n.idx]);
    await prisma.studentMonitoringNote.createMany({
      data: noteDefs.map((n) => ({
        teachingContextId: tcId, studentId: students[n.idx].id,
        content: n.content, requiresFollowUp: n.followUp,
        resolvedAt: n.resolved ? new Date(n.date) : null,
        createdAt: new Date(n.date), updatedAt: new Date(n.date),
      })),
    });
  }

  // ── Ringkasan ──
  const totalStudents = ROSTERS.reduce((a, r) => a + r.students.length, 0);
  const sessionCount = await prisma.teachingSession.count({ where: { teachingContextId: { in: tcIds } } });
  const attendanceCount = await prisma.attendanceRecord.count({ where: { teachingSession: { teachingContextId: { in: tcIds } } } });
  const assessmentCount = await prisma.assessment.count({ where: { teachingContextId: { in: tcIds } } });
  const resultCount = await prisma.assessmentResult.count({ where: { assessment: { teachingContextId: { in: tcIds } } } });
  const attemptCount = await prisma.quizAttempt.count({ where: { quiz: { teachingContextId: { in: tcIds } } } });
  const submissionCount = await prisma.assignmentSubmission.count({ where: { assignment: { teachingContextId: { in: tcIds } } } });
  console.log("\n✅ SEED SELESAI — Pak Bambang Prasetyo (Informatika)");
  console.log(`   Rombel: ${ROSTERS.length} | Siswa: ${totalStudents}`);
  console.log(`   Pertemuan: ${sessionCount} | Presensi: ${attendanceCount}`);
  console.log(`   Asesmen: ${assessmentCount} | Nilai: ${resultCount}`);
  console.log(`   Kuis CBT attempts: ${attemptCount} | Pengumpulan tugas: ${submissionCount}`);
  console.log("\n🔑 LOGIN GURU  → email: guru.bambang@klassa.id | password: GuruKlassa2026!");
  console.log(`🔑 PORTAL SISWA → Sekolah: SMA Negeri 1 Nusantara | NIS contoh: ${ROSTERS[0].students[0].nis} | PIN: ${STUDENT_PIN}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed gagal:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
