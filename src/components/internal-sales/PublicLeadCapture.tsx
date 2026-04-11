"use client";

import Link from "next/link";
import { useState } from "react";

export function PublicLeadCapture() {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setExistingId(null);
    setBusy(true);
    try {
      const res = await fetch("/api/internal-sales/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          companyName: companyName.trim() || undefined,
          phone: phone.trim(),
          email: email.trim() || undefined,
          businessType: businessType.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const j = (await res.json()) as Record<string, unknown> & {
        details?: { existingLead?: { id: string; name: string }; match?: string };
      };
      if (!res.ok) {
        const er = j.error;
        setErr(typeof er === "string" ? er : "Something went wrong.");
        const ex = j.details?.existingLead;
        if (ex?.id) setExistingId(ex.id);
        return;
      }
      const m = j.message;
      setMsg(typeof m === "string" ? m : "Thank you.");
      setName("");
      setCompanyName("");
      setPhone("");
      setEmail("");
      setBusinessType("");
      setNotes("");
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Add a lead</h1>
        <p className="mt-2 text-sm text-slate-600">We only need a few details. Phone is required.</p>

        {err ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            <p>{err}</p>
            {existingId ? (
              <p className="mt-3">
                <Link
                  href="/iceconnect/internal-sales"
                  className="font-semibold text-red-900 underline"
                >
                  View existing lead (sign in)
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
        {msg ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {msg}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Name
            <input className={field} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Company name
            <input className={field} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Phone
            <input
              className={field}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
              autoComplete="tel"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className={field}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Business type
            <input className={field} value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Notes
            <textarea className={`${field} min-h-[100px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}
