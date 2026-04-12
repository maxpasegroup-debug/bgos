"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";

type DetailJson = {
  ok?: boolean;
  company?: {
    id: string;
    name: string;
    plan: string;
    subscriptionStatus: string;
    category: string;
    trialEndDate: string | null;
    subscriptionPeriodEnd: string | null;
  };
  boss?: { name: string; email: string; mobile: string | null } | null;
  billingHistory: { id: string; amount: number; currency: string; status: string; createdAt: string }[];
  assignedSalesExecutive: { name: string; email: string; jobRole: string } | null;
  activityTimeline: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
    actorName: string | null;
  }[];
};

export default function ControlClientDetailPage() {
  const params = useParams();
  const companyId = typeof params.companyId === "string" ? params.companyId : "";
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [data, setData] = useState<DetailJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const res = await fetch(`/api/bgos/control/clients/${companyId}`, { credentials: "include" });
      const j = (await res.json()) as DetailJson & { error?: string };
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Failed to load");
        return;
      }
      setData(j);
    } catch {
      setError("Network error");
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardShell = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-5";
  const h2 = light ? "text-sm font-bold text-slate-900" : "text-sm font-bold text-white";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";

  const c = data?.company;

  return (
    <div className={`mx-auto max-w-4xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <Link
        href="/bgos/control/clients"
        className={muted + " mb-4 inline-block text-xs font-semibold hover:underline"}
      >
        ← Clients
      </Link>

      {error ? <p className="text-sm text-amber-500">{error}</p> : null}
      {!c && !error ? <p className={muted}>Loading…</p> : null}

      {c ? (
        <>
          <h1 className={light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white"}>{c.name}</h1>
          <p className={muted + " mt-1"}>
            {c.category} plan · {c.subscriptionStatus}
          </p>

          <section className="mt-8 space-y-6">
            <div className={cardShell}>
              <h2 className={h2}>Overview</h2>
              <ul className={muted + " mt-3 space-y-1 text-sm"}>
                <li>Plan: {c.plan}</li>
                <li>Status: {c.subscriptionStatus}</li>
                {c.trialEndDate ? <li>Trial ends: {new Date(c.trialEndDate).toLocaleString()}</li> : null}
                {c.subscriptionPeriodEnd ? (
                  <li>Subscription period end: {new Date(c.subscriptionPeriodEnd).toLocaleString()}</li>
                ) : null}
              </ul>
            </div>

            <div className={cardShell}>
              <h2 className={h2}>Boss details</h2>
              {data?.boss ? (
                <ul className={muted + " mt-3 space-y-1 text-sm"}>
                  <li>{data.boss.name}</li>
                  <li>{data.boss.email}</li>
                  {data.boss.mobile ? <li>{data.boss.mobile}</li> : null}
                </ul>
              ) : (
                <p className={muted + " mt-2"}>—</p>
              )}
            </div>

            <div className={cardShell}>
              <h2 className={h2}>Assigned sales executive</h2>
              {data?.assignedSalesExecutive ? (
                <p className={muted + " mt-3 text-sm"}>
                  {data.assignedSalesExecutive.name} ({data.assignedSalesExecutive.jobRole}) ·{" "}
                  {data.assignedSalesExecutive.email}
                </p>
              ) : (
                <p className={muted + " mt-2 text-sm"}>Not assigned</p>
              )}
            </div>

            <div className={cardShell}>
              <h2 className={h2}>Billing history</h2>
              <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto text-sm">
                {(data?.billingHistory ?? []).length === 0 ? (
                  <li className={muted}>No Razorpay records</li>
                ) : (
                  data!.billingHistory.map((b) => (
                    <li key={b.id} className={muted}>
                      {(b.amount / 100).toFixed(2)} {b.currency} · {b.status} ·{" "}
                      {new Date(b.createdAt).toLocaleDateString()}
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className={cardShell}>
              <h2 className={h2}>Activity timeline</h2>
              <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
                {(data?.activityTimeline ?? []).length === 0 ? (
                  <li className={muted}>No activity yet</li>
                ) : (
                  data!.activityTimeline.map((a) => (
                    <li key={a.id} className={muted}>
                      <span className="font-medium text-inherit">{a.type}</span>{" "}
                      {a.message ? `— ${a.message}` : ""}
                      <br />
                      <span className="text-xs opacity-80">
                        {a.actorName ?? "System"} · {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
