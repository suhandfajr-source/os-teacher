"use client";

import React, { useState, useTransition, useEffect, useMemo, useRef } from "react";
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
  X,
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
  Bot,
  Sparkles,
  Eye,
  Coins,
  Cpu,
  TrendingUp,
  ChevronRight,
  BookOpen,
  Calendar,
  Award,
  CheckCircle,
  Clock,
  Zap,
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
  getSchoolDetailAdminAction,
  getTeacherDetailAdminAction,
  getStudentDetailAdminAction,
  getClassDetailAdminAction,
  getAiUsageStatsAdminAction,
} from "@/modules/admin/admin.actions";
import type { SuperadminOverviewStats, AiUsageStats } from "@/modules/admin/admin-stats.service";

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
  initialAiStats?: AiUsageStats;
  allSchools: Array<{ id: string; name: string; npsn: string | null; deactivatedAt: string | Date | null }>;
  initialSchools: SchoolItem[];
  initialTeachers: TeacherItem[];
  initialStudents: StudentItem[];
  initialClasses: ClassItem[];
}

function sortItemsByRelevance<T>(items: T[], query: string, extractKey: (item: T) => string): T[] {
  if (!query.trim()) return items;
  const q = query.trim().toLowerCase();
  return [...items].sort((a, b) => {
    const keyA = extractKey(a).toLowerCase();
    const keyB = extractKey(b).toLowerCase();
    const exactA = keyA === q;
    const exactB = keyB === q;
    if (exactA && !exactB) return -1;
    if (!exactA && exactB) return 1;
    const startsA = keyA.startsWith(q);
    const startsB = keyB.startsWith(q);
    if (startsA && !startsB) return -1;
    if (!startsA && startsB) return 1;
    const idxA = keyA.indexOf(q);
    const idxB = keyB.indexOf(q);
    if (idxA !== -1 && idxB !== -1 && idxA !== idxB) {
      return idxA - idxB;
    }
    if (idxA !== -1 && idxB === -1) return -1;
    if (idxA === -1 && idxB !== -1) return 1;
    return keyA.localeCompare(keyB);
  });
}

