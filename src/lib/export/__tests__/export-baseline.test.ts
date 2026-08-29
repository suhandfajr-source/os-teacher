import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import fs from "fs";
import { exportToWord } from "../word-exporter";
import { exportToPdf } from "../pdf-exporter";
import { exportToPowerPoint } from "../ppt-exporter";
import { exportToExcel } from "../excel-exporter";
import { exportAiDocument } from "../index";

vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<{ default: { prototype: { save: () => void } }; jsPDF: { prototype: { save: () => void } } }>();
  if (actual.default?.prototype) actual.default.prototype.save = vi.fn();
  if (actual.jsPDF?.prototype) actual.jsPDF.prototype.save = vi.fn();
  return actual;
});

vi.mock("pptxgenjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pptxgenjs")>();
  return {
    default: class extends actual.default {
      writeFile = vi.fn().mockResolvedValue(true);
    },
  };
});

vi.mock("xlsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

describe("AI Studio Export Baseline Characterization", () => {
  afterAll(() => {
    const artifacts = ["Draf_Dokumen.pdf", "Modul_Ajar_Matematika.pdf"];
    for (const file of artifacts) {
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch {
          // ignore
        }
      }
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    (globalThis as unknown as { window: unknown }).window = globalThis;

    // Mock DOM environment APIs if not present in Node
    if (typeof globalThis.document === "undefined") {
      globalThis.document = {
        createElement: vi.fn(() => ({
          href: "",
          download: "",
          click: vi.fn(),
        })),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as unknown as Document;
    }

    if (typeof globalThis.URL.createObjectURL === "undefined") {
      globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
      globalThis.URL.revokeObjectURL = vi.fn();
    }
  });

  describe("DOCX Exporter (exportToWord)", () => {
    it("generates a non-empty Word Blob for basic structured Markdown content", async () => {
      const blob = await exportToWord({
        title: "Rencana Pembelajaran Fisika",
        content: "# Pendahuluan\n- Konsep Hukum Newton\n- Contoh penerapan nyata",
        schoolName: "SMA Negeri 1",
        subjectName: "Fisika",
        teacherName: "Budi Setiawan",
      });

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
    });

    it("handles table Markdown syntax cleanly", async () => {
      const blob = await exportToWord({
        title: "Rubrik Penilaian",
        content: "| Kriteria | Skor 1 | Skor 2 |\n|---|---|---|\n| Pemahaman | Kurang | Baik |",
      });

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe("PDF Exporter (exportToPdf)", () => {
    it("generates PDF without throwing for standard text content", async () => {
      await expect(
        exportToPdf({
          title: "Modul Ajar Matematika",
          content: "## Tujuan Pembelajaran\nSiswa dapat menyelesaikan persamaan linear satu variabel.",
          schoolName: "SMP Budi Luhur",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("PPTX Exporter (exportToPowerPoint)", () => {
    it("processes content sections into presentation output", async () => {
      await expect(
        exportToPowerPoint({
          title: "Struktur Sel Tumbuhan",
          content: "# Bagian Sel\n- Dinding Sel\n- Kloroplas\n- Vakuola",
          subjectName: "Biologi",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("XLSX Exporter (exportToExcel)", () => {
    it("converts tabular Markdown content to structured Excel workbook output", async () => {
      await expect(
        exportToExcel({
          title: "Kisi-Kisi Asesmen",
          content: "| No | Indikator | Bentuk Soal |\n| 1 | Menjelaskan fotosintesis | Pilihan Ganda |",
          subjectName: "IPA",
        })
      ).resolves.not.toThrow();
    });

    it("handles non-tabular content gracefully as a numbered list", async () => {
      await expect(
        exportToExcel({
          title: "Poin Pembelajaran",
          content: "- Poin Pertama\n- Poin Kedua",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("Unified Export Router (exportAiDocument)", () => {
    it("dispatches docx export correctly", async () => {
      await expect(
        exportAiDocument({
          format: "docx",
          title: "Draf Dokumen",
          content: "Konten dokumen",
        })
      ).resolves.not.toThrow();
    });

    it("dispatches pdf export correctly", async () => {
      await expect(
        exportAiDocument({
          format: "pdf",
          title: "Draf Dokumen",
          content: "Konten dokumen",
        })
      ).resolves.not.toThrow();
    });

    it("dispatches pptx export correctly", async () => {
      await expect(
        exportAiDocument({
          format: "pptx",
          title: "Draf Presentasi",
          content: "# Judul Slide\n- Poin slide",
        })
      ).resolves.not.toThrow();
    });

    it("dispatches xlsx export correctly", async () => {
      await expect(
        exportAiDocument({
          format: "xlsx",
          title: "Draf Spreadsheet",
          content: "| Kolom 1 | Kolom 2 |\n| A | B |",
        })
      ).resolves.not.toThrow();
    });

    it("rejects unsupported format with clear error", async () => {
      await expect(
        exportAiDocument({
          format: "unsupported_fmt" as unknown as import("../index").ExportFormat,
          title: "Test",
          content: "Test",
        })
      ).rejects.toThrow("Format ekspor tidak didukung");
    });
  });
});
