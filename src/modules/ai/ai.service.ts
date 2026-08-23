import {
  AiProviderGenerateRequest,
  AiProviderRefineRequest,
  CONTENT_TYPE_LABELS,
  RecentTopicItem,
  SafeContextPack,
  VisibleContextSummary,
} from "./ai.types";

/**
 * Builds the Safe Educational Context Pack.
 * Strict Privacy Guarantee: Zero student names, NIS, attendance records, assessment scores,
 * remedial history, or monitoring notes are ever packaged.
 */
export function buildSafeContextPack(
  contextData: {
    subject: { name: string };
    class: { name: string; gradeLevel: string | null };
    academicPeriod: { year: string; semester: string };
    recentSessions?: Array<{ plannedTopic?: string | null; actualTopic?: string | null }>;
    recentAssignments?: Array<{ title: string }>;
  },
  includeHistoricalTopics = false
): SafeContextPack {
  const pack: SafeContextPack = {
    subjectName: contextData.subject.name,
    className: contextData.class.name,
    gradeLevel: contextData.class.gradeLevel,
    academicPeriod: {
      year: contextData.academicPeriod.year,
      semester: contextData.academicPeriod.semester,
    },
  };

  if (includeHistoricalTopics) {
    const recentTopics: RecentTopicItem[] = [];

    if (contextData.recentSessions) {
      for (const session of contextData.recentSessions) {
        const topic = session.actualTopic || session.plannedTopic;
        if (topic && topic.trim()) {
          recentTopics.push({ type: "SESSION", topic: topic.trim() });
        }
      }
    }

    if (contextData.recentAssignments) {
      for (const assignment of contextData.recentAssignments) {
        if (assignment.title && assignment.title.trim()) {
          recentTopics.push({ type: "ASSIGNMENT", topic: assignment.title.trim() });
        }
      }
    }

    if (recentTopics.length > 0) {
      pack.recentTopics = recentTopics.slice(0, 5); // Limit to 5 most recent
    }
  }

  return pack;
}

/**
 * Formats a visible context summary for the teacher UI.
 * Guaranteed 1-to-1 match with the context actually sent to the AI provider.
 */
export function formatContextSummary(contextPack?: SafeContextPack): VisibleContextSummary {
  if (!contextPack) {
    return {
      isContextAware: false,
    };
  }

  const includedHistoricalTopics = contextPack.recentTopics?.map((t) =>
    t.type === "SESSION" ? `Pertemuan: ${t.topic}` : `Tugas: ${t.topic}`
  );

  return {
    isContextAware: true,
    subjectName: contextPack.subjectName,
    className: contextPack.className,
    gradeLevel: contextPack.gradeLevel,
    academicPeriod: `T.A. ${contextPack.academicPeriod.year} - Sem. ${contextPack.academicPeriod.semester}`,
    includedHistoricalTopics,
  };
}

/**
 * Constructs the structured Indonesian generation prompt sent to the AI model.
 */
export function constructGenerationPrompt(request: AiProviderGenerateRequest): string {
  const label = CONTENT_TYPE_LABELS[request.contentType];
  const parts: string[] = [];

  parts.push(`JENIS KONTEN: ${label.title} (${request.contentType})`);
  parts.push(`TOPIK / POKOK BAHASAN: ${request.topic}`);

  if (request.tone) {
    const toneMap = {
      CONCISE: "Ringkas dan langsung pada inti",
      STANDARD: "Standar, komprehensif, dan seimbang",
      DETAILED: "Mendalam, terperinci dengan elaborasi luas",
    };
    parts.push(`GAYA PENYAMPAIAN: ${toneMap[request.tone]}`);
  }

  if (request.instruction && request.instruction.trim()) {
    parts.push(`INSTRUKSI TAMBAHAN GURU:\n${request.instruction.trim()}`);
  }

  if (request.contextPack) {
    parts.push(`\n--- KONTEKS KELAS & PEMBELAJARAN ---`);
    parts.push(`Mata Pelajaran: ${request.contextPack.subjectName}`);
    parts.push(
      `Kelas: ${request.contextPack.className}${
        request.contextPack.gradeLevel ? ` (Tingkat ${request.contextPack.gradeLevel})` : ""
      }`
    );
    parts.push(
      `Tahun Ajaran / Semester: ${request.contextPack.academicPeriod.year} / ${request.contextPack.academicPeriod.semester}`
    );

    if (request.contextPack.recentTopics && request.contextPack.recentTopics.length > 0) {
      parts.push(`Riwayat Topik Pembelajaran Sebelumnya:`);
      for (const item of request.contextPack.recentTopics) {
        parts.push(`- [${item.type === "SESSION" ? "Topik Pertemuan" : "Judul Tugas"}] ${item.topic}`);
      }
    }
  }

  parts.push(`\n--- PETUNJUK FORMAT OUTPUT ---`);
  parts.push(`1. Berikan Judul Konten yang jelas dan menarik pada baris pertama menggunakan heading '# Judul'.`);
  parts.push(`2. Susun isi konten pembelajaran dalam format Markdown yang rapi, runtut, dan mudah dibaca.`);
  parts.push(`3. Jangan sertakan metadata JSON atau blok kode pembungkus di luar draf.`);

  return parts.join("\n");
}

/**
 * Constructs the refinement prompt for one-shot iterative adjustment.
 */
export function constructRefinementPrompt(request: AiProviderRefineRequest): string {
  const parts: string[] = [];

  parts.push(`JENIS KONTEN: ${CONTENT_TYPE_LABELS[request.contentType].title}`);
  parts.push(`DRAF SAAT INI:`);
  parts.push(`Judul: ${request.currentTitle}`);
  parts.push(`Konten:\n${request.currentContent}`);
  parts.push(`\n--- PERMINTAAN PENYESUAIAN GURU ---`);
  parts.push(`Instruksi Perubahan: "${request.refinementInstruction}"`);

  if (request.contextPack) {
    parts.push(`\nKonteks Kelas: ${request.contextPack.subjectName} (${request.contextPack.className})`);
  }

  parts.push(`\n--- PETUNJUK OUTPUT ---`);
  parts.push(`1. Hasilkan draf versi baru yang telah diperbarui sesuai instruksi.`);
  parts.push(`2. Sertakan judul pada baris pertama (# Judul).`);
  parts.push(`3. Tuliskan konten lengkap hasil perbaikan dalam format Markdown.`);

  return parts.join("\n");
}

/**
 * Validates and parses untrusted raw AI output into clean title and content.
 */
export function validateAiOutput(rawText: string): { title: string; content: string } {
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("Output AI kosong atau tidak valid.");
  }

  const trimmed = rawText.trim();
  const lines = trimmed.split("\n").map((l) => l.trim());

  // Find first non-empty line to extract title
  let title = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line) {
      // Remove leading markdown headers (e.g. #, ##, **, etc.)
      title = line.replace(/^[#*`\s-]+/, "").replace(/[*`]+$/, "").trim();
      break;
    }
  }

  if (!title || title.length < 2) {
    throw new Error("Output AI tidak memiliki judul yang valid.");
  }

  // Cap title length
  if (title.length > 200) {
    title = title.substring(0, 197) + "...";
  }

  // The full content is the raw markdown (or from the beginning)
  const content = trimmed;

  if (content.length < 10) {
    throw new Error("Output AI terlalu pendek atau tidak lengkap.");
  }

  return {
    title,
    content,
  };
}
