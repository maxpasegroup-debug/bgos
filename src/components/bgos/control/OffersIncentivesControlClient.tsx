"use client";

import {
  BonusConditionType,
  BonusValueType,
  IncentiveAudience,
  IncentiveCampaignLifecycle,
  IncentiveCommissionPlanTier,
  TargetAssignScope,
  TargetDurationPreset,
  TargetMetricType,
  TargetRoleCategory,
} from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";

type Tab = "overview" | "targets" | "bonuses" | "mega" | "commissions" | "announcements";

type IncentivesOverview = {
  activeTargetCampaigns: number;
  thisMonthBonusPool: number;
  megaPrizeCampaigns: number;
  commissionPlansCount: number;
};

export function OffersIncentivesControlClient() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const card = light
    ? "rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
    : "rounded-2xl border border-white/10 bg-[#0f141c] p-4 text-slate-100";
  const muted = light ? "text-slate-600" : "text-slate-400";
  const input = light
    ? "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
    : "mt-1 w-full rounded-xl border border-white/10 bg-[#121821] px-3 py-2 text-sm text-white";
  const btn =
    "rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-105 disabled:opacity-50";
  const tabBtn = (active: boolean) =>
    active
      ? "rounded-full bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-black"
      : light
        ? "rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        : "rounded-full px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5";

  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<IncentivesOverview | null>(null);

  const [targets, setTargets] = useState<unknown[]>([]);
  const [bonuses, setBonuses] = useState<unknown[]>([]);
  const [megas, setMegas] = useState<unknown[]>([]);
  const [commissions, setCommissions] = useState<unknown[]>([]);
  const [offers, setOffers] = useState<unknown[]>([]);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [t, b, m, c, o, ov] = await Promise.all([
        apiFetch("/api/bgos/control/targets", { credentials: "include" }),
        apiFetch("/api/bgos/control/bonuses", { credentials: "include" }),
        apiFetch("/api/bgos/control/mega-prizes", { credentials: "include" }),
        apiFetch("/api/bgos/control/commissions", { credentials: "include" }),
        apiFetch("/api/bgos/control/offers", { credentials: "include" }),
        apiFetch("/api/bgos/control/incentives/overview", { credentials: "include" }),
      ]);
      const [tj, bj, mj, cj, oj, ovj] = await Promise.all([
        readApiJson(t, "targets"),
        readApiJson(b, "bonuses"),
        readApiJson(m, "mega"),
        readApiJson(c, "commissions"),
        readApiJson(o, "offers"),
        readApiJson(ov, "overview"),
      ]);
      if (!t.ok || !(tj as { ok?: boolean }).ok) throw new Error((tj as { error?: string }).error || "targets");
      setTargets((tj as { items?: unknown[] }).items ?? []);
      setBonuses((bj as { items?: unknown[] }).items ?? []);
      setMegas((mj as { items?: unknown[] }).items ?? []);
      setCommissions((cj as { items?: unknown[] }).items ?? []);
      setOffers((oj as { items?: unknown[] }).items ?? []);
      if (ov.ok && (ovj as { ok?: boolean }).ok)
        setOverview((ovj as { overview?: IncentivesOverview }).overview ?? null);
    } catch (e) {
      setError(formatFetchFailure(e, "Could not load incentives data"));
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void loadAll(), 0);
    return () => window.clearTimeout(id);
  }, [loadAll]);

  return (
    <div className={BGOS_MAIN_PAD}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <h1 className={light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white"}>
            Offers & Incentives
          </h1>
          <p className={`mt-1 text-sm ${muted}`}>
            Targets, bonuses, mega prizes, commission rules, and announcements for sales and micro franchise.
          </p>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["overview", "Overview"],
              ["targets", "Targets"],
              ["bonuses", "Bonuses"],
              ["mega", "Mega Prizes"],
              ["commissions", "Commissions"],
              ["announcements", "Announcements"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={tabBtn(tab === k)} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          overview ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Active target campaigns", overview.activeTargetCampaigns],
                ["This month bonus pool (₹)", overview.thisMonthBonusPool.toFixed(0)],
                ["Mega prize campaigns (live)", overview.megaPrizeCampaigns],
                ["Commission plans", overview.commissionPlansCount],
              ].map(([label, val]) => (
                <div key={String(label)} className={card}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{label}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums">{val}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className={muted}>Loading overview…</p>
          )
        ) : null}

        {tab === "targets" ? (
          <TargetsPanel card={card} muted={muted} input={input} btn={btn} items={targets} onRefresh={loadAll} />
        ) : null}
        {tab === "bonuses" ? (
          <BonusesPanel card={card} muted={muted} input={input} btn={btn} items={bonuses} onRefresh={loadAll} />
        ) : null}
        {tab === "mega" ? (
          <MegaPanel card={card} muted={muted} input={input} btn={btn} items={megas} onRefresh={loadAll} />
        ) : null}
        {tab === "commissions" ? (
          <CommissionsPanel card={card} muted={muted} input={input} btn={btn} items={commissions} onRefresh={loadAll} />
        ) : null}
        {tab === "announcements" ? (
          <AnnouncementsPanel card={card} muted={muted} input={input} btn={btn} items={offers} onRefresh={loadAll} />
        ) : null}
      </div>
    </div>
  );
}

