"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-fetch";
import { glassPanel, ds } from "@/styles/design-system";

const INDUSTRIES = ["Solar", "FMCG", "Real Estate", "Manufacturing", "Services", "Retail", "Technology", "Healthcare", "Education", "Other"];
const PLANS = [
  { value: "BASIC", label: "Basic", desc: "Core features", price: "₹999/mo" },
  { value: "PRO", label: "Pro", desc: "Advanced tools", price: "₹2,499/mo" },
  { value: "ENTERPRISE", label: "Enterprise", desc: "Custom scale", price: "₹9,999/mo" },
];

function fadeUp(i = 0) {
  return { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay: i * 0.06 } };
}

export function OnboardCompanyForm() {
  const params = useSearchParams();
  const router = useRouter();
  const isExisting = params.get("existing") === "1";

  const [form, setForm] = useState({
    companyName: "",
    ownerName: "",
    phone: "",
    email: "",
    industry: "",
    plan: "BASIC",
    gst: "",
    city: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.companyName.trim() || !form.ownerName.trim() || !form.phone.trim()) {
      setErr("Company name, owner name, and phone are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/internal/onboard-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, isExisting }),
      });
      const j = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || j.ok === false) {
        setErr(j.error ?? "Failed to submit. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-full pb-20 pt-6" style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}>
        <div className="mx-auto w-full max-w-xl px-4 sm:px-6 pt-20 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className={`${glassPanel} p-10`}>
            <div className="mb-4 text-4xl">🎉</div>
            <h2 className="text-xl font-bold text-white">Company Submitted!</h2>
            <p className="mt-2 text-sm text-white/50">The onboarding request has been logged and the team will follow up.</p>
            <div className="mt-6 flex gap-3 justify-center">
              <button onClick={() => { setDone(false); setForm({ companyName: "", ownerName: "", phone: "", email: "", industry: "", plan: "BASIC", gst: "", city: "", notes: "" }); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white/60 hover:bg-white/[0.07] transition-colors">
                Add Another
              </button>
              <button onClick={() => router.push("/internal/sales")} className="rounded-xl bg-[#4FD1FF]/10 border border-[#4FD1FF]/20 px-5 py-2.5 text-sm font-medium text-[#4FD1FF] hover:bg-[#4FD1FF]/20 transition-colors">
                Back to Sales
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-20 pt-6" style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}>
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp(0)} className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
            {isExisting ? "Migrate Existing" : "New Onboarding"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {isExisting ? "Onboard Existing Company" : "Add New Company"}
          </h1>
          <p className="mt-1 text-sm text-white/40">Fill in the company details to begin the BGOS activation process.</p>
        </motion.div>

        <motion.form {...fadeUp(1)} onSubmit={handleSubmit} className={`${glassPanel} p-6 space-y-5`}>
          {/* Company info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: "Company Name *", key: "companyName", placeholder: "Acme Solar Pvt Ltd" },
              { label: "Owner / Contact Name *", key: "ownerName", placeholder: "Rajesh Kumar" },
              { label: "Phone *", key: "phone", placeholder: "+91 98765 43210" },
              { label: "Email", key: "email", placeholder: "owner@company.com", type: "email" },
              { label: "City", key: "city", placeholder: "Mumbai" },
              { label: "GST Number", key: "gst", placeholder: "22AAAAA0000A1Z5" },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-white/50">{label}</label>
                <input
                  type={type ?? "text"}
                  value={form[key as keyof typeof form]}
                  onChange={set(key as keyof typeof form)}
                  placeholder={placeholder}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#4FD1FF]/40 focus:ring-1 focus:ring-[#4FD1FF]/20 transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Industry */}
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Industry</label>
            <select value={form.industry} onChange={set("industry")} className="w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-3 py-2.5 text-sm text-white outline-none focus:border-[#4FD1FF]/40">
              <option value="">Select industry…</option>
              {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
            </select>
          </div>

          {/* Plan selection */}
          <div>
            <label className="mb-2 block text-xs font-medium text-white/50">Plan</label>
            <div className="grid grid-cols-3 gap-3">
              {PLANS.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => setForm((f) => ({ ...f, plan: p.value }))}
                  className={`rounded-xl border p-3.5 text-left transition-all ${form.plan === p.value ? "border-[#4FD1FF]/40 bg-[#4FD1FF]/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"}`}
                >
                  <p className={`text-sm font-semibold ${form.plan === p.value ? "text-[#4FD1FF]" : "text-white/70"}`}>{p.label}</p>
                  <p className="text-xs text-white/30 mt-0.5">{p.desc}</p>
                  <p className={`text-xs font-medium mt-1 ${form.plan === p.value ? "text-[#4FD1FF]/80" : "text-white/40"}`}>{p.price}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-medium text-white/50">Notes</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              rows={3}
              placeholder="Any special requirements or context…"
              className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#4FD1FF]/40 transition-colors"
            />
          </div>

          {err && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{err}</p>
            </div>
          )}

          <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#4FD1FF] py-3 text-sm font-bold text-black hover:bg-[#4FD1FF]/90 disabled:opacity-50 transition-colors">
            {busy ? "Submitting…" : isExisting ? "Submit Migration Request" : "Submit Onboarding Request"}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
