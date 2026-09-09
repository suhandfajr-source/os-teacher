import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

export interface ExportDocumentOptions {
  title: string;
  content: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
  dateStr?: string;
}

/**
 * Parses markdown-like text lines into DOCX Paragraphs/Tables
 */
export async function exportToWord(options: ExportDocumentOptions): Promise<Blob> {
  const { title, content, schoolName, subjectName, teacherName, dateStr } = options;

  const children: (Paragraph | Table)[] = [];

  // Header / Kop Info
  if (schoolName) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: schoolName.toUpperCase(),
            bold: true,
            size: 28, // 14pt
            font: "Arial",
          }),
        ],
      })
    );
  }

  if (subjectName || teacherName) {
    const metaParts = [];
    if (subjectName) metaParts.push(`Mata Pelajaran: ${subjectName}`);
    if (teacherName) metaParts.push(`Guru: ${teacherName}`);
    if (dateStr) metaParts.push(`Tanggal: ${dateStr}`);

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: metaParts.join(" | "),
            italics: true,
            size: 20, // 10pt
            font: "Arial",
            color: "555555",
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  // Document Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 32, // 16pt
          font: "Arial",
          color: "1e3a8a",
        }),
      ],
      spacing: { after: 300 },
    })
  );

  // Parse lines of content
  const lines = content.split("\n");
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const docxRows = tableRows.map((row, rIdx) => {
      const isHeader = rIdx === 0;
      return new TableRow({
        children: row.map((cellText) => {
          const cellLines = cellText.split(/<br\s*\/?>|\n/gi);
          const cellParagraphs = cellLines.map(
            (cLine) =>
              new Paragraph({
                children: parseFormattedRuns(cLine.trim(), isHeader, 20),
                spacing: { before: 40, after: 40 },
              })
          );

          return new TableCell({
            width: { size: Math.round(100 / Math.max(row.length, 1)), type: WidthType.PERCENTAGE },
            shading: isHeader ? { fill: "E2E8F0" } : undefined,
            children: cellParagraphs.length > 0 ? cellParagraphs : [new Paragraph({ text: "" })],
          });
        }),
      });
    });

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: docxRows,
      })
    );

    children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    tableRows = [];
    inTable = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Table detection (lines with |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Ignore separator row like |---|---|
      if (trimmed.replace(/[|\-\s:]/g, "").length === 0) {
        continue;
      }
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (!trimmed || trimmed === "---" || trimmed === "***") {
      children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
      continue;
    }

    // Heading 1 (# Title)
    if (trimmed.startsWith("# ")) {
      const text = trimmed.replace(/^#+\s*/, "").replace(/[*_#`]+/g, "").trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({
              text,
              bold: true,
              size: 28,
              font: "Arial",
              color: "1e293b",
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // Heading 2 (## Subtitle)
    if (trimmed.startsWith("## ")) {
      const text = trimmed.replace(/^#+\s*/, "").replace(/[*_#`]+/g, "").trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text,
              bold: true,
              size: 24,
              font: "Arial",
              color: "334155",
            }),
          ],
          spacing: { before: 180, after: 100 },
        })
      );
      continue;
    }

    // Heading 3 (### Section)
    if (trimmed.startsWith("### ")) {
      const text = trimmed.replace(/^#+\s*/, "").replace(/[*_#`]+/g, "").trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({
              text,
              bold: true,
              size: 22,
              font: "Arial",
              color: "475569",
            }),
          ],
          spacing: { before: 140, after: 80 },
        })
      );
      continue;
    }

    // Heading 4, 5, 6 (#### Subsection)
    if (/^#{4,}\s+/.test(trimmed)) {
      const text = trimmed.replace(/^#+\s*/, "").replace(/[*_#`]+/g, "").trim();
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          children: [
            new TextRun({
              text,
              bold: true,
              size: 21,
              font: "Arial",
              color: "475569",
            }),
          ],
          spacing: { before: 120, after: 60 },
        })
      );
      continue;
    }

    // Bullet points (- or *)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const text = trimmed.slice(2);
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseFormattedRuns(text),
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // Numbered lists (1. 2. etc.)
    const numberMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberMatch) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${numberMatch[1]}. `, bold: true, font: "Arial", size: 22 }),
            ...parseFormattedRuns(numberMatch[2]),
          ],
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // Normal Paragraph
    children.push(
      new Paragraph({
        children: parseFormattedRuns(trimmed),
        spacing: { after: 120 },
      })
    );
  }

  if (inTable) {
    flushTable();
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Parse bold (**text** or __text__), italic (*text* or _text_) and plain text into TextRuns
 */
function parseFormattedRuns(rawText: string, forceBold = false, baseSize = 22): TextRun[] {
  const clean = rawText.trim();
  if (!clean) return [];

  // Split by Markdown bold (***...***, **...**, *...*, ___...___, __...__, _..._)
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|___[^_]+___|__[^_]+__|_[^_]+_)/g;
  const parts = clean.split(regex);
  const runs: TextRun[] = [];

  for (const part of parts) {
    if (!part) continue;

    if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
      runs.push(
        new TextRun({
          text: part.slice(3, -3),
          bold: true,
          italics: true,
          font: "Arial",
          size: baseSize,
        })
      );
    } else if (
      (part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length > 4)
    ) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: "Arial",
          size: baseSize,
        })
      );
    } else if (
      (part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length > 2)
    ) {
      runs.push(
        new TextRun({
          text: part.slice(1, -1),
          italics: true,
          font: "Arial",
          size: baseSize,
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          bold: forceBold,
          font: "Arial",
          size: baseSize,
        })
      );
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text: clean, bold: forceBold, font: "Arial", size: baseSize })];
}