function TargetsPanel({
  card,
  muted,
  input,
  btn,
  items,
  onRefresh,
}: {
  card: string;
  muted: string;
  input: string;
  btn: string;
  items: unknown[];
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState("");
  const [targetNumber, setTargetNumber] = useState(10);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const start = new Date();
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const res = await apiFetch("/api/bgos/control/targets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Target",
          roleCategory: TargetRoleCategory.SALES_EXECUTIVE,
          durationPreset: TargetDurationPreset.MONTHLY,
          metricType: TargetMetricType.LEADS,
          targetNumber,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          assignScope: TargetAssignScope.ALL_SALES_USERS,
        }),
      });
      const j = ((await readApiJson(res, "targets post")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Create failed");
      setTitle("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className={`text-sm font-semibold ${muted}`}>Create target</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            Title
            <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="text-xs">
            Target number
            <input
              type="number"
              className={input}
              value={targetNumber}
              onChange={(e) => setTargetNumber(Number(e.target.value))}
            />
          </label>
        </div>
        <button type="button" className={`${btn} mt-3`} disabled={busy} onClick={() => void create()}>
          Save target
        </button>
      </div>
      <div className="space-y-2">
        {items.map((row) => {
          const r = row as { id: string; title: string; metricType: string; targetNumber: number };
          return (
            <div key={r.id} className={card}>
              <p className="font-semibold">{r.title}</p>
              <p className={`text-xs ${muted}`}>
                {r.metricType} · {r.targetNumber}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BonusesPanel({
  card,
  muted,
  input,
  btn,
  items,
  onRefresh,
}: {
  card: string;
  muted: string;
  input: string;
  btn: string;
  items: unknown[];
  onRefresh: () => void;
}) {
  const vm = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [title, setTitle] = useState("");
  const [poolAmount, setPoolAmount] = useState(0);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/bgos/control/bonuses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Bonus",
          eligibleAudience: IncentiveAudience.BOTH,
          conditionType: BonusConditionType.TARGET_ACHIEVED,
          bonusType: BonusValueType.FIXED,
          bonusValue: poolAmount,
          validMonth: vm,
          poolAmount,
        }),
      });
      const j = ((await readApiJson(res, "bonus post")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Create failed");
      setTitle("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className={`text-sm font-semibold ${muted}`}>New bonus campaign ({vm})</p>
        <label className="mt-2 block text-xs">
          Title
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="mt-2 block text-xs">
          Pool amount (₹)
          <input
            type="number"
            className={input}
            value={poolAmount}
            onChange={(e) => setPoolAmount(Number(e.target.value))}
          />
        </label>
        <button type="button" className={`${btn} mt-3`} disabled={busy} onClick={() => void create()}>
          Save bonus
        </button>
      </div>
      <div className="space-y-2">
        {items.map((row) => {
          const r = row as { id: string; title: string; validMonth: string; lifecycle: string };
          return (
            <div key={r.id} className={card}>
              <p className="font-semibold">{r.title}</p>
              <p className={`text-xs ${muted}`}>
                {r.validMonth} · {r.lifecycle}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MegaPanel({
  card,
  muted,
  input,
  btn,
  items,
  onRefresh,
}: {
  card: string;
  muted: string;
  input: string;
  btn: string;
  items: unknown[];
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const s = new Date();
      const e = new Date(s);
      e.setDate(e.getDate() + 30);
      const res = await apiFetch("/api/bgos/control/mega-prizes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Mega prize",
          audience: IncentiveAudience.BOTH,
          eligibilityRules: "Top performers by revenue and onboarding count.",
          prizeDescription: "Grand prize for the contest winner.",
          winnerRule: "Highest composite score at campaign end.",
          startDate: s.toISOString(),
          endDate: e.toISOString(),
          lifecycle: IncentiveCampaignLifecycle.ACTIVE,
        }),
      });
      const j = ((await readApiJson(res, "mega post")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Create failed");
      setName("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className={`text-sm font-semibold ${muted}`}>New mega prize</p>
        <label className="mt-2 block text-xs">
          Campaign name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="button" className={`${btn} mt-3`} disabled={busy} onClick={() => void create()}>
          Save campaign
        </button>
      </div>
      <div className="space-y-2">
        {items.map((row) => {
          const r = row as { id: string; name: string; audience: string };
          return (
            <div key={r.id} className={card}>
              <p className="font-semibold">{r.name}</p>
              <p className={`text-xs ${muted}`}>{r.audience}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CommissionsPanel({
  card,
  muted,
  input,
  btn,
  items,
  onRefresh,
}: {
  card: string;
  muted: string;
  input: string;
  btn: string;
  items: unknown[];
  onRefresh: () => void;
}) {
  const [planName, setPlanName] = useState("Pro plan");
  const [value, setValue] = useState(10);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/bgos/control/commissions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planName,
          planTier: IncentiveCommissionPlanTier.PRO,
          commissionType: "PERCENTAGE",
          value,
          recurring: true,
          instantSaleBonus: 0,
          isActive: true,
        }),
      });
      const j = ((await readApiJson(res, "comm post")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Create failed");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className={`text-sm font-semibold ${muted}`}>New commission rule</p>
        <label className="mt-2 block text-xs">
          Plan name
          <input className={input} value={planName} onChange={(e) => setPlanName(e.target.value)} />
        </label>
        <label className="mt-2 block text-xs">
          Value (%)
          <input type="number" className={input} value={value} onChange={(e) => setValue(Number(e.target.value))} />
        </label>
        <button type="button" className={`${btn} mt-3`} disabled={busy} onClick={() => void create()}>
          Save rule
        </button>
      </div>
      <div className="space-y-2">
        {items.map((row) => {
          const r = row as { id: string; planName: string; planTier: string; value: number; commissionType: string };
          return (
            <div key={r.id} className={card}>
              <p className="font-semibold">
                {r.planName} · {r.planTier}
              </p>
              <p className={`text-xs ${muted}`}>
                {r.commissionType} {r.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnnouncementsPanel({
  card,
  muted,
  input,
  btn,
  items,
  onRefresh,
}: {
  card: string;
  muted: string;
  input: string;
  btn: string;
  items: unknown[];
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/bgos/control/offers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Announcement",
          body: body.trim() || "Details coming soon.",
          audience: IncentiveAudience.BOTH,
        }),
      });
      const j = ((await readApiJson(res, "offer post")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error || "Create failed");
      setTitle("");
      setBody("");
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <p className={`text-sm font-semibold ${muted}`}>Publish announcement</p>
        <label className="mt-2 block text-xs">
          Title
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="mt-2 block text-xs">
          Message
          <textarea className={`${input} min-h-[88px]`} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <button type="button" className={`${btn} mt-3`} disabled={busy} onClick={() => void create()}>
          Publish
        </button>
      </div>
      <div className="space-y-2">
        {items.map((row) => {
          const r = row as { id: string; title: string; audience: string; body: string };
          return (
            <div key={r.id} className={card}>
              <p className="font-semibold">{r.title}</p>
              <p className={`text-xs ${muted}`}>{r.audience}</p>
              <p className="mt-2 text-sm opacity-90">{r.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
