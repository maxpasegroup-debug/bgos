"use client";

import { useState } from "react";
import type { LeadCard } from "./internal-sales-types";

export function OnboardingStartModal({
  lead,
  theme,
  onClose,
  onDone,
}: {
  lead: LeadCard;
  theme: "bgos" | "ice";
  onClose: () => void;
  onDone: () => void;
}) {
  const [companyName, setCompanyName] = useState(lead.companyName ?? "");
  const [ownerName, setOwnerName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState(lead.email ?? "");
  const [businessType, setBusinessType] = useState(lead.businessType ?? "");
  const [teamSize, setTeamSize] = useState("");
  const [leadSources, setLeadSources] = useState("");
  const [problems, setProblems] = useState("");
  const [requirements, setRequirements] = useState("");
  const [plan, setPlan] = useState("");
  const [whatsApp, setWhatsApp] = useState(lead.phone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const panel =
    theme === "bgos"
      ? "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1628] p-5 text-white shadow-2xl"
      : "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl";

  const inp =
    theme === "bgos"
      ? "mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
      : "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/internal-sales/leads/${lead.id}/onboarding`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          businessType: businessType.trim(),
          teamSize: teamSize.trim(),
          leadSources: leadSources.trim(),
          problems: problems.trim(),
          requirements: requirements.trim(),
          plan: plan.trim(),
          whatsApp: whatsApp.trim(),
        }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not submit");
        return;
      }
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className={panel}>
        <h2 className="text-lg font-semibold">Onboarding form</h2>
        <p className={theme === "bgos" ? "mt-1 text-xs text-white/55" : "mt-1 text-xs text-slate-500"}>
          All fields are required. Submits for boss approval — you cannot skip this step while Interested.
        </p>
        {err ? (
          <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{err}</p>
        ) : null}
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-xs font-medium">
            Company name
            <input className={inp} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Owner name
            <input className={inp} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Phone
            <input className={inp} value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" />
          </label>
          <label className="block text-xs font-medium">
            Email
            <input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Business type
            <input className={inp} value={businessType} onChange={(e) => setBusinessType(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Team size (sales / tech)
            <input className={inp} value={teamSize} onChange={(e) => setTeamSize(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Lead sources
            <textarea className={inp} rows={2} value={leadSources} onChange={(e) => setLeadSources(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Problems
            <textarea className={inp} rows={2} value={problems} onChange={(e) => setProblems(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Requirements
            <textarea className={inp} rows={2} value={requirements} onChange={(e) => setRequirements(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Plan
            <input className={inp} value={plan} onChange={(e) => setPlan(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            WhatsApp number
            <input className={inp} value={whatsApp} onChange={(e) => setWhatsApp(e.target.value)} required inputMode="tel" />
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 flex-1 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Submit for approval"}
            </button>
            <button
              type="button"
              className={
                theme === "bgos"
                  ? "min-h-11 rounded-xl border border-white/20 px-4 text-sm font-medium text-white/80"
                  : "min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
              }
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
