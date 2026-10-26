"use client";

import { useState } from "react";
import {
  BugReportCategory,
  BugReportPriority,
  BugReportStatus,
} from "@prisma/client";
import {
  Search,
  Filter,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getBugReportsAdminAction,
  updateBugReportAdminAction,
} from "@/modules/bug-reports/bug-report.actions";
import { toast } from "sonner";

interface BugItem {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: BugReportCategory;
  status: BugReportStatus;
  priority: BugReportPriority;
  pageUrl: string | null;
  deviceInfo: string | null;
  reporterEmail: string | null;
  adminNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

export function AdminBugTicketsClient({
  initialData,
}: {
  initialData: { items: any[]; total: number; page: number; totalPages: number };
}) {
  const [items, setItems] = useState<BugItem[]>(initialData.items);
  const [total, setTotal] = useState(initialData.total);
  const [isLoading, setIsLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Selected for detail modal
  const [selectedTicket, setSelectedTicket] = useState<BugItem | null>(null);
  const [editStatus, setEditStatus] = useState<BugReportStatus>(BugReportStatus.OPEN);
  const [editPriority, setEditPriority] = useState<BugReportPriority>(
    BugReportPriority.MEDIUM
  );
  const [adminNotes, setAdminNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const res = await getBugReportsAdminAction({
        search: search.trim() || undefined,
        status: statusFilter !== "ALL" ? (statusFilter as BugReportStatus) : undefined,
        category:
          categoryFilter !== "ALL"
            ? (categoryFilter as BugReportCategory)
            : undefined,
        limit: 50,
      });

      if (res.success && res.data) {
        setItems(res.data.items);
        setTotal(res.data.total);
      } else {
        toast.error(res.error || "Gagal memuat data tiket.");
      }
    } catch {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  const openDetail = (ticket: BugItem) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setAdminNotes(ticket.adminNotes || "");
  };

  const handleUpdate = async () => {
    if (!selectedTicket) return;
    setIsUpdating(true);
    try {
      const res = await updateBugReportAdminAction(selectedTicket.id, {
        status: editStatus,
        priority: editPriority,
        adminNotes: adminNotes.trim() || null,
      });

      if (res.success && res.data) {
        toast.success("Status tiket berhasil diperbarui.");
        setSelectedTicket(null);
        await fetchTickets();
      } else {
        toast.error(res.error || "Gagal memperbarui tiket.");
      }
    } catch {
      toast.error("Terjadi kesalahan update.");
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: BugReportStatus) => {
    switch (status) {
      case BugReportStatus.OPEN:
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            OPEN
          </Badge>
        );
      case BugReportStatus.IN_PROGRESS:
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            IN PROGRESS
          </Badge>
        );
      case BugReportStatus.RESOLVED:
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            RESOLVED
          </Badge>
        );
      case BugReportStatus.CLOSED:
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
            CLOSED
          </Badge>
        );
    }
  };

  const getPriorityBadge = (priority: BugReportPriority) => {
    switch (priority) {
      case BugReportPriority.CRITICAL:
        return <span className="text-xs font-bold text-rose-600">CRITICAL</span>;
      case BugReportPriority.HIGH:
        return <span className="text-xs font-semibold text-orange-600">HIGH</span>;
      case BugReportPriority.MEDIUM:
        return <span className="text-xs text-slate-600">MEDIUM</span>;
      case BugReportPriority.LOW:
        return <span className="text-xs text-slate-400">LOW</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchTickets()}
            placeholder="Cari tiket, judul, email..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              if (val) setStatusFilter(val);
            }}
          >
            <SelectTrigger className="h-9 text-xs w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Status</SelectItem>
              <SelectItem value={BugReportStatus.OPEN}>OPEN</SelectItem>
              <SelectItem value={BugReportStatus.IN_PROGRESS}>IN PROGRESS</SelectItem>
              <SelectItem value={BugReportStatus.RESOLVED}>RESOLVED</SelectItem>
              <SelectItem value={BugReportStatus.CLOSED}>CLOSED</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={categoryFilter}
            onValueChange={(val) => {
              if (val) setCategoryFilter(val);
            }}
          >
            <SelectTrigger className="h-9 text-xs w-[140px]">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Kategori</SelectItem>
              <SelectItem value={BugReportCategory.FEATURE_ERROR}>Error Fitur</SelectItem>
              <SelectItem value={BugReportCategory.UI_UX}>UI/UX</SelectItem>
              <SelectItem value={BugReportCategory.AI_AGENT}>Klassa Agent</SelectItem>
              <SelectItem value={BugReportCategory.AUTHENTICATION}>Auth</SelectItem>
              <SelectItem value={BugReportCategory.PERFORMANCE}>Performa</SelectItem>
              <SelectItem value={BugReportCategory.OTHER}>Lainnya</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchTickets}
            disabled={isLoading}
            className="h-9 text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Terapkan</span>
          </Button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Total Tiket: {total}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Tidak ada tiket kendala yang cocok.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {items.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => openDetail(ticket)}
                className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                      {ticket.ticketNumber}
                    </span>
                    {getStatusBadge(ticket.status)}
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {ticket.category}
                    </span>
                    {getPriorityBadge(ticket.priority)}
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {ticket.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {ticket.description}
                  </p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span>
                      Pelapor:{" "}
                      <strong className="text-slate-600 dark:text-slate-300 font-medium">
                        {ticket.user?.email || ticket.reporterEmail || "Anonim"}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(ticket.createdAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="sm:text-right shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-teal-600">
                    Tinjau Tiket
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Detail & Update Tiket */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400">
                    {selectedTicket.ticketNumber}
                  </span>
                  <span>•</span>
                  <span>{selectedTicket.category}</span>
                </div>
                <DialogTitle className="text-base font-bold pt-1">
                  {selectedTicket.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Dilaporkan oleh {selectedTicket.user?.email || selectedTicket.reporterEmail || "Anonim"} pada{" "}
                  {new Date(selectedTicket.createdAt).toLocaleString("id-ID")}
                </DialogDescription>
              </DialogHeader>

              {/* Rincian Error */}
              <div className="space-y-2 rounded-lg bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200/60 dark:border-slate-800 text-xs">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Deskripsi Masalah:
                  </span>
                  <p className="whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                    {selectedTicket.description}
                  </p>
                </div>

                {selectedTicket.pageUrl && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                      URL Halaman Saat Kejadian:
                    </span>
                    <a
                      href={selectedTicket.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 break-all"
                    >
                      {selectedTicket.pageUrl}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}

                {selectedTicket.deviceInfo && (
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                      Device Info / User Agent:
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono break-all">
                      {selectedTicket.deviceInfo}
                    </span>
                  </div>
                )}
              </div>

              {/* Form Update Status & Catatan Superadmin */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Tindakan Penanganan Admin
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 dark:text-slate-400">
                      Ubah Status
                    </label>
                    <Select
                      value={editStatus}
                      onValueChange={(val) => setEditStatus(val as BugReportStatus)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={BugReportStatus.OPEN}>OPEN</SelectItem>
                        <SelectItem value={BugReportStatus.IN_PROGRESS}>
                          IN PROGRESS
                        </SelectItem>
                        <SelectItem value={BugReportStatus.RESOLVED}>
                          RESOLVED
                        </SelectItem>
                        <SelectItem value={BugReportStatus.CLOSED}>
                          CLOSED
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 dark:text-slate-400">
                      Tingkat Prioritas
                    </label>
                    <Select
                      value={editPriority}
                      onValueChange={(val) =>
                        setEditPriority(val as BugReportPriority)
                      }
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={BugReportPriority.LOW}>LOW</SelectItem>
                        <SelectItem value={BugReportPriority.MEDIUM}>
                          MEDIUM
                        </SelectItem>
                        <SelectItem value={BugReportPriority.HIGH}>
                          HIGH
                        </SelectItem>
                        <SelectItem value={BugReportPriority.CRITICAL}>
                          CRITICAL
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-600 dark:text-slate-400">
                    Catatan Internal / Resolusi Fix
                  </label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Contoh: Fixed di commit 417be8d, bug disebabkan race condition pada..."
                    className="text-xs min-h-[80px]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTicket(null)}
                    disabled={isUpdating}
                    className="text-xs h-8"
                  >
                    Tutup
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="text-xs h-8 gap-1.5"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <span>Simpan Perubahan</span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
