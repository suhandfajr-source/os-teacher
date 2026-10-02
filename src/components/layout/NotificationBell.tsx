"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  getMyNotificationsAction,
  markMyNotificationsReadAction,
} from "@/modules/approvals/approvals.actions";

interface NotificationItem {
  id: string;
  type: string;
  payload: { title?: string; body?: string; link?: string } | null;
  readAt: string | Date | null;
  createdAt: string | Date;
}

/**
 * Story 5 — badge/feed notifikasi header guru (OQ-3). Aggregate per aksi;
 * baca unread memakai index [userId, readAt] (G-10).
 * BH-12 polish (defer Story 5, diterapkan 2026-10-02): mark-read saat dropdown
 * ditutup (bukan dibuka), polling ringan 60s, dan payload.link jadi navigasi.
 */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(() => {
    let mounted = true;
    startTransition(async () => {
      try {
        const res = await getMyNotificationsAction();
        if (mounted && res.success) {
          setItems(res.items as NotificationItem[]);
          setUnread(res.unreadCount);
        }
      } catch {
        /* tenant tanpa notifikasi — diamkan */
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = refresh();
    return cleanup;
  }, [refresh]);

  // Polling ringan — refresh badge tiap 60 detik saat tab terlihat.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const markAll = useCallback(() => {
    startTransition(async () => {
      const res = await markMyNotificationsReadAction();
      if (res.success) {
        setUnread(0);
        setItems((prev) => prev.map((i) => ({ ...i, readAt: new Date().toISOString() })));
      }
    });
  }, []);

  // BH-12: tutup dropdown saat klik di luar + mark-read saat DITUTUP.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const closeDropdown = useCallback(() => {
    setOpen((prev) => {
      if (prev && unread > 0) markAll(); // mark-read saat ditutup, bukan dibuka
      return false;
    });
  }, [unread, markAll]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Notifikasi"
        aria-expanded={open}
        onClick={() => (open ? closeDropdown() : setOpen(true))}
        className="relative rounded-full p-2 hover:bg-muted transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border bg-popover shadow-lg z-50">
          <div className="px-3 py-2 text-xs font-semibold border-b flex items-center justify-between">
            <span>Notifikasi</span>
            <button
              type="button"
              onClick={closeDropdown}
              className="text-[10px] font-normal text-muted-foreground hover:text-foreground"
            >
              Tutup
            </button>
          </div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Belum ada notifikasi.</p>
          ) : (
            items.map((n) => {
              const inner = (
                <>
                  <div className="text-xs font-medium">{n.payload?.title ?? n.type}</div>
                  <div className="text-xs text-muted-foreground">{n.payload?.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleString("id-ID")}
                  </div>
                </>
              );
              // BH-12: payload.link → navigasi (internal Link / external anchor).
              return n.payload?.link ? (
                <Link
                  key={n.id}
                  href={n.payload.link}
                  onClick={closeDropdown}
                  className="block px-3 py-2 border-b last:border-b-0 hover:bg-muted/60 transition-colors"
                >
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className="px-3 py-2 border-b last:border-b-0">
                  {inner}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
