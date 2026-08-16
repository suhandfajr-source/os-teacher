import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Beranda</h1>
        <p className="text-muted-foreground mt-2">
          Selamat datang di AI Teacher Assistant. Ini adalah tampilan awal.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jadwal Hari Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2 Kelas</div>
            <p className="text-xs text-muted-foreground">Placeholder data</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Aktivitas Terkini</CardTitle>
            <CardDescription>Belum ada aktivitas yang tercatat hari ini.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">Mulai aktivitas baru</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Buat kelas atau mulai sesi pembelajaran.
            </p>
            <Button>Buat Sesi Baru</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
