"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api-fetch";
import { glassPanel, ds } from "@/styles/design-system";
import { useInternalSession } from "./InternalSessionContext";
import { SalesNetworkRole } from "@prisma/client";

type TeamMember = {
  userId: string;
  name: string;
  email: string;
  salesNetworkRole: string | null;
  totalPoints: number;
  activeSubscriptions: number;
  promotionProgress: { nextRole?: string; progressPercent?: number; subsNeeded?: number; requiredActiveSubs?: number } | null;
  bdmRecurring: { tier: string; monthlyAmount: number } | null;
};

type TeamResponse = {
  total?: number;
  roleCount?: Record<string, number>;
  members?: TeamMember[];
};

function fadeUp(i = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay: i * 0.06 } };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const ROLE_META: Record<string, { color: string; bg: string; border: string }> = {
  BOSS: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  RSM: { color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30" },
  BDM: { color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30" },
  BDE: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  TECH_EXEC: { color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30" },
};

function ProgressBar({ pct, color = "from-[#4FD1FF] to-[#7C5CFF]" }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Member card
// ---------------------------------------------------------------------------

function MemberCard({ member }: { member: TeamMember }) {
  const role = member.salesNetworkRole ?? "BDE";
  const meta = ROLE_META[role] ?? ROLE_META.BDE;
  const pts = Math.round(member.totalPoints / 10);
  const progress = member.promotionProgress?.progressPercent ?? 0;

  return (
    <div className={`${glassPanel} p-5 flex flex-col gap-3`}>
      {/* Top */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-sm font-bold text-white/80">
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{member.name}</p>
          <p className="truncate text-xs text-white/30">{member.email}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${meta.bg} ${meta.color} ${meta.border}`}>
          {role}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
          <p className="text-xs text-white/30">Active Subs</p>
          <p className="mt-0.5 text-base font-bold text-[#4FD1FF]">{member.activeSubscriptions}</p>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 text-center">
          <p className="text-xs text-white/30">Points</p>
          <p className="mt-0.5 text-base font-bold text-white">{pts}</p>
        </div>
      </div>

      {/* BDM recurring */}
      {member.bdmRecurring && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">Recurring · {member.bdmRecurring.tier}</p>
          <p className="text-sm font-bold text-white mt-0.5">{fmt(member.bdmRecurring.monthlyAmount)}/mo</p>
        </div>
      )}

      {/* Promotion progress */}
      {member.promotionProgress?.nextRole && progress < 100 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-white/30">
            <span>→ {member.promotionProgress.nextRole}</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar pct={progress} color="from-emerald-500 to-cyan-500" />
          {(member.promotionProgress.subsNeeded ?? 0) > 0 && (
            <p className="text-[10px] text-white/20">{member.promotionProgress.subsNeeded} more subs needed</p>
          )}
        </div>
      )}

      {member.promotionProgress?.progressPercent === 100 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
          <p className="text-xs font-semibold text-amber-400">🚀 Promotion eligible</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function TeamDashboard() {
  const { salesNetworkRole } = useInternalSession();
  const [data, setData] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/internal/sales/team");
      const j = await res.json() as TeamResponse & { ok?: boolean };
      if (j.ok !== false) setData(j);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const members = data?.members ?? [];
  const roleCount = data?.roleCount ?? {};

  const filtered = filter === "ALL" ? members : members.filter((m) => m.salesNetworkRole === filter);

  const manageRoles: SalesNetworkRole[] = [SalesNetworkRole.BOSS, SalesNetworkRole.RSM, SalesNetworkRole.BDM];
  const canManage = manageRoles.includes(salesNetworkRole);

  return (
    <div className="min-h-full pb-20 pt-6" style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}>
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div {...fadeUp(0)} className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Team</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              {salesNetworkRole === SalesNetworkRole.BOSS ? "Full Network" : salesNetworkRole === SalesNetworkRole.RSM ? "Your Region" : "Your Team"}
            </h1>
            <p className="mt-1 text-sm text-white/40">{members.length} members · Active sales network</p>
          </div>
          <div className="flex gap-3">
            <button onClick={load} disabled={loading} className="rounded-xl bg-white/[0.04] border border-white/10 px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/[0.07] disabled:opacity-40 transition-colors">
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </motion.div>

        {/* Role summary tiles */}
        {Object.keys(roleCount).length > 0 && (
          <motion.div {...fadeUp(1)} className="mb-6 flex flex-wrap gap-3">
            {(["BOSS", "RSM", "BDM", "BDE", "TECH_EXEC"] as const).map((role) => {
              const count = roleCount[role] ?? 0;
              if (count === 0) return null;
              const meta = ROLE_META[role];
              return (
                <button
                  key={role}
                  onClick={() => setFilter(filter === role ? "ALL" : role)}
                  className={`rounded-xl border px-4 py-2.5 transition-all ${filter === role ? `${meta.bg} ${meta.border} ${meta.color}` : "border-white/[0.07] bg-white/[0.03] text-white/50 hover:bg-white/[0.05]"}`}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider">{role}</span>
                  <span className="ml-2 text-sm font-bold">{count}</span>
                </button>
              );
            })}
            {filter !== "ALL" && (
              <button onClick={() => setFilter("ALL")} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-xs font-medium text-white/30 hover:bg-white/[0.06] transition-all">
                Clear ×
              </button>
            )}
          </motion.div>
        )}

        {/* Management actions */}
        {canManage && (
          <motion.div {...fadeUp(2)} className={`${glassPanel} mb-6 flex flex-wrap gap-3 p-4`}>
            <button className="rounded-xl border border-[#4FD1FF]/20 bg-[#4FD1FF]/10 px-4 py-2 text-sm font-medium text-[#4FD1FF] hover:bg-[#4FD1FF]/20 transition-colors">
              + Add BDE
            </button>
            <button className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/[0.07] transition-colors">
              Assign Leads
            </button>
            <button className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/[0.07] transition-colors">
              Broadcast Message
            </button>
            {(salesNetworkRole === SalesNetworkRole.BOSS || salesNetworkRole === SalesNetworkRole.RSM) && (
              <button className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/[0.07] transition-colors">
                Upload Training
              </button>
            )}
          </motion.div>
        )}

        {/* Members grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${glassPanel} p-5 animate-pulse`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded bg-white/10" />
                    <div className="h-2 w-3/4 rounded bg-white/[0.07]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-12 rounded-xl bg-white/[0.05]" />
                  <div className="h-12 rounded-xl bg-white/[0.05]" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div {...fadeUp(3)} className={`${glassPanel} flex flex-col items-center gap-3 py-16`}>
            <svg className="h-12 w-12 text-white/20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <p className="text-white/40">No team members{filter !== "ALL" ? ` with role ${filter}` : ""}</p>
          </motion.div>
        ) : (
          <motion.div {...fadeUp(3)} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m, i) => (
              <motion.div key={m.userId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <MemberCard member={m} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
