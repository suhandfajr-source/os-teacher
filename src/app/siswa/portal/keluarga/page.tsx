import React from "react";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { getStudentProgressDataAction } from "@/modules/student-portal/student-progress.actions";
import { prisma } from "@/lib/auth";
import { isSubmissionLate } from "@/modules/assignments/submission.service";
import Link from "next/link";
import { ArrowLeft, Users, BookOpenCheck, ClipboardList, CheckCircle2, TimerReset } from "lucide-react";

/**
 * Story 8 — Mode Keluarga: pantauan read-only untuk orang tua.
 * Semua data dari layanan baca existing (getStudentProgressDataAction)
 * + status tugas/submission — tanpa jalur tulis apa pun.
 */
export default async function KeluargaPage() {
  const session = await verifyStudentSession();
  if (!session) return null;

  const progress = await getStudentProgressDataAction();
  if (!progress.success || !progress.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-xs text-slate-500">Data pantauan belum tersedia saat ini.</p>
      </div>
    );
  }

  const { hasActivePeriod, student, subjects, attendance } = progress.data;

  // Status tugas & submission untuk ringkasan keluarga (read-only)
  const memberships = await prisma.student.findUnique({
    where: { id: session.studentId },
    select: {
      classMemberships: {
        include: { academicPeriod: { select: { status: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  const activeMembership = memberships?.classMemberships.find(
    (cm) => cm.academicPeriod.status === "ACTIVE"
  );

  const assignments = activeMembership
    ? await prisma.assignment.findMany({
        where: {
          status: "ACTIVE",
          teachingContext: {
            classId: activeMembership.classId,
            academicPeriodId: activeMembership.academicPeriodId,
          },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          teachingContext: { select: { subject: { select: { name: true } } } },
          submissions: { where: { studentId: session.studentId } },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const totalHadir = attendance.reduce(
    (acc, m) => acc + m.hadir + m.lateCount + m.sakit + m.izin + m.alpa,
    0
  );

  return (
    <div className="space-y-4 pb-4">
      <BackLink />

      <div className="rounded-3xl bg-gradient-to-br from-[#0F766E] to-[#115E59] text-white p-5 space-y-1">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <h1 className="text-base font-black tracking-tight">Mode Keluarga</h1>
        </div>
        <p className="text-[11px] text-teal-100">
          Pantauan capaian {student.fullName} — {student.className} ({student.academicYear})
        </p>
      </div>

      {!hasActivePeriod ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center">
          <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            Belum ada data rombel periode aktif — pantauan muncul setelah siswa terdaftar.
          </p>
        </div>
      ) : (
        <>
          {/* Ringkasan mapel & nilai berjalan */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <BookOpenCheck className="w-3.5 h-3.5 text-[#0F766E]" /> Nilai per Mata Pelajaran
            </h2>
            {subjects.length === 0 ? (
              <p className="text-[11px] text-slate-400 px-1">Belum ada data mata pelajaran.</p>
            ) : (
              subjects.map((s) => (
                <div
                  key={s.teachingContextId}
                  className="p-3 bg-white rounded-2xl border border-slate-200/80"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">{s.subjectName}</p>
                      <p className="text-[10px] text-slate-500">{s.teacherName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {s.runningScore !== null ? (
                        <p className="text-sm font-black text-teal-700">
                          {s.runningScore.toFixed(1)}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">Belum ada nilai</p>
                      )}
                      <p className="text-[9px] text-slate-400">
                        TP tuntas {s.tpTree.filter((t) => t.status === "TUNTAS").length}/
                        {s.tpTree.length}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Presensi bulanan */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0F766E]" /> Presensi Bulanan
            </h2>
            {attendance.length === 0 ? (
              <p className="text-[11px] text-slate-400 px-1">Belum ada data presensi.</p>
            ) : (
              <div className="p-3 bg-white rounded-2xl border border-slate-200/80">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  {attendance
                    .slice()
                    .reverse()
                    .map((m) => (
                      <div
                        key={`${m.year}-${m.month}`}
                        className="flex items-center justify-between border-b border-slate-50 pb-1"
                      >
                        <span className="text-slate-500">
                          {new Date(m.year, m.month - 1).toLocaleDateString("id-ID", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="font-mono font-bold text-slate-700">
                          H{m.hadir} / L{m.lateCount} / S{sakitShort(m.sakit)} / I{m.izin} / A{m.alpa}
                        </span>
                      </div>
                    ))}
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5">
                  H=Hadir, L=Telat, S=Sakit, I=Izin, A=Alpa — total {totalHadir} catatan
                </p>
              </div>
            )}
          </section>

          {/* Status tugas & pengumpulan */}
          <section className="space-y-2">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-[#0F766E]" /> Status Tugas
            </h2>
            {assignments.length === 0 ? (
              <p className="text-[11px] text-slate-400 px-1">Belum ada tugas aktif.</p>
            ) : (
              assignments.map((a) => {
                const sub = a.submissions[0];
                const late =
                  sub && isSubmissionLate(sub.submittedAt, a.dueDate);
                return (
                  <div
                    key={a.id}
                    className="p-3 bg-white rounded-2xl border border-slate-200/80 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-900 truncate">{a.title}</p>
                        <p className="text-[10px] text-slate-500">{a.teachingContext.subject.name}</p>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                          !sub
                            ? "text-slate-500 bg-slate-50 border-slate-200"
                            : sub.status === "SUBMITTED"
                              ? "text-amber-700 bg-amber-50 border-amber-200"
                              : "text-emerald-700 bg-emerald-50 border-emerald-200"
                        }`}
                      >
                        {!sub ? "Belum dikumpulkan" : sub.status === "SUBMITTED" ? "Menunggu nilai" : "Sudah dinilai"}
                      </span>
                    </div>
                    {sub?.status === "REVIEWED" && (
                      <div className="rounded-lg bg-emerald-50/70 border border-emerald-100 p-2">
                        <p className="text-[10px] text-slate-600 leading-relaxed">
                          <span className="font-bold text-emerald-700">Umpan balik guru:</span>{" "}
                          {sub.feedback}
                          {sub.score != null && (
                            <span className="font-bold text-slate-800"> — Skor {sub.score}</span>
                          )}
                        </p>
                      </div>
                    )}
                    {late && (
                      <p className="text-[9px] font-bold uppercase text-rose-600 flex items-center gap-1">
                        <TimerReset className="w-2.5 h-2.5" /> Terlambat
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </section>
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/siswa/portal/profil"
      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700"
    >
      <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Profil
    </Link>
  );
}

// ponytail: label singkat S — angka besar tak muat di grid mobile; upgrade ke kartu bulanan bila keluhan.
function sakitShort(n: number): string {
  return String(n);
}