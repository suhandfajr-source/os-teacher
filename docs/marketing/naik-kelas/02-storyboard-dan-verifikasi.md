# Storyboard dan bukti produksi — Tadi Katanya Bentar

Tagline aktif: **Naikkan Kelasmu!**, dikoreksi langsung oleh pengguna. Dokumen brand lama tidak menjadi acuan tagline video ini.
Status: konsep disetujui; naskah lengkap dan storyboard revisi menunggu persetujuan. Bukan bukti demo end-to-end berhasil.

## Keputusan kreatif

- Format rencana: 1080 × 1920, 30 fps, MP4 H.264/yuv420p; audio AAC saat voice-over tersedia.
- Target 50–60 detik adalah keputusan editorial, bukan rekomendasi algoritma platform atau jaminan performa.
- Alur: percakapan “bentar” → tiga pekerjaan muncul → KLASSA menjawab pekerjaan yang sama → penutup brand.
- Close-up layar/laptop tanpa lokasi yang dapat dikenali. Tidak ada bel sekolah atau klaim guru belum pulang; tidak mengasumsikan pekerjaan dilakukan di rumah.
- Pembuka adalah ilustrasi percakapan, bukan testimoni pengguna. Semua VO bisa direkam satu orang dalam take terpisah; tidak membutuhkan aktor tambahan.
- Punchline “Tadi katanya bentar.” hanya tampil sebagai teks, disertai jeda, bukan dibacakan sebagai slogan.
- Identitas: teal #0F766E, mint #CCFBF1, pearl #F6F8F8, aksen indigo #6366F1, mengikuti blueprint brand. Logo dari aset project; jangan generate ulang logo.
- Animasi naik digunakan untuk judul dan transisi, bukan seluruh elemen bergerak terus-menerus.
- Detail aplikasi diperbesar per bagian, bukan menjejalkan seluruh desktop ke layar ponsel.
- Subtitle maksimal dua baris sebagai pilihan desain, disinkronkan ke rekaman final. Penempatan harus diperiksa pada preview UI kedua platform; jangan menganggap satu safe area berlaku permanen.
- Tidak memakai musik tanpa lisensi. Rough cut dapat dibuat tanpa musik.

## Storyboard sementara

Waktu berikut adalah slot editorial; akan disesuaikan dengan audio aktual.

| Waktu | Voice-over / inti pesan | Visual yang direncanakan | Syarat |
| --- | --- | --- | --- |
| 0–2 dtk | Suara luar layar: “Masih lama?” | Close-up bingkai laptop bergaya grafis; pertanyaan muncul kecil dari luar bingkai | Lokasi dan identitas penanya tidak ditentukan |
| 2–7 dtk | Guru: “Bentar. Tinggal nyiapin bahan buat besok.” | Catatan generik bertuliskan Bahan besok; kursor berhenti sejenak | Ilustrasi editorial, bukan UI produk atau aplikasi pesaing |
| 7–12 dtk | “Oh iya, presensi tadi belum dicatat.” | Tab/catatan Presensi menyusul di samping bahan | Jangan memakai nama siswa asli |
| 12–15 dtk | “Sama rekap nilai…” | Tab Rekap nilai muncul; gerakan melambat | Tidak perlu efek alarm atau dramatisasi stres |
| 15–17 dtk | Hening singkat | Teks “Tadi katanya bentar.”; kursor diam | Punchline tidak dibaca VO; jangan tertutup subtitle sebelumnya |
| 17–21 dtk | “Pak, Bu… coba mulai dari KLASSA.” | Tab ilustratif bergeser; masuk ke capture aplikasi nyata | Periksa aset logo final. Jangan membuat UI rekaan seolah capture produk |
| 21–31 dtk | “Bahan buat besok? Bikin drafnya bareng AI. Baca dulu, sesuaikan sama kelas sendiri.” | AI Studio: topik → draf → sorot area edit. Overlay ringkas: Draf dulu. Tinjau lagi. | Provider live harus diverifikasi. Jika proses dipotong, beri penanda waktu dipersingkat; jangan mengesankan generasi instan |
| 31–39 dtk | “Presensi tadi? Catat di sesi mengajar, sekalian isi jurnalnya.” | Close-up kontrol presensi dan jurnal sesi yang sama | Verifikasi persistensi pada data demo; tidak menyiratkan presensi otomatis |
| 39–46 dtk | “Kalau rekap nilai? Buka laporannya. Tinggal unduh.” | Rekap nilai berisi data demo yang sudah tercatat; sorot tombol unduh | Tidak menyiratkan sistem mengisi nilai sendiri. File hasil unduh harus diverifikasi |
| 46–51 dtk | “Yang naik kelas masa cuma muridnya?” | Pertanyaan besar, kata naik bergerak satu tingkat | Tidak menyiratkan peningkatan hasil belajar yang dijamin |
| 51–55 dtk | “KLASSA. Naikkan Kelasmu!” | Logo resmi + tagline baru, ruang kosong cukup | Jangan memakai lockup yang masih menampilkan tagline lama |
| 55–60 dtk | “Daftar aplikasi sekarang.” | End card bertahan; CTA tetap terbaca sampai akhir | Tayang hanya setelah akses daftar tersedia dan teruji; tanpa URL/QR palsu |

