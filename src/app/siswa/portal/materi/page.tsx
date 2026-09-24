import React from "react";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { getPublishedMaterialsAction } from "@/modules/student-portal/student-materi.actions";
import { BookOpen, Calendar } from "lucide-react";

/**
 * Story 8 — daftar materi LEARNING_MATERIAL published untuk rombel
 * periode aktif siswa. Filter (non-publish, non-LEARNING_MATERIAL, ARCHIVED,
 * konteks rombel lain) hidup di `getPublishedMaterialsAction` — satu sumber
 * kebenaran bersama int test.
 */
export default async function StudentMateriPage() {
  const session = await verifyStudentSession();
  if (!session) return null;

  const res = await getPublishedMaterialsAction();
  const materials = res.success ? (res.materials ?? []) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-[#0F766E]" />
          <span>Materi dari Guru</span>
        </h1>
        <p className="text-[11px] text-slate-500">
          Materi ajar yang dipublikasikan guru untuk rombelmu.
        </p>
      </div>

      {!res.success ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            Gagal memuat materi — tarik ulang halaman sebentar lagi.
          </p>
        </div>
      ) : materials.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 text-center">
          <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            Belum ada materi yang dipublikasikan guru untuk rombelmu.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((m) => (
            <details
              key={m.id}
              className="group rounded-2xl border border-slate-200 bg-white/80 overflow-hidden"
            >
              <summary className="cursor-pointer select-none p-4 list-none">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-slate-900 truncate">{m.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {m.subjectName ?? "Mata pelajaran"} — {m.teacherName ?? "Guru"}
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-400 flex items-center gap-1 shrink-0 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(m.publishedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-teal-700 mt-1.5 inline-block group-open:hidden">
                  Buka materi ↓
                </span>
              </summary>
              <div className="border-t border-slate-100 bg-slate-50/70 p-4 max-h-[60vh] overflow-y-auto">
                <article className="text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {m.content}
                </article>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
