"use client";

import { IceconnectCustomerPlan, UserRole } from "@prisma/client";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { INTERNAL_ORG_EMPLOYEE_ROLE_OPTIONS } from "@/lib/internal-hr-roles";
import {
  EMAIL_ALREADY_IN_USE_MESSAGE,
  NAME_SIMILARITY_EMAIL_UNIQUE_HINT,
} from "@/lib/user-identity-messages";
import { apiFetch, formatFetchFailure, readApiJson } from "@/lib/api-fetch";

const iceconnectEmployeeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type Member = {
  userId: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  assignedClients?: number;
  pendingTasks?: number;
};

type TeamJson = {
  ok?: boolean;
  departments?: { sales: Member[]; tech: Member[] };
};

type EmployeePanelData = {
  ok: boolean;
  employee: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
    status: "ACTIVE" | "ARCHIVED";
    joiningDate: string;
    department: string | null;
    assignedClients: number;
    pendingTasks: number;
  };
  performance: {
    performanceScore: number;
    leadsHandled: number;
    conversionRate: number;
    tasksCompleted: number;
    revenueGeneratedThisMonth: number;
    rank: number | null;
    teamSize: number;
    graph7: Array<{ day: string; leadsCreated: number; tasksCompleted: number; subscriptions: number }>;
    graph30: Array<{ day: string; leadsCreated: number; tasksCompleted: number; subscriptions: number }>;
  };
  compensation: {
    period: { monthKey: string };
    target: { targetCount: number; targetPlan: IceconnectCustomerPlan | null; baseSalaryRupees: number };
    currentAchievementPct: number;
    basePayoutPreviewRupees: number;
    incentivesBonusPreviewRupees: number;
    payoutPreviewRupees: number;
    payoutLockedReason: string | null;
    canCreatePayrollPayout: boolean;
  };
  kyc: {
    status: "PENDING" | "VERIFIED";
    bankDetails: string | null;
    pan: string | null;
    panDocumentId: string | null;
    idDocumentId: string | null;
  };
  incentives: {
    enabled: boolean;
    bonusDealsThreshold: number;
    bonusDealsAmount: number;
    incentivesValidUntil: string | null;
    promotionEnabled: boolean;
    promotionValidUntil: string | null;
    promotionPerformanceThreshold: number;
  };
};

type PanelTab = "profile" | "performance" | "compensation" | "targets" | "incentives" | "security";

