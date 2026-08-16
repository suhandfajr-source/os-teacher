import React from 'react';
import Link from 'next/link';
import { Home, Calendar, Users, Sparkles, Menu } from 'lucide-react';

const mobileNavItems = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/today', label: 'Hari Ini', icon: Calendar },
  { href: '/classes', label: 'Kelas', icon: Users },
  { href: '/ai-studio', label: 'AI Studio', icon: Sparkles },
  { href: '/more', label: 'Lainnya', icon: Menu },
];

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background flex justify-around pb-safe">
      {mobileNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex flex-col items-center justify-center w-full py-3 text-muted-foreground hover:text-primary transition-colors"
        >
          <item.icon className="h-6 w-6 mb-1" />
          <span className="text-[10px] font-medium">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
