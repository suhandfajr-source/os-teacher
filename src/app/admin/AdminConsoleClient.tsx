"use client";

import React, { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Building2,
  Users,
  GraduationCap,
  School,
  ShieldAlert,
  Search,
  Plus,
  RefreshCw,
  KeyRound,
  Ban,
  CheckCircle2,
  XCircle,
  Trash2,
  ArrowRightLeft,
  Edit3,
  ExternalLink,
  Layers,
  BarChart2,
  AlertTriangle,
  FileText,
  UserCheck,
  Building,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  listSchoolsAdminAction,
  listTeachersAdminAction,
  listStudentsAdminAction,
  listClassesAdminAction,
  deactivateSchoolAction,
  reactivateSchoolAction,
  setSchoolNpsnAction,
  deleteOrArchiveSchoolAction,
  banTeacherAction,
  unbanTeacherAction,
  resetTeacherPasswordAction,
  disassociateTeacherMembershipAction,
  deleteTeacherAccountAction,
  forceApproveStudentAction,
  forceRejectStudentAction,
  forceResetStudentPinAction,
  transferStudentClassAction,
  deleteStudentAdminAction,
  createClassAdminAction,
  updateClassAdminAction,
  deleteClassAdminAction,
} from "@/modules/admin/admin.actions";
import type { SuperadminOverviewStats } from "@/modules/admin/admin-stats.service";

interface SchoolItem {
  id: string;
  name: string;
  npsn: string | null;
  city?: string | null;
  province?: string | null;
  deactivatedAt: string | Date | null;
  createdAt: string | Date;
  _count: { students: number; memberships: number; classes: number };
}

interface TeacherItem {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  role: string;
  banned: boolean;
  banReason: string | null;
  createdAt: string | Date;
  teacherProfile: {
    id: string;
    preferredName?: string | null;
    activeSchoolId?: string | null;
    memberships: Array<{
      id: string;
      status: string;
      workspaceRole: string;
      school: { id: string; name: string; npsn: string | null; deactivatedAt: string | Date | null };
    }>;
  } | null;
}

interface StudentItem {
  id: string;
  fullName: string;
  nis: string | null;
  accountStatus: string;
  status: string;
  failedAttempts: number;
  lockedUntil: string | Date | null;
  lastLoginAt: string | Date | null;
  createdAt: string | Date;
  school: { id: string; name: string };
  classMemberships: Array<{
    id: string;
    class: { id: string; name: string; gradeLevel: string | null };
    academicPeriod: { id: string; year: string; semester: string; status: string };
  }>;
}

interface ClassItem {
  id: string;
  name: string;
  gradeLevel: string | null;
  status: string;
  joinCode: string | null;
  joinCodeLocked: boolean;
  school: { id: string; name: string };
  _count: { classStudents: number; teachingContexts: number };
}

interface AdminConsoleClientProps {
  stats: SuperadminOverviewStats;
  allSchools: Array<{ id: string; name: string; npsn: string | null; deactivatedAt: string | Date | null }>;
  initialSchools: SchoolItem[];
  initialTeachers: TeacherItem[];
  initialStudents: StudentItem[];
  initialClasses: ClassItem[];
}

