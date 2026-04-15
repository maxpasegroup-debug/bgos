"use client";


import { apiFetch } from "@/lib/api-fetch";
import { useCallback, useEffect, useState } from "react";

type N = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export function InternalNotificationsBell({ theme }: { theme: "bgos" | "ice" }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/internal-sales/notifications", { credentials: "include" });
      const j = (await res.json()) as Record<string, unknown>;
      if (!res.ok || j.ok !== true) return;
      const list = Array.isArray(j.notifications) ? (j.notifications as N[]) : [];
      setItems(list);
      setUnread(typeof j.unreadCount === "number" ? j.unreadCount : list.filter((x) => !x.readAt).length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const boot = window.setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 60000);
    return () => {
      clearTimeout(boot);
      clearInterval(t);
    };
  }, [load]);

  async function markOne(id: string) {
    await apiFetch(`/api/internal-sales/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
    });
    void load();
  }

  async function markAll() {
    await apiFetch("/api/internal-sales/notifications", {
      method: "PATCH",
      credentials: "include",
    });
    void load();
  }

  const btn =
    theme === "bgos"
      ? "relative rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white"
      : "relative rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm";

  return (
    <div className="relative">
      <button type="button" className={btn} onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        Alerts
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className={
            theme === "bgos"
              ? "absolute right-0 z-50 mt-2 w-[min(100vw-2rem,360px)] rounded-xl border border-white/10 bg-[#0f1628] p-2 shadow-xl"
              : "absolute right-0 z-50 mt-2 w-[min(100vw-2rem,360px)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
          }
        >
          <div className="mb-2 flex items-center justify-between px-2">
            <span className={theme === "bgos" ? "text-xs text-white/60" : "text-xs text-slate-500"}>
              In-app alerts
            </span>
            <button
              type="button"
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
              onClick={() => void markAll()}
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {items.length === 0 ? (
              <li className={theme === "bgos" ? "px-2 py-4 text-sm text-white/50" : "px-2 py-4 text-sm text-slate-500"}>
                No alerts
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={
                      theme === "bgos"
                        ? `w-full rounded-lg px-2 py-2 text-left text-sm ${n.readAt ? "opacity-60" : "bg-white/5"}`
                        : `w-full rounded-lg px-2 py-2 text-left text-sm ${n.readAt ? "opacity-60" : "bg-slate-50"}`
                    }
                    onClick={() => {
                      if (!n.readAt) void markOne(n.id);
                    }}
                  >
                    <span className="font-medium">{n.title}</span>
                    <span className="mt-0.5 block text-xs opacity-80">{n.body}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
