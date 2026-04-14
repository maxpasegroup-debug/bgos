"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";

const PIPELINE = ["APPLICATION", "REVIEW", "TRAINING", "MOU", "APPROVED", "REJECTED"] as const;

type AppRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
  experience: string | null;
  status: string;
  referredBy: { id: string; name: string; email: string } | null;
  assignedTo: { id: string; name: string; email: string } | null;
  hasPartner: boolean;
  createdAt: string;
};

type TxRow = {
  id: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
  partner: { id: string; name: string; phone: string };
  company: { id: string; name: string };
};

export function MicroFranchiseControlClient() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [tab, setTab] = useState<"pipeline" | "offers" | "wallet">("pipeline");
  const [apps, setApps] = useState<AppRow[]>([]);
  const [offers, setOffers] = useState<
    { id: string; name: string; type: string; value: number; recurring: boolean; instantBonus: number | null }[]
  >([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [assignDraft, setAssignDraft] = useState<Record<string, string>>({});
  const [selectedTx, setSelectedTx] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const card = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-5";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";
  const h1 = light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white";

  const loadApps = useCallback(async () => {
    const res = await apiFetch("/api/bgos/control/micro-franchise/applications", { credentials: "include" });
    const j = ((await readApiJson(res, "mf/apps")) ?? {}) as { ok?: boolean; applications?: AppRow[]; error?: string };
    if (!res.ok || j.ok !== true) throw new Error(j.error || "Could not load applications");
    setApps(j.applications ?? []);
  }, []);

  const loadOffers = useCallback(async () => {
    const res = await apiFetch("/api/bgos/control/micro-franchise/offers", { credentials: "include" });
    const j = ((await readApiJson(res, "mf/offers")) ?? {}) as {
      ok?: boolean;
      offers?: typeof offers;
      error?: string;
    };
    if (!res.ok || j.ok !== true) throw new Error(j.error || "Could not load offers");
    setOffers(j.offers ?? []);
  }, []);

  const loadTx = useCallback(async () => {
    const res = await apiFetch("/api/bgos/control/micro-franchise/wallet/pending", { credentials: "include" });
    const j = ((await readApiJson(res, "mf/tx")) ?? {}) as { ok?: boolean; transactions?: TxRow[]; error?: string };
    if (!res.ok || j.ok !== true) throw new Error(j.error || "Could not load wallet queue");
    setTxs(j.transactions ?? []);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([loadApps(), loadOffers(), loadTx()]);
    } catch (e) {
      setError(formatFetchFailure(e, "Could not load"));
    }
  }, [loadApps, loadOffers, loadTx]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const byStatus = useMemo(() => {
    const m = new Map<string, AppRow[]>();
    for (const s of PIPELINE) m.set(s, []);
    for (const a of apps) {
      const list = m.get(a.status) ?? m.get("APPLICATION")!;
      list.push(a);
    }
    return m;
  }, [apps]);

  async function patchApp(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/bgos/control/micro-franchise/applications/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = ((await readApiJson(res, "mf/patch")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Update failed");
      await loadApps();
    } catch (e) {
      setError(formatFetchFailure(e, "Update failed"));
    } finally {
      setBusy(null);
    }
  }

  async function activateMou(id: string) {
    setBusy(`mou-${id}`);
    setError(null);
    try {
      const res = await apiFetch(`/api/bgos/control/micro-franchise/applications/${id}/activate-mou`, {
        method: "POST",
        credentials: "include",
      });
      const j = ((await readApiJson(res, "mf/mou")) ?? {}) as {
        ok?: boolean;
        error?: string;
        temporaryPassword?: string;
        loginEmail?: string;
      };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Activation failed");
      if (j.temporaryPassword && j.loginEmail) {
        window.alert(`Partner login\nEmail: ${j.loginEmail}\nTemporary password: ${j.temporaryPassword}`);
      }
      await loadApps();
    } catch (e) {
      setError(formatFetchFailure(e, "Activation failed"));
    } finally {
      setBusy(null);
    }
  }

  function moveStage(id: string, current: string, dir: -1 | 1) {
    const idx = PIPELINE.indexOf(current as (typeof PIPELINE)[number]);
    if (idx < 0) return;
    const next = PIPELINE[Math.min(PIPELINE.length - 1, Math.max(0, idx + dir))];
    if (next === current) return;
    void patchApp(id, { status: next });
  }

  async function releaseSelected() {
    const ids = [...selectedTx];
    if (!ids.length) return;
    setBusy("release");
    try {
      const res = await apiFetch("/api/bgos/control/micro-franchise/wallet/release", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: ids }),
      });
      const j = ((await readApiJson(res, "mf/release")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Release failed");
      setSelectedTx(new Set());
      await loadTx();
    } catch (e) {
      setError(formatFetchFailure(e, "Release failed"));
    } finally {
      setBusy(null);
    }
  }

  async function payoutSelected() {
    const ids = [...selectedTx];
    if (!ids.length) return;
    setBusy("payout");
    try {
      const res = await apiFetch("/api/bgos/control/micro-franchise/wallet/payout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionIds: ids }),
      });
      const j = ((await readApiJson(res, "mf/payout")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Payout mark failed");
      setSelectedTx(new Set());
      await loadTx();
    } catch (e) {
      setError(formatFetchFailure(e, "Payout failed"));
    } finally {
      setBusy(null);
    }
  }

  const [offerName, setOfferName] = useState("");
  const [offerType, setOfferType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [offerValue, setOfferValue] = useState(5);
  const [offerRecurring, setOfferRecurring] = useState(true);

  async function createOffer(e: React.FormEvent) {
    e.preventDefault();
    setBusy("offer");
    try {
      const res = await apiFetch("/api/bgos/control/micro-franchise/offers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: offerName.trim(),
          type: offerType,
          value: offerValue,
          recurring: offerRecurring,
        }),
      });
      const j = ((await readApiJson(res, "mf/create-offer")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Could not create");
      setOfferName("");
      await loadOffers();
    } catch (e) {
      setError(formatFetchFailure(e, "Create offer failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`mx-auto max-w-7xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={h1}>Online Micro Franchise</h1>
          <p className={muted + " mt-1"}>Applications, offers, commissions, and boss overrides.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pipeline", "offers", "wallet"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-black"
                  : light
                    ? "rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                    : "rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/80"
              }
            >
              {t === "pipeline" ? "Pipeline" : t === "offers" ? "Offers" : "Wallet queue"}
            </button>
          ))}
          <Link
            href="/bgos/control/micro-franchise/offers"
            className={light ? "text-xs text-cyan-700 underline" : "text-xs text-cyan-300 underline"}
          >
            Deep link: offers page
          </Link>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-amber-500">{error}</p> : null}

      {tab === "pipeline" ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-6">
          {PIPELINE.map((status) => (
            <div key={status} className={card + " min-h-[240px]"}>
              <p className={light ? "text-xs font-bold uppercase text-slate-500" : "text-xs font-bold uppercase text-white/50"}>
                {status}
              </p>
              <div className="mt-3 space-y-2">
                {(byStatus.get(status) ?? []).map((a) => (
                  <div
                    key={a.id}
                    className={
                      light
                        ? "rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs"
                        : "rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-white/90"
                    }
                  >
                    <p className="font-semibold">{a.name}</p>
                    <p className="opacity-80">{a.phone}</p>
                    {a.referredBy ? (
                      <p className="mt-1 text-[10px] opacity-70">Ref: {a.referredBy.name}</p>
                    ) : null}
                    {a.hasPartner ? <p className="mt-1 text-emerald-600">Partner live</p> : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={busy === a.id}
                        className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]"
                        onClick={() => moveStage(a.id, a.status, -1)}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        disabled={busy === a.id}
                        className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]"
                        onClick={() => moveStage(a.id, a.status, 1)}
                      >
                        →
                      </button>
                    </div>
                    <input
                      placeholder="Assign user id"
                      value={assignDraft[a.id] ?? ""}
                      onChange={(e) => setAssignDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                      className="mt-2 w-full rounded border border-white/10 bg-black/20 px-1 py-0.5 text-[10px]"
                    />
                    <button
                      type="button"
                      className="mt-1 w-full rounded bg-indigo-500/80 py-0.5 text-[10px] text-white"
                      onClick={() => {
                        const v = assignDraft[a.id]?.trim();
                        if (v) void patchApp(a.id, { assignedToId: v });
                      }}
                    >
                      Save assignee
                    </button>
                    <textarea
                      placeholder="Note"
                      value={noteDraft[a.id] ?? ""}
                      onChange={(e) => setNoteDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                      className="mt-2 min-h-[48px] w-full rounded border border-white/10 bg-black/20 p-1 text-[10px]"
                    />
                    <button
                      type="button"
                      className="mt-1 w-full rounded bg-slate-600 py-0.5 text-[10px] text-white"
                      onClick={() => {
                        const n = noteDraft[a.id]?.trim();
                        if (n) void patchApp(a.id, { note: n }).then(() =>
                          setNoteDraft((d) => ({ ...d, [a.id]: "" })),
                        );
                      }}
                    >
                      Add note
                    </button>
                    <button
                      type="button"
                      disabled={busy === `mou-${a.id}`}
                      className="mt-2 w-full rounded bg-gradient-to-r from-amber-400 to-orange-500 py-1 text-[10px] font-bold text-black"
                      onClick={() => void activateMou(a.id)}
                    >
                      Execute MOU &amp; Activate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "offers" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <form className={card + " space-y-3"} onSubmit={(e) => void createOffer(e)}>
            <p className={h1 + " text-lg"}>Create offer</p>
            <input
              value={offerName}
              onChange={(e) => setOfferName(e.target.value)}
              placeholder="Offer name"
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            />
            <select
              value={offerType}
              onChange={(e) => setOfferType(e.target.value as "PERCENTAGE" | "FIXED")}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed (₹)</option>
            </select>
            <input
              type="number"
              value={offerValue}
              onChange={(e) => setOfferValue(Number(e.target.value))}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            />
            <label className={muted + " flex items-center gap-2"}>
              <input type="checkbox" checked={offerRecurring} onChange={(e) => setOfferRecurring(e.target.checked)} />
              Recurring (each renewal)
            </label>
            <button
              type="submit"
              disabled={busy === "offer" || !offerName.trim()}
              className="w-full rounded-lg bg-cyan-500 py-2 text-sm font-semibold text-black disabled:opacity-40"
            >
              Save offer
            </button>
          </form>
          <div className={card}>
            <p className={h1 + " text-lg"}>Existing plans</p>
            <ul className="mt-3 space-y-2 text-sm">
              {offers.map((o) => (
                <li key={o.id} className={muted}>
                  {o.name} — {o.type === "PERCENTAGE" ? `${o.value}%` : `₹${o.value}`}
                  {o.recurring ? " · recurring" : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "wallet" ? (
        <div className={card + " mt-8"}>
          <p className={h1 + " text-lg"}>Commission queue</p>
          <p className={muted + " mt-1"}>Select lines, then release to partner balance or mark paid out.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!selectedTx.size || busy === "release"}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
              onClick={() => void releaseSelected()}
            >
              Release to balance
            </button>
            <button
              type="button"
              disabled={!selectedTx.size || busy === "payout"}
              className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-40"
              onClick={() => void payoutSelected()}
            >
              Mark PAID OUT
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className={light ? "border-b border-slate-200 text-slate-500" : "border-b border-white/10 text-white/50"}>
                  <th className="py-2 pr-2" />
                  <th className="py-2 pr-2">Partner</th>
                  <th className="py-2 pr-2">Company</th>
                  <th className="py-2 pr-2">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className={light ? "border-b border-slate-100" : "border-b border-white/5"}>
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedTx.has(t.id)}
                        onChange={() =>
                          setSelectedTx((prev) => {
                            const n = new Set(prev);
                            if (n.has(t.id)) n.delete(t.id);
                            else n.add(t.id);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="py-2 pr-2">{t.partner.name}</td>
                    <td className="py-2 pr-2">{t.company.name}</td>
                    <td className="py-2 pr-2">₹{t.amount.toFixed(2)}</td>
                    <td className="py-2">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
