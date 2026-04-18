"use client";

import { apiFetch } from "@/lib/api-fetch";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import {
  IconBell,
  IconMegaphone,
  IconMessage,
  IconRadio,
  IconWorkflow,
} from "@/components/sales-booster/SalesBoosterIcons";
import { SB_CARD, SB_PAGE } from "@/components/sales-booster/salesBoosterUi";

type Summary = {
  connectedChannels: number;
  activeCampaigns: number;
  unreadMessages: number;
};

function parseSummaryPayload(j: Record<string, unknown>): Summary | null {
  const data = j.data;
  if (data && typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>;
    return {
      connectedChannels: Number(o.connectedChannels ?? 0),
      activeCampaigns: Number(o.activeCampaigns ?? 0),
      unreadMessages: Number(o.unreadMessages ?? 0),
    };
  }
  return {
    connectedChannels: Number(j.connectedChannels ?? 0),
    activeCampaigns: Number(j.activeCampaigns ?? 0),
    unreadMessages: Number(j.unreadMessages ?? 0),
  };
}

const modules = [
  {
    href: "/sales-booster/inbox",
    title: "Inbox",
    desc: "Unified conversations",
    icon: IconMessage,
  },
  {
    href: "/sales-booster/automation",
    title: "Automation",
    desc: "Flows & auto-reply",
    icon: IconWorkflow,
  },
  {
    href: "/sales-booster/campaigns",
    title: "Campaigns",
    desc: "Broadcasts & follow-ups",
    icon: IconMegaphone,
  },
  {
    href: "/sales-booster/connections",
    title: "Connections",
    desc: "Channels & API keys",
    icon: IconRadio,
  },
] as const;

export function SalesBoosterHubClient() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-booster/omni/summary", { credentials: "include" });
      const j = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        setErr((j.message as string) ?? "Could not load Sales Booster.");
        return;
      }
      setSummary(parseSummaryPayload(j));
    } catch {
      setErr("Could not load Sales Booster.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = summary?.unreadMessages ?? 0;

  return (
    <div className={`min-h-0 flex-1 overflow-y-auto ${BGOS_MAIN_PAD} pb-16 pt-6`}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-10%,rgba(34,211,238,0.08),transparent)]" />

      <div className={SB_PAGE}>
        {/* Nexa-style banner */}
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/90">
            You have{" "}
            <span className="font-semibold text-cyan-200">{unread === 0 ? "no" : unread}</span> unread{" "}
            {unread === 1 ? "message" : "messages"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sales-booster/inbox"
              className="rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.1]"
            >
              Open Inbox
            </Link>
            <Link
              href="/sales-booster/campaigns"
              className="rounded-xl border border-cyan-400/30 bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-50 transition hover:bg-cyan-500/30"
            >
              Launch Campaign
            </Link>
          </div>
        </div>

        {/* Top bar */}
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Sales Booster</h1>
            <p className="mt-1 text-sm text-white/50">Omnichannel command center</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/80">
              Connected channels:{" "}
              <strong className="text-emerald-300">{summary?.connectedChannels ?? "—"}</strong>
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/80">
              Active campaigns:{" "}
              <strong className="text-amber-200">{summary?.activeCampaigns ?? "—"}</strong>
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/70"
              aria-label="Notifications"
            >
              <IconBell className="h-4 w-4" />
              Alerts
            </button>
          </div>
        </header>

        {err ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{err}</p>
        ) : null}

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`group block ${SB_CARD} hover:border-cyan-400/25`}
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-200 ring-1 ring-white/10 transition group-hover:bg-cyan-500/15">
                  <m.icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{m.title}</h2>
                  <p className="mt-1 text-sm text-white/50">{m.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
