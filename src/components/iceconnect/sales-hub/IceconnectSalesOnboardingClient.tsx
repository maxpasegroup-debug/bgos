"use client";

import { IceconnectMetroStage } from "@prisma/client";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
import { isDemoOrBeyond } from "@/lib/iceconnect-sales-hub";
import { dashboardLibrary } from "@/lib/nexa-onboarding-engine";

type OnboardingRow = {
  id: string;
  status: "IN_PROGRESS" | "COMPLETED" | string;
  createdAt: string;
  lead: { id: string; name: string; phone: string; iceconnectMetroStage: IceconnectMetroStage | null };
  company: { id: string; name: string } | null;
  meta?: {
    team?: Array<{ name: string; role: string; status?: string; mappedDashboard?: string | null }>;
  };
};

type LeadPick = {
  id: string;
  name: string;
  phone: string;
  iceconnectMetroStage: IceconnectMetroStage;
};

type ChatMessage = {
  id: string;
  role: "nexa" | "user";
  text: string;
  quickReplies?: string[];
};
type NexaMode = "Neutral" | "Guiding" | "Motivating" | "Conversion";

type TeamRow = { name: string; role: string };
type CredentialRow = { name: string; role: string; email: string; password: string; loginUrl: string };
type UpgradePayload = { message: string; plans: { id: string; label: string; note: string }[]; ctaHref: string };
type Architecture = {
  availableDashboards: string[];
  inDevelopmentDashboards: string[];
  team: Array<{ name: string; role: string; mappedDashboard: string | null; status: string }>;
  bossDashboard: string[];
};

type Stage =
  | "greeting"
  | "select_lead"
  | "industry"
  | "operations"
  | "team"
  | "summary"
  | "post_launch";

const OP_CHIPS = ["Lead handling", "Installation", "Payments", "Service", "Team reporting"];

