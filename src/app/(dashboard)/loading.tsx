import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[55vh] w-full flex-col items-center justify-center gap-3 text-muted-foreground animate-in fade-in duration-150">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
      <div className="text-center space-y-0.5">
        <p className="text-xs font-semibold text-foreground">Memuat Halaman...</p>
        <p className="text-[11px] text-muted-foreground">Menyiapkan data ruang kerja Anda</p>
      </div>
    </div>
  );
}
