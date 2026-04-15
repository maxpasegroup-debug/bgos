"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";

export default function MicroFranchiseOffersPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [offers, setOffers] = useState<
    { id: string; name: string; type: string; value: number; recurring: boolean; instantBonus: number | null }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [value, setValue] = useState(5);
  const [recurring, setRecurring] = useState(true);
  const [bonus, setBonus] = useState<number | "">("");

  const load = useCallback(async () => {
    const res = await apiFetch("/api/bgos/control/micro-franchise/offers", { credentials: "include" });
    const j = ((await readApiJson(res, "mf/offers-page")) ?? {}) as { ok?: boolean; offers?: typeof offers };
    if (res.ok && j.ok) setOffers(j.offers ?? []);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await apiFetch("/api/bgos/control/micro-franchise/offers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          value,
          recurring,
          instantBonus: bonus === "" ? null : Number(bonus),
        }),
      });
      const j = ((await readApiJson(res, "mf/offer-create")) ?? {}) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Failed");
      setName("");
      await load();
    } catch (e) {
      setError(formatFetchFailure(e, "Could not save"));
    }
  }

  const card = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-6";
  const h1 = light ? "text-xl font-bold text-slate-900" : "text-xl font-bold text-white";

  return (
    <div className={`mx-auto max-w-3xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <Link href="/bgos/control/micro-franchise" className="text-xs text-cyan-400 hover:text-cyan-300">
        ← Back to micro franchise
      </Link>
      <h1 className={h1 + " mt-4"}>Commission offers</h1>
      {error ? <p className="mt-2 text-sm text-amber-500">{error}</p> : null}
      <form className={card + " mt-6 space-y-3"} onSubmit={(e) => void onSubmit(e)}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Offer name"
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "PERCENTAGE" | "FIXED")}
            className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed ₹</option>
          </select>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-28 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Recurring
        </label>
        <input
          type="number"
          value={bonus}
          onChange={(e) => setBonus(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Instant bonus (₹, optional)"
          className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
        />
        <button type="submit" className="w-full rounded-lg bg-cyan-500 py-2.5 text-sm font-semibold text-black">
          Save offer
        </button>
      </form>
      <ul
        className={
          light
            ? "mt-6 space-y-2 text-sm text-slate-700"
            : "mt-6 space-y-2 text-sm text-white/80"
        }
      >
        {offers.map((o) => (
          <li
            key={o.id}
            className={
              light
                ? "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                : "rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            }
          >
            {o.name} — {o.type === "PERCENTAGE" ? `${o.value}%` : `₹${o.value}`}
            {o.recurring ? " · recurring" : ""}
            {o.instantBonus != null ? ` · bonus ₹${o.instantBonus}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
