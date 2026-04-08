"use client";

import { useCallback, useEffect, useState } from "react";
import { useBgosDashboardContext } from "./BgosDataProvider";

type CompanySettings = {
  id: string;
  name: string;
  plan: string;
  industry: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  billingAddress: string | null;
  gstNumber: string | null;
  bankDetails: string | null;
};

export function BgosCompanySettingsForm() {
  const { trialReadOnly } = useBgosDashboardContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Partial<CompanySettings>>({});

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/company/settings", { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; company?: CompanySettings; error?: string };
      if (!res.ok || !data.ok || !data.company) {
        setError(typeof data.error === "string" ? data.error : "Could not load settings.");
        return;
      }
      setForm(data.company);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (trialReadOnly) {
      setError("Your free trial has expired. Upgrade to save settings.");
      return;
    }
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/company/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          logoUrl: form.logoUrl,
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          companyEmail: form.companyEmail,
          companyPhone: form.companyPhone,
          billingAddress: form.billingAddress,
          gstNumber: form.gstNumber,
          bankDetails: form.bankDetails,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; company?: CompanySettings; error?: string };
      if (!res.ok || !data.ok || !data.company) {
        const dj = data as { error?: string; code?: string };
        setError(
          dj.code === "TRIAL_EXPIRED"
            ? typeof dj.error === "string" && dj.error.trim()
              ? dj.error
              : "Your free trial has expired. Upgrade to continue."
            : typeof data.error === "string"
              ? data.error
              : "Could not save.",
        );
        return;
      }
      setForm(data.company);
      setSaved(true);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-10 animate-pulse rounded-lg bg-white/10" />
        <div className="h-10 animate-pulse rounded-lg bg-white/10" />
      </div>
    );
  }

  const input =
    "mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#FFC300]/50 focus:ring-1 focus:ring-[#FFC300]/30";
  const label = "block text-xs font-medium text-white/65";

  return (
    <form className="space-y-5" onSubmit={(e) => void onSubmit(e)} noValidate>
      <fieldset disabled={trialReadOnly} className="min-w-0 space-y-5 border-0 p-0">
      <div>
        <label className={label} htmlFor="co-name">
          Company name
        </label>
        <input
          id="co-name"
          className={input}
          value={form.name ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="logo">
            Logo URL
          </label>
          <input
            id="logo"
            className={input}
            placeholder="https://… or /logo.jpg"
            value={form.logoUrl ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value || null }))}
          />
          <p className="mt-1 text-[11px] text-white/40">
            HTTPS URL or site path. Max 2048 chars. Binary upload requires storage (e.g. S3) — use URL for
            now.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label} htmlFor="pc">
              Primary color
            </label>
            <input
              id="pc"
              className={input}
              placeholder="#FF3B3B"
              value={form.primaryColor ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value || null }))}
            />
          </div>
          <div>
            <label className={label} htmlFor="sc">
              Secondary color
            </label>
            <input
              id="sc"
              className={input}
              placeholder="#FFC300"
              value={form.secondaryColor ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value || null }))}
            />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="email">
            Company email
          </label>
          <input
            id="email"
            type="email"
            className={input}
            autoComplete="email"
            value={form.companyEmail ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, companyEmail: e.target.value || null }))}
          />
        </div>
        <div>
          <label className={label} htmlFor="phone">
            Company phone
          </label>
          <input
            id="phone"
            type="tel"
            className={input}
            value={form.companyPhone ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, companyPhone: e.target.value || null }))}
          />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="addr">
          Address (quotations / invoices)
        </label>
        <textarea
          id="addr"
          rows={3}
          className={input}
          value={form.billingAddress ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, billingAddress: e.target.value || null }))}
        />
      </div>
      <div>
        <label className={label} htmlFor="gst">
          GST number
        </label>
        <input
          id="gst"
          className={input}
          value={form.gstNumber ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value || null }))}
        />
      </div>
      <div>
        <label className={label} htmlFor="bank">
          Bank details
        </label>
        <textarea
          id="bank"
          rows={3}
          className={input}
          placeholder="Bank name, A/C no., IFSC, branch…"
          value={form.bankDetails ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, bankDetails: e.target.value || null }))}
        />
      </div>
      <p className="text-xs text-white/40">
        Plan: <span className="text-white/70">{form.plan}</span> · Industry:{" "}
        <span className="text-white/70">{form.industry}</span>
      </p>
      </fieldset>
      {error ? (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-emerald-400" role="status">
          Saved. ICECONNECT will pick up branding on next load.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#FFC300] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#f5c100] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-white/90 hover:bg-white/5"
        >
          Reload
        </button>
      </div>
    </form>
  );
}
