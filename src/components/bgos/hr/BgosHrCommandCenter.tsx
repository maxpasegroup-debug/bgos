"use client";

import { UserManualCategory, UserRole } from "@prisma/client";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BgosAddEmployeeForm } from "@/components/bgos/BgosAddEmployeeForm";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { ViewModuleGuideButton } from "@/components/bgos/ViewModuleGuideButton";
import {
  INTERNAL_ORG_EMPLOYEE_ROLE_OPTIONS,
  SOLAR_FIELD_EMPLOYEE_ROLE_OPTIONS,
} from "@/lib/internal-hr-roles";

type HrFilter = "all" | "active" | "on_leave";

type Employee = {
  id: string;
  name: string;
  phone: string;
  role: string;
  roleLabel: string;
  joiningDate: string;
  status: "ACTIVE" | "ON_LEAVE";
  performanceScore: number;
  performance: {
    leadsHandled: number;
    tasksCompleted: number;
    conversionPercent: number;
    efficiencyPercent: number;
  };
  attendanceToday: {
    checkIn: string | null;
    checkOut: string | null;
    present: boolean;
  };
  pipActive: boolean;
};

type HrData = {
  employees: Employee[];
  attendance: {
    present: number;
    absent: number;
    today: { userId: string; name: string; status: "PRESENT" | "ABSENT"; checkIn: string | null; checkOut: string | null }[];
  };
  leaves: {
    pending: number;
    approved: number;
    requests: {
      id: string;
      userId: string;
      userName: string;
      fromDate: string;
      toDate: string;
      reason: string;
      status: "PENDING" | "APPROVED" | "REJECTED";
    }[];
  };
  performance: {
    topPerformerId: string | null;
    lowPerformerIds: string[];
  };
  insights: {
    insightLines: string[];
    suggestionLines: string[];
  };
};

type EmployeeDetail = {
  employee: {
    id: string;
    name: string;
    phone: string;
    role: UserRole;
    roleLabel: string;
    joiningDate: string;
    active: boolean;
  };
  performance: {
    leadsHandled: number;
    tasksCompleted: number;
    conversionPercent: number;
    efficiencyPercent: number;
  };
  pips: {
    id: string;
    goal: string;
    progress: number;
    isCompleted: boolean;
    dueDate: string | null;
    createdAt: string;
  }[];
};

function fDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function BgosHrCommandCenter() {
  const [internalOrg, setInternalOrg] = useState(false);
  const [filter, setFilter] = useState<HrFilter>("all");
  const [data, setData] = useState<HrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nexaLine, setNexaLine] = useState<string | null>(null);

  const roleOptions = useMemo(
    () => (internalOrg ? INTERNAL_ORG_EMPLOYEE_ROLE_OPTIONS : SOLAR_FIELD_EMPLOYEE_ROLE_OPTIONS),
    [internalOrg],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/company/current", { credentials: "include" });
        const j = (await res.json()) as { ok?: boolean; company?: { internalSalesOrg?: boolean } };
        if (!cancelled && res.ok && j.ok && j.company?.internalSalesOrg) setInternalOrg(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [leaveForm, setLeaveForm] = useState({ fromDate: "", toDate: "", reason: "" });
  const [pipForm, setPipForm] = useState({ goal: "", dueDate: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bgos/hr?filter=${encodeURIComponent(filter)}`, {
        credentials: "include",
      });
      const j = (await res.json()) as { data?: HrData; error?: string; message?: string };
      if (!res.ok) {
        setError(j.error ?? j.message ?? "Could not load HR data.");
        setData(null);
      } else {
        setData(j.data ?? (j as unknown as HrData));
      }
    } catch {
      setError("Could not load HR data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback(async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/bgos/hr/employee/${encodeURIComponent(id)}`, { credentials: "include" });
      const j = (await res.json()) as { data?: EmployeeDetail };
      setDetail(j.data ?? (j as unknown as EmployeeDetail));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const topPerformerId = data?.performance.topPerformerId ?? null;
  const lowSet = useMemo(() => new Set(data?.performance.lowPerformerIds ?? []), [data?.performance.lowPerformerIds]);

  async function updateRole(role: UserRole) {
    if (!detail) return;
    setBusy(true);
    try {
      await fetch("/api/users/update", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detail.employee.id, role }),
      });
      await openDetail(detail.employee.id);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!detail) return;
    const password = window.prompt("Set new password (min 8 chars):", "");
    if (!password) return;
    setBusy(true);
    try {
      await fetch("/api/users/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.employee.id, password }),
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeEmployee() {
    if (!detail) return;
    if (!window.confirm(`Remove ${detail.employee.name} from active team?`)) return;
    setBusy(true);
    try {
      await fetch("/api/users/update", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: detail.employee.id, isActive: false }),
      });
      setDetailId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function checkIn() {
    await fetch("/api/hr/attendance/checkin", { method: "POST", credentials: "include" });
    await load();
  }
  async function checkOut() {
    await fetch("/api/hr/attendance/checkout", { method: "POST", credentials: "include" });
    await load();
  }
  async function applyLeave() {
    await fetch("/api/hr/leave/apply", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leaveForm),
    });
    setLeaveForm({ fromDate: "", toDate: "", reason: "" });
    await load();
  }
  async function setLeaveStatus(id: string, status: "APPROVED" | "REJECTED") {
    await fetch("/api/hr/leave/status", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }
  async function createPip() {
    if (!detail) return;
    await fetch("/api/bgos/hr/pip", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: detail.employee.id,
        goal: pipForm.goal,
        dueDate: pipForm.dueDate || undefined,
      }),
    });
    setPipForm({ goal: "", dueDate: "" });
    await openDetail(detail.employee.id);
    await load();
  }
  async function updatePip(id: string, progress: number, done: boolean) {
    await fetch("/api/bgos/hr/pip", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, progress, isCompleted: done }),
    });
    if (detail) await openDetail(detail.employee.id);
    await load();
  }

  return (
    <div className={`${BGOS_MAIN_PAD} w-full pb-12 pt-5`}>
      <div className="w-full">
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Team</h1>
              <p className="mt-1 text-sm text-white/60">Manage your people and performance</p>
            </div>
            <div className="flex items-center gap-2">
              <ViewModuleGuideButton category={UserManualCategory.HR} />
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2.5 text-sm font-semibold text-[#FFE08A]"
              >
                Add Employee
              </button>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as HrFilter)}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
          </div>
        </section>

        <section className="mb-8">
          {loading && !data ? (
            <div className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
          ) : (data?.employees.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <p className="text-lg font-medium text-white/90">No team members yet</p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="mt-4 rounded-xl border border-[#FFC300]/35 bg-[#FFC300]/10 px-4 py-2.5 text-sm font-semibold text-[#FFE08A]"
              >
                Add your first employee
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data?.employees.map((e) => (
                <motion.button
                  key={e.id}
                  type="button"
                  onClick={() => void openDetail(e.id)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border p-4 text-left ${
                    e.id === topPerformerId
                      ? "border-emerald-400/35 bg-emerald-500/[0.08]"
                      : lowSet.has(e.id)
                        ? "border-red-400/35 bg-red-500/[0.08]"
                        : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{e.name}</p>
                  <p className="mt-1 text-xs text-white/60">{e.roleLabel}</p>
                  <p className="mt-2 text-xs text-white/60">Status: {e.status === "ACTIVE" ? "Active" : "Leave"}</p>
                  <p className="mt-1 text-xs font-medium text-white/80">Performance score: {e.performanceScore}</p>
                </motion.button>
              ))}
            </div>
          )}
        </section>

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
            <h2 className="text-lg font-semibold text-white">Attendance</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void checkIn()}
                className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
              >
                Check-in
              </button>
              <button
                type="button"
                onClick={() => void checkOut()}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/85"
              >
                Check-out
              </button>
              <span className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white/75">
                Present: {data?.attendance.present ?? 0} · Absent: {data?.attendance.absent ?? 0}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {data?.attendance.today.map((a) => (
                <div key={a.userId} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="text-sm text-white">{a.name}</p>
                  <p className="text-xs text-white/60">
                    {a.status} · In {fDate(a.checkIn)} / Out {fDate(a.checkOut)}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-lg font-semibold text-white">Nexa HR Insights</h2>
            <div className="mt-3 space-y-2">
              {data?.insights.insightLines.map((l) => (
                <p key={l} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/80">
                  {l}
                </p>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {data?.insights.suggestionLines.map((l) => (
                <p key={l} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
                  {l}
                </p>
              ))}
            </div>
            {nexaLine ? <p className="mt-3 text-sm text-[#FFC300]/85">{nexaLine}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setNexaLine("Fix Now: start training for underperforming members this week.")}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100"
              >
                Fix Now
              </button>
              <button
                type="button"
                onClick={() => setNexaLine("Apply PIP: set a clear 7-day conversion goal.")}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/85"
              >
                Apply PIP
              </button>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Leave management</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              type="date"
              value={leaveForm.fromDate}
              onChange={(e) => setLeaveForm((s) => ({ ...s, fromDate: e.target.value }))}
              className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            />
            <input
              type="date"
              value={leaveForm.toDate}
              onChange={(e) => setLeaveForm((s) => ({ ...s, toDate: e.target.value }))}
              className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            />
            <input
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm((s) => ({ ...s, reason: e.target.value }))}
              placeholder="Reason"
              className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => void applyLeave()}
              className="rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]"
            >
              Apply Leave
            </button>
          </div>
          <p className="mt-3 text-xs text-white/55">
            Pending leaves: {data?.leaves.pending ?? 0} · Approved leaves: {data?.leaves.approved ?? 0}
          </p>
          <div className="mt-3 space-y-2">
            {data?.leaves.requests.map((r) => (
              <div key={r.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-white">
                    {r.userName} · {fDate(r.fromDate)} → {fDate(r.toDate)} · {r.status}
                  </p>
                  {r.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void setLeaveStatus(r.id, "APPROVED")}
                        className="rounded-md border border-emerald-400/30 px-2 py-1 text-xs text-emerald-200"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void setLeaveStatus(r.id, "REJECTED")}
                        className="rounded-md border border-red-400/30 px-2 py-1 text-xs text-red-200"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-white/60">{r.reason}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-white">Performance tracking</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data?.employees.map((e) => (
              <div
                key={e.id}
                className={`rounded-xl border p-4 ${
                  e.id === topPerformerId
                    ? "border-emerald-400/35 bg-emerald-500/[0.08]"
                    : lowSet.has(e.id)
                      ? "border-red-400/35 bg-red-500/[0.08]"
                      : "border-white/10 bg-black/20"
                }`}
              >
                <p className="text-sm font-semibold text-white">{e.name}</p>
                <p className="mt-2 text-xs text-white/70">Tasks completed: {e.performance.tasksCompleted}</p>
                <p className="text-xs text-white/70">Leads converted: {e.performance.conversionPercent}%</p>
                <p className="text-xs text-white/70">Efficiency: {e.performance.efficiencyPercent}%</p>
              </div>
            ))}
          </div>
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0F141E] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add Employee</h3>
              <button type="button" onClick={() => setAddOpen(false)} className="text-sm text-white/65">
                Close
              </button>
            </div>
            <BgosAddEmployeeForm />
          </div>
        </div>
      ) : null}

      {detailId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setDetailId(null)}>
          <div
            className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0F141E] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {detailLoading || !detail ? (
              <div className="h-32 animate-pulse rounded-xl bg-white/[0.05]" />
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{detail.employee.name}</h3>
                    <p className="mt-1 text-sm text-white/60">{detail.employee.roleLabel}</p>
                    <p className="text-xs text-white/50">
                      {detail.employee.phone || "No phone"} · Joined {fDate(detail.employee.joiningDate)}
                    </p>
                  </div>
                  <button type="button" onClick={() => setDetailId(null)} className="text-sm text-white/65">
                    Close
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-white/85">Leads handled: {detail.performance.leadsHandled}</p>
                  <p className="text-sm text-white/85">Tasks completed: {detail.performance.tasksCompleted}</p>
                  <p className="text-sm text-white/85">Conversion %: {detail.performance.conversionPercent}</p>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="block text-xs text-white/60">
                    Assign role
                    <select
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white"
                      value={detail.employee.role}
                      onChange={(e) => void updateRole(e.target.value as UserRole)}
                    >
                      {roleOptions.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resetPassword()}
                      className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/90"
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeEmployee()}
                      className="rounded-lg border border-red-400/30 bg-red-500/[0.10] px-3 py-2 text-sm text-red-200"
                    >
                      Remove employee
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">Start Performance Improvement Plan (PIP)</p>
                  <div className="mt-3 space-y-2">
                    <input
                      value={pipForm.goal}
                      onChange={(e) => setPipForm((s) => ({ ...s, goal: e.target.value }))}
                      placeholder="Increase conversions in 7 days"
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <input
                      type="date"
                      value={pipForm.dueDate}
                      onChange={(e) => setPipForm((s) => ({ ...s, dueDate: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => void createPip()}
                      className="rounded-lg border border-[#FFC300]/35 bg-[#FFC300]/10 px-3 py-2 text-sm font-semibold text-[#FFE08A]"
                    >
                      Start PIP
                    </button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {detail.pips.map((p) => (
                      <div key={p.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                        <p className="text-sm text-white">{p.goal}</p>
                        <p className="mt-1 text-xs text-white/60">
                          Progress: {p.progress}% · Due {fDate(p.dueDate)} · {p.isCompleted ? "Completed" : "Open"}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={p.progress}
                            onChange={(e) => void updatePip(p.id, Number(e.target.value), Number(e.target.value) >= 100)}
                            className="w-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
