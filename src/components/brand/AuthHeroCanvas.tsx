"use client";

import React, { useState, useCallback } from "react";
import { KlassaLogo } from "./KlassaLogo";

export interface AuthHeroCanvasProps {
  categoryKicker?: string;
  headlinePrefix?: string;
  headlineSuffix?: string;
  highlightWord?: string;
  descriptionBold?: string;
  descriptionRest?: string;
  pills?: string[];
  footnote?: string;
  copyrightText?: string;
  badgeLabel?: string;
  theme?: "teal" | "emerald";
}

export function AuthHeroCanvas({
  categoryKicker = "PERSONAL WORKSPACE & AI CO-PILOT GURU",
  headlinePrefix = "Bantu Guru",
  headlineSuffix = "kerja lebih",
  highlightWord = "berkelas.",
  descriptionBold = "Solusi terpadu end-to-end",
  descriptionRest = "untuk mengotomatisasi presensi harian, menyusun draf modul ajar Kurikulum Merdeka dengan AI, hingga rekapitulasi nilai resmi siap cetak.",
  pills = [
    "⚡ Presensi 1-Klik",
    "✨ AI Content Studio",
    "📊 Rekap Nilai .XLSX",
    "📖 Jurnal Pertemuan",
    "🎯 Asesmen & Remedial",
    "📑 Draf Modul Ajar",
    "🇮🇩 Kurikulum Merdeka",
    "🖨️ Raport Siap Cetak",
  ],
  footnote = "Satu sistem untuk seluruh kebutuhan administrasi guru Indonesia",
  copyrightText = `© ${new Date().getFullYear()} KLASSA • Naik Kelas Bersama`,
  badgeLabel,
  theme = "teal",
}: AuthHeroCanvasProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // range -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  }, []);

  const isEmerald = theme === "emerald";
  const primaryStroke = isEmerald ? "#059669" : "#0F766E";
  const accentStroke = isEmerald ? "#10B981" : "#14B8A6";
  const glowColor = isEmerald ? "bg-emerald-300/20" : "bg-teal-300/20";
  const barBg = isEmerald ? "bg-emerald-600" : "bg-[#0F766E]";
  const dotBg = isEmerald ? "bg-emerald-600" : "bg-teal-600";
  const hoverBorder = isEmerald
    ? "hover:border-emerald-400 hover:text-emerald-800"
    : "hover:border-teal-400 hover:text-teal-800";
  const shimmerGradient = isEmerald
    ? "from-emerald-700 via-teal-400 to-emerald-800"
    : "from-[#0F766E] via-[#2DD4BF] to-[#0D635C]";

  return (
    <div
      onMouseMove={handleMouseMove}
      className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-200/60 select-none"
    >
      {/* ─────────────────────────────────────────────────────────────
          1. PARALLAX CONCENTRIC RADAR / ORBIT RINGS
      ───────────────────────────────────────────────────────────── */}
      <div
        className="absolute -top-32 -left-32 w-[680px] h-[680px] pointer-events-none z-0 transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${mousePos.x * 24}px, ${mousePos.y * 24}px, 0)`,
        }}
      >
        {/* Layer 1: Clockwise Slow Spin */}
        <svg
          viewBox="0 0 680 680"
          fill="none"
          className="w-full h-full opacity-60 animate-spin-slow origin-center"
        >
          <circle cx="240" cy="240" r="120" stroke={primaryStroke} strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
          <circle cx="240" cy="240" r="210" stroke={primaryStroke} strokeWidth="1.2" opacity="0.22" />
          <circle cx="240" cy="240" r="300" stroke={accentStroke} strokeWidth="1" strokeDasharray="8 8" opacity="0.18" />
          <circle cx="240" cy="240" r="400" stroke={primaryStroke} strokeWidth="1" opacity="0.12" />
          <circle cx="240" cy="240" r="500" stroke={accentStroke} strokeWidth="1" strokeDasharray="12 12" opacity="0.08" />
        </svg>

        {/* Layer 2: Counter-Clockwise Outer Dash */}
        <svg
          viewBox="0 0 680 680"
          fill="none"
          className="absolute inset-0 w-full h-full opacity-40 animate-spin-slow-reverse origin-center"
        >
          <circle cx="240" cy="240" r="360" stroke={accentStroke} strokeWidth="1.2" strokeDasharray="6 14" opacity="0.2" />
          <circle cx="240" cy="240" r="460" stroke={primaryStroke} strokeWidth="0.8" strokeDasharray="4 8" opacity="0.15" />
        </svg>
      </div>

      {/* Parallax Ambient Glow Droplets */}
      <div
        className={`absolute top-1/4 -left-20 w-80 h-80 ${glowColor} rounded-full blur-3xl pointer-events-none transition-transform duration-700 ease-out`}
        style={{
          transform: `translate3d(${mousePos.x * -35}px, ${mousePos.y * -35}px, 0)`,
        }}
      />
      <div
        className="absolute bottom-10 left-1/3 w-72 h-72 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none transition-transform duration-700 ease-out"
        style={{
          transform: `translate3d(${mousePos.x * -20}px, ${mousePos.y * -20}px, 0)`,
        }}
      />

      {/* ─────────────────────────────────────────────────────────────
          2. TOP LOGO
      ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="inline-flex items-center hover:opacity-90 transition-opacity">
          <KlassaLogo variant="horizontal" size="md" priority />
        </div>
        {badgeLabel && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
            {badgeLabel}
          </span>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. MEGA HEADLINE & PILLS (STAGGERED DELIGHT)
      ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 my-auto py-10 lg:py-0 space-y-6 max-w-xl">
        
        {/* Category Kicker with Left Vertical Bar */}
        <div className="flex items-center gap-2.5">
          <div className={`w-1 h-4 ${barBg} rounded-full`} />
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
            {categoryKicker}
          </span>
        </div>

        {/* Mega Headline with Animated Shimmer Text */}
        <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black text-slate-900 tracking-tight leading-[1.08]">
          {headlinePrefix} <br />
          {headlineSuffix}{" "}
          <span
            className={`bg-gradient-to-r ${shimmerGradient} animate-shimmer-text bg-clip-text text-transparent`}
          >
            {highlightWord}
          </span>
        </h1>

        {/* Description Paragraph */}
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg">
          <strong className="font-bold text-slate-900">{descriptionBold}</strong>{" "}
          {descriptionRest}
        </p>

        {/* Pill Badges Cloud with Staggered Hover Elevation */}
        <div className="flex flex-wrap gap-2 pt-2">
          {pills.map((pill, idx) => (
            <span
              key={pill}
              style={{ animationDelay: `${idx * 120}ms` }}
              className={`px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-xs border border-slate-200/90 text-xs font-semibold text-slate-700 shadow-2xs ${hoverBorder} hover:-translate-y-1 hover:shadow-md hover:scale-105 active:scale-98 transition-all cursor-default select-none`}
            >
              {pill}
            </span>
          ))}
        </div>

        {/* Micro Footnote */}
        <div className="text-xs text-slate-400 flex items-center gap-2 pt-2">
          <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`} />
          <span>{footnote}</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. FOOTER COPYRIGHT
      ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 text-xs text-slate-400 pt-6">
        {copyrightText}
      </div>
    </div>
  );
}
