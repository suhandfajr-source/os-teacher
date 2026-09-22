"use client";

import React, { useEffect, useState, useTransition } from "react";
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
 */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
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

  const markAll = () => {
    startTransition(async () => {
      const res = await markMyNotificationsReadAction();
      if (res.success) {
        setUnread(0);
        setItems((prev) => prev.map((i) => ({ ...i, readAt: new Date().toISOString() })));
      }
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifikasi"
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread > 0) markAll();
        }}
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
          <div className="px-3 py-2 text-xs font-semibold border-b">Notifikasi</div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Belum ada notifikasi.</p>
          ) : (
            items.map((n) => (
              <div key={n.id} className="px-3 py-2 border-b last:border-b-0">
                <div className="text-xs font-medium">{n.payload?.title ?? n.type}</div>
                <div className="text-xs text-muted-foreground">{n.payload?.body}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.createdAt).toLocaleString("id-ID")}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
