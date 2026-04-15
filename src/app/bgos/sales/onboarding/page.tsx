"use client";

import { useMemo, useState } from "react";
import Script from "next/script";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";

type ParsedMember = {
  name: string;
  roleRaw: string;
  department: "SALES" | "ADMIN" | "TECH" | "OTHER";
  dashboard?: "SALES_DASHBOARD" | "ADMIN_DASHBOARD" | "TECH_DASHBOARD" | "GENERAL_DASHBOARD";
  userRole: string;
  email?: string;
};

type RazorpayInstance = {
  open: () => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export default function SalesOnboardingPage() {
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState<"SOLAR" | "CUSTOM">("SOLAR");
  const [teamInput, setTeamInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [parsedTeam, setParsedTeam] = useState<ParsedMember[]>([]);
  const [unknownRoles, setUnknownRoles] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [referralPhone, setReferralPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [customBusinessType, setCustomBusinessType] = useState("");
  const [customDepartments, setCustomDepartments] = useState("");
  const [customWorkflow, setCustomWorkflow] = useState("");
  const [customPlan, setCustomPlan] = useState<"basic" | "pro" | "enterprise">("pro");
  const [customOrder, setCustomOrder] = useState<{ order_id: string; amount: number; currency: string } | null>(null);
  const [result, setResult] = useState<{
    companyId: string;
    credentials: { name: string; role: string; email: string; password: string; loginUrl: string }[];
    credentialsFile?: { filename: string; base64: string; mimeType: string };
  } | null>(null);

  const readyToLaunch = companyName.trim() && parsedTeam.length > 0;
  const readyCustom =
    companyName.trim() &&
    customBusinessType.trim() &&
    customDepartments.trim() &&
    customWorkflow.trim();

  async function startSession() {
    setError(null);
    const res = await apiFetch("/api/onboarding/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, industry }),
    });
    const j = ((await readApiJson(res, "onboarding/start")) ?? {}) as {
      ok?: boolean;
      error?: string;
      sessionId?: string;
    };
    if (!res.ok || j.ok !== true || !j.sessionId) {
      setError(j.error || "Could not start onboarding session.");
      return;
    }
    setSessionId(j.sessionId);
  }

  async function parseTeam() {
    try {
      setError(null);
      if (!sessionId) await startSession();
      const sid = sessionId;
      if (!sid) return;
      const res = await apiFetch("/api/onboarding/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, rawTeamInput: teamInput }),
      });
      const j = ((await readApiJson(res, "onboarding/parse")) ?? {}) as {
        ok?: boolean;
        error?: string;
        parsedTeam?: ParsedMember[];
        unknownRoles?: string[];
        suggestions?: string[];
        aiSummary?: string;
      };
      if (!res.ok || j.ok !== true) {
        setError(j.error || "Could not parse team.");
        return;
      }
      setParsedTeam(Array.isArray(j.parsedTeam) ? j.parsedTeam : []);
      setUnknownRoles(Array.isArray(j.unknownRoles) ? j.unknownRoles : []);
      setSuggestions(Array.isArray(j.suggestions) ? j.suggestions : []);
      setAiSummary(typeof j.aiSummary === "string" ? j.aiSummary : "");
    } catch (e) {
      setError(formatFetchFailure(e, "Could not parse team"));
    }
  }

  async function sendUnknownRolesToTech() {
    for (const roleName of unknownRoles) {
      await apiFetch("/api/tech/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleName,
          description: `Unknown role from launch: ${roleName}`,
        }),
      }).catch(() => undefined);
    }
  }

  async function launchCompany() {
    try {
      setError(null);
      const res = await apiFetch("/api/onboarding/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "NEXA_ENGINE",
          sessionId,
          companyName,
          industry,
          parsedTeam,
          referralPhone: referralPhone.trim() || undefined,
        }),
      });
      const j = ((await readApiJson(res, "onboarding/launch")) ?? {}) as {
        ok?: boolean;
        success?: boolean;
        error?: string;
        companyId?: string;
        employeesCreated?: number;
        dashboardsAssigned?: string[];
        credentials?: { name: string; role: string; email: string; password: string; loginUrl: string }[];
        credentialsFile?: { filename: string; base64: string; mimeType: string };
      };
      if (!res.ok || j.ok !== true || j.success !== true || !j.companyId) {
        setError(j.error || "Launch failed.");
        return;
      }
      setResult({
        companyId: j.companyId,
        credentials: Array.isArray(j.credentials) ? j.credentials : [],
        credentialsFile: j.credentialsFile,
      });
    } catch (e) {
      setError(formatFetchFailure(e, "Could not launch company"));
    }
  }

  async function startCustomOnboarding() {
    try {
      setError(null);
      const res = await apiFetch("/api/onboarding/custom/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          plan: customPlan,
          businessType: customBusinessType,
          departments: customDepartments,
          workflow: customWorkflow,
          teamRaw: teamInput,
        }),
      });
      const j = ((await readApiJson(res, "onboarding/custom/start")) ?? {}) as {
        ok?: boolean;
        error?: string;
        order?: { order_id: string; amount: number; currency: string };
      };
      if (!res.ok || j.ok !== true || !j.order) {
        setError(j.error || "Could not start custom onboarding");
        return;
      }
      setCustomOrder(j.order);
    } catch (e) {
      setError(formatFetchFailure(e, "Could not start custom onboarding"));
    }
  }

  async function openCustomPayment() {
    try {
      if (!customOrder) {
        setError("Create payment order first.");
        return;
      }
      if (!window.Razorpay) {
        setError("Razorpay SDK not loaded.");
        return;
      }
      const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!key) {
        setError("NEXT_PUBLIC_RAZORPAY_KEY_ID is missing.");
        return;
      }
      const rz = new window.Razorpay({
        key,
        order_id: customOrder.order_id,
        amount: customOrder.amount,
        currency: customOrder.currency,
        name: "BGOS Custom Onboarding",
        description: `Onboarding payment for ${companyName}`,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await apiFetch("/api/payment/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const verifyJson = ((await readApiJson(verifyRes, "payment/verify")) ?? {}) as {
            ok?: boolean;
            error?: string;
            applied?: boolean;
          };
          if (!verifyRes.ok || verifyJson.ok !== true) {
            setError(verifyJson.error || "Payment verification failed.");
            return;
          }
          setError(null);
          setResult({
            companyId: "CUSTOM_PENDING_TECH",
            credentials: [],
          });
        },
      });
      rz.open();
    } catch (e) {
      setError(formatFetchFailure(e, "Could not start Razorpay checkout"));
    }
  }

  const groupedSummary = useMemo(() => {
    return parsedTeam.reduce<Record<string, number>>((acc, row) => {
      acc[row.department] = (acc[row.department] || 0) + 1;
      return acc;
    }, {});
  }, [parsedTeam]);

  function downloadExcel() {
    if (!result?.credentialsFile) return;
    const bytes = atob(result.credentialsFile.base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: result.credentialsFile.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.credentialsFile.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-16 pt-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h1 className="text-2xl font-semibold text-white">Nexa Company Launch Engine</h1>
        <p className="mt-1 text-sm text-white/70">Launch a new company in minutes.</p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-2">
        <label className="text-sm text-white/80">
          Company name
          <input
            className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </label>
        <label className="text-sm text-white/80">
          Industry
          <select
            className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2"
            value={industry}
            onChange={(e) => setIndustry(e.target.value as "SOLAR" | "CUSTOM")}
          >
            <option value="SOLAR">Solar</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </label>
      </div>

      {industry === "SOLAR" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-medium text-white">Team input (single message)</p>
          <textarea
            className="mt-2 h-28 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            placeholder="Rahul - Sales Manager, Anu - Admin"
            value={teamInput}
            onChange={(e) => setTeamInput(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-black" onClick={() => void parseTeam()}>
              Parse team
            </button>
            {unknownRoles.length > 0 ? (
              <button className="rounded-md border border-cyan-500/50 px-3 py-2 text-sm" onClick={() => void sendUnknownRolesToTech()}>
                Send unknown roles to Tech
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <p className="text-sm font-medium text-white">Custom business details</p>
          <input
            className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            placeholder="Business type (e.g. Manufacturing CRM)"
            value={customBusinessType}
            onChange={(e) => setCustomBusinessType(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            placeholder="Departments (e.g. Sales, Ops, Accounts)"
            value={customDepartments}
            onChange={(e) => setCustomDepartments(e.target.value)}
          />
          <textarea
            className="h-24 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            placeholder="Describe workflow requirements"
            value={customWorkflow}
            onChange={(e) => setCustomWorkflow(e.target.value)}
          />
          <select
            className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm"
            value={customPlan}
            onChange={(e) => setCustomPlan(e.target.value as "basic" | "pro" | "enterprise")}
          >
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button
            disabled={!readyCustom}
            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            onClick={() => void startCustomOnboarding()}
          >
            Continue to Payment
          </button>
          {customOrder ? (
            <div className="rounded-md border border-amber-300/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              Razorpay order created: <span className="font-semibold">{customOrder.order_id}</span>
              <br />
              Amount: {(customOrder.amount / 100).toFixed(2)} {customOrder.currency}
              <br />
              Complete payment now to create the tech execution request.
              <div className="mt-2">
                <button className="rounded-md bg-white px-3 py-1.5 text-black" onClick={() => void openCustomPayment()}>
                  Pay with Razorpay
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {industry === "SOLAR" && parsedTeam.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold text-white">Parsed Summary</h2>
          <p className="mt-1 text-xs text-white/70">
            SALES: {groupedSummary.SALES || 0} · ADMIN: {groupedSummary.ADMIN || 0} · TECH: {groupedSummary.TECH || 0} · OTHER: {groupedSummary.OTHER || 0}
          </p>
          {suggestions.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-xs text-cyan-200">
              {suggestions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : null}
          {unknownRoles.length > 0 ? (
            <p className="mt-2 text-xs text-amber-300">Unknown roles: {unknownRoles.join(", ")}</p>
          ) : null}
          {aiSummary ? (
            <div className="mt-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
              <p className="font-semibold">Here is what Nexa understood</p>
              <p className="mt-1 whitespace-pre-wrap">{aiSummary}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {industry === "SOLAR" ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <label className="text-sm text-white/80">
            Referral phone (optional)
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2"
              value={referralPhone}
              onChange={(e) => setReferralPhone(e.target.value)}
            />
          </label>
          <button
            disabled={!readyToLaunch}
            className="mt-3 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            onClick={() => void launchCompany()}
          >
            🚀 Launch Company
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-amber-300">{error}</p> : null}

      {result ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
          <p className="text-sm font-semibold text-emerald-200">✅ Company is ready</p>
          <p className="mt-1 text-xs text-emerald-100/80">Company ID: {result.companyId}</p>
          <div className="mt-3 flex gap-2">
            <button className="rounded-md bg-white px-3 py-2 text-sm font-medium text-black" onClick={downloadExcel}>
              Download Excel
            </button>
            <a href="/bgos/dashboard" className="rounded-md border border-white/30 px-3 py-2 text-sm">
              Open Dashboard
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
