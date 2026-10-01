"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Lock,
  Send,
  TimerReset,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { submitAssignmentAction } from "@/modules/student-portal/student-submission.actions";
import type { StudentSubmissionView } from "@/modules/assignments/submission.service";

interface Props {
  assignmentId: string;
  dueDateIso: string | null;
  submission: StudentSubmissionView | null;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SubmitAssignmentForm({ assignmentId, dueDateIso, submission }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(submission?.textContent ?? "");
  const [link, setLink] = useState(submission?.linkUrl ?? "");
  const [pending, setPending] = useState(false);
  const [current, setCurrent] = useState<StudentSubmissionView | null>(submission);

  const locked = current?.status === "REVIEWED";

  async function handleSubmit() {
    if (pending) return;
    setPending(true);
    try {
      const res = await submitAssignmentAction(assignmentId, {
        textContent: text,
        linkUrl: link,
      });
      if (res.success && res.submission) {
        // isLate dihitung server (jam server vs dueDate) — jangan override pakai jam browser
        setCurrent(res.submission);
        setOpen(false);
        toast.success("Jawaban terkirim", {
          description: res.submission.isLate
            ? "Terkirim setelah batas waktu — ditandai terlambat."
            : "Menunggu koreksi guru.",
        });
      } else {
        toast.error(res.error ?? "Gagal menyimpan jawaban");
      }
    } catch {
      // Network/unexpected throw — jangan biarkan rejection tanpa feedback
      toast.error("Gagal mengirim — periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }

  if (locked) {
    return (
      <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Sudah dinilai{current?.score != null ? ` — skor ${current.score}` : ""}
        </div>
        {current?.feedback && (
          <div className="rounded-lg bg-white border border-emerald-100 p-2.5">
            <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">
              Umpan balik guru
            </p>
            <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">
              {current.feedback}
            </p>
          </div>
        )}
        <p className="text-[9px] text-slate-400 flex items-center gap-1">
          <Lock className="w-2.5 h-2.5" /> Jawaban terkunci — hubungi guru untuk revisi.
        </p>
      </div>
    );
  }

  if (current && !open) {
    return (
      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
            <TimerReset className="w-3.5 h-3.5" /> Terkirim {fmtDateTime(current.submittedAt)}
          </span>
          {current.isLate && (
            <span className="text-[9px] font-extrabold uppercase text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
              Terlambat
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(true)}
          className="text-[10px] font-bold text-teal-700 flex items-center gap-1 hover:underline"
        >
          <Edit3 className="w-3 h-3" /> Ubah jawaban (sebelum dinilai)
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-white text-[11px] font-bold py-2 hover:bg-teal-700 active:scale-[0.99] transition"
        >
          <Send className="w-3.5 h-3.5" /> Kumpulkan Tugas
        </button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500">Jawaban Tugas</span>
            <button onClick={() => setOpen(false)} aria-label="Tutup form">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tulis jawabanmu di sini…"
            rows={4}
            maxLength={10000}
            className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[11px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
          />
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="atau tautan jawaban (https://…)"
              inputMode="url"
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
          </div>
          {dueDateIso && (
            <p className="text-[9px] text-slate-400 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              Batas {fmtDateTime(dueDateIso)} — terlambat tetap bisa dikirim.
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={pending}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-white text-[11px] font-bold py-2 hover:bg-teal-700 disabled:opacity-60 transition"
          >
            <Send className="w-3.5 h-3.5" />
            {pending ? "Mengirim…" : current ? "Perbarui Jawaban" : "Kirim Jawaban"}
          </button>
        </div>
      )}
    </div>
  );
}
