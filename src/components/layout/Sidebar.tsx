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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KlassaLogo } from "@/components/brand";

const mainNavItems = [
  { href: "/", label: "Beranda", icon: Home, exact: true },
  { href: "/hari-ini", label: "Hari Ini", icon: Calendar },
  { href: "/kelas", label: "Kelas Saya", icon: Users },
  { href: "/siswa", label: "Daftar Siswa", icon: UserCircle },
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
    <aside className="hidden md:flex w-64 flex-col border-r border-slate-200/80 bg-[#F6F8F8] h-full select-none shrink-0">
      {/* ─────────────────────────────────────────────────────────────
          1. SIDEBAR BRAND HEADER
      ───────────────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center border-b border-slate-200/80 px-5">
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all",
                  active
                    ? item.isAi
                      ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs"
                      : "bg-teal-50 text-teal-800 font-bold border border-teal-200/80 shadow-2xs"
                    : item.isAi
                    ? "text-indigo-600/90 hover:text-indigo-700 hover:bg-indigo-50/50"
                    : "text-slate-600 hover:text-teal-800 hover:bg-teal-50/50"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform group-hover:scale-105",
                    active
                      ? item.isAi
                        ? "text-indigo-600"
                        : "text-teal-700"
                      : item.isAi
                      ? "text-indigo-500"
                      : "text-slate-400"
                  )}
                />
                <span className="truncate">{item.label}</span>
                {item.isAi && (
                  <span className="ml-auto text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    AI
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Academic & Setup Section */}
        <div className="space-y-1 pt-2 border-t border-slate-200/60">
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all",
                  active
                    ? "bg-teal-50 text-teal-800 font-bold border border-teal-200/80 shadow-2xs"
                    : "text-slate-600 hover:text-teal-800 hover:bg-teal-50/50"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-teal-700" : "text-slate-400"
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
      <div className="p-3 border-t border-slate-200/80">
        <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-100 flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-teal-600 animate-pulse shrink-0" />
          <div className="text-[11px] text-teal-900 leading-tight">
            <span className="font-bold">Mode Aktif:</span> Kurikulum Merdeka
          </div>
        </div>
      </div>
    </aside>
  );
}
