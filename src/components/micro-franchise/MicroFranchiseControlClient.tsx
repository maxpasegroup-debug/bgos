"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { PRICING } from "@/config/pricing";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";

type Tab = "pipeline" | "live" | "offers" | "wallet" | "leaderboard" | "map" | "insights";
type ViewMode = "grid" | "list";

type Application = {
  id: string;
  businessName: string;
  name: string;
  phone: string;
  email: string | null;
  location: string | null;
  country: string;
  state: string;
  category: "SOLAR" | "MULTI_BUSINESS" | "CUSTOM" | string;
  status: "APPLICATION" | "REVIEW" | "TRAINING" | "MOU" | "APPROVED" | "REJECTED" | string;
  hasPartner: boolean;
  createdAt: string;
  notes?: unknown;
};

type LivePartner = {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  location: string;
  activeClients: number;
  monthlyRevenue: number;
  earnings: number;
  pending: number;
  paid: number;
  tier?: string;
  score?: number;
};

type LeaderboardItem = {
  id: string;
  name: string;
  phone: string;
  tier: string;
  score: number;
  revenue: number;
  activeClients: number;
  growth: number;
};

type MapItem = {
  state: string;
  applications: number;
  live: number;
  revenue: number;
  clients: number;
};

type InsightForecast = {
  partnerId: string;
  name: string;
  tier: string;
  forecastNext30: number;
  growth: number;
};

type InsightAlert = {
  id: string;
  partnerId: string;
  partnerName: string;
  type: string;
  severity: string;
  title: string;
  message: string;
};

type InsightSuggestion = {
  partnerId: string;
  partnerName: string;
  rule: string;
  message: string;
};

type ExecutivePerf = {
  userId: string;
  name: string | null;
  email: string | null;
  assigned: number;
  live: number;
  conversion: number;
};

type ReferralItem = {
  id: string;
  name: string;
  referralId: string;
  deepLink: string;
  conversions: number;
  commission: number;
};

type Offer = {
  id: string;
  name: string;
  type: "PERCENTAGE" | "FIXED" | string;
  value: number;
  recurring: boolean;
  instantBonus: number | null;
};

type WalletTx = {
  id: string;
  amount: number;
  type: string;
  status: string;
  createdAt: string;
  partner: { id: string; name: string; phone: string };
  company: { id: string; name: string };
};

type PartnerDetail = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  referralId: string;
  tier?: string;
  score?: number;
  wallet: { earnings?: number; balance?: number; pending?: number; totalEarned?: number } | null;
  plan: { name?: string; type?: string; value?: number; recurring?: boolean; instantBonus?: number | null } | null;
  performance: { totalReferrals: number; activeCompanies: number; revenueGenerated: number };
};

const STAGES: Array<{ key: Application["status"]; label: string }> = [
  { key: "APPLICATION", label: "New Applications" },
  { key: "REVIEW", label: "Reviewed" },
  { key: "TRAINING", label: "Training" },
  { key: "MOU", label: "MOU" },
  { key: "APPROVED", label: "Live" },
  { key: "REJECTED", label: "Rejected" },
];

const CATEGORY_LABEL: Record<string, string> = {
  SOLAR: "Solar",
  MULTI_BUSINESS: "Multi Business",
  CUSTOM: "Custom",
};