export function AdminConsoleClient({
  stats,
  allSchools,
  initialSchools,
  initialTeachers,
  initialStudents,
  initialClasses,
}: AdminConsoleClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "schools" | "teachers" | "students" | "classes">("overview");
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  // State List Data
  const [schools, setSchools] = useState<SchoolItem[]>(initialSchools);
  const [teachers, setTeachers] = useState<TeacherItem[]>(initialTeachers);
  const [students, setStudents] = useState<StudentItem[]>(initialStudents);
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);

  // Search & Filter state
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolStatusFilter, setSchoolStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<"ALL" | "ACTIVE" | "BANNED">("ALL");

  const [studentSearch, setStudentSearch] = useState("");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"ALL" | "ACTIVE" | "PENDING" | "REJECTED">("ALL");

  const [classSearch, setClassSearch] = useState("");
  const [classGradeFilter, setClassGradeFilter] = useState<string>("ALL");

  // Dialog State
  const [modalType, setModalType] = useState<
    | null
    | "resetPassword"
    | "resetPin"
    | "transferStudent"
    | "addClass"
    | "editClass"
    | "setNpsn"
  >(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [modalInput, setModalInput] = useState<{ [key: string]: string }>({});

  // Trigger Refetches
  const reloadSchools = () => {
    startTransition(async () => {
      const res = await listSchoolsAdminAction({
        query: schoolSearch,
        statusFilter: schoolStatusFilter,
        page: 1,
        pageSize: 50,
      });
      if (res.success) setSchools(res.data as SchoolItem[]);
    });
  };

  const reloadTeachers = () => {
    startTransition(async () => {
      const res = await listTeachersAdminAction({
        query: teacherSearch,
        schoolId: selectedSchoolFilter,
        statusFilter: teacherStatusFilter,
        page: 1,
        pageSize: 50,
      });
      if (res.success) setTeachers(res.data as TeacherItem[]);
    });
  };

  const reloadStudents = () => {
    startTransition(async () => {
      const res = await listStudentsAdminAction({
        query: studentSearch,
        schoolId: selectedSchoolFilter,
        accountStatus: studentStatusFilter,
        page: 1,
        pageSize: 50,
      });
      if (res.success) setStudents(res.data as StudentItem[]);
    });
  };

  const reloadClasses = () => {
    startTransition(async () => {
      const res = await listClassesAdminAction({
        query: classSearch,
        schoolId: selectedSchoolFilter,
        gradeLevel: classGradeFilter,
        page: 1,
        pageSize: 50,
      });
      if (res.success) setClasses(res.data as ClassItem[]);
    });
  };

  // Nav items definition
  const navTabs = [
    { id: "overview", label: "Ringkasan & Analitik", icon: BarChart2, badge: null },
    { id: "schools", label: "Sekolah", icon: Building2, badge: stats.schools.total },
    { id: "teachers", label: "Guru & Staf", icon: Users, badge: stats.teachers.total },
    { id: "students", label: "Siswa", icon: GraduationCap, badge: stats.students.total },
    { id: "classes", label: "Kelas & Rombel", icon: Layers, badge: stats.classes.total },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Header & Sub-Nav Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Konsol Superadmin
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pusat pemantauan multi-tenant, agregasi tingkat kelas, dan kendali data platform KLASSA.
          </p>
        </div>

        {/* Multi-Tenant School Filter */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl shadow-xs">
          <Building className="h-4 w-4 text-teal-600 dark:text-teal-400 ml-2" />
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Filter Sekolah:</span>
          <select
            value={selectedSchoolFilter}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedSchoolFilter(val);
              setTimeout(() => {
                reloadTeachers();
                reloadStudents();
                reloadClasses();
              }, 50);
            }}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-teal-500 transition-colors max-w-xs"
          >
            <option value="ALL">🌐 Semua Sekolah (Platform Global)</option>
            {allSchools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.deactivatedAt ? "(NONAKTIF)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-500/30 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400 dark:text-slate-500"}`} />
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    isActive
                      ? "bg-teal-200 dark:bg-teal-400/20 text-teal-800 dark:text-teal-300"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & ANALYTICS                                              */}
      {/* ========================================================================= */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Sekolah */}
            <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Sekolah</span>
                  <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.schools.total}</div>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      ● {stats.schools.active} Aktif
                    </span>
                    {stats.schools.inactive > 0 && (
                      <span className="text-red-500 dark:text-red-400 font-medium">
                        ● {stats.schools.inactive} Non-aktif
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Guru */}
            <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Guru & Staf</span>
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.teachers.total}</div>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      ● {stats.teachers.active} Aktif
                    </span>
                    {stats.teachers.banned > 0 && (
                      <span className="text-red-500 dark:text-red-400 font-medium">
                        ● {stats.teachers.banned} Banned
                      </span>
                    )}
                    <span className="text-slate-400 font-normal">
                      ({stats.teachers.superadmins} Superadmin)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Siswa */}
            <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Siswa Terdaftar</span>
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.students.total}</div>
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      ● {stats.students.active} Active
                    </span>
                    {stats.students.pending > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        ● {stats.students.pending} Pending
                      </span>
                    )}
                    {stats.students.rejected > 0 && (
                      <span className="text-slate-400">
                        ● {stats.students.rejected} Rejected
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Kelas */}
            <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Rombongan Belajar</span>
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.classes.total}</div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      Rata-rata{" "}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {stats.classes.total > 0
                          ? Math.round(stats.students.total / stats.classes.total)
                          : 0}{" "}
                        siswa
                      </strong>
                      /kelas
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pemetaan Distribusi Jenjang / Tingkat Kelas (CAP-ADM-03) */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800/80 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    Pemetaan Distribusi Jenjang Kelas (Grade Level Breakdown)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Visualisasi jumlah rombongan belajar dan sebaran siswa berdasarkan jenjang tingkat (7, 8, 9, 10, 11, 12, dst).
                  </CardDescription>
                </div>
                <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                  {stats.gradeDistribution.length} Jenjang Terpetakan
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {stats.gradeDistribution.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Belum ada data kelas atau rombel yang terdaftar di platform.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.gradeDistribution.map((item) => {
                      const maxStudents = Math.max(...stats.gradeDistribution.map((x) => x.studentCount), 1);
                      const percentage = Math.round((item.studentCount / maxStudents) * 100);
                      const avgPerClass = item.classCount > 0 ? Math.round(item.studentCount / item.classCount) : 0;

                      return (
                        <div
                          key={item.gradeKey}
                          className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{item.gradeLabel}</span>
                            <Badge className="bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800/60 text-xs">
                              {item.classCount} Rombel
                            </Badge>
                          </div>

                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400">Total Populasi Siswa:</span>
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{item.studentCount} Siswa</span>
                          </div>

                          {/* Progress bar visual */}
                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(5, percentage)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800/60">
                            <span>Kepadatan Kelas:</span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium">~{avgPerClass} siswa / rombel</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Recent Security Audit Stream */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800/80 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    Aktivitas Keamanan Platform Terkini (AuditLog Feed)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    10 mutasi administratif superadmin dan peristiwa keamanan terakhir.
                  </CardDescription>
                </div>
                <a
                  href="/admin/audit"
                  className="text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 font-medium"
                >
                  Buka AuditLog Lengkap <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {stats.recentAuditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 font-mono text-[11px]">
                        {log.action}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        Target: <strong className="text-slate-900 dark:text-slate-200">{log.targetType}</strong>
                        {log.targetId ? ` (${log.targetId.slice(0, 10)}...)` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-500">
                      <Badge className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 text-[10px]">
                        {log.actorType}
                      </Badge>
                      <span>{new Date(log.createdAt).toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MANAJEMEN SEKOLAH                                                 */}
      {/* ========================================================================= */}
      {activeTab === "schools" && (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800/80 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  Manajemen Sekolah
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Kelola status operasional, verifikasi NPSN, aktivasi, dan pengarsipan aman sekolah.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs gap-1.5"
                  onClick={reloadSchools}
                  disabled={isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari sekolah (nama / NPSN / kota)..."
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && reloadSchools()}
                  className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200"
                />
              </div>
              <select
                value={schoolStatusFilter}
                onChange={(e) => {
                  setSchoolStatusFilter(e.target.value as any);
                  setTimeout(reloadSchools, 50);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-2 outline-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Hanya Aktif</option>
                <option value="INACTIVE">Hanya Nonaktif</option>
              </select>
              <Button size="sm" onClick={reloadSchools} disabled={isPending} className="bg-teal-600 hover:bg-teal-500 text-white text-xs">
                Cari
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Nama Sekolah</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">NPSN</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Statistik</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Status</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs text-right">Aksi Kendali</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-xs">
                        Tidak ada sekolah yang sesuai kriteria pencarian.
                      </TableCell>
                    </TableRow>
                  ) : (
                    schools.map((s) => {
                      const isDeactivated = !!s.deactivatedAt;
                      return (
                        <TableRow key={s.id} className="border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850/50">
                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{s.name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">ID: {s.id}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                              {s.npsn || <span className="text-slate-400 italic">Belum di-set</span>}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-slate-600 dark:text-slate-300">
                              <span>{s._count.students} Siswa</span> · <span>{s._count.memberships} Guru</span> ·{" "}
                              <span>{s._count.classes} Kelas</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isDeactivated ? (
                              <Badge className="bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50 text-[11px]">
                                NONAKTIF
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 text-[11px]">
                                AKTIF
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Set NPSN Modal Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                onClick={() => {
                                  setSelectedItem(s);
                                  setModalInput({ npsn: s.npsn || "" });
                                  setModalType("setNpsn");
                                }}
                              >
                                Set NPSN
                              </Button>

                              {/* Toggle Active / Deactivate */}
                              {!isDeactivated ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  disabled={isPending}
                                  onClick={() => {
                                    if (
                                      !window.confirm(
                                        `Nonaktifkan sekolah "${s.name}"? Semua sesi guru akan di-revoke dan NPSN di-clear.`
                                      )
                                    )
                                      return;
                                    startTransition(async () => {
                                      const res = await deactivateSchoolAction(s.id);
                                      if (res.success) {
                                        toast.success("Sekolah dinonaktifkan.");
                                        reloadSchools();
                                      } else toast.error(res.message || "Gagal.");
                                    });
                                  }}
                                >
                                  Nonaktifkan
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                                  disabled={isPending}
                                  onClick={() => {
                                    startTransition(async () => {
                                      const res = await reactivateSchoolAction(s.id);
                                      if (res.success) {
                                        toast.success("Sekolah direaktivasi.");
                                        reloadSchools();
                                      } else toast.error(res.message || "Gagal.");
                                    });
                                  }}
                                >
                                  Reaktivasi
                                </Button>
                              )}

                              {/* Delete / Archive Button */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
                                disabled={isPending}
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Arsipkan atau hapus sekolah "${s.name}"? Jika memiliki siswa/aktivitas, data akan diarsipkan secara aman.`
                                    )
                                  )
                                    return;
                                  startTransition(async () => {
                                    const res = await deleteOrArchiveSchoolAction(s.id);
                                    if (res.success) {
                                      toast.success(res.message);
                                      reloadSchools();
                                    } else toast.error(res.message || "Gagal.");
                                  });
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MANAJEMEN GURU & USER                                             */}
      {/* ========================================================================= */}
      {activeTab === "teachers" && (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800/80 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Manajemen Guru & Pengguna
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Kontrol akun guru, penangguhan (Ban), reset password instan, dan asosiasi sekolah.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs gap-1.5"
                onClick={reloadTeachers}
                disabled={isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari guru (nama / email)..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && reloadTeachers()}
                  className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200"
                />
              </div>
              <select
                value={teacherStatusFilter}
                onChange={(e) => {
                  setTeacherStatusFilter(e.target.value as any);
                  setTimeout(reloadTeachers, 50);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-2 outline-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Hanya Aktif</option>
                <option value="BANNED">Hanya Banned</option>
              </select>
              <Button size="sm" onClick={reloadTeachers} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                Cari
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Nama Guru & Email</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Sekolah Terhubung</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Role & Akses</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Status</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs text-right">Aksi Kendali</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-xs">
                        Tidak ada data guru yang ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((t) => {
                      const isSuperadmin = t.platformRole === "ADMIN";
                      const memberships = t.teacherProfile?.memberships || [];

                      return (
                        <TableRow key={t.id} className="border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850/50">
                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{t.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{t.email}</div>
                          </TableCell>
                          <TableCell>
                            {memberships.length === 0 ? (
                              <span className="text-slate-400 text-xs italic">Tidak terhubung</span>
                            ) : (
                              <div className="space-y-1">
                                {memberships.map((m) => (
                                  <div key={m.id} className="text-xs flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                    <Building className="h-3 w-3 text-slate-400" />
                                    <span>{m.school.name}</span>
                                    <span className="text-[10px] text-slate-400">({m.workspaceRole})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {isSuperadmin ? (
                              <Badge className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/50 text-[10px]">
                                SUPERADMIN
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]">
                                GURU
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.banned ? (
                              <Badge className="bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50 text-[11px]">
                                BANNED
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 text-[11px]">
                                AKTIF
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {!isSuperadmin ? (
                                <>
                                  {/* Reset Password Button */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                    onClick={() => {
                                      setSelectedItem(t);
                                      setModalInput({ newPassword: "" });
                                      setModalType("resetPassword");
                                    }}
                                  >
                                    <KeyRound className="h-3 w-3 mr-1" />
                                    Reset Pwd
                                  </Button>

                                  {/* Ban / Unban */}
                                  {!t.banned ? (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 text-xs"
                                      disabled={isPending}
                                      onClick={() => {
                                        const reason = window.prompt("Alasan penangguhan (Ban):");
                                        if (reason === null) return;
                                        startTransition(async () => {
                                          const res = await banTeacherAction(t.id, reason);
                                          if (res.success) {
                                            toast.success("Guru di-ban. Sesi di-revoke.");
                                            reloadTeachers();
                                          } else toast.error(res.message || "Gagal.");
                                        });
                                      }}
                                    >
                                      Ban
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                                      disabled={isPending}
                                      onClick={() => {
                                        startTransition(async () => {
                                          const res = await unbanTeacherAction(t.id);
                                          if (res.success) {
                                            toast.success("Guru di-unban.");
                                            reloadTeachers();
                                          } else toast.error(res.message || "Gagal.");
                                        });
                                      }}
                                    >
                                      Unban
                                    </Button>
                                  )}

                                  {/* Hapus Akun Guru */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
                                    disabled={isPending}
                                    onClick={() => {
                                      if (!window.confirm(`Hapus akun guru ${t.email}? Aksi ini permanen.`)) return;
                                      startTransition(async () => {
                                        const res = await deleteTeacherAccountAction(t.id);
                                        if (res.success) {
                                          toast.success(res.message);
                                          reloadTeachers();
                                        } else toast.error(res.message || "Gagal.");
                                      });
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">Akun Sistem</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MANAJEMEN SISWA                                                   */}
      {/* ========================================================================= */}
      {activeTab === "students" && (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800/80 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Manajemen Siswa
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Persetujuan akun (Force Approve/Reject), reset PIN 4-digit, mutasi kelas, dan penghapusan data siswa.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs gap-1.5"
                onClick={reloadStudents}
                disabled={isPending}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari siswa (nama / NIS / ID)..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && reloadStudents()}
                  className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200"
                />
              </div>
              <select
                value={studentStatusFilter}
                onChange={(e) => {
                  setStudentStatusFilter(e.target.value as any);
                  setTimeout(reloadStudents, 50);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-2 outline-none"
              >
                <option value="ALL">Semua Status Akun</option>
                <option value="ACTIVE">ACTIVE (Disetujui)</option>
                <option value="PENDING">PENDING (Menunggu)</option>
                <option value="REJECTED">REJECTED (Ditolak)</option>
              </select>
              <Button size="sm" onClick={reloadStudents} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                Cari
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Nama Lengkap & NIS</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Sekolah & Rombel</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Status Akun</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Aktivitas</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs text-right">Aksi Kendali</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-xs">
                        Tidak ada data siswa yang sesuai pencarian.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((s) => {
                      const enrollment = s.classMemberships[0];
                      const className = enrollment ? enrollment.class.name : "Belum di-assign";

                      return (
                        <TableRow key={s.id} className="border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850/50">
                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{s.fullName}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              NIS: {s.nis || "—"} · ID: {s.id.slice(0, 8)}...
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-slate-800 dark:text-slate-200">{s.school.name}</div>
                            <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">Kelas: {className}</div>
                          </TableCell>
                          <TableCell>
                            {s.accountStatus === "ACTIVE" && (
                              <Badge className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 text-[10px]">
                                ACTIVE
                              </Badge>
                            )}
                            {s.accountStatus === "PENDING" && (
                              <Badge className="bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 text-[10px]">
                                PENDING
                              </Badge>
                            )}
                            {s.accountStatus === "REJECTED" && (
                              <Badge className="bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50 text-[10px]">
                                REJECTED
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {s.lastLoginAt ? (
                                <span>Login: {new Date(s.lastLoginAt).toLocaleDateString("id-ID")}</span>
                              ) : (
                                <span className="text-slate-400 italic">Belum pernah login</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Force Approve jika Pending */}
                              {s.accountStatus === "PENDING" && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                                  disabled={isPending}
                                  onClick={() => {
                                    startTransition(async () => {
                                      const res = await forceApproveStudentAction(s.id);
                                      if (res.success) {
                                        toast.success("Siswa disetujui (Force Approve L3).");
                                        reloadStudents();
                                      } else toast.error(res.message || "Gagal.");
                                    });
                                  }}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  Approve
                                </Button>
                              )}

                              {/* Force Reject jika Pending */}
                              {s.accountStatus === "PENDING" && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  disabled={isPending}
                                  onClick={() => {
                                    const reason = window.prompt("Alasan penolakan:");
                                    if (reason === null) return;
                                    startTransition(async () => {
                                      const res = await forceRejectStudentAction(s.id, reason);
                                      if (res.success) {
                                        toast.success("Siswa ditolak (Force Reject).");
                                        reloadStudents();
                                      } else toast.error(res.message || "Gagal.");
                                    });
                                  }}
                                >
                                  Reject
                                </Button>
                              )}

                              {/* Reset PIN Modal */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                onClick={() => {
                                  setSelectedItem(s);
                                  setModalInput({ pin: "" });
                                  setModalType("resetPin");
                                }}
                              >
                                <KeyRound className="h-3 w-3 mr-1" />
                                Reset PIN
                              </Button>

                              {/* Pindah Kelas Modal */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                onClick={() => {
                                  setSelectedItem(s);
                                  setModalInput({ targetClassId: "" });
                                  setModalType("transferStudent");
                                }}
                              >
                                <ArrowRightLeft className="h-3 w-3 mr-1" />
                                Pindah
                              </Button>

                              {/* Hapus Siswa */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
                                disabled={isPending}
                                onClick={() => {
                                  if (!window.confirm(`Hapus data siswa "${s.fullName}"?`)) return;
                                  startTransition(async () => {
                                    const res = await deleteStudentAdminAction(s.id);
                                    if (res.success) {
                                      toast.success(res.message);
                                      reloadStudents();
                                    } else toast.error(res.message || "Gagal.");
                                  });
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: MANAJEMEN KELAS / ROMBEL                                          */}
      {/* ========================================================================= */}
      {activeTab === "classes" && (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="border-b border-slate-200 dark:border-slate-800/80 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Manajemen Kelas & Rombongan Belajar
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Atur rombel, perbarui jenjang tingkat, dan buat kelas baru di sekolah mana pun.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5"
                  onClick={() => {
                    setModalInput({ schoolId: selectedSchoolFilter !== "ALL" ? selectedSchoolFilter : allSchools[0]?.id || "", name: "", gradeLevel: "" });
                    setModalType("addClass");
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Tambah Rombel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs gap-1.5"
                  onClick={reloadClasses}
                  disabled={isPending}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari kelas (nama rombel / tingkat)..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && reloadClasses()}
                  className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200"
                />
              </div>
              <select
                value={classGradeFilter}
                onChange={(e) => {
                  setClassGradeFilter(e.target.value);
                  setTimeout(reloadClasses, 50);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-2 outline-none"
              >
                <option value="ALL">Semua Jenjang Tingkat</option>
                <option value="7">Tingkat 7 (VII)</option>
                <option value="8">Tingkat 8 (VIII)</option>
                <option value="9">Tingkat 9 (IX)</option>
                <option value="10">Tingkat 10 (X)</option>
                <option value="11">Tingkat 11 (XI)</option>
                <option value="12">Tingkat 12 (XII)</option>
              </select>
              <Button size="sm" onClick={reloadClasses} disabled={isPending} className="bg-amber-600 hover:bg-amber-500 text-white text-xs">
                Cari
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Nama Rombel</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Sekolah</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Tingkat</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs">Populasi Siswa</TableHead>
                    <TableHead className="text-slate-500 dark:text-slate-400 text-xs text-right">Aksi Kendali</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500 text-xs">
                        Tidak ada rombel yang ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    classes.map((c) => (
                      <TableRow key={c.id} className="border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-850/50">
                        <TableCell>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{c.name}</div>
                          <div className="text-[11px] text-slate-400">ID: {c.id}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-700 dark:text-slate-300">{c.school.name}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs border-slate-200 dark:border-slate-700">
                            {c.gradeLevel ? `Tingkat ${c.gradeLevel}` : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {c._count.classStudents} Siswa
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Edit Kelas */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                              onClick={() => {
                                setSelectedItem(c);
                                setModalInput({ name: c.name, gradeLevel: c.gradeLevel || "" });
                                setModalType("editClass");
                              }}
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>

                            {/* Hapus Kelas */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50"
                              disabled={isPending}
                              onClick={() => {
                                if (!window.confirm(`Hapus rombel "${c.name}"?`)) return;
                                startTransition(async () => {
                                  const res = await deleteClassAdminAction(c.id);
                                  if (res.success) {
                                    toast.success(res.message);
                                    reloadClasses();
                                  } else toast.error(res.message || "Gagal.");
                                });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* MODAL DIALOGS                                                            */}
      {/* ========================================================================= */}

      {/* Modal: Reset Password Guru */}
      {modalType === "resetPassword" && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Reset Password Guru
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm">
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Reset password untuk <strong className="text-slate-800 dark:text-slate-200">{selectedItem.name}</strong> ({selectedItem.email}). Seluruh sesi lama akan langsung hangus.
            </p>
            <div className="space-y-2">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Password Baru (min. 8 karakter):</label>
              <Input
                type="password"
                placeholder="Masukkan password baru..."
                value={modalInput.newPassword || ""}
                onChange={(e) => setModalInput({ newPassword: e.target.value })}
                className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setModalType(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
                disabled={isPending || (modalInput.newPassword || "").length < 8}
                onClick={() => {
                  startTransition(async () => {
                    const res = await resetTeacherPasswordAction(selectedItem.id, modalInput.newPassword);
                    if (res.success) {
                      toast.success("Password guru berhasil direset.");
                      setModalType(null);
                      reloadTeachers();
                    } else toast.error(res.message || "Gagal.");
                  });
                }}
              >
                Simpan Password Baru
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reset PIN Siswa */}
      {modalType === "resetPin" && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Reset PIN Akses Siswa
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm">
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Setel PIN 4-digit baru untuk siswa <strong className="text-slate-800 dark:text-slate-200">{selectedItem.fullName}</strong>.
            </p>
            <div className="space-y-2">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">PIN Baru (Tepat 4 Angka):</label>
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder="Misal: 1234"
                value={modalInput.pin || ""}
                onChange={(e) => setModalInput({ pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-sm font-mono text-center tracking-widest text-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setModalType(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                disabled={isPending || (modalInput.pin || "").length !== 4}
                onClick={() => {
                  startTransition(async () => {
                    const res = await forceResetStudentPinAction(selectedItem.id, modalInput.pin);
                    if (res.success) {
                      toast.success("PIN siswa berhasil direset.");
                      setModalType(null);
                      reloadStudents();
                    } else toast.error(res.message || "Gagal.");
                  });
                }}
              >
                Simpan PIN Baru
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pindah Rombel Siswa */}
      {modalType === "transferStudent" && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                Pindahkan Rombel Siswa
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm">
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pindahkan siswa <strong className="text-slate-800 dark:text-slate-200">{selectedItem.fullName}</strong> ke rombongan belajar lain.
            </p>
            <div className="space-y-2">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Pilih Kelas / Rombel Tujuan:</label>
              <select
                value={modalInput.targetClassId || ""}
                onChange={(e) => setModalInput({ targetClassId: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg px-3 py-2 outline-none"
              >
                <option value="">-- Pilih Kelas Tujuan --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.school.name})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setModalType(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-500 text-white"
                disabled={isPending || !modalInput.targetClassId}
                onClick={() => {
                  startTransition(async () => {
                    const res = await transferStudentClassAction(selectedItem.id, modalInput.targetClassId);
                    if (res.success) {
                      toast.success(res.message);
                      setModalType(null);
                      reloadStudents();
                    } else toast.error(res.message || "Gagal.");
                  });
                }}
              >
                Pindahkan Siswa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Kelas Baru */}
      {modalType === "addClass" && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Plus className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Tambah Rombongan Belajar
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Sekolah:</label>
                <select
                  value={modalInput.schoolId || ""}
                  onChange={(e) => setModalInput({ ...modalInput, schoolId: e.target.value })}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-2 outline-none"
                >
                  {allSchools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Nama Kelas / Rombel:</label>
                <Input
                  placeholder="Misal: 7-A atau X RPL 1"
                  value={modalInput.name || ""}
                  onChange={(e) => setModalInput({ ...modalInput, name: e.target.value })}
                  className="mt-1 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Jenjang Tingkat (Opsional):</label>
                <Input
                  placeholder="Misal: 7 atau 10"
                  value={modalInput.gradeLevel || ""}
                  onChange={(e) => setModalInput({ ...modalInput, gradeLevel: e.target.value })}
                  className="mt-1 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setModalType(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-white"
                disabled={isPending || !(modalInput.name || "").trim() || !modalInput.schoolId}
                onClick={() => {
                  startTransition(async () => {
                    const res = await createClassAdminAction({
                      schoolId: modalInput.schoolId,
                      name: modalInput.name,
                      gradeLevel: modalInput.gradeLevel,
                    });
                    if (res.success) {
                      toast.success(res.message);
                      setModalType(null);
                      reloadClasses();
                    } else toast.error(res.message || "Gagal.");
                  });
                }}
              >
                Buat Rombel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Kelas */}
      {modalType === "editClass" && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                Edit Rombongan Belajar
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Nama Kelas:</label>
                <Input
                  value={modalInput.name || ""}
                  onChange={(e) => setModalInput({ ...modalInput, name: e.target.value })}
                  className="mt-1 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Jenjang Tingkat:</label>
                <Input
                  value={modalInput.gradeLevel || ""}
                  onChange={(e) => setModalInput({ ...modalInput, gradeLevel: e.target.value })}
                  className="mt-1 bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setModalType(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-white"
                disabled={isPending || !(modalInput.name || "").trim()}
                onClick={() => {
                  startTransition(async () => {
                    const res = await updateClassAdminAction({
                      classId: selectedItem.id,
                      name: modalInput.name,
                      gradeLevel: modalInput.gradeLevel,
                    });
                    if (res.success) {
                      toast.success(res.message);
                      setModalType(null);
                      reloadClasses();
                    } else toast.error(res.message || "Gagal.");
                  });
                }}
              >
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Set NPSN */}
      {modalType === "setNpsn" && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                Update NPSN Sekolah
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm">
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Setel NPSN 8 digit untuk <strong className="text-slate-800 dark:text-slate-200">{selectedItem.name}</strong>.
            </p>
            <div className="space-y-2">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">NPSN (8 digit angka):</label>
              <Input
                inputMode="numeric"
                maxLength={8}
                placeholder="Misal: 10293847"
                value={modalInput.npsn || ""}
                onChange={(e) => setModalInput({ npsn: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-slate-200"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setModalType(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-500 text-white"
                disabled={isPending || (modalInput.npsn || "").length !== 8}
                onClick={() => {
                  startTransition(async () => {
                    const res = await setSchoolNpsnAction(selectedItem.id, modalInput.npsn);
                    if (res.success) {
                      toast.success("NPSN sekolah berhasil diperbarui.");
                      setModalType(null);
                      reloadSchools();
                    } else toast.error(res.message || "Gagal.");
                  });
                }}
              >
                Simpan NPSN
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
