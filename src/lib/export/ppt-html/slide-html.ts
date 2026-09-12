/**
 * TEACHER OS — AI STUDIO EXPORT V3
 * HTML Slide Templates (Subject-Adaptive, XHTML-safe)
 *
 * Renders each PresentationSlide into a standalone 1280x720 HTML document.
 * The markup is XHTML-compliant (self-closed void tags, escaped entities,
 * explicit xml namespace) so it can be rasterized through an SVG
 * <foreignObject> in the browser without a headless browser.
 *
 * Design language (validated with user sample):
 * - Rich dark gradient background with theme-colored soft blobs
 * - Big expressive typography, accent-highlighted keywords
 * - White rounded content cards with theme top border
 * - Theme-driven decoration (organic / geometry / script / atlas / classic)
 */

import {
  PresentationMetadata,
  PresentationSlide,
  CoverSlide,
  ObjectivesSlide,
  ContentSlide,
  TakeawaySlide,
  ReflectionOrQuizSlide,
  HookStatementSlide,
  SplitColumnSlide,
  CardsGridSlide,
  StoryConceptSlide,
} from "../ppt/ppt-types";
import { SubjectTheme } from "./theme";

export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;

/** Escapes untrusted text for safe embedding into XHTML markup. */
export function escapeHtml(text: string): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Highlights **bold** and *italic*-ish markers used by AI output. Kept minimal. */
/** Strips leading emoji/symbols so kicker text does not double the icon. */
function stripLeadingEmoji(text: string | undefined): string {
  return String(text ?? "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
}

function rich(text: string): string {
  const escaped = escapeHtml(text);
  // **teks** → highlight
  return escaped.replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>');
}

function stripMarkdown(text: string): string {
  return String(text ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#+\s*/, "")
    .trim();
}

// ----------------------------------------------------------------------------
// Shared building blocks
// ----------------------------------------------------------------------------

function baseStyle(theme: SubjectTheme): string {
  return `
    .root {
      width: ${SLIDE_WIDTH}px; height: ${SLIDE_HEIGHT}px;
      position: relative; overflow: hidden;
      font-family: "Segoe UI", "Poppins", Arial, sans-serif;
      color: #ffffff;
      background:
        radial-gradient(900px 500px at 85% -10%, #${theme.bg3} 0%, transparent 55%),
        radial-gradient(700px 600px at -10% 110%, #${theme.bg2} 0%, transparent 60%),
        linear-gradient(135deg, #${theme.bg1} 0%, #${theme.bg2} 100%);
      display: flex; flex-direction: column;
      padding: 48px 64px;
      box-sizing: border-box;
    }
    .root * { box-sizing: border-box; margin: 0; padding: 0; }
    .blob { position: absolute; border-radius: 50%; pointer-events: none; }
    .blob-a {
      width: 420px; height: 420px; top: -160px; right: -120px;
      background: radial-gradient(circle at 50% 50%, #${theme.bg3}66 0%, #${theme.bg3}22 45%, transparent 70%);
    }
    .blob-b {
      width: 460px; height: 460px; bottom: -200px; left: -140px;
      background: radial-gradient(circle at 50% 50%, #${theme.bg3}44 0%, #${theme.bg3}18 45%, transparent 70%);
    }
    .deco-layer { position: absolute; inset: 0; pointer-events: none; }

    .topbar { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 3; }
    .badge {
      display: inline-flex; align-items: center; gap: 8px;
      background: ${theme.accentSoft}; color: #${theme.accent};
      border: 1px solid ${theme.accentSoft};
      padding: 7px 18px; border-radius: 999px;
      font-size: 14px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;
    }
    .pageinfo { font-size: 14px; color: #${theme.accent}; font-weight: 600; opacity: 0.9; }

    .footer {
      margin-top: auto; display: flex; justify-content: space-between; align-items: center;
      font-size: 14px; color: rgba(255,255,255,0.55); position: relative; z-index: 3;
      border-top: 1px solid rgba(255,255,255,0.12); padding-top: 16px;
    }
    .footer b { color: rgba(255,255,255,0.82); font-weight: 700; }

    .kicker {
      font-size: 17px; font-weight: 700; color: #${theme.accent};
      letter-spacing: 0.5px; margin-bottom: 10px;
      display: flex; align-items: center; gap: 10px;
    }
    .kicker::before { content: ""; width: 34px; height: 4px; border-radius: 4px; background: #${theme.accent}; }
    .content-area { position: relative; z-index: 3; display: flex; flex-direction: column; flex: 1; min-height: 0; }

    .hl { color: #${theme.accent}; }
  `;
}

function themeDecorations(theme: SubjectTheme): string {
  switch (theme.decoration) {
    case "geometry":
      return `
        <div class="deco-layer" style="background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px); background-size: 44px 44px;"></div>
        <div class="deco-layer">
          <div class="blob" style="border: 2px solid rgba(255,255,255,0.14); background: transparent; width: 120px; height: 120px; top: 130px; right: 90px;"></div>
          <div class="blob" style="width: 0; height: 0; border-left: 45px solid transparent; border-right: 45px solid transparent; border-bottom: 80px solid rgba(255,255,255,0.10); bottom: 110px; right: 230px; transform: rotate(18deg); border-radius: 0;"></div>
          <div class="blob" style="border: 2px solid rgba(255,255,255,0.12); background: transparent; width: 70px; height: 70px; top: 210px; right: 300px; transform: rotate(24deg);"></div>
        </div>`;
    case "script":
      return `
        <div class="deco-layer">
          <div style="position: absolute; top: 60px; right: 70px; font-size: 280px; line-height: 1; color: rgba(255,255,255,0.07); font-family: Georgia, serif; font-weight: 700;">&#8221;</div>
          <div style="position: absolute; bottom: 60px; left: 30px; font-size: 190px; line-height: 1; color: rgba(255,255,255,0.05); font-family: Georgia, serif; font-weight: 700;">&#8220;</div>
        </div>`;
    case "atlas":
      return `
        <div class="deco-layer">
          <div class="blob" style="border: 1.5px solid rgba(255,255,255,0.12); background: transparent; width: 300px; height: 300px; top: -60px; right: -60px;"></div>
          <div class="blob" style="border: 1.5px solid rgba(255,255,255,0.10); background: transparent; width: 220px; height: 220px; top: 30px; right: 30px;"></div>
          <div class="blob" style="border: 1.5px dashed rgba(255,255,255,0.14); background: transparent; width: 160px; height: 160px; bottom: 80px; right: 130px;"></div>
          <div style="position: absolute; top: 180px; right: 150px; width: 8px; height: 8px; border-radius: 50%; background: #${theme.accent}; opacity: 0.7;"></div>
          <div style="position: absolute; bottom: 160px; right: 210px; width: 8px; height: 8px; border-radius: 50%; background: #${theme.accent}; opacity: 0.5;"></div>
        </div>`;
    case "classic":
      return `
        <div class="deco-layer">
          <div class="blob" style="border: 1.5px solid rgba(255,255,255,0.12); background: transparent; width: 260px; height: 260px; top: -80px; right: -80px;"></div>
          <div class="blob" style="border: 1.5px solid rgba(255,255,255,0.10); background: transparent; width: 180px; height: 180px; bottom: -60px; right: 60px;"></div>
          <div style="position: absolute; top: 130px; right: 120px; font-size: 60px; opacity: 0.25;">${theme.badgeIcon}</div>
        </div>`;
    case "organic":
    default:
      return `
        <div class="deco-layer">
          <div class="blob" style="border: 1.5px solid rgba(255,255,255,0.10); background: transparent; width: 170px; height: 170px; top: 140px; right: 100px;"></div>
          <div class="blob" style="width: 90px; height: 90px; bottom: 150px; right: 280px; background: radial-gradient(circle at 35% 35%, #${theme.bg3}88, transparent 75%);"></div>
        </div>`;
  }
}

function topbar(slide: PresentationSlide, theme: SubjectTheme, badgeLabel: string): string {
  return `
    <div class="topbar">
      <span class="badge">${escapeHtml(theme.badgeIcon)} ${escapeHtml(badgeLabel)}</span>
      <span class="pageinfo">Slide ${slide.slideNumber} / ${slide.totalSlides}</span>
    </div>`;
}

function footer(meta: PresentationMetadata): string {
  const school = meta.schoolName?.trim();
  const className = meta.className?.trim();
  const teacher = meta.teacherName?.trim();
  const subject = meta.subjectName?.trim();

  const left = [school, className ? `Kelas ${className}` : undefined]
    .filter(Boolean)
    .map((x) => `<b>${escapeHtml(x as string)}</b>`)
    .join(" <span style='opacity:.5'>·</span> ");
  const right = [teacher, subject]
    .filter(Boolean)
    .map((x) => `<b>${escapeHtml(x as string)}</b>`)
    .join(" <span style='opacity:.5'>·</span> ");

  if (!left && !right) return "";
  return `<div class="footer"><span>🏫 ${left}</span><span>👨‍🏫 ${right}</span></div>`;
}

function cardStyle(theme: SubjectTheme): string {
  return `
    .card {
      flex: 1; background: rgba(255,255,255,0.97); border-radius: 22px; padding: 26px 24px;
      display: flex; flex-direction: column; gap: 10px; min-width: 0;
      box-shadow: 0 18px 40px rgba(0,0,0,0.28);
      border-top: 6px solid #${theme.bg3};
    }
    .icon {
      width: 54px; height: 54px; border-radius: 16px; font-size: 27px;
      background: ${theme.accentSoft}; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .card h3 { color: #${theme.inkOnCard}; font-size: 21px; font-weight: 800; line-height: 1.25; }
    .card p { color: #${theme.ink2OnCard}; font-size: 15px; line-height: 1.5; }
    .num {
      margin-left: auto; font-size: 13px; font-weight: 800; color: #${theme.bg3};
      background: ${theme.accentSoft}; width: 26px; height: 26px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .card-head { display: flex; align-items: flex-start; gap: 12px; }
  `;
}

// ----------------------------------------------------------------------------
// Slide-type renderers
// ----------------------------------------------------------------------------

function renderCover(slide: CoverSlide, theme: SubjectTheme, meta: PresentationMetadata): string {
  const subject = slide.subjectName?.trim() || meta.subjectName?.trim() || theme.label;
  const metaLine = [
    slide.schoolName?.trim() || meta.schoolName?.trim(),
    slide.className?.trim() ? `Kelas ${slide.className.trim()}` : meta.className?.trim() ? `Kelas ${meta.className.trim()}` : undefined,
  ]
    .filter(Boolean)
    .map((x) => escapeHtml(x as string))
    .join(" · ");
  const byLine = [slide.teacherName?.trim() || meta.teacherName?.trim() ? `👨‍🏫 ${escapeHtml(slide.teacherName?.trim() || meta.teacherName?.trim() || "")}` : undefined, slide.dateFormatted?.trim() || meta.dateFormatted?.trim()]
    .filter(Boolean)
    .join(" · ");

  return `
    <style>${baseStyle(theme)}
      .cover-center { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; position: relative; z-index: 3; }
      .cover-subject { font-size: 18px; font-weight: 800; letter-spacing: 4px; text-transform: uppercase; color: #${theme.accent}; margin-bottom: 18px; }
      .cover-title { font-size: 64px; font-weight: 800; line-height: 1.1; letter-spacing: -1px; max-width: 1000px; }
      .cover-topic { margin-top: 22px; font-size: 21px; color: rgba(255,255,255,0.78); max-width: 820px; line-height: 1.5; }
      .cover-meta { margin-top: 30px; font-size: 16px; color: rgba(255,255,255,0.6); display: flex; gap: 10px; align-items: center; }
      .cover-chip { background: ${theme.accentSoft}; color: #${theme.accent}; padding: 6px 14px; border-radius: 999px; font-size: 14px; font-weight: 700; }
    </style>
    ${themeDecorations(theme)}
    <div class="topbar">
      <span class="badge">${escapeHtml(theme.badgeIcon)} ${escapeHtml(subject)}</span>
      <span class="pageinfo">${escapeHtml(slide.dateFormatted ?? "")}</span>
    </div>
    <div class="cover-center">
      <div class="cover-subject">${escapeHtml(subject)}</div>
      <h1 class="cover-title">${rich(slide.title)}</h1>
      ${slide.topic ? `<div class="cover-topic">${escapeHtml(slide.topic)}</div>` : ""}
      ${metaLine || byLine ? `<div class="cover-meta">${metaLine ? `<span>${metaLine}</span>` : ""}${byLine ? `<span class="cover-chip">${byLine}</span>` : ""}</div>` : ""}
    </div>
    ${footer(meta)}`;
}

function renderHook(slide: HookStatementSlide, theme: SubjectTheme, meta: PresentationMetadata): string {
  return `
    <style>${baseStyle(theme)}
      .hook-wrap { flex: 1; display: flex; flex-direction: column; justify-content: center; position: relative; z-index: 3; }
      .hook-mark { font-size: 120px; line-height: 0.6; color: #${theme.accent}; opacity: 0.9; font-family: Georgia, serif; margin-bottom: 8px; }
      .hook-title { font-size: 30px; font-weight: 700; color: rgba(255,255,255,0.85); margin-bottom: 18px; }
      .hook-statement { font-size: 46px; font-weight: 800; line-height: 1.25; max-width: 1080px; }
      .hook-support { margin-top: 26px; font-size: 20px; color: rgba(255,255,255,0.72); max-width: 900px; line-height: 1.55; }
    </style>
    ${themeDecorations(theme)}
    ${topbar(slide, theme, "Pertanyaan Pemantik")}
    <div class="hook-wrap">
      <div class="hook-mark">&#8220;</div>
      <div class="hook-title">${escapeHtml(stripMarkdown(slide.title))}</div>
      <div class="hook-statement">${rich(slide.statement)}</div>
      ${slide.supportingText ? `<div class="hook-support">${rich(slide.supportingText)}</div>` : ""}
    </div>
    ${footer(meta)}`;
}

function renderObjectives(slide: ObjectivesSlide, theme: SubjectTheme, meta: PresentationMetadata): string {
  const rows = slide.objectives
    .map(
      (o, i) => `
      <div class="obj-row">
        <div class="obj-check">✓</div>
        <div class="obj-text">${rich(o)}</div>
        <div class="obj-num">${i + 1}</div>
      </div>`
    )
    .join("");

  return `
    <style>${baseStyle(theme)}
      .content-area { gap: 26px; }
      .page-title { font-size: 44px; font-weight: 800; line-height: 1.15; }
      .obj-list { display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
      .obj-row {
        background: rgba(255,255,255,0.97); border-radius: 18px; padding: 20px 24px;
        display: flex; align-items: center; gap: 18px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.22); border-left: 6px solid #${theme.bg3};
      }
      .obj-check {
        width: 44px; height: 44px; border-radius: 14px; background: ${theme.accentSoft};
        color: #${theme.bg3}; font-size: 22px; font-weight: 800;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .obj-text { color: #${theme.inkOnCard}; font-size: 19px; font-weight: 600; line-height: 1.45; flex: 1; }
      .obj-num { font-size: 15px; font-weight: 800; color: #${theme.bg3}; opacity: 0.55; }
    </style>
    ${themeDecorations(theme)}
    ${topbar(slide, theme, "Capaian Pembelajaran")}
    <div class="content-area">
      <div>
        <div class="kicker">🎯 ${escapeHtml(stripLeadingEmoji(slide.categoryLabel) || "Tujuan Pembelajaran")}</div>
        <h1 class="page-title">${rich(slide.title)}</h1>
      </div>
      <div class="obj-list">${rows}</div>
    </div>
    ${footer(meta)}`;
}

function renderContent(slide: ContentSlide, theme: SubjectTheme, meta: PresentationMetadata): string {
  const bullets = slide.items
    .map(
      (item) => `
      <div class="bullet">
        <div class="bullet-dot"></div>
        <div class="bullet-body">
          <div class="bullet-text">${rich(item.text)}</div>
          ${
            item.subpoints && item.subpoints.length > 0
              ? `<div class="subpoints">${item.subpoints
                  .map((sp) => `<div class="subpoint"><span class="sub-dash">–</span><span>${rich(sp)}</span></div>`)
                  .join("")}</div>`
              : ""
          }
        </div>
      </div>`
    )
    .join("");

  const partLabel =
    slide.partIndex && slide.totalParts
      ? `Bagian ${slide.partIndex} dari ${slide.totalParts}`
      : undefined;

  return `
    <style>${baseStyle(theme)}
      .content-area { gap: 22px; }
      .page-title { font-size: 40px; font-weight: 800; line-height: 1.18; }
      .part-chip { display: inline-block; margin-top: 10px; background: ${theme.accentSoft}; color: #${theme.accent}; font-size: 13px; font-weight: 800; letter-spacing: 1px; padding: 5px 14px; border-radius: 999px; }
      .bullets { display: flex; flex-direction: column; gap: 15px; margin-top: 6px; }
      .bullet { display: flex; gap: 16px; align-items: flex-start; }
      .bullet-dot { width: 12px; height: 12px; border-radius: 4px; background: #${theme.accent}; margin-top: 10px; flex-shrink: 0; transform: rotate(45deg); }
      .bullet-text { font-size: 21px; line-height: 1.5; color: rgba(255,255,255,0.95); font-weight: 500; }
      .subpoints { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
      .subpoint { display: flex; gap: 8px; font-size: 16px; color: rgba(255,255,255,0.68); line-height: 1.45; }
      .sub-dash { color: #${theme.accent}; font-weight: 700; }
      ${slide.paragraphText ? ".para { font-size: 19px; line-height: 1.6; color: rgba(255,255,255,0.85); margin-top: 10px; max-width: 1050px; }" : ""}
    </style>
    ${themeDecorations(theme)}
    ${topbar(slide, theme, "Pokok Bahasan")}
    <div class="content-area">
      <div>
        <div class="kicker">📌 ${escapeHtml(stripLeadingEmoji(slide.sectionTitle) || "Materi")}</div>
        <h1 class="page-title">${rich(slide.title)}</h1>
        ${partLabel ? `<span class="part-chip">${escapeHtml(partLabel)}</span>` : ""}
      </div>
      ${slide.paragraphText ? `<div class="para">${rich(slide.paragraphText)}</div>` : ""}
      <div class="bullets">${bullets}</div>
    </div>
    ${footer(meta)}`;
}

function renderCards(slide: CardsGridSlide, theme: SubjectTheme, meta: PresentationMetadata): string {
  const icons = theme.iconSet;
  const cards = slide.cards
    .slice(0, 4)
    .map(
      (card, i) => `
      <div class="card">
        <div class="card-head">
          <div class="icon">${escapeHtml(icons[i % icons.length])}</div>
          <span class="num">${i + 1}</span>
        </div>
        ${card.title ? `<h3>${rich(card.title)}</h3>` : ""}
        <p>${rich(card.text)}</p>
        ${card.subtext ? `<p style="opacity:.75;font-size:14px;">${rich(card.subtext)}</p>` : ""}
      </div>`
    )
    .join("");

  return `
    <style>${baseStyle(theme)}
      ${cardStyle(theme)}
      .content-area { gap: 26px; }
      .page-title { font-size: 40px; font-weight: 800; line-height: 1.18; }
      .cards { display: flex; gap: 22px; margin-top: 10px; flex: 1; min-height: 0; }
    </style>
    ${themeDecorations(theme)}
    ${topbar(slide, theme, "Materi Inti")}
    <div class="content-area">
      <div>
        <div class="kicker">🏛️ ${escapeHtml(stripLeadingEmoji(slide.categoryLabel) || "Pilar Utama")}</div>
        <h1 class="page-title">${rich(slide.title)}</h1>
      </div>
      <div class="cards">${cards}</div>
    </div>
    ${footer(meta)}`;
}

function renderSplit(slide: SplitColumnSlide, theme: SubjectTheme, meta: PresentationMetadata): string {
  const column = (
    title: string,
    items: string[],
    align: "left" | "right"
  ) => `
    <div class="col col-${align}">
      <div class="col-title">${rich(title)}</div>
      <div class="col-items">
        ${items
          .slice(0, 5)
          .map(
            (it) => `
          <div class="col-item"><span class="col-bullet">●</span><span>${rich(it)}</span></div>`
          )
          .join("")}
      </div>
    </div>`;

  return `
    <style>${baseStyle(theme)}
      .content-area { gap: 24px; }
      .page-title { font-size: 40px; font-weight: 800; line-height: 1.18; }
      .split { display: flex; gap: 24px; flex: 1; min-height: 0; align-items: stretch; position: relative; }
      .col {
        flex: 1; background: rgba(255,255,255,0.97); border-radius: 22px; padding: 26px 28px;
        box-shadow: 0 16px 36px rgba(0,0,0,0.26); display: flex; flex-direction: column; gap: 14px; min-width: 0;
      }
      .col-left { border-top: 6px solid #${theme.bg3}; }
      .col-right { border-top: 6px solid #${theme.accent}; }
      .col-title { font-size: 21px; font-weight: 800; color: #${theme.inkOnCard}; }
      .col-items { display: flex; flex-direction: column; gap: 10px; }
      .col-item { display: flex; gap: 10px; font-size: 16px; line-height: 1.45; color: #${theme.ink2OnCard}; }
      .col-bullet { color: #${theme.bg3}; font-size: 11px; margin-top: 5px; }
      .col-right .col-bullet { color: #${theme.accent}; }
      .vs {
        position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
        width: 56px; height: 56px; border-radius: 50%; background: #${theme.bg1};
        border: 3px solid #${theme.accent}; color: #${theme.accent};
        display: flex; align-items: center; justify-content: center;
        font-weight: 800; font-size: 17px; z-index: 4; box-shadow: 0 8px 20px rgba(0,0,0,0.4);
      }
    </style>
    ${themeDecorations(theme)}
    ${topbar(slide, theme, "Perbandingan")}
    <div class="content-area">
      <div>
        <div class="kicker">⚖️ ${escapeHtml(stripLeadingEmoji(slide.categoryLabel) || "Perbandingan & Analisis")}</div>
        <h1 class="page-title">${rich(slide.title)}</h1>
      </div>
      <div class="split">
        ${column(slide.leftColumnTitle, slide.leftColumnItems, "left")}
        ${column(slide.rightColumnTitle, slide.rightColumnItems, "right")}
        <div class="vs">VS</div>
      </div>
    </div>
    ${footer(meta)}`;
}

function renderStory(slide: StoryConceptSlide, theme: SubjectTheme, meta: PresentationMetadata): string {
  const points = slide.supportingPoints
    .slice(0, 3)
    .map(
      (p, i) => `
      <div class="story-point">
        <div class="story-icon">${escapeHtml(theme.iconSet[i % theme.iconSet.length])}</div>
        <div class="story-point-text">${rich(p)}</div>
      </div>`
    )
    .join("");

  return `
    <style>${baseStyle(theme)}
      .content-area { gap: 26px; }
      .story-core {
        background: rgba(255,255,255,0.97); border-radius: 24px; padding: 30px 34px;
        box-shadow: 0 18px 40px rgba(0,0,0,0.28); border-left: 8px solid #${theme.bg3};
        color: #${theme.inkOnCard}; font-size: 25px; font-weight: 700; line-height: 1.45;
      }
      .story-points { display: flex; gap: 20px; flex: 1; min-height: 0; }
      .story-point {
        flex: 1; background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.16);
        border-radius: 18px; padding: 20px 22px; display: flex; gap: 14px; align-items: flex-start;
        backdrop-filter: none;
      }
      .story-icon { font-size: 26px; flex-shrink: 0; }
      .story-point-text { font-size: 16.5px; line-height: 1.5; color: rgba(255,255,255,0.92); }
      .page-title { font-size: 36px; font-weight: 800; line-height: 1.2; }
    </style>
    ${themeDecorations(theme)}
    ${topbar(slide, theme, "Konsep & Kisah")}
    <div class="content-area">
      <div>
        <div class="kicker">📖 ${escapeHtml(stripLeadingEmoji(slide.categoryLabel) || "Kisah & Hikmah")}</div>
        <h1 class="page-title">${rich(slide.title)}</h1>
      </div>
      <div class="story-core">${rich(slide.coreMessage)}</div>
      <div class="story-points">${points}</div>
    </div>
    ${footer(meta)}`;
}

function renderTakeaway(slide: TakeawaySlide, theme: SubjectTheme, meta: PresentationMetadata): string {
  const rows = slide.takeaways
    .map(
      (t, i) => `
      <div class="take-row">
        <div class="take-star">⭐</div>
        <div class="take-text">${rich(t)}</div>
        <div class="take-num">${i + 1}</div>
      </div>`
    )
    .join("");

  return `
    <style>${baseStyle(theme)}
      .content-area { gap: 24px; }
      .page-title { font-size: 42px; font-weight: 800; line-height: 1.15; }
      .take-list { display: flex; flex-direction: column; gap: 14px; margin-top: 6px; }
      .take-row {
        background: rgba(255,255,255,0.97); border-radius: 18px; padding: 18px 24px;
        display: flex; align-items: center; gap: 16px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.22); border-left: 6px solid #${theme.accent};
      }
      .take-star { font-size: 24px; flex-shrink: 0; }
      .take-text { color: #${theme.inkOnCard}; font-size: 19px; font-weight: 600; line-height: 1.45; flex: 1; }
      .take-num { font-size: 15px; font-weight: 800; color: #${theme.bg3}; opacity: 0.55; }
    </style>
    ${themeDecorations(theme)}
    ${topbar(slide, theme, "Rangkuman")}
    <div class="content-area">
      <div>
        <div class="kicker">⭐ Rangkuman Inti</div>
        <h1 class="page-title">${rich(slide.title)}</h1>
      </div>
      <div class="take-list">${rows}</div>
    </div>
    ${footer(meta)}`;
}

function renderQuiz(slide: ReflectionOrQuizSlide, theme: SubjectTheme, meta: PresentationMetadata): string {
  const icon = slide.isQuiz ? "❓" : "💭";
  const label = slide.isQuiz ? "Kuis Cepat" : "Refleksi";
  const rows = slide.questions
    .map(
      (q, i) => `
      <div class="q-row">
        <div class="q-badge">${i + 1}</div>
        <div class="q-text">${rich(q)}</div>
      </div>`
    )
    .join("");

  return `
    <style>${baseStyle(theme)}
      .content-area { gap: 24px; }
      .page-title { font-size: 42px; font-weight: 800; line-height: 1.15; }
      .q-list { display: flex; flex-direction: column; gap: 14px; margin-top: 6px; }
      .q-row {
        background: rgba(255,255,255,0.97); border-radius: 18px; padding: 18px 24px;
        display: flex; align-items: center; gap: 16px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.22);
      }
      .q-badge {
        width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
        background: #${theme.bg3}; color: #ffffff; font-size: 19px; font-weight: 800;
        display: flex; align-items: center; justify-content: center;
      }
      .q-text { color: #${theme.inkOnCard}; font-size: 19px; font-weight: 600; line-height: 1.45; flex: 1; }
    </style>
    ${themeDecorations(theme)}
    ${topbar(slide, theme, label)}
    <div class="content-area">
      <div>
        <div class="kicker">${icon} ${escapeHtml(slide.sectionTitle ?? label)}</div>
        <h1 class="page-title">${rich(slide.title)}</h1>
      </div>
      <div class="q-list">${rows}</div>
    </div>
    ${footer(meta)}`;
}

// ----------------------------------------------------------------------------
// Dispatcher
// ----------------------------------------------------------------------------

/**
 * Renders any PresentationSlide into a standalone 1280x720 XHTML document
 * (single namespaced root div + embedded style), ready for rasterization.
 */
export function renderSlideToHtml(
  slide: PresentationSlide,
  theme: SubjectTheme,
  meta: PresentationMetadata
): string {
  let inner: string;
  switch (slide.type) {
    case "COVER":
      inner = renderCover(slide, theme, meta);
      break;
    case "HOOK_STATEMENT":
      inner = renderHook(slide, theme, meta);
      break;
    case "OBJECTIVES":
      inner = renderObjectives(slide, theme, meta);
      break;
    case "CONTENT":
      inner = renderContent(slide, theme, meta);
      break;
    case "CARDS_GRID":
      inner = renderCards(slide, theme, meta);
      break;
    case "SPLIT_COLUMN":
      inner = renderSplit(slide, theme, meta);
      break;
    case "STORY_CONCEPT":
      inner = renderStory(slide, theme, meta);
      break;
    case "TAKEAWAY":
      inner = renderTakeaway(slide, theme, meta);
      break;
    case "REFLECTION_OR_QUIZ":
      inner = renderQuiz(slide, theme, meta);
      break;
    default:
      inner = renderContent(slide as ContentSlide, theme, meta);
  }

  // Namespaced root for SVG foreignObject embedding (XHTML).
  return `<div xmlns="http://www.w3.org/1999/xhtml" class="root">${inner}</div>`;
}

/** Wraps slide inner HTML into a full standalone HTML page (for previews/tests). */
export function wrapHtmlForPreview(slideInnerHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Slide Preview</title></head>
<body style="margin:0;">${slideInnerHtml}</body>
</html>`;
}
