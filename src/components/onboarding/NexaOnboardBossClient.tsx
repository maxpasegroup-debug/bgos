"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";

type FlowType = "readymade" | "custom";
type Mode = "new" | "existing" | "sales" | "manager";
type CategoriesPayload = Array<{ id: string; label: string; kind: FlowType }>;

type OnboardingState = {
  step: number;
  mode: Mode;
  user: { id?: string; name?: string; email?: string };
  company: { id?: string; name?: string; category?: string };
  flowType?: FlowType;
};

const STEP_LABELS = [
  "Intro",
  "Name",
  "Email",
  "Password",
  "Account",
  "Business",
  "Flow",
  "Done",
];

function Orb() {
  return (
    <motion.div
      className="mx-auto h-12 w-12 rounded-full bg-[radial-gradient(circle_at_35%_30%,#dbeafe_0%,#60a5fa_50%,#6366f1_100%)]"
      animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
      transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
    />
  );
}

type NexaBanner = {
  text: string;
  showRetry: boolean;
  onRetry?: () => void | Promise<void>;
};

export function NexaOnboardBossClient({
  entrySource,
  resume,
  addBusiness,
  urlLeadId,
  urlSalesOwnerId,
  urlFranchiseId,
  urlReferralSource,
}: {
  entrySource?: string;
  resume?: boolean;
  addBusiness?: boolean;
  urlLeadId?: string;
  urlSalesOwnerId?: string;
  urlFranchiseId?: string;
  urlReferralSource?: string;
} = {}) {
  const router = useRouter();
  const initialMode: Mode =
    entrySource === "sales" ? "sales" : entrySource === "manager" ? "manager" : "new";
  const [state, setState] = useState<OnboardingState>({
    step: 0,
    mode: initialMode,
    user: {},
    company: {},
  });
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<NexaBanner | null>(null);
  const [attrLeadId, setAttrLeadId] = useState(urlLeadId?.trim() ?? "");
  const [attrSalesOwnerId, setAttrSalesOwnerId] = useState(urlSalesOwnerId?.trim() ?? "");
  const [attrFranchiseId, setAttrFranchiseId] = useState(urlFranchiseId?.trim() ?? "");
  const [attrReferralSource, setAttrReferralSource] = useState(urlReferralSource?.trim() ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<CategoriesPayload>([
    { id: "SOLAR", label: "Solar", kind: "readymade" },
    { id: "ACADEMY", label: "Academy", kind: "readymade" },
    { id: "BUILDERS", label: "Builders", kind: "readymade" },
    { id: "CUSTOM", label: "Custom", kind: "custom" },
  ]);
  const [customBusinessType, setCustomBusinessType] = useState("");
  const [customDepartments, setCustomDepartments] = useState<string[]>([]);
  const [customFeatures, setCustomFeatures] = useState<string[]>([]);
  const [customTeam, setCustomTeam] = useState<Array<{ name: string; role: string; responsibilities: string }>>([]);
  const [teamName, setTeamName] = useState("");
  const [teamRole, setTeamRole] = useState("");
  const [teamResp, setTeamResp] = useState("");
  const STORAGE_KEY = "bgos_nexa_onboard_state_v1";

  const progress = useMemo(() => Math.round(((state.step + 1) / STEP_LABELS.length) * 100), [state.step]);

  useEffect(() => {
    const path = `${window.location.pathname}${window.location.search}`;
    router.replace(path, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (urlLeadId?.trim()) setAttrLeadId(urlLeadId.trim());
    if (urlSalesOwnerId?.trim()) setAttrSalesOwnerId(urlSalesOwnerId.trim());
    if (urlFranchiseId?.trim()) setAttrFranchiseId(urlFranchiseId.trim());
    if (urlReferralSource?.trim()) setAttrReferralSource(urlReferralSource.trim());
  }, [urlLeadId, urlSalesOwnerId, urlFranchiseId, urlReferralSource]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        state?: OnboardingState;
        name?: string;
        email?: string;
        companyName?: string;
        category?: string;
        attrLeadId?: string;
        attrSalesOwnerId?: string;
        attrFranchiseId?: string;
        attrReferralSource?: string;
      };
      if (saved.state) setState(saved.state);
      if (typeof saved.name === "string") setName(saved.name);
      if (typeof saved.email === "string") setEmail(saved.email);
      if (typeof saved.companyName === "string") setCompanyName(saved.companyName);
      if (typeof saved.category === "string") setCategory(saved.category);
      if (!urlLeadId?.trim() && typeof saved.attrLeadId === "string") setAttrLeadId(saved.attrLeadId);
      if (!urlSalesOwnerId?.trim() && typeof saved.attrSalesOwnerId === "string") {
        setAttrSalesOwnerId(saved.attrSalesOwnerId);
      }
      if (!urlFranchiseId?.trim() && typeof saved.attrFranchiseId === "string") {
        setAttrFranchiseId(saved.attrFranchiseId);
      }
      if (!urlReferralSource?.trim() && typeof saved.attrReferralSource === "string") {
        setAttrReferralSource(saved.attrReferralSource);
      }
    } catch {
      // ignore stale local payload
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state,
        name,
        email,
        companyName,
        category,
        attrLeadId,
        attrSalesOwnerId,
        attrFranchiseId,
        attrReferralSource,
      }),
    );
  }, [state, name, email, companyName, category, attrLeadId, attrSalesOwnerId, attrFranchiseId, attrReferralSource]);

  async function nextFromIntro() {
    setBanner(null);
    setState((s) => ({ ...s, step: 1 }));
  }

  async function nextName() {
    if (!name.trim()) {
      setBanner({ text: "I need your name so I can personalize your workspace.", showRetry: false });
      return;
    }
    setBanner(null);
    setState((s) => ({ ...s, step: 2, user: { ...s.user, name: name.trim() } }));
  }

  async function nextEmail() {
    if (!email.trim()) {
      setBanner({ text: "I need a valid email to continue.", showRetry: false });
      return;
    }
    setBanner(null);
    setBusy(true);
    try {
      const res = await apiFetch(`/api/users/check?email=${encodeURIComponent(email.trim())}`, {
        credentials: "include",
      });
      const j = ((await readApiJson(res, "users-check")) ?? {}) as { success?: boolean; data?: { exists?: boolean } };
      const exists = j.success === true && j.data?.exists === true;
      setState((s) => ({ ...s, step: 3, mode: exists ? "existing" : "new", user: { ...s.user, email: email.trim() } }));
    } finally {
      setBusy(false);
    }
  }

  function buildInitBody(userId: string, emailStr: string) {
    return {
      user_id: userId,
      email: emailStr,
      ...(attrLeadId.trim() ? { lead_id: attrLeadId.trim() } : {}),
      ...(attrSalesOwnerId.trim() ? { sales_owner_id: attrSalesOwnerId.trim() } : {}),
      ...(attrFranchiseId.trim() ? { franchise_id: attrFranchiseId.trim() } : {}),
      ...(attrReferralSource.trim() ? { referral_source: attrReferralSource.trim() } : {}),
    };
  }

  async function postOnboardingInitWithRetries(userId: string, emailStr: string) {
    const body = buildInitBody(userId, emailStr);
    let lastMessage = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const initRes = await apiFetch("/api/onboarding/init", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const initJ = ((await readApiJson(initRes, "onboarding-init")) ?? {}) as {
        success?: boolean;
        data?: { user_id?: string };
        message?: string;
      };
      if (initRes.ok && initJ.success === true) {
        return { ok: true as const, userId: initJ.data?.user_id ?? userId };
      }
      lastMessage = typeof initJ.message === "string" ? initJ.message : "";
      console.error("[NexaOnboardBoss] onboarding/init failed", { attempt, lastMessage, status: initRes.status });
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
    return { ok: false as const, message: lastMessage };
  }

  async function checkOnboardingState() {
    const res = await apiFetch("/api/onboarding/state", { credentials: "include" });
    const j = ((await readApiJson(res, "onboarding-state-check")) ?? {}) as {
      success?: boolean;
      data?: { company_exists?: boolean; session_ready?: boolean; role_assigned?: boolean };
    };
    if (!res.ok || j.success !== true || !j.data) return null;
    return j.data;
  }

  async function submitAccount() {
    if (!password.trim()) {
      setBanner({ text: "I need a secure password to protect your account.", showRetry: false });
      return;
    }
    setBanner(null);
    setBusy(true);
    try {
      const endpoint = state.mode === "existing" ? "/api/auth/login" : "/api/auth/signup";
      const payload =
        state.mode === "existing"
          ? { email: email.trim(), password: password.trim(), from: "/onboarding/nexa" }
          : { name: name.trim(), email: email.trim(), password: password.trim() };
      const res = await apiFetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = ((await readApiJson(res, "nexa-account-submit")) ?? {}) as {
        ok?: boolean;
        success?: boolean;
        user?: { id?: string };
        error?: string;
      };
      if (!res.ok || (j.ok !== true && j.success !== true)) {
        console.error("[NexaOnboardBoss] auth failed", j);
        setBanner({
          text: "I’m fixing a system issue. Let’s retry together.",
          showRetry: true,
          onRetry: () => void submitAccount(),
        });
        return;
      }
      const authedUserId =
        typeof j.user?.id === "string" && j.user.id.trim() ? j.user.id.trim() : undefined;
      if (!authedUserId) {
        setBanner({
          text: "I’m fixing a system issue. Let’s retry together.",
          showRetry: true,
          onRetry: () => void submitAccount(),
        });
        return;
      }
      const initResult = await postOnboardingInitWithRetries(authedUserId, email.trim());
      if (!initResult.ok) {
        const st = await checkOnboardingState();
        if (st?.session_ready) {
          setState((s) => ({
            ...s,
            step: 4,
            user: { ...s.user, id: authedUserId },
          }));
          return;
        }
        setBanner({
          text: "I’m fixing a system issue. Let’s retry together.",
          showRetry: true,
          onRetry: () => void submitAccount(),
        });
        return;
      }
      setState((s) => ({
        ...s,
        step: 4,
        user: { ...s.user, id: initResult.userId },
      }));
    } finally {
      setBusy(false);
    }
  }

  async function loadCategoriesAndContinue() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/categories", { credentials: "include" });
      const j = ((await readApiJson(res, "categories")) ?? {}) as {
        success?: boolean;
        data?: CategoriesPayload;
      };
      if (res.ok && j.success && Array.isArray(j.data) && j.data.length > 0) {
        setCategories(j.data);
      }
      setState((s) => ({ ...s, step: 5 }));
    } finally {
      setBusy(false);
    }
  }

  async function chooseFlow() {
    const c = categories.find((x) => x.id === category);
    if (!companyName.trim() || !c) {
      setBanner({ text: "I need your business name and industry to continue.", showRetry: false });
      return;
    }
    setBanner(null);
    setState((s) => ({
      ...s,
      step: 6,
      company: { ...s.company, name: companyName.trim(), category: c.id },
      flowType: c.kind,
    }));
  }

  async function runReadymade() {
    setBusy(true);
    setBanner(null);
    try {
      const body = {
        source: "NEXA_ENGINE",
        name: companyName.trim(),
        industry: "SOLAR",
        businessType: "SOLAR",
      };
      let companyId: string | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        const createRes = await apiFetch("/api/company/create", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(addBusiness ? { "x-bgos-add-business": "1" } : {}),
          },
          body: JSON.stringify(body),
        });
        const created = ((await readApiJson(createRes, "company-create")) ?? {}) as {
          ok?: boolean;
          companyId?: string;
          error?: string;
          code?: string;
        };
        companyId = created.companyId;
        if (createRes.ok && created.ok === true && companyId) break;
        console.error("[NexaOnboardBoss] company/create attempt failed", {
          attempt,
          status: createRes.status,
          ok: createRes.ok,
          code: created.code,
          error: created.error,
        });
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
      }
      if (!companyId) {
        const st = await checkOnboardingState();
        if (st?.company_exists) {
          setBanner({
            text: "Your company is already linked. Continue when you’re ready.",
            showRetry: false,
          });
          return;
        }
        setBanner({
          text: "I’m fixing a system issue. Let’s retry together.",
          showRetry: true,
          onRetry: () => void runReadymade(),
        });
        return;
      }
      setState((s) => ({ ...s, step: 7, company: { ...s.company, id: companyId } }));
      window.localStorage.removeItem(STORAGE_KEY);
      window.setTimeout(() => {
        /** Readymade (solar) bosses land on the tenant BGOS dashboard — not the internal control plane. */
        window.location.assign("/bgos/dashboard");
      }, 800);
    } finally {
      setBusy(false);
    }
  }

  async function submitCustom() {
    setBusy(true);
    setBanner(null);
    try {
      const createBody = {
        source: "NEXA_ENGINE",
        name: companyName.trim(),
        industry: "CUSTOM",
        businessType: "CUSTOM",
        plan: "PRO",
      };
      let newCompanyId: string | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        const createRes = await apiFetch("/api/company/create", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(addBusiness ? { "x-bgos-add-business": "1" } : {}),
          },
          body: JSON.stringify(createBody),
        });
        const created = ((await readApiJson(createRes, "company-create-custom")) ?? {}) as {
          ok?: boolean;
          companyId?: string;
          error?: string;
          code?: string;
        };
        if (createRes.ok && created.ok === true && created.companyId) {
          newCompanyId = created.companyId;
          break;
        }
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
      }
      if (!newCompanyId) {
        setBanner({
          text: "I’m fixing a system issue. Let’s retry together.",
          showRetry: true,
          onRetry: () => void submitCustom(),
        });
        return;
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const initSys = await apiFetch("/api/system/init", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: newCompanyId,
            category: "CUSTOM",
            custom: {
              businessType: customBusinessType,
              departments: customDepartments,
              features: customFeatures,
              team: customTeam,
              status: "under_review",
            },
          }),
        });
        if (initSys.ok) break;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
      }
      setState((s) => ({ ...s, step: 7, company: { ...s.company, id: newCompanyId } }));
      window.localStorage.removeItem(STORAGE_KEY);
      window.setTimeout(() => {
        window.location.assign("/bgos/dashboard?building=1");
      }, 800);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#060914] via-[#0d1328] to-[#21123a] px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Orb />
        <div className="mx-auto mt-4 max-w-xl rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between text-xs text-white/70">
            <span>Nexa Onboard Boss</span>
            <span>{progress}%</span>
          </div>
          <div className="mb-6 h-1.5 rounded bg-white/10">
            <div className="h-1.5 rounded bg-gradient-to-r from-indigo-400 to-violet-400" style={{ width: `${progress}%` }} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={state.step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              {state.step === 0 ? (
                <div className="space-y-4 text-center">
                  <h1 className="text-2xl font-semibold">Hi, I’m Nexa — your Virtual CEO.</h1>
                  <p className="text-sm text-white/75">I’ll set up your business system in minutes.</p>
                  {resume ? (
                    <p className="text-xs text-white/55">Picking up where you left off…</p>
                  ) : null}
                  {addBusiness ? (
                    <p className="text-xs text-white/55">Adding another business to your account.</p>
                  ) : null}
                  {entrySource === "sales" || entrySource === "franchise" ? (
                    <p className="text-xs text-white/55">Guided onboarding{entrySource === "franchise" ? " (franchise channel)" : ""}.</p>
                  ) : null}
                  <button onClick={() => void nextFromIntro()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">Start</button>
                </div>
              ) : null}

              {state.step === 1 ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">What should I call you?</p>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                  <button onClick={() => void nextName()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">Continue</button>
                </div>
              ) : null}

              {state.step === 2 ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">Your email?</p>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                  <button disabled={busy} onClick={() => void nextEmail()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold disabled:opacity-50">Continue</button>
                </div>
              ) : null}

              {state.step === 3 ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">{state.mode === "existing" ? "Enter your password to continue." : "Set a secure password."}</p>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                  <button disabled={busy} onClick={() => void submitAccount()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold disabled:opacity-50">
                    {state.mode === "existing" ? "Login" : "Create Account"}
                  </button>
                </div>
              ) : null}

              {state.step === 4 ? (
                <div className="space-y-4 text-center">
                  <h2 className="text-xl font-semibold">Welcome Boss, your account is ready.</h2>
                  <button disabled={busy} onClick={() => void loadCategoriesAndContinue()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">Continue</button>
                </div>
              ) : null}

              {state.step === 5 ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">Now let’s connect BGOS with your business.</p>
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Business name" className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full appearance-none rounded-[10px] border border-white/10 bg-[#0f172a] py-3 pl-3.5 pr-10 text-sm text-white outline-none [-moz-appearance:none] [-webkit-appearance:none] focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-500/40 [&>option]:bg-[#0f172a] [&>option]:text-white"
                    >
                      <option value="">Select industry</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <span
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                      aria-hidden
                    >
                      ▼
                    </span>
                  </div>
                  <button onClick={() => void chooseFlow()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">Continue</button>
                </div>
              ) : null}

              {state.step === 6 && state.flowType === "readymade" ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-white/80">Perfect. I’ll activate your ready-made system.</p>
                  <button disabled={busy} onClick={() => void runReadymade()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold disabled:opacity-50">Activate System</button>
                </div>
              ) : null}

              {state.step === 6 && state.flowType === "custom" ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">Got it. Let’s design your system your way.</p>
                  <input value={customBusinessType} onChange={(e) => setCustomBusinessType(e.target.value)} placeholder="Business type" className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                  <input value={customDepartments.join(", ")} onChange={(e) => setCustomDepartments(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} placeholder="Departments (comma separated)" className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                  <input value={customFeatures.join(", ")} onChange={(e) => setCustomFeatures(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} placeholder="Features (comma separated)" className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team member name" className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                    <input value={teamRole} onChange={(e) => setTeamRole(e.target.value)} placeholder="Role" className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                    <input value={teamResp} onChange={(e) => setTeamResp(e.target.value)} placeholder="Responsibilities" className="rounded-lg border border-white/20 bg-black/20 px-3 py-2" />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!teamName.trim() || !teamRole.trim()) return;
                      setCustomTeam((prev) => [...prev, { name: teamName.trim(), role: teamRole.trim(), responsibilities: teamResp.trim() }]);
                      setTeamName("");
                      setTeamRole("");
                      setTeamResp("");
                    }}
                    className="rounded-lg border border-white/20 px-3 py-2 text-sm"
                  >
                    Add Team Member
                  </button>
                  {customTeam.length > 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/80">
                      {customTeam.map((t, i) => <p key={`${t.name}-${i}`}>{t.name} · {t.role}</p>)}
                    </div>
                  ) : null}
                  <button disabled={busy} onClick={() => void submitCustom()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold disabled:opacity-50">Submit for Setup</button>
                </div>
              ) : null}

              {state.step === 7 ? (
                <div className="space-y-3 text-center">
                  <h2 className="text-xl font-semibold">{state.flowType === "custom" ? "Your system is being prepared." : "Your system is live."}</h2>
                  <p className="text-sm text-white/75">
                    {state.flowType === "custom" ? "Our team is reviewing your setup. You’ll be notified shortly." : "You can now start building your team."}
                  </p>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          {banner ? (
            <div className="mt-4 rounded-xl border border-indigo-400/25 bg-indigo-950/40 px-4 py-3 text-sm text-indigo-50 shadow-inner">
              <p className="font-medium leading-relaxed">{banner.text}</p>
              {banner.showRetry ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBanner(null);
                    void banner.onRetry?.();
                  }}
                  className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
                >
                  Retry Now
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
