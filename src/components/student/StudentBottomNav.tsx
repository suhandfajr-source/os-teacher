"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  CalendarDays, 
  CheckSquare, 
  ClipboardList, 
  UserCircle 
} from "lucide-react";

export function StudentBottomNav() {
  const pathname = usePathname();

  // Sembunyikan Bottom Nav saat siswa sedang berada di dalam ruang pengerjaan kuis aktif
  // Contoh rute kuis aktif: /siswa/portal/quiz/[shareToken] (bukan list dan bukan review)
  const isTakingQuiz = 
    pathname.startsWith("/siswa/portal/quiz/") && 
    !pathname.endsWith("/review");

  if (isTakingQuiz) {
    return null;
  }

  const navItems = [
    {
      href: "/siswa/portal",
      label: "Hari Ini",
      icon: Home,
      exact: true,
    },
    {
      href: "/siswa/portal/jadwal",
      label: "Jadwal",
      icon: CalendarDays,
      exact: false,
    },
    {
      href: "/siswa/portal/quiz",
      label: "Kuis",
      icon: CheckSquare,
      exact: false,
    },
    {
      href: "/siswa/portal/tugas",
      label: "Tugas",
      icon: ClipboardList,
      exact: false,
    },
    {
      href: "/siswa/portal/profil",
      label: "Profil",
      icon: UserCircle,
      exact: false,
    },
  ];

  return (
    <nav 
      aria-label="Navigasi Siswa"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[48px] py-1 transition-all ${
                isActive
                  ? "text-[#0F766E] font-extrabold"
                  : "text-slate-400 hover:text-slate-600 font-medium"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0F766E]"></span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
