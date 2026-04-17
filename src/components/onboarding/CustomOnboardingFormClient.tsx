"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collectFieldKeys,
  computeCompletionPercent,
  customTemplateSections,
} from "@/lib/onboarding-workflow-types";
import type { OnboardingWorkflowPlanTier } from "@prisma/client";

type StatusJson = {
  ok?: boolean;
  businessType?: string;
  subscriptionStatus?: string;
  plan?: string;
  customFormComplete?: boolean;
  error?: string;
};

function tierFromPlan(plan: string | undefined): OnboardingWorkflowPlanTier {
  if (plan === "PRO") return "PRO";
  if (plan === "ENTERPRISE") return "ENTERPRISE";
  return "BASIC";
}

export function CustomOnboardingFormClient() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Record<string, string>>({});
  const [tier, setTier] = useState<OnboardingWorkflowPlanTier>("BASIC");

  const probe = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/onboarding/custom/status", { credentials: "include" });
      const j = (await res.json()) as StatusJson;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load status.");
        return;
      }
      if (j.businessType !== "CUSTOM") {
        router.replace("/onboarding/nexa");
        return;
      }
      if (j.subscriptionStatus === "PAYMENT_PENDING") {
        router.replace("/onboarding/custom/pay");
        return;
      }
      if (j.customFormComplete) {
        router.replace("/bgos");
        return;
      }
      setTier(tierFromPlan(j.plan));
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, [router]);

  useEffect(() => {
    void probe();
  }, [probe]);

  const template = useMemo(() => customTemplateSections(tier), [tier]);
  const sections = template.sections;
  const pct = useMemo(() => computeCompletionPercent(template, data), [template, data]);

  const submit = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/onboarding/custom/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; redirect?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Submit failed.");
        return;
      }
      router.replace(j.redirect ?? "/bgos");
      router.refresh();
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setBusy(false);
    }
  }, [data, router]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-white">
      <h1 className="text-2xl font-semibold tracking-tight">Custom build — requirements</h1>
      <p className="mt-1 text-sm text-white/60">
        All fields are optional text. Completion: <strong className="text-cyan-300">{pct}%</strong>
      </p>
      {err ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
      <div className="mt-8 space-y-8">
        {sections.map((sec) => (
          <section key={sec.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300/90">{sec.title}</h2>
            <div className="mt-4 space-y-4">
              {sec.fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-white/70">{f.label}</label>
                  <textarea
                    value={data[f.key] ?? ""}
                    onChange={(e) => setData((s) => ({ ...s, [f.key]: e.target.value }))}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none ring-cyan-500/30 focus:ring-2"
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit to BGOS tech"}
        </button>
        <p className="text-xs text-white/45 self-center">
          {collectFieldKeys(template).length} guided fields — submit anytime.
        </p>
      </div>
    </div>
  );
}
