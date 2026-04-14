"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { IceconnectCustomerPlan, UserRole } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { CUSTOMER_PLAN_LABEL } from "@/lib/iceconnect-sales-hub";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  target: {
    targetCount: number;
    targetPlan: IceconnectCustomerPlan;
    salaryRupees: number;
  } | null;
};

type TeamJson = {
  ok?: boolean;
  period?: { year: number; month: number };
  members?: Member[];
  error?: string;
};

export function IceconnectManagerTargetsPanel() {
  const [data, setData] = useState<TeamJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [counts, setCounts] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<Record<string, IceconnectCustomerPlan>>({});
  const [salaries, setSalaries] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/executive/team", { credentials: "include" });
      const j = (await res.json()) as TeamJson;
      if (res.status === 403 || res.status === 401) {
        setData(null);
        return;
      }
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load team");
        return;
      }
      setData(j);
      const nc: Record<string, string> = {};
      const np: Record<string, IceconnectCustomerPlan> = {};
      const ns: Record<string, string> = {};
      for (const m of j.members ?? []) {
        nc[m.userId] = String(m.target?.targetCount ?? 10);
        np[m.userId] = m.target?.targetPlan ?? IceconnectCustomerPlan.PRO;
        ns[m.userId] = String(m.target?.salaryRupees ?? 30000);
      }
      setCounts(nc);
      setPlans(np);
      setSalaries(ns);
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(userId: string) {
    if (!data?.period) return;
    const targetCount = Math.max(0, parseInt(counts[userId] ?? "0", 10) || 0);
    const salaryRupees = Math.max(0, parseInt(salaries[userId] ?? "0", 10) || 0);
    setSaving(userId);
    setErr(null);
    try {
      const res = await apiFetch("/api/iceconnect/executive/target", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          periodYear: data.period.year,
          periodMonth: data.period.month,
          targetCount,
          targetPlan: plans[userId] ?? IceconnectCustomerPlan.PRO,
          salaryRupees,
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Save failed");
        return;
      }
      await load();
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setSaving(null);
    }
  }

  if (err && !data) return null;
  if (!data?.members?.length) return null;

  return (
    <section className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-6">
      <h2 className="text-lg font-bold text-gray-900">Manager — targets & salary</h2>
      <p className="mt-1 text-sm text-gray-600">
        Set monthly target count, plan type, and salary for each executive. Achieved counts use leads at{" "}
        <strong>Subscription</strong> with matching plan.
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Period: {data.period?.month}/{data.period?.year}
      </p>
      {err ? <p className="mt-2 text-sm text-red-600">{err}</p> : null}
      <ul className="mt-4 space-y-4">
        {data.members.map((m) => (
          <li key={m.userId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-gray-900">{m.name}</p>
            <p className="text-xs text-gray-500">{m.email}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div>
                <label className="text-[10px] font-semibold uppercase text-gray-500">Target #</label>
                <input
                  value={counts[m.userId] ?? ""}
                  onChange={(e) => setCounts((s) => ({ ...s, [m.userId]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-gray-500">Plan type</label>
                <select
                  value={plans[m.userId] ?? IceconnectCustomerPlan.PRO}
                  onChange={(e) =>
                    setPlans((s) => ({ ...s, [m.userId]: e.target.value as IceconnectCustomerPlan }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                >
                  {(Object.keys(CUSTOMER_PLAN_LABEL) as IceconnectCustomerPlan[]).map((p) => (
                    <option key={p} value={p}>
                      {CUSTOMER_PLAN_LABEL[p]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-gray-500">Salary (₹ / mo)</label>
                <input
                  value={salaries[m.userId] ?? ""}
                  onChange={(e) => setSalaries((s) => ({ ...s, [m.userId]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={saving === m.userId}
                  onClick={() => void save(m.userId)}
                  className="w-full rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving === m.userId ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
