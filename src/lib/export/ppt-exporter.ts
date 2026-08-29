import pptxgen from "pptxgenjs";

export interface ExportPptOptions {
  title: string;
  content: string;
  schoolName?: string;
  subjectName?: string;
  teacherName?: string;
}

/**
 * Converts structured AI output into clean PowerPoint (.pptx) presentation slides
 */
export async function exportToPowerPoint(options: ExportPptOptions): Promise<void> {
  const { title, content, schoolName, subjectName, teacherName } = options;

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = teacherName || "AI Teacher Assistant";
  pres.company = schoolName || "Sekolah";
  pres.title = title;

  // 1. Title Slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: "1E293B" }; // Dark Slate Blue

  titleSlide.addText(title, {
    x: 0.8,
    y: 1.8,
    w: 8.4,
    h: 1.8,
    fontSize: 32,
    bold: true,
    color: "FFFFFF",
    align: "left",
    fontFace: "Arial",
  });

  const metaText = [];
  if (schoolName) metaText.push(schoolName);
  if (subjectName) metaText.push(`Mapel: ${subjectName}`);
  if (teacherName) metaText.push(`Guru: ${teacherName}`);
  metaText.push(new Date().toLocaleDateString("id-ID", { dateStyle: "long" }));

  titleSlide.addText(metaText.join("  |  "), {
    x: 0.8,
    y: 3.8,
    w: 8.4,
    h: 0.8,
    fontSize: 14,
    color: "94A3B8",
    align: "left",
    fontFace: "Arial",
  });

  // 2. Parse Content into Slides (split by sections / headers)
  const sections = parseContentSections(content);

  for (const sec of sections) {
    const slide = pres.addSlide();
    slide.background = { color: "F8FAFC" }; // Soft Off-White

    // Slide Header Bar
    slide.addShape(pres.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 10,
      h: 0.9,
      fill: { color: "3B82F6" }, // Blue banner
    });

    slide.addText(sec.heading || title, {
      x: 0.6,
      y: 0.15,
      w: 8.8,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: "FFFFFF",
      fontFace: "Arial",
    });

    // Content container card
    slide.addShape(pres.ShapeType.roundRect, {
      x: 0.6,
      y: 1.2,
      w: 8.8,
      h: 4.0,
      fill: { color: "FFFFFF" },
      line: { color: "E2E8F0", width: 1 },
      rectRadius: 0.1,
    });

    if (sec.items.length > 0) {
      const textObjects = sec.items.map((item) => ({
        text: item.replace(/^\*\*(.+?)\*\*/, "$1"),
        options: {
          fontSize: 14,
          color: "334155",
          bullet: true,
          fontFace: "Arial",
          breakLine: true,
          paraSpaceAfter: 12,
        },
      }));

      slide.addText(textObjects, {
        x: 0.9,
        y: 1.4,
        w: 8.2,
        h: 3.6,
        align: "left",
        valign: "top",
      });
    }

    // Footer
    if (schoolName) {
      slide.addText(`${schoolName} • AI Teacher Assistant`, {
        x: 0.6,
        y: 5.3,
        w: 8.8,
        h: 0.3,
        fontSize: 10,
        color: "94A3B8",
        align: "right",
        fontFace: "Arial",
      });
    }
  }

  // Trigger download directly
  const safeFilename = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}.pptx`;
  await pres.writeFile({ fileName: safeFilename });
}

interface SlideSection {
  heading: string;
  items: string[];
}

function parseContentSections(rawContent: string): SlideSection[] {
  const lines = rawContent.split("\n");
  const sections: SlideSection[] = [];
  let currentSection: SlideSection = { heading: "Ringkasan Pembelajaran", items: [] };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Header line
    if (trimmed.startsWith("# ") || trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
      if (currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: trimmed.replace(/^#+\s*/, ""),
        items: [],
      };
      continue;
    }

    // Bullet or text
    const cleanItem = trimmed.replace(/^[-*•]\s*/, "").replace(/^\d+\.\s*/, "");
    if (cleanItem.length > 0) {
      currentSection.items.push(cleanItem);

      // Split slide if items exceed 6 for readability
      if (currentSection.items.length >= 6) {
        sections.push(currentSection);
        currentSection = {
          heading: `${currentSection.heading} (Lanjutan)`,
          items: [],
        };
      }
    }
  }

  if (currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  return sections.length > 0 ? sections : [{ heading: "Materi Pembelajaran", items: [rawContent] }];
}
