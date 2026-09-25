"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AuditItem {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

interface Props {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
  actions: string[];
  filters: { action: string; targetType: string; actorId: string };
}

export function AuditViewer({ items, total, page, pageSize, actions, filters }: Props) {
  const router = useRouter();
  const [action, setAction] = React.useState(filters.action);
  const [actorId, setActorId] = React.useState(filters.actorId);
  const [targetType, setTargetType] = React.useState(filters.targetType);

  const navigate = (nextPage: number, overrides?: { action?: string; actorId?: string; targetType?: string }) => {
    const params = new URLSearchParams();
    const a = overrides?.action ?? action;
    const act = overrides?.actorId ?? actorId;
    const tt = overrides?.targetType ?? targetType;
    if (a) params.set("action", a);
    if (act) params.set("actorId", act);
    if (tt) params.set("targetType", tt);
    if (nextPage > 1) params.set("page", String(nextPage));
    router.push(`/admin/audit${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4 w-full">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AuditLog — {total} entri</h1>

      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-900 dark:text-white">Filter Log Audit</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 text-sm outline-none"
            value={action}
            onChange={(e) => navigate(1, { action: e.target.value })}
          >
            <option value="">— Semua aksi —</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <Input
            placeholder="Actor ID..."
            value={actorId}
            onChange={(e) => setActorId(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 w-64"
          />
          <Input
            placeholder="Target type (STUDENT/SCHOOL/USER...)"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 w-72"
          />
          <Button size="sm" variant="secondary" onClick={() => navigate(1)}>
            Terapkan
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAction("");
              setActorId("");
              setTargetType("");
              navigate(1, { action: "", actorId: "", targetType: "" });
            }}
          >
            Reset
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-1.5">
        {items.map((i) => (
          <div
            key={i.id}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-3 py-2 flex flex-wrap items-center gap-2 text-xs shadow-2xs"
          >
            <Badge variant="outline" className="border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              {i.actorType}
            </Badge>
            <span className="font-mono font-semibold text-teal-600 dark:text-emerald-400">{i.action}</span>
            <span className="text-slate-600 dark:text-slate-400">
              {i.targetType}
              {i.targetId ? `/${i.targetId}` : ""}
            </span>
            {i.metadata != null && Object.keys(i.metadata as object).length > 0 && (
              <span className="text-slate-600 dark:text-slate-300 font-mono truncate max-w-[28rem]" title={JSON.stringify(i.metadata)}>
                {JSON.stringify(i.metadata)}
              </span>
            )}
            {i.ip && <span className="text-slate-400 dark:text-slate-500">[{i.ip}]</span>}
            <span className="text-slate-400 dark:text-slate-500 ml-auto">{new Date(i.createdAt).toLocaleString("id-ID")}</span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-slate-500 py-8 text-center">Tidak ada entri untuk filter ini.</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => navigate(page - 1)}>
          ← Sebelumnya
        </Button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Halaman {page} / {totalPages}
        </span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => navigate(page + 1)}>
          Berikutnya →
        </Button>
      </div>
    </div>
  );
}
