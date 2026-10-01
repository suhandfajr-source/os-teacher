"use client";

import React from "react";

/**
 * MarkdownReader — satu sumber kebenaran untuk tampilan baca (read-only) konten
 * markdown di portal siswa. Menangani:
 *  - Heading h1–h4 (h5+ diperlakukan sebagai h4)
 *  - Bold/italic/inline-code sebagai styling, bukan dibuang
 *  - Bullet (*, -, •), numbered list (1., 2) )
 *  - Tabel GFM penuh (baris separator | --- | dilewati)
 *  - Blockquote (>) dan horizontal rule (---, ***, ___)
 *  - Menyaring tag internal AI: [Role: …], [Speaker Notes]: …, dan tag [xxx: yyy]
 */

interface MarkdownReaderProps {
  content: string;
  className?: string;
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4; text: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "bullet"; items: string[] }
  | { kind: "ordered"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "quote"; lines: string[] }
  | { kind: "hr" };

const HR_LINE_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BULLET_RE = /^[*•-]\s+(.*)$/;
const ORDERED_RE = /^\d{1,3}[.)]\s+(.*)$/;
// Baris separator tabel GFM: | --- | :---: |
const TABLE_SEPARATOR_CELL_RE = /^:?-{2,}:?$/;
// Tag internal AI di awal baris ([Role: X], [Speaker Notes]: …)
const INTERNAL_TAG_RE = /^\[(?:Role|Speaker Notes)\b[^\]]*\]\s*/i;
// Baris yang murni sebuah tag ber-label [Semua: konten] dianggap metadata internal
const TAG_ONLY_LINE_RE = /^\[[^\]]*:[^\]]*\]$/;

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isTableSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => c.length > 0 && TABLE_SEPARATOR_CELL_RE.test(c));
}

function stripInternalTag(line: string): { text: string; dropLine: boolean } {
  if (TAG_ONLY_LINE_RE.test(line.trim())) {
    return { text: "", dropLine: true };
  }
  const match = line.match(INTERNAL_TAG_RE);
  if (!match) return { text: line, dropLine: false };
  // Catatan speaker adalah informasi internal guru — buang seluruh barisnya
  if (/^\[speaker notes\]/i.test(line)) return { text: "", dropLine: true };
  const rest = line.slice(match[0].length).trim();
  return { text: rest, dropLine: rest.length === 0 };
}

export function parseMarkdownBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  if (!content || !content.trim()) return blocks;

  const lines = content.split(/\r?\n/);
  let paragraphBuf: string[] = [];
  let i = 0;

  const flushParagraph = () => {
    if (paragraphBuf.length > 0) {
      blocks.push({ kind: "paragraph", lines: paragraphBuf });
      paragraphBuf = [];
    }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Baris kosong → akhiri paragraf berjalan
    if (!trimmed) {
      flushParagraph();
      i += 1;
      continue;
    }

    // Tag internal AI ([Role: …], [Speaker Notes]: …, [Sumber: …])
    const tag = stripInternalTag(raw);
    if (tag.dropLine) {
      flushParagraph();
      i += 1;
      continue;
    }
    const line = tag.text;
    const lineTrimmed = line.trim();
    if (!lineTrimmed) {
      i += 1;
      continue;
    }

    // Horizontal rule
    if (HR_LINE_RE.test(lineTrimmed)) {
      flushParagraph();
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }

    // Heading h1–h4
    const heading = lineTrimmed.match(HEADING_RE);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4;
      blocks.push({ kind: "heading", level, text: heading[2].trim() });
      i += 1;
      continue;
    }

    // Tabel GFM: kumpulkan baris | … | berurutan, lewati baris separator
    if (lineTrimmed.startsWith("|")) {
      flushParagraph();
      const rows: string[][] = [];
      let j = i;
      while (j < lines.length) {
        const rowLine = lines[j].trim();
        if (!rowLine.startsWith("|")) break;
        const tag2 = stripInternalTag(lines[j]);
        const cells = splitTableRow(tag2.text.trim());
        if (!isTableSeparatorRow(cells)) rows.push(cells);
        j += 1;
      }
      if (rows.length > 0) {
        blocks.push({ kind: "table", header: rows[0], rows: rows.slice(1) });
      }
      i = j;
      continue;
    }

    // Blockquote
    if (lineTrimmed.startsWith(">")) {
      flushParagraph();
      const quoteLines: string[] = [];
      let j = i;
      while (j < lines.length) {
        const q = stripInternalTag(lines[j]).text.trim();
        if (!q.startsWith(">")) break;
        quoteLines.push(q.replace(/^>\s?/, ""));
        j += 1;
      }
      blocks.push({ kind: "quote", lines: quoteLines });
      i = j;
      continue;
    }

    // Bullet list
    const bullet = lineTrimmed.match(BULLET_RE);
    if (bullet) {
      flushParagraph();
      const items: string[] = [];
      let j = i;
      while (j < lines.length) {
        const b = stripInternalTag(lines[j]).text.trim();
        const m = b.match(BULLET_RE);
        if (!m) break;
        items.push(m[1].trim());
        j += 1;
      }
      blocks.push({ kind: "bullet", items });
      i = j;
      continue;
    }

    // Numbered list
    const ordered = lineTrimmed.match(ORDERED_RE);
    if (ordered) {
      flushParagraph();
      const items: string[] = [];
      let j = i;
      while (j < lines.length) {
        const o = stripInternalTag(lines[j]).text.trim();
        const m = o.match(ORDERED_RE);
        if (!m) break;
        items.push(m[1].trim());
        j += 1;
      }
      blocks.push({ kind: "ordered", items });
      i = j;
      continue;
    }

    // Teks biasa → kumpulkan sebagai paragraf
    paragraphBuf.push(lineTrimmed);
    i += 1;
  }

  flushParagraph();
  return blocks;
}

