"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { RoleBadge } from "@/components/ui/RoleBadge";
import type { HrPayload } from "./HrDashboard";

type Employee = HrPayload["employees"][number];

const STATUS_FILTER = ["all", "ACTIVE", "ON_LEAVE"] as const;
type StatusFilter = (typeof STATUS_FILTER)[number];

export function HrEmployees({ data, onRefresh }: { data: HrPayload; onRefresh: () => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const filtered = data.employees.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.roleLabel.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function resetPassword(emp: Employee) {
    setBusyId(emp.id);
    setMsg(null);
    try {
      const res = await apiFetch("/api/hr/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: emp.id }),
      });
      const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !body.success) throw new Error(body.error ?? "Reset failed");
      setMsg({ id: emp.id, text: "Password reset to 123456789", ok: true });
    } catch (e) {
      setMsg({ id: emp.id, text: e instanceof Error ? e.message : "Reset failed", ok: false });
    } finally {
      setBusyId(null);
    }
  }

  async function deactivate(emp: Employee) {
    if (!confirm(`Deactivate ${emp.name}? They will lose access.`)) return;
    setBusyId(emp.id + "_deactivate");
    setMsg(null);
    try {
      const res = await apiFetch(`/api/bgos/hr/employee/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      });
      const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !body.success) throw new Error(body.error ?? "Deactivate failed");
      setMsg({ id: emp.id, text: "Employee deactivated", ok: true });
      onRefresh();
    } catch (e) {
      setMsg({ id: emp.id, text: e instanceof Error ? e.message : "Deactivate failed", ok: false });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search name, email, role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
        />
        <div className="flex gap-1">
          {STATUS_FILTER.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs ${statusFilter === f ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/40" : "bg-white/5 text-white/65"}`}
            >
              {f === "all" ? "All" : f === "ON_LEAVE" ? "On Leave" : "Active"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-white/50 uppercase tracking-wide">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3 hidden sm:table-cell">Role</th>
              <th className="px-4 py-3 hidden md:table-cell">Dashboard</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp) => (
              <tr key={emp.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium">{emp.name}</p>
                  <p className="text-xs text-white/50">{emp.email}</p>
                  {emp.phone ? <p className="text-xs text-white/40">{emp.phone}</p> : null}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-white/70">
                  <RoleBadge role={emp.role} />
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-xs text-white/50">
                  {emp.dashboardAssigned || <span className="text-white/25">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.status === "ON_LEAVE"
                        ? "bg-amber-500/20 text-amber-200"
                        : "bg-emerald-500/20 text-emerald-200"
                    }`}
                  >
                    {emp.status === "ON_LEAVE" ? "On Leave" : "Active"}
                  </span>
                  {emp.pipActive && (
                    <span className="ml-1 rounded-full px-2 py-0.5 text-xs bg-rose-500/20 text-rose-200">PIP</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {msg?.id === emp.id && (
                      <span className={`text-xs ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>
                        {msg.text}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={busyId === emp.id}
                      onClick={() => void resetPassword(emp)}
                      className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                    >
                      {busyId === emp.id ? "…" : "Reset Pwd"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === emp.id + "_deactivate"}
                      onClick={() => void deactivate(emp)}
                      className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      {busyId === emp.id + "_deactivate" ? "…" : "Deactivate"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-white/40">
                  No employees match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
