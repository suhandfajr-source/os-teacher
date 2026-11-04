import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi - KLASSA",
  description: "Kebijakan Privasi data pengguna dan siswa di platform KLASSA Edutech",
};

export default function PrivacyPage() {
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
            <Shield className="w-3.5 h-3.5" />
            <span>Perlindungan Data &amp; Privasi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
            Kebijakan Privasi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Terakhir Diperbarui: 13 Januari 2026 · Standar UU PDP No. 27 Tahun 2022
          </p>
        </div>

        {/* Intro */}
        <div className="bg-slate-50 border-l-4 border-teal-600 p-4 rounded-r-2xl mb-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
          Privasi Anda dan keamanan data akademik di kelas adalah prioritas utama <strong>KLASSA</strong>. Dokumen ini menjelaskan bagaimana kami mengumpulkan, memproses, menyimpan, dan melindungi informasi pribadi Anda.
        </div>

        {/* Sections */}
        <div className="space-y-7 text-xs sm:text-sm leading-relaxed text-slate-700">
          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">1. Data yang Dikumpulkan</h2>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li><strong>Data Akun Pendidik:</strong> Nama lengkap, gelar, alamat email, nomor telepon/WhatsApp, nama sekolah/madrasah.</li>
              <li><strong>Data Transaksi:</strong> ID pesanan, status pembayaran, metode pembayaran (kami tidak menyimpan informasi kartu kredit atau kata sandi perbankan Anda).</li>
              <li><strong>Data Operasional Kelas:</strong> Daftar nama siswa, presensi, capaian nilai asesmen yang dimasukkan oleh guru untuk administrasi rapor dan kelas.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">2. Penggunaan Data</h2>
            <p>Data yang dikumpulkan hanya digunakan untuk keperluan:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600">
              <li>Aktivasi lisensi dan autentikasi akses ke sistem platform KLASSA.</li>
              <li>Pemrosesan pembuatan administrasi ajar, kisi-kisi soal, dan analisis rapor oleh modul AI.</li>
              <li>Pengiriman notifikasi status akun, invoice transaksi, serta update fitur sistem.</li>
              <li>Pencegahan tindakan kecurangan, penipuan, atau penyalahgunaan keamanan server.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">3. Jaminan Tidak Menjual Data</h2>
            <p>
              KLASSA tidak pernah dan tidak akan menjual, menyewakan, atau memperdagangkan data pribadi Anda maupun data siswa Anda kepada pengiklan atau pihak ketiga komersial mana pun.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">4. Keamanan &amp; Enkripsi</h2>
            <p>
              Kami menerapkan standar keamanan industri meliputi enkripsi lalu lintas data (HTTPS/TLS), enkripsi kata sandi menggunakan hashing modern, dan kontrol akses berjenjang untuk memastikan data Anda terlindungi dari kebocoran.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">5. Kontak Bantuan Privasi</h2>
            <p>
              Jika Anda memiliki pertanyaan mengenai tata kelola data pribadi Anda di KLASSA:
            </p>
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1 text-slate-600">
              <p><strong>Email:</strong> privacy@klassa-edutech.com</p>
              <p><strong>WhatsApp:</strong> +62 815-8695-1677</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <span>&copy; 2026 KLASSA Edutech. Seluruh hak cipta dilindungi.</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="text-teal-700 hover:underline font-medium">Syarat &amp; Ketentuan</Link>
            <Link href="/login" className="text-slate-600 hover:underline">Halaman Masuk</Link>
          </div>
        </div>

      </div>
    </div>
  );
}
