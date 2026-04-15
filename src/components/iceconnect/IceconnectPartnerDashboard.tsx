"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { useCallback, useEffect, useState } from "react";
import { IceconnectWorkspaceView } from "@/components/iceconnect/IceconnectWorkspaceView";
import { IcPanel } from "@/components/iceconnect/IcPanel";

type PartnerRow = {
  id: string;
  name: string;
  phone: string;
  leadsGenerated: number;
  commissionEarned: number;
  commissionPending: number;
};

type CommissionRow = {
  id: string;
  partnerId: string;
  partnerName: string;
  leadId: string;
  leadName: string;
  amount: number;
  type: string;
  status: string;
};

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[color:var(--ice-primary)]";

export function IceconnectPartnerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [partnerId, setPartnerId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("DIRECT");
  const [status, setStatus] = useState("PENDING");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, cRes] = await Promise.all([
        apiFetch("/api/partner/list", { credentials: "include" }),
        apiFetch("/api/commission/list", { credentials: "include" }),
      ]);
      const pj = (await pRes.json()) as { ok?: boolean; partners?: PartnerRow[]; error?: string };
      const cj = (await cRes.json()) as {
        ok?: boolean;
        commissions?: CommissionRow[];
        error?: string;
      };
      if (!pRes.ok || !pj.ok || !Array.isArray(pj.partners)) {
        setError(pj.error ?? "Could not load partners");
        return;
      }
      if (!cRes.ok || !cj.ok || !Array.isArray(cj.commissions)) {
        setError(cj.error ?? "Could not load commissions");
        return;
      }
      setPartners(pj.partners);
      setCommissions(cj.commissions);
      if (pj.partners.length > 0 && !partnerId) setPartnerId(pj.partners[0].id);
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function addPartner() {
    const res = await apiFetch("/api/partner/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not add partner");
      return;
    }
    setName("");
    setPhone("");
    await load();
  }

  async function createCommission() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter valid commission amount.");
      return;
    }
    const res = await apiFetch("/api/commission/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerId, leadId, amount: amt, type, status }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not create commission");
      return;
    }
    setAmount("");
    setLeadId("");
    await load();
  }

  return (
    <IceconnectWorkspaceView
      title="Channel Partner Management"
      subtitle="Partner onboarding, lead contribution, and commission tracking."
      loading={loading}
      error={error}
      onRetry={() => void load()}
    >
      <div className="grid gap-6">
        <IcPanel title="Add partner">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-gray-500">
              Name
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-xs text-gray-500">
              Phone
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
          <button type="button" onClick={() => void addPartner()} className="mt-3 rounded-lg bg-[color:var(--ice-primary)] px-3 py-2 text-sm font-semibold text-white">
            Add partner
          </button>
        </IcPanel>

        <IcPanel title="Partner list">
          <div className="space-y-2">
            {partners.map((p) => (
              <div key={p.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-900">{p.name} · {p.phone}</p>
                <p className="text-gray-600">
                  Leads generated: {p.leadsGenerated} · Commission earned: {formatInr(p.commissionEarned)} · Pending: {formatInr(p.commissionPending)}
                </p>
              </div>
            ))}
          </div>
        </IcPanel>

        <IcPanel title="Commission entry">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs text-gray-500">
              Partner
              <select className={inputClass} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                {partners.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Lead ID
              <input className={inputClass} value={leadId} onChange={(e) => setLeadId(e.target.value)} />
            </label>
            <label className="text-xs text-gray-500">
              Amount
              <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="text-xs text-gray-500">
              Type
              <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="DIRECT">DIRECT</option>
                <option value="REFERRAL">REFERRAL</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Status
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="PENDING">PENDING</option>
                <option value="PAID">PAID</option>
              </select>
            </label>
          </div>
          <button type="button" onClick={() => void createCommission()} className="mt-3 rounded-lg border border-emerald-300 px-3 py-2 text-sm text-emerald-700">
            Save commission
          </button>
        </IcPanel>

        <IcPanel title="Commission list">
          <div className="space-y-2">
            {commissions.map((c) => (
              <div key={c.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-900">{c.partnerName} · {c.leadName}</p>
                <p className="text-gray-600">{c.type} · {c.status} · {formatInr(c.amount)}</p>
              </div>
            ))}
          </div>
        </IcPanel>
      </div>
    </IceconnectWorkspaceView>
  );
}
