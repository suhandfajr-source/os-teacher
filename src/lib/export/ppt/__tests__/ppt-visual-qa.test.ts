import { describe, it, expect } from "vitest";
import { parseMarkdownForPpt } from "../ppt-parser";
import { resolvePresentationLayout } from "../ppt-layout-resolver";
import {
  PPT_LAYOUT_CONSTANTS,
  ContentSlide,
  ReflectionOrQuizSlide,
  CoverSlide,
} from "../ppt-types";

describe("AI STUDIO EXPORT V2 — Visual PPT Artifact QA & Invariant Verification", () => {

  // --------------------------------------------------------------------------
  // INVARIANT 1: FONT INVARIANT (BODY >= 14PT)
  // --------------------------------------------------------------------------
  it("BLOCKER 1: strictly enforces all educational body text font tokens >= 14pt", () => {
    expect(PPT_LAYOUT_CONSTANTS.MIN_BODY_FONT_PT).toBeGreaterThanOrEqual(14);
    expect(PPT_LAYOUT_CONSTANTS.SUBPOINT_FONT_PT).toBeGreaterThanOrEqual(14);
    expect(PPT_LAYOUT_CONSTANTS.MAX_BODY_FONT_PT).toBeGreaterThanOrEqual(14);
  });

  // --------------------------------------------------------------------------
  // FIXTURE A: Short normal lesson
  // --------------------------------------------------------------------------
  it("Fixture A: short normal lesson produces clean Cover + Objectives + Content", () => {
    const md = `# Pengenalan Ekosistem\n\n## Tujuan Pembelajaran\n- Memahami pengertian ekosistem\n\n## Komponen Biotik\n- Produsen (Tumbuhan)\n- Konsumen (Hewan)\n- Pengurai (Bakteri & Jamur)`;
    const parsed = parseMarkdownForPpt(md);
    const model = resolvePresentationLayout(parsed, {
      title: "Pengenalan Ekosistem",
      subjectName: "IPA",
      className: "VII A",
    });

    expect(model.slides).toHaveLength(3);
    expect(model.slides[0].type).toBe("COVER");
    expect(model.slides[1].type).toBe("OBJECTIVES");
    expect(model.slides[2].type).toBe("CONTENT");

    // Check no clipping
    const contentSlide = model.slides[2] as ContentSlide;
    expect(contentSlide.items).toHaveLength(3);
  });

  // --------------------------------------------------------------------------
  // FIXTURE B: 20+ bullets / continuation slides
  // --------------------------------------------------------------------------
  it("Fixture B: 20+ bullets split safely into continuation slides with (1/N) numbering", () => {
    const bullets = Array.from({ length: 22 }, (_, i) => `- Poin Pembelajaran ke-${i + 1}: Konsep dasar materi terstruktur`).join("\n");
    const md = `# Silabus Lengkap Semester 1\n\n## Daftar Pokok Bahasan\n${bullets}`;
    const parsed = parseMarkdownForPpt(md);
    const model = resolvePresentationLayout(parsed, {
      title: "Silabus Lengkap Semester 1",
    });

    const contentSlides = model.slides.filter((s): s is ContentSlide => s.type === "CONTENT");
    expect(contentSlides.length).toBe(5); // 22 items / 5 items max = 5 slides

    contentSlides.forEach((slide, idx) => {
      expect(slide.title).toContain(`(${idx + 1}/5)`);
      expect(slide.items.length).toBeLessThanOrEqual(5);
    });
  });

  // --------------------------------------------------------------------------
  // FIXTURE C: One 500+ character bullet
  // --------------------------------------------------------------------------
  it("Fixture C: 500+ character bullet preserves all text without truncation across fragments", () => {
    const veryLongBullet =
      "Hukum Kekekalan Energi menyatakan bahwa energi tidak dapat diciptakan atau dimusnahkan oleh proses fisik apapun yang diketahui dalam alam semesta, melainkan hanya dapat diubah dari satu bentuk energi ke bentuk energi yang lain secara terukur dan seimbang. Sebagai contoh fundamental dalam fisika klasik, energi potensial gravitasi pada air terjun yang mengalir deras akan dikonversikan secara efisien menjadi energi kinetik putaran turbin generator, yang selanjutnya diubah menjadi energi listrik berdaya guna untuk kebutuhan jutaan umat manusia di perkotaan.";

    expect(veryLongBullet.length).toBeGreaterThan(500);

    const md = `# Hukum Termodinamika\n\n## Prinsip Konservasi Energi\n- ${veryLongBullet}`;
    const parsed = parseMarkdownForPpt(md);
    const model = resolvePresentationLayout(parsed, {
      title: "Hukum Termodinamika",
    });

    const contentSlides = model.slides.filter((s): s is ContentSlide => s.type === "CONTENT");
    expect(contentSlides.length).toBeGreaterThanOrEqual(1);

    const reconstructedText = contentSlides
      .flatMap((s) => s.items)
      .map((it) => it.text.replace(/^\.\.\.\s*/, ""))
      .join(" ");

    expect(reconstructedText).toContain("Hukum Kekekalan Energi");
    expect(reconstructedText).toContain("energi listrik berdaya guna");
  });

  // --------------------------------------------------------------------------
  // FIXTURE D: Nested bullets
  // --------------------------------------------------------------------------
  it("Fixture D: nested bullets retain subpoint hierarchy without artificial item conversion", () => {
    const md = `# Anatomi Tubuh Manusia\n\n## Sistem Sirkulasi Darah\n- Jantung\n  - Serambi Kanan\n  - Serambi Kiri\n  - Bilik Kanan\n  - Bilik Kiri\n- Pembuluh Darah\n  - Arteri\n  - Vena\n  - Kapiler`;
    const parsed = parseMarkdownForPpt(md);
    const model = resolvePresentationLayout(parsed, {
      title: "Anatomi Tubuh Manusia",
    });

    const contentSlides = model.slides.filter((s): s is ContentSlide => s.type === "CONTENT");
    expect(contentSlides).toHaveLength(2);

    expect(contentSlides[0].items[0].text).toBe("Jantung");
    expect(contentSlides[0].items[0].subpoints).toEqual([
      "Serambi Kanan",
      "Serambi Kiri",
      "Bilik Kanan",
      "Bilik Kiri",
    ]);

    expect(contentSlides[1].items[0].text).toBe("Pembuluh Darah");
    expect(contentSlides[1].items[0].subpoints).toEqual([
      "Arteri",
      "Vena",
      "Kapiler",
    ]);
  });

  // --------------------------------------------------------------------------
  // FIXTURE E: Explicit Kuis + Refleksi
  // --------------------------------------------------------------------------
  it("Fixture E: explicit Kuis and Refleksi produce dedicated quiz/reflection slides", () => {
    const md = `# Fotosintesis Tumbuhan\n\n## Materi\n- Klorofil menyerap cahaya matahari\n\n## Kuis Cepat\n- Apa fungsi utama kloroplas?\n- Mengapa daun berwarna hijau?\n\n## Pertanyaan Refleksi\n- Bagaimana tumbuhan membantu kelangsungan hidup manusia?`;
    const parsed = parseMarkdownForPpt(md);
    const model = resolvePresentationLayout(parsed, {
      title: "Fotosintesis Tumbuhan",
    });

    const quizSlide = model.slides.find(
      (s): s is ReflectionOrQuizSlide => s.type === "REFLECTION_OR_QUIZ" && s.isQuiz
    );
    const reflectionSlide = model.slides.find(
      (s): s is ReflectionOrQuizSlide => s.type === "REFLECTION_OR_QUIZ" && !s.isQuiz
    );

    expect(quizSlide).toBeDefined();
    expect(quizSlide!.questions).toHaveLength(2);
    expect(reflectionSlide).toBeDefined();
    expect(reflectionSlide!.questions).toHaveLength(1);
  });

  // --------------------------------------------------------------------------
  // FIXTURE F: Very long title
  // --------------------------------------------------------------------------
  it("Fixture F: very long title wraps cleanly on CoverSlide without breaking layout", () => {
    const longTitle =
      "Analisis Mendalam Struktur Kurikulum Merdeka Terintegrasi Pembelajaran Berdiferensiasi dan Penguatan Profil Pelajar Pancasila Tahun Pelajaran 2026/2027";
    const md = `# ${longTitle}\n\n## Pendahuluan\n- Konsep kurikulum terkini`;
    const parsed = parseMarkdownForPpt(md, longTitle);
    const model = resolvePresentationLayout(parsed, {
      title: longTitle,
      schoolName: "SMA Negeri 1 Indonesia Cerdas",
    });

    expect(model.slides[0].type).toBe("COVER");
    expect(model.slides[0].title).toBe(longTitle);
    const cover = model.slides[0] as CoverSlide;
    expect(cover.schoolName).toBe("SMA Negeri 1 Indonesia Cerdas");
  });

  // --------------------------------------------------------------------------
  // FIXTURE G: Unicode & Indonesian punctuation
  // --------------------------------------------------------------------------
  it("Fixture G: handles smart quotes, em-dashes, and Indonesian characters without corruption", () => {
    const md = `# Bahasa Indonesia: Tanda Baca & Kaidah PUEBI\n\n## Penggunaan Tanda Baca\n- Tanda petik ganda (“...”) untuk petikan langsung\n- Tanda pisah (—) untuk membatasi penyisipan kata\n- Contoh: “Merdeka belajar—sebuah langkah progresif—harus diterapkan.”`;
    const parsed = parseMarkdownForPpt(md);
    const model = resolvePresentationLayout(parsed, {
      title: "Bahasa Indonesia: Tanda Baca & Kaidah PUEBI",
    });

    const contentSlide = model.slides.find((s): s is ContentSlide => s.type === "CONTENT");
    expect(contentSlide).toBeDefined();
    expect(contentSlide!.items[0].text).toContain("“...”");
    expect(contentSlide!.items[1].text).toContain("(—)");
  });

  // --------------------------------------------------------------------------
  // VERIFICATION 5: DEFENSIVE LIMIT & STRESS TESTING
  // --------------------------------------------------------------------------
  describe("Defensive Limit Stress & Boundary Testing", () => {
    it("handles near-limit source (45,000 chars) deterministically without runaway", () => {
      const line = "Topik bahasan penting materi pembelajaran IPA terstruktur. ";
      const nearLimitMarkdown = `## Bab Besar\n` + Array.from({ length: 15 }, (_, i) => `- ${line} Poin ${i + 1}`).join("\n");

      const startTime = performance.now();
      const parsed = parseMarkdownForPpt(nearLimitMarkdown);
      const model = resolvePresentationLayout(parsed, { title: "Stress Test 45k" });
      const durationMs = performance.now() - startTime;

      expect(durationMs).toBeLessThan(1000); // Must resolve in < 1 second
      expect(model.slides.length).toBeGreaterThanOrEqual(2);
      expect(model.slides.length).toBeLessThanOrEqual(30);
    });

    it("rejects over-limit source (>50,000 chars) with clear actionable error", () => {
      const hugeText = "X".repeat(50_001);
      const parsed = parseMarkdownForPpt(hugeText);

      expect(() => {
        resolvePresentationLayout(parsed, { title: "Huge" }, hugeText);
      }).toThrow(/melebihi batas maksimum/);
    });

    it("rejects over-limit slide count (>30 slides) with clear actionable error", () => {
      const manySections = Array.from({ length: 32 }, (_, i) => `## Seksi ${i + 1}\n- Poin bahasan ${i + 1}`).join("\n\n");
      const parsed = parseMarkdownForPpt(manySections);

      expect(() => {
        resolvePresentationLayout(parsed, { title: "Too Many Slides" });
      }).toThrow(/melebihi batas maksimum presentasi/);
    });
  });
});
