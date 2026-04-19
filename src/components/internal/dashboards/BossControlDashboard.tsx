"use client";

import { useCallback, useEffect, useState } from "react";
import { NexaCompetitionMetric } from "@prisma/client";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { glassCard, subtleText, accent, btnPrimary } from "@/components/internal/internalUi";

type Metrics = {
  total_sales_inr: number;
  active_subscriptions: number;
  network_executives: number;
  tech_exec_count: number;
  rsm_count: number;
};

type ControlForm = {
  compTitle: string;
  compReward: string;
  compMetric: NexaCompetitionMetric;
  compTarget: number;
  compStart: string;
  compEnd: string;
  annTitle: string;
  annBody: string;
};

type Programs = {
  competitions: {
    id: string;
    title: string;
    reward: string;
    target_metric: NexaCompetitionMetric;
    target_value: number;
    start_date: string;
    end_date: string;
  }[];
  announcements: { id: string; title: string; message: string; created_at: string }[];
};

export function BossControlDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [programs, setPrograms] = useState<Programs | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<ControlForm>({
    compTitle: "",
    compReward: "",
    compMetric: NexaCompetitionMetric.POINTS,
    compTarget: 50,
    compStart: "",
    compEnd: "",
    annTitle: "",
    annBody: "",
  });
  const [saving, setSaving] = useState<"comp" | "ann" | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [mRes, pRes] = await Promise.all([
        apiFetch("/api/internal/boss-metrics", { credentials: "include" }),
        apiFetch("/api/internal/programs", { credentials: "include" }),
      ]);
      const mj = (await readApiJson(mRes, "boss-m")) as { ok?: boolean; metrics?: Metrics };
      if (mRes.ok && mj.ok && mj.metrics) setMetrics(mj.metrics);

      const pj = (await readApiJson(pRes, "boss-p")) as Programs & { ok?: boolean };
      if (pRes.ok && pj.ok) {
        setPrograms({ competitions: pj.competitions ?? [], announcements: pj.announcements ?? [] });
      }
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not load control plane"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCompetition() {
    setSaving("comp");
    try {
      const start = form.compStart ? new Date(form.compStart).toISOString() : new Date().toISOString();
      const end =
        form.compEnd ||
        new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16);
      const res = await apiFetch("/api/internal/programs/competitions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.compTitle || "Quarter sprint",
          reward: form.compReward || "Top performer prize",
          target_metric: form.compMetric,
          target_value: form.compTarget,
          start_date: start,
          end_date: new Date(end).toISOString(),
        }),
      });
      const j = (await readApiJson(res, "comp-create")) as { ok?: boolean };
      if (res.ok && j.ok) {
        setForm((f) => ({ ...f, compTitle: "", compReward: "" }));
        await load();
      }
    } finally {
      setSaving(null);
    }
  }

  async function broadcast() {
    setSaving("ann");
    try {
      const res = await apiFetch("/api/internal/programs/announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.annTitle || "Team update",
          message: form.annBody || "Stay aligned — Nexa will follow up with regional leads.",
        }),
      });
      const j = (await readApiJson(res, "ann-create")) as { ok?: boolean };
      if (res.ok && j.ok) {
        setForm((f) => ({ ...f, annTitle: "", annBody: "" }));
        await load();
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className={`${glassCard} p-6`}>
        <h1 className="text-2xl font-bold text-white">Internal boss control</h1>
        <p className={`${subtleText} mt-2 max-w-3xl`}>
          Global network metrics, program orchestration, and broadcast channels — scoped to the BGOS internal organisation.
        </p>
      </section>

      {err ? <p className="text-sm text-amber-300/90">{err}</p> : null}

      {metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { k: "Total sales (INR)", v: metrics.total_sales_inr.toLocaleString("en-IN") },
            { k: "Active subscriptions", v: String(metrics.active_subscriptions) },
            { k: "Network executives", v: String(metrics.network_executives) },
            { k: "Tech execs", v: String(metrics.tech_exec_count) },
            { k: "RSM seats", v: String(metrics.rsm_count) },
          ].map((x) => (
            <div key={x.k} className={`${glassCard} p-5`}>
              <p className={`${subtleText} text-xs uppercase tracking-widest`}>{x.k}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{x.v}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${glassCard} p-5`}>
          <h2 className="text-lg font-semibold text-white">Team control</h2>
          <p className={`${subtleText} mt-2 text-sm`}>
            Add RSM and Tech Exec seats through your HR pipeline — this surface links to the same internal org roster as{" "}
            <span className={accent}>/internal/team</span>.
          </p>
          <a href="/internal/team" className={`${btnPrimary} mt-4 inline-block`}>
            Open team roster
          </a>
        </div>

        <div className={`${glassCard} p-5`}>
          <h2 className="text-lg font-semibold text-white">Nexa CEO signals</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/85">
            <li>Watch subscription velocity alongside tech queue health.</li>
            <li>Weak regions surface automatically in the RSM workspace.</li>
            <li>Use announcements to align incentives before month-end.</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${glassCard} p-5`}>
          <h2 className="text-lg font-semibold text-white">Create competition</h2>
          <div className="mt-4 grid gap-3">
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              placeholder="Title"
              value={form.compTitle}
              onChange={(e) => setForm((f) => ({ ...f, compTitle: e.target.value }))}
            />
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              placeholder="Reward"
              value={form.compReward}
              onChange={(e) => setForm((f) => ({ ...f, compReward: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={form.compTarget}
                onChange={(e) => setForm((f) => ({ ...f, compTarget: Number(e.target.value) }))}
              />
              <select
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={form.compMetric}
                onChange={(e) => setForm((f) => ({ ...f, compMetric: e.target.value as NexaCompetitionMetric }))}
              >
                {Object.values(NexaCompetitionMetric).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={form.compStart}
                onChange={(e) => setForm((f) => ({ ...f, compStart: e.target.value }))}
              />
              <input
                type="datetime-local"
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                value={form.compEnd}
                onChange={(e) => setForm((f) => ({ ...f, compEnd: e.target.value }))}
              />
            </div>
            <button type="button" className={btnPrimary} disabled={saving === "comp"} onClick={() => void createCompetition()}>
              {saving === "comp" ? "Saving…" : "Activate competition"}
            </button>
          </div>
        </div>

        <div className={`${glassCard} p-5`}>
          <h2 className="text-lg font-semibold text-white">Broadcast announcement</h2>
          <div className="mt-4 grid gap-3">
            <input
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              placeholder="Title"
              value={form.annTitle}
              onChange={(e) => setForm((f) => ({ ...f, annTitle: e.target.value }))}
            />
            <textarea
              className="min-h-[120px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              placeholder="Message"
              value={form.annBody}
              onChange={(e) => setForm((f) => ({ ...f, annBody: e.target.value }))}
            />
            <button type="button" className={btnPrimary} disabled={saving === "ann"} onClick={() => void broadcast()}>
              {saving === "ann" ? "Sending…" : "Broadcast"}
            </button>
          </div>
        </div>
      </div>

      {programs ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={`${glassCard} p-5`}>
            <h3 className="text-md font-semibold text-white">Active competitions</h3>
            <ul className="mt-3 space-y-3 text-sm">
              {programs.competitions.map((c) => (
                <li key={c.id} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                  <p className="font-medium text-white">{c.title}</p>
                  <p className={`${subtleText} text-xs`}>Reward: {c.reward}</p>
                  <p className="text-xs text-white/70">
                    Target {c.target_metric}: {c.target_value}
                  </p>
                </li>
              ))}
              {programs.competitions.length === 0 ? <p className={`${subtleText}`}>No active competitions.</p> : null}
            </ul>
          </div>
          <div className={`${glassCard} p-5`}>
            <h3 className="text-md font-semibold text-white">Recent announcements</h3>
            <ul className="mt-3 space-y-3 text-sm">
              {programs.announcements.map((a) => (
                <li key={a.id} className="rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                  <p className="font-medium text-white">{a.title}</p>
                  <p className={`${subtleText} mt-1 line-clamp-3`}>{a.message}</p>
                  <p className="mt-1 text-[11px] text-white/45">{new Date(a.created_at).toLocaleString()}</p>
                </li>
              ))}
              {programs.announcements.length === 0 ? <p className={`${subtleText}`}>No announcements yet.</p> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
