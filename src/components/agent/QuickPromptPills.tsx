"use client";

import React from "react";
import { Sparkles, Calendar, BookOpen, AlertTriangle } from "lucide-react";

interface QuickPromptPillsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

const QUICK_PROMPTS = [
  {
    icon: Calendar,
    title: "Analisis Presensi",
    prompt: "Tolong periksa rekap presensi kelas saya minggu ini dan berikan catatan penting.",
  },
  {
    icon: AlertTriangle,
    title: "Identifikasi Remedial",
    prompt: "Identifikasi siswa yang nilainya di bawah kriteria ketercapaian (KKM) dan butuh bimbingan.",
  },
  {
    icon: BookOpen,
    title: "Draf Pengumuman",
    prompt: "Buatkan draf pengumuman kelas untuk persiapan asesmen sumatif pekan depan.",
  },
  {
    icon: Sparkles,
    title: "Ide Metode Ajar",
    prompt: "Berikan 3 variasi aktivitas pembelajaran berbasis proyek (PBL) yang interaktif untuk topik ini.",
  },
];

export function QuickPromptPills({
  onSelectPrompt,
  disabled,
}: QuickPromptPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {QUICK_PROMPTS.map((item, idx) => {
        const Icon = item.icon;
        return (
          <button
            key={idx}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(item.prompt)}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50/60 px-3 py-1.5 text-xs font-semibold text-teal-800 transition-all hover:border-teal-200 hover:bg-teal-100/80 active:scale-95 disabled:opacity-50"
          >
            <Icon className="h-3.5 w-3.5 text-teal-600" />
            <span>{item.title}</span>
          </button>
        );
      })}
    </div>
  );
}
