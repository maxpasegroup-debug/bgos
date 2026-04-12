"use client";

import { useState } from "react";
import { readError } from "@/components/internal-sales/internal-sales-read-api";

const OPTIONS = [
  { value: "CALLBACK", label: "Call back" },
  { value: "MEETING", label: "Meeting" },
  { value: "ISSUE", label: "Raise issue" },
] as const;

const CATEGORIES = [
  { value: "TECHNICAL", label: "Technical issue" },
  { value: "TRAINING", label: "Training" },
  { value: "PAYMENT", label: "Payment" },
  { value: "OTHER", label: "Other" },
] as const;

export function NexaSupportModal({
  theme,
  leadId,
  onClose,
  onDone,
}: {
  theme: "bgos" | "ice";
  leadId?: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [option, setOption] = useState<(typeof OPTIONS)[number]["value"]>("CALLBACK");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("TECHNICAL");
  const [message, setMessage] = useState("");
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
      const res = await fetch("/api/internal-sales/nexa-support", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(leadId ? { leadId } : {}),
          option,
          category,
          message: message.trim(),
        }),
      });
      const j: unknown = await res.json();
      if (!res.ok) {
        setErr(readError(j, "Could not submit"));
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
        <h2 className="text-lg font-semibold">Nexa Support</h2>
        <p className={theme === "bgos" ? "mt-1 text-xs text-white/55" : "mt-1 text-xs text-slate-500"}>
          We route this to the tech team.
        </p>
        {err ? (
          <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{err}</p>
        ) : null}
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-xs font-medium">
            Type
            <select className={inp} value={option} onChange={(e) => setOption(e.target.value as typeof option)}>
              {OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Category
            <select
              className={inp}
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium">
            Details
            <textarea
              className={inp}
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={busy || !message.trim()}
              className="min-h-11 flex-1 rounded-xl bg-indigo-600 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Submit"}
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
