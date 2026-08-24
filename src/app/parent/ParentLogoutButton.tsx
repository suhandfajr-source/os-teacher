"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

export function ParentLogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      toast.success("Berhasil keluar");
      router.push("/parent/login");
      router.refresh();
    } catch {
      toast.error("Gagal keluar");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      className="text-xs text-slate-600 hover:text-destructive hover:border-destructive flex items-center gap-1.5"
    >
      <LogOut className="h-3.5 w-3.5" />
      Keluar
    </Button>
  );
}
