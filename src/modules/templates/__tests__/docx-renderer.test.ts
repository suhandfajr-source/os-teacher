import { describe, it, expect } from "vitest";
import PizZip from "pizzip";
import { validateAndParseDocxTemplate } from "../docx-placeholder-parser";
import {
  extractSectionByHeading,
  normalizeMarkdownToPlainText,
  renderDocxTemplate,
} from "../docx-template-renderer";

function createDocxWithDocXml(docXml: string, headerXml?: string, footerXml?: string): Buffer {
  const zip = new PizZip();
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`;

  zip.file("[Content_Types].xml", contentTypes);
  zip.file("word/document.xml", docXml);
  if (headerXml) zip.file("word/header1.xml", headerXml);
  if (footerXml) zip.file("word/footer1.xml", footerXml);

  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

describe("PHASE B: DOCX Placeholder Parser & Renderer", () => {
  describe("Split-Run Formatting Contract", () => {
    it("PASS: single-run placeholder parses and renders cleanly", async () => {
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>{{JUDUL}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

      const docx = createDocxWithDocXml(docXml);
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");
      expect(res.valid).toBe(true);

      const rendered = await renderDocxTemplate(docx, res.manifest!, {
        title: "RPP Bahasa Indonesia",
        content: "Materi teks negosiasi.",
        contentType: "LESSON_PLAN",
      });

      expect(rendered.length).toBeGreaterThan(0);
    });

    it("PASS: split-run placeholder with same/compatible formatting parses cleanly", async () => {
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:r><w:rPr><w:b/></w:rPr><w:t>{{JU</w:t></w:r>
            <w:r><w:rPr><w:b/></w:rPr><w:t>DUL}}</w:t></w:r>
          </w:p>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

      const docx = createDocxWithDocXml(docXml);
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");
      expect(res.valid).toBe(true);
      expect(res.manifest?.recognized).toContain("JUDUL");
    });

    it("FAIL: split-run placeholder with conflicting formatting is rejected", async () => {
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p>
            <w:r><w:rPr><w:b/></w:rPr><w:t>{{JU</w:t></w:r>
            <w:r><w:rPr><w:i/></w:rPr><w:t>DUL}}</w:t></w:r>
          </w:p>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

      const docx = createDocxWithDocXml(docXml);
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/terpecah dengan pemformatan yang bertentangan/);
    });
  });

  describe("Table, Header, and Footer Placeholders", () => {
    it("handles placeholders located in table cells, headers, and footers", async () => {
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:tbl>
            <w:tr>
              <w:tc><w:p><w:r><w:t>{{MATA_PELAJARAN}}</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>{{KELAS}}</w:t></w:r></w:p></w:tc>
            </w:tr>
          </w:tbl>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

      const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p><w:r><w:t>{{NAMA_SEKOLAH}}</w:t></w:r></w:p>
      </w:hdr>`;

      const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p><w:r><w:t>{{TANGGAL}}</w:t></w:r></w:p>
      </w:ftr>`;

      const docx = createDocxWithDocXml(docXml, headerXml, footerXml);
      const res = await validateAndParseDocxTemplate(docx, "LEARNING_MATERIAL");

      expect(res.valid).toBe(true);
      expect(res.manifest?.hasHeaders).toBe(true);
      expect(res.manifest?.hasFooters).toBe(true);
      expect(res.manifest?.hasTables).toBe(true);
      expect(res.manifest?.recognized).toEqual(
        ["ISI_KONTEN", "KELAS", "MATA_PELAJARAN", "NAMA_SEKOLAH", "TANGGAL"].sort()
      );
    });
  });

  describe("Unsupported Placeholder Enforcement", () => {
    it("BLOCKS upload when template contains unsupported placeholders", async () => {
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>{{JUDUL}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{NILAI_SISWA}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{FOTO_PROFIL}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

      const docx = createDocxWithDocXml(docXml);
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");

      expect(res.valid).toBe(false);
      expect(res.unsupportedTags).toEqual(["FOTO_PROFIL", "NILAI_SISWA"]);
      expect(res.error).toMatch(/NILAI_SISWA/);
    });

    it("BLOCKS upload when template has zero content-bearing placeholders", async () => {
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>{{NAMA_SEKOLAH}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{GURU}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

      const docx = createDocxWithDocXml(docXml);
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");

      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/harus memuat setidaknya satu tag konten/);
    });
  });

  describe("Markdown Normalization & Conservative Semantic Extraction", () => {
    it("normalizes Markdown formatting without leaking raw syntax", () => {
      const md = "# Judul Utama\n\n**Teks Tebal** dan *Miring*.\n\n- Poin 1\n- Poin 2\n\n1. Langkah A\n2. Langkah B";
      const clean = normalizeMarkdownToPlainText(md);

      expect(clean).not.toContain("#");
      expect(clean).not.toContain("**");
      expect(clean).not.toContain("*");
      expect(clean).toContain("• Poin 1");
      expect(clean).toContain("• Poin 2");
      expect(clean).toContain("Langkah A");
    });

    it("extracts sections using conservative heading aliases strictly", () => {
      const md = `## Tujuan Pembelajaran\n- Siswa dapat menganalisis teks.\n\n## Capaian Pembelajaran\n- Pengetahuan umum.\n\n## Langkah-Langkah\n- Kegiatan pembuka 10 menit.`;

      // Conservative alias: "Tujuan Pembelajaran", "Tujuan"
      const tujuan = extractSectionByHeading(md, ["Tujuan Pembelajaran", "Tujuan"]);
      expect(tujuan).toContain("Siswa dapat menganalisis teks");
      expect(tujuan).not.toContain("Pengetahuan umum");

      // Capaian Pembelajaran is NOT mapped to Tujuan Pembelajaran
      const cap = extractSectionByHeading(md, ["Capaian Pembelajaran"]);
      expect(cap).toContain("Pengetahuan umum");

      // Langkah-langkah
      const langkah = extractSectionByHeading(md, ["Kegiatan Pembelajaran", "Langkah-Langkah", "Aktivitas"]);
      expect(langkah).toContain("Kegiatan pembuka 10 menit");
    });

    it("REGRESSION: ## Capaian Pembelajaran does NOT populate TUJUAN_PEMBELAJARAN", () => {
      const md = `# Modul Biologi
## Capaian Pembelajaran
Peserta didik memahami struktur sel secara menyeluruh.

## Materi
Penjelasan sitoplasma.`;

      const tpAliases = ["Tujuan Pembelajaran", "Tujuan"];
      const tpContent = extractSectionByHeading(md, tpAliases);
      expect(tpContent).toBe("");
    });

    it("REGRESSION: ## Kompetensi Dasar does NOT populate TUJUAN_PEMBELAJARAN", () => {
      const md = `# Modul Kimia
## Kompetensi Dasar
3.1 Menganalisis struktur atom dan tabel periodik.

## Uraian Materi
Materi konfigurasi elektron.`;

      const tpAliases = ["Tujuan Pembelajaran", "Tujuan"];
      const tpContent = extractSectionByHeading(md, tpAliases);
      expect(tpContent).toBe("");
    });

    it("REGRESSION: ## Pertanyaan Refleksi and ## Refleksi & Diskusi do NOT populate SOAL_ESSAY", () => {
      const md = `# Lembar Tugas
## Pertanyaan Refleksi
1. Apa yang paling kamu pahami dari topik ini?

## Refleksi & Diskusi
Diskusikan dengan teman sebangkumu.

## Soal Essay
1. Jelaskan proses fotosintesis pada tumbuhan hijau.`;

      const essayAliases = ["Soal Essay", "Soal Uraian", "Pertanyaan Uraian", "Uraian"];
      const essayContent = extractSectionByHeading(md, essayAliases);
      expect(essayContent).toContain("Jelaskan proses fotosintesis");
      expect(essayContent).not.toContain("Apa yang paling kamu pahami");
      expect(essayContent).not.toContain("Diskusikan dengan teman");
    });

    it("REGRESSION: ## Pembahasan and ## Jawaban & Pembahasan do NOT populate KUNCI_JAWABAN", () => {
      const md = `# Lembar Tugas
## Kunci Jawaban
1. A
2. B
3. Fotosintesis memerlukan cahaya dan klorofil.

## Pembahasan
Fotosintesis terjadi pada kloroplas di mana tilakoid menangkap cahaya.

## Jawaban & Pembahasan
Ringkasan pembahasan lengkap.`;

      const kunciAliases = ["Kunci Jawaban", "Jawaban"];
      const kunciContent = extractSectionByHeading(md, kunciAliases);
      expect(kunciContent).toContain("Fotosintesis memerlukan cahaya dan klorofil.");
      expect(kunciContent).not.toContain("Fotosintesis terjadi pada kloroplas");
      expect(kunciContent).not.toContain("Ringkasan pembahasan lengkap");
    });

    it("Unmapped reflection, discussion, and explanation sections remain accessible in ISI_KONTEN", () => {
      const md = `# Modul Lengkap
## Pembahasan
Penjelasan mendalam topik.

## Pertanyaan Refleksi
Refleksi siswa terhadap pembelajaran.`;

      const fullContent = normalizeMarkdownToPlainText(md);
      expect(fullContent).toContain("Penjelasan mendalam topik.");
      expect(fullContent).toContain("Refleksi siswa terhadap pembelajaran.");
    });
  });

  describe("Export Value Validation & Size Protection", () => {
    it("blocks export if required placeholder value is missing", async () => {
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>{{JUDUL}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

      const docx = createDocxWithDocXml(docXml);
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");

      await expect(
        renderDocxTemplate(docx, res.manifest!, {
          title: "", // Missing required title
          content: "Ada isi materi.",
          contentType: "LESSON_PLAN",
        })
      ).rejects.toThrow(/Judul dokumen wajib diisi/);
    });

    it("resolves missing optional values to clean empty strings", async () => {
      const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>{{JUDUL}} - {{KELAS}} - {{GURU}}</w:t></w:r></w:p>
          <w:p><w:r><w:t>{{ISI_KONTEN}}</w:t></w:r></w:p>
        </w:body>
      </w:document>`;

      const docx = createDocxWithDocXml(docXml);
      const res = await validateAndParseDocxTemplate(docx, "LESSON_PLAN");

      const rendered = await renderDocxTemplate(docx, res.manifest!, {
        title: "Modul Ajar",
        content: "Isi materi lengkap.",
        contentType: "LESSON_PLAN",
        // KELAS and GURU are undefined
      });

      expect(rendered.length).toBeGreaterThan(0);
    });
  });
});
