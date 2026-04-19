"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SalesNetworkRole } from "@prisma/client";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { glassCard, subtleText, accent, btnPrimary } from "@/components/internal/internalUi";

type TeamPayload = {
  ok: true;
  departments: {
    sales: {
      userId: string;
      name: string | null;
      email: string;
      salesNetworkRole: SalesNetworkRole | null;
      parentUserId: string | null;
      totalPoints: number;
      activeSubscriptionsCount: number;
    }[];
  };
};

type Promo = {
  tracker: {
    eligible_for_promotion: boolean;
    role_target: SalesNetworkRole | null;
    active_count_snapshot: number | null;
  } | null;
  active_subscriptions_count: number;
};

export function BdmSalesDashboard() {
  const [myId, setMyId] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ max: number } | null>(null);
  const [team, setTeam] = useState<TeamPayload["departments"]["sales"]>([]);
  const [earn, setEarn] = useState<{
    override_inr: number;
    recurring_inr: number;
    total_inr: number;
  } | null>(null);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [ctxRes, teamRes, eRes, pRes] = await Promise.all([
        apiFetch("/api/internal/context", { credentials: "include" }),
        apiFetch("/api/internal/team?role=BDE&limit=200", { credentials: "include" }),
        apiFetch("/api/internal/earnings-summary", { credentials: "include" }),
        apiFetch("/api/internal/promotion-tracker", { credentials: "include" }),
      ]);
      const ctx = (await readApiJson(ctxRes, "ctx-bdm")) as {
        ok?: boolean;
        user?: { id: string };
        bde_slot_limit?: number;
      };
      if (ctxRes.ok && ctx.ok && ctx.user?.id) {
        setMyId(ctx.user.id);
        setSlots({ max: typeof ctx.bde_slot_limit === "number" ? ctx.bde_slot_limit : 0 });
      }

      const tj = (await readApiJson(teamRes, "team-bdm")) as TeamPayload;
      if (teamRes.ok && tj.ok) setTeam(tj.departments.sales);

      const ej = (await readApiJson(eRes, "earn-bdm")) as typeof earn & { ok?: boolean };
      if (eRes.ok && ej && ej.ok !== false) setEarn(ej);

      const pr = (await readApiJson(pRes, "promo-bdm")) as Promo & { ok?: boolean };
      if (pRes.ok && pr.ok !== false) setPromo(pr);
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not load BDM workspace"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const myTeam = useMemo(() => {
    if (!myId) return [];
    return team.filter((r) => r.parentUserId === myId && r.salesNetworkRole === SalesNetworkRole.BDE);
  }, [team, myId]);

  const usedSlots = myTeam.length;

  return (
    <div className="space-y-6">
      <section className={`${glassCard} p-6`}>
        <h1 className="text-2xl font-bold text-white">BDM workspace</h1>
        <p className={`${subtleText} mt-2 max-w-2xl`}>
          Coach your BDE bench, watch overrides and recurring earnings, and track promotion momentum toward RSM.
        </p>
      </section>

      {err ? <p className="text-sm text-amber-300/90">{err}</p> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`${glassCard} p-5 lg:col-span-2`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Team (BDE)</h2>
            <button type="button" className="text-xs font-medium text-[#4FD1FF] hover:underline" onClick={() => void load()}>
              Refresh
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {myTeam.length === 0 ? <p className={`${subtleText} text-sm`}>No BDEs mapped under you yet.</p> : null}
            {myTeam.map((m) => (
              <div
                key={m.userId}
                className="flex flex-col justify-between gap-2 rounded-xl border border-white/[0.06] bg-black/25 px-4 py-3 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-medium text-white">{m.name ?? m.email}</p>
                  <p className={`${subtleText} text-xs`}>{m.email}</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-white/80">
                    Points: <strong className="text-white">{m.totalPoints}</strong>
                  </span>
                  <span className="text-white/80">
                    Active subs: <strong className="text-white">{m.activeSubscriptionsCount}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${glassCard} p-5`}>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/70">BDE slots</h3>
            <p className="mt-3 text-3xl font-bold text-white">
              {usedSlots} / {slots?.max ?? "—"}
            </p>
            <p className={`${subtleText} mt-2 text-xs`}>Used vs configured slot ceiling for your desk.</p>
            <Link href="/internal/onboard-company" className={`${btnPrimary} mt-4 w-full`}>
              Add BDE capacity
            </Link>
          </div>

          <div className={`${glassCard} p-5`}>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/70">Earnings</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className={subtleText}>Overrides</dt>
                <dd className="font-semibold text-white">₹{(earn?.override_inr ?? 0).toLocaleString("en-IN")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className={subtleText}>Recurring</dt>
                <dd className="font-semibold text-white">₹{(earn?.recurring_inr ?? 0).toLocaleString("en-IN")}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-white/10 pt-2">
                <dt className="text-white/80">Total</dt>
                <dd className={`font-bold ${accent}`}>₹{(earn?.total_inr ?? 0).toLocaleString("en-IN")}</dd>
              </div>
            </dl>
          </div>

          <div className={`${glassCard} p-5`}>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white/70">Promotion tracker</h3>
            <p className="mt-2 text-sm text-white/85">
              Active subscriptions (you):{" "}
              <strong className="text-white">{promo?.active_subscriptions_count ?? 0}</strong>
            </p>
            <p className={`${subtleText} mt-2 text-xs`}>
              Snapshot: {promo?.tracker?.active_count_snapshot ?? "—"} · Target role:{" "}
              {promo?.tracker?.role_target ?? "RSM path"}
            </p>
            <p className="mt-2 text-xs text-emerald-300/90">
              {promo?.tracker?.eligible_for_promotion
                ? "Eligible for promotion review — confirm with internal leadership."
                : "Keep pacing active client wins to unlock RSM eligibility."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