function initials(name: string) {
  const p = name.trim().split(/\s+/).slice(0, 2);
  return p.map((x) => x[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function ControlTeamPage() {
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [data, setData] = useState<TeamJson["departments"] | null>(null);
  const [dept, setDept] = useState<"sales" | "tech" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.SALES_EXECUTIVE);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [formMsgIsError, setFormMsgIsError] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [panelBusy, setPanelBusy] = useState(false);
  const [panelMsg, setPanelMsg] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [panelData, setPanelData] = useState<EmployeePanelData | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [tab, setTab] = useState<PanelTab>("profile");
  const [confirmArchive, setConfirmArchive] = useState(false);

  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pDepartment, setPDepartment] = useState("");
  const [tMonthlyTarget, setTMonthlyTarget] = useState("0");
  const [tSalary, setTSalary] = useState("0");
  const [tPlan, setTPlan] = useState<IceconnectCustomerPlan>(IceconnectCustomerPlan.BASIC);
  const [iEnabled, setIEnabled] = useState(false);
  const [iThreshold, setIThreshold] = useState("0");
  const [iAmount, setIAmount] = useState("0");
  const [iValidUntil, setIValidUntil] = useState("");
  const [pEnabled, setPEnabled] = useState(false);
  const [pValidUntil, setPValidUntil] = useState("");
  const [pPerfThreshold, setPPerfThreshold] = useState("80");
  const [kycStatus, setKycStatus] = useState<"PENDING" | "VERIFIED">("PENDING");
  const [kycBank, setKycBank] = useState("");
  const [kycPan, setKycPan] = useState("");
  const [kycPanDoc, setKycPanDoc] = useState("");
  const [kycIdDoc, setKycIdDoc] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/bgos/control/team", { credentials: "include" });
      const j = ((await readApiJson(res, "control/team")) ?? {}) as TeamJson & {
        error?: string;
        code?: string;
      };
      if (!res.ok || !j.ok || !j.departments) {
        const hint =
          typeof j.error === "string" && j.error.trim()
            ? j.error
            : j.code === "FORBIDDEN"
              ? "Sign in with the platform boss account (BGOS_BOSS_EMAIL)."
              : j.code === "MISCONFIGURED"
                ? "Server: set BGOS_BOSS_EMAIL in environment."
                : "Could not load team.";
        setError(hint);
        return;
      }
      setData(j.departments);
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach team API"));
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const members = useMemo(() => {
    if (!data || !dept) return [];
    return dept === "sales" ? data.sales : data.tech;
  }, [data, dept]);
  const recycleBin = useMemo(() => members.filter((m) => m.isActive === false), [members]);

  const cardShell = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-6";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    setFormMsgIsError(false);
    const fields = iceconnectEmployeeSchema.safeParse({ name, email, password });
    if (!fields.success) {
      const fe = fields.error.flatten().fieldErrors;
      setFormMsg(
        fe.name?.[0] ?? fe.email?.[0] ?? fe.password?.[0] ?? "Check the form and try again.",
      );
      setFormMsgIsError(true);
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/bgos/control/team/employees", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields.data, role }),
      });
      const j = ((await readApiJson(res, "control/team/employees")) ?? {}) as {
        ok?: boolean;
        error?: string;
        message?: string;
        code?: string;
      };
      if (!res.ok || !j.ok) {
        const duplicate =
          j.code === "EMAIL_IN_USE" ||
          j.code === "DUPLICATE_EMAIL" ||
          j.code === "EMAIL_TAKEN";
        const text =
          (typeof j.error === "string" && j.error.trim()) ||
          (typeof j.message === "string" && j.message.trim()) ||
          "";
        setFormMsg(duplicate ? EMAIL_ALREADY_IN_USE_MESSAGE : text || "Could not create employee");
        setFormMsgIsError(true);
        return;
      }
      setFormMsg("Created — employee can log in on ICECONNECT with this email.");
      setFormMsgIsError(false);
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (e) {
      console.error("API ERROR:", e);
      setFormMsg(formatFetchFailure(e, "Could not reach team API"));
      setFormMsgIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function patchMember(id: string, payload: Record<string, unknown>) {
    setPanelBusy(true);
    setPanelMsg(null);
    try {
      const res = await apiFetch(`/api/users/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = ((await readApiJson(res, "control-team-patch-member")) ?? {}) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setPanelMsg(j.error || "Could not update member.");
        return;
      }
      setPanelMsg("Saved.");
      await load();
    } catch (e) {
      console.error("API ERROR:", e);
      setPanelMsg(formatFetchFailure(e, "Could not update member"));
    } finally {
      setPanelBusy(false);
    }
  }

  async function loadEmployeePanel(id: string) {
    setPanelLoading(true);
    setPanelMsg(null);
    try {
      const res = await apiFetch(`/api/bgos/control/team/employees/${id}`, { credentials: "include" });
      const j = ((await readApiJson(res, "control-team-load-panel")) ?? {}) as EmployeePanelData & {
        error?: string;
      };
      if (!res.ok || !j?.ok) {
        setPanelMsg(j?.error || "Could not load employee panel.");
        setPanelData(null);
        return;
      }
      setPanelData(j);
      setPName(j.employee.name);
      setPPhone(j.employee.phone ?? "");
      setPDepartment(j.employee.department ?? "");
      setTMonthlyTarget(String(j.compensation.target.targetCount ?? 0));
      setTSalary(String(j.compensation.target.baseSalaryRupees ?? 0));
      setTPlan(j.compensation.target.targetPlan ?? IceconnectCustomerPlan.BASIC);
      setIEnabled(Boolean(j.incentives.enabled));
      setIThreshold(String(j.incentives.bonusDealsThreshold ?? 0));
      setIAmount(String(j.incentives.bonusDealsAmount ?? 0));
      setIValidUntil(j.incentives.incentivesValidUntil ? String(j.incentives.incentivesValidUntil).slice(0, 10) : "");
      setPEnabled(Boolean(j.incentives.promotionEnabled));
      setPValidUntil(j.incentives.promotionValidUntil ? String(j.incentives.promotionValidUntil).slice(0, 10) : "");
      setPPerfThreshold(String(j.incentives.promotionPerformanceThreshold ?? 80));
      setKycStatus(j.kyc.status);
      setKycBank(j.kyc.bankDetails ?? "");
      setKycPan(j.kyc.pan ?? "");
      setKycPanDoc(j.kyc.panDocumentId ?? "");
      setKycIdDoc(j.kyc.idDocumentId ?? "");
    } catch (e) {
      setPanelMsg(formatFetchFailure(e, "Could not load employee panel"));
    } finally {
      setPanelLoading(false);
    }
  }

  async function resetMemberPassword(id: string) {
    if (!newPassword.trim() || newPassword.trim().length < 8) {
      setPanelMsg("Password must be at least 8 characters.");
      return;
    }
    setPanelBusy(true);
    setPanelMsg(null);
    try {
      const res = await apiFetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword.trim() }),
      });
      const j = ((await readApiJson(res, "control-team-reset-password")) ?? {}) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setPanelMsg(j.error || "Could not reset password.");
        return;
      }
      setPanelMsg("Password reset complete.");
      setNewPassword("");
    } catch (e) {
      console.error("API ERROR:", e);
      setPanelMsg(formatFetchFailure(e, "Could not reset password"));
    } finally {
      setPanelBusy(false);
    }
  }

  async function saveProfile() {
    if (!selected) return;
    setPanelBusy(true);
    setPanelMsg(null);
    try {
      const res = await apiFetch(`/api/bgos/control/team/employees/${selected.userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pName.trim(),
          mobile: pPhone.trim(),
          department: pDepartment.trim(),
        }),
      });
      const j = ((await readApiJson(res, "control-team-save-profile")) ?? {}) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setPanelMsg(j.error || "Could not save profile");
        return;
      }
      setPanelMsg("Profile saved.");
      await load();
      await loadEmployeePanel(selected.userId);
    } catch (e) {
      setPanelMsg(formatFetchFailure(e, "Could not save profile"));
    } finally {
      setPanelBusy(false);
    }
  }

  async function saveTargets() {
    if (!selected) return;
    setPanelBusy(true);
    setPanelMsg(null);
    try {
      const res = await apiFetch(`/api/bgos/control/team/employees/${selected.userId}/target`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyTargetCount: Number(tMonthlyTarget) || 0,
          salaryRupees: Number(tSalary) || 0,
          targetPlan: tPlan,
        }),
      });
      const j = ((await readApiJson(res, "control-team-save-targets")) ?? {}) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setPanelMsg(j.error || "Could not save targets");
        return;
      }
      setPanelMsg("Targets updated.");
      await loadEmployeePanel(selected.userId);
    } catch (e) {
      setPanelMsg(formatFetchFailure(e, "Could not save targets"));
    } finally {
      setPanelBusy(false);
    }
  }

  async function saveIncentives() {
    if (!selected) return;
    setPanelBusy(true);
    setPanelMsg(null);
    try {
      const res = await apiFetch(`/api/bgos/control/team/employees/${selected.userId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incentivesEnabled: iEnabled,
          bonusDealsThreshold: Number(iThreshold) || 0,
          bonusDealsAmount: Number(iAmount) || 0,
          incentivesValidUntil: iValidUntil ? `${iValidUntil}T00:00:00.000Z` : null,
          promotionEnabled: pEnabled,
          promotionValidUntil: pValidUntil ? `${pValidUntil}T00:00:00.000Z` : null,
          promotionPerformanceThreshold: Number(pPerfThreshold) || 80,
        }),
      });
      const j = ((await readApiJson(res, "control-team-save-incentives")) ?? {}) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setPanelMsg(j.error || "Could not save incentives");
        return;
      }
      setPanelMsg("Incentives & promotion rules saved.");
      await loadEmployeePanel(selected.userId);
    } catch (e) {
      setPanelMsg(formatFetchFailure(e, "Could not save incentives"));
    } finally {
      setPanelBusy(false);
    }
  }

  async function saveKyc() {
    if (!selected) return;
    setPanelBusy(true);
    setPanelMsg(null);
    try {
      const res = await apiFetch(`/api/bgos/control/team/employees/${selected.userId}/kyc`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: kycStatus,
          bankDetails: kycBank.trim(),
          pan: kycPan.trim(),
          panDocumentId: kycPanDoc.trim() || null,
          idDocumentId: kycIdDoc.trim() || null,
        }),
      });
      const j = ((await readApiJson(res, "control-team-save-kyc")) ?? {}) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setPanelMsg(j.error || "Could not save KYC");
        return;
      }
      setPanelMsg("KYC updated.");
      await loadEmployeePanel(selected.userId);
    } catch (e) {
      setPanelMsg(formatFetchFailure(e, "Could not save KYC"));
    } finally {
      setPanelBusy(false);
    }
  }

  async function archiveEmployee() {
    if (!selected) return;
    setPanelBusy(true);
    setPanelMsg(null);
    try {
      const res = await apiFetch(`/api/bgos/control/team/employees/${selected.userId}/archive`, {
        method: "POST",
        credentials: "include",
      });
      const j = ((await readApiJson(res, "control-team-archive")) ?? {}) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setPanelMsg(j.error || "Could not archive employee.");
        return;
      }
      setConfirmArchive(false);
      setPanelMsg("Employee archived. Access revoked.");
      await load();
      await loadEmployeePanel(selected.userId);
    } catch (e) {
      setPanelMsg(formatFetchFailure(e, "Could not archive employee"));
    } finally {
      setPanelBusy(false);
    }
  }

  async function restoreEmployee() {
    if (!selected) return;
    setPanelBusy(true);
    setPanelMsg(null);
    try {
      const res = await apiFetch(`/api/bgos/control/team/employees/${selected.userId}/restore`, {
        method: "POST",
        credentials: "include",
      });
      const j = ((await readApiJson(res, "control-team-restore")) ?? {}) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setPanelMsg(j.error || "Could not restore employee.");
        return;
      }
      setPanelMsg("Employee restored.");
      await load();
      await loadEmployeePanel(selected.userId);
    } catch (e) {
      setPanelMsg(formatFetchFailure(e, "Could not restore employee"));
    } finally {
      setPanelBusy(false);
    }
  }

  return (
    <div className={`mx-auto max-w-5xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white"}>People &amp; HR</h1>
          <p className={muted + " mt-1"}>Full HR + Performance + Payroll control for internal ICECONNECT employees.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormOpen((v) => !v);
            setFormMsg(null);
            setFormMsgIsError(false);
          }}
          className={
            light
              ? "rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
              : "rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
          }
        >
          {formOpen ? "Close form" : "Add employee"}
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-amber-500">{error}</p> : null}

      {formOpen ? (
        <form onSubmit={onCreate} className={cardShell + " mb-8 space-y-3"}>
          <p className={light ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-white"}>
            New employee (ICECONNECT)
          </p>
          <div>
            <input
              required
              className={
                light
                  ? "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  : "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40"
              }
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className={muted + " mt-1"}>{NAME_SIMILARITY_EMAIL_UNIQUE_HINT}</p>
          </div>
          <input
            required
            type="email"
            className={
              light
                ? "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                : "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40"
            }
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            required
            type="password"
            minLength={8}
            className={
              light
                ? "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                : "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40"
            }
            placeholder="Password (min 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            className={
              light
                ? "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                : "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
            }
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {INTERNAL_ORG_EMPLOYEE_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-white text-slate-900">
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create & assign company"}
          </button>
          {formMsg ? (
            <p
              className={
                formMsgIsError
                  ? light
                    ? "text-xs text-red-600"
                    : "text-xs text-red-400"
                  : light
                    ? "text-xs text-emerald-700"
                    : "text-xs text-emerald-400"
              }
            >
              {formMsg}
            </p>
          ) : null}
        </form>
      ) : null}

      {!dept ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => setDept("sales")} className={cardShell + " text-left"}>
            <p className={light ? "text-lg font-bold text-slate-900" : "text-lg font-bold text-white"}>Sales</p>
            <p className={muted + " mt-2"}>{data?.sales.length ?? 0} people</p>
          </button>
          <button type="button" onClick={() => setDept("tech")} className={cardShell + " text-left"}>
            <p className={light ? "text-lg font-bold text-slate-900" : "text-lg font-bold text-white"}>Tech</p>
            <p className={muted + " mt-2"}>{data?.tech.length ?? 0} people</p>
          </button>
        </div>
      ) : (
        <div>
          <button
            type="button"
            className={muted + " mb-4 text-xs font-semibold hover:underline"}
            onClick={() => setDept(null)}
          >
            ← Departments
          </button>
          <div className="grid gap-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
            {members.length === 0 ? (
              <p className={muted}>No employees in this department yet.</p>
            ) : (
              members.map((m) => (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => {
                    setSelected(m);
                    setTab("profile");
                    void loadEmployeePanel(m.userId);
                  }}
                  className={
                    cardShell +
                    " flex items-center gap-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-400/35"
                  }
                >
                  <div
                    className={
                      light
                        ? "flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-900"
                        : "flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-100"
                    }
                  >
                    {initials(m.name)}
                  </div>
                  <div className="min-w-0">
                    <p className={light ? "truncate text-sm font-semibold text-slate-900" : "truncate text-sm font-semibold text-white"}>
                      {m.name}
                    </p>
                    <p className={light ? "text-xs text-slate-500" : "text-xs text-white/50"}>{m.role}</p>
                    <p className={light ? "text-[11px] text-slate-500" : "text-[11px] text-white/55"}>
                      Clients: {m.assignedClients ?? 0} · Pending: {m.pendingTasks ?? 0}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
          {recycleBin.length > 0 ? (
            <div className={cardShell + " mt-4"}>
              <p className={light ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-white"}>
                Archived Employees
              </p>
              <div className="mt-2 space-y-2">
                {recycleBin.map((m) => (
                  <div key={m.userId} className="flex items-center justify-between gap-2">
                    <p className={muted}>{m.name}</p>
                    <button
                      type="button"
                      onClick={() => void patchMember(m.userId, { isActive: true })}
                      className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
      {selected ? (
        createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-gradient-to-br from-[#0f172a] to-[#1a1f2e] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-100">
                  {initials(panelData?.employee.name || selected.name)}
                </div>
                <div>
                  <p className="text-lg font-semibold">{panelData?.employee.name || selected.name}</p>
                  <p className="text-xs text-white/60">{panelData?.employee.role || selected.role}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${panelData?.employee.status === "ARCHIVED" ? "bg-rose-500/20 text-rose-200" : "bg-emerald-500/20 text-emerald-200"}`}>
                  {panelData?.employee.status || "ACTIVE"}
                </span>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-sm text-white/70 hover:text-white">
                Close
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {([
                ["profile", "Profile"],
                ["performance", "Performance"],
                ["compensation", "Compensation"],
                ["targets", "Targets"],
                ["incentives", "Incentives"],
                ["security", "Access & Security"],
              ] as Array<[PanelTab, string]>).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tab === k ? "bg-cyan-500 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.45)]" : "bg-white/8 text-white/70 hover:bg-white/12 hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 max-h-[65vh] overflow-y-auto rounded-xl border border-white/10 bg-black/15 p-4">
              {panelLoading ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-white/70">Loading employee data...</p>
                  {selected ? (
                    <button
                      type="button"
                      onClick={() => void loadEmployeePanel(selected.userId)}
                      className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!panelLoading && !panelData ? (
                <div className="space-y-2">
                  <p className="text-sm text-rose-200">Failed to load employee data.</p>
                  {selected ? (
                    <button
                      type="button"
                      onClick={() => void loadEmployeePanel(selected.userId)}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
              {tab === "profile" && panelData ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Name" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <input value={panelData.employee.email} readOnly className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/60" />
                  <input value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="Phone" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <input value={panelData.employee.role} readOnly className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/60" />
                  <input value={pDepartment} onChange={(e) => setPDepartment(e.target.value)} placeholder="Department" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <input value={new Date(panelData.employee.joiningDate).toLocaleDateString()} readOnly className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/60" />
                  <div className="sm:col-span-2 text-xs text-white/60">Assigned Clients: {panelData.employee.assignedClients}</div>
                  <div className="sm:col-span-2 flex gap-2">
                    <button type="button" disabled={panelBusy} onClick={() => void saveProfile()} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950">Save Changes</button>
                    <button type="button" onClick={() => void loadEmployeePanel(selected.userId)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white">Cancel</button>
                  </div>
                </div>
              ) : null}
              {tab === "performance" && panelData ? (
                <div className="space-y-3 text-sm">
                  <p>Performance Score: <span className="font-semibold">{panelData.performance.performanceScore}</span></p>
                  <p>Leads handled: {panelData.performance.leadsHandled} · Conversion: {panelData.performance.conversionRate}%</p>
                  <p>Revenue generated: ₹{Math.round(panelData.performance.revenueGeneratedThisMonth).toLocaleString("en-IN")}</p>
                  <p>Tasks completed: {panelData.performance.tasksCompleted}</p>
                  <p>Rank: {panelData.performance.rank ? `${panelData.performance.rank}/${panelData.performance.teamSize}` : "-"}</p>
                  <div className="grid grid-cols-7 gap-1">
                    {panelData.performance.graph7.map((g) => (
                      <div key={g.day} className="rounded border border-white/10 bg-white/5 p-2 text-center text-[10px]">
                        <p>{g.day.slice(5)}</p><p>L{g.leadsCreated}</p><p>S{g.subscriptions}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {tab === "compensation" && panelData ? (
                <div className="space-y-2 text-sm">
                  <p>Base Salary: ₹{panelData.compensation.target.baseSalaryRupees.toLocaleString("en-IN")}</p>
                  <p>Target Required: {panelData.compensation.target.targetCount} ({panelData.compensation.target.targetPlan || "BASIC"})</p>
                  <p>Current Achievement: {panelData.compensation.currentAchievementPct}%</p>
                  <p>Payout Preview: ₹{panelData.compensation.payoutPreviewRupees.toLocaleString("en-IN")}</p>
                  {panelData.compensation.payoutLockedReason ? <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-amber-100">{panelData.compensation.payoutLockedReason}</p> : null}
                  <p className="text-xs text-white/60">If achievement &lt; 100%, payout scales by achievement percentage.</p>
                </div>
              ) : null}
              {tab === "targets" && panelData ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={tMonthlyTarget} onChange={(e) => setTMonthlyTarget(e.target.value)} placeholder="Monthly target count" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <input value={tSalary} onChange={(e) => setTSalary(e.target.value)} placeholder="Base Salary (₹)" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <select value={tPlan} onChange={(e) => setTPlan(e.target.value as IceconnectCustomerPlan)} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                    <option value={IceconnectCustomerPlan.BASIC} className="bg-slate-900">Sales - Basic</option>
                    <option value={IceconnectCustomerPlan.PRO} className="bg-slate-900">Sales - Pro</option>
                    <option value={IceconnectCustomerPlan.ENTERPRISE} className="bg-slate-900">Sales - Enterprise</option>
                  </select>
                  <button type="button" disabled={panelBusy} onClick={() => void saveTargets()} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950">Save Targets</button>
                </div>
              ) : null}
              {tab === "incentives" && panelData ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={iEnabled} onChange={(e) => setIEnabled(e.target.checked)} /> Bonus enabled</label>
                  <input value={iThreshold} onChange={(e) => setIThreshold(e.target.value)} placeholder="Close X deals" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <input value={iAmount} onChange={(e) => setIAmount(e.target.value)} placeholder="Bonus amount ₹" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <input type="date" value={iValidUntil} onChange={(e) => setIValidUntil(e.target.value)} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pEnabled} onChange={(e) => setPEnabled(e.target.checked)} /> Promotion rule enabled</label>
                  <input value={pPerfThreshold} onChange={(e) => setPPerfThreshold(e.target.value)} placeholder="Promotion perf threshold %" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <input type="date" value={pValidUntil} onChange={(e) => setPValidUntil(e.target.value)} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  <button type="button" disabled={panelBusy} onClick={() => void saveIncentives()} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950">Save Incentives</button>
                </div>
              ) : null}
              {tab === "security" && panelData ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">KYC &amp; Payout Status</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select value={kycStatus} onChange={(e) => setKycStatus(e.target.value as "PENDING" | "VERIFIED")} className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm">
                      <option value="PENDING" className="bg-slate-900">Pending</option>
                      <option value="VERIFIED" className="bg-slate-900">Verified</option>
                    </select>
                    <input value={kycBank} onChange={(e) => setKycBank(e.target.value)} placeholder="Bank details" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                    <input value={kycPan} onChange={(e) => setKycPan(e.target.value)} placeholder="PAN" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                    <input value={kycPanDoc} onChange={(e) => setKycPanDoc(e.target.value)} placeholder="PAN doc id" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                    <input value={kycIdDoc} onChange={(e) => setKycIdDoc(e.target.value)} placeholder="ID doc id" className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm" />
                  </div>
                  <button type="button" disabled={panelBusy} onClick={() => void saveKyc()} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950">Save KYC</button>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 8)" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" />
                    <button type="button" disabled={panelBusy} onClick={() => void resetMemberPassword(selected.userId)} className="mt-2 rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">Reset password</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href="/iceconnect/dashboard" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white">View Employee Dashboard</a>
                    {panelData.employee.status === "ARCHIVED" ? (
                      <button type="button" disabled={panelBusy} onClick={() => void restoreEmployee()} className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">Restore Employee</button>
                    ) : (
                      <button type="button" disabled={panelBusy} onClick={() => setConfirmArchive(true)} className="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100">Archive Employee</button>
                    )}
                  </div>
                  {confirmArchive ? (
                    <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                      <p>Are you sure? This will revoke ICECONNECT access.</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => void archiveEmployee()} className="rounded bg-rose-600 px-2.5 py-1 font-semibold text-white">Yes, archive</button>
                        <button type="button" onClick={() => setConfirmArchive(false)} className="rounded bg-white/10 px-2.5 py-1 font-semibold text-white">Cancel</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            {panelMsg ? <p className={muted + " mt-3"}>{panelMsg}</p> : null}
          </div>
        </div>,
        document.getElementById("modal-root") ?? document.body
      )
      ) : null}
    </div>
  );
}
