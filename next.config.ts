import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", ".prisma/client", "pg"],
  webpack: (config, { isServer }) => {
    // pptxgenjs (export PPT client-side) membawa optional import node:fs/node:https
    // yang tidak tersedia di browser bundle — beri fallback kosong agar build webpack lolos.
    // Jalur Node-nya ter-guard runtime oleh pptxgenjs, jadi aman.
    if (!isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          fs: false,
          https: false,
        },
        alias: {
          ...config.resolve?.alias,
          "node:fs": false,
          "node:https": false,
        },
      };
    }
    return config;
  },
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

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
