import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseMarkdownForPpt } from "../ppt-parser";
import { resolvePresentationLayout } from "../ppt-layout-resolver";
import { renderPresentationPptx } from "../ppt-renderer";
import { exportToPowerPoint } from "../../ppt-exporter";
import {
  PresentationMetadata,
  PresentationModel,
  CoverSlide,
  ContentSlide,
} from "../ppt-types";

interface MockShapeCall {
  type: string;
  opts: unknown;
}

interface MockTextCall {
  text: unknown;
  opts: unknown;
}

interface MockSlideInstance {
  background: unknown;
  shapes: MockShapeCall[];
  texts: MockTextCall[];
  addShape: ReturnType<typeof vi.fn>;
  addText: ReturnType<typeof vi.fn>;
}

// Mock PptxGenJS for isolated test environment
vi.mock("pptxgenjs", () => {
  return {
    default: class MockPptxGen {
      layout = "LAYOUT_16x9";
      author = "";
      company = "";
      title = "";
      slides: MockSlideInstance[] = [];
      ShapeType = {
        rect: "rect",
        roundRect: "roundRect",
        line: "line",
      };

      addSlide() {
        const slide: MockSlideInstance = {
          background: null,
          shapes: [],
          texts: [],
          addShape: vi.fn((type: string, opts: unknown) => {
            slide.shapes.push({ type, opts });
          }),
          addText: vi.fn((text: unknown, opts: unknown) => {
            slide.texts.push({ text, opts });
          }),
        };
        this.slides.push(slide);
        return slide;
      }

      writeFile = vi.fn().mockResolvedValue(true);
    },
  };
});

