"use client";

import React, { useState, useTransition } from "react";
import {
  Sparkles,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  AcademicPlanItemData,
  PlanItemCategory,
  WeeklyDistributionSlot,
} from "@/modules/academic/academic.types";
import { bulkSaveAcademicPlan } from "@/modules/academic/academic.actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Props {
  teachingContextId: string;
  initialItems: AcademicPlanItemData[];
  hoursPerWeek?: number;
  effectiveWeeksSem1?: number;
  effectiveWeeksSem2?: number;
  onOpenWizard: () => void;
  onExportExcel?: (semester: number) => void;
  onExportWord?: (semester: number) => void;
}

interface EditableMatrixItem {
  id?: string;
  learningObjectiveId?: string | null;
  category: PlanItemCategory;
  title: string;
  allocatedHours: number;
  notes?: string | null;
  weeklyDistribution: WeeklyDistributionSlot[];
}

export function InteractiveProsemGrid({
  teachingContextId,
  initialItems,
  hoursPerWeek = 3,
  effectiveWeeksSem1 = 18,
  effectiveWeeksSem2 = 16,
  onOpenWizard,
  onExportExcel,
  onExportWord,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedSemester, setSelectedSemester] = useState<number>(1);

  // Filter initial items for the current semester
  const semesterItems = initialItems.filter(
    (it) => it.targetSemester === selectedSemester && it.planType === "PROSEM" && it.status === "ACTIVE"
  );

  const [matrixItems, setMatrixItems] = useState<EditableMatrixItem[]>(() =>
    semesterItems.map((it) => ({
      id: it.id,
      learningObjectiveId: it.learningObjectiveId,
      category: it.category || PlanItemCategory.REGULAR_MATERIAL,
      title: it.title,
      allocatedHours: it.allocatedHours || hoursPerWeek,
      notes: it.notes,
      weeklyDistribution: (it.weeklyDistribution as unknown as WeeklyDistributionSlot[]) || [],
    }))
  );

  // Sync state if semester changes or initialItems reload
  React.useEffect(() => {
    const filtered = initialItems.filter(
      (it) => it.targetSemester === selectedSemester && it.planType === "PROSEM" && it.status === "ACTIVE"
    );
    setMatrixItems(
      filtered.map((it) => ({
        id: it.id,
        learningObjectiveId: it.learningObjectiveId,
        category: it.category || PlanItemCategory.REGULAR_MATERIAL,
        title: it.title,
        allocatedHours: it.allocatedHours || hoursPerWeek,
        notes: it.notes,
        weeklyDistribution: (it.weeklyDistribution as unknown as WeeklyDistributionSlot[]) || [],
      }))
    );
  }, [selectedSemester, initialItems, hoursPerWeek]);

  // Calculation parameters
  const effWeeks = selectedSemester === 1 ? effectiveWeeksSem1 : effectiveWeeksSem2;
  const targetTotalHours = effWeeks * hoursPerWeek;
  const currentTotalHours = matrixItems.reduce((acc, item) => acc + (item.allocatedHours || 0), 0);
  const diffHours = targetTotalHours - currentTotalHours;
  const isBalanced = diffHours === 0;

  // Month structure for the semester
  const months =
    selectedSemester === 1
      ? [
          { number: 7, name: "Juli" },
          { number: 8, name: "Agustus" },
          { number: 9, name: "September" },
          { number: 10, name: "Oktober" },
          { number: 11, name: "November" },
          { number: 12, name: "Desember" },
        ]
      : [
          { number: 1, name: "Januari" },
          { number: 2, name: "Februari" },
          { number: 3, name: "Maret" },
          { number: 4, name: "April" },
          { number: 5, name: "Mei" },
          { number: 6, name: "Juni" },
        ];

  const weeks = [1, 2, 3, 4, 5];

  // Cell Toggle Handler
  const handleCellClick = (itemIndex: number, month: number, week: number) => {
    setMatrixItems((prev) => {
      const copy = [...prev];
      const targetItem = { ...copy[itemIndex] };
      const currentDist = [...targetItem.weeklyDistribution];
      const existingSlotIndex = currentDist.findIndex((s) => s.month === month && s.week === week);

      if (existingSlotIndex >= 0) {
        // Remove slot
        currentDist.splice(existingSlotIndex, 1);
      } else {
        // Add slot
        currentDist.push({ month, week, hours: hoursPerWeek });
      }

      // Re-calculate allocated hours from distribution if any
      const totalFromSlots = currentDist.reduce((acc, s) => acc + s.hours, 0);
      targetItem.weeklyDistribution = currentDist;
      if (totalFromSlots > 0) {
        targetItem.allocatedHours = totalFromSlots;
      }
      copy[itemIndex] = targetItem;
      return copy;
    });
  };

  // Update Title Inline
  const handleTitleChange = (itemIndex: number, newTitle: string) => {
    setMatrixItems((prev) => {
      const copy = [...prev];
      copy[itemIndex] = { ...copy[itemIndex], title: newTitle };
      return copy;
    });
  };

  // Update Allocated Hours Inline
  const handleHoursChange = (itemIndex: number, newHours: number) => {
    setMatrixItems((prev) => {
      const copy = [...prev];
      copy[itemIndex] = { ...copy[itemIndex], allocatedHours: Math.max(1, newHours) };
      return copy;
    });
  };

  // Add Item Row
  const handleAddItem = (category: PlanItemCategory = PlanItemCategory.REGULAR_MATERIAL) => {
    const title =
      category === PlanItemCategory.STS
        ? "Sumatif Tengah Semester (STS)"
        : category === PlanItemCategory.SAS
        ? selectedSemester === 1
          ? "Sumatif Akhir Semester (SAS)"
          : "Sumatif Akhir Tahun (SAT)"
        : `Materi Pokok Baru (Bab ${matrixItems.length + 1})`;

    setMatrixItems((prev) => [
      ...prev,
      {
        category,
        title,
        allocatedHours: hoursPerWeek,
        weeklyDistribution: [],
      },
    ]);
  };

  // Remove Item Row
  const handleRemoveItem = (index: number) => {
    setMatrixItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Save All Changes to Database
  const handleSaveMatrix = () => {
    startTransition(async () => {
      try {
        const res = await bulkSaveAcademicPlan({
          teachingContextId,
          planType: "PROSEM",
          targetSemester: selectedSemester,
          items: matrixItems.map((it) => ({
            id: it.id,
            learningObjectiveId: it.learningObjectiveId,
            category: it.category,
            title: it.title,
            allocatedHours: it.allocatedHours,
            notes: it.notes,
            weeklyDistribution: it.weeklyDistribution,
          })),
        });

        if (res.success) {
          toast.success("Matriks Program Semester (PROSEM) berhasil disimpan!");
          router.refresh();
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan matriks.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border">
        {/* Semester & Load Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg bg-background p-1 border shadow-xs">
            <button
              onClick={() => setSelectedSemester(1)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedSemester === 1
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semester Ganjil (Juli - Des)
            </button>
            <button
              onClick={() => setSelectedSemester(2)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedSemester === 2
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semester Genap (Jan - Juni)
            </button>
          </div>

          <Badge variant="outline" className="text-xs font-medium py-1 px-2.5">
            Beban: {hoursPerWeek} JP/minggu • {effWeeks} Pekan Efektif
          </Badge>
        </div>

        {/* Balance & Status Indicator */}
        <div className="flex items-center gap-2">
          {isBalanced ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 py-1.5 px-3">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {currentTotalHours} / {targetTotalHours} JP (Seimbang)
            </Badge>
          ) : diffHours > 0 ? (
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 flex items-center gap-1 py-1.5 px-3">
              <AlertTriangle className="h-3.5 w-3.5" />
              {currentTotalHours} / {targetTotalHours} JP (Kurang {diffHours} JP)
            </Badge>
          ) : (
            <Badge variant="destructive" className="flex items-center gap-1 py-1.5 px-3">
              <AlertTriangle className="h-3.5 w-3.5" />
              {currentTotalHours} / {targetTotalHours} JP (Kelebihan {Math.abs(diffHours)} JP)
            </Badge>
          )}

          {matrixItems.length > 0 && (
            <Button
              size="sm"
              onClick={onOpenWizard}
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5 shadow-xs text-xs font-semibold"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Susun Ulang via AI</span>
            </Button>
          )}
        </div>
      </div>

      {/* Interactive Helper Tip */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3.5 py-2.5 rounded-xl border border-border/60">
        <Info className="h-4 w-4 text-primary shrink-0" />
        <span>
          <strong>Tip Interaktif:</strong> Klik langsung kotak-kotak kalender di bawah untuk mengaktifkan atau mengosongkan jam mengajar ({hoursPerWeek} JP/pekan). Judul materi dan jam juga dapat diubah langsung pada tabel.
        </span>
      </div>

      {/* Empty State */}
      {matrixItems.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="font-semibold text-lg">Belum Ada Program Semester Terjadwal</h3>
            <p className="text-sm text-muted-foreground">
              Buat perencanaan Program Semester (PROSEM) otomatis dalam hitungan detik menggunakan Capaian Pembelajaran atau foto Daftar Isi buku cetak.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={onOpenWizard} className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                Mulai AI Generator
              </Button>
              <Button variant="outline" onClick={() => handleAddItem()}>
                + Tambah Manual
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        /* The Interactive Matrix Grid */
        <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              {/* Table Header with Month Spans */}
              <thead>
                <tr className="bg-muted/70 border-b text-foreground font-semibold">
                  <th className="p-2.5 w-10 text-center border-r">No</th>
                  <th className="p-2.5 min-w-[260px] border-r">Materi Pokok / Capaian TP</th>
                  <th className="p-2.5 w-16 text-center border-r">Alokasi (JP)</th>
                  {months.map((m) => (
                    <th key={m.number} colSpan={5} className="p-2 text-center border-r bg-muted/90 uppercase tracking-wider font-bold">
                      {m.name}
                    </th>
                  ))}
                  <th className="p-2.5 w-12 text-center">Aksi</th>
                </tr>
                {/* Week Sub-headers (1-5 for each month) */}
                <tr className="bg-muted/40 border-b text-[10px] text-muted-foreground text-center font-mono">
                  <th className="border-r"></th>
                  <th className="border-r"></th>
                  <th className="border-r"></th>
                  {months.map((m) =>
                    weeks.map((w) => (
                      <th key={`${m.number}-${w}`} className="p-1 w-7 border-r">
                        {w}
                      </th>
                    ))
                  )}
                  <th></th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-border">
                {matrixItems.map((item, idx) => {
                  const isSts = item.category === PlanItemCategory.STS;
                  const isSas = item.category === PlanItemCategory.SAS;
                  const isAssessment = isSts || isSas;

                  return (
                    <tr
                      key={item.id || idx}
                      className={`hover:bg-muted/20 transition-colors ${
                        isAssessment ? "bg-amber-500/5 dark:bg-amber-500/10 font-medium" : ""
                      }`}
                    >
                      {/* Row Index */}
                      <td className="p-2 text-center font-mono text-muted-foreground border-r">
                        {idx + 1}
                      </td>

                      {/* Title Inline Edit */}
                      <td className="p-1.5 border-r">
                        <div className="flex items-center gap-1.5">
                          {isSts && (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 shrink-0">
                              STS
                            </Badge>
                          )}
                          {isSas && (
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 shrink-0">
                              SAS
                            </Badge>
                          )}
                          <Input
                            value={item.title}
                            onChange={(e) => handleTitleChange(idx, e.target.value)}
                            className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
                          />
                        </div>
                      </td>

                      {/* Allocated Hours Inline Edit */}
                      <td className="p-1.5 text-center border-r">
                        <Input
                          type="number"
                          min="1"
                          value={item.allocatedHours}
                          onChange={(e) => handleHoursChange(idx, parseInt(e.target.value) || 0)}
                          className="h-7 w-14 text-xs text-center font-semibold mx-auto border-transparent hover:border-input focus:border-input bg-transparent"
                        />
                      </td>

                      {/* Month & Week Cells */}
                      {months.map((m) =>
                        weeks.map((w) => {
                          const isFilled = item.weeklyDistribution.some(
                            (s) => s.month === m.number && s.week === w
                          );

                          return (
                            <td
                              key={`${m.number}-${w}`}
                              onClick={() => handleCellClick(idx, m.number, w)}
                              className={`p-0.5 text-center border-r cursor-pointer transition-all group ${
                                isFilled
                                  ? isAssessment
                                    ? "bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-xs"
                                    : "bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs"
                                  : "hover:bg-primary/15 text-transparent hover:text-primary hover:font-bold"
                              }`}
                              title={
                                isFilled
                                  ? `${m.name} Pekan ${w}: Terisi ${hoursPerWeek} JP (Klik untuk mengosongkan)`
                                  : `${m.name} Pekan ${w}: Kosong (Klik untuk isi ${hoursPerWeek} JP)`
                              }
                            >
                              <div className="h-6 flex items-center justify-center text-[11px] font-mono select-none">
                                {isFilled ? hoursPerWeek : <span className="opacity-0 group-hover:opacity-100 font-bold">+</span>}
                              </div>
                            </td>
                          );
                        })
                      )}

                      {/* Row Action */}
                      <td className="p-1.5 text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveItem(idx)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          title="Hapus baris ini"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Matrix Bottom Toolbar */}
          <div className="p-3 bg-muted/30 border-t flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => handleAddItem()} className="h-8 text-xs font-medium">
                <Plus className="h-3.5 w-3.5 mr-1 text-primary" />
                Tambah Bab
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddItem(PlanItemCategory.STS)}
                className="h-8 text-xs text-amber-700 dark:text-amber-400 font-medium"
              >
                + Sisipkan STS (UTS)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddItem(PlanItemCategory.SAS)}
                className="h-8 text-xs text-blue-700 dark:text-blue-400 font-medium"
              >
                + Sisipkan SAS/SAT (UAS)
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {onExportExcel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onExportExcel(selectedSemester)}
                  className="h-8 text-xs flex items-center gap-1"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  Excel (.xlsx)
                </Button>
              )}
              {onExportWord && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onExportWord(selectedSemester)}
                  className="h-8 text-xs flex items-center gap-1"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  Word (.docx)
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSaveMatrix}
                disabled={isPending}
                className="h-8 text-xs flex items-center gap-1.5"
              >
                {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {isPending ? "Menyimpan..." : "Simpan Matriks"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
