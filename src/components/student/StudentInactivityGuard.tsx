"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { logoutStudent } from "@/modules/student-auth/student-auth.actions";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 menit idle timeout (Temuan F9)

/**
 * Komponen pelindung lab komputer sekolah:
 * Memutus sesi secara otomatis jika tidak ada interaksi mouse/keyboard/touch selama 15 menit.
 */
export function StudentInactivityGuard() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleInactivity = async () => {
      toast.warning("Sesi berakhir otomatis karena 15 menit tidak ada aktivitas (proteksi komputer bersama).");
      try {
        const res = await logoutStudent();
        router.push(res.redirect || "/portal-siswa");
        router.refresh();
      } catch {
        router.push("/portal-siswa");
      }
    };

    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(handleInactivity, IDLE_TIMEOUT_MS);
    };

    // Pasang listener aktivitas pengguna
    const events = ["mousedown", "mousemove", "keydown", "touchstart", "scroll"];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

    resetTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [router]);

  return null;
}
