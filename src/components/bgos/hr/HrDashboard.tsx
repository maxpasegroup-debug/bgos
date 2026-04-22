"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api-fetch";
import { HrAddEmployee } from "./HrAddEmployee";
import { HrAttendance } from "./HrAttendance";
import { HrEmployees } from "./HrEmployees";
import { HrLeave } from "./HrLeave";
import { HrOverview } from "./HrOverview";
import { HrSalary } from "./HrSalary";

export type HrPayload = {
  employees: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    roleLabel: string;
    dashboardAssigned: string;
    joiningDate: string;
    status: "ACTIVE" | "ON_LEAVE";
    performanceScore: number;
    attendanceToday: { checkIn: string | null; checkOut: string | null; present: boolean };
    pipActive: boolean;
  }>;
  attendance: {
    present: number;
    absent: number;
    today: Array<{ userId: string; name: string; status: "PRESENT" | "ABSENT"; checkIn: string | null; checkOut: string | null }>;
  };
  leaves: {
    pending: number;
    approved: number;
    requests: Array<{ id: string; userId: string; userName: string; fromDate: string; toDate: string; reason: string; status: string }>;
  };
};

type Tab = "overview" | "employees" | "add" | "attendance" | "leave" | "salary";

export function HrDashboard({ user }: { user: AuthUser }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<HrPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHr() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/bgos/hr", { credentials: "include" });
      const body = (await res.json()) as HrPayload & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Failed to load HR data");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load HR data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHr();
  }, []);

  const tabs = useMemo(
    () => [
      { id: "overview", label: "Overview" },
      { id: "employees", label: "Employees" },
      { id: "add", label: "Add Employee" },
      { id: "attendance", label: "Attendance" },
      { id: "leave", label: "Leave Requests" },
      { id: "salary", label: "Salary" },
    ] as Array<{ id: Tab; label: string }>,
    [],
  );

  return (
    <div className="mx-auto w-full max-w-6xl p-4 text-white">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-300/75">BGOS HR</p>
            <h1 className="text-xl font-semibold">Employee Management</h1>
            <p className="text-sm text-white/60">Welcome, {user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadHr()}
            className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs"
          >
            Refresh
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${tab === t.id ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/40" : "bg-white/5 text-white/75"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {loading ? <p className="text-sm text-white/65">Loading HR data...</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {!loading && !error && data ? (
          <>
            {tab === "overview" ? <HrOverview data={data} /> : null}
            {tab === "employees" ? <HrEmployees data={data} onRefresh={loadHr} /> : null}
            {tab === "add" ? <HrAddEmployee onCreated={loadHr} /> : null}
            {tab === "attendance" ? <HrAttendance /> : null}
            {tab === "leave" ? <HrLeave onChanged={loadHr} /> : null}
            {tab === "salary" ? <HrSalary /> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
