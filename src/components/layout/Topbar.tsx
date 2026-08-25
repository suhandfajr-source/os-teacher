import React from 'react';
import Link from 'next/link';
import { Settings, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="md:hidden font-bold text-lg text-primary flex items-center gap-2">
          <span>AI Teacher Assistant</span>
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
        <Link href="/ai-studio">
          <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-purple-700 border-purple-200 bg-purple-50/50 hover:bg-purple-100">
            <Sparkles className="h-3.5 w-3.5 text-purple-600" />
            AI Studio
          </Button>
        </Link>
        <Link href="/pengaturan/setup" aria-label="Pengaturan Akun dan Sekolah">
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Pengaturan Akun dan Sekolah">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span className="sr-only">Pengaturan Akun dan Sekolah</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
