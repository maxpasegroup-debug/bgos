"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { InternalSalesStage, LeadOnboardingType } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tier = "basic" | "pro" | "enterprise";

const tierToLead: Record<Tier, LeadOnboardingType> = {
  basic: LeadOnboardingType.BASIC,
  pro: LeadOnboardingType.PRO,
  enterprise: LeadOnboardingType.ENTERPRISE,
};

type NexaQ = { key: string; label: string; placeholder?: string; multiline?: boolean };

function nexaQuestions(tier: Tier): NexaQ[] {
  const common: NexaQ[] = [
    { key: "companyName", label: "Company name?" },
    { key: "ownerName", label: "Owner / contact name?" },
    { key: "phone", label: "Primary phone?" },
    { key: "email", label: "Business email?" },
    { key: "businessType", label: "Business type (e.g. solar EPC, dealer)?" },
    { key: "salesTeamCount", label: "How many people in sales?" },
    { key: "techTeamCount", label: "How many in tech / operations?" },
    { key: "leadSources", label: "Main lead sources?", multiline: true },
    { key: "currentProblems", label: "Current problems or pain points?", multiline: true },
    { key: "requirements", label: "What do they need from BGOS?", multiline: true },
  ];
  if (tier === "basic") return common;
  if (tier === "pro") {
    return [
      ...common,
      { key: "whatsApp", label: "WhatsApp number for customers?" },
      { key: "socialChannels", label: "Social channels in use?", multiline: true },
      { key: "automationNeeds", label: "Automation priorities?", multiline: true },
    ];
  }
  return [
    ...common,
    { key: "customRequirements", label: "Custom / enterprise requirements?", multiline: true },
    { key: "multiBranch", label: "Multi-branch setup — describe?", multiline: true },
    { key: "integrations", label: "Integrations needed?", multiline: true },
  ];
}

