import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, FileText, Scale } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan Layanan - KLASSA",
  description: "Syarat dan Ketentuan Layanan resmi platform KLASSA Edutech (SaaS & Digital Goods)",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-10 shadow-sm">
        
        {/* Back navigation */}
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Halaman Masuk</span>
        </Link>

        {/* Header */}
        <div className="border-b border-slate-200/80 pb-6 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-[11px] font-bold uppercase tracking-wider mb-3 border border-teal-200/50">
            <Scale className="w-3.5 h-3.5" />
            <span>Dokumen Perjanjian Resmi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
            Syarat &amp; Ketentuan Layanan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Terakhir Diperbarui: 13 Januari 2026 · Standar Lisensi Perangkat Lunak &amp; Barang Digital
          </p>
        </div>

        {/* Intro */}
        <div className="bg-slate-50 border-l-4 border-teal-600 p-4 rounded-r-2xl mb-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
          Dokumen ini merupakan perjanjian hukum antara Anda (Pengguna/Pendidik/Institusi) dan <strong>KLASSA</strong> selaku penyedia layanan SaaS AI Teacher Assistant. Dengan mendaftar, menggunakan, atau melakukan transaksi pembayaran di platform ini, Anda menyetujui seluruh isi ketentuan di bawah ini.
        </div>

        {/* Sections */}
        <div className="space-y-7 text-xs sm:text-sm leading-relaxed text-slate-700">
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">1. Penerimaan Ketentuan (Conditions of Use)</h2>
            <p>
              Layanan KLASSA disediakan berdasarkan penerimaan tanpa syarat atas semua klausul, aturan, dan pemberitahuan di dalam dokumen ini. Jika Anda tidak menyetujui salah satu klausul, Anda wajib menghentikan akses dan tidak melanjutkan penggunaan platform.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">2. Modifikasi Layanan &amp; Ketentuan</h2>
            <p>
              KLASSA berhak memperbarui antarmuka, fitur kecerdasan buatan, harga paket langganan, dan syarat ketentuan ini sewaktu-waktu. Penyesuaian tarif berlaku untuk siklus langganan berikutnya dan tidak berlaku surut untuk periode aktif yang telah dibayar.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">3. Pemberian Lisensi Perangkat Lunak (Grant of License)</h2>
            <p>
              KLASSA memberikan kepada Anda hak non-eksklusif, tidak dapat dialihkan (non-transferable), dan terbatas untuk mengakses sistem platform untuk kebutuhan internal pembelajaran dan administrasi mengajar. Anda dilarang keras untuk:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Mendekompilasi, merekayasa balik (reverse engineer), atau membongkar kode sumber sistem.</li>
              <li>Membuat produk tiruan atau turunan dari sistem, algoritma, atau antarmuka KLASSA.</li>
              <li>Menjual kembali, menyewakan, atau membagikan akun kepada pihak ketiga tanpa izin resmi.</li>
              <li>Melakukan penarikan data massal otomatis (scraping/bot) yang membebani infrastruktur server.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">4. Hak Kekayaan Intelektual (Proprietary Rights)</h2>
            <p>
              Platform, merek dagang, logo, dan kode sumber adalah hak milik eksklusif KLASSA. Seluruh materi ajar, data asesmen, modul pembelajaran, dan dokumen yang dibuat oleh guru tetap menjadi hak cipta milik guru atau institusi sekolah bersangkutan.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">5. Skema Langganan, Harga, &amp; Pembayaran (Fees)</h2>
            <p>
              Paket langganan tersedia dalam pilihan durasi (Bulanan, Semester, atau Tahunan) sesuai nominal yang tertera pada halaman penawaran resmi. Seluruh pembayaran diproses melalui payment gateway berizin resmi di Indonesia menggunakan Virtual Account, QRIS, E-Wallet, atau Kartu Pembayaran. Akses dan kuota token AI langsung aktif setelah konfirmasi pembayaran berhasil.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">6. Batasan Tanggung Jawab &amp; Penafian AI (AI Disclaimer)</h2>
            <p>
              Modul asisten AI pada platform dirancang sebagai alat bantu pendidik. Hasil luaran kecerdasan buatan (seperti kisi-kisi soal, penilaian otomatis, rancangan pembelajaran) harus ditinjau dan diverifikasi ulang oleh guru sebelum digunakan dalam keputusan akademik siswa. KLASSA tidak bertanggung jawab atas kekeliruan akibat kelalaian verifikasi oleh pengguna.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">7. Kebijakan Privasi &amp; Data Siswa</h2>
            <p>
              Data pengguna dan data akademik dilindungi sesuai ketentuan Undang-Undang Perlindungan Data Pribadi (UU PDP). KLASSA tidak menjual atau menyewakan informasi pribadi Anda kepada pihak ketiga mana pun.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">8. Pengembalian Dana (Refund Policy)</h2>
            <p>
              Sebagai produk lisensi perangkat lunak digital, transaksi yang telah berhasil bersifat final. Pengembalian dana dilayani terbatas apabila terjadi pembayaran ganda (double payment) atau gangguan kegagalan teknis server berkepanjangan sesuai ketentuan garansi 14 hari yang tertera pada kebijakan pengembalian dana kami.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">9. Pengakhiran Akun (Termination)</h2>
            <p>
              KLASSA berhak menangguhkan atau menutup akses akun secara sepihak jika terbukti melakukan pelanggaran berat terhadap ketentuan layanan, membahayakan keamanan sistem pengguna lain, atau melanggar perundang-undangan Republik Indonesia.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">10. Hukum yang Berlaku (Applicable Laws)</h2>
            <p>
              Syarat dan Ketentuan ini tunduk pada hukum Negara Kesatuan Republik Indonesia. Setiap perselisihan diselesaikan secara musyawarah mufakat, atau melalui pengadilan negeri yang berwenang di wilayah hukum Republik Indonesia.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">11. Kontak &amp; Bantuan</h2>
            <p>
              Untuk pertanyaan, konfirmasi transaksi, atau bantuan operasional:
            </p>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1 text-slate-600">
              <p><strong>Alamat Usaha:</strong> Jl. Kalisari III RT 006 / RW 002, Kel. Kalisari, Kec. Pasar Rebo, Jakarta Timur, DKI Jakarta 13790</p>
              <p><strong>WhatsApp Bantuan:</strong> +62 815-8695-1677</p>
              <p><strong>Email Layanan:</strong> admin@klassa-edutech.com / support@klassa-edutech.com</p>
              <p><strong>Website:</strong> https://klassa-edutech.com</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>&copy; 2026 KLASSA Edutech. Seluruh hak cipta dilindungi.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-teal-700 hover:underline font-medium">Kebijakan Privasi</Link>
            <Link href="/login" className="text-slate-600 hover:underline">Halaman Masuk</Link>
          </div>
        </div>

      </div>
    </div>
  );
}
