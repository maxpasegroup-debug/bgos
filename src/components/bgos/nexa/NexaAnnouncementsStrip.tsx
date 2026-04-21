"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";

type Row = { id: string; title: string; message: string; created_at: string };

export function NexaAnnouncementsStrip() {
  const [rows, setRows] = useState<Row[]>([]);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/nexa/announcements", { credentials: "include" });
      const j = ((await readApiJson(res, "nexa-announcements")) ?? {}) as {
        ok?: boolean;
        announcements?: Row[];
      };
      if (res.ok && j.ok === true && Array.isArray(j.announcements)) {
        setRows(j.announcements);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const top = rows[0];
  if (!top || dismissed === top.id) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-r from-cyan-950/50 to-indigo-950/40 px-4 py-3 text-sm text-white/90 shadow-lg">
      <button
        type="button"
        aria-label="Dismiss announcement"
        className="absolute right-2 top-2 rounded-lg px-2 py-1 text-xs text-white/45 hover:bg-white/10 hover:text-white/80"
        onClick={() => setDismissed(top.id)}
      >
        ✕
      </button>
      <p className="pr-8 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/80">Announcement</p>
      <p className="mt-1 font-semibold text-white">{top.title}</p>
      <p className="mt-1 line-clamp-2 text-white/75">{top.message}</p>
    </div>
  );
}
