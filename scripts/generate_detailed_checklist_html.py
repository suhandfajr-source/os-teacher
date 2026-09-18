import base64
import os

def get_b64(path):
    if not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        data = f.read()
    ext = path.split(".")[-1].lower()
    mime = "image/png" if ext == "png" else "image/svg+xml"
    return f"data:{mime};base64,{base64.b64encode(data).decode('utf-8')}"

def main():
    img_horiz = get_b64("public/brand/klassa-logo-horizontal.png")
    img_vert = get_b64("public/brand/klassa-logo-vertical.png")
    img_mark = get_b64("public/brand/klassa-mark.png")
    img_icon_primary = get_b64("public/brand/klassa-app-icon-primary.png")
    img_icon_light = get_b64("public/brand/klassa-app-icon-light-hd.png")
    img_icon_dark = get_b64("public/brand/klassa-app-icon-dark-hd.png")
    img_board = get_b64("public/brand/klassa-brand-board.png")

    html_content = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KLASSA — Panduan & Checklist Penyerahan Aset Brand Vektor (Handoff Guide)</title>
  <!-- Google Fonts: Plus Jakarta Sans & JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {{
      theme: {{
        extend: {{
          fontFamily: {{
            sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          }},
          colors: {{
            brand: {{
              pine: '#0F766E',
              pineDark: '#115E59',
              pineDeep: '#042F2E',
              mint: '#CCFBF1',
              mintLight: '#F0FDFA',
              pearl: '#F6F8F8',
              aiIndigo: '#6366F1',
            }}
          }},
          boxShadow: {{
            'card': '0 4px 20px -2px rgba(15, 118, 110, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
            'squircle': '0 16px 36px -10px rgba(15, 118, 110, 0.35)',
          }}
        }}
      }}
    }}
  </script>
  <style>
    body {{
      background-color: #F6F8F8;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      color: #0F172A;
    }}
    .checkboard {{
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      background-image: 
        linear-gradient(45deg, #f1f5f5 25%, transparent 25%),
        linear-gradient(-45deg, #f1f5f5 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #f1f5f5 75%),
        linear-gradient(-45deg, transparent 75%, #f1f5f5 75%);
    }}
    @media print {{
      body {{
        background-color: #FFFFFF;
        padding: 0;
      }}
      .page-break {{
        page-break-before: always;
      }}
      .no-break {{
        page-break-inside: avoid;
      }}
    }}
  </style>
</head>
<body class="min-h-screen p-4 md:p-8 lg:p-12 antialiased selection:bg-teal-100 selection:text-teal-900">

  <div class="max-w-5xl mx-auto space-y-10 bg-white p-6 md:p-12 rounded-3xl border border-slate-200/80 shadow-xl">

    <!-- ========================================== -->
    <!-- HEADER RESMI DOKUMEN                       -->
    <!-- ========================================== -->
    <header class="border-b-2 border-slate-100 pb-8 space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0F766E] to-[#042F2E] p-2 flex items-center justify-center shadow-md">
            <img src="{img_mark}" alt="KLASSA Mark" class="w-full h-full object-contain">
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight leading-none">KLASSA</h1>
            <p class="text-xs font-extrabold text-teal-700 uppercase tracking-widest mt-1">NAIK KELAS BERSAMA</p>
          </div>
        </div>
        <div class="text-right text-xs">
          <span class="inline-block px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-bold uppercase tracking-wider">
            Dokumen Spesifikasi & Checklist Handoff
          </span>
          <p class="text-slate-400 mt-1 font-mono">Versi 2.0 • Dilengkapi Contoh Visual & Detailing</p>
        </div>
      </div>

      <div class="pt-4">
        <h2 class="text-xl md:text-2xl font-black text-slate-900 leading-snug">
          Panduan & Checklist Lengkap Penyerahan Aset Brand Vektor (Vector Handoff Guide)
        </h2>
        <p class="text-xs md:text-sm text-slate-600 mt-1 leading-relaxed">
          Dokumen ini berisi panduan spesifikasi ukuran, komposisi elemen, kode warna, dan <strong>contoh visual nyata beserta detailing teknis</strong> untuk setiap file yang perlu Anda buat di Figma / Adobe Illustrator.
        </p>
      </div>
    </header>

    <!-- ========================================== -->
    <!-- BAGIAN 1: STRUKTUR FOLDER PENYIMPANAN       -->
    <!-- ========================================== -->
    <section class="space-y-3 no-break">
      <h3 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
        <span class="w-6 h-6 rounded-lg bg-teal-700 text-white text-xs flex items-center justify-center font-bold">1</span>
        Struktur Folder & Lokasi Penempatan File
      </h3>
      <p class="text-xs text-slate-600">
        Simpan semua file SVG dan PNG hasil ekspor ke dalam struktur direktori proyek berikut:
      </p>

      <div class="bg-slate-900 text-teal-200 p-5 rounded-2xl font-mono text-xs leading-relaxed overflow-x-auto shadow-inner">
<span class="text-slate-400">📁 / (Root Project)</span>
└── 📁 <span class="text-white font-bold">public/</span>
    ├── 📁 <span class="text-teal-300 font-bold">brand/</span>
    │   ├── 📄 <span class="text-amber-300 font-bold">klassa-logo-horizontal.svg</span>   <span class="text-slate-400">◄── [UTAMA] Navbar & Header Web</span>
    │   ├── 📄 <span class="text-amber-300 font-bold">klassa-logo-vertical.svg</span>     <span class="text-slate-400">◄── Splash Screen, Login, Cover Modul</span>
    │   ├── 📄 <span class="text-amber-300 font-bold">klassa-mark.svg</span>              <span class="text-slate-400">◄── Simbol K + Bintang AI (Tanpa Teks)</span>
    │   ├── 📄 <span class="text-amber-300 font-bold">klassa-app-icon-primary.svg</span>  <span class="text-slate-400">◄── Squircle Deep Pine Teal (Default)</span>
    │   ├── 📄 <span class="text-amber-300 font-bold">klassa-app-icon-light.svg</span>    <span class="text-slate-400">◄── Squircle Soft Mint</span>
    │   └── 📄 <span class="text-amber-300 font-bold">klassa-app-icon-dark.svg</span>     <span class="text-slate-400">◄── Squircle Dark Slate</span>
    ├── 📄 <span class="text-emerald-300 font-bold">favicon.svg</span>                       <span class="text-slate-400">◄── Ikon Tab Browser Modern</span>
    ├── 📄 <span class="text-emerald-300 font-bold">favicon.ico</span>                       <span class="text-slate-400">◄── Favicon Legacy Multi-size</span>
    ├── 📄 <span class="text-emerald-300 font-bold">apple-touch-icon.png</span>              <span class="text-slate-400">◄── 180×180 px (Squircle Teal)</span>
    ├── 📄 <span class="text-emerald-300 font-bold">icon-192.png</span>                      <span class="text-slate-400">◄── 192×192 px (PWA Mobile)</span>
    └── 📄 <span class="text-emerald-300 font-bold">icon-512.png</span>                      <span class="text-slate-400">◄── 512×512 px (PWA Mobile)</span>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- BAGIAN 2: RINCIAN VISUAL & DETAILING       -->
    <!-- ========================================== -->
    <section class="space-y-8">
      <div class="border-b border-slate-200 pb-3">
        <h3 class="text-base md:text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-teal-700 text-white text-xs flex items-center justify-center font-bold">2</span>
          Contoh Visual & Detailing Teknis Setiap File
        </h3>
        <p class="text-xs text-slate-500 mt-0.5">
          Perhatikan detail proporsi, komposisi, dan aturan ekspor pada setiap aset di bawah ini.
        </p>
      </div>

      <!-- FILE 1: HORIZONTAL LOCKUP -->
      <div class="border border-slate-200 rounded-3xl p-6 bg-slate-50/50 space-y-4 no-break shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span class="text-[10px] font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">File 01 • Utama</span>
            <h4 class="text-base font-black text-slate-900 font-mono mt-1">klassa-logo-horizontal.svg</h4>
          </div>
          <span class="text-xs font-mono text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">Rasio ~4:1 • viewBox="0 0 400 100"</span>
        </div>

        <!-- Visual Example -->
        <div class="p-6 rounded-2xl bg-white border border-slate-200 flex items-center justify-center min-h-[140px] checkboard">
          <img src="{img_horiz}" alt="Contoh Horizontal Logo" class="max-h-24 w-auto object-contain">
        </div>

        <!-- Detailing Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <h5 class="font-bold text-teal-900 flex items-center gap-1.5">
              <span>📐</span> Komposisi & Proporsi Elemen
            </h5>
            <ul class="list-disc list-inside text-slate-600 space-y-1">
              <li><strong>Simbol Mark K:</strong> Terletak di sisi kiri (tinggi memenuhi ~100% tinggi logo).</li>
              <li><strong>Teks "KLASSA":</strong> Huruf kapital bold/black geometris tebal warna Deep Pine Teal (<code class="font-mono text-teal-800">#0F766E</code>).</li>
              <li><strong>Tagline "NAIK KELAS BERSAMA":</strong> Huruf kapital semi-bold dengan letter-spacing lebar (<code class="font-mono">+0.35em</code>), lebarnya sejajar dengan kata KLASSA di atasnya.</li>
            </ul>
          </div>
          <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <h5 class="font-bold text-teal-900 flex items-center gap-1.5">
              <span>🎯</span> Fungsi & Syarat Ekspor
            </h5>
            <ul class="list-disc list-inside text-slate-600 space-y-1">
              <li><strong>Area Penerapan:</strong> Navbar Topbar Web, Header Dashboard, Kop Surat Dokumen Word (ATP) dan Excel (PROSEM).</li>
              <li><strong>Background:</strong> Wajib 100% <strong>Transparan</strong> (tanpa layer kotak putih).</li>
              <li><strong>Text Outlines:</strong> Teks wajib di-<em>convert to outlines / path</em> agar tidak bergeser di browser user.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- FILE 2: VERTICAL LOCKUP -->
      <div class="border border-slate-200 rounded-3xl p-6 bg-slate-50/50 space-y-4 no-break shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span class="text-[10px] font-bold text-slate-700 bg-slate-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">File 02</span>
            <h4 class="text-base font-black text-slate-900 font-mono mt-1">klassa-logo-vertical.svg</h4>
          </div>
          <span class="text-xs font-mono text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">Rasio ~1:1.2 • viewBox="0 0 300 360"</span>
        </div>

        <!-- Visual Example -->
        <div class="p-6 rounded-2xl bg-white border border-slate-200 flex items-center justify-center min-h-[180px] checkboard">
          <img src="{img_vert}" alt="Contoh Vertical Logo" class="max-h-40 w-auto object-contain">
        </div>

        <!-- Detailing Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <h5 class="font-bold text-teal-900 flex items-center gap-1.5">
              <span>📐</span> Komposisi & Proporsi Elemen
            </h5>
            <ul class="list-disc list-inside text-slate-600 space-y-1">
              <li><strong>Simbol Mark K:</strong> Terletak di atas tengah (ukuran dominan).</li>
              <li><strong>Teks "KLASSA":</strong> Berada tepat di bawah Mark, rata tengah (center-aligned).</li>
              <li><strong>Tagline:</strong> Berada di bawah KLASSA dengan tracking lebar, rata tengah simetris.</li>
            </ul>
          </div>
          <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <h5 class="font-bold text-teal-900 flex items-center gap-1.5">
              <span>🎯</span> Fungsi & Syarat Ekspor
            </h5>
            <ul class="list-disc list-inside text-slate-600 space-y-1">
              <li><strong>Area Penerapan:</strong> Halaman Login/Auth, Splash Screen Mobile App, Cover Modul Ajar PDF, Poster.</li>
              <li><strong>Background:</strong> 100% Transparan.</li>
              <li><strong>Simetri:</strong> Sumbu vertikal tengah Mark, Teks KLASSA, dan Tagline harus berada pada garis x yang sama persis.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- FILE 3: MARK ONLY -->
      <div class="border border-slate-200 rounded-3xl p-6 bg-slate-50/50 space-y-4 no-break shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span class="text-[10px] font-bold text-slate-700 bg-slate-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">File 03</span>
            <h4 class="text-base font-black text-slate-900 font-mono mt-1">klassa-mark.svg</h4>
          </div>
          <span class="text-xs font-mono text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">Rasio 1:1 • viewBox="0 0 200 200"</span>
        </div>

        <!-- Visual Example -->
        <div class="p-6 rounded-2xl bg-white border border-slate-200 flex items-center justify-center min-h-[160px] checkboard">
          <img src="{img_mark}" alt="Contoh Mark Only" class="max-h-32 w-auto object-contain">
        </div>

        <!-- Detailing Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <h5 class="font-bold text-teal-900 flex items-center gap-1.5">
              <span>📐</span> Anatomi Bentuk Ikon Monogram K
            </h5>
            <ul class="list-disc list-inside text-slate-600 space-y-1">
              <li><strong>1. Tiang Vertikal:</strong> Batang silinder melengkung, gradasi Deep Pine Teal (<code class="font-mono text-teal-800">#0F766E</code> ke <code class="font-mono text-teal-800">#115E59</code>).</li>
              <li><strong>2. Sayap Atas:</strong> Efek lipatan 3D ribbon lembaran buku terbuka warna Soft Mint cerah (<code class="font-mono text-teal-800">#5EEAD4</code>).</li>
              <li><strong>3. Sayap Bawah:</strong> Gestur centang (✓) beres administrasi (<code class="font-mono text-teal-800">#2DD4BF</code> ke <code class="font-mono text-teal-800">#0F766E</code>).</li>
              <li><strong>4. Bintang AI Sparkle:</strong> Bintang 4-sudut melayang di atas celah tiang, warna Violet Indigo (<code class="font-mono text-indigo-700">#6366F1</code>).</li>
            </ul>
          </div>
          <div class="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
            <h5 class="font-bold text-teal-900 flex items-center gap-1.5">
              <span>🎯</span> Fungsi & Area Penerapan
            </h5>
            <ul class="list-disc list-inside text-slate-600 space-y-1">
              <li><strong>Area Penerapan:</strong> Favicon tab browser (16-64px), Profile Avatar, Watermark, Tombol Mini AI Co-Pilot.</li>
              <li><strong>Tanpa Teks:</strong> Benar-benar hanya simbol K dan bintang di atasnya.</li>
              <li><strong>Background:</strong> 100% Transparan.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- FILE 4, 5, 6: APP ICONS (SQUIRCLES) -->
      <div class="border border-slate-200 rounded-3xl p-6 bg-slate-50/50 space-y-4 no-break shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span class="text-[10px] font-bold text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">File 04, 05, 06 • App Icons</span>
            <h4 class="text-base font-black text-slate-900 font-mono mt-1">3 Varian Ikon Aplikasi (Squircle 512×512)</h4>
          </div>
          <span class="text-xs font-mono text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">Kanvas 512 × 512 px • Radius Squircle ~115px</span>
        </div>

        <!-- Visual Example (3 Icons Grid) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 rounded-2xl bg-white border border-slate-200 text-center">
          
          <!-- Primary -->
          <div class="flex flex-col items-center">
            <img src="{img_icon_primary}" alt="Primary Icon" class="w-24 h-24 rounded-[26px] shadow-squircle object-cover">
            <h5 class="font-bold text-slate-900 mt-3 text-xs">klassa-app-icon-primary.svg</h5>
            <p class="text-[11px] text-slate-500 mt-0.5">Latar Deep Teal (#0F766E) + K Putih-Mint</p>
            <span class="mt-2 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">Default PWA / Android / iOS</span>
          </div>

          <!-- Light -->
          <div class="flex flex-col items-center">
            <img src="{img_icon_light}" alt="Light Icon" class="w-24 h-24 rounded-[26px] shadow-md object-cover">
            <h5 class="font-bold text-slate-900 mt-3 text-xs">klassa-app-icon-light.svg</h5>
            <p class="text-[11px] text-slate-500 mt-0.5">Latar Soft Mint (#CCFBF1) + K Deep Teal</p>
            <span class="mt-2 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Mode Terang / Aksen</span>
          </div>

          <!-- Dark -->
          <div class="flex flex-col items-center">
            <img src="{img_icon_dark}" alt="Dark Icon" class="w-24 h-24 rounded-[26px] shadow-lg object-cover">
            <h5 class="font-bold text-slate-900 mt-3 text-xs">klassa-app-icon-dark.svg</h5>
            <p class="text-[11px] text-slate-500 mt-0.5">Latar Dark Slate (#0F172A) + K Mint</p>
            <span class="mt-2 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">OLED Dark Mode</span>
          </div>

        </div>

        <div class="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
          <p><strong>Detailing Squircle:</strong> Bentuk kotak menggunakan <em>iOS Corner Smoothing (60%)</em> dengan sudut melengkung halus (<code class="font-mono">radius ~115px</code> pada kanvas 512px).</p>
          <p><strong>Aset Turunan Otomatis:</strong> Dari file <em>primary squircle</em> ini, sistem juga akan memotong untuk favicon <code class="font-mono">apple-touch-icon.png</code> (180px), <code class="font-mono">icon-192.png</code> (192px), dan <code class="font-mono">icon-512.png</code> (512px).</p>
        </div>
      </div>

    </section>

    <!-- ========================================== -->
    <!-- BAGIAN 3: TABEL CHECKLIST LENGKAP          -->
    <!-- ========================================== -->
    <section class="space-y-4 no-break">
      <div class="border-b border-slate-200 pb-2">
        <h3 class="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <span class="w-6 h-6 rounded-lg bg-teal-700 text-white text-xs flex items-center justify-center font-bold">3</span>
          Tabel Ringkasan Checklist Handoff
        </h3>
      </div>

      <div class="overflow-x-auto border border-slate-200 rounded-2xl">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
              <th class="p-3 w-8 text-center">Check</th>
              <th class="p-3">Nama File Target</th>
              <th class="p-3">Format</th>
              <th class="p-3">Ukuran / ViewBox</th>
              <th class="p-3">Lokasi Simpan</th>
              <th class="p-3">Prioritas</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 font-mono text-[11px]">
            <tr class="hover:bg-teal-50/40">
              <td class="p-3 text-center"><input type="checkbox" class="w-4 h-4 text-teal-600 rounded"></td>
              <td class="p-3 font-bold text-teal-900">klassa-logo-horizontal.svg</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">SVG</span></td>
              <td class="p-3 text-slate-600">0 0 400 100 (~4:1)</td>
              <td class="p-3 text-slate-600">public/brand/</td>
              <td class="p-3 font-sans font-bold text-red-600">★ Wajib (P0)</td>
            </tr>
            <tr class="hover:bg-teal-50/40">
              <td class="p-3 text-center"><input type="checkbox" class="w-4 h-4 text-teal-600 rounded"></td>
              <td class="p-3 font-bold text-teal-900">klassa-logo-vertical.svg</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">SVG</span></td>
              <td class="p-3 text-slate-600">0 0 300 360 (~1:1.2)</td>
              <td class="p-3 text-slate-600">public/brand/</td>
              <td class="p-3 font-sans font-bold text-red-600">★ Wajib (P0)</td>
            </tr>
            <tr class="hover:bg-teal-50/40">
              <td class="p-3 text-center"><input type="checkbox" class="w-4 h-4 text-teal-600 rounded"></td>
              <td class="p-3 font-bold text-teal-900">klassa-mark.svg</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">SVG</span></td>
              <td class="p-3 text-slate-600">0 0 200 200 (1:1)</td>
              <td class="p-3 text-slate-600">public/brand/</td>
              <td class="p-3 font-sans font-bold text-red-600">★ Wajib (P0)</td>
            </tr>
            <tr class="hover:bg-teal-50/40">
              <td class="p-3 text-center"><input type="checkbox" class="w-4 h-4 text-teal-600 rounded"></td>
              <td class="p-3 font-bold text-teal-900">klassa-app-icon-primary.svg</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">SVG / PNG</span></td>
              <td class="p-3 text-slate-600">512 × 512 px</td>
              <td class="p-3 text-slate-600">public/brand/</td>
              <td class="p-3 font-sans font-bold text-teal-700">Tinggi (P1)</td>
            </tr>
            <tr class="hover:bg-teal-50/40">
              <td class="p-3 text-center"><input type="checkbox" class="w-4 h-4 text-teal-600 rounded"></td>
              <td class="p-3 font-bold text-teal-900">klassa-app-icon-light.svg</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">SVG / PNG</span></td>
              <td class="p-3 text-slate-600">512 × 512 px</td>
              <td class="p-3 text-slate-600">public/brand/</td>
              <td class="p-3 font-sans text-slate-600">Sedang (P2)</td>
            </tr>
            <tr class="hover:bg-teal-50/40">
              <td class="p-3 text-center"><input type="checkbox" class="w-4 h-4 text-teal-600 rounded"></td>
              <td class="p-3 font-bold text-teal-900">klassa-app-icon-dark.svg</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">SVG / PNG</span></td>
              <td class="p-3 text-slate-600">512 × 512 px</td>
              <td class="p-3 text-slate-600">public/brand/</td>
              <td class="p-3 font-sans text-slate-600">Sedang (P2)</td>
            </tr>
            <tr class="hover:bg-teal-50/40">
              <td class="p-3 text-center"><input type="checkbox" class="w-4 h-4 text-teal-600 rounded"></td>
              <td class="p-3 font-bold text-slate-800">favicon.svg / favicon.ico</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">SVG/ICO</span></td>
              <td class="p-3 text-slate-600">Vektor / Multi</td>
              <td class="p-3 text-slate-600">public/</td>
              <td class="p-3 font-sans font-bold text-teal-700">Tinggi (P1)</td>
            </tr>
            <tr class="hover:bg-teal-50/40">
              <td class="p-3 text-center"><input type="checkbox" class="w-4 h-4 text-teal-600 rounded"></td>
              <td class="p-3 font-bold text-slate-800">apple-touch-icon.png</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">PNG</span></td>
              <td class="p-3 text-slate-600">180 × 180 px</td>
              <td class="p-3 text-slate-600">public/</td>
              <td class="p-3 font-sans font-bold text-teal-700">Tinggi (P1)</td>
            </tr>
            <tr class="hover:bg-teal-50/40">
              <td class="p-3 text-center"><input type="checkbox" class="w-4 h-4 text-teal-600 rounded"></td>
              <td class="p-3 font-bold text-slate-800">icon-192.png / icon-512.png</td>
              <td class="p-3"><span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold">PNG</span></td>
              <td class="p-3 text-slate-600">192px / 512px</td>
              <td class="p-3 text-slate-600">public/</td>
              <td class="p-3 font-sans font-bold text-teal-700">Tinggi (P1)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- BAGIAN 4: DESIGN TOKENS & ATURAN EKSPOR    -->
    <!-- ========================================== -->
    <section class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 no-break">
      
      <!-- TOKEN WARNA -->
      <div class="p-5 rounded-2xl bg-teal-50/50 border border-teal-100 space-y-3">
        <h4 class="text-xs font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
          <span>🎨</span> Kode Warna Resmi (Official Hex Tokens)
        </h4>
        <div class="space-y-2 text-xs">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-[#0F766E]"></span> Deep Pine Teal (Brand)</span>
            <code class="font-mono font-bold text-teal-900">#0F766E</code>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-[#CCFBF1] border border-teal-200"></span> Soft Mint (Highlight)</span>
            <code class="font-mono font-bold text-teal-900">#CCFBF1</code>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-[#5EEAD4]"></span> Bright Mint (Sayap Atas)</span>
            <code class="font-mono font-bold text-teal-900">#5EEAD4</code>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-[#6366F1]"></span> Violet Indigo (Bintang AI)</span>
            <code class="font-mono font-bold text-indigo-700">#6366F1</code>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-[#0F172A]"></span> Dark Slate (Mode Gelap)</span>
            <code class="font-mono font-bold text-slate-800">#0F172A</code>
          </div>
        </div>
      </div>

      <!-- TIPS EKSPOR FIGMA -->
      <div class="p-5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3">
        <h4 class="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
          <span>⚡</span> 3 Aturan Wajib Ekspor SVG dari Figma
        </h4>
        <ol class="list-decimal list-inside text-xs text-slate-700 space-y-2">
          <li>
            <strong>Outline Text (Ctrl+Shift+O / Cmd+Shift+O):</strong> Wajib mengubah seluruh teks menjadi kurva vektor path murni agar tidak bergeser font-nya.
          </li>
          <li>
            <strong>Include 'id' Attribute:</strong> Centang opsi <em>Include 'id' attribute</em> di settings ekspor Figma agar gradasi warna unik tetap utuh.
          </li>
          <li>
            <strong>Transparent Background:</strong> Pastikan frame logo tidak memiliki fill warna putih di belakangnya saat diekspor.
          </li>
        </ol>
      </div>

    </section>

    <!-- FOOTER SIGN-OFF -->
    <footer class="pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
      <span>KLASSA Brand Management System • Tim BMAD</span>
      <span>Siap Diterapkan ke Kode Next.js & Tailwind</span>
    </footer>

  </div>

</body>
</html>
"""

    with open("docs/brand/KLASSA_BRAND_ASSET_CHECKLIST.html", "w", encoding="utf-8") as f:
        f.write(html_content)
    with open("public/brand/KLASSA_BRAND_ASSET_CHECKLIST.html", "w", encoding="utf-8") as f:
        f.write(html_content)
    print("HTML with embedded visual examples & detailing generated successfully!")

if __name__ == "__main__":
    main()