export function MicroFranchiseControlClient() {
  const { theme } = useBgosTheme();
  const light = theme === "light";

  const [tab, setTab] = useState<Tab>("pipeline");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [apps, setApps] = useState<Application[]>([]);
  const [live, setLive] = useState<LivePartner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [wallet, setWallet] = useState<WalletTx[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [mapItems, setMapItems] = useState<MapItem[]>([]);
  const [forecasts, setForecasts] = useState<InsightForecast[]>([]);
  const [alerts, setAlerts] = useState<InsightAlert[]>([]);
  const [suggestions, setSuggestions] = useState<InsightSuggestion[]>([]);
  const [executivePerf, setExecutivePerf] = useState<ExecutivePerf[]>([]);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [partnerDetail, setPartnerDetail] = useState<PartnerDetail | null>(null);

  const [filterCountry, setFilterCountry] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");

  const [offerName, setOfferName] = useState("");
  const [offerProduct, setOfferProduct] = useState<"7000" | "12000" | "ENTERPRISE">("7000");
  const [offerType, setOfferType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [offerValue, setOfferValue] = useState(10);
  const [offerRecurring, setOfferRecurring] = useState(true);
  const [offerBonus, setOfferBonus] = useState(0);

  const card = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/85 p-4";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";
  const heading = light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white";

  const selectedApp = useMemo(
    () => apps.find((a) => a.id === selectedAppId) ?? null,
    [apps, selectedAppId],
  );

  const countries = useMemo(
    () => [...new Set(apps.map((a) => a.country).filter(Boolean))].sort(),
    [apps],
  );
  const states = useMemo(
    () => [...new Set(apps.map((a) => a.state).filter(Boolean))].sort(),
    [apps],
  );

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (filterCountry && a.country !== filterCountry) return false;
      if (filterState && a.state !== filterState) return false;
      if (filterCategory && a.category !== filterCategory) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (!q) return true;
      return [a.businessName, a.name, a.phone].some((x) => x.toLowerCase().includes(q));
    });
  }, [apps, filterCountry, filterState, filterCategory, filterStatus, search]);

  const appsByStage = useMemo(() => {
    const map = new Map<string, Application[]>();
    for (const s of STAGES) map.set(s.key, []);
    for (const a of filteredApps) {
      const list = map.get(a.status) || map.get("APPLICATION");
      list?.push(a);
    }
    return map;
  }, [filteredApps]);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [aRes, lRes, oRes, wRes, lbRes, mapRes, iRes, rRes] = await Promise.all([
        apiFetch("/api/micro-franchise/applications", { credentials: "include" }),
        apiFetch("/api/micro-franchise/live", { credentials: "include" }),
        apiFetch("/api/micro-franchise/offers", { credentials: "include" }),
        apiFetch("/api/micro-franchise/wallet", { credentials: "include" }),
        apiFetch("/api/micro-franchise/leaderboard", { credentials: "include" }),
        apiFetch("/api/micro-franchise/map", { credentials: "include" }),
        apiFetch("/api/micro-franchise/insights", { credentials: "include" }),
        apiFetch("/api/micro-franchise/referrals", { credentials: "include" }),
      ]);

      const aj = ((await readApiJson(aRes, "mf/apps")) ?? {}) as { ok?: boolean; applications?: Application[]; error?: string };
      if (!aRes.ok || aj.ok !== true) throw new Error(aj.error || "Could not load applications");
      setApps(Array.isArray(aj.applications) ? aj.applications : []);

      const lj = ((await readApiJson(lRes, "mf/live")) ?? {}) as { ok?: boolean; partners?: LivePartner[]; error?: string };
      if (!lRes.ok || lj.ok !== true) throw new Error(lj.error || "Could not load live franchises");
      setLive(Array.isArray(lj.partners) ? lj.partners : []);

      const oj = ((await readApiJson(oRes, "mf/offers")) ?? {}) as { ok?: boolean; offers?: Offer[]; error?: string };
      if (!oRes.ok || oj.ok !== true) throw new Error(oj.error || "Could not load offers");
      setOffers(Array.isArray(oj.offers) ? oj.offers : []);

      const wj = ((await readApiJson(wRes, "mf/wallet")) ?? {}) as { ok?: boolean; transactions?: WalletTx[]; error?: string };
      if (!wRes.ok || wj.ok !== true) throw new Error(wj.error || "Could not load wallet queue");
      setWallet(Array.isArray(wj.transactions) ? wj.transactions : []);

      const lbj = ((await readApiJson(lbRes, "mf/leaderboard")) ?? {}) as {
        ok?: boolean;
        items?: LeaderboardItem[];
        error?: string;
      };
      if (!lbRes.ok || lbj.ok !== true) throw new Error(lbj.error || "Could not load leaderboard");
      setLeaderboard(Array.isArray(lbj.items) ? lbj.items : []);

      const mj = ((await readApiJson(mapRes, "mf/map")) ?? {}) as { ok?: boolean; items?: MapItem[]; error?: string };
      if (!mapRes.ok || mj.ok !== true) throw new Error(mj.error || "Could not load map analytics");
      setMapItems(Array.isArray(mj.items) ? mj.items : []);

      const ij = ((await readApiJson(iRes, "mf/insights")) ?? {}) as {
        ok?: boolean;
        forecasts?: InsightForecast[];
        alerts?: InsightAlert[];
        suggestions?: InsightSuggestion[];
        executivePerformance?: ExecutivePerf[];
        error?: string;
      };
      if (!iRes.ok || ij.ok !== true) throw new Error(ij.error || "Could not load insights");
      setForecasts(Array.isArray(ij.forecasts) ? ij.forecasts : []);
      setAlerts(Array.isArray(ij.alerts) ? ij.alerts : []);
      setSuggestions(Array.isArray(ij.suggestions) ? ij.suggestions : []);
      setExecutivePerf(Array.isArray(ij.executivePerformance) ? ij.executivePerformance : []);

      const rj = ((await readApiJson(rRes, "mf/referrals")) ?? {}) as { ok?: boolean; items?: ReferralItem[]; error?: string };
      if (!rRes.ok || rj.ok !== true) throw new Error(rj.error || "Could not load referral links");
      setReferrals(Array.isArray(rj.items) ? rj.items : []);
    } catch (e) {
      setError(formatFetchFailure(e, "Could not load micro franchise ecosystem"));
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(id);
  }, [loadAll]);

  const loadPartnerDetail = useCallback(async (partnerId: string) => {
    try {
      const res = await apiFetch(`/api/micro-franchise/partner/${partnerId}`, { credentials: "include" });
      const j = ((await readApiJson(res, "mf/partner-detail")) ?? {}) as { ok?: boolean; partner?: PartnerDetail; error?: string };
      if (!res.ok || j.ok !== true || !j.partner) throw new Error(j.error || "Could not load partner detail");
      setPartnerDetail(j.partner);
    } catch (e) {
      setError(formatFetchFailure(e, "Could not load partner detail"));
    }
  }, []);

  async function patchStatus(id: string, status: Application["status"]) {
    setBusy(`status-${id}`);
    try {
      const res = await apiFetch("/api/micro-franchise/status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const j = ((await readApiJson(res, "mf/status")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Update failed");
      await loadAll();
    } catch (e) {
      setError(formatFetchFailure(e, "Status update failed"));
    } finally {
      setBusy(null);
    }
  }

  async function activateBypass(id: string) {
    setBusy(`activate-${id}`);
    try {
      const res = await apiFetch(`/api/bgos/control/micro-franchise/applications/${id}/activate-mou`, {
        method: "POST",
        credentials: "include",
      });
      const j = ((await readApiJson(res, "mf/activate")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Activation failed");
      await loadAll();
    } catch (e) {
      setError(formatFetchFailure(e, "Activation failed"));
    } finally {
      setBusy(null);
    }
  }

  async function createOffer(e: React.FormEvent) {
    e.preventDefault();
    setBusy("offer");
    try {
      const res = await apiFetch("/api/micro-franchise/offers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: offerName,
          product: offerProduct,
          type: offerType,
          value: offerValue,
          recurring: offerRecurring,
          instantBonus: offerBonus,
        }),
      });
      const j = ((await readApiJson(res, "mf/offers-create")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Could not create offer");
      setOfferName("");
      await loadAll();
    } catch (e) {
      setError(formatFetchFailure(e, "Could not create offer"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`mx-auto max-w-7xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className={heading}>Micro Franchise Ecosystem</h1>
          <p className={muted + " mt-1"}>Applications, onboarding, commissions, and partner management</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            ["pipeline", "Pipeline"],
            ["live", "Live Franchises"],
            ["offers", "Offers"],
            ["wallet", "Wallet Queue"],
            ["leaderboard", "Leaderboard"],
            ["map", "Map"],
            ["insights", "Insights"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-black"
                  : light
                    ? "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                    : "rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-amber-500">{error}</p> : null}

      {tab === "pipeline" ? (
        <>
          <div className={card + " mb-4 grid gap-3 md:grid-cols-6"}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / phone / business" className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <select value={filterCountry} onChange={(e) => setFilterCountry(e.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <option value="">All countries</option>
              {countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <option value="">All states</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <option value="">All categories</option>
              <option value="SOLAR">Solar</option>
              <option value="MULTI_BUSINESS">Multi Business</option>
              <option value="CUSTOM">Custom</option>
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <option value="">All status</option>
              {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <div className="flex items-center gap-2 text-xs">
              <button type="button" onClick={() => setViewMode("grid")} className={viewMode === "grid" ? "rounded bg-cyan-500 px-2 py-1 font-semibold text-black" : "rounded border border-white/15 px-2 py-1"}>Grid</button>
              <button type="button" onClick={() => setViewMode("list")} className={viewMode === "list" ? "rounded bg-cyan-500 px-2 py-1 font-semibold text-black" : "rounded border border-white/15 px-2 py-1"}>List</button>
            </div>
          </div>

          {viewMode === "grid" ? (
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[1200px] grid-cols-6 gap-4">
                {STAGES.map((stage) => (
                  <section key={stage.key} className={card}>
                    <p className={light ? "text-xs font-bold uppercase text-slate-500" : "text-xs font-bold uppercase text-white/55"}>{stage.label}</p>
                    <div className="mt-3 space-y-2">
                      {(appsByStage.get(stage.key) ?? []).map((a) => (
                        <button key={a.id} type="button" className={light ? "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs" : "w-full rounded-xl border border-white/10 bg-black/25 p-3 text-left text-xs text-white/90"} onClick={() => { setSelectedAppId(a.id); setSelectedPartnerId(null); }}>
                          <p className="font-semibold">{a.businessName}</p>
                          <p>{a.name}</p>
                          <p className="opacity-80">{a.phone}</p>
                          <p className="mt-1">{a.state || "-"}, {a.country || "-"}</p>
                          <p className="mt-1 rounded bg-white/10 px-1.5 py-0.5 inline-block">{CATEGORY_LABEL[a.category] || a.category}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="rounded border border-white/15 px-1.5 py-0.5">View</span>
                            <span className="rounded border border-white/15 px-1.5 py-0.5">Move</span>
                            <span className="rounded border border-white/15 px-1.5 py-0.5">Approve</span>
                          </div>
                        </button>
                      ))}
                      {(appsByStage.get(stage.key) ?? []).length === 0 ? <p className={muted + " text-xs"}>No applications</p> : null}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : (
            <div className={card + " overflow-x-auto"}>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className={light ? "border-b border-slate-200 text-slate-500" : "border-b border-white/10 text-white/50"}>
                    <th className="py-2 pr-3">Business</th><th className="py-2 pr-3">Owner</th><th className="py-2 pr-3">Phone</th><th className="py-2 pr-3">Location</th><th className="py-2 pr-3">Category</th><th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((a) => (
                    <tr key={a.id} onClick={() => { setSelectedAppId(a.id); setSelectedPartnerId(null); }} className={light ? "cursor-pointer border-b border-slate-100" : "cursor-pointer border-b border-white/5"}>
                      <td className="py-2 pr-3">{a.businessName}</td><td className="py-2 pr-3">{a.name}</td><td className="py-2 pr-3">{a.phone}</td><td className="py-2 pr-3">{a.state || "-"}, {a.country || "-"}</td><td className="py-2 pr-3">{CATEGORY_LABEL[a.category] || a.category}</td><td className="py-2">{a.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}

      {tab === "live" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {live.length === 0 ? <div className={card + " md:col-span-2 xl:col-span-3"}><p className="font-semibold">No live franchises yet</p></div> : null}
          {live.map((p) => (
            <button key={p.id} type="button" onClick={() => { setSelectedPartnerId(p.id); setSelectedAppId(null); void loadPartnerDetail(p.id); }} className={card + " text-left"}>
              <p className="font-semibold">{p.businessName}</p>
              <p className={muted + " mt-1"}>{p.ownerName}</p>
              <p className={muted}>Earnings: {p.earnings.toFixed(2)}</p>
              <p className={muted}>Active clients: {p.activeClients}</p>
              <p className={muted}>Monthly revenue: {p.monthlyRevenue.toFixed(2)}</p>
            </button>
          ))}
        </div>
      ) : null}

      {tab === "offers" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form className={card + " space-y-3"} onSubmit={(e) => void createOffer(e)}>
            <p className="text-lg font-semibold">Create commission plan</p>
            <input value={offerName} onChange={(e) => setOfferName(e.target.value)} placeholder="Plan name" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <select value={offerProduct} onChange={(e) => setOfferProduct(e.target.value as "7000" | "12000" | "ENTERPRISE")} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <option value="7000">{PRICING.BASIC.price}</option><option value="12000">{PRICING.PRO.price}</option><option value="ENTERPRISE">Enterprise</option>
            </select>
            <select value={offerType} onChange={(e) => setOfferType(e.target.value as "PERCENTAGE" | "FIXED")} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed</option>
            </select>
            <input type="number" value={offerValue} onChange={(e) => setOfferValue(Number(e.target.value))} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <label className={muted + " flex items-center gap-2"}><input type="checkbox" checked={offerRecurring} onChange={(e) => setOfferRecurring(e.target.checked)} /> Recurring</label>
            <input type="number" value={offerBonus} onChange={(e) => setOfferBonus(Number(e.target.value))} placeholder="Instant bonus" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy === "offer" || !offerName.trim()} className="w-full rounded-lg bg-cyan-500 py-2 text-sm font-semibold text-black disabled:opacity-40">Save plan</button>
          </form>
          <div className={card}>
            <p className="text-lg font-semibold">Offers</p>
            <ul className="mt-3 space-y-2 text-sm">
              {offers.map((o) => (
                <li key={o.id} className={muted}>{o.name} · {o.type === "PERCENTAGE" ? `${o.value}%` : o.value.toFixed(2)} · {o.recurring ? "Recurring" : "One-time"} · Bonus: {(o.instantBonus ?? 0).toFixed(2)}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "wallet" ? (
        <div className={card + " overflow-x-auto"}>
          <p className="text-lg font-semibold">Wallet Queue</p>
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className={light ? "border-b border-slate-200 text-slate-500" : "border-b border-white/10 text-white/50"}>
                <th className="py-2 pr-3">Franchise</th><th className="py-2 pr-3">Company</th><th className="py-2 pr-3">Amount</th><th className="py-2 pr-3">Status</th><th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {wallet.map((t) => (
                <tr key={t.id} className={light ? "border-b border-slate-100" : "border-b border-white/5"}>
                  <td className="py-2 pr-3">{t.partner.name}</td><td className="py-2 pr-3">{t.company.name}</td><td className="py-2 pr-3">{t.amount.toFixed(2)}</td><td className="py-2 pr-3">{t.status}</td><td className="py-2"><span className="mr-2 rounded border border-white/15 px-2 py-1 text-xs">Approve</span><span className="rounded border border-white/15 px-2 py-1 text-xs">Reject</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "leaderboard" ? (
        <div className={card + " overflow-x-auto"}>
          <p className="text-lg font-semibold">Top Franchises</p>
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className={light ? "border-b border-slate-200 text-slate-500" : "border-b border-white/10 text-white/50"}>
                <th className="py-2 pr-3">Franchise</th><th className="py-2 pr-3">Tier</th><th className="py-2 pr-3">Score</th><th className="py-2 pr-3">Revenue</th><th className="py-2 pr-3">Clients</th><th className="py-2">Growth</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((l) => (
                <tr key={l.id} className={light ? "border-b border-slate-100" : "border-b border-white/5"}>
                  <td className="py-2 pr-3">{l.name}</td>
                  <td className="py-2 pr-3"><span className="rounded-full border border-white/20 px-2 py-0.5 text-xs">{l.tier}</span></td>
                  <td className="py-2 pr-3 font-semibold">{l.score}</td>
                  <td className="py-2 pr-3">{l.revenue.toFixed(2)}</td>
                  <td className="py-2 pr-3">{l.activeClients}</td>
                  <td className={"py-2 " + (l.growth >= 0 ? "text-emerald-400" : "text-rose-400")}>{l.growth.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "map" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className={card}>
            <p className="text-lg font-semibold">Regional Performance</p>
            <div className="mt-4 space-y-3">
              {mapItems.slice(0, 10).map((m) => {
                const maxRevenue = Math.max(1, ...mapItems.map((x) => x.revenue));
                const width = `${Math.max(8, (m.revenue / maxRevenue) * 100)}%`;
                return (
                  <div key={m.state}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span>{m.state}</span>
                      <span className="opacity-80">{m.revenue.toFixed(0)}</span>
                    </div>
                    <div className="h-2 rounded bg-white/10">
                      <div className="h-2 rounded bg-cyan-400" style={{ width }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={card + " overflow-x-auto"}>
            <p className="text-lg font-semibold">State-wise Breakdown</p>
            <table className="mt-3 min-w-full text-left text-sm">
              <thead>
                <tr className={light ? "border-b border-slate-200 text-slate-500" : "border-b border-white/10 text-white/50"}>
                  <th className="py-2 pr-3">State</th><th className="py-2 pr-3">Applications</th><th className="py-2 pr-3">Live</th><th className="py-2 pr-3">Clients</th><th className="py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {mapItems.map((m) => (
                  <tr key={m.state} className={light ? "border-b border-slate-100" : "border-b border-white/5"}>
                    <td className="py-2 pr-3">{m.state}</td><td className="py-2 pr-3">{m.applications}</td><td className="py-2 pr-3">{m.live}</td><td className="py-2 pr-3">{m.clients}</td><td className="py-2">{m.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "insights" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className={card + " xl:col-span-2"}>
            <p className="text-lg font-semibold">Earnings Forecast (Next 30 Days)</p>
            <ul className="mt-3 space-y-2 text-sm">
              {forecasts.map((f) => (
                <li key={f.partnerId} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <div className="flex items-center justify-between"><span>{f.name} <span className="opacity-70">({f.tier})</span></span><span className="font-semibold">{f.forecastNext30.toFixed(2)}</span></div>
                  <p className={f.growth >= 0 ? "text-xs text-emerald-400" : "text-xs text-rose-400"}>Growth: {f.growth.toFixed(1)}%</p>
                </li>
              ))}
            </ul>
          </div>
          <div className={card}>
            <p className="text-lg font-semibold">Smart Alerts</p>
            <ul className="mt-3 space-y-2 text-sm">
              {alerts.slice(0, 8).map((a) => (
                <li key={a.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-xs opacity-80">{a.partnerName} · {a.type} · {a.severity}</p>
                  <p className="text-xs opacity-80">{a.message}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className={card}>
            <p className="text-lg font-semibold">Nexa Suggestions</p>
            <ul className="mt-3 space-y-2 text-sm">
              {suggestions.map((s) => (
                <li key={`${s.partnerId}-${s.rule}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="font-semibold">{s.partnerName}</p>
                  <p className="text-xs text-cyan-300">{s.rule}</p>
                  <p className="text-xs opacity-80">{s.message}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className={card + " xl:col-span-2 overflow-x-auto"}>
            <p className="text-lg font-semibold">Executive Performance Tracking</p>
            <table className="mt-3 min-w-full text-left text-sm">
              <thead>
                <tr className={light ? "border-b border-slate-200 text-slate-500" : "border-b border-white/10 text-white/50"}>
                  <th className="py-2 pr-3">Executive</th><th className="py-2 pr-3">Assigned</th><th className="py-2 pr-3">Live</th><th className="py-2">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {executivePerf.map((e) => (
                  <tr key={e.userId} className={light ? "border-b border-slate-100" : "border-b border-white/5"}>
                    <td className="py-2 pr-3">{e.name || e.email || "Executive"}</td><td className="py-2 pr-3">{e.assigned}</td><td className="py-2 pr-3">{e.live}</td><td className="py-2">{e.conversion.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={card}>
            <p className="text-lg font-semibold">Referral Deep Links</p>
            <ul className="mt-3 space-y-2 text-xs">
              {referrals.slice(0, 8).map((r) => (
                <li key={r.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="font-semibold">{r.name}</p>
                  <p className="opacity-80">Ref ID: {r.referralId} · Conversions: {r.conversions}</p>
                  <p className="truncate opacity-70">{r.deepLink}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {(selectedApp || selectedPartnerId) ? (
        <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-white/10 bg-[#0f141e] p-5 text-sm text-white/90 shadow-2xl">
          <button type="button" onClick={() => { setSelectedAppId(null); setSelectedPartnerId(null); setPartnerDetail(null); }} className="mb-3 rounded border border-white/15 px-2 py-1 text-xs">Close</button>

          {selectedApp ? (
            <div className="space-y-5">
              <section>
                <p className="text-xs uppercase text-white/60">Overview</p>
                <h3 className="mt-1 text-lg font-semibold">{selectedApp.businessName}</h3>
                <p>{selectedApp.name} · {selectedApp.phone}</p>
                <p className="text-white/65">{selectedApp.state || "-"}, {selectedApp.country || "-"}</p>
                <p className="mt-1 rounded bg-white/10 px-2 py-1 inline-block">{selectedApp.status}</p>
              </section>
              <section>
                <p className="text-xs uppercase text-white/60">Progress Control</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STAGES.map((s) => (
                    <button key={s.key} type="button" disabled={busy === `status-${selectedApp.id}` || selectedApp.status === s.key} onClick={() => void patchStatus(selectedApp.id, s.key)} className="rounded border border-white/20 px-2 py-1 text-xs disabled:opacity-40">{s.label}</button>
                  ))}
                </div>
              </section>
              <section>
                <p className="text-xs uppercase text-white/60">Actions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void activateBypass(selectedApp.id)} className="rounded bg-amber-400 px-3 py-1 text-xs font-semibold text-black">Activate (bypass stages)</button>
                  <button type="button" onClick={() => void patchStatus(selectedApp.id, "REJECTED")} className="rounded border border-white/20 px-3 py-1 text-xs">Suspend</button>
                  <button type="button" onClick={() => void patchStatus(selectedApp.id, "REJECTED")} className="rounded border border-rose-400/50 px-3 py-1 text-xs text-rose-200">Delete</button>
                </div>
              </section>
            </div>
          ) : null}

          {selectedPartnerId ? (
            <div className="space-y-5">
              <section>
                <p className="text-xs uppercase text-white/60">Overview</p>
                <h3 className="mt-1 text-lg font-semibold">{partnerDetail?.name || "Franchise"}</h3>
                <p>{partnerDetail?.phone}</p>
                <p className="text-white/65">Tier: {partnerDetail?.tier || "BRONZE"} · Score: {partnerDetail?.score ?? 0}</p>
              </section>
              <section>
                <p className="text-xs uppercase text-white/60">Commission Settings</p>
                <p className="mt-1">{partnerDetail?.plan?.name || "No plan assigned"}</p>
                <p className="text-white/65">{partnerDetail?.plan?.type} {partnerDetail?.plan?.value ?? 0} · recurring: {partnerDetail?.plan?.recurring ? "yes" : "no"}</p>
              </section>
              <section>
                <p className="text-xs uppercase text-white/60">Performance</p>
                <p>Total referrals: {partnerDetail?.performance.totalReferrals ?? 0}</p>
                <p>Active companies: {partnerDetail?.performance.activeCompanies ?? 0}</p>
                <p>Revenue generated: {(partnerDetail?.performance.revenueGenerated ?? 0).toFixed(2)}</p>
              </section>
              <section>
                <p className="text-xs uppercase text-white/60">Wallet</p>
                <p>Earnings: {(partnerDetail?.wallet?.totalEarned ?? 0).toFixed(2)}</p>
                <p>Pending: {(partnerDetail?.wallet?.pending ?? 0).toFixed(2)}</p>
                <p>Paid: {(partnerDetail?.wallet?.balance ?? 0).toFixed(2)}</p>
              </section>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

