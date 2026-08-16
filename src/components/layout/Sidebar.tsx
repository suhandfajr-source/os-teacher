import React from 'react';
import Link from 'next/link';
import { 
  Home, 
  Calendar, 
  Users, 
  BookOpen, 
  CheckSquare, 
  UserCircle, 
  Sparkles, 
  BarChart, 
  GraduationCap, 
  FileText, 
  Settings 
} from 'lucide-react';

const mainNavItems = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/today', label: 'Hari Ini', icon: Calendar },
  { href: '/classes', label: 'Kelas Saya', icon: Users },
  { href: '/teaching', label: 'Pembelajaran', icon: BookOpen },
  { href: '/assessment', label: 'Assessment', icon: CheckSquare },
  { href: '/students', label: 'Siswa', icon: UserCircle },
  { href: '/ai-studio', label: 'AI Studio', icon: Sparkles },
  { href: '/reports', label: 'Laporan', icon: BarChart },
];

const secondaryNavItems = [
  { href: '/academic', label: 'Akademik', icon: GraduationCap },
  { href: '/documents', label: 'Dokumen Saya', icon: FileText },
  { href: '/settings', label: 'Pengaturan', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-muted/40 h-full">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="">AI Teacher</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-4 text-sm font-medium gap-1">
          {mainNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          
          <div className="my-4 border-t"></div>
          
          {secondaryNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
