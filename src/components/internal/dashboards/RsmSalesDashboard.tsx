"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { glassCard, subtleText, btnGhost } from "@/components/internal/internalUi";

type HierarchyNode = {
  user_id: string;
  name: string | null;
  email: string;
  role: string | null;
  region: string | null;
  total_points: number;
  active_subscriptions_count: number;
  children: HierarchyNode[];
};

type Overview = {
  ok: true;
  totals: {
    revenue_inr: number;
    active_subscriptions: number;
    bde_count: number;
    bdm_count: number;
    rsm_count: number;
    executives: number;
  };
  tree: HierarchyNode[];
  top_performers: { user_id: string; name: string | null; email: string; role: string | null; total_points: number }[];
  weak_performers: { user_id: string; name: string | null; email: string; active_subscriptions_count: number }[];
};

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  statusLabel: string;
};

type Member = {
  userId: string;
  name: string | null;
  email: string;
  salesNetworkRole: string | null;
};

function TreeNodes({ nodes, depth = 0 }: { nodes: HierarchyNode[]; depth?: number }) {
  if (!nodes?.length) return <p className={`${subtleText} text-sm`}>No hierarchy rows.</p>;
  return (
    <ul className={depth ? "ml-4 border-l border-white/10 pl-4" : ""}>
      {nodes.map((n) => (
        <li key={n.user_id} className="py-1.5">
          <p className="text-sm text-white">
            <span className="text-[#4FD1FF]">{n.role ?? "—"}</span> · {n.name ?? n.email}
            {n.region ? <span className="text-white/50"> · {n.region}</span> : null}
          </p>
          <p className={`${subtleText} text-xs`}>
            Points {n.total_points} · Active subs {n.active_subscriptions_count}
          </p>
          {n.children?.length ? <TreeNodes nodes={n.children} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function RsmSalesDashboard() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [bdeList, setBdeList] = useState<Member[]>([]);
  const [assignLeadId, setAssignLeadId] = useState<string | null>(null);
  const [assignUser, setAssignUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [oRes, lRes, tRes] = await Promise.all([
        apiFetch("/api/internal/hierarchy-overview", { credentials: "include" }),
        apiFetch("/api/internal/leads?limit=30&scope=all", { credentials: "include" }),
        apiFetch("/api/internal/team?role=BDE&limit=200", { credentials: "include" }),
      ]);
      const oj = (await readApiJson(oRes, "rsm-ov")) as Overview;
      if (oRes.ok && oj.ok) setOv(oj);

      const lj = (await readApiJson(lRes, "rsm-leads")) as { ok?: boolean; leads?: LeadRow[] };
      if (lRes.ok && lj.ok && Array.isArray(lj.leads)) setLeads(lj.leads);

      const tj = (await readApiJson(tRes, "rsm-team")) as {
        ok?: boolean;
        departments?: { sales?: Member[] };
      };
      if (tRes.ok && tj.ok && tj.departments?.sales) {
        setBdeList(
          tj.departments.sales.map((s: { userId: string; name: string | null; email: string; salesNetworkRole: string | null }) => ({
            userId: s.userId,
            name: s.name,
            email: s.email,
            salesNetworkRole: s.salesNetworkRole,
          })),
        );
      }
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not load RSM workspace"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function assignLead(leadId: string) {
    if (!assignUser) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/internal/leads/${leadId}/assign`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: assignUser }),
      });
      const j = (await readApiJson(res, "assign")) as { ok?: boolean };
      if (res.ok && j.ok) {
        setAssignLeadId(null);
        setAssignUser("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className={`${glassCard} p-6`}>
        <h1 className="text-2xl font-bold text-white">RSM region overview</h1>
        <p className={`${subtleText} mt-2`}>Revenue, bench depth, and lead routing across your hierarchy.</p>
      </section>

      {err ? <p className="text-sm text-amber-300/90">{err}</p> : null}

      {ov ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Network revenue (INR)", value: ov.totals.revenue_inr.toLocaleString("en-IN") },
            { label: "Active subscriptions", value: String(ov.totals.active_subscriptions) },
            { label: "BDE / BDM / RSM", value: `${ov.totals.bde_count} / ${ov.totals.bdm_count} / ${ov.totals.rsm_count}` },
          ].map((x) => (
            <div key={x.label} className={`${glassCard} p-5`}>
              <p className={`${subtleText} text-xs uppercase tracking-widest`}>{x.label}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{x.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${glassCard} p-5`}>
          <h2 className="text-lg font-semibold text-white">Top performers</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ov?.top_performers?.map((p) => (
              <li key={p.user_id} className="flex justify-between gap-2 border-b border-white/5 py-2">
                <span className="text-white/90">{p.name ?? p.email}</span>
                <span className="text-[#4FD1FF]">{p.total_points} pts</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={`${glassCard} p-5`}>
          <h2 className="text-lg font-semibold text-white">Needs coaching</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ov?.weak_performers?.map((p) => (
              <li key={p.user_id} className="flex justify-between gap-2 border-b border-white/5 py-2">
                <span className="text-white/90">{p.name ?? p.email}</span>
                <span className="text-amber-200/90">{p.active_subscriptions_count} subs</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={`${glassCard} p-5`}>
        <h2 className="text-lg font-semibold text-white">Lead distribution</h2>
        <p className={`${subtleText} mt-1 text-sm`}>Assign open leads to a BDE on your network.</p>
        <div className="mt-4 space-y-3">
          {leads.map((l) => (
            <div
              key={l.id}
              className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <p className="font-medium text-white">{l.name}</p>
                <p className={`${subtleText} text-xs`}>{l.phone}</p>
                <p className="text-xs text-white/70">{l.statusLabel}</p>
              </div>
              {assignLeadId === l.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-lg border border-white/15 bg-black/40 px-2 py-2 text-sm text-white"
                    value={assignUser}
                    onChange={(e) => setAssignUser(e.target.value)}
                  >
                    <option value="">Select BDE…</option>
                    {bdeList.map((b) => (
                      <option key={b.userId} value={b.userId}>
                        {b.name ?? b.email}
                      </option>
                    ))}
                  </select>
                  <button type="button" className={btnGhost} disabled={busy} onClick={() => void assignLead(l.id)}>
                    {busy ? "…" : "Confirm"}
                  </button>
                  <button type="button" className={btnGhost} onClick={() => setAssignLeadId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className={btnGhost} onClick={() => setAssignLeadId(l.id)}>
                  Assign
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={`${glassCard} p-5`}>
        <h2 className="text-lg font-semibold text-white">Hierarchy</h2>
        <p className={`${subtleText} mt-1 text-sm`}>
          Expandable view of RSM → BDM → BDE relationships from live org data.
        </p>
        <div className="mt-4 max-h-[480px] overflow-auto rounded-xl border border-white/10 bg-black/30 p-4">
          <TreeNodes nodes={ov?.tree ?? []} />
        </div>
      </div>
    </div>
  );
}
