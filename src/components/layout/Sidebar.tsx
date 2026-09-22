"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  UserCircle,
  Sparkles,
  BarChart,
  GraduationCap,
  FileQuestion,
  Settings,
  BookOpenCheck,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KlassaLogo } from "@/components/brand";

const mainNavItems = [
  { href: "/", label: "Beranda", icon: Home, exact: true },
  { href: "/hari-ini", label: "Hari Ini", icon: Calendar },
  { href: "/kelas", label: "Kelas Saya", icon: Users },
  { href: "/siswa", label: "Daftar Siswa", icon: UserCircle },
  { href: "/persetujuan", label: "Persetujuan", icon: ClipboardCheck },
  { href: "/ai-studio", label: "AI Studio", icon: Sparkles, isAi: true },
  { href: "/quiz", label: "Quiz & Ujian", icon: FileQuestion },
  { href: "/laporan", label: "Laporan & Nilai", icon: BarChart },
];

const secondaryNavItems = [
  { href: "/akademik", label: "Akademik & Prosem", icon: BookOpenCheck },
  { href: "/pengaturan/setup", label: "Pengaturan", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const isLinkActive = (href: string, exact?: boolean) => {
    if (exact || href === "/") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden md:flex w-64 flex-col bg-white h-full select-none shrink-0 border-r border-slate-200/70">
      {/* ─────────────────────────────────────────────────────────────
          1. SIDEBAR BRAND HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center px-5 border-b border-slate-100">
        <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
          <KlassaLogo variant="horizontal" size="sm" priority />
        </Link>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. NAV ITEMS LIST
      ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {/* Main Section */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Menu Utama
          </div>
          {mainNavItems.map((item) => {
            const active = isLinkActive(item.href, item.exact);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium transition-all",
                  active
                    ? item.isAi
                      ? "bg-indigo-600 text-white font-bold shadow-md rounded-full"
                      : "bg-teal-700 text-white font-bold shadow-pill-glow rounded-full"
                    : item.isAi
                    ? "text-indigo-700 bg-indigo-50/60 border border-indigo-100 hover:bg-indigo-100/70 rounded-2xl"
                    : "text-slate-600 hover:text-teal-900 hover:bg-teal-50/60 rounded-2xl"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                    active
                      ? "text-white"
                      : item.isAi
                      ? "text-indigo-600"
                      : "text-slate-400"
                  )}
                />
                <span className="truncate">{item.label}</span>
                {item.isAi && (
                  <span
                    className={cn(
                      "ml-auto text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-indigo-100 text-indigo-700"
                    )}
                  >
                    PRO
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Academic & Setup Section */}
        <div className="space-y-1 pt-2 border-t border-slate-100">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Perencanaan & Sistem
          </div>
          {secondaryNavItems.map((item) => {
            const active = isLinkActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium transition-all",
                  active
                    ? "bg-teal-700 text-white font-bold shadow-pill-glow rounded-full"
                    : "text-slate-600 hover:text-teal-900 hover:bg-teal-50/60 rounded-2xl"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-white" : "text-slate-400"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. SIDEBAR FOOTER HINT
      ───────────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-100">
        <div className="p-2.5 rounded-2xl bg-teal-50/70 border border-teal-100/80 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-teal-600 animate-pulse shrink-0" />
          <div className="text-[11px] text-teal-900 leading-tight">
            <span className="font-bold">KLASSA Workspace:</span> Kurikulum Merdeka
          </div>
        </div>
      </div>
    </aside>
  );
}