## Bukti yang sudah diperiksa

| Klaim / elemen | Sumber project | Yang benar-benar diketahui |
| --- | --- | --- |
| Tagline Naikkan Kelasmu! | Koreksi eksplisit pengguna dalam percakapan | Acuan tagline terbaru untuk materi video. Blueprint lama masih memuat tagline sebelumnya; belum disinkronkan secara global |
| Guru tetap menentukan; palet brand | docs/brand/KLASSA_BRAND_MASTER_BLUEPRINT.md, bagian 4 dan 6 | Acuan visual dan prinsip komunikasi; bukan bukti dampak produk |
| Generate, refine, simpan draf | src/modules/ai/ai.actions.ts; src/modules/ai/ai.types.ts | Ada implementasi alur dan tipe konten. Provider live belum diuji |
| Presensi, jurnal, refleksi | src/modules/teaching/teaching.actions.ts; src/app/(dashboard)/kelas/[teachingContextId]/pertemuan/[sessionId]/SessionClient.tsx | Implementasi sesi dan UI tersedia. Simpan lewat browser belum diuji |
| Laporan jurnal, presensi, nilai | src/modules/reporting/reporting.actions.ts; src/app/(dashboard)/laporan/ReportingClient.tsx | Implementasi laporan dan UI ekspor tersedia; cakupan mengikuti konteks mengajar yang diotorisasi, bukan otomatis seluruh sekolah |
| Ekspor XLSX | src/modules/reporting/reporting.export.ts dan __tests__/reporting.export.test.ts | Tes unit membuat buffer workbook dan membaca hasilnya; bukan bukti unduhan melalui UI |
| Pendaftaran | src/app/(auth)/register/page.tsx | Form dan pemanggilan signup ada. Alamat publik dan keberhasilan signup belum diverifikasi |

## Catatan validasi tahap sebelumnya

Hasil berikut dipertahankan sebagai riwayat; tidak dijalankan ulang saat revisi naskah ini.

1. `npx vitest run src/modules/reporting/__tests__/reporting.export.test.ts src/modules/ai/__tests__/ai.provider.test.ts --reporter=dot`
   - Hasil: 2 file, 13 tes lulus.
   - Batas: tes provider memakai MockAiContentProvider; tidak memverifikasi kualitas, latensi, atau koneksi layanan AI produksi.
2. Render smoke test FFmpeg ke `.pi/video-promo/render-smoke.mp4`.
   - ffprobe: H.264, 1080 × 1920, yuv420p, 30 fps, durasi 1 detik.
   - Ini hanya tes encoding warna polos, bukan preview video promosi dan belum menguji sinkronisasi voice-over.
3. Server pengembangan dinyalakan di `http://127.0.0.1:3002`; port terdeteksi listening.
   - Log: `.pi/video-promo/dev-server.log`.
   - Server listening bukan bukti halaman berhasil dirender.
4. `agent-browser` dipasang secara global (0.39.1), tidak ditambahkan ke dependency aplikasi.
   - `agent_browser doctor`: Chrome dan FFmpeg terdeteksi; headless about:blank lulus.
   - Pembukaan aplikasi melalui wrapper tetap gagal: `could not verify this managed session's live daemon restore policy`, termasuk setelah fresh session dan close/retry.
   - Akibatnya: belum ada screenshot, rekaman, atau verifikasi alur aplikasi melalui browser pada sesi ini.

## Gate sebelum produksi final

- [ ] Browser wrapper bisa membuka aplikasi lokal.
- [ ] Akses akun demo lewat jalur yang diizinkan; jangan menampilkan data siswa asli, kredensial, token, atau catatan sensitif.
- [ ] AI Studio diverifikasi dengan provider nyata sebelum menyebut hasil sebagai generasi live; perubahan data hanya di lingkungan demo yang jelas.
- [ ] Presensi dan jurnal dicek termasuk persistensi, bukan hanya tombol atau toast.
- [ ] Rekap tampil sesuai data demo dan file hasil unduh dapat dibuka.
- [ ] Draf naskah disetujui dan dikunci; pengguna belum diminta merekam sebelum tahap ini.
- [ ] Voice-over diterima; subtitle dan timing disesuaikan audio, bukan estimasi.
- [ ] Rough cut ditinjau: keterbacaan mobile, logo, pacing, tidak ada data pribadi.
- [ ] Logo/lockup dan end card memakai “Naikkan Kelasmu!”; tidak ada tagline lama pada materi yang terlihat.
- [ ] Pembuka dan demo dibedakan jelas; tidak ada klaim lokasi/kebiasaan guru atau hasil instan dari jump cut.
- [ ] URL publik tersedia dan pendaftaran diuji sebelum memakai CTA peluncuran.
- [ ] MP4 final diperiksa dengan ffprobe serta diputar untuk verifikasi gambar, suara, dan sinkronisasi.

## Langkah berikutnya

Selesaikan kendala browser lalu verifikasi tiga alur dengan data demo. Bila tetap terhalang, laporkan blokir; jangan mengganti bukti runtime dengan UI rekaan yang terlihat seolah tangkapan produk asli. Naskah dan storyboard boleh disetujui secara kreatif sekarang, tetapi klaim fitur belum dikunci untuk produksi.
