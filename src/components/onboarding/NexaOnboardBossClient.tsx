"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";
import { estimateBuildDays } from "@/lib/onboarding-brief-generator";
import { getTemplate } from "@/lib/onboarding-intelligence";

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

type RoleDraft = {
  department: string;
  roleName: string;
  count: number;
  features: string[];
};

type EmployeeDraft = {
  roleName: string;
  name: string;
  email: string;
  phone: string;
};

type NexaBanner = {
  text: string;
  showRetry: boolean;
  onRetry?: () => void | Promise<void>;
};

const STORAGE_KEY = "bgos_nexa_onboard_state_v2";

function Orb() {
  return (
    <motion.div
      className="mx-auto h-12 w-12 rounded-full bg-[radial-gradient(circle_at_35%_30%,#dbeafe_0%,#60a5fa_50%,#6366f1_100%)]"
      animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
      transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
    />
  );
}

function chipSelected(selected: boolean) {
  return selected
    ? "border-indigo-300/45 bg-indigo-500/20 text-indigo-50"
    : "border-white/12 bg-white/6 text-white/80";
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function roleKey(department: string, roleName: string) {
  return `${department}::${roleName}`.toLowerCase();
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function NexaOnboardBossClient({
  entrySource,
  resume,
  addBusiness,
  urlLeadId,
  urlSalesOwnerId,
  urlFranchiseId,
  urlReferralSource,
  prefillName,
  prefillEmail,
  prefillCompanyName,
  prefillCategory,
  onClose,
}: {
  entrySource?: string;
  resume?: boolean;
  addBusiness?: boolean;
  urlLeadId?: string;
  urlSalesOwnerId?: string;
  urlFranchiseId?: string;
  urlReferralSource?: string;
  prefillName?: string;
  prefillEmail?: string;
  prefillCompanyName?: string;
  prefillCategory?: string;
  onClose?: () => void;
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
  const authSubmitInFlightRef = useRef(false);
  const [banner, setBanner] = useState<NexaBanner | null>(null);
  const [showManualContinue, setShowManualContinue] = useState(false);
  const [manualContinuePath, setManualContinuePath] = useState<string | null>(null);
  const [attrLeadId, setAttrLeadId] = useState(urlLeadId?.trim() ?? "");
  const [attrSalesOwnerId, setAttrSalesOwnerId] = useState(urlSalesOwnerId?.trim() ?? "");
  const [attrFranchiseId, setAttrFranchiseId] = useState(urlFranchiseId?.trim() ?? "");
  const [attrReferralSource, setAttrReferralSource] = useState(urlReferralSource?.trim() ?? "");
  const [name, setName] = useState(prefillName ?? "");
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState(prefillCompanyName ?? "");
  const [category, setCategory] = useState((prefillCategory ?? "").trim().toUpperCase());
  const [categories, setCategories] = useState<CategoriesPayload>([
    { id: "SOLAR", label: "Solar", kind: "readymade" },
    { id: "ACADEMY", label: "Academy", kind: "readymade" },
    { id: "BUILDERS", label: "Builders", kind: "readymade" },
    { id: "CUSTOM", label: "Custom", kind: "custom" },
  ]);
  const [businessDescription, setBusinessDescription] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [departmentDraft, setDepartmentDraft] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<RoleDraft[]>([]);
  const [customRoleDraft, setCustomRoleDraft] = useState("");
  const [roleFeatureDraft, setRoleFeatureDraft] = useState("");
  const [currentDepartmentIndex, setCurrentDepartmentIndex] = useState(0);
  const [currentRoleQuestionIndex, setCurrentRoleQuestionIndex] = useState(0);
  const [employeeMode, setEmployeeMode] = useState<"add" | "skip" | null>(null);
  const [employeeDrafts, setEmployeeDrafts] = useState<EmployeeDraft[]>([]);
  const [bossDashboardFeatures, setBossDashboardFeatures] = useState<string[]>([]);
  const [bossDashboardDraft, setBossDashboardDraft] = useState("");
  const [buildEstimate, setBuildEstimate] = useState("");
  const [isSolarTeamFlow, setIsSolarTeamFlow] = useState(false);
  const [solarReadyPath, setSolarReadyPath] = useState<string | null>(null);

  const activeTemplate = useMemo(() => getTemplate(category || "CUSTOM"), [category]);
  const activeRoles = useMemo(() => roleDrafts.filter((role) => role.count > 0), [roleDrafts]);
  const currentDepartment = selectedDepartments[currentDepartmentIndex] ?? "";
  const currentRole = activeRoles[currentRoleQuestionIndex] ?? null;
  const totalDashboards = activeRoles.length + (state.flowType === "custom" ? 1 : 0);
  const totalSteps = state.flowType === "custom" ? 16 : isSolarTeamFlow ? 11 : 8;
  const progress = useMemo(() => Math.round(((state.step + 1) / totalSteps) * 100), [state.step, totalSteps]);

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
        businessDescription?: string;
        teamSize?: string;
        selectedDepartments?: string[];
        roleDrafts?: RoleDraft[];
        employeeMode?: "add" | "skip" | null;
        employeeDrafts?: EmployeeDraft[];
        bossDashboardFeatures?: string[];
        attrLeadId?: string;
        attrSalesOwnerId?: string;
        attrFranchiseId?: string;
        attrReferralSource?: string;
        isSolarTeamFlow?: boolean;
        solarReadyPath?: string | null;
      };
      if (saved.state) setState(saved.state);
      if (!prefillName && typeof saved.name === "string") setName(saved.name);
      if (!prefillEmail && typeof saved.email === "string") setEmail(saved.email);
      if (!prefillCompanyName && typeof saved.companyName === "string") setCompanyName(saved.companyName);
      if (!prefillCategory && typeof saved.category === "string") setCategory(saved.category);
      if (typeof saved.businessDescription === "string") setBusinessDescription(saved.businessDescription);
      if (typeof saved.teamSize === "string") setTeamSize(saved.teamSize);
      if (Array.isArray(saved.selectedDepartments)) setSelectedDepartments(saved.selectedDepartments);
      if (Array.isArray(saved.roleDrafts)) setRoleDrafts(saved.roleDrafts);
      if (saved.employeeMode === "add" || saved.employeeMode === "skip" || saved.employeeMode === null) {
        setEmployeeMode(saved.employeeMode);
      }
      if (Array.isArray(saved.employeeDrafts)) setEmployeeDrafts(saved.employeeDrafts);
      if (Array.isArray(saved.bossDashboardFeatures)) setBossDashboardFeatures(saved.bossDashboardFeatures);
      if (!urlLeadId?.trim() && typeof saved.attrLeadId === "string") setAttrLeadId(saved.attrLeadId);
      if (!urlSalesOwnerId?.trim() && typeof saved.attrSalesOwnerId === "string") setAttrSalesOwnerId(saved.attrSalesOwnerId);
      if (!urlFranchiseId?.trim() && typeof saved.attrFranchiseId === "string") setAttrFranchiseId(saved.attrFranchiseId);
      if (!urlReferralSource?.trim() && typeof saved.attrReferralSource === "string") {
        setAttrReferralSource(saved.attrReferralSource);
      }
      if (saved.isSolarTeamFlow === true) setIsSolarTeamFlow(true);
      if (typeof saved.solarReadyPath === "string" || saved.solarReadyPath === null) setSolarReadyPath(saved.solarReadyPath ?? null);
    } catch {
      // Ignore stale local payloads.
    }
  }, [prefillCategory, prefillCompanyName, prefillEmail, prefillName, urlFranchiseId, urlLeadId, urlReferralSource, urlSalesOwnerId]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state,
        name,
        email,
        companyName,
        category,
        businessDescription,
        teamSize,
        selectedDepartments,
        roleDrafts,
        employeeMode,
        employeeDrafts,
        bossDashboardFeatures,
        attrLeadId,
        attrSalesOwnerId,
        attrFranchiseId,
        attrReferralSource,
        isSolarTeamFlow,
        solarReadyPath,
      }),
    );
  }, [
    state,
    name,
    email,
    companyName,
    category,
    businessDescription,
    teamSize,
    selectedDepartments,
    roleDrafts,
    employeeMode,
    employeeDrafts,
    bossDashboardFeatures,
    attrLeadId,
    attrSalesOwnerId,
    attrFranchiseId,
    attrReferralSource,
    isSolarTeamFlow,
    solarReadyPath,
  ]);

  function resetBanner() {
    setBanner(null);
    setShowManualContinue(false);
    setManualContinuePath(null);
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

  function messageFromApiFailure(
    j: {
      error?: string;
      message?: string;
      code?: string;
      details?: unknown;
    },
    status: number,
  ): string {
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
    if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
    if (j.code === "VALIDATION_ERROR" && j.details && typeof j.details === "object") {
      const details = j.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
      const firstFieldError = details.fieldErrors ? Object.values(details.fieldErrors).flat()[0] : "";
      if (firstFieldError) return firstFieldError;
      if (details.formErrors?.[0]) return details.formErrors[0];
    }
    if (status === 401) return "Unable to sign in. Check your email and password.";
    if (status === 403) return "Access denied.";
    if (status === 409) return "This email is already registered.";
    if (status === 429) return "Too many attempts. Please wait and try again.";
    return "Something went wrong. Please try again.";
  }

  function shouldOfferRetryForAuthFailure(status: number, code?: string) {
    return status >= 500 || status === 429 || code === "SERVER_ERROR";
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
      const initJson = ((await readApiJson(initRes, "onboarding-init")) ?? {}) as {
        success?: boolean;
        data?: { user_id?: string };
        message?: string;
      };
      if (initRes.ok && initJson.success === true) {
        return { ok: true as const, userId: initJson.data?.user_id ?? userId };
      }
      lastMessage = typeof initJson.message === "string" ? initJson.message : "";
      if (attempt < 2) await sleep(2000);
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

  async function activateWorkspaceAndResolveRedirect(fallbackPath: string) {
    const activateRes = await apiFetch("/api/onboarding/activate", {
      method: "POST",
      credentials: "include",
    });
    const activateJson = ((await readApiJson(activateRes, "onboarding-activate")) ?? {}) as {
      ok?: boolean;
      error?: string;
    };
    if (!activateRes.ok || activateJson.ok !== true) {
      throw new Error(activateJson.error || "Your company was created, but workspace activation did not finish.");
    }

    let redirectPath = fallbackPath;
    try {
      const meRes = await apiFetch("/api/auth/me", { credentials: "include" });
      const meJson = ((await readApiJson(meRes, "onboarding-activate-me")) ?? {}) as {
        user?: { employeeDomain?: "BGOS" | "SOLAR"; superBoss?: boolean } | null;
      };
      if (meJson.user?.superBoss === true) {
        redirectPath = "/bgos/control";
      } else if (meJson.user?.employeeDomain === "SOLAR") {
        redirectPath = "/solar-boss";
      } else {
        redirectPath = "/bgos/dashboard";
      }
    } catch {
      redirectPath = fallbackPath;
    }
    return redirectPath;
  }

  function redirectToWorkspace(path: string) {
    window.localStorage.removeItem(STORAGE_KEY);
    onClose?.();
    window.location.assign(path);
  }

  async function activateWorkspaceAndRedirect(fallbackPath: string) {
    const redirectPath = await activateWorkspaceAndResolveRedirect(fallbackPath);
    redirectToWorkspace(redirectPath);
  }

  function handleActivationFailure(error: unknown, fallbackPath: string) {
    console.error("[onboard] activation failed:", error);
    setBanner({
      text: "Almost there! There was a small hiccup. Click here to continue.",
      showRetry: false,
    });
    setShowManualContinue(true);
    setManualContinuePath(fallbackPath);
  }

  async function nextFromIntro() {
    resetBanner();
    setState((current) => ({ ...current, step: 1 }));
  }

  async function nextName() {
    if (!name.trim()) {
      setBanner({ text: "I need your name so I can personalize your workspace.", showRetry: false });
      return;
    }
    resetBanner();
    setState((current) => ({ ...current, step: 2, user: { ...current.user, name: name.trim() } }));
  }

  async function nextEmail() {
    if (!email.trim()) {
      setBanner({ text: "I need a valid email to continue.", showRetry: false });
      return;
    }
    resetBanner();
    setBusy(true);
    try {
      const res = await apiFetch(`/api/users/check?email=${encodeURIComponent(email.trim())}`, {
        credentials: "include",
      });
      const json = ((await readApiJson(res, "users-check")) ?? {}) as { success?: boolean; data?: { exists?: boolean } };
      const exists = json.success === true && json.data?.exists === true;
      setState((current) => ({
        ...current,
        step: 3,
        mode: exists ? "existing" : "new",
        user: { ...current.user, email: email.trim() },
      }));
    } catch (error) {
      console.error("[NexaOnboardBoss] email check failed", error);
      setBanner({
        text: formatFetchFailure(error, "Could not verify your email"),
        showRetry: true,
        onRetry: () => void nextEmail(),
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitAccount() {
    if (authSubmitInFlightRef.current || busy) return;
    if (!password.trim()) {
      setBanner({ text: "I need a secure password to protect your account.", showRetry: false });
      return;
    }

    resetBanner();
    authSubmitInFlightRef.current = true;
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
      const json = ((await readApiJson(res, "nexa-account-submit")) ?? {}) as {
        ok?: boolean;
        success?: boolean;
        user?: { id?: string };
        error?: string;
        message?: string;
        code?: string;
        details?: unknown;
      };
      if (!res.ok || (json.ok !== true && json.success !== true)) {
        if (state.mode === "new" && res.status === 409 && json.code === "EMAIL_IN_USE") {
          setState((current) => ({ ...current, mode: "existing", step: 3 }));
          setBanner({
            text: "This email already has an account. Enter the same password to continue onboarding.",
            showRetry: false,
          });
          return;
        }
        const text = messageFromApiFailure(json, res.status);
        setBanner({
          text,
          showRetry: shouldOfferRetryForAuthFailure(res.status, json.code),
          ...(shouldOfferRetryForAuthFailure(res.status, json.code)
            ? { onRetry: () => void submitAccount() }
            : {}),
        });
        return;
      }

      const authedUserId = typeof json.user?.id === "string" && json.user.id.trim() ? json.user.id.trim() : "";
      if (!authedUserId) {
        setBanner({
          text: "Signed in, but the server response was incomplete. Please try again or contact support.",
          showRetry: true,
          onRetry: () => void submitAccount(),
        });
        return;
      }

      const initResult = await postOnboardingInitWithRetries(authedUserId, email.trim());
      if (!initResult.ok) {
        const onboardingState = await checkOnboardingState();
        if (onboardingState?.session_ready) {
          setState((current) => ({
            ...current,
            step: 4,
            user: { ...current.user, id: authedUserId },
          }));
          return;
        }
        setBanner({
          text: initResult.message?.trim() || "Could not start onboarding. Check your connection and try again.",
          showRetry: true,
          onRetry: () => void submitAccount(),
        });
        return;
      }

      setState((current) => ({
        ...current,
        step: 4,
        user: { ...current.user, id: initResult.userId },
      }));
    } catch (error) {
      console.error("[NexaOnboardBoss] submitAccount exception", error);
      setBanner({
        text: formatFetchFailure(error, "Could not complete login/signup"),
        showRetry: true,
        onRetry: () => void submitAccount(),
      });
    } finally {
      authSubmitInFlightRef.current = false;
      setBusy(false);
    }
  }

  async function loadCategoriesAndContinue() {
    resetBanner();
    setBusy(true);
    try {
      const res = await apiFetch("/api/categories", { credentials: "include" });
      const data = ((await readApiJson(res, "categories")) ?? {}) as {
        success?: boolean;
        data?: CategoriesPayload;
        categories?: CategoriesPayload;
      };
      const nextCategories =
        (Array.isArray(data.data) ? data.data : Array.isArray(data.categories) ? data.categories : []).filter(Boolean);
      if (nextCategories.length > 0) setCategories(nextCategories);
      setState((current) => ({ ...current, step: 5 }));
    } catch (error) {
      console.error("[onboard] categories failed:", error);
      setBanner({
        text: "Failed to load options. Please check your connection and try again.",
        showRetry: true,
        onRetry: () => void loadCategoriesAndContinue(),
      });
    } finally {
      setBusy(false);
    }
  }

  function chooseFlow() {
    const picked = categories.find((item) => item.id === category);
    if (!companyName.trim() || !picked) {
      setBanner({ text: "I need your business name and industry to continue.", showRetry: false });
      return;
    }

    resetBanner();
    const nextStep = picked.kind === "custom" ? 7 : 6;
    setState((current) => ({
      ...current,
      step: nextStep,
      company: { ...current.company, name: companyName.trim(), category: picked.id },
      flowType: picked.kind,
    }));

    if (picked.id === "CUSTOM") {
      setSelectedDepartments([]);
      setRoleDrafts([]);
      setEmployeeMode(null);
      setEmployeeDrafts([]);
      setBossDashboardFeatures([]);
      setCurrentDepartmentIndex(0);
      setCurrentRoleQuestionIndex(0);
      setIsSolarTeamFlow(false);
    }
  }

  async function createCompanyWithRetries(payload: Record<string, unknown>, fallbackRedirectPath: string, readLabel: string) {
    let companyId = "";
    let redirectPath = fallbackRedirectPath;
    for (let attempt = 0; attempt < 3; attempt++) {
      const createRes = await apiFetch("/api/company/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(addBusiness ? { "x-bgos-add-business": "1" } : {}),
        },
        body: JSON.stringify(payload),
      });
      const created = ((await readApiJson(createRes, readLabel)) ?? {}) as {
        ok?: boolean;
        companyId?: string;
        redirectPath?: string;
      };
      if (typeof created.redirectPath === "string" && created.redirectPath.trim()) {
        redirectPath = created.redirectPath;
      }
      if (createRes.ok && created.ok === true && typeof created.companyId === "string" && created.companyId.trim()) {
        companyId = created.companyId.trim();
        break;
      }
      if (attempt < 2) await sleep(2000);
    }
    return { companyId, redirectPath };
  }

  async function runReadymade() {
    resetBanner();
    setBusy(true);
    try {
      const requestedIndustry = category.trim() || "SOLAR";
      const created = await createCompanyWithRetries(
        {
          source: "NEXA_ENGINE",
          name: companyName.trim(),
          industry: requestedIndustry,
          businessType: requestedIndustry,
          ...(state.user.id?.trim() ? { user_id: state.user.id.trim() } : {}),
        },
        requestedIndustry === "SOLAR" ? "/solar-boss" : "/bgos/dashboard",
        "company-create",
      );

      if (!created.companyId) {
        const onboardingState = await checkOnboardingState();
        if (onboardingState?.company_exists) {
          try {
            await activateWorkspaceAndRedirect(created.redirectPath);
            return;
          } catch (error) {
            handleActivationFailure(error, created.redirectPath);
            return;
          }
        }
        setBanner({
          text: "I am fixing a system issue. Let us retry together.",
          showRetry: true,
          onRetry: () => void runReadymade(),
        });
        return;
      }

      setState((current) => ({
        ...current,
        company: { ...current.company, id: created.companyId },
      }));

      if (requestedIndustry === "SOLAR") {
        try {
          const resolvedPath = await activateWorkspaceAndResolveRedirect(created.redirectPath);
          const template = getTemplate("SOLAR");
          setSelectedDepartments(template.departments);
          setRoleDrafts([]);
          setEmployeeDrafts([]);
          setEmployeeMode(null);
          setCurrentDepartmentIndex(0);
          setCurrentRoleQuestionIndex(0);
          setSolarReadyPath(resolvedPath);
          setIsSolarTeamFlow(true);
          setState((current) => ({ ...current, step: 7 }));
        } catch (error) {
          handleActivationFailure(error, created.redirectPath);
        }
        return;
      }

      await activateWorkspaceAndRedirect(created.redirectPath);
    } finally {
      setBusy(false);
    }
  }

  function toggleDepartment(label: string) {
    const normalized = normalizeLabel(label);
    if (!normalized) return;
    setSelectedDepartments((current) =>
      current.includes(normalized) ? current.filter((item) => item !== normalized) : [...current, normalized],
    );
  }

  function addDepartment() {
    const normalized = normalizeLabel(departmentDraft);
    if (!normalized) return;
    if (!selectedDepartments.includes(normalized)) {
      setSelectedDepartments((current) => [...current, normalized]);
    }
    setDepartmentDraft("");
  }

  function updateRoleCount(department: string, roleName: string, nextCount: number) {
    const cleanRoleName = normalizeLabel(roleName);
    if (!cleanRoleName) return;
    setRoleDrafts((current) => {
      const key = roleKey(department, cleanRoleName);
      const existing = current.find((item) => roleKey(item.department, item.roleName) === key);
      if (existing) {
        return current.map((item) =>
          roleKey(item.department, item.roleName) === key ? { ...item, count: Math.max(0, nextCount) } : item,
        );
      }
      return [...current, { department, roleName: cleanRoleName, count: Math.max(0, nextCount), features: [] }];
    });
  }

  function addCustomRole() {
    if (!currentDepartment) return;
    const normalized = normalizeLabel(customRoleDraft);
    if (!normalized) return;
    updateRoleCount(currentDepartment, normalized, 1);
    setCustomRoleDraft("");
  }

  function toggleRoleFeature(feature: string) {
    if (!currentRole) return;
    const normalized = normalizeLabel(feature);
    if (!normalized) return;
    setRoleDrafts((current) =>
      current.map((item) =>
        roleKey(item.department, item.roleName) !== roleKey(currentRole.department, currentRole.roleName)
          ? item
          : {
              ...item,
              features: item.features.includes(normalized)
                ? item.features.filter((value) => value !== normalized)
                : [...item.features, normalized],
            },
      ),
    );
  }

  function addCustomFeatureToCurrentRole() {
    if (!currentRole) return;
    const normalized = normalizeLabel(roleFeatureDraft);
    if (!normalized) return;
    setRoleDrafts((current) =>
      current.map((item) =>
        roleKey(item.department, item.roleName) !== roleKey(currentRole.department, currentRole.roleName)
          ? item
          : item.features.includes(normalized)
            ? item
            : { ...item, features: [...item.features, normalized] },
      ),
    );
    setRoleFeatureDraft("");
  }

  function addEmployeeRow(roleName: string) {
    setEmployeeDrafts((current) => [...current, { roleName, name: "", email: "", phone: "" }]);
  }

  function updateEmployeeRow(index: number, field: keyof EmployeeDraft, value: string) {
    setEmployeeDrafts((current) => current.map((item, rowIndex) => (rowIndex === index ? { ...item, [field]: value } : item)));
  }

  function toggleBossDashboardFeature(feature: string) {
    const normalized = normalizeLabel(feature);
    if (!normalized) return;
    setBossDashboardFeatures((current) =>
      current.includes(normalized) ? current.filter((item) => item !== normalized) : [...current, normalized],
    );
  }

  function addBossDashboardFeature() {
    const normalized = normalizeLabel(bossDashboardDraft);
    if (!normalized) return;
    if (!bossDashboardFeatures.includes(normalized)) {
      setBossDashboardFeatures((current) => [...current, normalized]);
    }
    setBossDashboardDraft("");
  }

  function continueCustomDescription() {
    if (!businessDescription.trim()) {
      setBanner({ text: "Tell me what your business does in one line so I can design the right dashboards.", showRetry: false });
      return;
    }
    resetBanner();
    setState((current) => ({ ...current, step: 8 }));
  }

  function continueTeamSize() {
    const numericTeamSize = Number(teamSize);
    if (!Number.isInteger(numericTeamSize) || numericTeamSize < 1 || numericTeamSize > 500) {
      setBanner({ text: "Please enter a team size between 1 and 500.", showRetry: false });
      return;
    }
    resetBanner();
    setState((current) => ({ ...current, step: 9 }));
  }

  function continueDepartments() {
    if (selectedDepartments.length < 1) {
      setBanner({ text: "Add at least one department so I know which teams to plan for.", showRetry: false });
      return;
    }
    resetBanner();
    setCurrentDepartmentIndex(0);
    setState((current) => ({ ...current, step: 10 }));
  }

  function continueDepartmentRoles() {
    const departmentRoles = roleDrafts.filter((role) => role.department === currentDepartment && role.count > 0);
    if (departmentRoles.length < 1) {
      setBanner({ text: `Add at least one role for your ${currentDepartment} team.`, showRetry: false });
      return;
    }
    resetBanner();
    if (currentDepartmentIndex < selectedDepartments.length - 1) {
      setCurrentDepartmentIndex((current) => current + 1);
      return;
    }
    setCurrentRoleQuestionIndex(0);
    setState((current) => ({ ...current, step: 11 }));
  }

  async function continueRoleFeatures() {
    if (!currentRole || currentRole.features.length < 1) {
      setBanner({ text: `Pick at least one daily requirement for ${currentRole?.roleName ?? "this role"}.`, showRetry: false });
      return;
    }
    resetBanner();
    if (currentRoleQuestionIndex < activeRoles.length - 1) {
      setCurrentRoleQuestionIndex((current) => current + 1);
      return;
    }
    setState((current) => ({ ...current, step: 12 }));
  }

  async function continueEmployees() {
    if (employeeMode === null) {
      setBanner({ text: "Choose whether you want to add your team now or later from HR.", showRetry: false });
      return;
    }
    if (employeeMode === "add") {
      if (employeeDrafts.length < 1) {
        setBanner({ text: "Add at least one team member, or choose to do it later from HR.", showRetry: false });
        return;
      }
      const incomplete = employeeDrafts.find(
        (employee) => !employee.name.trim() || !employee.email.trim() || !employee.phone.trim(),
      );
      if (incomplete) {
        setBanner({ text: "Please complete every team member row before continuing.", showRetry: false });
        return;
      }
    } else {
      setEmployeeDrafts([]);
    }

    resetBanner();
    if (isSolarTeamFlow) {
      if (solarReadyPath) {
        redirectToWorkspace(solarReadyPath);
      } else {
        try {
          await activateWorkspaceAndRedirect("/solar-boss");
        } catch (error) {
          handleActivationFailure(error, "/solar-boss");
        }
      }
      return;
    }

    setState((current) => ({ ...current, step: 13 }));
  }

  function continueBossDashboard() {
    if (bossDashboardFeatures.length < 1) {
      setBanner({ text: "Pick at least one command-center widget so we know what you want to see every morning.", showRetry: false });
      return;
    }
    resetBanner();
    setBuildEstimate(
      estimateBuildDays({
        roles: activeRoles,
        employees: employeeDrafts.filter((employee) => employee.name.trim()),
      }),
    );
    setState((current) => ({ ...current, step: 14 }));
  }

  async function submitCustomBuildRequest() {
    resetBanner();
    setBusy(true);
    try {
      const created =
        state.company.id?.trim()
          ? { companyId: state.company.id.trim(), redirectPath: "/bgos/dashboard" }
          : await createCompanyWithRetries(
              {
                source: "NEXA_ENGINE",
                name: companyName.trim(),
                industry: "CUSTOM",
                businessType: "CUSTOM",
                plan: "PRO",
                ...(state.user.id?.trim() ? { user_id: state.user.id.trim() } : {}),
              },
              "/bgos/dashboard",
              "company-create-custom",
            );

      if (!created.companyId) {
        setBanner({
          text: "I am fixing a system issue. Let us retry together.",
          showRetry: true,
          onRetry: () => void submitCustomBuildRequest(),
        });
        return;
      }

      if (!state.company.id) {
        setState((current) => ({
          ...current,
          company: { ...current.company, id: created.companyId },
        }));
      }

      const submitRes = await apiFetch("/api/onboarding/custom-submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: created.companyId,
          businessDescription: businessDescription.trim(),
          teamSize: Number(teamSize),
          departments: selectedDepartments,
          roles: activeRoles,
          employees: employeeDrafts.filter((employee) => employee.name.trim()),
          bossDashboardFeatures,
        }),
      });
      const submitJson = ((await readApiJson(submitRes, "custom-submit")) ?? {}) as {
        success?: boolean;
        error?: string;
        estimatedDays?: string;
      };
      if (!submitRes.ok || submitJson.success !== true) {
        setBanner({
          text: submitJson.error || "Could not submit your build brief. Please try again.",
          showRetry: true,
          onRetry: () => void submitCustomBuildRequest(),
        });
        return;
      }

      setBuildEstimate(submitJson.estimatedDays || buildEstimate);
      setState((current) => ({
        ...current,
        step: 15,
        company: { ...current.company, id: created.companyId },
      }));

      try {
        const redirectPath = await activateWorkspaceAndResolveRedirect(created.redirectPath);
        await sleep(1000);
        redirectToWorkspace(redirectPath);
      } catch (error) {
        handleActivationFailure(error, created.redirectPath);
      }
    } finally {
      setBusy(false);
    }
  }

  function startSolarTeamCollection() {
    const template = getTemplate("SOLAR");
    setSelectedDepartments(template.departments);
    setCurrentDepartmentIndex(0);
    setCurrentRoleQuestionIndex(0);
    setEmployeeMode(null);
    setEmployeeDrafts([]);
    setRoleDrafts([]);
    setState((current) => ({ ...current, step: 10 }));
  }

  const departmentSuggestions = useMemo(
    () => (activeTemplate.departments.length > 0 ? activeTemplate.departments : []),
    [activeTemplate.departments],
  );
  const currentDepartmentSuggestions = useMemo(
    () => (currentDepartment ? activeTemplate.roles[currentDepartment] ?? [] : []),
    [activeTemplate.roles, currentDepartment],
  );
  const currentRoleFeatureSuggestions = useMemo(
    () => (currentRole ? activeTemplate.roleFeatures[currentRole.roleName] ?? [] : []),
    [activeTemplate.roleFeatures, currentRole],
  );
  const visibleBossWidgets = useMemo(
    () => (activeTemplate.bossDashboardFeatures.length > 0 ? activeTemplate.bossDashboardFeatures : []),
    [activeTemplate.bossDashboardFeatures],
  );

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
            <motion.div
              key={`${state.step}-${state.flowType ?? "base"}-${isSolarTeamFlow ? "solar" : "standard"}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {state.step === 0 ? (
                <div className="space-y-4 text-center">
                  <h1 className="text-2xl font-semibold">Hi, I am Nexa, your Virtual CEO.</h1>
                  <p className="text-sm text-white/75">I will set up your business system in minutes.</p>
                  {resume ? <p className="text-xs text-white/55">Picking up where you left off...</p> : null}
                  {addBusiness ? <p className="text-xs text-white/55">Adding another business to your account.</p> : null}
                  {entrySource === "sales" || entrySource === "franchise" ? (
                    <p className="text-xs text-white/55">
                      Guided onboarding{entrySource === "franchise" ? " from your Micro Franchise Partner workspace" : ""}.
                    </p>
                  ) : null}
                  <button onClick={() => void nextFromIntro()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    Start
                  </button>
                </div>
              ) : null}

              {state.step === 1 ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">What should I call you?</p>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                  />
                  <button onClick={() => void nextName()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    Continue
                  </button>
                </div>
              ) : null}

              {state.step === 2 ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">Your email?</p>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                  />
                  <button
                    disabled={busy}
                    onClick={() => void nextEmail()}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {state.step === 3 ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">
                    {state.mode === "existing" ? "Enter your password to continue." : "Set a secure password."}
                  </p>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                  />
                  <button
                    disabled={busy}
                    onClick={() => void submitAccount()}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold disabled:opacity-50"
                  >
                    {state.mode === "existing" ? "Login" : "Create Account"}
                  </button>
                </div>
              ) : null}

              {state.step === 4 ? (
                <div className="space-y-4 text-center">
                  <h2 className="text-xl font-semibold">Welcome Boss, your account is ready.</h2>
                  <button
                    disabled={busy}
                    onClick={() => void loadCategoriesAndContinue()}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold"
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {state.step === 5 ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">Now let us connect BGOS with your business.</p>
                  <input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="Business name"
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                  />
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="w-full appearance-none rounded-[10px] border border-white/10 bg-[#0f172a] py-3 pl-3.5 pr-10 text-sm text-white outline-none [-moz-appearance:none] [-webkit-appearance:none] focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-500/40 [&>option]:bg-[#0f172a] [&>option]:text-white"
                    >
                      <option value="">Select industry</option>
                      {categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400" aria-hidden>
                      v
                    </span>
                  </div>
                  <button onClick={chooseFlow} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    Continue
                  </button>
                </div>
              ) : null}

              {state.step === 6 && state.flowType === "readymade" ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-white/80">Perfect. I will activate your ready-made system.</p>
                  <button
                    disabled={busy}
                    onClick={() => void runReadymade()}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold disabled:opacity-50"
                  >
                    Activate System
                  </button>
                </div>
              ) : null}

              {state.step === 7 && state.flowType === "custom" ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">Tell me about your business in one line. What do you do?</p>
                  <textarea
                    value={businessDescription}
                    onChange={(event) => setBusinessDescription(event.target.value)}
                    placeholder="We sell and install solar panels for homes..."
                    className="min-h-[120px] w-full rounded-lg border border-white/20 bg-black/20 px-3 py-3"
                  />
                  <button onClick={continueCustomDescription} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    Continue
                  </button>
                </div>
              ) : null}

              {state.step === 7 && isSolarTeamFlow ? (
                <div className="space-y-4 text-center">
                  <h2 className="text-xl font-semibold">Your Solar dashboard is ready.</h2>
                  <p className="text-sm text-white/75">
                    Want to add your team now, or do it later from HR?
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button onClick={startSolarTeamCollection} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                      Add Team Now
                    </button>
                    <button
                      onClick={() => {
                        if (solarReadyPath) {
                          redirectToWorkspace(solarReadyPath);
                        } else {
                          void activateWorkspaceAndRedirect("/solar-boss").catch((error) => {
                            handleActivationFailure(error, "/solar-boss");
                          });
                        }
                      }}
                      className="rounded-xl border border-white/15 bg-white/10 px-5 py-2.5 font-semibold text-white"
                    >
                      Go to Dashboard
                    </button>
                  </div>
                </div>
              ) : null}

              {state.step === 8 && state.flowType === "custom" ? (
                <div className="space-y-3">
                  <p className="text-sm text-white/80">How many people work in your company right now?</p>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={teamSize}
                    onChange={(event) => setTeamSize(event.target.value)}
                    className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                  />
                  <button onClick={continueTeamSize} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    Continue
                  </button>
                </div>
              ) : null}

              {state.step === 9 && state.flowType === "custom" ? (
                <div className="space-y-4">
                  <p className="text-sm text-white/80">What departments do you have?</p>
                  {departmentSuggestions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {departmentSuggestions.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleDepartment(item)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition ${chipSelected(selectedDepartments.includes(item))}`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-4 text-sm text-white/55">
                      Add the departments you want me to plan for.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={departmentDraft}
                      onChange={(event) => setDepartmentDraft(event.target.value)}
                      placeholder={departmentSuggestions.length > 0 ? "Add your own department" : "Add department"}
                      className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                    />
                    <button type="button" onClick={addDepartment} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold">
                      Add
                    </button>
                  </div>
                  {selectedDepartments.length > 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-white/75">
                      Selected: {selectedDepartments.join(", ")}
                    </div>
                  ) : null}
                  <button onClick={continueDepartments} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    Continue
                  </button>
                </div>
              ) : null}

              {state.step === 10 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-white/80">For your {currentDepartment} team, what roles do you have?</p>
                    <p className="mt-1 text-xs text-white/50">
                      {currentDepartmentIndex + 1} of {selectedDepartments.length} departments
                    </p>
                  </div>
                  <div className="space-y-3">
                    {currentDepartmentSuggestions.length > 0 ? (
                      currentDepartmentSuggestions.map((roleName) => {
                        const existing = roleDrafts.find((role) => roleKey(role.department, role.roleName) === roleKey(currentDepartment, roleName));
                        const count = existing?.count ?? 0;
                        return (
                          <div key={roleName} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 px-3 py-2">
                            <span className="text-sm text-white/85">{roleName}</span>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => updateRoleCount(currentDepartment, roleName, count - 1)} className="rounded-lg border border-white/15 px-3 py-1 text-sm">
                                -
                              </button>
                              <span className="min-w-8 text-center text-sm">{count}</span>
                              <button type="button" onClick={() => updateRoleCount(currentDepartment, roleName, count + 1)} className="rounded-lg border border-white/15 px-3 py-1 text-sm">
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-4 text-sm text-white/55">
                        Add the roles for this department below.
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={customRoleDraft}
                        onChange={(event) => setCustomRoleDraft(event.target.value)}
                        placeholder={`Add role for ${currentDepartment}`}
                        className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                      />
                      <button type="button" onClick={addCustomRole} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold">
                        Add
                      </button>
                    </div>
                    {roleDrafts.filter((role) => role.department === currentDepartment && role.count > 0).length > 0 ? (
                      <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-white/75">
                        {roleDrafts
                          .filter((role) => role.department === currentDepartment && role.count > 0)
                          .map((role) => `${role.roleName} x${role.count}`)
                          .join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <button onClick={continueDepartmentRoles} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    {currentDepartmentIndex < selectedDepartments.length - 1 ? "Next Department" : "Continue"}
                  </button>
                </div>
              ) : null}

              {state.step === 11 && currentRole ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-white/80">What does your {currentRole.roleName} need to track daily?</p>
                    <p className="mt-1 text-xs text-white/50">
                      {currentRoleQuestionIndex + 1} of {activeRoles.length} role dashboards
                    </p>
                  </div>
                  <div className="grid gap-2">
                    {currentRoleFeatureSuggestions.length > 0 ? (
                      currentRoleFeatureSuggestions.map((feature) => (
                        <label
                          key={feature}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${chipSelected(currentRole.features.includes(feature))}`}
                        >
                          <input
                            type="checkbox"
                            checked={currentRole.features.includes(feature)}
                            onChange={() => toggleRoleFeature(feature)}
                            className="h-4 w-4"
                          />
                          <span>{feature}</span>
                        </label>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-4 text-sm text-white/55">
                        Add the custom requirements this role needs.
                      </div>
                    )}
                  </div>
                  {currentRole.features.length > 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-white/75">
                      Selected: {currentRole.features.join(", ")}
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <input
                      value={roleFeatureDraft}
                      onChange={(event) => setRoleFeatureDraft(event.target.value)}
                      placeholder="Add custom requirement"
                      className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={addCustomFeatureToCurrentRole}
                      className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold"
                    >
                      Add
                    </button>
                  </div>
                  <button onClick={() => void continueRoleFeatures()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    {currentRoleQuestionIndex < activeRoles.length - 1 ? "Next Role" : "Continue"}
                  </button>
                </div>
              ) : null}

              {state.step === 12 ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-white/80">
                      Want to add your team members now? Or do it later from HR?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEmployeeMode("add")}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${chipSelected(employeeMode === "add")}`}
                      >
                        Add Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmployeeMode("skip")}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${chipSelected(employeeMode === "skip")}`}
                      >
                        Skip for now
                      </button>
                    </div>
                  </div>

                  {employeeMode === "add" ? (
                    <div className="space-y-4">
                      {activeRoles.map((role) => {
                        const rows = employeeDrafts
                          .map((employee, index) => ({ employee, index }))
                          .filter(({ employee }) => employee.roleName === role.roleName);
                        return (
                          <div key={roleKey(role.department, role.roleName)} className="rounded-xl border border-white/10 bg-black/15 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{role.roleName}</p>
                                <p className="text-xs text-white/55">{role.department} team</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => addEmployeeRow(role.roleName)}
                                className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold"
                              >
                                Add more
                              </button>
                            </div>
                            {rows.length === 0 ? (
                              <div className="mt-3 rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-4 text-sm text-white/55">
                                Add people for this role if you want us to set them up now.
                              </div>
                            ) : (
                              <div className="mt-3 space-y-3">
                                {rows.map(({ employee, index }) => (
                                  <div key={`${employee.roleName}-${index}`} className="grid gap-2 sm:grid-cols-3">
                                    <input
                                      value={employee.name}
                                      onChange={(event) => updateEmployeeRow(index, "name", event.target.value)}
                                      placeholder="Name"
                                      className="rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                                    />
                                    <input
                                      value={employee.email}
                                      onChange={(event) => updateEmployeeRow(index, "email", event.target.value)}
                                      placeholder="Email"
                                      className="rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                                    />
                                    <input
                                      value={employee.phone}
                                      onChange={(event) => updateEmployeeRow(index, "phone", event.target.value)}
                                      placeholder="Phone"
                                      className="rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <button onClick={() => void continueEmployees()} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    {isSolarTeamFlow ? "Continue to Dashboard" : "Continue"}
                  </button>
                </div>
              ) : null}

              {state.step === 13 && state.flowType === "custom" ? (
                <div className="space-y-4">
                  <p className="text-sm text-white/80">
                    Finally, what do you want to see every morning on your command center?
                  </p>
                  <div className="grid gap-2">
                    {visibleBossWidgets.map((feature) => (
                      <label
                        key={feature}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm ${chipSelected(bossDashboardFeatures.includes(feature))}`}
                      >
                        <input
                          type="checkbox"
                          checked={bossDashboardFeatures.includes(feature)}
                          onChange={() => toggleBossDashboardFeature(feature)}
                          className="h-4 w-4"
                        />
                        <span>{feature}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={bossDashboardDraft}
                      onChange={(event) => setBossDashboardDraft(event.target.value)}
                      placeholder="Add custom widget"
                      className="w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2"
                    />
                    <button type="button" onClick={addBossDashboardFeature} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold">
                      Add
                    </button>
                  </div>
                  {bossDashboardFeatures.length > 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-white/75">
                      Selected: {bossDashboardFeatures.join(", ")}
                    </div>
                  ) : null}
                  <button onClick={continueBossDashboard} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold">
                    Continue
                  </button>
                </div>
              ) : null}

              {state.step === 14 && state.flowType === "custom" ? (
                <div className="space-y-4">
                  <p className="text-sm text-white/80">Here is everything I collected for {companyName}:</p>
                  <div className="rounded-2xl border border-white/10 bg-black/15 p-4 text-sm text-white/80">
                    <p>Company: {companyName}</p>
                    <p>Business: {businessDescription}</p>
                    <p>
                      Team: {teamSize} employees, {selectedDepartments.length} departments
                    </p>
                    <div className="mt-4 space-y-2">
                      <p className="font-semibold text-white">Dashboards I will help build:</p>
                      <p>Boss Dashboard (you)</p>
                      {activeRoles.map((role) => (
                        <p key={roleKey(role.department, role.roleName)}>
                          {role.roleName} Dashboard - {role.count} people
                        </p>
                      ))}
                    </div>
                    <div className="mt-4 space-y-1">
                      <p>Total: {totalDashboards} unique dashboards</p>
                      <p>Estimated: {buildEstimate || "2-3 business days"}</p>
                      <p>We will contact you at {email} once your dashboards are ready.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      disabled={busy}
                      onClick={() => void submitCustomBuildRequest()}
                      className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold disabled:opacity-50"
                    >
                      Submit to Build Team
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((current) => ({ ...current, step: 13 }))}
                      className="rounded-xl border border-white/15 bg-white/10 px-5 py-2.5 font-semibold text-white"
                    >
                      Make Changes
                    </button>
                  </div>
                </div>
              ) : null}

              {state.step === 15 ? (
                <div className="space-y-3 text-center">
                  <h2 className="text-xl font-semibold">Your setup is now in progress.</h2>
                  <p className="text-sm text-white/75">
                    We sent your structured build brief to SDE. Estimated timeline: {buildEstimate || "2-3 business days"}.
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

          {showManualContinue && manualContinuePath ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void activateWorkspaceAndRedirect(manualContinuePath).catch((error) => {
                  handleActivationFailure(error, manualContinuePath);
                });
              }}
              className="mt-4 w-full rounded-xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-50"
            >
              Continue to Dashboard
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
