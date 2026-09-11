"use client";

import React, { useState, useTransition } from "react";
import {
  AiContentType,
  AI_CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  AiDraftStatus,
  TransientAiPreview,
  AiStudioFlowType,
  AI_STUDIO_FLOWS,
} from "@/modules/ai/ai.types";
import {
  generateAiContentAction,
  refineAiContentAction,
  saveAiDraftAction,
  archiveAiDraftAction,
  getAiDraftsAction,
} from "@/modules/ai/ai.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Sparkles,
  BookOpen,
  FileText,
  CheckSquare,
  ListOrdered,
  Save,
  Archive,
  Search,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Eye,
  Sliders,
  History,
  Lock,
  FileSpreadsheet,
  Presentation,
  LayoutTemplate,
  HelpCircle,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { exportAiDocument, ExportFormat } from "@/lib/export";
import { TemplateManagerDialog } from "@/components/templates/TemplateManagerDialog";
import { DocumentTemplateItem } from "@/modules/templates/template.types";
import { listDocumentTemplatesAction } from "@/modules/templates/template.actions";
import { DocumentPreviewModal, PreviewFormat } from "@/components/templates/DocumentPreviewModal";
import { LessonPlanFlow } from "@/components/ai-studio/forms/LessonPlanFlow";
import { AssessmentQuizFlow } from "@/components/ai-studio/forms/AssessmentQuizFlow";
import { LkpdFlow } from "@/components/ai-studio/forms/LkpdFlow";
import { PresentationFlow } from "@/components/ai-studio/forms/PresentationFlow";
import { LearningMaterialFlow } from "@/components/ai-studio/forms/LearningMaterialFlow";
import { RubricFlow } from "@/components/ai-studio/forms/RubricFlow";

interface TeachingContextOption {
  id: string;
  label: string;
  subjectName: string;
  className: string;
  gradeLevel: string | null;
  academicPeriod: string;
}

interface AiDraftItem {
  id: string;
  contentType: AiContentType;
  title: string;
  topic: string;
  instruction?: string | null;
  content: string;
  status: AiDraftStatus;
  modelUsed?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  teachingContext?: {
    id: string;
    class: { name: string };
    subject: { name: string };
    academicPeriod: { year: string; semester: string };
  } | null;
}

interface AiStudioClientProps {
  contexts: TeachingContextOption[];
  initialDrafts: AiDraftItem[];
}

