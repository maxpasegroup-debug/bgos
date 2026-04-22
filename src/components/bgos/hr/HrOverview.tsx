"use client";

import type { HrPayload } from "./HrDashboard";

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function HrOverview({ data }: { data: HrPayload }) {
  const total = data.employees.length;
  const present = data.attendance.present;
  const onLeave = data.employees.filter((e) => e.status === "ON_LEAVE").length;
  const pending = data.leaves.pending;

  const stats = [
    { label: "Total Employees", value: total, color: "text-cyan-300" },
    { label: "Present Today", value: present, color: "text-emerald-300" },
    { label: "On Leave", value: onLeave, color: "text-amber-300" },
    { label: "Pending Leave", value: pending, color: "text-rose-300" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center"
          >
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs text-white/60">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs text-white/50 uppercase tracking-wide">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 hidden sm:table-cell">Role</th>
              <th className="px-4 py-3 hidden md:table-cell">Dashboard</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 hidden sm:table-cell">Check-in</th>
              <th className="px-4 py-3 hidden sm:table-cell">Perf</th>
            </tr>
          </thead>
          <tbody>
            {data.employees.map((emp) => (
              <tr key={emp.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium">{emp.name}</p>
                  <p className="text-xs text-white/50">{emp.email}</p>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-white/70">{emp.roleLabel}</td>
                <td className="px-4 py-3 hidden md:table-cell text-white/50 text-xs">{emp.dashboardAssigned || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      emp.status === "ON_LEAVE"
                        ? "bg-amber-500/20 text-amber-200"
                        : emp.attendanceToday.present
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-white/10 text-white/50"
                    }`}
                  >
                    {emp.status === "ON_LEAVE" ? "On Leave" : emp.attendanceToday.present ? "Present" : "Absent"}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-white/60 text-xs">
                  {fmt(emp.attendanceToday.checkIn)}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${emp.performanceScore >= 70 ? "bg-emerald-400" : emp.performanceScore >= 40 ? "bg-amber-400" : "bg-rose-400"}`}
                        style={{ width: `${emp.performanceScore}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/50">{emp.performanceScore}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {data.employees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-white/40">
                  No employees yet. Add one in the &ldquo;Add Employee&rdquo; tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
