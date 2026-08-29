import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
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
        children: row.map(
          (cellText) =>
            new TableCell({
              width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
              shading: isHeader ? { fill: "E2E8F0" } : undefined,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cellText.trim(),
                      bold: isHeader,
                      size: 20,
                      font: "Arial",
                    }),
                  ],
                }),
              ],
            })
        ),
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

    if (!trimmed) {
      children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
      continue;
    }

    // Heading 1
    if (trimmed.startsWith("# ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [
            new TextRun({
              text: trimmed.replace("# ", ""),
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

    // Heading 2
    if (trimmed.startsWith("## ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: trimmed.replace("## ", ""),
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

    // Heading 3
    if (trimmed.startsWith("### ")) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [
            new TextRun({
              text: trimmed.replace("### ", ""),
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

    // Bullet points
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
            new TextRun({ text: `${numberMatch[1]}. `, bold: true, font: "Arial" }),
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
 * Parse bold (**text**) and italic (*text*) into TextRuns
 */
function parseFormattedRuns(rawText: string): TextRun[] {
  const runs: TextRun[] = [];
  // Split by markdown bold (**...**)
  const parts = rawText.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          font: "Arial",
          size: 22, // 11pt
        })
      );
    } else if (part) {
      runs.push(
        new TextRun({
          text: part,
          font: "Arial",
          size: 22,
        })
      );
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text: rawText, font: "Arial", size: 22 })];
}