export function IceconnectSalesOnboardingClient() {
  const router = useRouter();
  const { ready } = useCompanyBranding();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [items, setItems] = useState<OnboardingRow[]>([]);
  const [leads, setLeads] = useState<LeadPick[]>([]);
  const [employeeName, setEmployeeName] = useState("there");
  const [employeeRole, setEmployeeRole] = useState("SALES_EXECUTIVE");
  const [activeCompany, setActiveCompany] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>("greeting");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [onboardingId, setOnboardingId] = useState<string | null>(null);

  const [leadId, setLeadId] = useState("");
  const [industry, setIndustry] = useState<"SOLAR" | "EDUCATION" | "HEALTHCARE" | "OTHER">("SOLAR");
  const [customIndustry, setCustomIndustry] = useState("");
  const [operations, setOperations] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [requiredDashboards, setRequiredDashboards] = useState<string[]>([]);
  const [architecture, setArchitecture] = useState<Architecture | null>(null);
  const [result, setResult] = useState<{ credentials: CredentialRow[]; upgrade: UpgradePayload } | null>(null);

  const eligibleLeads = useMemo(() => leads.filter((l) => isDemoOrBeyond(l.iceconnectMetroStage)), [leads]);
  const selectedLead = useMemo(() => leads.find((l) => l.id === leadId) ?? null, [leads, leadId]);
  const currentPrompt = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((m) => m.role === "nexa") ?? {
        id: "prompt-fallback",
        role: "nexa" as const,
        text: "Let's build your company.",
      },
    [messages],
  );
  const floatingActive = Boolean(result);

  function pushNexa(text: string, quickReplies?: string[], mode: NexaMode = "Neutral") {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}`, role: "nexa", text: `${mode}: ${text}`, quickReplies },
    ]);
  }
  function pushUser(text: string) {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, role: "user", text }]);
  }

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [oRes, lRes, meRes, coRes] = await Promise.all([
        apiFetch("/api/iceconnect/onboarding", { credentials: "include" }),
        apiFetch("/api/iceconnect/executive/leads?statusFilter=active&range=all", { credentials: "include" }),
        apiFetch("/api/auth/me", { credentials: "include" }),
        apiFetch("/api/company/current", { credentials: "include" }),
      ]);
      const oj = ((await readApiJson(oRes, "ice/onboarding")) ?? {}) as {
        ok?: boolean;
        items?: OnboardingRow[];
        error?: string;
        code?: string;
      };
      if (oRes.status === 403 && oj.code === "NOT_INTERNAL_SALES_ORG") {
        router.replace("/iceconnect/internal-sales");
        return;
      }
      if (!oRes.ok || oj.ok !== true) throw new Error(oj.error || "Could not load onboarding");
      setItems(Array.isArray(oj.items) ? oj.items : []);

      const lj = (await lRes.json()) as {
        ok?: boolean;
        leads?: { id: string; name: string; phone: string; iceconnectMetroStage?: IceconnectMetroStage }[];
        error?: string;
        code?: string;
      };
      if (lRes.status === 403 && lj.code === "NOT_INTERNAL_SALES_ORG") {
        router.replace("/iceconnect/internal-sales");
        return;
      }
      if (!lRes.ok || !lj.ok) throw new Error(lj.error || "Could not load leads");
      setLeads(
        (lj.leads ?? []).map((x) => ({
          id: x.id,
          name: x.name,
          phone: x.phone,
          iceconnectMetroStage: x.iceconnectMetroStage ?? IceconnectMetroStage.LEAD_CREATED,
        })),
      );

      const mej = ((await readApiJson(meRes, "auth/me-onb")) ?? {}) as {
        ok?: boolean;
        user?: { name?: string | null; email?: string; role?: string };
      };
      if (meRes.ok && mej.ok === true) {
        const n = mej.user?.name?.trim();
        const e = mej.user?.email?.split("@")[0]?.trim();
        setEmployeeName(n || e || "there");
        setEmployeeRole(mej.user?.role || "SALES_EXECUTIVE");
      }
      const cj = ((await readApiJson(coRes, "company/current-onb")) ?? {}) as {
        ok?: boolean;
        company?: { name?: string };
      };
      if (coRes.ok && cj.ok === true) {
        setActiveCompany(cj.company?.name ?? null);
      }
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not load onboarding workspace"));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function saveSession(status: "draft" | "in_progress" | "ready" | "launched" = "in_progress") {
    if (!leadId) return;
    const res = await apiFetch("/api/iceconnect/onboarding/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId ?? undefined,
        leadId,
        companyName,
        industry: industry === "OTHER" ? customIndustry : industry,
        status,
        data: {
          employeeName,
          employeeRole,
          company: activeCompany,
          leadId,
          operations,
          requiredDashboards,
          team,
          location,
        },
      }),
    });
    const j = ((await readApiJson(res, "save-session")) ?? {}) as { ok?: boolean; sessionId?: string };
    if (res.ok && j.ok === true && j.sessionId) setSessionId(j.sessionId);
  }

  function resetConversation() {
    setMessages([]);
    setInput("");
    setStage("greeting");
    setSessionId(null);
    setOnboardingId(null);
    setLeadId("");
    setIndustry("SOLAR");
    setCustomIndustry("");
    setOperations([]);
    setCompanyName("");
    setLocation("");
    setTeam([]);
    setRequiredDashboards([]);
    setArchitecture(null);
    setResult(null);
  }

  async function startOnboarding() {
    setErr(null);
    resetConversation();
    try {
      const res = await apiFetch("/api/nexa/onboarding/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "SALES", leadId: leadId || undefined }),
      });
      const j = ((await readApiJson(res, "nexa/onboarding/start")) ?? {}) as {
        ok?: boolean;
        sessionId?: string;
        intro?: string;
      };
      if (!res.ok || j.ok !== true) throw new Error("Could not start onboarding");
      if (j.sessionId) setSessionId(j.sessionId);
      setModalOpen(true);
      pushNexa(j.intro ?? "Let's onboard this client.", ["Continue"], "Guiding");
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not start Nexa onboarding"));
    }
  }

  async function mapDashboards(ops: string[]) {
    const lower = ops.map((x) => x.toLowerCase());
    const set = new Set<string>();
    for (const op of lower) {
      for (const row of dashboardLibrary) {
        if (row.keywords.some((k) => op.includes(k))) set.add(`${row.role} Team Dashboard`);
      }
    }
    if (set.size === 0) set.add("Manager Dashboard");
    const list = [...set];
    setRequiredDashboards(list);
    await saveSession("in_progress");
    pushNexa(
      `Dashboards selected: ${list.join(", ")}.`,
      ["Build team"],
      "Guiding",
    );
  }

  async function ensureOnboardingRecord(): Promise<string> {
    if (!leadId) throw new Error("Pick lead first");
    const res = await apiFetch("/api/iceconnect/onboarding", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId }),
    });
    const j = ((await readApiJson(res, "onboarding/create")) ?? {}) as {
      ok?: boolean;
      id?: string;
      error?: string;
    };
    if (!res.ok || j.ok !== true || !j.id) throw new Error(j.error || "Could not start onboarding");
    setOnboardingId(j.id);
    await saveSession("in_progress");
    return j.id;
  }

  async function buildSummary() {
    const parsed = team
      .map((r) => {
        const key = r.role.toLowerCase();
        const match = dashboardLibrary.find(
          (x) => key.includes(x.role.toLowerCase()) || x.keywords.some((k) => key.includes(k)),
        );
        return {
          name: r.name,
          role: r.role,
          mappedDashboard: match ? `${match.role} Dashboard` : null,
          status: match ? "READY" : "PENDING_BUILD",
        };
      })
      .filter((r) => r.name.trim() && r.role.trim());
    const available = new Set<string>(requiredDashboards);
    const inDevelopment = new Set<string>();
    for (const p of parsed) {
      if (p.mappedDashboard) available.add(p.mappedDashboard);
      else inDevelopment.add(p.role);
    }
    const arch: Architecture = {
      availableDashboards: [...available],
      inDevelopmentDashboards: [...inDevelopment],
      team: parsed,
      bossDashboard: ["Leads", "Revenue", "Team overview"],
    };
    setArchitecture(arch);
    setStage("summary");
    await saveSession("ready");
    pushNexa("Review structure. Choose next action.", ["Yes, create company", "Edit"], "Guiding");
  }

  async function deployCompany() {
    const currentOnboardingId = onboardingId ?? (await ensureOnboardingRecord());
    if (!currentOnboardingId) return;
    setBusy("deploy");
    try {
      const res = await apiFetch(`/api/iceconnect/onboarding/${currentOnboardingId}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          companyName,
          location,
          industry: industry === "OTHER" ? "CUSTOM" : industry,
          customIndustryLabel: industry === "OTHER" ? customIndustry : undefined,
          operations,
          team,
        }),
      });
      const j = ((await readApiJson(res, "onboarding/submit")) ?? {}) as {
        ok?: boolean;
        credentials?: CredentialRow[];
        upgrade?: UpgradePayload;
        error?: string;
      };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Launch failed");
      setResult({
        credentials: Array.isArray(j.credentials) ? j.credentials : [],
        upgrade: j.upgrade ?? {
          message: "Upgrade to PRO to unlock full automation.",
          plans: [],
          ctaHref: "/iceconnect/wallet",
        },
      });
      setStage("post_launch");
      await saveSession("launched");
      await load();
      pushNexa("Company is live. Start team login now.", ["Open customers"], "Motivating");
    } catch (e) {
      setErr(formatFetchFailure(e, "Could not complete onboarding"));
    } finally {
      setBusy(null);
    }
  }

  async function onQuickReply(choice: string) {
    pushUser(choice);
    if (stage === "greeting") {
      setStage("select_lead");
      pushNexa("Select one lead to start.", eligibleLeads.map((x) => `${x.name} (${x.phone})`), "Guiding");
      return;
    }
    if (stage === "industry") {
      if (choice === "Other") {
        setIndustry("OTHER");
        pushNexa("Type business type.", undefined, "Guiding");
      } else {
        setIndustry(choice.toUpperCase() as "SOLAR" | "EDUCATION" | "HEALTHCARE");
        await saveSession("in_progress");
        setStage("operations");
        pushNexa("Choose daily operations.", OP_CHIPS, "Guiding");
      }
      return;
    }
    if (stage === "operations") {
      if (!operations.includes(choice)) setOperations((prev) => [...prev, choice]);
      return;
    }
    if (stage === "summary") {
      if (choice.startsWith("Yes")) {
        await deployCompany();
      } else {
        setStage("team");
        pushNexa("Update details. Rebuild summary.", undefined, "Guiding");
      }
    }
  }

  async function onInputSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    pushUser(text);

    if (stage === "select_lead") {
      const found = eligibleLeads.find(
        (l) =>
          text.toLowerCase().includes(l.phone.toLowerCase()) || text.toLowerCase().includes(l.name.toLowerCase()),
      );
      if (!found) {
        pushNexa("Lead not matched. Pick from list.", undefined, "Guiding");
        return;
      }
      setLeadId(found.id);
      try {
        await ensureOnboardingRecord();
      } catch (e) {
        setErr(formatFetchFailure(e, "Could not start onboarding record"));
        return;
      }
      setStage("industry");
      pushNexa("Select business type.", ["Solar", "Education", "Healthcare", "Other"], "Guiding");
      return;
    }

    if (stage === "industry" && industry === "OTHER") {
      setCustomIndustry(text);
      await saveSession("in_progress");
      setStage("operations");
      pushNexa("Choose daily operations.", OP_CHIPS, "Guiding");
      return;
    }

    if (stage === "operations") {
      const ops = text
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const all = [...new Set([...operations, ...ops])];
      setOperations(all);
      await mapDashboards(all);
      setStage("team");
      pushNexa("Add team in this format: Rahul - Sales", undefined, "Guiding");
      return;
    }

    if (stage === "team") {
      const rows = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [namePart, rolePart] = line.split("-").map((x) => x.trim());
          return { name: namePart ?? "", role: rolePart ?? "Staff" };
        })
        .filter((r) => r.name);
      if (rows.length === 0) {
        pushNexa("Add at least one team member.", undefined, "Guiding");
        return;
      }
      setTeam(rows);
      await saveSession("in_progress");
      pushNexa("Set company name.", undefined, "Guiding");
      setStage("summary");
      if (!companyName.trim()) {
        setCompanyName(selectedLead?.name ? `${selectedLead.name} Ventures` : "");
      }
      await buildSummary();
      return;
    }
  }

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
          <p className="mt-1 text-sm text-gray-500">Nexa Virtual CEO onboarding.</p>
        </div>
        <button
          type="button"
          onClick={() => void startOnboarding()}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(15,23,42,0.22)] transition hover:bg-black"
        >
          Start Onboarding
        </button>
      </div>

      {err ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div> : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">Onboarding records</p>
          <button type="button" className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="mt-3 text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No onboarding runs yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {items.map((it) => (
              <li key={it.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{it.lead.name}</p>
                    <p className="text-xs text-gray-600">{it.lead.phone}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      it.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {it.status === "COMPLETED" ? "Completed" : "In Progress"}
                  </span>
                </div>
                {Array.isArray(it.meta?.team) && it.meta?.team?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {it.meta.team.map((t, idx) => (
                      <span
                        key={`${it.id}-${idx}`}
                        className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700"
                      >
                        {t.name}: {statusIcon(t.status)} {t.status ?? "READY"}
                      </span>
                    ))}
                  </div>
                ) : null}
                {it.company ? (
                  <p className="mt-1 text-xs text-gray-600">
                    Company:{" "}
                    <Link className="font-semibold text-indigo-700 hover:underline" href="/iceconnect/customers">
                      {it.company.name}
                    </Link>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            className="fixed inset-0 z-50 bg-[#06080f]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="relative mx-auto flex h-screen w-full max-w-7xl flex-col overflow-hidden px-5 pb-6 pt-5 sm:px-8">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">Nexa OS</p>
                <button
                  type="button"
                  className="rounded-full border border-white/20 bg-white/[0.05] px-4 py-1.5 text-xs text-white/80 backdrop-blur"
                  onClick={() => setModalOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[1.2fr_1fr]">
                <section className="relative flex min-h-0 flex-col rounded-[30px] border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6 shadow-[0_20px_80px_rgba(3,7,18,0.45)]">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(110,231,255,0.12),transparent_62%)]" />
                  <div className="relative flex h-full flex-col items-center justify-center text-center">
                    <motion.div
                      className="mb-6 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_35%_30%,#baf5ff_0%,#5bc7ff_35%,#4f46e5_75%,#0f172a_100%)] shadow-[0_0_70px_rgba(96,165,250,0.35)]"
                      animate={{ scale: [1, 1.06, 1], opacity: [0.92, 1, 0.92] }}
                      transition={{ duration: 4.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                    />
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-cyan-200/80">Nexa Virtual CEO</p>
                    <h2 className="max-w-2xl whitespace-pre-wrap text-2xl font-medium leading-tight text-white sm:text-3xl">
                      {currentPrompt.text}
                    </h2>

                    <div className="mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-2.5">
                      {currentPrompt.quickReplies?.map((q) => (
                        <button
                          key={`${currentPrompt.id}-${q}`}
                          type="button"
                          className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/90 backdrop-blur transition hover:bg-white/[0.14]"
                          onClick={() => void onQuickReply(q)}
                        >
                          {q}
                        </button>
                      ))}
                      {stage === "select_lead" ? (
                        <select
                          value={leadId}
                          onChange={(e) => setLeadId(e.target.value)}
                          className="rounded-full border border-white/20 bg-white/[0.08] px-4 py-2 text-sm text-white outline-none backdrop-blur"
                        >
                          <option value="" className="text-black">Select lead</option>
                          {eligibleLeads.map((l) => (
                            <option key={l.id} value={l.id} className="text-black">
                              {l.name} ({l.phone})
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>

                    <form onSubmit={(e) => void onInputSubmit(e)} className="mt-8 flex w-full max-w-2xl gap-2.5">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type one clear response..."
                        className="w-full rounded-2xl border border-white/15 bg-black/35 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-cyan-100"
                      >
                        Continue
                      </button>
                    </form>
                  </div>
                </section>

                <aside className="min-h-0 space-y-4 overflow-y-auto rounded-[30px] border border-white/10 bg-white/[0.03] p-5 text-white/90 shadow-[0_20px_70px_rgba(3,7,18,0.35)]">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">Live Structure</p>
                    <p className="mt-2 text-sm">Lead: {selectedLead?.name || "Not selected"}</p>
                    <p className="text-sm">Industry: {industry === "OTHER" ? customIndustry || "Other" : industry}</p>
                    <p className="text-sm">Operations: {operations.length ? operations.join(", ") : "—"}</p>
                  </div>

                  <motion.div layout className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">Team Builder</p>
                    <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3">
                      <p className="text-xs text-emerald-100/85">Founder</p>
                      <p className="text-sm font-semibold text-emerald-100">{employeeName}</p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <AnimatePresence>
                        {team.map((t, i) => (
                          <motion.div
                            key={`${t.name}-${t.role}-${i}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="rounded-xl border border-white/10 bg-white/[0.05] p-3"
                          >
                            <p className="text-sm font-semibold">{t.name}</p>
                            <p className="text-xs text-white/70">{t.role}</p>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">Details</p>
                    <div className="mt-3 grid gap-2">
                      <input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company name"
                        className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none"
                      />
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Location"
                        className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void mapDashboards(operations)}
                        className="rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs"
                      >
                        Refresh dashboard mapping
                      </button>
                      <button
                        type="button"
                        onClick={() => void buildSummary()}
                        className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-xs"
                      >
                        Generate architecture summary
                      </button>
                    </div>
                  </div>

                  {stage === "summary" && architecture ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">Summary</p>
                      <div className="mt-3 space-y-3 text-sm">
                        <div>
                          <p className="font-semibold text-white">Dashboards</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {architecture.availableDashboards.map((d) => (
                              <span key={d} className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs text-emerald-100">
                                🟢 {d}
                              </span>
                            ))}
                            {architecture.inDevelopmentDashboards.map((d) => (
                              <span key={d} className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs text-amber-100">
                                ⚠ {d}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold text-white">Team Status</p>
                          <ul className="mt-1 space-y-1 text-xs text-white/80">
                            {architecture.team.map((t, i) => (
                              <li key={`${t.name}-${i}`}>
                                {statusIcon(t.status)} {t.name} - {t.mappedDashboard ?? `${t.role} (Pending)`}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void onQuickReply("Yes, create company")}
                            disabled={busy === "deploy"}
                            className="rounded-xl bg-emerald-300 px-3 py-2 text-xs font-semibold text-black disabled:opacity-60"
                          >
                            {busy === "deploy" ? "Launching..." : "Launch Company"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onQuickReply("Edit")}
                            className="rounded-xl border border-white/20 px-3 py-2 text-xs"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}

                  {stage === "post_launch" && result ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4"
                    >
                    <p className="text-sm font-semibold text-emerald-100">Company is ready 🎉</p>
                      <p className="mt-1 text-xs text-emerald-50/90">
                        Your system is live. Ask your team to login now and assign first tasks.
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-emerald-50/90">
                        {result.credentials.map((c) => (
                          <li key={c.email}>
                            {c.name} ({c.role}) - {c.email}
                          </li>
                        ))}
                      </ul>
                      <Link
                        href={result.upgrade.ctaHref}
                        className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                      >
                        Activate PRO
                      </Link>
                    </motion.div>
                  ) : null}
                </aside>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {floatingActive ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            onClick={() => setModalOpen(true)}
            className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 shadow-[0_12px_35px_rgba(2,6,23,0.2)] backdrop-blur"
          >
            <span className="inline-block h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.9)]" />
            Nexa CEO
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function statusIcon(status?: string | null) {
  if (status === "READY" || status === "LIVE") return "🟢";
  if (status === "IN_PROGRESS") return "🟡";
  if (status === "PENDING_BUILD") return "⚠";
  return "🔵";
}
