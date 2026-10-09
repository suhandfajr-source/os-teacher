import React, { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * AgentMark — Ikon Klassa Agent: BUBBLE CHAT berisi monogram K brand LENGKAP
 * (K + sparkle AI menyatu, path asli public/brand/klassa-mark.svg) yang
 * bernapas, dikelilingi SATU TITIK ORBIT HIJAU bercahaya (sinyal "online").
 *
 * Hierarki warna:
 * - Ungu (sparkle) DI DALAM  = identitas kecerdasan AI (menyatu dengan K)
 * - Hijau (titik orbit) LUAR = sinyal agent hidup/online
 *
 * State:
 * - default  : titik hijau mengorbit pelan (6s/putaran) + K bernapas (2.8s)
 *              + sparkle twinkle (2.4s) — tiga irama hidup berbeda
 * - streaming: orbit ngebut (1.2s) + K berdenyut cepat + sparkle berputar
 * - orbit=false: tanpa titik orbit (avatar chat kecil, agar tenang)
 *
 * Teknik orbit: wrapper berputar dengan titik di tepi atas — radius mengikuti
 * ukuran container otomatis. Titik dirender SETELAH bubble + z-20 (belajar
 * dari bug: jangan sampai tertutup badan bubble). Bubble 84% agar lintasan
 * titik benar-benar di luar badan bubble.
 * Gradient ID di-namespace per-instance (useId) — aman dipakai berkali-kali.
 */
export interface AgentMarkProps {
  /** Ukuran sisi ikon (px). Default 40. */
  size?: number;
  /** Mode agent sedang bekerja/men-stream. */
  streaming?: boolean;
  /** Tampilkan titik orbit hijau. Default true. */
  orbit?: boolean;
  className?: string;
  title?: string;
}

export function AgentMark({
  size = 40,
  streaming = false,
  orbit = true,
  className,
  title,
}: AgentMarkProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gSparkle = `am-spk-${rawId}`;
  const gPillar = `am-plr-${rawId}`;
  const gCheck = `am-chk-${rawId}`;
  const gRibbon = `am-rbn-${rawId}`;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
      title={title}
    >
      {/* ── Bubble chat (squircle + ekor) berisi mark brand K+sparkle ──
          84% dari container: memberi ruang lintasan titik orbit DI LUAR bubble */}
      <span
        className={cn(
          "agent-mark relative flex h-[84%] w-[84%] items-center justify-center",
          streaming && "agent-mark--streaming"
        )}
      >
        <svg
          viewBox="0 0 100 100"
          className="agent-bubble-shell h-full w-full"
          role="img"
          aria-label={title || "Klassa Agent"}
        >
          <defs>
            {/* Sparkle AI — indigo/violet */}
            <linearGradient
              id={gSparkle}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
              gradientUnits="userSpaceOnUse"
              gradientTransform="matrix(216.740404,70.849589,-70.849589,216.740404,2405.947843,880.077367)"
            >
              <stop offset="0" stopColor="#9787FB" />
              <stop offset="1" stopColor="#5146E3" />
            </linearGradient>
            {/* Tiang vertikal K — teal gelap */}
            <linearGradient
              id={gPillar}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
              gradientUnits="userSpaceOnUse"
              gradientTransform="matrix(14.192756,1163.797168,-1163.797168,14.192756,1496.150318,1336.998916)"
            >
              <stop offset="0" stopColor="#019896" />
              <stop offset="1" stopColor="#014E53" />
            </linearGradient>
            {/* Sayap bawah (centang) — emerald */}
            <linearGradient
              id={gCheck}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
              gradientUnits="userSpaceOnUse"
              gradientTransform="matrix(603.222271,440.787666,-440.787666,603.222271,2195.75164,2122.402009)"
            >
              <stop offset="0" stopColor="#0A9C87" />
              <stop offset="1" stopColor="#9FF7E8" />
            </linearGradient>
            {/* Sayap atas (ribbon) — teal muda */}
            <linearGradient
              id={gRibbon}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
              gradientUnits="userSpaceOnUse"
              gradientTransform="matrix(697.142792,-617.663794,617.663794,697.142792,1894.87956,1960.201868)"
            >
              <stop offset="0" stopColor="#34C8B0" />
              <stop offset="1" stopColor="#A5F8E7" />
            </linearGradient>
          </defs>

          {/* Badan bubble: lebih BULAT & simetris agar titik orbit bisa nempel
              menyinggung garis luar secara merata di semua sisi */}
          <path
            d="M38 8 H62 C77.9 8 91 19.1 91 35 V57 C91 72.9 77.9 84 62 84 H48 C44.5 84 43 85 40 87 L26.5 95.2 C23.3 97.2 19.6 94.3 20.7 91 L23.5 85 C15.2 81.6 9 74 9 63 V35 C9 19.1 22.1 8 38 8 Z"
            fill="#FFFFFF"
            stroke="#99D5CE"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Mark brand utuh — K + sparkle MENYATU (seperti logo asli).
              Animasi bernapas di <g> (fill-box dijamin center di semua browser).
              Posisi dipusatkan pada badan bubble baru (pusat y=46). */}
          <svg x="29.4" y="19" width="41" height="54" viewBox="1180 650 1600 2100">
            <g className="agent-k">
              <path
                d="M1759.347,2700.828C1759.347,2700.828 1783.865,1241.469 1756.779,1129.792C1729.693,1018.114 1625.246,966.429 1546.07,962.243C1466.894,958.056 1341.712,1023.835 1282.468,1103.928C1245.906,1153.358 1219.473,1215.086 1202.879,1290.764C1186.284,1366.441 1202.976,2360.747 1202.976,2360.747C1224.855,2529.927 1308.682,2632.322 1419.266,2683.229C1515.133,2726.414 1678.15,2715.896 1734.83,2718.829C1744.955,2719.353 1758.874,2712.021 1759.347,2700.828Z"
                fill={`url(#${gPillar})`}
              />
              <path
                d="M1923.794,2204.726L2309.09,2609.107C2392.221,2682.103 2486.859,2726.335 2599.755,2724.919L2914.469,2718.735C3001.538,2710.964 3023.858,2599.609 2989.105,2548.205C2905.618,2424.719 2542.213,2085.954 2413.548,1977.818C2359.575,1932.457 2263.025,1890.129 2217.115,1899.392C2064.647,1995.097 1993.905,2113.865 1923.794,2204.726Z"
                fill={`url(#${gCheck})`}
              />
              <g transform="matrix(1,0,0,1,0,10)">
                <path
                  d="M1926.874,2199.442C1926.874,2199.442 2891.925,1300.512 2907.562,1285.871C2919.73,1274.478 2906.186,1261.579 2897.28,1261.179C2810.447,1257.272 2510.14,1242.542 2386.569,1262.431C2301.274,1276.159 2217.357,1326.657 2155.853,1380.514C2094.349,1434.37 2011.474,1528.148 1921.504,1616.679C1821.23,1715.349 1807.44,1790.231 1807.781,1887.361C1808.131,1986.838 1850.146,2111.096 1926.874,2199.442Z"
                  fill={`url(#${gRibbon})`}
                />
              </g>
              {/* Sparkle AI — anak dari grup bernapas: ikut membesar-mengecil
                  bersama K, PLUS punya twinkle sendiri (irama kedua).
                  Zoom 1.25× di <g> statis agar tidak ditimpa CSS transform animasi. */}
              <g transform="translate(2459.4 811.9) scale(1.25) translate(-2459.4 -811.9)">
                <path
                  className="agent-sparkle"
                  d="M2195.849,956.752C2320.702,975.859 2409.749,1044.208 2457.128,1201.751C2463.167,1221.828 2478.812,1221.54 2484.577,1201.988C2523.956,1068.416 2604.896,983.331 2735.711,956.434C2759.882,951.464 2758.753,930.403 2736.277,926.261C2594.717,900.169 2523.748,803.897 2484.291,680.935C2478.109,661.669 2465.419,662.824 2459.94,681.289C2418.566,820.731 2328.367,898.982 2198.097,926.67C2167.269,933.222 2184.476,955.012 2195.849,956.752Z"
                  fill={`url(#${gSparkle})`}
                />
              </g>
            </g>
          </svg>
        </svg>
      </span>

      {/* ── Titik orbit hijau bercahaya — MENEMPEL menyinggung garis luar bubble:
              radius orbit ≈ setengah-lebar bubble + radius titik (38% container),
              plus offset pusat +3% (ekor bubble menarik bentuk ke bawah).
              Dirender setelah bubble + z-20 agar selalu di depan. ── */}
      {orbit && (
        <span
          aria-hidden
          className={cn(
            "agent-dot-orbit pointer-events-none absolute inset-0 z-20",
            streaming && "agent-dot-orbit--fast"
          )}
        >
          <span className="agent-dot absolute left-1/2 top-[12%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
        </span>
      )}
    </span>
  );
}
