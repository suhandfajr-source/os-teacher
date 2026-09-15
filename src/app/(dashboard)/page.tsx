import React from 'react';
import Link from 'next/link';
import { prisma } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getRscAuthContext } from "@/lib/rsc-auth-context";
import { 
  Clock, 
  Sparkles, 
  Presentation, 
  HelpCircle, 
  FileText, 
  ClipboardList, 
  BookMarked, 
  History, 
  Users, 
  Check, 
  Play, 
  AlertCircle,
  ArrowRight,
  School
} from 'lucide-react';

export default async function DashboardPage() {
  let authContext = null;
  try {
    authContext = await getRscAuthContext();
  } catch {
    redirect("/login");
  }

  const { session, profile, activeSchoolId, activeSchool } = authContext;

  if (!profile.activeSchoolId) {
    redirect("/onboarding");
  }

  // Query teacher-owned teaching contexts in the active school
  const teachingContexts = await prisma.teachingContext.findMany({
    where: {
      teacherProfileId: profile.id,
      schoolId: activeSchoolId
    },
    include: {
      class: true,
      subject: true,
      academicPeriod: true
    }
  });

  const teachingContextIds = teachingContexts.map(tc => tc.id);

  // Query today's sessions, students count, recent drafts, and pending essay attempts in parallel
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todaySessions, reachableStudentsCount, recentDrafts, pendingEssayCount] = await Promise.all([
    prisma.teachingSession.findMany({
      where: {
        teachingContextId: { in: teachingContextIds },
        date: { gte: today }
      },
      include: {
        teachingContext: {
          include: {
            class: true,
            subject: true
          }
        }
      },
      orderBy: { date: 'asc' }
    }),
    prisma.student.count({
      where: {
        schoolId: activeSchoolId,
        status: "ACTIVE",
        classMemberships: {
          some: {
            class: {
              teachingContexts: {
                some: {
                  teacherProfileId: profile.id
                }
              }
            }
          }
        }
      }
    }),
    prisma.aiContentDraft.findMany({
      where: {
        teacherProfileId: profile.id,
        schoolId: activeSchoolId,
        status: "ACTIVE"
      },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      include: {
        teachingContext: {
          include: {
            class: true,
            subject: true
          }
        }
      }
    }),
    prisma.quizAttempt.count({
      where: {
        status: "NEEDS_GRADING",
        quiz: {
          teachingContextId: { in: teachingContextIds }
        }
      }
    })
  ]);

  const activeSession = todaySessions.find(s => s.status === "IN_PROGRESS") || todaySessions[0];

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      
      {/* HERO HEADER: RUANG KERJA MENGAJAR HARI INI */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div>
          <h1 className="text-2xl font-heading font-extrabold text-navy-dark tracking-tight">
            Selamat Datang, {session.user.name}! ☕
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <School className="w-3.5 h-3.5 text-navy" />
            {activeSchool ? activeSchool.name : "Sekolah"} • Mengampu {teachingContexts.length} kelas aktif ({reachableStudentsCount} siswa).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-eduGreen-soft text-eduGreen border border-eduGreen-border px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-eduGreen animate-pulse"></span>
            {todaySessions.length} Sesi Terjadwal Hari Ini
          </span>
        </div>
      </div>

      {/* PERINGATAN KOREKSI ESAI (JIKA ADA SISWA YANG MENUNGGU) */}
      {pendingEssayCount > 0 && (
        <div className="bg-eduAmber-soft border border-eduAmber-border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 font-bold">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-dark">
                Perlu Koreksi Guru: {pendingEssayCount} Jawaban Esai Kuis Menunggu Penilaian
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Siswa telah selesai mengerjakan kuis. Nilai rubrik guru diperlukan sebelum skor akhir diterbitkan.
              </p>
            </div>
          </div>
          <Link
            href="/quiz"
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-eduAmber hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all flex-shrink-0"
          >
            Buka Lembar Koreksi
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 1. AKTIVITAS HARI INI (DAILY TEACHING WORKSPACE COMPONENT) */}
      <div className="card-os rounded-2xl p-6 space-y-4 border-l-4 border-l-navy bg-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-navy text-white flex-shrink-0 shadow-xs">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-eduGreen-soft text-eduGreen border border-eduGreen-border px-2.5 py-0.5 rounded text-[11px] font-bold">
                  {activeSession ? "SESI MENGAJAR" : "SIAP MENGAJAR"}
                </span>
                <span className="text-xs font-bold text-navy">
                  {activeSession ? "Hari Ini" : "Jadwal Siap"}
                </span>
                {activeSession && (
                  <span className="text-xs text-muted-foreground">
                    • {activeSession.teachingContext.class.name}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-heading font-bold text-navy-dark mt-1">
                {activeSession 
                  ? `${activeSession.teachingContext.subject.name} — ${activeSession.teachingContext.class.name}`
                  : (teachingContexts[0] ? `${teachingContexts[0].subject.name} — ${teachingContexts[0].class.name}` : "Belum Ada Sesi Aktif")}
              </h2>
              <div className="text-xs text-slate-600 mt-0.5">
                {activeSession?.plannedTopic 
                  ? `Topik: ${activeSession.plannedTopic}` 
                  : (activeSession?.actualTopic ? `Topik: ${activeSession.actualTopic}` : "Siapkan bahan ajar, slide presentasi, atau kuis kelas dengan AI.")}
              </div>
            </div>
          </div>

          {/* STATUS KESIAPAN MATERI (CHECKLIST RAMAH TANPA PERSENTASE) */}
          <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-eduGreen-soft text-eduGreen border border-eduGreen-border px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Modul Ajar Siap
              </span>
              <span className="bg-eduGreen-soft text-eduGreen border border-eduGreen-border px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Kuis Tersedia
              </span>
            </div>

            {/* AKSI CEPAT LANGSUNG */}
            <div className="flex items-center gap-2 w-full sm:w-auto pt-1">
              <Link
                href="/ai-studio?flow=PRESENTATION"
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold bg-ai-soft text-ai border border-ai-border hover:bg-purple-100 flex items-center justify-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-ai" />
                ✨ Buat Slide PPT
              </Link>
              <Link
                href="/hari-ini"
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold bg-navy hover:bg-navy-light text-white flex items-center justify-center gap-1.5 shadow-xs transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                Mulai Mengajar
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 2. QUICK CREATE AI (PILIHAN CEPAT TANPA PROMPT KOSONG) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-ai" />
            Quick Create AI (Asisten Guru)
          </h2>
          <span className="text-[11px] text-muted-foreground">Pilih kebutuhan, AI langsung siapkan sesuai kurikulum</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          
          <Link
            href="/ai-studio?flow=PRESENTATION"
            className="card-os rounded-2xl p-4 hover:border-ai hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-32 bg-white"
          >
            <div className="w-9 h-9 rounded-xl bg-ai-soft text-ai flex items-center justify-center group-hover:scale-110 transition-transform">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-navy-dark group-hover:text-ai transition-colors">Buat PPT</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Slide tayang presentasi</p>
            </div>
          </Link>

          <Link
            href="/ai-studio?flow=ASSESSMENT_QUIZ"
            className="card-os rounded-2xl p-4 hover:border-ai hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-32 bg-white"
          >
            <div className="w-9 h-9 rounded-xl bg-ai-soft text-ai flex items-center justify-center group-hover:scale-110 transition-transform">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-navy-dark group-hover:text-ai transition-colors">Buat Soal & Kuis</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Pilihan ganda & esai</p>
            </div>
          </Link>

          <Link
            href="/ai-studio?flow=LESSON_PLAN"
            className="card-os rounded-2xl p-4 hover:border-ai hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-32 bg-white"
          >
            <div className="w-9 h-9 rounded-xl bg-ai-soft text-ai flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-navy-dark group-hover:text-ai transition-colors">Buat Modul Ajar</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Kurikulum Merdeka</p>
            </div>
          </Link>

          <Link
            href="/ai-studio?flow=LKPD"
            className="card-os rounded-2xl p-4 hover:border-ai hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-32 bg-white"
          >
            <div className="w-9 h-9 rounded-xl bg-ai-soft text-ai flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-navy-dark group-hover:text-ai transition-colors">Buat LKPD</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Lembar kerja siswa</p>
            </div>
          </Link>

          <Link
            href="/ai-studio?flow=LEARNING_MATERIAL"
            className="card-os rounded-2xl p-4 hover:border-ai hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-32 col-span-2 sm:col-span-1 bg-white"
          >
            <div className="w-9 h-9 rounded-xl bg-ai-soft text-ai flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-navy-dark group-hover:text-ai transition-colors">Bahan Ajar</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Bahan bacaan & materi</p>
            </div>
          </Link>

        </div>
      </div>

      {/* DUA KOLOM: 3. LANJUTKAN PEKERJAAN & 4. RINGKASAN KELAS SAYA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KOLOM KIRI: LANJUTKAN PEKERJAAN DRAFTS (7 COLS) */}
        <div className="lg:col-span-7 card-os rounded-2xl p-6 space-y-4 bg-white">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-navy" />
              <h3 className="font-heading font-bold text-sm text-navy-dark">Lanjutkan Pekerjaan Terakhir</h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {recentDrafts.length > 0 ? `${recentDrafts.length} Draft Tersimpan` : "Belum ada draft"}
            </span>
          </div>

          <div className="space-y-3">
            {recentDrafts.length > 0 ? (
              recentDrafts.map((draft) => (
                <div 
                  key={draft.id}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-ai-soft text-ai flex items-center justify-center font-bold text-xs border border-ai-border">
                      {draft.contentType === "LEARNING_MATERIAL" ? "MAT" : draft.contentType === "LESSON_PLAN" ? "RPP" : "AI"}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-navy-dark line-clamp-1">{draft.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {draft.teachingContext ? `${draft.teachingContext.class.name} • ` : ""}
                        {new Date(draft.updatedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/ai-studio"
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-navy-dark text-xs font-bold flex-shrink-0"
                  >
                    Buka &rarr;
                  </Link>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Belum ada draft perangkat ajar. Klik tombol di atas untuk membuat modul ajar atau slide PPT baru.
              </div>
            )}
          </div>
        </div>

        {/* KOLOM KANAN: RINGKASAN KELAS SAYA (5 COLS) */}
        <div className="lg:col-span-5 card-os rounded-2xl p-6 space-y-4 bg-white">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-navy" />
              <h3 className="font-heading font-bold text-sm text-navy-dark">Ringkasan Kelas Saya</h3>
            </div>
            <Link href="/kelas" className="text-xs font-bold text-ai hover:underline">
              Semua Kelas &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {teachingContexts.slice(0, 3).map((tc) => (
              <Link
                key={tc.id}
                href={`/kelas/${tc.id}`}
                className="block p-3.5 rounded-xl border border-slate-200 hover:border-navy hover:bg-slate-50/50 transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-navy-dark">
                    {tc.class.name} ({tc.subject.name})
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {tc.academicPeriod.year}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="bg-eduGreen-soft text-eduGreen border border-eduGreen-border px-2 py-0.5 rounded text-[10px] font-bold">
                    Kelas Aktif
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Buka presensi & nilai &rarr;
                  </span>
                </div>
              </Link>
            ))}

            {teachingContexts.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground">
                Belum ada kelas yang terhubung. Buka menu Kelas Saya untuk mulai mendaftarkan kelas.
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
