"use client";


import { apiFetch } from "@/lib/api-fetch";
import { LeadOnboardingType, OnboardingWorkflowPlanTier } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";
import type { LeadCard } from "./internal-sales-types";

function leadTierToWorkflow(t: LeadOnboardingType): OnboardingWorkflowPlanTier {
  if (t === LeadOnboardingType.BASIC) return OnboardingWorkflowPlanTier.BASIC;
  if (t === LeadOnboardingType.PRO) return OnboardingWorkflowPlanTier.PRO;
  return OnboardingWorkflowPlanTier.ENTERPRISE;
}

const TIERS: {
  id: LeadOnboardingType;
  label: string;
  tag: string;
  path: string;
}[] = [
  { id: LeadOnboardingType.BASIC, label: "Basic", tag: "🟢 BASIC", path: "/onboarding/basic" },
  { id: LeadOnboardingType.PRO, label: "Pro", tag: "🔵 PRO", path: "/onboarding/pro" },
  {
    id: LeadOnboardingType.ENTERPRISE,
    label: "Enterprise",
    tag: "🟣 ENTERPRISE",
    path: "/onboarding/enterprise",
  },
];

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
  const [selected, setSelected] = useState<LeadOnboardingType | null>(lead.onboardingType ?? null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowLinks, setWorkflowLinks] = useState<{
    shareUrl: string;
    manageUrl: string;
  } | null>(null);

  const panel =
    theme === "bgos"
      ? "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1628] p-5 text-white shadow-2xl"
      : "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl";

  async function persistType(t: LeadOnboardingType) {
    setErr(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/api/internal-sales/leads/${lead.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingType: t }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Could not save type");
        return;
      }
      setSelected(t);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  const tierMeta = TIERS.find((x) => x.id === selected);
  const formHref = tierMeta ? `${tierMeta.path}?leadId=${encodeURIComponent(lead.id)}` : null;

  async function createShareableWorkflow() {
    if (!selected) return;
    setErr(null);
    setWorkflowBusy(true);
    try {
      const res = await apiFetch("/api/onboarding/workflow/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          category: "solar",
          planTier: leadTierToWorkflow(selected),
        }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        shareUrl?: string;
        manageUrl?: string;
        error?: string;
        details?: { submissionId?: string; token?: string };
      };
      if (res.status === 409 && j.details?.submissionId) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setWorkflowLinks({
          shareUrl: `${origin}/onboarding/fill/${j.details.token ?? ""}`,
          manageUrl: `${origin}/onboarding/manage/${j.details.submissionId}`,
        });
        setErr("Workflow already exists — links shown below.");
        return;
      }
      if (!res.ok || !j.ok || !j.shareUrl || !j.manageUrl) {
        setErr(typeof j.error === "string" ? j.error : "Could not create workflow");
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setWorkflowLinks({
        shareUrl: `${origin}${j.shareUrl}`,
        manageUrl: `${origin}${j.manageUrl}`,
      });
      onDone();
    } finally {
      setWorkflowBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className={panel}>
        <h2 className="text-lg font-semibold">Client onboarding</h2>
        <p className={theme === "bgos" ? "mt-1 text-xs text-white/55" : "mt-1 text-xs text-slate-500"}>
          1) Sales selects onboarding type after the demo conversation. 2) Open the matching form (all fields
          required). Pro includes Sales Booster channel capture.
        </p>
        {err ? (
          <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{err}</p>
        ) : null}

        <p className="mt-4 text-xs font-medium opacity-80">Onboarding type</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={saving}
              onClick={() => void persistType(t.id)}
              className={
                selected === t.id
                  ? "rounded-xl border-2 border-amber-400/70 bg-amber-500/15 px-3 py-2 text-xs font-semibold"
                  : theme === "bgos"
                    ? "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium"
                    : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium"
              }
            >
              {t.tag}
            </button>
          ))}
        </div>

        <div className="mt-6 border-t border-white/10 pt-4 dark:border-white/10">
          <p className="text-xs font-medium opacity-80">Open form</p>
          {formHref ? (
            <Link
              href={formHref}
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white"
              onClick={onClose}
            >
              Open {tierMeta?.label} form →
            </Link>
          ) : (
            <p className={theme === "bgos" ? "mt-2 text-xs text-white/45" : "mt-2 text-xs text-slate-500"}>
              Choose a type above to enable the form link.
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4 dark:border-white/10">
          <p className="text-xs font-medium opacity-80">Shareable workflow (optional text, autosave, tech queue)</p>
          <button
            type="button"
            disabled={!selected || workflowBusy}
            onClick={() => void createShareableWorkflow()}
            className={
              theme === "bgos"
                ? "mt-2 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-45"
                : "mt-2 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white disabled:opacity-45"
            }
          >
            {workflowBusy ? "Creating…" : "Create onboarding workflow"}
          </button>
          {workflowLinks ? (
            <div className={theme === "bgos" ? "mt-3 space-y-2 text-[11px] text-white/80" : "mt-3 space-y-2 text-[11px] text-slate-700"}>
              <p>
                <span className="font-semibold">Client link:</span>{" "}
                <button
                  type="button"
                  className="break-all text-left underline"
                  onClick={() => void navigator.clipboard.writeText(workflowLinks.shareUrl)}
                >
                  {workflowLinks.shareUrl}
                </button>{" "}
                (tap to copy)
              </p>
              <p>
                <Link href={workflowLinks.manageUrl} className="font-semibold text-amber-300 underline">
                  Open manage page →
                </Link>
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={
              theme === "bgos"
                ? "min-h-11 flex-1 rounded-xl border border-white/20 px-4 text-sm font-medium text-white/80"
                : "min-h-11 flex-1 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
            }
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
