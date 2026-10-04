"use client";

import React, { useState } from "react";
import {
  X,
  Settings,
  Sparkles,
  RotateCcw,
  Check,
  MessageSquare,
  Cpu,
  BookOpen,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  CommunicationTone,
  TeacherMemoryDTO,
  AllowedAgentModelId,
} from "@/modules/agent/memory/agent-memory.types";
import {
  updateTeacherAgentMemoryAction,
  resetTeacherAgentMemoryAction,
} from "@/modules/agent/memory/agent-memory.actions";
import { AVAILABLE_AGENT_MODELS } from "@/modules/agent/agent.config";

interface AgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMemory?: TeacherMemoryDTO;
  onMemoryUpdated?: (updated: TeacherMemoryDTO) => void;
}

export function AgentSettingsModal({
  isOpen,
  onClose,
  initialMemory,
  onMemoryUpdated,
}: AgentSettingsModalProps) {
  const [tone, setTone] = useState<CommunicationTone>(
    initialMemory?.communicationTone || "RAMAH_SOPAN"
  );
  const [model, setModel] = useState<AllowedAgentModelId>(
    (initialMemory?.preferredModel as AllowedAgentModelId) || "gemini-3.5-flash"
  );
  const [curriculum, setCurriculum] = useState<string>(
    initialMemory?.pedagogyDefaults?.curriculumFocus || "Kurikulum Merdeka"
  );
  const [customContext, setCustomContext] = useState<string>(
    initialMemory?.customContext || ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateTeacherAgentMemoryAction({
        communicationTone: tone,
        preferredModel: model,
        pedagogyDefaults: {
          curriculumFocus: curriculum,
        },
        customContext: customContext.trim() ? customContext.trim() : null,
      });

      if (res.success && res.data) {
        toast.success(res.message);
        onMemoryUpdated?.(res.data);
        onClose();
      } else {
        toast.error(res.message || res.error || "Gagal menyimpan preferensi.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Kesalahan koneksi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Apakah Anda yakin ingin mereset memori dan gaya asisten ke setelan awal pabrik?")) {
      return;
    }

    setIsResetting(true);
    try {
      const res = await resetTeacherAgentMemoryAction();
      if (res.success && res.data) {
        setTone(res.data.communicationTone);
        setModel(res.data.preferredModel as AllowedAgentModelId);
        setCurriculum(res.data.pedagogyDefaults.curriculumFocus || "Kurikulum Merdeka");
        setCustomContext("");
        toast.success(res.message);
        onMemoryUpdated?.(res.data);
      } else {
        toast.error(res.message || res.error || "Gagal mereset memori.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Kesalahan sistem.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 border border-teal-100">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Pengaturan Klassa Agent</h3>
              <p className="text-xs text-slate-500">Personalisasi gaya respon & memori asisten Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-4 space-y-5">
          {/* 1. Gaya Komunikasi */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              <MessageSquare className="h-4 w-4 text-teal-600" />
              Gaya Komunikasi Asisten
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  id: "RAMAH_SOPAN",
                  title: "Ramah & Santun",
                  desc: "Hangat, suportif & empatik",
                },
                {
                  id: "LUGAS_RINGKAS",
                  title: "Lugas & Ringkas",
                  desc: "Padat & to the point",
                },
                {
                  id: "FORMAL",
                  title: "Formal Kedinasan",
                  desc: "Baku & akademik",
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTone(item.id as CommunicationTone)}
                  className={`flex flex-col text-left p-3 rounded-2xl border transition-all ${
                    tone === item.id
                      ? "border-teal-600 bg-teal-50/60 shadow-xs ring-1 ring-teal-600"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    {item.title}
                    {tone === item.id && <Check className="h-3.5 w-3.5 text-teal-600" />}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Pilihan Model AI */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              <Cpu className="h-4 w-4 text-teal-600" />
              Model AI Default
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as AllowedAgentModelId)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
            >
              {AVAILABLE_AGENT_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.description}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Fokus Kurikulum */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              <BookOpen className="h-4 w-4 text-teal-600" />
              Fokus Kurikulum
            </label>
            <input
              type="text"
              value={curriculum}
              onChange={(e) => setCurriculum(e.target.value)}
              placeholder="Contoh: Kurikulum Merdeka Mandiri Berbagi"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {/* 4. Catatan Kustom Guru */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
                <Sparkles className="h-4 w-4 text-teal-600" />
                Catatan Pribadi Ajar (Memori Tambahan)
              </label>
              <span className="text-[11px] text-slate-400">{customContext.length}/2000</span>
            </div>
            <textarea
              rows={3}
              maxLength={2000}
              value={customContext}
              onChange={(e) => setCustomContext(e.target.value)}
              placeholder="Contoh: Saya wali kelas 7B. Sebagian besar murid menyukai penjelasan dengan ilustrasi visual dan analogi cerita nyata."
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting || isSaving}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
          >
            {isResetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Reset Ingatan
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isResetting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isResetting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Simpan Pengaturan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
