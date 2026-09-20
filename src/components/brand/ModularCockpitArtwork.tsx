"use client";

import React, { useState, useCallback } from "react";
import { Sparkles, FileSpreadsheet, LayoutGrid, ShieldCheck } from "lucide-react";

export interface ModularCockpitArtworkProps {
  theme?: "teal" | "emerald";
  portalType?: "teacher" | "parent";
}

export function ModularCockpitArtwork({
  theme = "teal",
  portalType = "teacher",
}: ModularCockpitArtworkProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setMousePos({ x: 0, y: 0 });
  }, []);

  const isParent = portalType === "parent";
  const isEmerald = theme === "emerald" || isParent;

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-full lg:w-1/2 relative flex items-center justify-center p-8 lg:p-12 xl:p-16 overflow-hidden bg-gradient-to-br from-slate-50 to-teal-50/40 select-none min-h-[440px] lg:min-h-screen"
    >
      {/* 1. PURE SVG ORGANIC S-CURVE WAVE BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <svg
          className="w-full h-full preserve-3d"
          viewBox="0 0 500 640"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M 120 0 C 180 180, 20 380, 160 640 L 500 640 L 500 0 Z"
            fill={isEmerald ? "url(#emeraldSecondary)" : "url(#waveSecondary)"}
            opacity="0.25"
          />
          <path
            d="M 160 0 C 220 200, 40 400, 200 640 L 500 640 L 500 0 Z"
            fill={isEmerald ? "url(#emeraldPrimary)" : "url(#wavePrimary)"}
          />
          <defs>
            <linearGradient id="wavePrimary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0F766E" />
              <stop offset="60%" stopColor="#115E59" />
              <stop offset="100%" stopColor="#042F2E" />
            </linearGradient>
            <linearGradient id="waveSecondary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2DD4BF" />
              <stop offset="100%" stopColor="#0F766E" />
            </linearGradient>
            <linearGradient id="emeraldPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="60%" stopColor="#047857" />
              <stop offset="100%" stopColor="#064E3B" />
            </linearGradient>
            <linearGradient id="emeraldSecondary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Ambient Glow Blobs */}
      <div
        className={`absolute top-10 right-10 w-64 h-64 ${
          isEmerald ? "bg-emerald-400/20" : "bg-teal-400/20"
        } rounded-full blur-3xl pointer-events-none`}
      />
      <div className="absolute bottom-10 right-20 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* 2. 3D MODULAR COCKPIT DESK (WITH INTERACTIVE 3D PARALLAX) */}
      <div
        className="relative z-10 w-full max-w-[360px] h-[360px] flex items-center justify-center transition-transform duration-300 ease-out"
        style={{
          transform: `rotateY(${mousePos.x * 18}deg) rotateX(${-mousePos.y * 18}deg) scale(1.03)`,
          perspective: 1200,
          transformStyle: "preserve-3d",
        }}
      >
        <div className="relative w-80 h-80 flex items-center justify-center animate-float-slow" style={{ transformStyle: "preserve-3d" }}>
          
          {/* Isometric Desk Base Platform */}
          <div
            className="absolute w-72 h-48 rounded-3xl bg-gradient-to-br from-white/40 to-teal-900/30 backdrop-blur-md border border-white/40 shadow-2xl p-4"
            style={{
              transform: "rotateX(55deg) rotateZ(-25deg)",
              bottom: "10px",
            }}
          >
            <div className="w-full h-full border border-teal-300/30 rounded-2xl grid grid-cols-3 gap-2 p-2">
              <div className="bg-white/20 rounded-lg"></div>
              <div className="bg-white/20 rounded-lg"></div>
              <div className="bg-white/20 rounded-lg"></div>
            </div>
          </div>

          {/* Main Floating Tablet (Daily Command Center) */}
          <div
            className="absolute w-64 h-40 rounded-2xl bg-slate-900 text-white border-2 border-slate-700 shadow-2xl p-3.5 flex flex-col justify-between"
            style={{
              bottom: "85px",
              left: "15px",
              transform: "rotateX(25deg) rotateY(15deg)",
            }}
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-teal-300">
                {isParent ? "Kehadiran Putra/Putri Anda" : "Jadwal Mengajar Hari Ini"}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
            <div className="space-y-1 text-center py-1">
              <div className="text-xs font-bold text-white">
                {isParent ? "Ahmad Fauzi • XI RPL 1" : "Biologi XI RPL 1"}
              </div>
              <div className="text-[10px] text-slate-400">
                {isParent ? "Tercatat Hadir (07:15 WIB)" : "07:30 - 09:00 WIB • Lab 2"}
              </div>
            </div>
            <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-800 pt-1.5">
              <span>{isParent ? "Status: 100% Hadir" : "Presensi 1-Klik"}</span>
              <span className={isEmerald ? "text-emerald-400 font-bold" : "text-teal-400 font-bold"}>
                {isParent ? "Tepat Waktu" : "Mulai Kelas →"}
              </span>
            </div>
          </div>

          {/* Floating AI Crystal Orb with Glow */}
          <div
            className="absolute w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 via-teal-400 to-white shadow-2xl flex items-center justify-center animate-pulse-soft"
            style={{
              bottom: "135px",
              right: "20px",
              filter: "drop-shadow(0 0 20px rgba(99, 102, 241, 0.6))",
            }}
          >
            <Sparkles className="w-8 h-8 text-white" />
          </div>

          {/* Floating Report Sheet Badge */}
          <div
            className="absolute w-44 rounded-xl bg-white/95 backdrop-blur-md border border-white shadow-xl p-2.5 text-slate-800"
            style={{
              bottom: "25px",
              right: "5px",
            }}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isParent ? "Ringkasan Nilai .PDF" : "Rekap Nilai .XLSX"}</span>
            </div>
            <div className="text-[9px] text-slate-500 mt-0.5">
              {isParent ? "Capaian Belajar Transparan" : "Format Kurikulum Merdeka"}
            </div>
          </div>

        </div>

        {/* Floating Caption at bottom-right */}
        <div
          className={`absolute -bottom-2 right-2 z-20 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-white text-[11px] font-bold ${
            isEmerald ? "text-emerald-800" : "text-[#0F766E]"
          } shadow-lg flex items-center gap-1.5`}
        >
          {isParent ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Portal Keluarga Modern</span>
            </>
          ) : (
            <>
              <LayoutGrid className="w-3.5 h-3.5 text-teal-600" />
              <span>Modular Cockpit Desk</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
