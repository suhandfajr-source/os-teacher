"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Users, UserCircle, FileQuestion, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/", label: "Beranda", icon: Home, exact: true },
  { href: "/hari-ini", label: "Hari Ini", icon: Calendar },
  { href: "/kelas", label: "Kelas", icon: Users },
  { href: "/ai-studio", label: "AI Studio", icon: Sparkles, isAi: true },
  { href: "/pengaturan/setup", label: "Pengaturan", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  const isLinkActive = (href: string, exact?: boolean) => {
    if (exact || href === "/") {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-[#F6F8F8]/95 backdrop-blur-md flex justify-around items-center px-1 pb-safe shadow-lg">
      {mobileNavItems.map((item) => {
        const active = isLinkActive(item.href, item.exact);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-full py-2.5 transition-all relative",
              active
                ? item.isAi
                  ? "text-indigo-600 font-bold"
                  : "text-teal-700 font-bold"
                : item.isAi
                ? "text-indigo-500/80"
                : "text-slate-500 hover:text-teal-700"
            )}
          >
            {active && (
              <div
                className={cn(
                  "absolute top-0 w-8 h-0.5 rounded-full",
                  item.isAi ? "bg-indigo-600" : "bg-teal-700"
                )}
              />
            )}
            <Icon
              className={cn(
                "h-5 w-5 mb-0.5 transition-transform",
                active && "scale-110"
              )}
            />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
