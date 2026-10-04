"use client";

import React from "react";

interface FormattedMarkdownProps {
  content: string;
  isUser?: boolean;
}

/**
 * Lightweight, safe & responsive Markdown renderer for Klassa Agent Chat
 * Cleans up raw asterisks (**bold**), headers (###), lists (- item), and code blocks
 */
export function FormattedMarkdown({ content, isUser = false }: FormattedMarkdownProps) {
  if (!content) return null;

  // Split content by code blocks if any
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`space-y-2 text-xs sm:text-sm leading-relaxed ${isUser ? "text-white" : "text-slate-800 dark:text-slate-200"}`}>
      {parts.map((part, partIdx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          // Code block rendering
          const lines = part.slice(3, -3).trim().split("\n");
          const language = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : "";
          const codeText = language ? lines.slice(1).join("\n") : lines.join("\n");

          return (
            <div key={partIdx} className="my-2 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 text-slate-200 font-mono text-xs">
              {language && (
                <div className="bg-slate-800 px-3 py-1 text-[10px] text-slate-400 font-sans uppercase font-bold tracking-wider border-b border-slate-700">
                  {language}
                </div>
              )}
              <pre className="p-3 overflow-x-auto">
                <code>{codeText}</code>
              </pre>
            </div>
          );
        }

        // Render regular markdown text blocks
        return <MarkdownBlock key={partIdx} text={part} isUser={isUser} />;
      })}
    </div>
  );
}

function MarkdownBlock({ text, isUser }: { text: string; isUser: boolean }) {
  const lines = text.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];
  let isNumberedList = false;

  const flushList = () => {
    if (currentListItems.length > 0) {
      if (isNumberedList) {
        renderedElements.push(
          <ol key={`ol-${renderedElements.length}`} className="my-1.5 ml-1 space-y-1 list-none">
            {currentListItems}
          </ol>
        );
      } else {
        renderedElements.push(
          <ul key={`ul-${renderedElements.length}`} className="my-1.5 ml-1 space-y-1 list-none">
            {currentListItems}
          </ul>
        );
      }
      currentListItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    // Header 3: ### Header
    if (line.startsWith("### ")) {
      flushList();
      renderedElements.push(
        <h4 key={i} className={`font-bold text-sm sm:text-base mt-2.5 mb-1 ${isUser ? "text-white" : "text-slate-900 dark:text-white"}`}>
          {renderInlineFormatting(line.slice(4), isUser)}
        </h4>
      );
      continue;
    }

    // Header 2: ## Header
    if (line.startsWith("## ")) {
      flushList();
      renderedElements.push(
        <h3 key={i} className={`font-bold text-base sm:text-lg mt-3 mb-1.5 ${isUser ? "text-white" : "text-slate-900 dark:text-white"}`}>
          {renderInlineFormatting(line.slice(3), isUser)}
        </h3>
      );
      continue;
    }

    // Header 1: # Header
    if (line.startsWith("# ")) {
      flushList();
      renderedElements.push(
        <h2 key={i} className={`font-extrabold text-lg sm:text-xl mt-3.5 mb-2 ${isUser ? "text-white" : "text-slate-900 dark:text-white"}`}>
          {renderInlineFormatting(line.slice(2), isUser)}
        </h2>
      );
      continue;
    }

    // Bullet List: - item or * item
    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      if (isNumberedList) flushList();
      isNumberedList = false;
      currentListItems.push(
        <li key={i} className="flex items-start gap-2">
          <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${isUser ? "bg-white" : "bg-teal-600 dark:bg-teal-400"}`} />
          <span className="flex-1">{renderInlineFormatting(bulletMatch[1], isUser)}</span>
        </li>
      );
      continue;
    }

    // Numbered List: 1. item, 2. item
    const numberMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (numberMatch) {
      if (!isNumberedList) flushList();
      isNumberedList = true;
      currentListItems.push(
        <li key={i} className="flex items-start gap-2">
          <span className={`shrink-0 font-bold text-[11px] px-1.5 py-0.5 rounded-md ${isUser ? "bg-white/20 text-white" : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60"}`}>
            {numberMatch[1]}
          </span>
          <span className="flex-1">{renderInlineFormatting(numberMatch[2], isUser)}</span>
        </li>
      );
      continue;
    }

    // Regular Paragraph
    flushList();
    renderedElements.push(
      <p key={i} className="leading-relaxed">
        {renderInlineFormatting(rawLine, isUser)}
      </p>
    );
  }

  flushList();

  return <>{renderedElements}</>;
}

/**
 * Format inline bold (**text**), italic (*text*), inline code (`code`), and tags
 */
function renderInlineFormatting(text: string, isUser: boolean): React.ReactNode {
  if (!text) return null;

  // Split by inline code: `code`
  const codeParts = text.split(/(`[^`]+`)/g);

  return codeParts.map((codePart, cIdx) => {
    if (codePart.startsWith("`") && codePart.endsWith("`") && codePart.length >= 2) {
      return (
        <code
          key={cIdx}
          className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${
            isUser
              ? "bg-white/20 text-white"
              : "bg-slate-100 dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-slate-200/60 dark:border-slate-700"
          }`}
        >
          {codePart.slice(1, -1)}
        </code>
      );
    }

    // Split by bold: **bold** or __bold__
    const boldParts = codePart.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);

    return boldParts.map((boldPart, bIdx) => {
      const isBold =
        (boldPart.startsWith("**") && boldPart.endsWith("**")) ||
        (boldPart.startsWith("__") && boldPart.endsWith("__"));

      if (isBold) {
        const innerText = boldPart.slice(2, -2);
        return (
          <strong
            key={`${cIdx}-${bIdx}`}
            className={`font-bold ${isUser ? "text-white" : "text-slate-900 dark:text-white"}`}
          >
            {renderItalicFormatting(innerText)}
          </strong>
        );
      }

      return <React.Fragment key={`${cIdx}-${bIdx}`}>{renderItalicFormatting(boldPart)}</React.Fragment>;
    });
  });
}

function renderItalicFormatting(text: string): React.ReactNode {
  // Split by italic: *italic* or _italic_
  const parts = text.split(/(\*[^*]+\*|_[^_]+_)/g);

  return parts.map((part, idx) => {
    const isItalic =
      (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) ||
      (part.startsWith("_") && part.endsWith("_") && !part.startsWith("__"));

    if (isItalic) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}