export function AiStudioClient({ contexts, initialDrafts }: AiStudioClientProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"CREATE" | "SAVED">("CREATE");

  // Generator inputs
  const [selectedFlow, setSelectedFlow] = useState<AiStudioFlowType>("LESSON_PLAN");
  const [contentType, setContentType] = useState<AiContentType>("LESSON_PLAN");
  const [selectedContextId, setSelectedContextId] = useState<string>("");
  const [includeHistoricalTopics, setIncludeHistoricalTopics] = useState<boolean>(false);
  const [topic, setTopic] = useState<string>("");
  const [instruction, setInstruction] = useState<string>("");
  const [tone, setTone] = useState<"CONCISE" | "STANDARD" | "DETAILED">("STANDARD");

  // Generator states
  const [isGenerating, startGenerating] = useTransition();
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Active Draft Preview / Editor state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<AiDraftStatus>("ACTIVE");
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [draftContent, setDraftContent] = useState<string>("");
  const [activePreviewInfo, setActivePreviewInfo] = useState<TransientAiPreview | null>(null);
  const [isSavedInDb, setIsSavedInDb] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [previewFormatInitial, setPreviewFormatInitial] = useState<PreviewFormat>("docx");
  const [selectedPreviewTemplateId, setSelectedPreviewTemplateId] = useState<string | null>(null);
  const [editorViewMode, setEditorViewMode] = useState<"EDIT" | "PREVIEW">("EDIT");

  // Refinement state
  const [refinementInstruction, setRefinementInstruction] = useState<string>("");
  const [isRefining, startRefining] = useTransition();
  const [refineError, setRefineError] = useState<string | null>(null);

  // Persistence state
  const [isSaving, startSaving] = useTransition();
  const [isArchiving, startArchiving] = useTransition();

  // Saved drafts list state
  const [draftsList, setDraftsList] = useState<AiDraftItem[]>(initialDrafts);
  const [savedTabStatus, setSavedTabStatus] = useState<AiDraftStatus>("ACTIVE");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterContext, setFilterContext] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoadingDrafts, startLoadingDrafts] = useTransition();

  // Selected context details for visible summary
  const selectedContext = contexts.find((c) => c.id === selectedContextId);

  // --------------------------------------------------------------------------
  // HANDLERS: GENERATION & REFINEMENT
  // --------------------------------------------------------------------------

  const handleSelectFlow = (flowId: AiStudioFlowType) => {
    setSelectedFlow(flowId);
    setContentType(AI_STUDIO_FLOWS[flowId].parentContentType);
  };

  const handleGenerateWithFlow = (
    composedInstruction: string,
    toneChoice: "CONCISE" | "STANDARD" | "DETAILED" = "STANDARD"
  ) => {
    if (!topic.trim()) {
      toast.error("Silakan masukkan topik atau materi pokok");
      return;
    }

    setGenerateError(null);

    startGenerating(async () => {
      const activeParentType = AI_STUDIO_FLOWS[selectedFlow].parentContentType;
      const res = await generateAiContentAction({
        contentType: activeParentType,
        topic: topic.trim(),
        instruction: composedInstruction,
        teachingContextId: selectedContextId || undefined,
        includeHistoricalTopics,
        tone: toneChoice,
      });

      if (!res.success || !res.data) {
        setGenerateError(res.error || "Gagal menghasilkan draf AI. Silakan coba lagi.");
        toast.error(res.error || "Gagal membuat draf AI");
        return;
      }

      // Populate draft editor with transient preview
      setCurrentDraftId(null);
      setDraftStatus("ACTIVE");
      setDraftTitle(res.data.title);
      setDraftContent(res.data.content);
      setActivePreviewInfo(res.data);
      setIsSavedInDb(false);
      setRefinementInstruction("");
      setRefineError(null);

      toast.success("Draf AI berhasil dibuat! Periksa dan sesuaikan sebelum disimpan.");
    });
  };

  const handleGenerate = () => {
    handleGenerateWithFlow(instruction.trim(), tone);
  };

  const handleRefine = (customPrompt?: string) => {
    const promptToUse = customPrompt || refinementInstruction;
    if (!promptToUse.trim()) {
      toast.error("Silakan masukkan instruksi penyesuaian");
      return;
    }

    if (draftStatus === "ARCHIVED") {
      toast.error("Draf terarsip bersifat hanya-baca dan tidak dapat disesuaikan");
      return;
    }

    setRefineError(null);

    startRefining(async () => {
      const res = await refineAiContentAction({
        contentType,
        currentTitle: draftTitle,
        currentContent: draftContent,
        refinementInstruction: promptToUse.trim(),
        teachingContextId: selectedContextId || undefined,
      });

      if (!res.success || !res.data) {
        setRefineError(res.error || "Gagal menyesuaikan draf AI");
        toast.error(res.error || "Gagal menyesuaikan draf AI");
        return;
      }

      setDraftTitle(res.data.title);
      setDraftContent(res.data.content);
      setActivePreviewInfo(res.data);
      setIsSavedInDb(false); // Refinement returns a transient preview that must be explicitly saved
      setRefinementInstruction("");

      toast.success("Draf berhasil disesuaikan! Jangan lupa klik 'Simpan Draf'.");
    });
  };

  // --------------------------------------------------------------------------
  // HANDLERS: SAVE & ARCHIVE
  // --------------------------------------------------------------------------

  const handleSaveDraft = () => {
    if (!draftTitle.trim() || !draftContent.trim()) {
      toast.error("Judul dan isi draf tidak boleh kosong");
      return;
    }

    if (draftStatus === "ARCHIVED") {
      toast.error("Draf terarsip bersifat hanya-baca dan tidak dapat diubah");
      return;
    }

    startSaving(async () => {
      const res = await saveAiDraftAction({
        draftId: currentDraftId || undefined,
        contentType,
        title: draftTitle.trim(),
        topic: topic.trim() || draftTitle.trim(),
        instruction: instruction.trim() || undefined,
        content: draftContent,
        teachingContextId: selectedContextId || undefined,
      });

      if (!res.success || !res.data) {
        toast.error(res.error || "Gagal menyimpan draf");
        return;
      }

      setCurrentDraftId(res.data.id);
      setIsSavedInDb(true);
      toast.success("Draf AI berhasil disimpan ke database!");

      // Refresh saved drafts list in background
      refreshDrafts();
    });
  };

  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);

  const handleDownloadDocument = async (
    format: ExportFormat,
    customTitle?: string,
    customContent?: string,
    customSubject?: string,
    customSchool?: string,
    customClass?: string
  ) => {
    if (isExporting) return; // Prevent double invocation

    const contentToExport = customContent || draftContent;
    const titleToExport = customTitle || draftTitle || "Dokumen Pembelajaran";
    const subjectToExport =
      customSubject ||
      activePreviewInfo?.contextSummary.subjectName ||
      selectedContext?.subjectName;
    const schoolToExport =
      customSchool ||
      "AI Teacher Assistant";
    const classToExport =
      customClass ||
      activePreviewInfo?.contextSummary.className ||
      selectedContext?.className;

    if (!contentToExport.trim()) {
      toast.error("Tidak ada konten untuk diunduh");
      return;
    }

    setIsExporting(format);
    try {
      await exportAiDocument({
        format,
        title: titleToExport,
        content: contentToExport,
        subjectName: subjectToExport,
        schoolName: schoolToExport,
        className: classToExport,
      });
      toast.success(`Berhasil mengunduh dokumen .${format.toUpperCase()}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyusun dan mengunduh dokumen";
      toast.error(msg);
    } finally {
      setIsExporting(null);
    }
  };

  // --------------------------------------------------------------------------
  // TEMPLATE MANAGEMENT & CUSTOM EXPORT
  // --------------------------------------------------------------------------
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<DocumentTemplateItem[]>([]);

  const loadTemplatesForContentType = React.useCallback(async (type: AiContentType) => {
    const res = await listDocumentTemplatesAction({ contentType: type });
    if (res.success && res.data) {
      setAvailableTemplates(res.data);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    void listDocumentTemplatesAction({ contentType }).then((res) => {
      if (isMounted && res.success && res.data) {
        setAvailableTemplates(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [contentType]);

  const handleExportWithTemplate = async (
    template: DocumentTemplateItem,
    draftOverride?: {
      id?: string;
      title: string;
      content: string;
      contentType: AiContentType;
      teachingContextId?: string;
    }
  ) => {
    if (isExporting) return;

    const targetTitle = draftOverride?.title || draftTitle || "Dokumen Pembelajaran";
    const targetContent = draftOverride?.content || draftContent;
    const targetContentType = draftOverride?.contentType || contentType;
    const targetContextId = draftOverride?.teachingContextId || selectedContextId;
    const targetDraftId = draftOverride?.id || (isSavedInDb ? currentDraftId : undefined);

    if (!targetContent.trim()) {
      toast.error("Tidak ada konten untuk diekspor");
      return;
    }

    const isXlsx = template.format === "XLSX";
    const formatKey = isXlsx ? "xlsx" : "docx";
    const endpoint = isXlsx ? "/api/templates/xlsx/export" : "/api/templates/docx/export";
    const ext = isXlsx ? "xlsx" : "docx";

    setIsExporting(formatKey);
    try {
      const payload = {
        templateId: template.id,
        sourceMode: targetDraftId ? ("SAVED_DRAFT" as const) : ("TRANSIENT" as const),
        draftId: targetDraftId || undefined,
        title: targetTitle,
        content: targetContent,
        contentType: targetContentType,
        teachingContextId: targetContextId || undefined,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Gagal ekspor dokumen (Status ${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${targetTitle.replace(/[^\w\s.-]/g, "_")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        } catch {
          // safe ignore
        }
      }, 1000);

      toast.success(`Berhasil mengunduh dokumen dengan template kustom ${ext.toUpperCase()}!`);
    } catch (err: unknown) {
      toast.error((err as Error).message);
    } finally {
      setIsExporting(null);
    }
  };

  const handleArchiveDraft = (draftIdToArchive?: string) => {
    const targetId = draftIdToArchive || currentDraftId;
    if (!targetId) return;

    if (!confirm("Apakah Anda yakin ingin mengarsipkan draf ini? Draf yang diarsipkan akan menjadi hanya-baca.")) {
      return;
    }

    startArchiving(async () => {
      const res = await archiveAiDraftAction({ draftId: targetId });
      if (!res.success) {
        toast.error(res.error || "Gagal mengarsipkan draf");
        return;
      }

      toast.success("Draf berhasil diarsipkan");

      if (currentDraftId === targetId) {
        setDraftStatus("ARCHIVED");
      }

      refreshDrafts();
    });
  };

  const refreshDrafts = (statusToFetch: AiDraftStatus = savedTabStatus) => {
    startLoadingDrafts(async () => {
      const drafts = await getAiDraftsAction({
        status: statusToFetch,
        contentType: filterType !== "ALL" ? (filterType as AiContentType) : undefined,
        teachingContextId: filterContext !== "ALL" ? filterContext : undefined,
        search: searchQuery.trim() || undefined,
      });
      setDraftsList(drafts as unknown as AiDraftItem[]);
    });
  };

  // Open saved draft into editor
  const handleOpenDraft = (draft: AiDraftItem) => {
    setCurrentDraftId(draft.id);
    setDraftStatus(draft.status);
    setContentType(draft.contentType);

    if (draft.contentType === "LESSON_PLAN") {
      setSelectedFlow("LESSON_PLAN");
    } else if (draft.contentType === "RUBRIC") {
      setSelectedFlow("RUBRIC");
    } else if (draft.contentType === "TASK_INSTRUCTION") {
      const lower = (draft.title + " " + draft.topic).toLowerCase();
      if (lower.includes("soal") || lower.includes("kisi") || lower.includes("kuis") || lower.includes("evaluasi") || lower.includes("pts") || lower.includes("pas")) {
        setSelectedFlow("ASSESSMENT_QUIZ");
      } else {
        setSelectedFlow("LKPD");
      }
    } else if (draft.contentType === "LEARNING_MATERIAL") {
      const lower = (draft.title + " " + draft.topic).toLowerCase();
      if (lower.includes("slide") || lower.includes("presentasi") || lower.includes("deck") || lower.includes("ppt")) {
        setSelectedFlow("PRESENTATION");
      } else {
        setSelectedFlow("LEARNING_MATERIAL");
      }
    }

    setTopic(draft.topic);
    setInstruction(draft.instruction || "");
    setSelectedContextId(draft.teachingContext?.id || "");
    setDraftTitle(draft.title);
    setDraftContent(draft.content);
    setIsSavedInDb(true);
    setActivePreviewInfo({
      title: draft.title,
      content: draft.content,
      contentType: draft.contentType,
      topic: draft.topic,
      instruction: draft.instruction || undefined,
      teachingContextId: draft.teachingContext?.id,
      contextSummary: {
        isContextAware: !!draft.teachingContext,
        subjectName: draft.teachingContext?.subject.name,
        className: draft.teachingContext?.class.name,
        academicPeriod: draft.teachingContext
          ? `T.A. ${draft.teachingContext.academicPeriod.year} - Sem. ${draft.teachingContext.academicPeriod.semester}`
          : undefined,
      },
      modelUsed: draft.modelUsed || "gemini",
      generatedAt: new Date(draft.updatedAt).toISOString(),
    });

    setActiveTab("CREATE");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleResetEditor = () => {
    setCurrentDraftId(null);
    setDraftStatus("ACTIVE");
    setDraftTitle("");
    setDraftContent("");
    setActivePreviewInfo(null);
    setIsSavedInDb(false);
    setGenerateError(null);
    setRefineError(null);
  };

  // Helper icons for content types
  const getContentTypeIcon = (type: AiContentType) => {
    switch (type) {
      case "LESSON_PLAN":
        return <ListOrdered className="h-5 w-5 text-indigo-600" />;
      case "LEARNING_MATERIAL":
        return <BookOpen className="h-5 w-5 text-emerald-600" />;
      case "TASK_INSTRUCTION":
        return <FileText className="h-5 w-5 text-amber-600" />;
      case "RUBRIC":
        return <CheckSquare className="h-5 w-5 text-sky-600" />;
    }
  };

  // Helper icons for specialized teacher flows
  const getFlowIcon = (flowId: AiStudioFlowType) => {
    switch (flowId) {
      case "LESSON_PLAN":
        return <BookOpen className="h-5 w-5 text-indigo-600" />;
      case "ASSESSMENT_QUIZ":
        return <HelpCircle className="h-5 w-5 text-emerald-600" />;
      case "LKPD":
        return <CheckSquare className="h-5 w-5 text-amber-600" />;
      case "PRESENTATION":
        return <Presentation className="h-5 w-5 text-purple-600" />;
      case "LEARNING_MATERIAL":
        return <FileText className="h-5 w-5 text-blue-600" />;
      case "RUBRIC":
        return <Sliders className="h-5 w-5 text-rose-600" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">AI Content Studio</h1>
              <p className="text-sm text-muted-foreground">
                Asisten draf pembelajaran pintar berbasis konteks kelas dan mata pelajaran Anda.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-muted p-1 rounded-xl w-fit">
          <Button
            type="button"
            variant={activeTab === "CREATE" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("CREATE")}
            className="rounded-lg"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {draftTitle ? "Editor Draf" : "Buat Baru"}
          </Button>
          <Button
            type="button"
            variant={activeTab === "SAVED" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("SAVED");
              refreshDrafts(savedTabStatus);
            }}
            className="rounded-lg"
          >
            <History className="h-4 w-4 mr-2" />
            Draf Tersimpan ({draftsList.length})
          </Button>
        </div>
      </div>

      {/* Draft Notification Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-sm">
        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold">Prinsip Teacher OS: AI Assists, Teacher Decides.</span>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
            Hasil AI adalah <span className="font-semibold underline">Draf Sementara</span>. Guru bertanggung jawab penuh untuk memeriksa, menyesuaikan, dan menyimpannya sebelum digunakan.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CREATE / GENERATE / PREVIEW / EDIT / REFINE */}
      {/* ========================================================================= */}
      {activeTab === "CREATE" && (
        <div className="space-y-6">
          {/* If there's an active draft being viewed/edited */}
          {draftTitle && draftContent ? (
            <div className="space-y-6">
              {/* Draft Header & Meta */}
              {(() => {
                const isPresentationDraft =
                  selectedFlow === "PRESENTATION" ||
                  (contentType === "LEARNING_MATERIAL" &&
                    (/slide|presentasi|powerpoint|pptx/i.test(draftTitle + " " + topic) ||
                      draftContent.includes("## Slide") ||
                      draftContent.includes("[Speaker Notes]") ||
                      draftContent.includes("[PANDUAN SLIDE")));

                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-2xl p-4 md:p-6 shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`font-semibold ${
                            isPresentationDraft
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : ""
                          }`}
                        >
                          {isPresentationDraft
                            ? "Slide Presentasi"
                            : CONTENT_TYPE_LABELS[contentType].title}
                        </Badge>

                        {draftStatus === "ARCHIVED" ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            Terarsip (Hanya Baca)
                          </Badge>
                        ) : isSavedInDb ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Tersimpan di Database
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                            Pratinjau Draf (Belum Disimpan)
                          </Badge>
                        )}

                        {activePreviewInfo?.modelUsed && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Model: {activePreviewInfo.modelUsed}
                          </Badge>
                        )}
                      </div>
                      <h2 className="text-xl font-bold tracking-tight text-foreground mt-1">
                        {draftTitle}
                      </h2>
                      {activePreviewInfo?.contextSummary.isContextAware && (
                        <p className="text-xs text-muted-foreground">
                          Konteks: {activePreviewInfo.contextSummary.subjectName} — Kelas {activePreviewInfo.contextSummary.className} ({activePreviewInfo.contextSummary.academicPeriod})
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Primary Preview Action */}
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={!draftContent}
                        onClick={() => {
                          setPreviewFormatInitial(isPresentationDraft ? "pptx" : "docx");
                          setIsPreviewModalOpen(true);
                        }}
                        className={`h-8 px-3 text-xs font-bold shadow-sm gap-1.5 rounded-lg text-white ${
                          isPresentationDraft
                            ? "bg-purple-600 hover:bg-purple-700"
                            : "bg-indigo-600 hover:bg-indigo-700"
                        }`}
                        title="Buka Pratinjau Dokumen Lengkap Sebelum Diunduh"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Pratinjau Dokumen
                      </Button>

                      {/* Export Actions: Specific PPTX for Presentation, Word for others */}
                      {isPresentationDraft ? (
                        <div className="flex items-center gap-1 bg-purple-50/70 p-1 rounded-lg border border-purple-200 flex-wrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!!isExporting || !draftContent}
                            onClick={() => handleDownloadDocument("pptx")}
                            className="h-8 px-2.5 text-xs font-semibold hover:bg-background gap-1 text-purple-700 bg-purple-100/60"
                            title="Unduh sebagai Slide Presentasi PowerPoint (.pptx)"
                          >
                            {isExporting === "pptx" ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Presentation className="h-3.5 w-3.5 text-purple-600" />
                            )}
                            PowerPoint (.pptx)
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border flex-wrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!!isExporting || !draftContent}
                            onClick={() => handleDownloadDocument("docx")}
                            className="h-8 px-2.5 text-xs font-semibold hover:bg-background gap-1 text-blue-700 bg-blue-50/40"
                            title="Unduh sebagai Dokumen Word Standar (.docx)"
                          >
                            {isExporting === "docx" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 text-blue-600" />}
                            Word Standar
                          </Button>

                          {availableTemplates.filter((t) => (t.format || "DOCX") === "DOCX").length > 0 ? (
                            <div className="relative group">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={!!isExporting || !draftContent}
                                className="h-8 px-2.5 text-xs font-semibold hover:bg-background gap-1 text-blue-700 bg-blue-50/50"
                                title="Pilih Template Word Kustom"
                              >
                                <LayoutTemplate className="h-3.5 w-3.5 text-blue-600" />
                                Template Word ({availableTemplates.filter((t) => (t.format || "DOCX") === "DOCX").length})
                              </Button>
                              <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-30 bg-white border border-slate-200 rounded-xl shadow-xl p-1 min-w-[220px]">
                                {availableTemplates
                                  .filter((t) => (t.format || "DOCX") === "DOCX")
                                  .map((t) => (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => handleExportWithTemplate(t)}
                                      className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg font-medium transition-all"
                                    >
                                      {t.name}
                                    </button>
                                  ))}
                                <div className="border-t border-slate-100 my-1"></div>
                                <button
                                  type="button"
                                  onClick={() => setIsTemplateDialogOpen(true)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 font-semibold rounded-lg"
                                >
                                  + Kelola Template...
                                </button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setIsTemplateDialogOpen(true)}
                              className="h-8 px-2.5 text-xs font-semibold hover:bg-background gap-1 text-slate-600"
                              title="Gunakan Template Word Kustom Sendiri"
                            >
                              <LayoutTemplate className="h-3.5 w-3.5 text-slate-500" />
                              + Template Word
                            </Button>
                          )}
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetEditor}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1.5" />
                        Buat Draf Baru
                      </Button>

                      {draftStatus === "ACTIVE" && (
                        <>
                          {currentDraftId && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isArchiving}
                              onClick={() => handleArchiveDraft()}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Archive className="h-4 w-4 mr-1.5" />
                              Arsipkan
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            disabled={isSaving}
                            onClick={handleSaveDraft}
                            className="bg-primary hover:bg-primary/90"
                          >
                            <Save className="h-4 w-4 mr-1.5" />
                            {isSaving ? "Menyimpan..." : currentDraftId ? "Simpan Perubahan" : "Simpan Draf"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Title & Content Editor */}
              <div className="grid grid-cols-1 gap-6">
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <span>Editor Konten Pembelajaran</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {draftStatus === "ARCHIVED" ? "Mode Hanya-Baca" : "Dapat diedit langsung"}
                          </span>
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          Ubah teks secara manual di bawah ini sebelum menyimpan atau membagikannya kepada siswa.
                        </CardDescription>
                      </div>

                      {/* View Mode Toggle */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border">
                        <button
                          type="button"
                          onClick={() => setEditorViewMode("EDIT")}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                            editorViewMode === "EDIT"
                              ? "bg-white text-indigo-700 shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          ✏️ Mode Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditorViewMode("PREVIEW")}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                            editorViewMode === "PREVIEW"
                              ? "bg-white text-indigo-700 shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          👁️ Pratinjau Teks
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Judul Draf
                      </label>
                      <Input
                        value={draftTitle}
                        disabled={draftStatus === "ARCHIVED"}
                        onChange={(e) => {
                          setDraftTitle(e.target.value);
                          setIsSavedInDb(false);
                        }}
                        placeholder="Judul draf..."
                        className="font-medium text-base"
                      />
                    </div>

                    {editorViewMode === "EDIT" ? (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Isi Konten (Format Markdown)
                        </label>
                        <Textarea
                          value={draftContent}
                          disabled={draftStatus === "ARCHIVED"}
                          onChange={(e) => {
                            setDraftContent(e.target.value);
                            setIsSavedInDb(false);
                          }}
                          placeholder="Isi konten pembelajaran..."
                          rows={16}
                          className="font-mono text-sm leading-relaxed"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Pratinjau Tampilan Rapi
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPreviewFormatInitial("docx");
                              setIsPreviewModalOpen(true);
                            }}
                            className="h-6 px-2 text-[11px] text-indigo-600 hover:bg-indigo-50 font-semibold"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Buka Modal Pratinjau Lengkap & Unduh
                          </Button>
                        </div>
                        <div className="p-6 border rounded-xl bg-slate-50/50 max-h-[460px] overflow-y-auto space-y-2 text-sm text-slate-800 leading-relaxed font-sans">
                          {(() => {
                            const lines = draftContent.split("\n");
                            const elements: React.ReactNode[] = [];
                            let tableRows: string[][] = [];
                            let inTable = false;

                            const renderInline = (text: string) => {
                              const clean = text.trim();
                              if (!clean) return null;
                              const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|___[^_]+___|__[^_]+__|_[^_]+_|`[^`]+`)/g;
                              const parts = clean.split(regex);
                              return parts.map((part, i) => {
                                if (!part) return null;
                                if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
                                  return <strong key={i} className="font-bold italic">{part.slice(3, -3)}</strong>;
                                }
                                if ((part.startsWith("**") && part.endsWith("**") && part.length > 4) || (part.startsWith("__") && part.endsWith("__") && part.length > 4)) {
                                  return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
                                }
                                if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) || (part.startsWith("_") && part.endsWith("_") && part.length > 2)) {
                                  return <em key={i} className="italic text-slate-800">{part.slice(1, -1)}</em>;
                                }
                                if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
                                  return <code key={i} className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
                                }
                                return <span key={i}>{part}</span>;
                              });
                            };

                            const flushTable = (k: number) => {
                              if (tableRows.length === 0) return;
                              const [headers, ...dataRows] = tableRows;
                              elements.push(
                                <div key={`tbl-${k}`} className="overflow-x-auto my-3 rounded-lg border border-slate-200 shadow-sm">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-800 font-semibold">
                                        {headers.map((h, hi) => (
                                          <th key={hi} className="px-3 py-2 border-r border-slate-200 last:border-r-0">
                                            {renderInline(h)}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {dataRows.map((row, ri) => (
                                        <tr key={ri} className={ri % 2 === 1 ? "bg-slate-50/50" : ""}>
                                          {row.map((cell, ci) => (
                                            <td key={ci} className="px-3 py-2 border-r border-slate-100 last:border-r-0 align-top text-slate-700">
                                              {cell.split(/<br\s*\/?>/gi).map((cLine, cli) => (
                                                <div key={cli} className={cli > 0 ? "mt-0.5" : ""}>
                                                  {renderInline(cLine)}
                                                </div>
                                              ))}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                              tableRows = [];
                              inTable = false;
                            };

                            lines.forEach((line, li) => {
                              const trimmed = line.trim();

                              if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
                                if (trimmed.replace(/[|\-\s:]/g, "").length === 0) return;
                                const cells = trimmed.split("|").slice(1, -1).map((c) => c.trim());
                                tableRows.push(cells);
                                inTable = true;
                                return;
                              } else if (inTable) {
                                flushTable(li);
                              }

                              if (!trimmed || trimmed === "---" || trimmed === "***") {
                                elements.push(<div key={li} className="h-2" />);
                                return;
                              }

                              if (trimmed.startsWith("# ")) {
                                elements.push(
                                  <h1 key={li} className="text-lg font-bold text-slate-900 border-b pb-1 mt-3 mb-1">
                                    {renderInline(trimmed.replace(/^#+\s*/, ""))}
                                  </h1>
                                );
                                return;
                              }
                              if (trimmed.startsWith("## ")) {
                                elements.push(
                                  <h2 key={li} className="text-sm font-bold text-indigo-900 border-l-2 border-indigo-600 pl-2 mt-3 mb-1">
                                    {renderInline(trimmed.replace(/^#+\s*/, ""))}
                                  </h2>
                                );
                                return;
                              }
                              if (trimmed.startsWith("### ")) {
                                elements.push(
                                  <h3 key={li} className="text-xs font-bold text-slate-800 mt-2.5 mb-1">
                                    {renderInline(trimmed.replace(/^#+\s*/, ""))}
                                  </h3>
                                );
                                return;
                              }
                              if (/^#{4,}\s+/.test(trimmed)) {
                                elements.push(
                                  <h4 key={li} className="text-xs font-semibold text-slate-700 uppercase tracking-wide mt-2 mb-0.5">
                                    {renderInline(trimmed.replace(/^#+\s*/, ""))}
                                  </h4>
                                );
                                return;
                              }
                              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                                elements.push(
                                  <li key={li} className="ml-4 list-disc text-xs text-slate-700 my-0.5">
                                    {renderInline(trimmed.replace(/^[-*]\s*/, ""))}
                                  </li>
                                );
                                return;
                              }
                              if (/^\d+\.\s/.test(trimmed)) {
                                const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
                                elements.push(
                                  <li key={li} className="ml-4 list-decimal text-xs text-slate-700 my-0.5">
                                    {numMatch ? renderInline(numMatch[2]) : renderInline(trimmed)}
                                  </li>
                                );
                                return;
                              }
                              elements.push(
                                <p key={li} className="text-xs text-slate-700 my-1">
                                  {renderInline(trimmed)}
                                </p>
                              );
                            });

                            if (inTable) {
                              flushTable(lines.length);
                            }

                            return elements;
                          })()}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* One-Shot Refinement Section (Only for ACTIVE drafts) */}
                {draftStatus === "ACTIVE" && (
                  <Card className="border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                        <Sliders className="h-4 w-4 text-indigo-600" />
                        Sesuaikan Draf Ini (One-Shot Refinement)
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Minta AI untuk memodifikasi gaya bahasa, panjang konten, atau menambahkan aspek tertentu. Penyesuaian menghasilkan pratinjau baru yang perlu Anda simpan kembali.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Quick preset chips */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Pilihan Cepat:</span>
                        {[
                          "Buat lebih ringkas dan padat",
                          "Gunakan bahasa lebih sederhana untuk siswa",
                          "Tambahkan contoh konkret dalam kehidupan nyata",
                          "Buat aktivitas lebih interaktif",
                        ].map((chip) => (
                          <Button
                            key={chip}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isRefining}
                            onClick={() => handleRefine(chip)}
                            className="text-xs h-7 bg-background"
                          >
                            {chip}
                          </Button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          value={refinementInstruction}
                          onChange={(e) => setRefinementInstruction(e.target.value)}
                          placeholder="Ketik instruksi penyesuaian khusus (contoh: 'Fokuskan pada diskusi kelompok 4 orang')..."
                          disabled={isRefining}
                          className="bg-background text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleRefine();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="default"
                          disabled={isRefining || !refinementInstruction.trim()}
                          onClick={() => handleRefine()}
                          className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                        >
                          {isRefining ? (
                            <>
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              Menyesuaikan...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Sesuaikan
                            </>
                          )}
                        </Button>
                      </div>

                      {refineError && (
                        <Alert variant="destructive" className="py-2">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">{refineError}</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            /* New Generation Form */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Form Settings */}
              <div className="lg:col-span-2 space-y-6">
                {/* Step 1: Flow Selection */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">1. Pilih Alur Kebutuhan Guru</CardTitle>
                      <Badge variant="outline" className="text-xs font-normal">
                        6 Alur Spesifik
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Pilih format dan model alur kerja yang sesuai dengan kebutuhan mengajar Anda saat ini.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(Object.keys(AI_STUDIO_FLOWS) as AiStudioFlowType[]).map((flowId) => {
                        const flow = AI_STUDIO_FLOWS[flowId];
                        const isSelected = selectedFlow === flowId;
                        return (
                          <div
                            key={flowId}
                            onClick={() => handleSelectFlow(flowId)}
                            className={`cursor-pointer rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                                : "hover:border-primary/40 hover:bg-muted/40 bg-card"
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="p-2 rounded-lg bg-background border shadow-xs">
                                  {getFlowIcon(flowId)}
                                </div>
                                <Badge
                                  variant="secondary"
                                  className={`text-[10px] font-semibold px-2 py-0.5 ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {flow.badge}
                                </Badge>
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-foreground">{flow.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                  {flow.subtitle}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                              <span>Ekspor: <strong className="uppercase text-slate-700 font-semibold">{flow.recommendedExport}</strong></span>
                              {isSelected && <span className="text-primary font-bold">✓ Aktif</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Step 2: Context Selection (Optional) */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">2. Konteks Kelas (Opsional)</CardTitle>
                      <Badge variant="outline" className="text-xs font-normal">
                        Input Once, Use Everywhere
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Pilih kelas yang Anda ajar untuk secara otomatis menyertakan mata pelajaran, tingkat kelas, dan semester.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Pilih Mata Pelajaran & Kelas
                      </label>
                      <select
                        value={selectedContextId}
                        onChange={(e) => setSelectedContextId(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">-- Tanpa Konteks Khusus (Konten Umum) --</option>
                        {contexts.map((ctx) => (
                          <option key={ctx.id} value={ctx.id}>
                            {ctx.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Historical Topics Explicit Opt-in */}
                    {selectedContextId && (
                      <div className="pt-2 border-t space-y-2">
                        <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={includeHistoricalTopics}
                            onChange={(e) => setIncludeHistoricalTopics(e.target.checked)}
                            className="mt-0.5 rounded border-muted-foreground text-primary focus:ring-primary h-4 w-4"
                          />
                          <div>
                            <span className="font-medium text-foreground">
                              Sertakan riwayat topik pertemuan/tugas sebelumnya
                            </span>
                            <p className="text-muted-foreground text-[11px] mt-0.5">
                              Membantu AI menyelaraskan draf dengan materi yang telah diajarkan di kelas ini.
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Step 3: Specialized Flow Configuration Form */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span>3. Konfigurasi {AI_STUDIO_FLOWS[selectedFlow].title}</span>
                      </CardTitle>
                      <Badge variant="outline" className="text-xs font-normal">
                        Flow Khusus
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Isi parameter di bawah ini. AI Studio akan menyusun draf dokumen secara runtut dan terstruktur.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {generateError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-sm font-semibold">Gagal Menghasilkan Draf</AlertTitle>
                        <AlertDescription className="text-xs">{generateError}</AlertDescription>
                      </Alert>
                    )}

                    {selectedFlow === "LESSON_PLAN" && (
                      <LessonPlanFlow
                        topic={topic}
                        setTopic={setTopic}
                        onSubmit={handleGenerateWithFlow}
                        isGenerating={isGenerating}
                        selectedContextLabel={selectedContext ? `${selectedContext.subjectName} (${selectedContext.className})` : undefined}
                      />
                    )}

                    {selectedFlow === "ASSESSMENT_QUIZ" && (
                      <AssessmentQuizFlow
                        topic={topic}
                        setTopic={setTopic}
                        onSubmit={handleGenerateWithFlow}
                        isGenerating={isGenerating}
                        selectedContextLabel={selectedContext ? `${selectedContext.subjectName} (${selectedContext.className})` : undefined}
                      />
                    )}

                    {selectedFlow === "LKPD" && (
                      <LkpdFlow
                        topic={topic}
                        setTopic={setTopic}
                        onSubmit={handleGenerateWithFlow}
                        isGenerating={isGenerating}
                        selectedContextLabel={selectedContext ? `${selectedContext.subjectName} (${selectedContext.className})` : undefined}
                      />
                    )}

                    {selectedFlow === "PRESENTATION" && (
                      <PresentationFlow
                        topic={topic}
                        setTopic={setTopic}
                        onSubmit={handleGenerateWithFlow}
                        isGenerating={isGenerating}
                        selectedContextLabel={selectedContext ? `${selectedContext.subjectName} (${selectedContext.className})` : undefined}
                      />
                    )}

                    {selectedFlow === "LEARNING_MATERIAL" && (
                      <LearningMaterialFlow
                        topic={topic}
                        setTopic={setTopic}
                        onSubmit={handleGenerateWithFlow}
                        isGenerating={isGenerating}
                        selectedContextLabel={selectedContext ? `${selectedContext.subjectName} (${selectedContext.className})` : undefined}
                      />
                    )}

                    {selectedFlow === "RUBRIC" && (
                      <RubricFlow
                        topic={topic}
                        setTopic={setTopic}
                        onSubmit={handleGenerateWithFlow}
                        isGenerating={isGenerating}
                        selectedContextLabel={selectedContext ? `${selectedContext.subjectName} (${selectedContext.className})` : undefined}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Visible Context Summary Card */}
              <div className="space-y-6">
                <Card className="bg-muted/30 border-dashed shadow-xs">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-primary" />
                      Ringkasan Konteks yang Digunakan
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Transparansi data yang dikirimkan ke model AI untuk pembuatan draf.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="bg-card border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between border-b pb-1.5">
                        <span className="text-muted-foreground">Jenis Konten:</span>
                        <span className="font-semibold text-foreground">
                          {CONTENT_TYPE_LABELS[contentType].title}
                        </span>
                      </div>

                      {selectedContext ? (
                        <>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-muted-foreground">Mata Pelajaran:</span>
                            <span className="font-medium text-foreground">{selectedContext.subjectName}</span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-muted-foreground">Kelas / Tingkat:</span>
                            <span className="font-medium text-foreground">
                              {selectedContext.className} {selectedContext.gradeLevel ? `(${selectedContext.gradeLevel})` : ""}
                            </span>
                          </div>
                          <div className="flex justify-between border-b pb-1.5">
                            <span className="text-muted-foreground">Tahun Ajaran:</span>
                            <span className="font-medium text-foreground">{selectedContext.academicPeriod}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Riwayat Topik:</span>
                            <span className="font-medium text-foreground">
                              {includeHistoricalTopics ? "Disertakan (Aktif)" : "Tidak disertakan"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-muted-foreground italic py-1">
                          Tanpa konteks kelas spesifik. Draf disusun secara umum.
                        </div>
                      )}
                    </div>

                    <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 rounded-lg p-3 text-[11px] text-sky-900 dark:text-sky-300">
                      <span className="font-semibold">Privasi Terjaga:</span>
                      <p className="mt-0.5">
                        Tidak ada data nama siswa, nilai, kehadiran, catatan monitoring, atau identitas pribadi siswa yang dikirimkan ke model AI.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SAVED DRAFTS LIST / ARCHIVE */}
      {/* ========================================================================= */}
      {activeTab === "SAVED" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <Card className="shadow-sm">
            <CardContent className="pt-6 space-y-4">
              {/* Status Selector Tabs */}
              <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={savedTabStatus === "ACTIVE" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSavedTabStatus("ACTIVE");
                      refreshDrafts("ACTIVE");
                    }}
                    className="rounded-lg text-xs"
                  >
                    Draf Aktif
                  </Button>
                  <Button
                    type="button"
                    variant={savedTabStatus === "ARCHIVED" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSavedTabStatus("ARCHIVED");
                      refreshDrafts("ARCHIVED");
                    }}
                    className="rounded-lg text-xs"
                  >
                    <Archive className="h-3.5 w-3.5 mr-1" />
                    Arsip Draf
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground">
                  Menampilkan {draftsList.length} draf {savedTabStatus === "ACTIVE" ? "aktif" : "terarsip"}
                </div>
              </div>

              {/* Search & Filter Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder="Cari judul atau topik..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") refreshDrafts();
                    }}
                    className="pl-9 text-xs"
                  />
                </div>

                <div>
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      refreshDrafts();
                    }}
                    className="w-full h-9 px-3 rounded-lg border bg-background text-xs"
                  >
                    <option value="ALL">Semua Jenis Konten</option>
                    {AI_CONTENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {CONTENT_TYPE_LABELS[t].title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={filterContext}
                    onChange={(e) => {
                      setFilterContext(e.target.value);
                      refreshDrafts();
                    }}
                    className="w-full h-9 px-3 rounded-lg border bg-background text-xs"
                  >
                    <option value="ALL">Semua Kelas / Konteks</option>
                    {contexts.map((ctx) => (
                      <option key={ctx.id} value={ctx.id}>
                        {ctx.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Drafts List */}
          {isLoadingDrafts ? (
            <div className="text-center py-12 text-muted-foreground text-sm flex items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              Memuat draf pembelajaran...
            </div>
          ) : draftsList.length === 0 ? (
            <Card className="border-dashed py-12 text-center">
              <CardContent className="space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold">
                  {savedTabStatus === "ACTIVE" ? "Belum Ada Draf Aktif" : "Tidak Ada Draf yang Diarsipkan"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {savedTabStatus === "ACTIVE"
                    ? "Gunakan AI Content Studio untuk membuat dan menyimpan draf materi atau rencana pembelajaran pertama Anda."
                    : "Draf yang Anda arsipkan akan tersimpan di sini secara aman sebagai riwayat hanya-baca."}
                </p>
                {savedTabStatus === "ACTIVE" && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      handleResetEditor();
                      setActiveTab("CREATE");
                    }}
                    className="mt-2"
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Buat Draf Sekarang
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {draftsList.map((draft) => {
                const isPptDraft =
                  draft.contentType === "LEARNING_MATERIAL" &&
                  (/slide|presentasi|powerpoint|pptx/i.test(draft.title + " " + draft.topic) ||
                    draft.content.includes("## Slide") ||
                    draft.content.includes("[Speaker Notes]") ||
                    draft.content.includes("[PANDUAN SLIDE]"));

                return (
                  <Card
                    key={draft.id}
                    className="hover:shadow-md transition-shadow border flex flex-col justify-between"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-medium ${
                            isPptDraft
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : ""
                          }`}
                        >
                          {isPptDraft
                            ? "Slide Presentasi"
                            : CONTENT_TYPE_LABELS[draft.contentType].title}
                        </Badge>
                        {draft.status === "ARCHIVED" ? (
                          <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" />
                            Arsip
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Aktif
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-bold line-clamp-2 mt-1">
                        {draft.title}
                      </CardTitle>
                      <CardDescription className="text-xs line-clamp-1">
                        Topik: {draft.topic}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      {draft.teachingContext ? (
                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                          {draft.teachingContext.subject.name} — Kelas {draft.teachingContext.class.name} ({draft.teachingContext.academicPeriod.year})
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">
                          Draf Konten Umum
                        </div>
                      )}

                      {/* Quick export bar for draft card */}
                      <div className="flex items-center justify-between gap-1 pt-2 border-t">
                        <div className="flex items-center gap-1">
                          {isPptDraft ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!!isExporting}
                              onClick={() =>
                                handleDownloadDocument(
                                  "pptx",
                                  draft.title,
                                  draft.content,
                                  draft.teachingContext?.subject.name,
                                  undefined,
                                  draft.teachingContext?.class.name
                                )
                              }
                              className="h-6 px-1.5 text-[10px] text-purple-600 hover:bg-purple-50 font-medium"
                              title="Download PowerPoint (.pptx)"
                            >
                              <Presentation className="h-3 w-3 mr-0.5" />
                              PowerPoint (.pptx)
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!!isExporting}
                              onClick={() =>
                                handleDownloadDocument(
                                  "docx",
                                  draft.title,
                                  draft.content,
                                  draft.teachingContext?.subject.name,
                                  undefined,
                                  draft.teachingContext?.class.name
                                )
                              }
                              className="h-6 px-1.5 text-[10px] text-blue-600 hover:bg-blue-50"
                              title="Download Word (.docx)"
                            >
                              <FileText className="h-3 w-3 mr-0.5" />
                              Word
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {draft.status === "ACTIVE" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchiveDraft(draft.id)}
                              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            >
                              <Archive className="h-3.5 w-3.5 mr-1" />
                              Arsip
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDraft(draft)}
                            className="h-7 px-2.5 text-xs font-semibold"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            {draft.status === "ACTIVE" ? "Buka & Edit" : "Lihat"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom Template Management Dialog */}
      <TemplateManagerDialog
        isOpen={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
        defaultContentType={contentType}
        onTemplateUpdated={() => loadTemplatesForContentType(contentType)}
      />

      {/* Document Preview & Download Modal */}
      <DocumentPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={draftTitle || "Dokumen Pembelajaran"}
        content={draftContent}
        contentType={contentType}
        initialFormat={previewFormatInitial}
        schoolName="SMA Negeri 1 Jakarta"
        teacherName="Guru Pengampu"
        subjectName={selectedContext?.subjectName || "Mata Pelajaran"}
        className={selectedContext?.className || "Kelas"}
        academicPeriod={selectedContext?.academicPeriod || "T.A. 2026/2027"}
        availableTemplates={availableTemplates}
        selectedTemplateId={selectedPreviewTemplateId}
        onSelectTemplate={setSelectedPreviewTemplateId}
        onDownload={async (format, template) => {
          if (template) {
            await handleExportWithTemplate(template);
          } else {
            await handleDownloadDocument(format);
          }
        }}
        isDownloading={!!isExporting}
      />
    </div>
  );
}
