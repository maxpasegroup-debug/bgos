"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";

type Announcement = { id: string; title: string; body: string; createdAt: string };
type BonusTeaser = { id: string; title: string; bonusType: string; poolAmount: number | null };
type MegaTeaser = { id: string; name: string; prizeDescription: string };

const DISMISS_KEY = "bgos:incentives:dismissed";

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const j = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(ids.slice(-40)));
  } catch {
    /* ignore */
  }
}

export function IncentivesFeedBanner({ variant }: { variant: "sales" | "franchise" }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [bonuses, setBonuses] = useState<BonusTeaser[]>([]);
  const [megas, setMegas] = useState<MegaTeaser[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/incentives/feed", { credentials: "include" });
      const j = ((await readApiJson(res, "incentives/feed")) ?? {}) as {
        ok?: boolean;
        announcements?: Announcement[];
        bonusTeasers?: BonusTeaser[];
        megaTeasers?: MegaTeaser[];
        error?: string;
      };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Could not load incentives");
      setAnnouncements(j.announcements ?? []);
      setBonuses(j.bonusTeasers ?? []);
      setMegas(j.megaTeasers ?? []);
    } catch (e) {
      console.warn(formatFetchFailure(e, "incentives feed"));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const visible = useMemo(
    () => announcements.filter((a) => !dismissed.includes(a.id)),
    [announcements, dismissed],
  );

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    writeDismissed(next);
  }

  const hasExtras = bonuses.length > 0 || megas.length > 0;
  if (!loaded || (visible.length === 0 && !hasExtras)) return null;

  const shell =
    variant === "franchise"
      ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-50"
      : "border-slate-200/90 bg-gradient-to-r from-white to-slate-50 text-slate-800 shadow-sm";

  return (
    <div className={`mb-4 space-y-3 rounded-2xl border px-4 py-3 backdrop-blur-md ${shell}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">
          Offers & incentives
        </p>
        {variant === "franchise" ? (
          <Link
            href="/iceconnect/wallet"
            className="text-[11px] font-medium text-emerald-200/90 underline-offset-2 hover:underline"
          >
            Wallet
          </Link>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {visible.map((a) => (
          <motion.div
            key={a.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className={
              variant === "franchise"
                ? "rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-left"
                : "rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-left shadow-sm"
            }
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="mt-0.5 line-clamp-3 text-xs opacity-80">{a.body}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(a.id)}
                className={
                  variant === "franchise"
                    ? "shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-100/80 hover:bg-white/10"
                    : "shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100"
                }
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {bonuses.length > 0 ? (
        <div className="text-left text-xs opacity-85">
          <span className="font-semibold">Bonus this month: </span>
          {bonuses.map((b) => b.title).join(" · ")}
        </div>
      ) : null}
      {megas.length > 0 ? (
        <div className="text-left text-xs opacity-85">
          <span className="font-semibold">Mega prize: </span>
          {megas.map((m) => m.name).join(" · ")}
        </div>
      ) : null}
    </div>
  );
}
