"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  BookOpen, 
  Award, 
  Users, 
  FileText,
  Calendar,
  CheckSquare,
  FileSpreadsheet,
  Settings2,
  GraduationCap,
  UploadCloud,
  LayoutDashboard
} from "lucide-react";

interface WorkspaceConfig {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultHref: string;
  matches: string[];
  subPills: {
    name: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
    exact?: boolean;
  }[];
}

export default function KelasTabs({ teachingContextId }: { teachingContextId: string }) {
  const pathname = usePathname();
  const baseUrl = `/kelas/${teachingContextId}`;

  const workspaces: WorkspaceConfig[] = [
    {
      id: "mengajar",
      name: "Ruang Mengajar",
      icon: BookOpen,
      defaultHref: baseUrl,
      matches: [
        baseUrl,
        `${baseUrl}/pertemuan`,
        `${baseUrl}/absensi`,
        `${baseUrl}/jurnal`
      ],
      subPills: [
        { name: "Ringkasan", href: baseUrl, icon: LayoutDashboard, exact: true },
        { name: "Pertemuan & Sesi", href: `${baseUrl}/pertemuan`, icon: Calendar },
        { name: "Rekap Absensi", href: `${baseUrl}/absensi`, icon: CheckSquare },
        { name: "Jurnal Mengajar", href: `${baseUrl}/jurnal`, icon: FileText },
      ]
    },
    {
      id: "penilaian",
      name: "Nilai & Evaluasi",
      icon: Award,
      defaultHref: `${baseUrl}/penilaian`,
      matches: [
        `${baseUrl}/penilaian`,
        `${baseUrl}/tugas`,
        `${baseUrl}/pengaturan-nilai`
      ],
      subPills: [
        { name: "Buku Nilai", href: `${baseUrl}/penilaian`, icon: Award },
        { name: "Tugas Siswa", href: `${baseUrl}/tugas`, icon: CheckSquare },
        { name: "Pengaturan Bobot", href: `${baseUrl}/pengaturan-nilai`, icon: Settings2 },
      ]
    },
    {
      id: "siswa",
      name: "Siswa & Ortu",
      icon: Users,
      defaultHref: `${baseUrl}/monitoring`,
      matches: [
        `${baseUrl}/monitoring`,
        `${baseUrl}#roster`
      ],
      subPills: [
        { name: "Monitoring Siswa", href: `${baseUrl}/monitoring`, icon: Users },
        { name: "Daftar Siswa (Roster)", href: `${baseUrl}#roster`, icon: GraduationCap },
      ]
    },
    {
      id: "administrasi",
      name: "Administrasi & Rapor",
      icon: FileText,
      defaultHref: `${baseUrl}/laporan`,
      matches: [
        `${baseUrl}/laporan`,
        `${baseUrl}/akademik`,
        `${baseUrl}/import`
      ],
      subPills: [
        { name: "Rekap Rapor", href: `${baseUrl}/laporan`, icon: FileSpreadsheet },
        { name: "Capaian CP/TP", href: `${baseUrl}/akademik`, icon: GraduationCap },
        { name: "Impor Data Excel", href: `${baseUrl}/import`, icon: UploadCloud },
      ]
    }
  ];

  // Determine active workspace
  const isLiveSession = pathname.includes("/pertemuan/") && pathname.split("/pertemuan/")[1]?.length > 0;
  if (isLiveSession) {
    return null;
  }

  let activeWorkspace = workspaces.find((w) => {
    // Check if current pathname starts with any of its matches (excluding exact baseUrl which is checked specifically)
    return w.matches.some((match) => {
      if (match === baseUrl) {
        return pathname === baseUrl;
      }
      return pathname.startsWith(match);
    });
  });

  // Fallback to first workspace if not matched
  if (!activeWorkspace) {
    activeWorkspace = workspaces[0];
  }

  return (
    <div className="space-y-3">
      {/* 1. LEVEL 1: 4 RUANG KERJA TERPADU */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 bg-teal-50/70 rounded-2xl border border-teal-100/90 shadow-2xs">
        {workspaces.map((workspace) => {
          const Icon = workspace.icon;
          const isSelected = activeWorkspace?.id === workspace.id;

          return (
            <Link
              key={workspace.id}
              href={workspace.defaultHref}
              className={cn(
                "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all select-none text-center",
                isSelected
                  ? "bg-white text-teal-950 shadow-2xs border border-teal-200/80 font-bold"
                  : "text-teal-900/70 hover:text-teal-950 hover:bg-white/60"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-teal-700" : "text-teal-700/60")} />
              <span className="truncate">{workspace.name}</span>
            </Link>
          );
        })}
      </div>

      {/* 2. LEVEL 2: CONTEXTUAL SUB-NAV PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
        {activeWorkspace.subPills.map((subPill) => {
          const SubIcon = subPill.icon;
          const isPillActive = subPill.exact 
            ? pathname === subPill.href
            : pathname.startsWith(subPill.href);

          return (
            <Link
              key={subPill.name}
              href={subPill.href}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                isPillActive
                  ? "bg-teal-700 text-white font-bold shadow-xs"
                  : "bg-teal-50/80 text-teal-900 hover:bg-teal-100 hover:text-teal-950 border border-teal-100/80"
              )}
            >
              {SubIcon && <SubIcon className="h-3.5 w-3.5" />}
              <span>{subPill.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
