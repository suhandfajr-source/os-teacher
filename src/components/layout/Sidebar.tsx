"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Calendar, 
  Users, 
  Sparkles, 
  BarChart2, 
  FileQuestion,
  Settings,
  BookOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNavItems = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/hari-ini', label: 'Hari Ini', icon: Calendar },
  { href: '/kelas', label: 'Kelas Saya', icon: Users },
  { href: '/ai-studio', label: 'Perangkat Ajar & AI', icon: Sparkles, isAi: true },
  { href: '/quiz', label: 'Kuis & Evaluasi', icon: FileQuestion },
  { href: '/laporan', label: 'Rekap & Nilai', icon: BarChart2 },
];

const secondaryNavItems = [
  { href: '/akademik', label: 'Kurikulum & Periode', icon: BookOpen },
  { href: '/pengaturan/setup', label: 'Pengaturan', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-white h-full shadow-xs">
      <div className="flex h-16 items-center border-b px-6 gap-3">
        <div className="w-8 h-8 rounded-lg bg-navy text-white flex items-center justify-center font-bold shadow-xs">
          <Sparkles className="h-4 w-4 text-purple-300" />
        </div>
        <div className="flex flex-col">
          <span className="font-heading font-extrabold text-navy text-sm tracking-tight">OS Teacher</span>
          <span className="text-[10px] text-slate-500 font-medium">Workspace Guru v2</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-3 text-xs font-semibold gap-1">
          {mainNavItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all",
                  isActive
                    ? "bg-navy text-white font-bold shadow-sm"
                    : "text-slate-600 hover:text-navy hover:bg-slate-100",
                  item.isAi && !isActive && "text-ai hover:text-ai-hover hover:bg-ai-soft/60"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-white" : item.isAi ? "text-ai" : "text-slate-500")} />
                <span className="flex-1">{item.label}</span>
                {item.isAi && (
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                    isActive ? "bg-white/20 text-white" : "bg-ai-soft text-ai border border-ai-border"
                  )}>
                    AI
                  </span>
                )}
              </Link>
            );
          })}
          
          <div className="my-3 border-t border-slate-200/80 mx-2"></div>
          
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Administrasi
          </div>

          {secondaryNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all text-xs",
                  isActive
                    ? "bg-navy text-white font-bold shadow-sm"
                    : "text-slate-600 hover:text-navy hover:bg-slate-100"
                )}
              >
                <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-slate-500")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
