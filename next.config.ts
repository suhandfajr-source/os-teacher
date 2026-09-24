import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pg"],
  async redirects() {
    // Sunset portal ortu (2026-09-24): seluruh /parent/* → portal siswa
    // (Mode Keluarga). Tabel parent dipertahankan — kode dihapus saja.
    return [
      { source: "/parent", destination: "/portal-siswa", permanent: false },
      { source: "/parent/:path*", destination: "/portal-siswa", permanent: false },
    ];
  },
};

export default nextConfig;
