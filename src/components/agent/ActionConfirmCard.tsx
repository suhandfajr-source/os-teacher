"use client";

import React, { useState } from "react";
import {
  ClipboardCheck,
  Megaphone,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  executeAgentAction,
  cancelAgentAction,
} from "@/modules/agent/agent-action.actions";

export interface ActionProposalData {
  id: string;
  actionType: "RECORD_ATTENDANCE" | "CREATE_ANNOUNCEMENT" | "CREATE_ASSIGNMENT_DRAFT" | string;
  title?: string;
  summary: string;
  payload?: any;
  status: "PENDING" | "EXECUTED" | "CANCELLED" | "EXPIRED";
  expiresAt?: string | Date;
  createdAt?: string | Date;
}

interface ActionConfirmCardProps {
  proposal: ActionProposalData;
  onExecuted?: (proposalId: string) => void;
  onCancelled?: (proposalId: string) => void;
}

export function ActionConfirmCard({
  proposal,
  onExecuted,
  onCancelled,
}: ActionConfirmCardProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(proposal.status);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const getActionConfig = (type: string) => {
    switch (type) {
      case "RECORD_ATTENDANCE":
        return {
          label: "Pencatatan Kehadiran Rombel",
          icon: ClipboardCheck,
          colorClass: "bg-blue-50 text-blue-700 border-blue-200",
          iconColor: "text-blue-600",
        };
      case "CREATE_ANNOUNCEMENT":
        return {
          label: "Penerbitan Pengumuman Kelas",
          icon: Megaphone,
          colorClass: "bg-purple-50 text-purple-700 border-purple-200",
          iconColor: "text-purple-600",
        };
      case "CREATE_ASSIGNMENT_DRAFT":
        return {
          label: "Penyusunan Draf Tugas Baru",
          icon: FileText,
          colorClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          iconColor: "text-emerald-600",
        };
      default:
        return {
          label: "Proposal Aksi Asisten",
          icon: AlertCircle,
          colorClass: "bg-slate-50 text-slate-700 border-slate-200",
          iconColor: "text-slate-600",
        };
    }
  };

  const config = getActionConfig(proposal.actionType);
  const ActionIcon = config.icon;

  const handleConfirm = async () => {
    if (isLoading || currentStatus !== "PENDING") return;
    setIsLoading(true);

    try {
      const res = await executeAgentAction(proposal.id);
      if (res.success) {
        setCurrentStatus("EXECUTED");
        setActionMessage(res.message);
        toast.success(res.message || "Aksi berhasil dieksekusi!");
        onExecuted?.(proposal.id);
      } else {
        toast.error(res.message || "Gagal mengeksekusi proposal.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (isLoading || currentStatus !== "PENDING") return;
    setIsLoading(true);

    try {
      const res = await cancelAgentAction(proposal.id, "Dibatalkan oleh guru via antarmuka obrolan.");
      if (res.success) {
        setCurrentStatus("CANCELLED");
        setActionMessage("Aksi dibatalkan oleh guru.");
        toast.info("Proposal aksi telah dibatalkan.");
        onCancelled?.(proposal.id);
      } else {
        toast.error(res.message || "Gagal membatalkan proposal.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-testid="action-confirm-card"
      className="mt-3 w-full max-w-lg rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all"
    >
      {/* Header Kartu */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${config.colorClass}`}>
            <ActionIcon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Persetujuan Guru Diperlukan (HITL)
            </span>
            <h4 className="text-sm font-bold text-slate-800">{config.label}</h4>
          </div>
        </div>

        {/* Status Badge */}
        {currentStatus === "PENDING" && (
          <span
            data-testid="badge-pending"
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800"
          >
            <Clock className="h-3 w-3" />
            Menunggu
          </span>
        )}
        {currentStatus === "EXECUTED" && (
          <span
            data-testid="badge-executed"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
          >
            <CheckCircle2 className="h-3 w-3" />
            Dieksekusi
          </span>
        )}
        {currentStatus === "CANCELLED" && (
          <span
            data-testid="badge-cancelled"
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
          >
            <XCircle className="h-3 w-3" />
            Dibatalkan
          </span>
        )}
        {currentStatus === "EXPIRED" && (
          <span
            data-testid="badge-expired"
            className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
          >
            <AlertCircle className="h-3 w-3" />
            Kedaluwarsa
          </span>
        )}
      </div>

      {/* Ringkasan Konten Aksi */}
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 border border-slate-100">
        <p className="font-medium text-slate-900">{proposal.summary}</p>
        {proposal.payload?.title && (
          <p className="mt-1 text-slate-600">
            <span className="font-semibold">Judul:</span> {proposal.payload.title}
          </p>
        )}
        {actionMessage && (
          <p className="mt-2 font-medium text-emerald-700 border-t border-slate-200/60 pt-2">
            ✓ {actionMessage}
          </p>
        )}
      </div>

      {/* Tombol Interaktif (Jika status PENDING) */}
      {currentStatus === "PENDING" && (
        <div className="mt-3.5 flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid="cancel-action-button"
            onClick={handleCancel}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Batalkan
          </button>
          <button
            type="button"
            data-testid="confirm-action-button"
            onClick={handleConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Konfirmasi & Eksekusi
          </button>
        </div>
      )}
    </div>
  );
}
