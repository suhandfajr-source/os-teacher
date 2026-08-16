'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[80vh] flex-col items-center justify-center text-center gap-4">
      <div className="rounded-full bg-destructive/10 p-4 text-destructive">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <h2 className="text-2xl font-bold">Terjadi Kesalahan</h2>
      <p className="text-muted-foreground max-w-[500px]">
        Maaf, kami mengalami masalah saat memuat halaman ini. Silakan coba lagi nanti.
      </p>
      <Button onClick={() => reset()} variant="default" className="mt-4">
        Coba Lagi
      </Button>
    </div>
  );
}