/** Render styling inline (bold/italic/kode) sebagai elemen, bukan simbol mentah. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g;
  return text
    .split(regex)
    .filter((p) => p !== undefined && p !== "")
    .map((part, idx) => {
      const key = `${keyPrefix}-${idx}`;
      if (part.startsWith("***") && part.endsWith("***") && part.length > 6) {
        return (
          <strong key={key} className="font-bold italic text-slate-900">
            {part.slice(3, -3)}
          </strong>
        );
      }
      if (
        (part.startsWith("**") && part.endsWith("**") && part.length > 4) ||
        (part.startsWith("__") && part.endsWith("__") && part.length > 4)
      ) {
        return (
          <strong key={key} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (
        (part.startsWith("*") && part.endsWith("*") && part.length > 2) ||
        (part.startsWith("_") && part.endsWith("_") && part.length > 2)
      ) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code key={key} className="rounded bg-teal-50 px-1 py-0.5 font-mono text-[12px] text-teal-800">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={key}>{part}</React.Fragment>;
    });
}

const HEADING_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: "text-lg font-black text-slate-900 mt-4 mb-2 pb-1 border-b border-slate-200",
  2: "text-base font-bold text-teal-800 mt-4 mb-1.5",
  3: "text-sm font-bold text-slate-800 mt-3 mb-1",
  4: "text-[12px] font-semibold uppercase tracking-wide text-slate-600 mt-2 mb-0.5",
};

export function MarkdownReader({ content, className }: MarkdownReaderProps) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <article
      className={`prose prose-slate prose-sm max-w-none text-[13px] leading-relaxed text-slate-700 ${className ?? ""}`}
    >
      {blocks.map((block, idx) => {
        const key = `blk-${idx}`;
        switch (block.kind) {
          case "heading": {
            if (block.level === 2) {
              return (
                <h2 key={key} className="mt-4 mb-1.5 flex items-center gap-1.5 text-base font-bold text-teal-800">
                  <span className="h-4 w-1.5 shrink-0 rounded-full bg-teal-600" />
                  {renderInline(block.text, key)}
                </h2>
              );
            }
            const Tag = (`h${block.level}` as unknown) as "h1";
            return (
              <Tag key={key} className={HEADING_CLASS[block.level]}>
                {renderInline(block.text, key)}
              </Tag>
            );
          }
          case "paragraph":
            return (
              <p key={key} className="my-1.5">
                {block.lines.map((l, li) => (
                  <React.Fragment key={`${key}-l${li}`}>
                    {li > 0 && " "}
                    {renderInline(l, `${key}-l${li}`)}
                  </React.Fragment>
                ))}
              </p>
            );
          case "bullet":
            return (
              <ul key={key} className="my-2 space-y-1">
                {block.items.map((item, li) => (
                  <li key={`${key}-${li}`} className="flex items-start gap-2 ml-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                    <div>{renderInline(item, `${key}-${li}`)}</div>
                  </li>
                ))}
              </ul>
            );
          case "ordered":
            return (
              <ol key={key} className="my-2 space-y-1">
                {block.items.map((item, li) => (
                  <li key={`${key}-${li}`} className="flex items-start gap-2 ml-1">
                    <span className="mt-0.5 shrink-0 font-bold text-teal-700">{li + 1}.</span>
                    <div>{renderInline(item, `${key}-${li}`)}</div>
                  </li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div key={key} className="my-3 overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-teal-50/70 font-semibold text-teal-900">
                      {block.header.map((cell, ci) => (
                        <th key={ci} className="border-r border-slate-200 px-3 py-2 last:border-r-0">
                          {renderInline(cell, `${key}-h${ci}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {block.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 1 ? "bg-slate-50/50" : ""}>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className="border-r border-slate-100 px-3 py-2 align-top text-slate-700 last:border-r-0"
                          >
                            {cell.split(/<br\s*\/?>/gi).map((sub, si) => (
                              <div key={si} className={si > 0 ? "mt-0.5" : ""}>
                                {renderInline(sub, `${key}-${ri}-${ci}-${si}`)}
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
          case "quote":
            return (
              <blockquote
                key={key}
                className="my-2 rounded-r-lg border-l-4 border-teal-500 bg-teal-50/40 py-1.5 pl-3 pr-2 italic text-slate-600"
              >
                {block.lines.map((l, li) => (
                  <p key={`${key}-q${li}`} className="my-0.5">
                    {renderInline(l, `${key}-q${li}`)}
                  </p>
                ))}
              </blockquote>
            );
          case "hr":
            return <hr key={key} className="my-4 border-slate-200" />;
          default:
            return null;
        }
      })}
    </article>
  );
}

export default MarkdownReader;
