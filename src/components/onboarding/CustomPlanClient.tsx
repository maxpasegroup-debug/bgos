"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type PlanChoice = "BASIC" | "PRO" | "ENTERPRISE";

const PLANS: {
  id: PlanChoice;
  title: string;
  tagline: string;
  bullets: string[];
}[] = [
  {
    id: "BASIC",
    title: "Basic",
    tagline: "Run your business with automation",
    bullets: ["Core dashboard", "Team management", "Limited Nexa suggestions"],
  },
  {
    id: "PRO",
    title: "Pro",
    tagline: "Grow your business with Nexa AI + Sales Booster",
    bullets: ["Full dashboard", "Sales Booster", "Full Nexa intelligence"],
  },
  {
    id: "ENTERPRISE",
    title: "Enterprise",
    tagline: "Custom build for your business",
    bullets: ["Custom system scope", "Advanced features", "Priority support"],
  },
];

export function CustomPlanClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<PlanChoice>("BASIC");
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const create = useCallback(async () => {
    setErr(null);
    if (!name.trim()) {
      setErr("Enter a working business name.");
      return;
    }
    setPending(true);
    try {
      const res = await apiFetch("/api/onboarding/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyName: name.trim(),
          industry: "CUSTOM",
          customWorkspacePlan: plan,
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        success?: boolean;
        error?: string;
        message?: string;
        requiresCustomPayment?: boolean;
      };
      if (!res.ok || !j.ok || j.success === false) {
        setErr(typeof j.error === "string" ? j.error : j.message ?? "Could not create workspace.");
        return;
      }
      router.replace("/onboarding/custom/pay");
      router.refresh();
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setPending(false);
    }
  }, [name, plan, router]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-white">
      <h1 className="text-2xl font-semibold tracking-tight">Custom business workspace</h1>
      <p className="mt-2 text-sm text-amber-200/90">
        Custom dashboard requires a paid plan — no free trial on this path.
      </p>

      <div className="mt-8">
        <label htmlFor="co-name" className="block text-xs font-medium text-white/70">
          Working business name
        </label>
        <input
          id="co-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none ring-cyan-500/30 focus:ring-2"
          placeholder="Your company"
        />
      </div>

      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Select plan</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlan(p.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              plan === p.id
                ? "border-cyan-400/60 bg-cyan-500/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/20"
            }`}
          >
            <p className="text-sm font-semibold text-white">{p.title}</p>
            <p className="mt-1 text-xs text-cyan-200/85">{p.tagline}</p>
            <ul className="mt-3 space-y-1 text-[11px] text-white/55">
              {p.bullets.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {err ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() => void create()}
        className="mt-8 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Continue to payment"}
      </button>
    </div>
  );
}
