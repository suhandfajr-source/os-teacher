"use client";

import React, { useEffect, useRef, useState } from "react";
import { Crepe, CrepeFeature } from "@milkdown/crepe";
import { EditorStatus, editorViewCtx } from "@milkdown/kit/core";
import { callCommand, replaceAll } from "@milkdown/kit/utils";
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand } from "@milkdown/kit/preset/gfm";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Table as TableIcon,
} from "lucide-react";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/nord.css";
import "./markdown-wysiwyg.css";

interface MarkdownWysiwygProps {
  value: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
  placeholderText?: string;
  /** tinggi minimum area editor (px) */
  minHeight?: number;
}

type ToolbarAction =
  | { kind: "strong" }
  | { kind: "emphasis" }
  | { kind: "heading"; level: number }
  | { kind: "bulletList" }
  | { kind: "orderedList" }
  | { kind: "blockquote" }
  | { kind: "table" };

const TOOLBAR_ITEMS: Array<{ label: string; icon: React.ReactNode; action: ToolbarAction }> = [
  { label: "Tebal (Ctrl+B)", icon: <Bold className="h-3.5 w-3.5" />, action: { kind: "strong" } },
  { label: "Miring (Ctrl+I)", icon: <Italic className="h-3.5 w-3.5" />, action: { kind: "emphasis" } },
  { label: "Judul Bagian", icon: <Heading2 className="h-3.5 w-3.5" />, action: { kind: "heading", level: 2 } },
  { label: "Daftar Berpoin", icon: <List className="h-3.5 w-3.5" />, action: { kind: "bulletList" } },
  { label: "Daftar Bernomor", icon: <ListOrdered className="h-3.5 w-3.5" />, action: { kind: "orderedList" } },
  { label: "Kutipan", icon: <Quote className="h-3.5 w-3.5" />, action: { kind: "blockquote" } },
  { label: "Sisipkan Tabel", icon: <TableIcon className="h-3.5 w-3.5" />, action: { kind: "table" } },
];

/**
 * Editor WYSIWYG berbasis Markdown (Milkdown/Crepe).
 * User mengedit teks yang sudah tampil rapi (tanpa simbol **, ##, dsb),
 * sedangkan nilai yang keluar-masuk tetap berupa string Markdown sehingga
 * pipeline lama (pratinjau & export docx/pdf/ppt) tidak berubah.
 */
export default function MarkdownWysiwyg({
  value,
  onChange,
  readOnly = false,
  placeholderText = "Tulis konten di sini…",
  minHeight = 420,
}: MarkdownWysiwygProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  // Markdown terakhir yang dipancarkan editor — untuk membedakan ketikan user
  // (tidak perlu replace) dari perubahan nilai dari luar (perlu replace).
  const lastEmittedRef = useRef<string>(value);
  const onChangeRef = useRef(onChange);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!rootRef.current) return;
    let disposed = false;

    const crepe = new Crepe({
      root: rootRef.current,
      defaultValue: value,
      features: {
        [CrepeFeature.Latex]: false,
        [CrepeFeature.CodeMirror]: false,
        [CrepeFeature.TopBar]: false,
        [CrepeFeature.AI]: false,
      },
      featureConfigs: {
        [CrepeFeature.Placeholder]: {
          text: placeholderText,
          mode: "doc",
        },
      },
    });

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        lastEmittedRef.current = markdown;
        onChangeRef.current?.(markdown);
      });
    });

    crepe.setReadonly(readOnly);

    crepe.create().then(() => {
      if (disposed) {
        void crepe.destroy();
        return;
      }
      crepeRef.current = crepe;
      setReady(true);
    });

    return () => {
      disposed = true;
      crepeRef.current = null;
      setReady(false);
      void crepe.destroy();
    };
    // Editor dibuat sekali; perubahan nilai ditangani effect sinkronisasi di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle hanya-baca (mis. draf terarsip)
  useEffect(() => {
    crepeRef.current?.setReadonly(readOnly);
  }, [readOnly]);

  // Sinkronisasi nilai dari luar (hasil generate/refine AI, muat draf tersimpan)
  useEffect(() => {
    const crepe = crepeRef.current;
    if (!crepe) return;
    if (value === lastEmittedRef.current) return;
    if (crepe.editor.status !== EditorStatus.Created) return;
    crepe.editor.action(replaceAll(value));
    lastEmittedRef.current = value;
  }, [value]);

  const handleToolbarClick = (action: ToolbarAction) => {
    const crepe = crepeRef.current;
    if (!crepe || readOnly) return;
    if (crepe.editor.status !== EditorStatus.Created) return;
    crepe.editor.action((ctx) => {
      switch (action.kind) {
        case "strong":
          callCommand(toggleStrongCommand.key)(ctx);
          break;
        case "emphasis":
          callCommand(toggleEmphasisCommand.key)(ctx);
          break;
        case "heading":
          callCommand(wrapInHeadingCommand.key, action.level)(ctx);
          break;
        case "bulletList":
          callCommand(wrapInBulletListCommand.key)(ctx);
          break;
        case "orderedList":
          callCommand(wrapInOrderedListCommand.key)(ctx);
          break;
        case "blockquote":
          callCommand(wrapInBlockquoteCommand.key)(ctx);
          break;
        case "table":
          callCommand(insertTableCommand.key, { row: 3, col: 3 })(ctx);
          break;
      }
      // Fokuskan kembali agar perintah berlaku pada seleksi terakhir
      ctx.get(editorViewCtx).focus();
    });
  };

  return (
    <div
      className="md-wysiwyg-root overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
      data-readonly={readOnly ? "true" : "false"}
    >
      {/* Toolbar statis untuk aksi format cepat */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/70 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900/60">
        {TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            aria-label={item.label}
            disabled={readOnly}
            onMouseDown={(e) => {
              // Cegah toolbar mencuri fokus/selection dari editor — kunci agar
              // perintah format tetap diterapkan pada teks yang sedang diblok.
              e.preventDefault();
            }}
            onClick={() => handleToolbarClick(item.action)}
            className="rounded-md p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {item.icon}
          </button>
        ))}
        <span className="ml-auto hidden pr-1 text-[11px] text-slate-400 sm:inline dark:text-slate-500">
          Blok teks lalu pilih format • ketik &quot;/&quot; untuk sisip elemen
        </span>
      </div>
      <div ref={rootRef} className="px-5 py-4" style={{ minHeight }} />
      {!ready && (
        <div className="flex min-h-16 items-center justify-center pb-4 text-xs text-slate-400">
          Menyiapkan editor…
        </div>
      )}
    </div>
  );
}
