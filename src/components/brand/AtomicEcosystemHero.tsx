"use client";

import React from "react";
import Image from "next/image";
import "./atomic-ecosystem.css";
import {
  Sparkles,
  BarChart2,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  FileText,
  ChevronRight,
} from "lucide-react";

export function AtomicEcosystemHero({ className = "" }: { className?: string }) {
  return (
    <div
      className={`hero-ecosystem-col w-full lg:w-1/2 relative flex items-center justify-center p-4 lg:p-6 select-none overflow-hidden h-full ${className}`}
      id="hero-ecosystem-col"
    >
      <div
        className="atomic-ecosystem-stage"
        id="atomic-ecosystem-stage"
        aria-label="Visualisasi Ekosistem Cerdas KLASSA"
        role="region"
      >
        {/* Ambient Radial Glow */}
        <div className="atomic-ambient-glow" aria-hidden="true" />

        {/* Main Atom Stage */}
        <div className="klassa-atom-container">

          {/* 1. Center Nucleus: KLASSA K Logo */}
          <div className="atom-nucleus" id="atom-nucleus">
            <div className="nucleus-radial-aura" />
            <div className="nucleus-inner-glow" />
            <div className="nucleus-k-box">
              <Image
                src="/brand/klassa-mark.svg"
                alt="KLASSA K Logo"
                width={54}
                height={54}
                priority
                className="nucleus-k-img"
              />
            </div>
          </div>

          {/* 2. Three Elegant Orbit Rings with Traveling Electrons */}
          <div className="atom-orbits-system" aria-hidden="true">
            {/* Orbit 1: Horizontal Ellipse */}
            <div className="atom-orbit-ring orbit-ring-horizontal">
              <div className="orbit-glow-track" />
              <span className="electron-glider glider-h1" />
              <span className="electron-glider glider-h2" />
            </div>

            {/* Orbit 2: Diagonal Tilted Ellipse 1 */}
            <div className="atom-orbit-ring orbit-ring-diag-1">
              <div className="orbit-glow-track" />
              <span className="electron-glider glider-d1-a" />
              <span className="electron-glider glider-d1-b" />
            </div>

            {/* Orbit 3: Diagonal Tilted Ellipse 2 */}
            <div className="atom-orbit-ring orbit-ring-diag-2">
              <div className="orbit-glow-track" />
              <span className="electron-glider glider-d2-a" />
              <span className="electron-glider glider-d2-b" />
            </div>
          </div>

          {/* 3. Six Feature Cards Surrounding the K Nucleus */}

          {/* Card 1: TOP CENTER - AI Modul Ajar */}
          <div className="atomic-card card-pos-top card-modul-ajar" id="node-modul">
            <div className="card-face-front">
              <span className="card-orbit-node-dot dot-bottom" />
              <div className="card-head-row">
                <div className="card-icon-box icon-purple">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="card-meta">
                  <span className="card-title">AI Modul Ajar</span>
                  <span className="card-status-sub">Sedang membuat modul...</span>
                </div>
              </div>
              <div className="card-progress-bar-wrap">
                <div className="card-progress-fill" style={{ width: "82%" }} />
                <span className="progress-pct">82%</span>
              </div>
            </div>
          </div>

          {/* Card 2: UPPER LEFT - Nilai */}
          <div className="atomic-card card-pos-upper-left card-nilai-stats" id="node-nilai">
            <div className="card-face-front">
              <span className="card-orbit-node-dot dot-right" />
              <div className="card-head-row">
                <div className="card-icon-box icon-teal-green">
                  <BarChart2 className="w-3.5 h-3.5" />
                </div>
                <span className="card-title">Nilai</span>
              </div>
              <div className="card-metric-row">
                <div className="metric-left">
                  <span className="big-score">88</span>
                  <span className="score-trend">↑ 12%</span>
                </div>
                <div className="mini-bar-bars">
                  <span style={{ height: "10px" }} />
                  <span style={{ height: "16px" }} />
                  <span style={{ height: "14px" }} />
                  <span style={{ height: "20px" }} />
                  <span style={{ height: "24px" }} className="bar-active" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: UPPER RIGHT - Presensi */}
          <div className="atomic-card card-pos-upper-right card-presensi-live" id="node-presensi">
            <div className="card-face-front">
              <span className="card-orbit-node-dot dot-left" />
              <div className="card-head-row">
                <div className="card-icon-box icon-mint">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="card-meta">
                  <span className="card-title">Presensi</span>
                  <span className="card-status-sub highlight-teal">34 / 36 hadir</span>
                </div>
              </div>
              <div className="mini-avatar-cluster">
                <span className="av-circle av-1">👨‍🎓</span>
                <span className="av-circle av-2">👩‍🎓</span>
                <span className="av-circle av-3">👧</span>
                <span className="av-more">+32</span>
              </div>
            </div>
          </div>

          {/* Card 4: LOWER LEFT - Analisis Siswa */}
          <div className="atomic-card card-pos-lower-left card-analisis-radar" id="node-analisis">
            <div className="card-face-front">
              <span className="card-orbit-node-dot dot-right" />
              <div className="card-head-row">
                <div className="card-icon-box icon-indigo">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
                <div className="card-meta">
                  <span className="card-title">Analisis Siswa</span>
                  <span className="card-status-sub alert-sub">4 siswa perlu perhatian</span>
                </div>
              </div>
              <div className="analisis-avatars-row">
                <div className="av-warning-group">
                  <span className="av-circle av-warn-1">👦</span>
                  <span className="av-circle av-warn-2">👧</span>
                  <span className="av-circle av-warn-3">🧑</span>
                </div>
                <span className="btn-mini-arrow">
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>

          {/* Card 5: LOWER RIGHT - Ujian Anti-Contek */}
          <div className="atomic-card card-pos-lower-right card-ujian-guard" id="node-ujian">
            <div className="card-face-front">
              <span className="card-orbit-node-dot dot-left" />
              <div className="card-head-row">
                <div className="card-icon-box icon-blue">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="card-meta">
                  <span className="card-title">Ujian Anti-Contek</span>
                  <span className="card-status-sub">Sedang aktif</span>
                </div>
              </div>
              <div className="ujian-live-status">
                <svg className="mini-wave-svg" viewBox="0 0 70 18" fill="none">
                  <path d="M0 10 Q 15 2, 30 11 T 55 7 T 70 10" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="badge-aman-dot">
                  <span className="dot-green" /> Aman
                </span>
              </div>
            </div>
          </div>

          {/* Card 6: BOTTOM CENTER - Rapor */}
          <div className="atomic-card card-pos-bottom card-rapor-doc" id="node-rapor">
            <div className="card-face-front">
              <span className="card-orbit-node-dot dot-top" />
              <div className="card-head-row">
                <div className="card-icon-box icon-amber">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="card-meta">
                  <span className="card-title">Rapor</span>
                  <span className="card-status-sub">Siap diproses</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
