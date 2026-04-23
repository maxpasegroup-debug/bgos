"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { apiFetch } from "@/lib/api-fetch";
import { glassPanel, glassPanelHover, ds } from "@/styles/design-system";

type TeamMember = { userId: string; name: string; email: string; salesNetworkRole: string | null; totalPoints: number; activeSubscriptions: number; bdmRecurring: { tier: string; monthlyAmount: number } | null };
type TeamData = { total: number; roleCount: Record<string, number>; members: TeamMember[] };
type Earnings = { totalAmount: number; monthly: { totalEarnings: number; activeSubs: number } };
type SubData = { total: number; activeCount: number };

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function fadeUp(i = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay: i * 0.06 } };
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, accent, icon }: { label: string; value: string; sub?: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className={`${glassPanel} p-5`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-white/40">{label}</p>
        {icon && <span className="text-white/30">{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/30">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nexa CEO Panel
// ---------------------------------------------------------------------------

function NexaCeoPanel({ team, earnings, subs }: { team: TeamData | null; earnings: Earnings | null; subs: SubData | null }) {
  const [announce, setAnnounce] = useState("");
  const weeklyPct = 72; // placeholder

  return (
    <div className={`${glassPanel} p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Nexa CEO Panel</p>
          <h2 className="mt-1 text-lg font-bold text-white">Command Overview</h2>
        </div>
        <span className="shrink-0 rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-400">
          {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
        </span>
      </div>

      {/* Key metrics row */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-center">
          <p className="text-[11px] text-white/40 uppercase tracking-wider">Network Revenue</p>
          <p className="mt-1 text-xl font-bold text-emerald-400">{earnings ? fmt(earnings.totalAmount) : "—"}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-center">
          <p className="text-[11px] text-white/40 uppercase tracking-wider">Active Subs</p>
          <p className="mt-1 text-xl font-bold text-[#4FD1FF]">{subs?.activeCount ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-center">
          <p className="text-[11px] text-white/40 uppercase tracking-wider">Team Size</p>
          <p className="mt-1 text-xl font-bold text-white">{team?.total ?? "—"}</p>
        </div>
      </div>

      {/* Weekly performance bar */}
      <div className="mt-5 space-y-2">
        <div className="flex justify-between text-xs text-white/40">
          <span>Weekly Performance</span>
          <span className="font-medium text-white/70">{weeklyPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-700" style={{ width: `${weeklyPct}%` }} />
        </div>
      </div>

      {/* Alerts */}
      <ul className="mt-5 space-y-2">
        {[
          "Review RSM promotions this week",
          "3 BDMs approaching the 50-sub milestone",
          "Tech queue has 2 pending items",
        ].map((alert, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
            <p className="text-sm text-white/60">{alert}</p>
          </li>
        ))}
      </ul>

      {/* Quick announce */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-medium text-white/40">Quick Announcement</p>
        <div className="flex gap-2">
          <input
            value={announce}
            onChange={(e) => setAnnounce(e.target.value)}
            placeholder="Broadcast to the team…"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
          />
          <button className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 transition-colors">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hierarchy / People & Network
// ---------------------------------------------------------------------------

function HierarchyPanel({ team }: { team: TeamData | null }) {
  const roleOrder = ["BOSS", "RSM", "BDM", "BDE", "TECH_EXEC"];
  const roleColors: Record<string, string> = {
    BOSS: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    RSM: "border-violet-500/40 bg-violet-500/10 text-violet-400",
    BDM: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
    BDE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    TECH_EXEC: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  };

  const byCounts = team?.roleCount ?? {};

  return (
    <div className={`${glassPanel} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-white">People & Network</p>
        <div className="flex gap-2">
          <button className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/[0.07] transition-colors">+ Add RSM</button>
          <button className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-400 hover:bg-sky-500/20 transition-colors">+ Tech Exec</button>
        </div>
      </div>

      {/* Role hierarchy visual */}
      <div className="space-y-2.5">
        {roleOrder.map((role) => {
          const count = byCounts[role] ?? 0;
          if (count === 0 && role !== "BOSS") return null;
          return (
            <div key={role} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${roleColors[role] ?? "border-white/10 text-white/50"}`}>
              <span className="text-xs font-semibold uppercase tracking-widest w-20">{role}</span>
              <div className="flex-1 h-1.5 rounded-full bg-black/30 overflow-hidden">
                <div className="h-full rounded-full bg-current opacity-50 transition-all" style={{ width: count > 0 ? `${Math.min(100, (count / 20) * 100)}%` : "5%" }} />
              </div>
              <span className="text-sm font-bold w-8 text-right">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Top performers */}
      {team && team.members.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-medium text-white/40">Top Performers</p>
          <ul className="space-y-2">
            {[...team.members].sort((a, b) => b.activeSubscriptions - a.activeSubscriptions).slice(0, 5).map((m, i) => (
              <li key={m.userId} className="flex items-center gap-2.5">
                <span className={`w-5 text-center text-xs font-bold ${i === 0 ? "text-amber-400" : "text-white/30"}`}>#{i + 1}</span>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-xs font-bold text-white/70">
                  {m.name.charAt(0)}
                </div>
                <p className="flex-1 truncate text-sm text-white/70">{m.name}</p>
                <span className="text-xs font-semibold text-[#4FD1FF]">{m.activeSubscriptions} subs</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accounts & Compliance
// ---------------------------------------------------------------------------

function AccountsPanel({ earnings, subs }: { earnings: Earnings | null; subs: SubData | null }) {
  const rows = [
    { label: "Network Revenue", value: earnings ? fmt(earnings.totalAmount) : "—", accent: "text-emerald-400" },
    { label: "This Period", value: earnings ? fmt(earnings.monthly?.totalEarnings ?? 0) : "—", accent: "text-white" },
    { label: "Active Subscriptions", value: subs ? String(subs.activeCount) : "—", accent: "text-[#4FD1FF]" },
    { label: "Total Subscriptions", value: subs ? String(subs.total) : "—", accent: "text-white/60" },
  ];

  return (
    <div className={`${glassPanel} p-6`}>
      <p className="mb-4 text-sm font-semibold text-white">Accounts & Compliance</p>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between py-2 border-b border-white/[0.05]">
            <span className="text-sm text-white/50">{r.label}</span>
            <span className={`text-sm font-bold ${r.accent}`}>{r.value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button className="rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-medium text-white/60 hover:bg-white/[0.07] transition-colors">Payout Report</button>
        <button className="rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-medium text-white/60 hover:bg-white/[0.07] transition-colors">Export CSV</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaigns / Competitions
// ---------------------------------------------------------------------------

function CampaignsPanel() {
  const campaigns = [
    { title: "Q2 Sprint", end: "Apr 30", status: "active", participants: 12 },
    { title: "Top BDE Award", end: "May 15", status: "upcoming", participants: 0 },
  ];

  return (
    <div className={`${glassPanel} p-6`}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-white">Campaigns & Competitions</p>
        <button className="rounded-lg bg-[#4FD1FF]/10 border border-[#4FD1FF]/20 px-3 py-1.5 text-xs font-medium text-[#4FD1FF] hover:bg-[#4FD1FF]/20 transition-colors">+ New</button>
      </div>
      <ul className="space-y-2.5">
        {campaigns.map((c) => (
          <li key={c.title} className={`${glassPanelHover} rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white">{c.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${c.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-white/40"}`}>
                {c.status}
              </span>
            </div>
            <div className="mt-1 flex gap-3 text-xs text-white/30">
              <span>Ends {c.end}</span>
              {c.participants > 0 && <span>· {c.participants} participants</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module grid (quick navigation)
// ---------------------------------------------------------------------------

function ModuleGrid() {
  const modules = [
    { href: "/internal/sales", label: "Sales Network", desc: "Hierarchy, targets, promotions", icon: "◎", color: "from-cyan-500/20 to-cyan-500/5" },
    { href: "/internal/team", label: "People", desc: "RSM, franchise partner, BDE management", icon: "◆", color: "from-violet-500/20 to-violet-500/5" },
    { href: "/internal/wallet", label: "Accounts", desc: "Revenue, payouts, compliance", icon: "◇", color: "from-emerald-500/20 to-emerald-500/5" },
    { href: "/internal/tech", label: "Tech Queue", desc: "Requests, queue, completions", icon: "⎔", color: "from-sky-500/20 to-sky-500/5" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {modules.map((m) => (
        <Link key={m.href} href={m.href} className={`${glassPanelHover} rounded-[20px] border border-white/[0.08] bg-gradient-to-br ${m.color} p-5 hover:border-white/20 transition-all`}>
          <span className="text-2xl">{m.icon}</span>
          <p className="mt-3 text-sm font-semibold text-white">{m.label}</p>
          <p className="mt-1 text-xs text-white/40">{m.desc}</p>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function BossDashboard() {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [subs, setSubs] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, e, s] = await Promise.all([
        apiFetch("/api/internal/sales/team").then((r) => r.json() as Promise<{ ok?: boolean } & TeamData>),
        apiFetch("/api/internal/sales/earnings").then((r) => r.json() as Promise<{ ok?: boolean } & Earnings>),
        apiFetch("/api/internal/sales/subscriptions?take=5").then((r) => r.json() as Promise<{ ok?: boolean } & SubData>),
      ]);
      if (t.ok !== false) setTeam(t);
      if (e.ok !== false) setEarnings(e);
      if (s.ok !== false) setSubs(s);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-full pb-20 pt-6" style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}>
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div {...fadeUp(0)} className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Internal Control</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Boss Dashboard</h1>
            <p className="mt-1 text-sm text-white/40">Platform-level oversight and team management</p>
          </div>
          <button onClick={load} disabled={loading} className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/[0.07] disabled:opacity-40 transition-colors">
            {loading ? "Loading…" : "Refresh"}
          </button>
        </motion.div>

        {/* Top stats */}
        <motion.div {...fadeUp(1)} className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Network Revenue" value={earnings ? fmt(earnings.totalAmount) : "—"} accent="text-emerald-400" />
          <StatCard label="Active Subs" value={subs ? String(subs.activeCount) : "—"} accent="text-[#4FD1FF]" />
          <StatCard label="Team Size" value={team ? String(team.total) : "—"} />
          <StatCard label="Franchise Partners" value={String(team?.roleCount?.BDM ?? 0)} sub="active partners" />
        </motion.div>

        {/* Module navigation */}
        <motion.div {...fadeUp(2)} className="mb-6"><ModuleGrid /></motion.div>

        {/* Main grid */}
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <motion.div {...fadeUp(3)}><NexaCeoPanel team={team} earnings={earnings} subs={subs} /></motion.div>
            <motion.div {...fadeUp(4)}><CampaignsPanel /></motion.div>
            <motion.div {...fadeUp(5)}><AccountsPanel earnings={earnings} subs={subs} /></motion.div>
          </div>
          <div className="space-y-6">
            <motion.div {...fadeUp(3)}><HierarchyPanel team={team} /></motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
