import React from 'react';
import { Search, Bell, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-4">
        <div className="md:hidden font-bold text-lg">AI Teacher</div>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
        <div className="hidden md:flex relative w-full max-w-sm items-center">
          <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-full rounded-lg bg-background pl-8 md:w-[300px] lg:w-[400px]"
          />
        </div>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Search className="h-5 w-5" />
          <span className="sr-only">Search</span>
        </Button>
        <Button variant="ghost" size="icon">
          <Plus className="h-5 w-5" />
          <span className="sr-only">Quick create</span>
        </Button>
        <Button variant="ghost" size="icon">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full">
          <User className="h-5 w-5" />
          <span className="sr-only">Profile</span>
        </Button>
      </div>
    </header>
  );
}
