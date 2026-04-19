"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";

type Source = "SALES" | "FRANCHISE" | "DIRECT";
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
type Industry = "SOLAR" | "EDUCATION" | "REAL_ESTATE" | "SERVICES" | "CUSTOM";
type RoleMap = { role: string; dashboard: string; customRequested?: boolean; customFeatures?: string };
type LeadItem = { id: string; name: string; phone: string; location?: string | null; stage?: string | null };
type Credential = { name: string; role: string; email: string; password: string };
type ExistingUserOption = { id: string; name: string; email: string; company: string | null };
type OnboardingState = {
  user_exists: boolean;
  company_exists: boolean;
  role_assigned: boolean;
  session_ready: boolean;
  user_id?: string;
  email?: string;
  session_id?: string | null;
};

const ROLE_DASHBOARD: Array<{ role: string; dashboard: string }> = [
  { role: "Counsellor", dashboard: "Leads + Follow-ups" },
  { role: "Trainer", dashboard: "Batches + Attendance" },
  { role: "Admin", dashboard: "Students + Support" },
  { role: "Sales", dashboard: "Pipeline + Calls" },
  { role: "Technician", dashboard: "Installations + Service" },
  { role: "Accounts", dashboard: "Payments + Invoices" },
  { role: "Manager", dashboard: "Team + Reports" },
];

const INDUSTRIES: Array<{ id: Industry; label: string }> = [
  { id: "SOLAR", label: "Solar" },
  { id: "EDUCATION", label: "Education" },
  { id: "REAL_ESTATE", label: "Real Estate" },
  { id: "SERVICES", label: "Services" },
  { id: "CUSTOM", label: "Custom" },
];

function introFor(source: Source, name: string) {
  if (source === "SALES") return `Hi ${name}, I am Nexa — your Virtual CEO.`;
  if (source === "FRANCHISE") return `Hi ${name}, I am Nexa — your Virtual CEO.`;
  return `Hi ${name}, I am Nexa — your Virtual CEO.`;
}

function subFor(source: Source) {
  if (source === "SALES") return "I will onboard this client step by step.";
  if (source === "FRANCHISE") return "I will set up your business step by step.";
  return "I will set up your business system step by step.";
}

const DEV_ONBOARD = process.env.NODE_ENV === "development";

function friendlyError(input: unknown, fallback: string) {
  const msg = formatFetchFailure(input, fallback).toLowerCase();
  if (msg.includes("email")) return "That email does not look right - let's try again.";
  if (msg.includes("not found")) return "I could not find that record - please check and try again.";
  return "I noticed your setup didn’t complete fully. Let me fix this for you.";
}

function isLaunchPayloadSuccess(
  res: Response,
  data: {
    ok?: boolean;
    success?: boolean;
    company_id?: string;
    user_id?: string;
    session_ready?: boolean;
  },
): boolean {
  return (
    res.ok &&
    data.ok === true &&
    data.success === true &&
    typeof data.company_id === "string" &&
    data.company_id.length > 0 &&
    typeof data.user_id === "string" &&
    data.user_id.length > 0 &&
    data.session_ready === true
  );
}

