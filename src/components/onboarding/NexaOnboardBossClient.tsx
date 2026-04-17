"use client";

import { AnimatePresence, motion } from "framer-motion";
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

export function NexaOnboardBossClient() {
  const [state, setState] = useState<OnboardingState>({ step: 0, mode: "new", user: {}, company: {} });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        state?: OnboardingState;
        name?: string;
        email?: string;
        companyName?: string;
        category?: string;
      };
      if (saved.state) setState(saved.state);
      if (typeof saved.name === "string") setName(saved.name);
      if (typeof saved.email === "string") setEmail(saved.email);
      if (typeof saved.companyName === "string") setCompanyName(saved.companyName);
      if (typeof saved.category === "string") setCategory(saved.category);
    } catch {
      // ignore stale local payload
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state, name, email, companyName, category }),
    );
  }, [state, name, email, companyName, category]);

  async function nextFromIntro() {
    setState((s) => ({ ...s, step: 1 }));
  }

  async function nextName() {
    if (!name.trim()) return setErr("Please enter your name.");
    setErr(null);
    setState((s) => ({ ...s, step: 2, user: { ...s.user, name: name.trim() } }));
  }

  async function nextEmail() {
    if (!email.trim()) return setErr("Please enter your email.");
    setErr(null);
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

  async function submitAccount() {
    if (!password.trim()) return setErr("Please set your password.");
    setErr(null);
    setBusy(true);
    try {
      const endpoint = state.mode === "existing" ? "/api/auth/login" : "/api/auth/signup";
      const payload =
        state.mode === "existing"
          ? { email: email.trim(), password: password.trim() }
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
        setErr(j.error || "I’ll fix this for you… please retry.");
        return;
      }
      const initRes = await apiFetch("/api/onboarding/init", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: j.user?.id, email: email.trim() }),
      });
      const initJ = ((await readApiJson(initRes, "onboarding-init")) ?? {}) as {
        success?: boolean;
        data?: { user_id?: string };
      };
      setState((s) => ({
        ...s,
        step: 4,
        user: { ...s.user, id: initJ.data?.user_id || j.user?.id },
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
    if (!companyName.trim() || !c) return setErr("Please enter business name and category.");
    setErr(null);
    setState((s) => ({
      ...s,
      step: 6,
      company: { ...s.company, name: companyName.trim(), category: c.id },
      flowType: c.kind,
    }));
  }

  async function runReadymade() {
    setBusy(true);
    setErr(null);
    try {
      const createRes = await apiFetch("/api/company/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "NEXA_ENGINE",
          name: companyName.trim(),
          industry: category === "SOLAR" ? "SOLAR" : "CUSTOM",
          businessType: category === "SOLAR" ? "SOLAR" : "CUSTOM",
        }),
      });
      const created = ((await readApiJson(createRes, "company-create")) ?? {}) as {
        ok?: boolean;
        companyId?: string;
      };
      const companyId = created.companyId;
      if (!createRes.ok || created.ok !== true || !companyId) {
        setErr("I’ll fix this for you… retrying is safe.");
        return;
      }
      await apiFetch("/api/role/assign", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, role: "boss" }),
      });
      await apiFetch("/api/system/init", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, category }),
      });
      setState((s) => ({ ...s, step: 7, company: { ...s.company, id: companyId } }));
      window.localStorage.removeItem(STORAGE_KEY);
      window.setTimeout(() => {
        window.location.assign("/bgos/dashboard");
      }, 800);
    } finally {
      setBusy(false);
    }
  }

  async function submitCustom() {
    setBusy(true);
    setErr(null);
    try {
      const createRes = await apiFetch("/api/company/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "NEXA_ENGINE",
          name: companyName.trim(),
          industry: "CUSTOM",
          businessType: "CUSTOM",
          plan: "PRO",
        }),
      });
      const created = ((await readApiJson(createRes, "company-create-custom")) ?? {}) as {
        ok?: boolean;
        companyId?: string;
      };
      if (!createRes.ok || created.ok !== true || !created.companyId) {
        setErr("I’ll fix this for you… retrying is safe.");
        return;
      }
      await apiFetch("/api/system/init", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: created.companyId,
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
      setState((s) => ({ ...s, step: 7, company: { ...s.company, id: created.companyId } }));
      window.localStorage.removeItem(STORAGE_KEY);
      window.setTimeout(() => {
        window.location.assign("/bgos/dashboard");
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
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2">
                    <option value="">Select industry</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
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

          {err ? (
            <p className="mt-4 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              {err}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
