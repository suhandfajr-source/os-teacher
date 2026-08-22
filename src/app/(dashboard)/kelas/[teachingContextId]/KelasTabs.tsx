"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function KelasTabs({ teachingContextId }: { teachingContextId: string }) {
  const pathname = usePathname();
  const baseUrl = `/kelas/${teachingContextId}`;

  const tabs = [
    { name: "Overview", href: baseUrl },
    { name: "Siswa", href: `${baseUrl}#roster` },
    { name: "Pertemuan", href: `${baseUrl}/pertemuan` },
    { name: "Absensi", href: `${baseUrl}/absensi` },
    { name: "Jurnal Mengajar", href: `${baseUrl}/jurnal` },
    { name: "Tugas", href: `${baseUrl}/tugas` },
    { name: "Penilaian", href: `${baseUrl}/penilaian` },
    { name: "Pengaturan Nilai", href: `${baseUrl}/pengaturan-nilai` },
    { name: "Monitoring", href: `${baseUrl}/monitoring` },
  ];

  return (
    <div className="border-b">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.name !== "Overview" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-gray-300 hover:text-gray-700",
                "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium"
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