describe("AI STUDIO EXPORT V2 — Phase A: Automatic PPTX Generator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. PARSER UNIT TESTS
  // --------------------------------------------------------------------------
  describe("PPT Markdown Parser (parseMarkdownForPpt)", () => {
    it("handles empty or whitespace-only content gracefully", () => {
      const parsed = parseMarkdownForPpt("", "Judul Default");
      expect(parsed.documentTitle).toBe("Judul Default");
      expect(parsed.sections).toHaveLength(0);

      const parsedWhitespace = parseMarkdownForPpt("   \n\n  ", "Judul Default");
      expect(parsedWhitespace.sections).toHaveLength(0);
    });

    it("parses headings and extracts top-level document title from H1", () => {
      const md = `# Sistem Pernapasan Manusia\n\n## Organ Pernapasan\n- Hidung\n- Trakea\n- Paru-paru`;
      const parsed = parseMarkdownForPpt(md);

      expect(parsed.documentTitle).toBe("Sistem Pernapasan Manusia");
      expect(parsed.sections).toHaveLength(1);
      expect(parsed.sections[0].heading).toBe("Organ Pernapasan");
      expect(parsed.sections[0].items).toHaveLength(3);
    });

    it("detects Learning Objectives section semantically", () => {
      const md = `## Tujuan Pembelajaran\n- Memahami konsep fotosintesis\n- Mengidentifikasi organel kloroplas`;
      const parsed = parseMarkdownForPpt(md);

      expect(parsed.sections[0].type).toBe("OBJECTIVES");
      expect(parsed.sections[0].items).toHaveLength(2);
    });

    it("detects Takeaway / Summary section semantically", () => {
      const md = `## Kesimpulan\n- Fotosintesis menghasilkan oksigen dan glukosa\n- Cahaya matahari adalah sumber energi utama`;
      const parsed = parseMarkdownForPpt(md);

      expect(parsed.sections[0].type).toBe("TAKEAWAY");
      expect(parsed.sections[0].items).toHaveLength(2);
    });

    it("detects nested bullet subpoints when indented", () => {
      const md = `## Struktur Ginjal\n- Korteks Ginjal\n  - Berisi jutaan nefron\n  - Tempat filtrasi darah awal\n- Medula Ginjal`;
      const parsed = parseMarkdownForPpt(md);

      expect(parsed.sections[0].items).toHaveLength(2);
      expect(parsed.sections[0].items[0].text).toBe("Korteks Ginjal");
      expect(parsed.sections[0].items[0].subpoints).toEqual([
        "Berisi jutaan nefron",
        "Tempat filtrasi darah awal",
      ]);
      expect(parsed.sections[0].items[1].text).toBe("Medula Ginjal");
      expect(parsed.sections[0].items[1].subpoints).toBeUndefined();
    });

    it("parses numbered lists as bullet items accurately", () => {
      const md = `## Langkah Siklus Air\n1. Evaporasi air laut\n2. Kondensasi awan\n3. Presipitasi hujan`;
      const parsed = parseMarkdownForPpt(md);

      expect(parsed.sections[0].items).toHaveLength(3);
      expect(parsed.sections[0].items[0].text).toBe("Evaporasi air laut");
      expect(parsed.sections[0].items[1].text).toBe("Kondensasi awan");
      expect(parsed.sections[0].items[2].text).toBe("Presipitasi hujan");
    });

    it("handles explicit Kuis heading as QUIZ section", () => {
      const md = `## Kuis Cepat\n- Apa fungsi utama kloroplas?\n- Mengapa daun berwarna hijau?`;
      const parsed = parseMarkdownForPpt(md);

      expect(parsed.sections[0].type).toBe("QUIZ");
      expect(parsed.sections[0].items).toHaveLength(2);
    });

    it("handles explicit Refleksi / Pertanyaan Refleksi heading as REFLECTION section", () => {
      const md = `## Pertanyaan Refleksi\n- Apa hal paling menarik yang kamu pelajari hari ini?`;
      const parsed = parseMarkdownForPpt(md);

      expect(parsed.sections[0].type).toBe("REFLECTION");
    });

    it("CRITICAL: ordinary sentence ending in '?' in normal section remains CONTENT", () => {
      const md = `## Pengantar Ekosistem\nApakah ekosistem hutan sama dengan ekosistem laut?\n- Ekosistem darat memiliki produsen berupa pohon`;
      const parsed = parseMarkdownForPpt(md);

      expect(parsed.sections[0].type).toBe("CONTENT");
    });

    it("retains deterministic output for identical input", () => {
      const md = `## Poin Inti\n- Poin Satu\n- Poin Dua`;
      const p1 = parseMarkdownForPpt(md);
      const p2 = parseMarkdownForPpt(md);

      expect(p1).toEqual(p2);
    });

    it("handles Unicode & Indonesian characters cleanly without crashing", () => {
      const md = `## Analisis Bahasa Indonesia “Baku” & ‘Non-Baku’\n- Penggunaan kata hubung “sehingga” & “namun”\n- Contoh: “Ayah membaca koran; Ibu memasak.”`;
      const parsed = parseMarkdownForPpt(md);

      expect(parsed.sections[0].items).toHaveLength(2);
      expect(parsed.sections[0].items[0].text).toContain("“sehingga”");
    });
  });

  // --------------------------------------------------------------------------
  // 2. DETERMINISTIC LAYOUT RESOLVER TESTS
  // --------------------------------------------------------------------------
  describe("Deterministic Layout Resolver (resolvePresentationLayout)", () => {
    const defaultMeta: PresentationMetadata = {
      title: "Materi IPA Kelas 8",
      schoolName: "SMP Negeri 2",
      subjectName: "IPA",
      teacherName: "Ibu Rahmawati",
      className: "8-A",
      dateFormatted: "29 Agustus 2026",
    };

    it("generates a CoverSlide as the first slide with proper metadata", () => {
      const md = `## Pengenalan\n- Konsep dasar`;
      const parsed = parseMarkdownForPpt(md, defaultMeta.title);
      const model = resolvePresentationLayout(parsed, defaultMeta);

      expect(model.slides.length).toBeGreaterThanOrEqual(2);
      expect(model.slides[0].type).toBe("COVER");
      expect(model.slides[0].title).toBe("Materi IPA Kelas 8");
      const cover = model.slides[0] as CoverSlide;
      expect(cover.schoolName).toBe("SMP Negeri 2");
      expect(cover.teacherName).toBe("Ibu Rahmawati");
    });

    it("gracefully omits missing optional metadata without fabricating data", () => {
      const minimalMeta: PresentationMetadata = {
        title: "Topik Tanpa Sekolah",
      };
      const md = `## Bagian 1\n- Poin materi`;
      const parsed = parseMarkdownForPpt(md, minimalMeta.title);
      const model = resolvePresentationLayout(parsed, minimalMeta);

      const cover = model.slides[0] as CoverSlide;
      expect(cover.schoolName).toBeUndefined();
      expect(cover.teacherName).toBeUndefined();
      expect(cover.className).toBeUndefined();
    });

    it("splits long content (>5 bullets) into continuation slides (1/N, 2/N)", () => {
      const bullets = Array.from({ length: 12 }, (_, i) => `- Poin materi penting nomor ${i + 1}`).join("\n");
      const md = `## Rincian Topik Mendalam\n${bullets}`;

      const parsed = parseMarkdownForPpt(md);
      const model = resolvePresentationLayout(parsed, defaultMeta);

      // Should have Cover + at least 3 content slides (12 items / max 5 per slide = 3 slides)
      const contentSlides = model.slides.filter((s) => s.type === "CONTENT");
      expect(contentSlides.length).toBe(3);

      expect(contentSlides[0].title).toContain("(1/3)");
      expect(contentSlides[1].title).toContain("(2/3)");
      expect(contentSlides[2].title).toContain("(3/3)");
    });

    it("safely splits a single 500+ character bullet into sub-bullets without truncation", () => {
      const veryLongText =
        "Fotosintesis adalah proses biokimia pembentukan zat makanan berenergi tinggi seperti karbohidrat dari bahan anorganik sederhana yang dilakukan oleh seluruh tumbuhan hijau berklorofil di alam semesta. Proses vital yang sangat mengagumkan ini mutlak membutuhkan pasokan energi radiasi cahaya matahari, serapan air dari dalam tanah melalui akar, serta penyerapan gas karbon dioksida dari udara bebas melalui stomata daun. Seluruh komponen tersebut bereaksi secara terpadu di dalam kloroplas sehingga menghasilkan molekul glukosa bergizi tinggi serta melepaskan gas oksigen ke atmosfer bumi yang sangat berharga bagi respirasi kelangsungan hidup manusia dan hewan tanpa henti.";

      expect(veryLongText.length).toBeGreaterThan(500);

      const md = `## Penjelasan Panjang\n- ${veryLongText}`;
      const parsed = parseMarkdownForPpt(md);
      const model = resolvePresentationLayout(parsed, defaultMeta);

      const contentSlides = model.slides.filter((s): s is ContentSlide => s.type === "CONTENT");
      expect(contentSlides.length).toBeGreaterThanOrEqual(1);

      // Verify all chunks are preserved across slides without truncation
      const combined = contentSlides
        .flatMap((s) => s.items)
        .map((i) => i.text.replace("... ", ""))
        .join(" ");

      expect(combined).toContain("Fotosintesis");
      expect(combined).toContain("kelangsungan hidup");
    });

    it("rejects input exceeding MAX_SOURCE_CHARACTERS with an actionable error", () => {
      const hugeText = "A".repeat(50_001);
      const parsed = parseMarkdownForPpt(hugeText);

      expect(() => {
        resolvePresentationLayout(parsed, defaultMeta, hugeText);
      }).toThrow("melebihi batas maksimum");
    });

    it("rejects slide counts exceeding MAX_PRESENTATION_SLIDES with an actionable error", () => {
      // Create 35 distinct sections
      const sections = Array.from(
        { length: 35 },
        (_, i) => `## Bab ${i + 1}\n- Materi bahasan ${i + 1}`
      ).join("\n\n");

      const parsed = parseMarkdownForPpt(sections);

      expect(() => {
        resolvePresentationLayout(parsed, defaultMeta);
      }).toThrow("melebihi batas maksimum presentasi");
    });

    it("maintains total slide numbering consistency across all slides", () => {
      const md = `## Tujuan\n- Tujuan 1\n## Materi\n- Poin 1\n- Poin 2\n## Kesimpulan\n- Ringkasan 1`;
      const parsed = parseMarkdownForPpt(md);
      const model = resolvePresentationLayout(parsed, defaultMeta);

      const total = model.slides.length;
      expect(total).toBe(4); // Cover + Objectives + Content + Takeaway

      model.slides.forEach((s, idx) => {
        expect(s.slideNumber).toBe(idx + 1);
        expect(s.totalSlides).toBe(total);
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. PPTX RENDERER UNIT TESTS
  // --------------------------------------------------------------------------
  describe("PowerPoint PPTX Renderer (renderPresentationPptx)", () => {
    it("renders complete presentation model to PptxGenJS without throwing", async () => {
      const testModel: PresentationModel = {
        metadata: {
          title: "Siklus Air dan Hidrologi",
          schoolName: "SMP Teladan",
          subjectName: "IPA Geografi",
          teacherName: "Pak Hendra",
          className: "7-C",
          dateFormatted: "29 Agustus 2026",
        },
        slides: [
          {
            id: "slide-1",
            type: "COVER",
            title: "Siklus Air dan Hidrologi",
            schoolName: "SMP Teladan",
            subjectName: "IPA Geografi",
            teacherName: "Pak Hendra",
            className: "7-C",
            dateFormatted: "29 Agustus 2026",
            slideNumber: 1,
            totalSlides: 5,
          },
          {
            id: "slide-2",
            type: "OBJECTIVES",
            title: "Tujuan Pembelajaran",
            objectives: ["Menjelaskan evaporasi", "Mengidentifikasi presipitasi"],
            slideNumber: 2,
            totalSlides: 5,
          },
          {
            id: "slide-3",
            type: "CONTENT",
            title: "Tahapan Siklus Hidrologi",
            items: [
              {
                text: "Evaporasi & Transpirasi",
                subpoints: ["Penguapan air dari samudra", "Penguapan dari vegetasi"],
              },
              {
                text: "Kondensasi Awan",
              },
            ],
            slideNumber: 3,
            totalSlides: 5,
          },
          {
            id: "slide-4",
            type: "TAKEAWAY",
            title: "Kesimpulan",
            takeaways: ["Air di bumi mengalami daur ulang terus menerus"],
            slideNumber: 4,
            totalSlides: 5,
          },
          {
            id: "slide-5",
            type: "REFLECTION_OR_QUIZ",
            title: "Kuis Pemahaman",
            isQuiz: true,
            questions: ["Sebutkan 3 jenis presipitasi yang kamu ketahui!"],
            slideNumber: 5,
            totalSlides: 5,
          },
        ],
      };

      await expect(renderPresentationPptx(testModel)).resolves.not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // 4. PPT EXPORTER BRIDGE TESTS
  // --------------------------------------------------------------------------
  describe("PPT Exporter Bridge (exportToPowerPoint)", () => {
    it("successfully runs end-to-end markdown to pptx generation", async () => {
      await expect(
        exportToPowerPoint({
          title: "Sistem Pencernaan Manusia",
          content: `## Tujuan Pembelajaran\n- Siswa dapat mengurutkan saluran pencernaan\n\n## Organ Pencernaan\n- Mulut\n- Kerongkongan\n- Lambung\n- Usus Halus\n\n## Kuis\n- Di manakah enzim ptialin diproduksi?`,
          schoolName: "SMA Negeri 1",
          subjectName: "Biologi",
          teacherName: "Budi Santoso",
          className: "11-MIPA-1",
        })
      ).resolves.not.toThrow();
    });

    it("rejects empty title with clear error", async () => {
      await expect(
        exportToPowerPoint({
          title: "",
          content: "Materi belajar",
        })
      ).rejects.toThrow("Judul materi pembelajaran tidak boleh kosong.");
    });
  });
});
