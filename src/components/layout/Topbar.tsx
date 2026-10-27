"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  Sparkles,
  GraduationCap,
  Menu,
  X,
  Home,
  Calendar,
  Users,
  UserCircle,
  FileQuestion,
  BarChart,
  BookOpenCheck,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KlassaLogo } from "@/components/brand";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BugReportWidget } from "@/components/bug-reports/BugReportWidget";

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

export function Topbar() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const pathname = usePathname();

  const isLinkActive = (href: string, exact?: boolean) => {
    if (exact || href === "/") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 md:px-6 transition-colors">
        {/* Mobile Left Menu & Brand Title */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Buka Menu Navigasi"
            className="h-9 w-9 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-teal-50 dark:hover:bg-slate-700 hover:text-teal-800 dark:hover:text-teal-300 shadow-2xs transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <KlassaLogo variant="horizontal" size="xs" priority />
          </Link>
        </div>

        {/* Desktop Search / Quick Context Placeholder */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-teal-300 bg-teal-50/70 dark:bg-teal-950/40 border border-teal-100/80 dark:border-teal-900/50 px-3 py-1.5 rounded-full shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
          <span>Ruang Kerja Guru Indonesia</span>
        </div>

        {/* Right Action Icons */}
        <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
          <Link
            href="/ai-studio"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "hidden sm:flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-teal-50/60 to-indigo-50/80 dark:from-teal-950/30 dark:to-indigo-950/40 hover:from-teal-100/60 hover:to-indigo-100/80 dark:hover:from-teal-900/40 dark:hover:to-indigo-900/50 shadow-2xs rounded-full transition-all"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
            <span>AI Studio</span>
          </Link>
          <NotificationBell />
          <ThemeToggle />
          <BugReportWidget />
          <Link
            href="/pengaturan/setup"
            aria-label="Pengaturan Akun dan Sekolah"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "rounded-full h-9 w-9 text-slate-500 dark:text-slate-400 hover:text-teal-800 dark:hover:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 transition-colors"
            )}
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Pengaturan Akun dan Sekolah</span>
          </Link>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          MOBILE SLIDE-OUT DRAWER (SIDEBAR MOBILE)
      ───────────────────────────────────────────────────────────── */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
          />

          {/* Drawer Panel */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#F6F8F8] dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-250">
            {/* Drawer Header */}
            <div className="flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-5">
              <Link href="/" onClick={() => setMobileDrawerOpen(false)} className="flex items-center">
                <KlassaLogo variant="horizontal" size="sm" priority />
              </Link>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Tutup Menu"
                className="h-8 w-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Nav Items */}
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
              {/* Menu Utama */}
              <div className="space-y-1">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Menu Utama
                </div>
                {mainNavItems.map((item) => {
                  const active = isLinkActive(item.href, item.exact);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium transition-all",
                        active
                          ? item.isAi
                            ? "bg-indigo-600 text-white font-bold shadow-md rounded-full"
                            : "bg-teal-700 text-white font-bold shadow-pill-glow rounded-full"
                          : item.isAi
                          ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-2xl"
                          : "text-slate-600 dark:text-slate-300 hover:text-teal-800 dark:hover:text-teal-200 hover:bg-teal-50/50 dark:hover:bg-slate-800/60 rounded-2xl"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active
                            ? "text-white"
                            : item.isAi
                            ? "text-indigo-500 dark:text-indigo-400"
                            : "text-slate-400 dark:text-slate-500"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.isAi && (
                        <span
                          className={cn(
                            "ml-auto text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full",
                            active
                              ? "bg-white/20 text-white"
                              : "bg-indigo-100 text-indigo-700"
                          )}
                        >
                          AI
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Perencanaan & Sistem */}
              <div className="space-y-1 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Perencanaan & Sistem
                </div>
                {secondaryNavItems.map((item) => {
                  const active = isLinkActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium transition-all",
                        active
                          ? "bg-teal-700 text-white font-bold shadow-pill-glow rounded-full"
                          : "text-slate-600 dark:text-slate-300 hover:text-teal-900 dark:hover:text-teal-200 hover:bg-teal-50/60 dark:hover:bg-slate-800/60 rounded-2xl"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-white" : "text-slate-400 dark:text-slate-500"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
                <BugReportWidget
                  variant="drawer-item"
                  onTriggerClick={() => setMobileDrawerOpen(false)}
                />
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <div className="p-2.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/60 flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-teal-600 animate-pulse shrink-0" />
                <div className="text-[11px] text-teal-900 dark:text-teal-200 leading-tight">
                  <span className="font-bold">Mode Aktif:</span> Kurikulum Merdeka
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
