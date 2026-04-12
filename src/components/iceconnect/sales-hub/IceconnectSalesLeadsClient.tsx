"use client";

import { IceconnectCustomerPlan, IceconnectMetroStage } from "@prisma/client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
import { CUSTOMER_PLAN_LABEL } from "@/lib/iceconnect-sales-hub";
import { MetroLine } from "./MetroLine";

type LeadItem = {
  id: string;
  name: string;
  phone: string;
  location: string;
  notes: string;
  stage: IceconnectMetroStage;
  stageLabel: string;
};

export function IceconnectSalesLeadsClient() {
  const router = useRouter();
  const { ready } = useCompanyBranding();
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const [subOpen, setSubOpen] = useState<string | null>(null);
  const [subPlan, setSubPlan] = useState<IceconnectCustomerPlan>(IceconnectCustomerPlan.PRO);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/iceconnect/executive/leads", { credentials: "include" });
      const j = (await res.json()) as { ok?: boolean; leads?: LeadItem[]; code?: string; error?: string };
      if (res.status === 403 && j.code === "NOT_INTERNAL_SALES_ORG") {
        router.replace("/iceconnect/internal-sales");
        return;
      }
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load leads");
        return;
      }
      setLeads(j.leads ?? []);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setErr(null);
    try {
      const res = await fetch("/api/iceconnect/executive/leads", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, location, notes }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not create lead");
        return;
      }
      setName("");
      setPhone("");
      setLocation("");
      setNotes("");
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function advance(leadId: string) {
    setBusy(leadId);
    setErr(null);
    try {
      const res = await fetch("/api/iceconnect/executive/leads/stage", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "advance", leadId }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not update stage");
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(null);
    }
  }

  async function subscribe(leadId: string) {
    setBusy(leadId);
    setErr(null);
    try {
      const res = await fetch("/api/iceconnect/executive/leads/stage", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "subscribe", leadId, customerPlan: subPlan }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not complete subscription");
        return;
      }
      setSubOpen(null);
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-500">Metro tracker — move prospects to subscription</p>
      </div>

      {err ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      ) : null}

      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-sm font-semibold text-gray-900">Create lead</h2>
        <form onSubmit={(e) => void createLead(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-gray-500">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="text-xs font-medium text-gray-500">Phone</label>
            <input
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500">Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={busy === "create"}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy === "create" ? "Saving…" : "Add lead"}
            </button>
          </div>
        </form>
      </motion.section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Pipeline</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : leads.length === 0 ? (
          <p className="text-sm text-gray-500">No active leads. Create one above.</p>
        ) : (
          <ul className="space-y-4">
            {leads.map((l) => (
              <li
                key={l.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{l.name}</p>
                    <p className="text-sm text-gray-600 tabular-nums">{l.phone}</p>
                    {l.location ? <p className="text-xs text-gray-500">{l.location}</p> : null}
                    <p className="mt-1 text-xs font-medium text-indigo-700">Stage: {l.stageLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {l.stage === IceconnectMetroStage.ONBOARDING ? (
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => {
                          setSubOpen(l.id);
                          setSubPlan(IceconnectCustomerPlan.PRO);
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Subscription ✓
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => void advance(l.id)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-50"
                      >
                        Advance stage
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <MetroLine current={l.stage} />
                </div>
                {subOpen === l.id ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <p className="text-sm font-medium text-gray-900">Confirm subscription plan</p>
                    <select
                      value={subPlan}
                      onChange={(e) => setSubPlan(e.target.value as IceconnectCustomerPlan)}
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      {(Object.keys(CUSTOMER_PLAN_LABEL) as IceconnectCustomerPlan[]).map((p) => (
                        <option key={p} value={p}>
                          {CUSTOMER_PLAN_LABEL[p]}
                        </option>
                      ))}
                    </select>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => void subscribe(l.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Confirm — move to Customers
                      </button>
                      <button type="button" onClick={() => setSubOpen(null)} className="text-xs text-gray-600">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
