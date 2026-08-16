import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex h-[80vh] flex-col items-center justify-center text-center gap-4">
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        <FileQuestion className="h-10 w-10" />
      </div>
      <h2 className="text-2xl font-bold">Halaman Tidak Ditemukan</h2>
      <p className="text-muted-foreground max-w-[500px]">
        Maaf, halaman yang Anda cari tidak tersedia atau mungkin masih dalam tahap pengembangan.
      </p>
      <Button className="mt-4">
        <Link href="/">Kembali ke Beranda</Link>
      </Button>
    </div>
  );
}