export function AdminConsoleClient({
  stats,
  initialAiStats,
  allSchools,
  initialSchools,
  initialTeachers,
  initialStudents,
  initialClasses,
}: AdminConsoleClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "ai-usage" | "schools" | "teachers" | "students" | "classes">("overview");
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>("ALL");
  const [isPending, startTransition] = useTransition();

  // AI Usage State
  const [aiStats, setAiStats] = useState<AiUsageStats | undefined>(initialAiStats);
  const [aiSchoolFilter, setAiSchoolFilter] = useState<string>("ALL");
  const [isAiLoading, setIsAiLoading] = useState(false);

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

  // Dialog State (Action Modals)
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

  // Detailing Drawer State
  const [detailType, setDetailType] = useState<"school" | "teacher" | "student" | "class" | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailDrawerTab, setDetailDrawerTab] = useState<string>("overview");

  // Relevance Sorting Helper
  const sortedSchools = useMemo(() => {
    return sortItemsByRelevance(schools, schoolSearch, (s) => `${s.name} ${s.npsn || ""} ${s.city || ""}`);
  }, [schools, schoolSearch]);

  const sortedTeachers = useMemo(() => {
    return sortItemsByRelevance(teachers, teacherSearch, (t) => `${t.name} ${t.email}`);
  }, [teachers, teacherSearch]);

  const sortedStudents = useMemo(() => {
    return sortItemsByRelevance(students, studentSearch, (s) => `${s.fullName} ${s.nis || ""} ${s.id}`);
  }, [students, studentSearch]);

  const sortedClasses = useMemo(() => {
    return sortItemsByRelevance(classes, classSearch, (c) => `${c.name} ${c.gradeLevel || ""} ${c.school.name}`);
  }, [classes, classSearch]);

  // Trigger Refetches
  const reloadSchools = (customQuery?: string, customStatus?: "ALL" | "ACTIVE" | "INACTIVE") => {
    startTransition(async () => {
      const res = await listSchoolsAdminAction({
        query: customQuery !== undefined ? customQuery : schoolSearch,
        statusFilter: customStatus !== undefined ? customStatus : schoolStatusFilter,
        page: 1,
        pageSize: 50,
      });
      if (res.success) setSchools(res.data as SchoolItem[]);
    });
  };

  const reloadTeachers = (customQuery?: string, customStatus?: "ALL" | "ACTIVE" | "BANNED", customSchoolId?: string) => {
    startTransition(async () => {
      const res = await listTeachersAdminAction({
        query: customQuery !== undefined ? customQuery : teacherSearch,
        schoolId: customSchoolId !== undefined ? customSchoolId : selectedSchoolFilter,
        statusFilter: customStatus !== undefined ? customStatus : teacherStatusFilter,
        page: 1,
        pageSize: 50,
      });
      if (res.success) setTeachers(res.data as TeacherItem[]);
    });
  };

  const reloadStudents = (customQuery?: string, customStatus?: "ALL" | "ACTIVE" | "PENDING" | "REJECTED", customSchoolId?: string) => {
    startTransition(async () => {
      const res = await listStudentsAdminAction({
        query: customQuery !== undefined ? customQuery : studentSearch,
        schoolId: customSchoolId !== undefined ? customSchoolId : selectedSchoolFilter,
        accountStatus: customStatus !== undefined ? customStatus : studentStatusFilter,
        page: 1,
        pageSize: 50,
      });
      if (res.success) setStudents(res.data as StudentItem[]);
    });
  };

  const reloadClasses = (customQuery?: string, customGrade?: string, customSchoolId?: string) => {
    startTransition(async () => {
      const res = await listClassesAdminAction({
        query: customQuery !== undefined ? customQuery : classSearch,
        schoolId: customSchoolId !== undefined ? customSchoolId : selectedSchoolFilter,
        gradeLevel: customGrade !== undefined ? customGrade : classGradeFilter,
        page: 1,
        pageSize: 50,
      });
      if (res.success) setClasses(res.data as ClassItem[]);
    });
  };

  const reloadAiStats = (schoolIdFilter: string) => {
    setIsAiLoading(true);
    startTransition(async () => {
      const res = await getAiUsageStatsAdminAction(schoolIdFilter);
      if (res.success && res.data) {
        setAiStats(res.data);
      }
      setIsAiLoading(false);
    });
  };

  // Open Detailing Drill-Down
  const openDetail = async (type: "school" | "teacher" | "student" | "class", id: string) => {
    setDetailType(type);
    setDetailData(null);
    setIsDetailLoading(true);
    setDetailDrawerTab("overview");

    try {
      if (type === "school") {
        const res = await getSchoolDetailAdminAction(id);
        if (res.success) setDetailData(res.data);
        else toast.error(res.message || "Gagal memuat detail sekolah");
      } else if (type === "teacher") {
        const res = await getTeacherDetailAdminAction(id);
        if (res.success) setDetailData(res.data);
        else toast.error(res.message || "Gagal memuat detail guru");
      } else if (type === "student") {
        const res = await getStudentDetailAdminAction(id);
        if (res.success) setDetailData(res.data);
        else toast.error(res.message || "Gagal memuat detail siswa");
      } else if (type === "class") {
        const res = await getClassDetailAdminAction(id);
        if (res.success) setDetailData(res.data);
        else toast.error(res.message || "Gagal memuat detail kelas");
      }
    } catch {
      toast.error("Terjadi kesalahan saat memuat detail");
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Debounced live search effects (250ms)
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (!isMountedRef.current) return;
    const timer = setTimeout(() => {
      reloadSchools();
    }, 250);
    return () => clearTimeout(timer);
  }, [schoolSearch, schoolStatusFilter]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    const timer = setTimeout(() => {
      reloadTeachers();
    }, 250);
    return () => clearTimeout(timer);
  }, [teacherSearch, teacherStatusFilter, selectedSchoolFilter]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    const timer = setTimeout(() => {
      reloadStudents();
    }, 250);
    return () => clearTimeout(timer);
  }, [studentSearch, studentStatusFilter, selectedSchoolFilter]);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      reloadClasses();
    }, 250);
    return () => clearTimeout(timer);
  }, [classSearch, classGradeFilter, selectedSchoolFilter]);

  // Nav items definition
  const navTabs = [
    { id: "overview", label: "Ringkasan & Analitik", icon: BarChart2, badge: null },
    { id: "ai-usage", label: "Token & AI Studio", icon: Bot, badge: aiStats?.summary.totalDrafts ?? null },
    { id: "schools", label: "Sekolah", icon: Building2, badge: stats.schools.total },
    { id: "teachers", label: "Guru & Staf", icon: Users, badge: stats.teachers.total },
    { id: "students", label: "Siswa", icon: GraduationCap, badge: stats.students.total },
    { id: "classes", label: "Kelas & Rombel", icon: Layers, badge: stats.classes.total },
  ];

  return (
    <div className="space-y-6 w-full pb-16">
      {/* Header & Sub-Nav Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Konsol Superadmin
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pusat pemantauan multi-tenant, pemakaian token AI, agregasi tingkat kelas, dan kendali data platform KLASSA.
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
                reloadTeachers(undefined, undefined, val);
                reloadStudents(undefined, undefined, val);
                reloadClasses(undefined, undefined, val);
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
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Siswa</span>
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.students.total}</div>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      ● {stats.students.active} Aktif
                    </span>
                    {stats.students.pending > 0 && (
                      <span className="text-amber-500 dark:text-amber-400 font-medium">
                        ● {stats.students.pending} Pending
                      </span>
                    )}
                    {stats.students.rejected > 0 && (
                      <span className="text-red-500 dark:text-red-400 font-medium">
                        ● {stats.students.rejected} Ditolak
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Rombel */}
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
                    <span>{stats.classes.totalEnrollments} Siswa Terdaftar di Kelas</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick AI & Activity Insights banner */}
          {aiStats && (
            <Card className="bg-gradient-to-r from-teal-900/40 via-indigo-950/40 to-slate-900 border border-teal-500/30 dark:border-teal-500/20 shadow-md">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
                    <Sparkles className="h-6 w-6 text-teal-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      Pemantauan AI & Token Studio KLASSA
                      <Badge variant="outline" className="bg-teal-500/10 text-teal-300 border-teal-500/30 text-[10px]">
                        Live Monitored
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Telah diproses <strong>{aiStats.summary.totalEstimatedTokens.toLocaleString("id-ID")} token</strong> (~Rp {aiStats.summary.estimatedCostIdr.toLocaleString("id-ID")}) dari <strong>{aiStats.summary.totalDrafts} dokumen AI</strong> yang dibuat oleh <strong>{aiStats.summary.activeAiTeachers} guru aktif</strong>.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("ai-usage")}
                  className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-4 shrink-0"
                >
                  Buka AI Studio Cockpit <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Platform Health Matrix */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  Status Integritas & Keamanan
                </CardTitle>
                <CardDescription className="text-xs">
                  Pemantauan pendaftaran siswa dan akun guru diblokir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Siswa Aktif:</span>
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {stats.students.active} Siswa
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Pendaftaran Siswa Pending:</span>
                  <Badge variant={stats.students.pending > 0 ? "outline" : "secondary"} className="border-amber-500 text-amber-500">
                    {stats.students.pending} Menunggu Approval
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Guru Status Banned:</span>
                  <Badge variant={stats.teachers.banned > 0 ? "destructive" : "secondary"}>
                    {stats.teachers.banned} Akun
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Kapasitas Data & Aktivitas Pembelajaran
                </CardTitle>
                <CardDescription className="text-xs">
                  Agregasi seluruh data kegiatan guru dan siswa di platform KLASSA.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.schools.active}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Sekolah Aktif</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.teachers.active}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Guru Mengajar</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.students.active}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Siswa Terdaftar</div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.classes.total}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Rombel Kelas</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TOKEN & AI STUDIO COCKPIT                                         */}
      {/* ========================================================================= */}
      {activeTab === "ai-usage" && (
        <div className="space-y-6">
          {/* AI Cockpit Header & Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  AI Usage & Token Billing Cockpit
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Estimasi pemakaian token Gemini AI, biaya operasional, dan distribusi kategori draf pembelajaran.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Filter Sekolah:</span>
              <select
                value={aiSchoolFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setAiSchoolFilter(val);
                  reloadAiStats(val);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none focus:border-teal-500"
              >
                <option value="ALL">🌐 Seluruh Sekolah (Global)</option>
                {allSchools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                disabled={isAiLoading}
                onClick={() => reloadAiStats(aiSchoolFilter)}
                className="h-8 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isAiLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* 4 AI Metric Cards */}
          {aiStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Tokens */}
              <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-xs">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Estimasi Token</span>
                    <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400">
                      <Zap className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {aiStats.summary.totalEstimatedTokens.toLocaleString("id-ID")}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Prompt: ~{Math.round(aiStats.summary.totalPromptChars / 3.8).toLocaleString("id-ID")}</span>
                      <span>Output: ~{Math.round(aiStats.summary.totalOutputChars / 3.8).toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Estimated Cost */}
              <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-xs">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Estimasi Biaya API</span>
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Coins className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      Rp {aiStats.summary.estimatedCostIdr.toLocaleString("id-ID")}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      ≈ ${aiStats.summary.estimatedCostUsd.toFixed(4)} USD (Gemini 1.5 Flash)
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Draf AI */}
              <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-xs">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Draf Materi Dibuat</span>
                    <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <FileText className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {aiStats.summary.totalDrafts} Dokumen
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      RPP, Modul, Bacaan, Tugas & Rubrik
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Teachers */}
              <Card className="bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 shadow-xs">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Guru Pengguna AI</span>
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">
                      {aiStats.summary.activeAiTeachers} Guru
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Telah memanfaatkan AI Studio
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Categories & Leaderboard */}
          {aiStats && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Category Breakdown */}
              <Card className="lg:col-span-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    Distribusi Kategori Materi AI
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Persentase jenis materi ajar yang di-generate guru.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {aiStats.byCategory.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">Belum ada aktivitas pembuatan draf AI.</div>
                  ) : (
                    aiStats.byCategory.map((cat) => (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {cat.category === "LESSON_PLAN" && "📋 RPP / Modul Ajar"}
                            {cat.category === "LEARNING_MATERIAL" && "📖 Bahan Bacaan / Ringkasan"}
                            {cat.category === "TASK_INSTRUCTION" && "✍️ Instruksi Penugasan"}
                            {cat.category === "RUBRIC" && "📐 Rubrik Penilaian"}
                            {!["LESSON_PLAN", "LEARNING_MATERIAL", "TASK_INSTRUCTION", "RUBRIC"].includes(cat.category) &&
                              cat.label}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {cat.count} draf ({cat.percentage}%) • ~{cat.tokens.toLocaleString("id-ID")} tok
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Top Teachers Leaderboard */}
              <Card className="lg:col-span-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Top Guru Pengguna AI Teraktif
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Guru paling produktif memanfaatkan asisten AI untuk kurikulum.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {aiStats.topTeachers.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">Belum ada data guru.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {aiStats.topTeachers.map((t, idx) => (
                        <div key={t.teacherProfileId} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-slate-900 dark:text-white">{t.name}</div>
                              <div className="text-[11px] text-slate-400">{t.schoolName}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                              {t.draftCount} Dokumen
                            </div>
                            <div className="text-[10px] text-slate-400">
                              ~{t.totalTokens.toLocaleString("id-ID")} tok
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent AI Generation Table */}
          {aiStats && (
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  Riwayat Draf Materi AI Terbaru
                </CardTitle>
                <CardDescription className="text-xs">
                  Aktivitas real-time pembuatan materi menggunakan asisten AI.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-950/80">
                      <TableRow className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                        <TableHead className="text-slate-700 dark:text-slate-300">Judul & Topik Materi</TableHead>
                        <TableHead className="text-slate-700 dark:text-slate-300">Format</TableHead>
                        <TableHead className="text-slate-700 dark:text-slate-300">Guru & Sekolah</TableHead>
                        <TableHead className="text-slate-700 dark:text-slate-300">Model AI</TableHead>
                        <TableHead className="text-slate-700 dark:text-slate-300 text-right">Estimasi Token</TableHead>
                        <TableHead className="text-slate-700 dark:text-slate-300 text-right">Waktu</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                      {aiStats.recentDrafts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-slate-400">
                            Belum ada riwayat pembuatan materi AI.
                          </TableCell>
                        </TableRow>
                      ) : (
                        aiStats.recentDrafts.map((d) => (
                          <TableRow key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <TableCell>
                              <div className="font-semibold text-slate-900 dark:text-white">{d.title}</div>
                              {d.topic && <div className="text-[11px] text-slate-400">{d.topic}</div>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-950">
                                {d.contentType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-slate-800 dark:text-slate-200">{d.teacherName}</div>
                              <div className="text-[10px] text-slate-400">{d.schoolName}</div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                                {d.modelUsed}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-medium text-teal-600 dark:text-teal-400">
                              ~{d.estimatedTokens.toLocaleString("id-ID")}
                            </TableCell>
                            <TableCell className="text-right text-slate-400 text-[11px]">
                              {new Date(d.createdAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SEKOLAH                                                           */}
      {/* ========================================================================= */}
      {activeTab === "schools" && (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  Daftar Tenant Sekolah
                </CardTitle>
                <CardDescription className="text-xs">
                  Kelola status sekolah, NPSN, dan pantau rincian guru serta murid per sekolah.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => reloadSchools()}
                  className="h-8 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filter & Live Search Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
              <div className="relative sm:col-span-8">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari sekolah berdasarkan nama, NPSN, atau kota..."
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                />
                {schoolSearch && (
                  <button
                    onClick={() => setSchoolSearch("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="sm:col-span-4">
                <select
                  value={schoolStatusFilter}
                  onChange={(e) => setSchoolStatusFilter(e.target.value as any)}
                  className="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 outline-none"
                >
                  <option value="ALL">Semua Status (Aktif & Nonaktif)</option>
                  <option value="ACTIVE">Hanya Sekolah Aktif</option>
                  <option value="INACTIVE">Hanya Sekolah Nonaktif</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950/80">
                  <TableRow className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                    <TableHead className="text-slate-700 dark:text-slate-300">Nama Sekolah & Kota</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">NPSN</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 text-center">Guru</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 text-center">Siswa</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 text-center">Kelas</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 text-right">Aksi Kendali</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {sortedSchools.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        Tidak ada data sekolah yang sesuai dengan pencarian.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedSchools.map((s) => {
                      const isDeactivated = Boolean(s.deactivatedAt);
                      return (
                        <TableRow
                          key={s.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            isDeactivated ? "opacity-60 bg-red-500/5" : ""
                          }`}
                        >
                          <TableCell className="font-semibold text-slate-900 dark:text-white">
                            <div>{s.name}</div>
                            {s.city && <div className="text-[11px] text-slate-400 font-normal">{s.city}</div>}
                          </TableCell>
                          <TableCell className="font-mono text-slate-600 dark:text-slate-300">
                            {s.npsn || <span className="text-slate-400 italic">Belum diisi</span>}
                          </TableCell>
                          <TableCell className="text-center font-medium text-indigo-600 dark:text-indigo-400">
                            {s._count?.memberships ?? 0}
                          </TableCell>
                          <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">
                            {s._count?.students ?? 0}
                          </TableCell>
                          <TableCell className="text-center font-medium text-amber-600 dark:text-amber-400">
                            {s._count?.classes ?? 0}
                          </TableCell>
                          <TableCell>
                            {isDeactivated ? (
                              <Badge variant="destructive" className="text-[10px]">Nonaktif</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                                Aktif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Tombol Detailing */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDetail("school", s.id)}
                                className="h-7 px-2 text-[11px] bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-300 dark:border-teal-500/30 hover:bg-teal-100"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Detail
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(s);
                                  setModalInput({ npsn: s.npsn || "" });
                                  setModalType("setNpsn");
                                }}
                                className="h-7 px-2 text-[11px]"
                              >
                                NPSN
                              </Button>

                              {isDeactivated ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] text-emerald-600 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                  onClick={() => {
                                    startTransition(async () => {
                                      const res = await reactivateSchoolAction(s.id);
                                      if (res.success) {
                                        toast.success("Sekolah diaktifkan kembali.");
                                        reloadSchools();
                                      } else toast.error(res.message || "Gagal.");
                                    });
                                  }}
                                >
                                  Aktifkan
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] text-red-600 border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10"
                                  onClick={() => {
                                    if (confirm(`Nonaktifkan akses sekolah "${s.name}"? Guru di sekolah ini tidak akan bisa login.`)) {
                                      startTransition(async () => {
                                        const res = await deactivateSchoolAction(s.id);
                                        if (res.success) {
                                          toast.success("Sekolah dinonaktifkan.");
                                          reloadSchools();
                                        } else toast.error(res.message || "Gagal.");
                                      });
                                    }
                                  }}
                                >
                                  Nonaktifkan
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                title="Hapus Sekolah (jika belum ada relasi)"
                                onClick={() => {
                                  if (confirm(`Hapus sekolah "${s.name}"? Operasi ini hanya akan berhasil jika sekolah belum memiliki riwayat siswa/guru.`)) {
                                    startTransition(async () => {
                                      const res = await deleteOrArchiveSchoolAction(s.id);
                                      if (res.success) {
                                        toast.success(res.message);
                                        reloadSchools();
                                      } else toast.error(res.message || "Gagal.");
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
      {/* TAB 4: GURU & STAF                                                       */}
      {/* ========================================================================= */}
      {activeTab === "teachers" && (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Daftar Guru & Akun Pengguna
                </CardTitle>
                <CardDescription className="text-xs">
                  Pantau guru pengampu, sekolah aktif, reset password mandiri, dan kendali status banned.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => reloadTeachers()}
                className="h-8 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isPending ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
              <div className="relative sm:col-span-8">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama guru atau email..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                />
                {teacherSearch && (
                  <button
                    onClick={() => setTeacherSearch("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="sm:col-span-4">
                <select
                  value={teacherStatusFilter}
                  onChange={(e) => setTeacherStatusFilter(e.target.value as any)}
                  className="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 outline-none"
                >
                  <option value="ALL">Semua Status Akun</option>
                  <option value="ACTIVE">Hanya Guru Aktif</option>
                  <option value="BANNED">Hanya Guru Banned</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950/80">
                  <TableRow className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                    <TableHead className="text-slate-700 dark:text-slate-300">Nama & Email</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Role</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Sekolah Terdaftar</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 text-right">Aksi Kendali</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {sortedTeachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        Tidak ada akun guru yang ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedTeachers.map((t) => {
                      const isSuperadmin = t.platformRole === "SUPERADMIN";
                      const isBanned = t.banned;
                      const memberships = t.teacherProfile?.memberships || [];
                      return (
                        <TableRow
                          key={t.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                            isBanned ? "opacity-60 bg-red-500/5" : ""
                          }`}
                        >
                          <TableCell className="font-semibold text-slate-900 dark:text-white">
                            <div>{t.name}</div>
                            <div className="text-[11px] text-slate-400 font-normal">{t.email}</div>
                          </TableCell>
                          <TableCell>
                            {isSuperadmin ? (
                              <Badge className="bg-purple-600 text-white text-[10px]">Superadmin</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Guru</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {memberships.length === 0 ? (
                              <span className="text-slate-400 italic text-[11px]">Belum terhubung sekolah</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {memberships.map((m) => (
                                  <Badge
                                    key={m.id}
                                    variant="secondary"
                                    className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                  >
                                    {m.school.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {isBanned ? (
                              <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                                Aktif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Tombol Detailing */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDetail("teacher", t.id)}
                                className="h-7 px-2 text-[11px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-500/30 hover:bg-indigo-100"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Detail
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(t);
                                  setModalInput({ newPassword: "" });
                                  setModalType("resetPassword");
                                }}
                                className="h-7 px-2 text-[11px]"
                              >
                                <KeyRound className="h-3 w-3 mr-1" />
                                Password
                              </Button>

                              {!isSuperadmin && (
                                <>
                                  {isBanned ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px] text-emerald-600 border-emerald-500/30"
                                      onClick={() => {
                                        startTransition(async () => {
                                          const res = await unbanTeacherAction(t.id);
                                          if (res.success) {
                                            toast.success("Blokir akun guru dibuka.");
                                            reloadTeachers();
                                          } else toast.error(res.message || "Gagal.");
                                        });
                                      }}
                                    >
                                      Unban
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px] text-red-600 border-red-500/30"
                                      onClick={() => {
                                        const reason = prompt("Alasan pembekuan / ban akun guru:");
                                        if (reason !== null) {
                                          startTransition(async () => {
                                            const res = await banTeacherAction(t.id, reason || "Pelanggaran kebijakan platform");
                                            if (res.success) {
                                              toast.success("Akun guru telah diblokir.");
                                              reloadTeachers();
                                            } else toast.error(res.message || "Gagal.");
                                          });
                                        }
                                      }}
                                    >
                                      Ban
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                    title="Hapus Akun Guru"
                                    onClick={() => {
                                      if (confirm(`Hapus permanen akun guru "${t.name}"? Operasi ini hanya akan berhasil jika tidak ada data nilai/kegiatan.`)) {
                                        startTransition(async () => {
                                          const res = await deleteTeacherAccountAction(t.id);
                                          if (res.success) {
                                            toast.success(res.message);
                                            reloadTeachers();
                                          } else toast.error(res.message || "Gagal.");
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
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
      {/* TAB 5: SISWA                                                             */}
      {/* ========================================================================= */}
      {activeTab === "students" && (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Daftar Siswa Platform
                </CardTitle>
                <CardDescription className="text-xs">
                  Manajemen siswa, reset PIN akses 4-digit, persetujuan pendaftaran, dan mutasi kelas.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => reloadStudents()}
                className="h-8 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isPending ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Filter & Live Search Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
              <div className="relative sm:col-span-8">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama siswa atau NIS..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                />
                {studentSearch && (
                  <button
                    onClick={() => setStudentSearch("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="sm:col-span-4">
                <select
                  value={studentStatusFilter}
                  onChange={(e) => setStudentStatusFilter(e.target.value as any)}
                  className="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 outline-none"
                >
                  <option value="ALL">Semua Status Siswa</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="REJECTED">Ditolak</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950/80">
                  <TableRow className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                    <TableHead className="text-slate-700 dark:text-slate-300">Nama Siswa & NIS</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Sekolah</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Kelas / Rombel</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Status Akun</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 text-right">Aksi Kendali</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {sortedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        Tidak ada data siswa yang ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedStudents.map((s) => {
                      const isLocked = Boolean(s.lockedUntil && new Date(s.lockedUntil) > new Date());
                      const isPendingAcc = s.accountStatus === "PENDING";
                      const currentClass = s.classMemberships?.[0]?.class;
                      return (
                        <TableRow key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <TableCell className="font-semibold text-slate-900 dark:text-white">
                            <div>{s.fullName}</div>
                            <div className="text-[11px] text-slate-400 font-mono font-normal">
                              NIS: {s.nis || "-"}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-700 dark:text-slate-300 font-medium">
                            {s.school.name}
                          </TableCell>
                          <TableCell>
                            {currentClass ? (
                              <Badge variant="outline" className="text-[10px]">
                                {currentClass.name}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Tanpa Rombel</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isLocked ? (
                              <Badge variant="destructive" className="text-[10px]">PIN Terkunci</Badge>
                            ) : isPendingAcc ? (
                              <Badge variant="outline" className="border-amber-500 text-amber-500 text-[10px]">Pending</Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                                Aktif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Tombol Detailing */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openDetail("student", s.id)}
                                className="h-7 px-2 text-[11px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-100"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Detail
                              </Button>

                              {isPendingAcc && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[11px] text-emerald-600 border-emerald-500/30"
                                  onClick={() => {
                                    startTransition(async () => {
                                      const res = await forceApproveStudentAction(s.id);
                                      if (res.success) {
                                        toast.success("Siswa disetujui.");
                                        reloadStudents();
                                      } else toast.error(res.message || "Gagal.");
                                    });
                                  }}
                                >
                                  Approve
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(s);
                                  setModalInput({ pin: "" });
                                  setModalType("resetPin");
                                }}
                                className="h-7 px-2 text-[11px]"
                              >
                                <KeyRound className="h-3 w-3 mr-1" />
                                Reset PIN
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(s);
                                  setModalInput({ targetClassId: "" });
                                  setModalType("transferStudent");
                                }}
                                className="h-7 px-2 text-[11px]"
                              >
                                <ArrowRightLeft className="h-3 w-3 mr-1" />
                                Pindah
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                                title="Hapus Siswa"
                                onClick={() => {
                                  if (confirm(`Hapus permanen data siswa "${s.fullName}"? Operasi ini hanya akan berhasil jika siswa belum memiliki riwayat presensi/nilai.`)) {
                                    startTransition(async () => {
                                      const res = await deleteStudentAdminAction(s.id);
                                      if (res.success) {
                                        toast.success(res.message);
                                        reloadStudents();
                                      } else toast.error(res.message || "Gagal.");
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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
      {/* TAB 6: KELAS & ROMBEL                                                    */}
      {/* ========================================================================= */}
      {activeTab === "classes" && (
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Daftar Rombongan Belajar (Kelas)
                </CardTitle>
                <CardDescription className="text-xs">
                  Kelola rombel kelas sekolah, tambah rombel baru, kode gabung (join code), dan pemetaan siswa.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setModalInput({ schoolId: allSchools[0]?.id || "", name: "", gradeLevel: "" });
                    setModalType("addClass");
                  }}
                  className="bg-teal-600 hover:bg-teal-500 text-white h-8 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Tambah Kelas
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => reloadClasses()}
                  className="h-8 text-xs"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Filter & Live Search Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
              <div className="relative sm:col-span-8">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Cari nama kelas atau jenjang..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700"
                />
                {classSearch && (
                  <button
                    onClick={() => setClassSearch("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="sm:col-span-4">
                <select
                  value={classGradeFilter}
                  onChange={(e) => setClassGradeFilter(e.target.value)}
                  className="w-full h-9 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-3 outline-none"
                >
                  <option value="ALL">Semua Jenjang Tingkat</option>
                  <option value="7">Kelas 7</option>
                  <option value="8">Kelas 8</option>
                  <option value="9">Kelas 9</option>
                  <option value="10">Kelas 10</option>
                  <option value="11">Kelas 11</option>
                  <option value="12">Kelas 12</option>
                </select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-950/80">
                  <TableRow className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                    <TableHead className="text-slate-700 dark:text-slate-300">Nama Kelas / Rombel</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Sekolah</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Tingkat</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 text-center">Jumlah Siswa</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 text-center">Konteks Ajar</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300">Kode Gabung</TableHead>
                    <TableHead className="text-slate-700 dark:text-slate-300 text-right">Aksi Kendali</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {sortedClasses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                        Tidak ada rombongan belajar yang ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedClasses.map((c) => (
                      <TableRow key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-semibold text-slate-900 dark:text-white">
                          {c.name}
                        </TableCell>
                        <TableCell className="text-slate-700 dark:text-slate-300 font-medium">
                          {c.school.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {c.gradeLevel ? `Kelas ${c.gradeLevel}` : "Umum"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold text-emerald-600 dark:text-emerald-400">
                          {c._count?.classStudents ?? 0}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-indigo-600 dark:text-indigo-400">
                          {c._count?.teachingContexts ?? 0}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.joinCode ? (
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] font-bold text-teal-600 dark:text-teal-400">
                              {c.joinCode} {c.joinCodeLocked ? "🔒" : ""}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Tombol Detailing */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDetail("class", c.id)}
                              className="h-7 px-2 text-[11px] bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-500/30 hover:bg-amber-100"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Detail
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedItem(c);
                                setModalInput({ name: c.name, gradeLevel: c.gradeLevel || "" });
                                setModalType("editClass");
                              }}
                              className="h-7 px-2 text-[11px]"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                              title="Hapus Kelas"
                              onClick={() => {
                                if (confirm(`Hapus rombel "${c.name}"? Operasi ini hanya akan berhasil jika kelas tidak memiliki siswa atau konteks ajar.`)) {
                                  startTransition(async () => {
                                    const res = await deleteClassAdminAction(c.id);
                                    if (res.success) {
                                      toast.success(res.message);
                                      reloadClasses();
                                    } else toast.error(res.message || "Gagal.");
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
      {/* DRAWER / SLIDE-OVER MODAL: DETAILING VIEW (DRILL-DOWN)                     */}
      {/* ========================================================================= */}
      {detailType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  {detailType === "school" && <Building2 className="h-5 w-5" />}
                  {detailType === "teacher" && <Users className="h-5 w-5" />}
                  {detailType === "student" && <GraduationCap className="h-5 w-5" />}
                  {detailType === "class" && <Layers className="h-5 w-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {detailType === "school" && "Rincian Data Sekolah"}
                      {detailType === "teacher" && "Profil & Aktivitas Guru"}
                      {detailType === "student" && "Rincian & Rekam Siswa"}
                      {detailType === "class" && "Rincian Rombongan Belajar"}
                    </h2>
                    <Badge variant="outline" className="text-[10px]">
                      {detailType.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Drill-down relasi data platform multi-tenant KLASSA.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDetailType(null);
                  setDetailData(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isDetailLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin text-teal-500" />
                  <span className="text-xs font-medium">Memuat data relasi komprehensif...</span>
                </div>
              ) : !detailData ? (
                <div className="text-center py-20 text-xs text-slate-400">Data tidak ditemukan.</div>
              ) : (
                <>
                  {/* =============================================================== */}
                  {/* DETAIL: SEKOLAH                                                 */}
                  {/* =============================================================== */}
                  {detailType === "school" && (
                    <div className="space-y-6">
                      {/* Overview Card */}
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{detailData.name}</h3>
                          {detailData.deactivatedAt ? (
                            <Badge variant="destructive" className="text-[10px]">Nonaktif</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                              Aktif
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="text-slate-400 text-[11px]">NPSN:</span>
                            <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {detailData.npsn || "-"}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[11px]">Kota / Daerah:</span>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {detailData.city || "-"}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[11px]">Total Siswa:</span>
                            <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {detailData._count?.students ?? 0} Siswa
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[11px]">Total Guru:</span>
                            <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {detailData._count?.teacherMemberships ?? 0} Guru
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-tabs for School */}
                      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
                        <button
                          onClick={() => setDetailDrawerTab("overview")}
                          className={`px-3 py-1.5 rounded-lg font-medium ${
                            detailDrawerTab === "overview"
                              ? "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-500/30"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          Daftar Guru ({detailData.teacherMemberships?.length ?? 0})
                        </button>
                        <button
                          onClick={() => setDetailDrawerTab("classes")}
                          className={`px-3 py-1.5 rounded-lg font-medium ${
                            detailDrawerTab === "classes"
                              ? "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-500/30"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          Rombel Kelas ({detailData.classes?.length ?? 0})
                        </button>
                        <button
                          onClick={() => setDetailDrawerTab("students")}
                          className={`px-3 py-1.5 rounded-lg font-medium ${
                            detailDrawerTab === "students"
                              ? "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-500/30"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          Daftar Siswa ({detailData.students?.length ?? 0})
                        </button>
                      </div>

                      {/* Detail Tab: Teachers */}
                      {detailDrawerTab === "overview" && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Guru yang Mengajar di {detailData.name}:
                          </h4>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                            {(detailData.teacherMemberships || []).length === 0 ? (
                              <div className="p-4 text-center text-slate-400">Belum ada guru terhubung.</div>
                            ) : (
                              detailData.teacherMemberships.map((m: any) => {
                                const teacherUser = m.teacherProfile?.user;
                                const contexts = m.teacherProfile?.teachingContexts || [];
                                return (
                                  <div key={m.id} className="p-3 bg-white dark:bg-slate-900/90 flex items-start justify-between gap-3">
                                    <div>
                                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        {teacherUser?.name}
                                        {teacherUser?.banned && (
                                          <Badge variant="destructive" className="text-[9px]">Banned</Badge>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-400">{teacherUser?.email}</div>
                                      <div className="flex flex-wrap gap-1 mt-1.5">
                                        {contexts.map((ctx: any) => (
                                          <Badge key={ctx.id} variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-950">
                                            {ctx.subject?.name} ({ctx.class?.name})
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {m.workspaceRole}
                                    </Badge>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* Detail Tab: Classes */}
                      {detailDrawerTab === "classes" && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Rombongan Belajar di {detailData.name}:
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(detailData.classes || []).map((cls: any) => (
                              <div
                                key={cls.id}
                                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 space-y-2 text-xs"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 dark:text-white text-sm">{cls.name}</span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {cls.gradeLevel ? `Kelas ${cls.gradeLevel}` : "Umum"}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <span>👥 {cls._count?.classStudents ?? 0} Siswa</span>
                                  <span>📚 {cls._count?.teachingContexts ?? 0} Mapel</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Detail Tab: Students */}
                      {detailDrawerTab === "students" && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Daftar Siswa (Maks 50 Siswa Pertama):
                          </h4>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs max-h-96 overflow-y-auto">
                            {(detailData.students || []).map((st: any) => (
                              <div key={st.id} className="p-2.5 bg-white dark:bg-slate-900/90 flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white">{st.fullName}</div>
                                  <div className="text-[11px] text-slate-400 font-mono">NIS: {st.nis || "-"}</div>
                                </div>
                                <div className="text-right">
                                  <Badge variant="outline" className="text-[10px]">
                                    {st.classMemberships?.[0]?.class?.name || "Tanpa Kelas"}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* =============================================================== */}
                  {/* DETAIL: GURU                                                    */}
                  {/* =============================================================== */}
                  {detailType === "teacher" && (
                    <div className="space-y-6">
                      {/* Overview Profile */}
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{detailData.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{detailData.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {detailData.platformRole === "SUPERADMIN" ? (
                              <Badge className="bg-purple-600 text-white text-[10px]">Superadmin</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">Guru</Badge>
                            )}
                            {detailData.banned ? (
                              <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                                Aktif
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Schools & Teaching Contexts */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4 text-indigo-500" />
                          Konteks Mengajar & Mata Pelajaran:
                        </h4>
                        <div className="space-y-2">
                          {(detailData.teacherProfile?.teachingContexts || []).length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl">
                              Guru ini belum mengampu mata pelajaran / rombel.
                            </div>
                          ) : (
                            detailData.teacherProfile.teachingContexts.map((ctx: any) => (
                              <div
                                key={ctx.id}
                                className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {ctx.subject?.name}
                                  </span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {ctx.class?.name} ({ctx.class?.school?.name})
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                                  <span>👥 {ctx.class?._count?.classStudents ?? 0} Siswa Terdaftar</span>
                                  <span>📅 {ctx._count?.sessions ?? 0} Pertemuan Sesi</span>
                                  <span>📝 {ctx._count?.assessments ?? 0} Asesmen & Nilai</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Recent AI Drafts by this Teacher */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-teal-500" />
                          Draf Materi AI Terakhir Dibuat:
                        </h4>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                          {(detailData.teacherProfile?.aiDrafts || []).length === 0 ? (
                            <div className="p-4 text-center text-slate-400">Belum ada draf AI yang dibuat.</div>
                          ) : (
                            detailData.teacherProfile.aiDrafts.map((d: any) => (
                              <div key={d.id} className="p-2.5 bg-white dark:bg-slate-900/90 flex items-center justify-between">
                                <div>
                                  <div className="font-semibold text-slate-900 dark:text-white">{d.title}</div>
                                  <div className="text-[11px] text-slate-400">{d.topic || "-"}</div>
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                  {d.contentType}
                                </Badge>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =============================================================== */}
                  {/* DETAIL: SISWA                                                   */}
                  {/* =============================================================== */}
                  {detailType === "student" && (
                    <div className="space-y-6">
                      {/* Overview Card */}
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{detailData.fullName}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              NIS: {detailData.nis || "-"} • Sekolah: {detailData.school?.name}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                            {detailData.accountStatus}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
                          <div>
                            <span className="text-slate-400 text-[11px]">Rombel Kelas:</span>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {detailData.classMemberships?.[0]?.class?.name || "Belum Terdaftar"}
                            </div>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[11px]">Status PIN:</span>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {detailData.accessPinHash ? "✅ PIN Telah Dibuat" : "⚠️ Belum Ada PIN"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-tabs for Student */}
                      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs">
                        <button
                          onClick={() => setDetailDrawerTab("overview")}
                          className={`px-3 py-1.5 rounded-lg font-medium ${
                            detailDrawerTab === "overview"
                              ? "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-500/30"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          Riwayat Presensi ({detailData.attendanceRecords?.length ?? 0})
                        </button>
                        <button
                          onClick={() => setDetailDrawerTab("grades")}
                          className={`px-3 py-1.5 rounded-lg font-medium ${
                            detailDrawerTab === "grades"
                              ? "bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-300 dark:border-teal-500/30"
                              : "text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          Riwayat Nilai ({detailData.assessmentResults?.length ?? 0})
                        </button>
                      </div>

                      {/* Attendance Tab */}
                      {detailDrawerTab === "overview" && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Catatan Kehadiran Terbaru:
                          </h4>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs max-h-80 overflow-y-auto">
                            {(detailData.attendanceRecords || []).length === 0 ? (
                              <div className="p-4 text-center text-slate-400">Belum ada data presensi.</div>
                            ) : (
                              detailData.attendanceRecords.map((att: any) => (
                                <div key={att.id} className="p-2.5 bg-white dark:bg-slate-900/90 flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                      {att.teachingSession?.teachingContext?.subject?.name || "Sesi Pembelajaran"}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {new Date(att.createdAt).toLocaleDateString("id-ID", {
                                        weekday: "short",
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      })}
                                    </div>
                                  </div>
                                  <Badge
                                    variant={att.status === "PRESENT" ? "secondary" : "destructive"}
                                    className="text-[10px]"
                                  >
                                    {att.status}
                                  </Badge>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Grades Tab */}
                      {detailDrawerTab === "grades" && (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Catatan Nilai Asesmen:
                          </h4>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs max-h-80 overflow-y-auto">
                            {(detailData.assessmentResults || []).length === 0 ? (
                              <div className="p-4 text-center text-slate-400">Belum ada data penilaian siswa.</div>
                            ) : (
                              detailData.assessmentResults.map((res: any) => (
                                <div key={res.id} className="p-2.5 bg-white dark:bg-slate-900/90 flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-white">
                                      {res.assessment?.title || "Tugas / Asesmen"}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {res.assessment?.teachingContext?.subject?.name}
                                    </div>
                                  </div>
                                  <div className="text-right font-bold text-sm text-teal-600 dark:text-teal-400">
                                    {res.score ?? "-"}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* =============================================================== */}
                  {/* DETAIL: KELAS                                                   */}
                  {/* =============================================================== */}
                  {detailType === "class" && (
                    <div className="space-y-6">
                      {/* Overview Card */}
                      <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{detailData.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Sekolah: {detailData.school?.name} • Tingkat: {detailData.gradeLevel ? `Kelas ${detailData.gradeLevel}` : "Umum"}
                            </p>
                          </div>
                          {detailData.joinCode && (
                            <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                              Kode: {detailData.joinCode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Guru & Mata Pelajaran Terhubung */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-indigo-500" />
                          Guru Pengampu & Mata Pelajaran:
                        </h4>
                        <div className="space-y-2 text-xs">
                          {(detailData.teachingContexts || []).length === 0 ? (
                            <div className="p-4 text-center text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl">
                              Belum ada mata pelajaran terdaftar untuk rombel ini.
                            </div>
                          ) : (
                            detailData.teachingContexts.map((ctx: any) => (
                              <div
                                key={ctx.id}
                                className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">{ctx.subject?.name}</div>
                                  <div className="text-[11px] text-slate-400">
                                    Guru: {ctx.teacherProfile?.user?.name} ({ctx.teacherProfile?.user?.email})
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                  {ctx.academicPeriod?.year} - {ctx.academicPeriod?.semester}
                                </Badge>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Daftar 20+ Anggota Siswa */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <GraduationCap className="h-4 w-4 text-emerald-500" />
                            Daftar Siswa Anggota Rombel ({detailData.classStudents?.length ?? 0} Siswa):
                          </h4>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs max-h-96 overflow-y-auto">
                          {(detailData.classStudents || []).length === 0 ? (
                            <div className="p-4 text-center text-slate-400">Belum ada siswa dalam rombel ini.</div>
                          ) : (
                            detailData.classStudents.map((cs: any, idx: number) => {
                              const s = cs.student;
                              return (
                                <div key={cs.id} className="p-2.5 bg-white dark:bg-slate-900/90 flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 flex items-center justify-center">
                                      {idx + 1}
                                    </span>
                                    <div>
                                      <div className="font-semibold text-slate-900 dark:text-white">{s.fullName}</div>
                                      <div className="text-[10px] text-slate-400 font-mono">NIS: {s.nis || "-"}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {s.accessPinHash ? (
                                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                                        PIN Aktif
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                                        No PIN
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-950/50">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDetailType(null);
                  setDetailData(null);
                }}
              >
                Tutup Rincian
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DIALOGS (ACTION POPUPS)                                             */}
      {/* ========================================================================= */}

      {/* Modal: Reset Password Guru */}
      {modalType === "resetPassword" && selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Reset Password Akun Guru
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm">
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Setel kata sandi baru untuk <strong className="text-slate-800 dark:text-slate-200">{selectedItem.name}</strong> ({selectedItem.email}).
            </p>
            <div className="space-y-2">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">Password Baru (Min. 8 Karakter):</label>
              <Input
                type="password"
                placeholder="Masukkan password baru..."
                value={modalInput.newPassword || ""}
                onChange={(e) => setModalInput({ newPassword: e.target.value })}
                className="bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-200"
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
