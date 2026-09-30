import React from "react";
import { verifyStudentSession } from "@/modules/student-auth/student-session";
import { getPublishedMaterialsAction } from "@/modules/student-portal/student-materi.actions";
import { BookOpen } from "lucide-react";
import { StudentMateriList } from "./StudentMateriList";

/**
 * Story 8 — daftar materi LEARNING_MATERIAL published untuk rombel
 * periode aktif siswa. Mendukung tampilan Slide Carousel interaktif,
 * mode baca bersih, dan unduh berkas PowerPoint (.pptx).
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
        <StudentMateriList materials={materials} />
      )}
    </div>
  );
}
