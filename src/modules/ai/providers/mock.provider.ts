import { AiContentProvider } from "./ai-provider.interface";
import {
  AiProviderGenerateRequest,
  AiProviderRefineRequest,
  AiProviderResult,
} from "../ai.types";

export interface MockProviderOptions {
  shouldTimeout?: boolean;
  shouldRateLimit?: boolean;
  shouldReturnMalformed?: boolean;
  shouldReturnEmpty?: boolean;
  customErrorMessage?: string;
  delayMs?: number;
}

export class MockAiContentProvider implements AiContentProvider {
  readonly name = "mock";
  private options: MockProviderOptions;

  constructor(options: MockProviderOptions = {}) {
    this.options = options;
  }

  setOptions(options: MockProviderOptions) {
    this.options = { ...this.options, ...options };
  }

  async generate(request: AiProviderGenerateRequest): Promise<AiProviderResult> {
    if (this.options.delayMs) {
      await new Promise((r) => setTimeout(r, this.options.delayMs));
    }

    if (this.options.shouldTimeout) {
      throw new Error("Provider timeout: Permintaan ke penyedia AI melebihi batas waktu.");
    }

    if (this.options.shouldRateLimit) {
      throw new Error("Provider rate limit (429): Batas kuota permintaan AI tercapai. Silakan coba sesaat lagi.");
    }

    if (this.options.customErrorMessage) {
      throw new Error(this.options.customErrorMessage);
    }

    if (this.options.shouldReturnEmpty) {
      return {
        title: "",
        content: "",
        modelUsed: "mock-model-v1",
      };
    }

    if (this.options.shouldReturnMalformed) {
      return {
        title: "",
        content: "Malformed response without required structure",
        modelUsed: "mock-model-v1",
      };
    }

    const contextStr = request.contextPack
      ? ` (${request.contextPack.subjectName} - Kelas ${request.contextPack.className})`
      : "";

    switch (request.contentType) {
      case "LESSON_PLAN":
        return {
          title: `Rencana Pembelajaran: ${request.topic}${contextStr}`,
          content: [
            `# Rencana Aktivitas Pembelajaran: ${request.topic}`,
            ``,
            `## Alokasi Waktu & Sasaran`,
            `- Mata Pelajaran / Kelas: ${request.contextPack ? `${request.contextPack.subjectName} / ${request.contextPack.className}` : "Umum"}`,
            `- Topik: ${request.topic}`,
            `- Nada Penyampaian: ${request.tone || "STANDARD"}`,
            ``,
            `## 1. Pendahuluan (15 Menit)`,
            `- Guru menyapa siswa dan memimpin doa.`,
            `- Apersepsi: Mengaitkan topik "${request.topic}" dengan kehidupan sehari-hari siswa.`,
            `- Menyampaikan tujuan pembelajaran yang akan dicapai.`,
            ``,
            `## 2. Kegiatan Inti (50 Menit)`,
            `- Eksplorasi: Siswa mengamati pemaparan materi dasar seputar ${request.topic}.`,
            `- Kolaborasi: Diskusi kelompok terarah untuk menganalisis studi kasus atau soal tantangan.`,
            `- Presentasi: Perwakilan kelompok menyampaikan hasil diskusi singkat di depan kelas.`,
            ``,
            `## 3. Penutup & Refleksi (15 Menit)`,
            `- Guru bersama siswa menyimpulkan poin-poin utama.`,
            `- Refleksi singkat: Siswa menyampaikan pemahaman dan kesulitan yang dialami.`,
            `- Guru memberikan umpan balik dan pengingat untuk pertemuan berikutnya.`,
          ].join("\n"),
          modelUsed: "mock-model-v1",
        };

      case "LEARNING_MATERIAL":
        return {
          title: `Ringkasan Materi: ${request.topic}${contextStr}`,
          content: [
            `# Materi & Ringkasan Pembelajaran: ${request.topic}`,
            ``,
            `## Konsep Utama`,
            `Pembahasan materi seputar **${request.topic}** berfokus pada pemahaman fundamental, konsep kunci, dan penerapannya dalam kehidupan nyata.`,
            ``,
            `## Poin-Poin Penting`,
            `1. **Pengertian & Definisi**: Dasar dari konsep ${request.topic}.`,
            `2. **Karakteristik & Ciri-Ciri**: Hal-hal pembeda yang esensial.`,
            `3. **Contoh Nyata**: Penerapan langsung yang relevan untuk peserta didik.`,
            ``,
            `## Rangkuman Singkat`,
            `- Siswa diharapkan mampu memahami dan menjelaskan kembali konsep utama ${request.topic}.`,
          ].join("\n"),
          modelUsed: "mock-model-v1",
        };

      case "TASK_INSTRUCTION":
        return {
          title: `Instruksi Tugas: ${request.topic}${contextStr}`,
          content: [
            `# Lembar Instruksi Tugas: ${request.topic}`,
            ``,
            `## Tujuan Tugas`,
            `Mengembangkan kemampuan analisis dan penerapan konsep **${request.topic}**.`,
            ``,
            `## Petunjuk Pengerjaan`,
            `1. Bacalah materi pendukung mengenai topik ini dengan cermat.`,
            `2. Kerjakan tugas secara mandiri atau kelompok sesuai arahan guru di kelas.`,
            `3. Tuliskan jawaban atau hasil kerja secara terstruktur dan rapi.`,
            ``,
            `## Format & Batas Pengumpulan`,
            `- Format: Tulisan tangan di buku tugas / lembar kerja.`,
            `- Kumpulkan pada waktu yang telah disepakati bersama di kelas.`,
          ].join("\n"),
          modelUsed: "mock-model-v1",
        };

      case "RUBRIC":
        return {
          title: `Rubrik Kriteria Penilaian: ${request.topic}${contextStr}`,
          content: [
            `# Rubrik Kriteria Penilaian: ${request.topic}`,
            ``,
            `## Kriteria Deskriptif Kualitatif`,
            ``,
            `| Aspek Penilaian | Sangat Baik (4) | Baik (3) | Cukup (2) | Perlu Bimbingan (1) |`,
            `| :--- | :--- | :--- | :--- | :--- |`,
            `| **Penguasaan Konsep** | Menjelaskan konsep ${request.topic} dengan sangat tepat dan mendalam. | Menjelaskan sebagian besar konsep dengan benar. | Memahami konsep dasar namun terdapat beberapa kekeliruan. | Belum memahami konsep dasar secara mandiri. |`,
            `| **Keterampilan Penerapan** | Menerapkan konsep pada contoh kasus secara kreatif dan tepat. | Menerapkan konsep pada kasus dengan benar. | Memerlukan sedikit panduan dalam penerapan. | Memerlukan bimbingan penuh dari guru. |`,
            `| **Kerapian & Kejelasan** | Hasil kerja sangat rapi, terstruktur, dan jelas. | Hasil kerja rapi dan mudah dipahami. | Cukup terstruktur namun kurang rapi. | Kurang terstruktur dan sulit dipahami. |`,
          ].join("\n"),
          modelUsed: "mock-model-v1",
        };

      default:
        return {
          title: `Draf Pembelajaran: ${request.topic}`,
          content: `Konten draft untuk topik ${request.topic}.`,
          modelUsed: "mock-model-v1",
        };
    }
  }

  async refine(request: AiProviderRefineRequest): Promise<AiProviderResult> {
    if (this.options.delayMs) {
      await new Promise((r) => setTimeout(r, this.options.delayMs));
    }

    if (this.options.shouldTimeout) {
      throw new Error("Provider timeout: Permintaan penyesuaian AI melebihi batas waktu.");
    }

    if (this.options.shouldRateLimit) {
      throw new Error("Provider rate limit (429): Batas kuota permintaan AI tercapai. Silakan coba sesaat lagi.");
    }

    if (this.options.customErrorMessage) {
      throw new Error(this.options.customErrorMessage);
    }

    return {
      title: `${request.currentTitle} (Disesuaikan)`,
      content: [
        request.currentContent,
        ``,
        `---`,
        `> **Catatan Penyesuaian (${request.refinementInstruction}):**`,
        `- Konten telah diperbarui sesuai arahan: "${request.refinementInstruction}".`,
      ].join("\n"),
      modelUsed: "mock-model-v1",
    };
  }
}