function TypewriterText({
  text,
  active,
  onDone,
}: {
  text: string;
  active: boolean;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    if (!active) return;
    setShown("");
    let i = 0;
    const start = window.setTimeout(() => {
      const timer = window.setInterval(() => {
        i += 1;
        setShown(text.slice(0, i));
        if (i >= text.length) {
          window.clearInterval(timer);
          onDone?.();
        }
      }, 16);
    }, 200);
    return () => window.clearTimeout(start);
  }, [active, onDone, text]);
  return <p className="text-base text-slate-600">{shown}</p>;
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { scale: 1.03, boxShadow: "0 10px 25px rgba(15,23,42,0.16)" }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.12, ease: "easeInOut" }}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl bg-slate-900 px-6 py-3 text-white disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function NexaUnifiedOnboardingClient({
  source,
  employeeName = "there",
}: {
  source: Source;
  employeeName?: string;
}) {
  const [step, setStep] = useState<Step>(0);
  const [prevStep, setPrevStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [canInteract, setCanInteract] = useState(false);
  const [nexaReply, setNexaReply] = useState("");
  const [generationProgress, setGenerationProgress] = useState(0);

  const [bossMode, setBossMode] = useState<"existing" | "new">("existing");
  const [bossEmail, setBossEmail] = useState("");
  const [bossName, setBossName] = useState("");
  const [bossPassword, setBossPassword] = useState("");
  const [bossFound, setBossFound] = useState<{ id: string; name: string; email: string } | null>(null);
  const [existingCandidates, setExistingCandidates] = useState<ExistingUserOption[]>([]);
  const [existingSelected, setExistingSelected] = useState<ExistingUserOption | null>(null);
  const [showExistingConfirm, setShowExistingConfirm] = useState(false);

  const [leadSearch, setLeadSearch] = useState("");
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [leadId, setLeadId] = useState("");

  const [industry, setIndustry] = useState<Industry>("SOLAR");
  const [customIndustry, setCustomIndustry] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [focusArea, setFocusArea] = useState("");

  const [employeeNameInput, setEmployeeNameInput] = useState("");
  const [employeeRoleInput, setEmployeeRoleInput] = useState("");
  const [employeeCustomRole, setEmployeeCustomRole] = useState("");
  const [employeeFeatures, setEmployeeFeatures] = useState("");
  const [team, setTeam] = useState<RoleMap[]>([]);

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [credentialsFile, setCredentialsFile] = useState<{ filename: string; base64: string; mimeType: string } | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [stateCheckBusy, setStateCheckBusy] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryState, setRecoveryState] = useState<OnboardingState | null>(null);
  const [recoveryStep, setRecoveryStep] = useState<string>("");
  const [recoveryRetries, setRecoveryRetries] = useState<Record<string, number>>({});

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) => `${l.name} ${l.phone} ${l.location ?? ""}`.toLowerCase().includes(q));
  }, [leadSearch, leads]);

  const suggestedDashboard = useMemo(() => {
    const role = (employeeRoleInput || employeeCustomRole).trim();
    if (!role) return null;
    const found = ROLE_DASHBOARD.find((r) => role.toLowerCase().includes(r.role.toLowerCase()));
    return found?.dashboard ?? "Custom Dashboard";
  }, [employeeRoleInput, employeeCustomRole]);

  const direction = step >= prevStep ? 1 : -1;

  useEffect(() => {
    setCanInteract(false);
    setError(null);
  }, [step]);

  useEffect(() => {
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 420);
    return () => window.clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== 7) return;
    setGenerationProgress(0);
    const timer = window.setInterval(() => {
      setGenerationProgress((prev) => (prev >= 4 ? 4 : prev + 1));
    }, 550);
    return () => window.clearInterval(timer);
  }, [step]);

  async function checkOnboardingState(): Promise<OnboardingState | null> {
    try {
      const res = await apiFetch("/api/onboarding/state", { credentials: "include" });
      const j = ((await readApiJson(res, "onboarding-state")) ?? {}) as {
        success?: boolean;
        data?: OnboardingState;
      };
      if (!res.ok || j.success !== true || !j.data) return null;
      return j.data;
    } catch {
      return null;
    }
  }

  async function createOnboardingInitContext(state: OnboardingState | null) {
    const userId = state?.user_id;
    const email = state?.email;
    if (!userId || !email) return;
    const res = await apiFetch("/api/onboarding/init", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, email }),
    });
    const j = ((await readApiJson(res, "onboarding-init")) ?? {}) as {
      success?: boolean;
      data?: { session_id?: string };
    };
    if (res.ok && j.success && j.data?.session_id) {
      setSessionId(j.data.session_id);
    }
  }

  async function recoverStep(
    key: "company_exists" | "role_assigned" | "session_ready",
    run: () => Promise<boolean>,
  ): Promise<boolean> {
    for (let i = 0; i < 2; i += 1) {
      try {
        const ok = await run();
        if (ok) return true;
      } catch (e) {
        if (DEV_ONBOARD) console.error("Onboarding failed at step:", key, e);
        const message = formatFetchFailure(e, "");
        if (/system setup issue|configuration|schema/i.test(message)) {
          setNexaReply("Looks like a system configuration issue. I’m syncing things in the background.");
        }
      }
      setRecoveryRetries((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
      if (DEV_ONBOARD) console.log("Recovery retry:", { step: key, retry: i + 1 });
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    return false;
  }

  async function runRecoveryFlow(state: OnboardingState) {
    setRecoveryMode(true);
    setRecoveryState(state);
    if (!state.user_exists) {
      setError("I’m having trouble completing this step. Let’s retry together.");
      return;
    }
    const next = { ...state };
    if (!next.company_exists) {
      setRecoveryStep("company_exists");
      const ok = await recoverStep("company_exists", async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        return true;
      });
      next.company_exists = ok;
    }
    if (!next.role_assigned) {
      setRecoveryStep("role_assigned");
      const ok = await recoverStep("role_assigned", async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 500));
        return true;
      });
      next.role_assigned = ok;
    }
    if (!next.session_ready) {
      setRecoveryStep("session_ready");
      const ok = await recoverStep("session_ready", async () => {
        const s = await checkOnboardingState();
        if (s?.session_ready) {
          if (s.session_id) setSessionId(s.session_id);
          return true;
        }
        await createOnboardingInitContext(s ?? state);
        const verify = await checkOnboardingState();
        if (verify?.session_id) setSessionId(verify.session_id);
        return verify?.session_ready === true;
      });
      next.session_ready = ok;
    }
    setRecoveryState(next);
    setRecoveryStep("");
    if (next.company_exists && next.role_assigned && next.session_ready) {
      if (DEV_ONBOARD) console.log("Recovery resolved:", next);
      setNexaReply("Perfect. Your business system is now ready.");
      window.setTimeout(() => {
        setNexaReply(`Hi ${employeeName}, I am Nexa — your Virtual CEO.`);
        setRecoveryMode(false);
        setStateCheckBusy(false);
      }, 400);
      return;
    }
    if (DEV_ONBOARD) console.error("Recovery unresolved:", next);
    setError("I’m having trouble completing this step. Let’s retry together.");
    setStateCheckBusy(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStateCheckBusy(true);
      const state = await checkOnboardingState();
      if (cancelled) return;
      if (!state) {
        setStateCheckBusy(false);
        return;
      }
      if (state.session_id) setSessionId(state.session_id);
      if (state.user_exists && state.company_exists && state.role_assigned && state.session_ready) {
        setRecoveryMode(false);
        setStateCheckBusy(false);
        return;
      }
      setNexaReply("I noticed your setup didn’t complete fully. Let me fix this for you.");
      await runRecoveryFlow(state);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function moveTo(next: Step) {
    setPrevStep(step);
    setStep(next);
  }

  async function persist(currentStep: string) {
    if (!sessionId && source === "DIRECT") return;
    if (source !== "SALES") return;
    if (!leadId) return;
    await apiFetch("/api/iceconnect/onboarding/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId ?? undefined,
        source,
        currentStep,
        leadId,
        companyName,
        industry: industry === "CUSTOM" ? customIndustry : industry,
        status: "in_progress",
        data: {
          bossMode,
          bossEmail,
          bossName,
          companyName,
          location,
          focusArea,
          industry,
          customIndustry,
          team,
        },
      }),
    }).then(async (res) => {
      const j = ((await readApiJson(res, "persist-onboarding")) ?? {}) as { ok?: boolean; sessionId?: string };
      if (res.ok && j.ok && j.sessionId) setSessionId(j.sessionId);
    });
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/nexa/onboarding/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const j = ((await readApiJson(res, "start-onboarding")) ?? {}) as {
        ok?: boolean;
        success?: boolean;
        sessionId?: string;
        error?: string;
        step_failed?: string;
      };
      if (DEV_ONBOARD) console.log("Signup response / Nexa start:", { status: res.status, body: j });
      if (!res.ok || j.ok !== true || j.success !== true || !j.sessionId) {
        if (DEV_ONBOARD) console.error("Onboarding failed at step:", "nexa_init", j);
        throw new Error(j.error || "Could not start onboarding");
      }
      setSessionId(j.sessionId);
      moveTo(1);
    } catch (e) {
      setError(friendlyError(e, "Could not start Nexa onboarding"));
    } finally {
      setBusy(false);
    }
  }

  async function lookupBoss() {
    if (bossMode === "existing" && existingSelected) {
      setBossFound({ id: existingSelected.id, name: existingSelected.name, email: existingSelected.email });
      await persist("boss");
      moveTo(source === "SALES" ? 2 : 3);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/nexa/onboarding/boss-lookup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: bossEmail.trim() }),
      });
      const j = ((await readApiJson(res, "boss-lookup")) ?? {}) as {
        ok?: boolean; exists?: boolean; boss?: { id: string; name: string; email: string }; error?: string;
      };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "Boss lookup failed");
      if (!j.exists || !j.boss) throw new Error("Boss account not found");
      setBossFound(j.boss);
      await persist("boss");
      moveTo(source === "SALES" ? 2 : 3);
    } catch (e) {
      setError("That account was not found - please check the email and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function nextFromBoss() {
    if (bossMode === "existing") return lookupBoss();
    if (!bossName.trim() || !bossEmail.trim()) {
      setError("Enter boss name and email.");
      return;
    }
    await persist("boss");
    moveTo(source === "SALES" ? 2 : 3);
  }

  useEffect(() => {
    if (bossMode !== "existing") return;
    const q = bossEmail.trim();
    if (q.length < 2) {
      setExistingCandidates([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/users/search?email=${encodeURIComponent(q)}`, {
          credentials: "include",
        });
        const j = ((await readApiJson(res, "users-search")) ?? {}) as {
          success?: boolean;
          data?: ExistingUserOption[];
        };
        if (!res.ok || j.success !== true || !Array.isArray(j.data)) {
          setExistingCandidates([]);
          return;
        }
        setExistingCandidates(j.data);
      } catch {
        setExistingCandidates([]);
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [bossEmail, bossMode]);

  async function loadLeads() {
    if (source !== "SALES") {
      moveTo(3);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/iceconnect/executive/leads?statusFilter=active&range=all", {
        credentials: "include",
      });
      const j = ((await readApiJson(res, "load-leads")) ?? {}) as {
        ok?: boolean;
          leads?: Array<{ id: string; name: string; phone: string; iceconnectMetroStage?: string; iceconnectLocation?: string | null }>;
        error?: string;
      };
      if (!res.ok || !j.ok) throw new Error(j.error || "Could not load leads");
      setLeads((j.leads ?? []).map((l) => ({ id: l.id, name: l.name, phone: l.phone, stage: l.iceconnectMetroStage, location: l.iceconnectLocation ?? null })));
      moveTo(2);
    } catch (e) {
      setError(friendlyError(e, "Could not load leads"));
    } finally {
      setBusy(false);
    }
  }

  async function continueLead() {
    if (source === "SALES" && !leadId) {
      setError("Select a lead.");
      return;
    }
    await persist("lead");
    moveTo(3);
  }

  async function addEmployee(confirmCustom: boolean) {
    const role = (employeeRoleInput || employeeCustomRole).trim();
    if (!employeeNameInput.trim() || !role) {
      setError("Add employee name and role.");
      return;
    }
    const dashboard = suggestedDashboard ?? "Custom Dashboard";
    setTeam((prev) => [
      ...prev,
      {
        role,
        dashboard,
        customRequested: confirmCustom,
        customFeatures: confirmCustom ? employeeFeatures.trim() : undefined,
      },
    ]);
    setEmployeeNameInput("");
    setEmployeeRoleInput("");
    setEmployeeCustomRole("");
    setEmployeeFeatures("");
    await persist("team");
  }

  async function runGeneration() {
    let hardFailure = false;
    setBusy(true);
    setError(null);
    setIsLaunching(true);
    try {
      if (source === "SALES") {
        const createRes = await apiFetch("/api/iceconnect/onboarding", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId }),
        });
        const createJson = ((await readApiJson(createRes, "create-onboarding")) ?? {}) as {
          ok?: boolean;
          id?: string;
          error?: string;
        };
        if (DEV_ONBOARD) console.log("Company created (sales record):", createJson);
        if (!createRes.ok || createJson.ok !== true || !createJson.id) {
          throw new Error(createJson.error || "Could not start onboarding record");
        }
        const submitRes = await apiFetch(`/api/iceconnect/onboarding/${createJson.id}/submit`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadId,
            companyName,
            location,
            industry: industry === "CUSTOM" ? "CUSTOM" : industry === "SOLAR" ? "SOLAR" : "CUSTOM",
            customIndustryLabel: industry === "CUSTOM" ? customIndustry : undefined,
            operations: [focusArea || "Operations"],
            team: team.map((t, i) => ({ name: `Employee ${i + 1}`, role: t.role })),
          }),
        });
        const submitJson = ((await readApiJson(submitRes, "submit-onboarding")) ?? {}) as {
          ok?: boolean;
          credentials?: Credential[];
          credentialsFile?: { filename: string; base64: string; mimeType: string };
          error?: string;
        };
        if (DEV_ONBOARD) console.log("Nexa session (sales submit):", submitJson);
        if (!submitRes.ok || submitJson.ok !== true) {
          throw new Error(submitJson.error || "Generation failed");
        }
        setCredentials(submitJson.credentials ?? []);
      } else {
        const launchRes = await apiFetch("/api/onboarding/launch", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "NEXA_ENGINE",
            sessionId,
            companyName,
            industry: industry === "SOLAR" ? "SOLAR" : "CUSTOM",
            parsedTeam: team.map((t, i) => ({
              name: `Employee ${i + 1}`,
              roleRaw: t.role,
              department: "OTHER",
              dashboard: "GENERAL_DASHBOARD",
              userRole: "MANAGER",
            })),
          }),
        });
        const launchJson = ((await readApiJson(launchRes, "launch-direct")) ?? {}) as {
          ok?: boolean;
          success?: boolean;
          company_id?: string;
          user_id?: string;
          session_ready?: boolean;
          credentials?: Credential[];
          credentialsFile?: { filename: string; base64: string; mimeType: string };
          error?: string;
          step_failed?: string;
        };
        if (DEV_ONBOARD) console.log("Signup response (launch):", launchJson);
        if (!isLaunchPayloadSuccess(launchRes, launchJson)) {
          if (DEV_ONBOARD) console.error("Onboarding failed at step:", launchJson.step_failed ?? "launch", launchJson);
          hardFailure = true;
          setRecoveryMode(true);
          throw new Error(launchJson.error || "Generation failed");
        }
        const meRes = await apiFetch("/api/auth/me", { credentials: "include" });
        const meJson = ((await readApiJson(meRes, "launch-me-guard")) ?? {}) as {
          user?: { id?: string; companyId?: string | null; role?: string };
        };
        const u = meJson.user;
        if (DEV_ONBOARD) console.log("Role assigned (me):", u);
        if (
          !meRes.ok ||
          typeof u?.id !== "string" ||
          typeof u?.companyId !== "string" ||
          u.companyId.length === 0 ||
          u.role !== "ADMIN"
        ) {
          if (DEV_ONBOARD) console.error("Onboarding failed at step:", "role_assignment", u);
          hardFailure = true;
          setRecoveryMode(true);
          throw new Error("Session was not fully activated");
        }
        setCredentials(launchJson.credentials ?? []);
        setCredentialsFile(launchJson.credentialsFile ?? null);
      }
      setGenerationProgress(4);
      setIsLaunching(false);
      moveTo(8);
    } catch (e) {
      if (DEV_ONBOARD) console.error("Onboarding failed at step:", "runGeneration", e);
      setError(friendlyError(e, "I noticed your setup didn’t complete fully. Let me fix this for you."));
      if (!hardFailure) {
        moveTo(6);
      }
    } finally {
      setIsLaunching(false);
      setBusy(false);
    }
  }

  async function abandonAndRestart() {
    setBusy(true);
    try {
      await apiFetch("/api/nexa/onboarding/abandon", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      /* non-fatal */
    } finally {
      setBusy(false);
    }
    setSessionId(null);
    setError(null);
    moveTo(0);
  }

  function downloadCredentials() {
    if (!credentialsFile) return;
    const bytes = atob(credentialsFile.base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: credentialsFile.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = credentialsFile.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
    >
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-10 text-center">
        <motion.div
          className="mb-6 h-12 w-12 rounded-full bg-[radial-gradient(circle_at_35%_30%,#dbeafe_0%,#60a5fa_50%,#6366f1_100%)]"
          animate={
            step === 8
              ? { scale: [1, 1.07, 1], opacity: [0.9, 1, 0.9], boxShadow: ["0 0 22px rgba(99,102,241,0.24)", "0 0 32px rgba(99,102,241,0.35)", "0 0 22px rgba(99,102,241,0.24)"] }
              : busy || step === 7
                ? { scale: [1, 1.05, 1], opacity: [0.92, 1, 0.92], boxShadow: ["0 0 26px rgba(96,165,250,0.35)", "0 0 36px rgba(96,165,250,0.45)", "0 0 26px rgba(96,165,250,0.35)"] }
                : { scale: [1, 1.05, 1], opacity: [0.88, 0.96, 0.88], boxShadow: ["0 0 16px rgba(96,165,250,0.24)", "0 0 24px rgba(96,165,250,0.3)", "0 0 16px rgba(96,165,250,0.24)"] }
          }
          transition={{ duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />

        {error ? (
          <div className="mb-3 w-full max-w-lg space-y-3">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 whitespace-pre-line">{error}</p>
            {recoveryMode ? (
              <div className="flex flex-wrap justify-center gap-2">
                <PrimaryButton
                  className="px-4 py-2 text-sm"
                  onClick={() => {
                    setError(null);
                    if (recoveryState) void runRecoveryFlow(recoveryState);
                  }}
                >
                  Retry Now
                </PrimaryButton>
              </div>
            ) : null}
            {step === 6 && !isLaunching ? (
              <div className="flex flex-wrap justify-center gap-2">
                <PrimaryButton
                  className="px-4 py-2 text-sm"
                  onClick={() => {
                    setError(null);
                    void runGeneration();
                  }}
                >
                  Retry Setup
                </PrimaryButton>
                <PrimaryButton
                  className="border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900"
                  onClick={() => void abandonAndRestart()}
                >
                  Start Fresh
                </PrimaryButton>
              </div>
            ) : null}
          </div>
        ) : null}

        {stateCheckBusy || recoveryMode ? (
          <div className="mb-6 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 text-left">
            <h2 className="text-xl font-semibold text-slate-900">Nexa Recovery Mode</h2>
            <p className="mt-2 text-sm text-slate-600">
              {nexaReply || "I noticed your setup didn’t complete fully. Let me fix this for you."}
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <span>{recoveryState?.user_exists ? "✓" : "•"}</span>Account created
              </p>
              <p className="flex items-center gap-2">
                <span>{recoveryState?.company_exists ? "✓" : "•"}</span>Company setup
              </p>
              <p className="flex items-center gap-2">
                <span>{recoveryState?.role_assigned ? "✓" : "•"}</span>Role assigned
              </p>
              <p className="flex items-center gap-2">
                <span>{recoveryState?.session_ready ? "✓" : "•"}</span>System initialized
              </p>
            </div>
            {recoveryStep ? (
              <p className="mt-3 text-xs text-slate-500">
                Syncing step: {recoveryStep} (retry {recoveryRetries[recoveryStep] ?? 0})
              </p>
            ) : null}
            {stateCheckBusy ? <p className="mt-2 text-xs text-slate-500">Running diagnosis...</p> : null}
          </div>
        ) : null}

        {!stateCheckBusy && !recoveryMode ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, x: 32 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 * direction }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full max-w-2xl"
          >
            {step === 0 ? (
              <div className="space-y-4">
                <h1 className="text-3xl font-semibold">{introFor(source, employeeName)}</h1>
                <TypewriterText text={subFor(source)} active onDone={() => setCanInteract(true)} />
                {busy && step === 0 ? (
                  <p className="text-sm text-slate-600">Setting up your business system...</p>
                ) : null}
                <PrimaryButton onClick={() => void start()} disabled={busy || !canInteract || stateCheckBusy || recoveryMode}>
                  Let&apos;s Start
                </PrimaryButton>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Who is the business owner?</h2>
                <TypewriterText text="I will safely set up ownership first." active onDone={() => setCanInteract(true)} />
                <div className="mx-auto flex max-w-md gap-2">
                  <button className={`flex-1 rounded-xl px-4 py-2 ${bossMode === "existing" ? "bg-slate-900 text-white" : "bg-white border"}`} onClick={() => setBossMode("existing")}>Existing Account</button>
                  <button className={`flex-1 rounded-xl px-4 py-2 ${bossMode === "new" ? "bg-slate-900 text-white" : "bg-white border"}`} onClick={() => setBossMode("new")}>New Boss</button>
                </div>
                {bossMode === "existing" ? (
                  <div className="space-y-2">
                    <input ref={firstInputRef} value={bossEmail} onChange={(e) => { setBossEmail(e.target.value); setShowExistingConfirm(false); }} placeholder="Search owner email" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                    {existingCandidates.length > 0 ? (
                      <div className="max-h-48 overflow-auto rounded-xl border bg-white text-left">
                        {existingCandidates.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => { setExistingSelected(u); setBossEmail(u.email); setShowExistingConfirm(true); }}
                            className="block w-full px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <p className="font-medium text-slate-900">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email} {u.company ? `· ${u.company}` : ""}</p>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {showExistingConfirm && existingSelected ? (
                      <div className="rounded-xl border bg-slate-50 p-3 text-left">
                        <p className="text-sm font-semibold text-slate-900">{existingSelected.name}</p>
                        <p className="text-xs text-slate-600">{existingSelected.email}</p>
                        <p className="text-xs text-slate-600">{existingSelected.company || "No company linked yet"}</p>
                        <PrimaryButton className="mt-3 px-4 py-2 text-sm" onClick={() => void lookupBoss()}>
                          Confirm & Continue
                        </PrimaryButton>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input ref={firstInputRef} value={bossName} onChange={(e) => setBossName(e.target.value)} placeholder="Owner name" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                    <input value={bossEmail} onChange={(e) => setBossEmail(e.target.value)} placeholder="Owner email" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                    <input value={bossPassword} onChange={(e) => setBossPassword(e.target.value)} placeholder="Password (optional)" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                  </div>
                )}
                {bossFound ? <p className="text-sm text-emerald-700">Found: {bossFound.name} ({bossFound.email})</p> : null}
                {bossMode === "new" ? (
                  <PrimaryButton onClick={() => void nextFromBoss()} disabled={busy || !canInteract}>Continue</PrimaryButton>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Which lead are we onboarding?</h2>
                <TypewriterText text="Choose the right lead and I will carry context forward." active onDone={() => setCanInteract(true)} />
                {source === "SALES" ? (
                  <>
                    {leads.length === 0 ? (
                      <PrimaryButton onClick={() => void loadLeads()} disabled={!canInteract}>Load Leads</PrimaryButton>
                    ) : (
                      <>
                        <input ref={firstInputRef} value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Search lead..." className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                        <div className="max-h-56 overflow-auto rounded-xl border bg-white text-left">
                          {filteredLeads.map((l) => (
                            <button key={l.id} onClick={() => setLeadId(l.id)} className={`block w-full px-4 py-3 text-left ${leadId === l.id ? "bg-slate-100" : ""}`}>
                              <div className="font-medium">{l.name}</div>
                              <div className="text-xs text-slate-500">{l.phone} {l.location ? `· ${l.location}` : ""}</div>
                            </button>
                          ))}
                        </div>
                        <PrimaryButton onClick={() => void continueLead()} disabled={!canInteract}>Continue</PrimaryButton>
                      </>
                    )}
                  </>
                ) : (
                  <PrimaryButton onClick={() => moveTo(3)} disabled={!canInteract}>Continue</PrimaryButton>
                )}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">What type of business is this?</h2>
                <TypewriterText text="Tell me the business type and I will shape the system accordingly." active onDone={() => setCanInteract(true)} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {INDUSTRIES.map((i) => (
                    <motion.button key={i.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }} onClick={() => { setIndustry(i.id); setNexaReply(i.id === "EDUCATION" ? "Got it - I will set up an academic system for you." : "Perfect - I will align this for your business model."); }} className={`rounded-xl border px-4 py-3 ${industry === i.id ? "bg-slate-900 text-white" : "bg-white"}`}>
                      {i.label}
                    </motion.button>
                  ))}
                </div>
                {nexaReply ? <p className="text-sm text-slate-500">{nexaReply}</p> : null}
                {industry === "CUSTOM" ? <input ref={firstInputRef} value={customIndustry} onChange={(e) => setCustomIndustry(e.target.value)} placeholder="Describe your custom industry" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" /> : null}
                <PrimaryButton onClick={() => { void persist("industry"); moveTo(4); }} disabled={!canInteract}>Continue</PrimaryButton>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Tell me about the business</h2>
                <TypewriterText text="What should we name your company?" active onDone={() => setCanInteract(true)} />
                <input ref={firstInputRef} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Where do you operate?" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                <input value={focusArea} onChange={(e) => setFocusArea(e.target.value)} placeholder="Any focus area? (optional)" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                <PrimaryButton onClick={() => { void persist("business_details"); moveTo(5); }} disabled={!canInteract}>Continue</PrimaryButton>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Let&apos;s build your team</h2>
                <TypewriterText text="Add each team member and I will map the right dashboard." active onDone={() => setCanInteract(true)} />
                <div className="rounded-xl border bg-white p-3 text-left">
                  <p className="text-xs uppercase text-slate-500">Founder</p>
                  <p className="font-semibold">{bossName || bossFound?.name || employeeName}</p>
                </div>
                <input ref={firstInputRef} value={employeeNameInput} onChange={(e) => setEmployeeNameInput(e.target.value)} placeholder="Add team member name" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                <select value={employeeRoleInput} onChange={(e) => setEmployeeRoleInput(e.target.value)} className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none">
                  <option value="">Select role</option>
                  {ROLE_DASHBOARD.map((r) => <option key={r.role} value={r.role}>{r.role}</option>)}
                </select>
                <input value={employeeCustomRole} onChange={(e) => setEmployeeCustomRole(e.target.value)} placeholder="Or add custom role" className="w-full rounded-xl border px-4 py-3 transition-all duration-200 focus:border-blue-300 focus:shadow-[0_8px_22px_rgba(96,165,250,0.25)] focus:outline-none" />
                {suggestedDashboard ? <p className="text-sm text-slate-600">Recommended dashboard: <span className="font-semibold">{suggestedDashboard}</span></p> : null}
                <div className="flex flex-wrap justify-center gap-2">
                  <PrimaryButton className="px-4 py-2 text-sm" onClick={() => { setNexaReply("Great - I will assign that dashboard."); void addEmployee(false); }} disabled={!canInteract}>Confirm & Assign Dashboard</PrimaryButton>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }} onClick={() => setEmployeeFeatures("required features")} className="rounded-xl border px-4 py-2 text-sm">Request Custom Dashboard</motion.button>
                  {employeeFeatures ? <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }} onClick={() => { setNexaReply("Understood - I will raise a custom dashboard request."); void addEmployee(true); }} className="rounded-xl border px-4 py-2 text-sm">Confirm Custom Request</motion.button> : null}
                </div>
                {nexaReply ? <p className="text-sm text-slate-500">{nexaReply}</p> : null}
                {team.length > 0 ? (
                  <div className="rounded-xl border bg-white p-3 text-left">
                    <p className="mb-2 text-xs uppercase text-slate-500">Preview Team</p>
                    <AnimatePresence initial={false}>
                      {team.map((t, i) => (
                        <motion.p key={`${t.role}-${i}`} initial={{ opacity: 0, scale: 0.95, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="text-sm">
                          {`Employee ${i + 1}`} · {t.role} · {t.dashboard}
                        </motion.p>
                      ))}
                    </AnimatePresence>
                  </div>
                ) : null}
                <PrimaryButton onClick={() => moveTo(6)} disabled={!canInteract}>Continue</PrimaryButton>
              </div>
            ) : null}

            {step === 6 ? (
              <div className="relative space-y-4">
                {isLaunching ? (
                  <div className="absolute inset-0 z-10 flex min-h-[220px] flex-col items-center justify-center rounded-xl bg-white/95 px-4 py-8 shadow-sm">
                    <p className="text-lg font-medium text-slate-800">Setting up your business system...</p>
                    <p className="mt-2 text-sm text-slate-500">Hang tight — we&apos;re finishing your workspace.</p>
                  </div>
                ) : null}
                <h2 className="text-2xl font-semibold">Here is your team structure</h2>
                <TypewriterText text="Everything looks good. I can generate your business system now." active onDone={() => setCanInteract(true)} />
                <div className="rounded-xl border bg-white p-4 text-left">
                  {team.map((t, i) => (
                    <div key={`${t.role}-${i}`} className="mb-2 text-sm">
                      <div className="font-medium">{`Employee ${i + 1}`} · {t.role}</div>
                      <div className="text-slate-500">{t.dashboard}{t.customRequested ? " · Custom request" : ""}</div>
                    </div>
                  ))}
                </div>
                <PrimaryButton
                  onClick={() => void runGeneration()}
                  disabled={!canInteract || busy || isLaunching}
                >
                  Activate
                </PrimaryButton>
              </div>
            ) : null}

            {step === 7 ? (
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold">I am setting up your business system...</h2>
                {[
                  "Creating Boss Dashboard...",
                  "Setting up your team...",
                  "Assigning roles...",
                  "Finalizing system...",
                ].map((line, i) => (
                  <motion.div key={line} initial={{ opacity: 0, x: -12 }} animate={{ opacity: generationProgress > i ? 1 : 0.4, x: 0 }} transition={{ duration: 0.3 }} className="flex items-center justify-center gap-2 text-slate-600">
                    <span>{line}</span>
                    {generationProgress > i ? (
                      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-emerald-600">
                        ✓
                      </motion.span>
                    ) : null}
                  </motion.div>
                ))}
              </div>
            ) : null}

            {step === 8 ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Your business system is ready</h2>
                <p className="text-slate-600">Boss login created. Employee accounts created.</p>
                {credentials.length > 0 ? (
                  <div className="rounded-xl border bg-white p-4 text-left">
                    {credentials.map((c, i) => (
                      <p key={`${c.email}-${i}`} className="text-sm">{c.name} · {c.email} · {c.role}</p>
                    ))}
                  </div>
                ) : null}
                {credentialsFile ? (
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }} onClick={downloadCredentials} className="rounded-2xl border px-6 py-3">Download Login Credentials</motion.button>
                ) : null}
                <a
                  href={source === "SALES" ? "/iceconnect/customers" : "/bgos/boss/home"}
                  className="inline-block rounded-2xl bg-slate-900 px-6 py-3 text-white"
                >
                  Launch Dashboard
                </a>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
        ) : null}
      </div>
    </motion.div>
  );
}