export function InternalClientOnboardingForm({
  tier,
  leadId,
}: {
  tier: Tier;
  leadId: string | null;
}) {
  const router = useRouter();
  const [probe, setProbe] = useState<"loading" | "ok" | "err">("loading");
  const [leadStage, setLeadStage] = useState<InternalSalesStage | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [nexaOpen, setNexaOpen] = useState(false);
  const [nexaIdx, setNexaIdx] = useState(0);
  const [nexaInput, setNexaInput] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [salesTeamCount, setSalesTeamCount] = useState("");
  const [techTeamCount, setTechTeamCount] = useState("");
  const [leadSources, setLeadSources] = useState("");
  const [currentProblems, setCurrentProblems] = useState("");
  const [requirements, setRequirements] = useState("");
  const [whatsApp, setWhatsApp] = useState("");
  const [socialChannels, setSocialChannels] = useState("");
  const [automationNeeds, setAutomationNeeds] = useState("");
  const [customRequirements, setCustomRequirements] = useState("");
  const [multiBranch, setMultiBranch] = useState("");
  const [integrations, setIntegrations] = useState("");

  const questions = useMemo(() => nexaQuestions(tier), [tier]);

  const loadLead = useCallback(async () => {
    if (!leadId) {
      setProbe("err");
      return;
    }
    setProbe("loading");
    setErr(null);
    try {
      const res = await apiFetch(`/api/internal-sales/leads/${leadId}`, { credentials: "include" });
      const j = (await res.json()) as {
        ok?: boolean;
        lead?: {
          stage: InternalSalesStage;
          onboardingType: LeadOnboardingType | null;
          name: string;
          phone: string;
          email: string | null;
          companyName: string | null;
          businessType: string | null;
        };
        error?: string;
      };
      if (!res.ok || !j.lead) {
        setProbe("err");
        setErr(j.error ?? "Could not load lead");
        return;
      }
      if (j.lead.stage !== InternalSalesStage.INTERESTED) {
        setProbe("err");
        setLeadStage(j.lead.stage);
        setErr("This form is only available when the lead is in Interested.");
        return;
      }
      if (j.lead.onboardingType !== tierToLead[tier]) {
        setProbe("err");
        setErr("Onboarding type on this lead does not match this form. Ask sales to set the correct type.");
        return;
      }
      setOwnerName(j.lead.name ?? "");
      setPhone(j.lead.phone ?? "");
      setEmail(j.lead.email ?? "");
      setCompanyName(j.lead.companyName ?? "");
      setBusinessType(j.lead.businessType ?? "");
      setProbe("ok");
    } catch (e) {
      console.error("API ERROR:", e);
      setProbe("err");
      setErr(formatFetchFailure(e, "Request failed"));
    }
  }, [leadId, tier]);

  useEffect(() => {
    void loadLead();
  }, [loadLead]);

  function setField(key: string, value: string) {
    const v = value.trim();
    switch (key) {
      case "companyName":
        setCompanyName(v);
        break;
      case "ownerName":
        setOwnerName(v);
        break;
      case "phone":
        setPhone(v);
        break;
      case "email":
        setEmail(v);
        break;
      case "businessType":
        setBusinessType(v);
        break;
      case "salesTeamCount":
        setSalesTeamCount(v);
        break;
      case "techTeamCount":
        setTechTeamCount(v);
        break;
      case "leadSources":
        setLeadSources(v);
        break;
      case "currentProblems":
        setCurrentProblems(v);
        break;
      case "requirements":
        setRequirements(v);
        break;
      case "whatsApp":
        setWhatsApp(v);
        break;
      case "socialChannels":
        setSocialChannels(v);
        break;
      case "automationNeeds":
        setAutomationNeeds(v);
        break;
      case "customRequirements":
        setCustomRequirements(v);
        break;
      case "multiBranch":
        setMultiBranch(v);
        break;
      case "integrations":
        setIntegrations(v);
        break;
      default:
        break;
    }
  }

  function nexaNext() {
    const q = questions[nexaIdx];
    if (!q) return;
    setField(q.key, nexaInput);
    setNexaInput("");
    if (nexaIdx + 1 >= questions.length) {
      setNexaOpen(false);
      setNexaIdx(0);
      return;
    }
    setNexaIdx(nexaIdx + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId) return;
    setErr(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        tier,
        companyName: companyName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        businessType: businessType.trim(),
        salesTeamCount: salesTeamCount.trim(),
        techTeamCount: techTeamCount.trim(),
        leadSources: leadSources.trim(),
        currentProblems: currentProblems.trim(),
        requirements: requirements.trim(),
      };
      if (tier === "pro") {
        body.whatsApp = whatsApp.trim();
        body.socialChannels = socialChannels.trim();
        body.automationNeeds = automationNeeds.trim();
      }
      if (tier === "enterprise") {
        body.customRequirements = customRequirements.trim();
        body.multiBranch = multiBranch.trim();
        body.integrations = integrations.trim();
      }

      const res = await apiFetch(`/api/internal-sales/leads/${leadId}/onboarding`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) {
        setErr(j.error ?? j.message ?? "Submit failed");
        return;
      }
      router.push("/bgos/internal-sales");
    } finally {
      setBusy(false);
    }
  }

  const title =
    tier === "basic" ? "Basic onboarding" : tier === "pro" ? "Pro onboarding" : "Enterprise onboarding";

  if (probe === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#0B0F19] text-white/60">
        Checking access…
      </div>
    );
  }

  if (probe === "err") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-white">
        <h1 className="text-xl font-semibold">Cannot open form</h1>
        <p className="mt-2 text-sm text-white/60">{err ?? "Missing or invalid lead."}</p>
        {leadStage ? (
          <p className="mt-2 text-xs text-white/45">Current pipeline stage: {leadStage.replace(/_/g, " ")}</p>
        ) : null}
        <Link href="/bgos/internal-sales" className="mt-6 inline-block text-sm text-amber-300 underline">
          ← Back to internal sales
        </Link>
      </div>
    );
  }

  const inp =
    "mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35";

  return (
    <div className="min-h-screen bg-[#0B0F19] px-4 pb-20 pt-8 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/bgos/internal-sales" className="text-xs text-white/50 hover:text-amber-300">
          ← Internal sales
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-white/55">All fields required. You can edit after Nexa Assist.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setNexaOpen(true);
              setNexaIdx(0);
              setNexaInput("");
            }}
            className="rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-100"
          >
            Nexa Assist
          </button>
        </div>

        {nexaOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
            <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#121821] p-5 shadow-xl">
              <p className="text-xs font-medium text-white/50">
                Question {nexaIdx + 1} / {questions.length}
              </p>
              <p className="mt-2 text-sm font-medium text-white">{questions[nexaIdx]?.label}</p>
              {questions[nexaIdx]?.multiline ? (
                <textarea
                  className={`${inp} mt-3 min-h-[100px]`}
                  value={nexaInput}
                  onChange={(e) => setNexaInput(e.target.value)}
                  placeholder={questions[nexaIdx]?.placeholder}
                />
              ) : (
                <input
                  className={`${inp} mt-3`}
                  value={nexaInput}
                  onChange={(e) => setNexaInput(e.target.value)}
                  placeholder={questions[nexaIdx]?.placeholder}
                />
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => nexaNext()}
                  className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-semibold text-white"
                >
                  {nexaIdx + 1 >= questions.length ? "Done" : "Next"}
                </button>
                <button
                  type="button"
                  onClick={() => setNexaOpen(false)}
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {err ? <p className="mt-4 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-100">{err}</p> : null}

        <form onSubmit={submit} className="mt-6 space-y-3">
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
            Sales team count
            <input className={inp} value={salesTeamCount} onChange={(e) => setSalesTeamCount(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Tech team count
            <input className={inp} value={techTeamCount} onChange={(e) => setTechTeamCount(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Lead sources
            <textarea className={inp} rows={2} value={leadSources} onChange={(e) => setLeadSources(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Current problems
            <textarea className={inp} rows={2} value={currentProblems} onChange={(e) => setCurrentProblems(e.target.value)} required />
          </label>
          <label className="block text-xs font-medium">
            Requirements
            <textarea className={inp} rows={2} value={requirements} onChange={(e) => setRequirements(e.target.value)} required />
          </label>
          {tier === "pro" ? (
            <>
              <label className="block text-xs font-medium">
                WhatsApp number
                <input className={inp} value={whatsApp} onChange={(e) => setWhatsApp(e.target.value)} required inputMode="tel" />
              </label>
              <label className="block text-xs font-medium">
                Social channels
                <textarea className={inp} rows={2} value={socialChannels} onChange={(e) => setSocialChannels(e.target.value)} required />
              </label>
              <label className="block text-xs font-medium">
                Automation needs
                <textarea className={inp} rows={2} value={automationNeeds} onChange={(e) => setAutomationNeeds(e.target.value)} required />
              </label>
            </>
          ) : null}
          {tier === "enterprise" ? (
            <>
              <label className="block text-xs font-medium">
                Custom requirements
                <textarea className={inp} rows={2} value={customRequirements} onChange={(e) => setCustomRequirements(e.target.value)} required />
              </label>
              <label className="block text-xs font-medium">
                Multi-branch
                <textarea className={inp} rows={2} value={multiBranch} onChange={(e) => setMultiBranch(e.target.value)} required />
              </label>
              <label className="block text-xs font-medium">
                Integrations
                <textarea className={inp} rows={2} value={integrations} onChange={(e) => setIntegrations(e.target.value)} required />
              </label>
            </>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit for boss approval"}
          </button>
        </form>
      </div>
    </div>
  );
}
