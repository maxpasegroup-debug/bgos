"use client";


import { apiFetch } from "@/lib/api-fetch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IceconnectWorkspaceView } from "@/components/iceconnect/IceconnectWorkspaceView";
import { IcPanel } from "@/components/iceconnect/IcPanel";

type LeaveRow = {
  id: string;
  userId: string;
  userName: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  createdAt: string;
};

type AttendanceRow = {
  id: string;
  userId: string;
  userName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
};

type SalaryRow = {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  month: string;
};

type EmployeeRow = { id: string; name: string };

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[color:var(--ice-primary)]";

export function IceconnectHrDashboard() {
  const [role, setRole] = useState<string>("");
  const [meUserId, setMeUserId] = useState<string>("");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leaveRows, setLeaveRows] = useState<LeaveRow[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [salaryRows, setSalaryRows] = useState<SalaryRow[]>([]);

  const [leaveFrom, setLeaveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveTo, setLeaveTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");

  const [salaryUserId, setSalaryUserId] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryMonth, setSalaryMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const isManagerView = useMemo(
    () => role === "HR_MANAGER" || role === "ADMIN" || role === "MANAGER",
    [role],
  );

  const loadAll = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const [meRes, leavesRes, attendanceRes, salaryRes, usersRes] = await Promise.all([
        apiFetch("/api/auth/me", { credentials: "include" }),
        apiFetch("/api/hr/leave/list", { credentials: "include" }),
        apiFetch("/api/hr/attendance/list", { credentials: "include" }),
        apiFetch("/api/hr/salary/list", { credentials: "include" }),
        apiFetch("/api/hr/users/list", { credentials: "include" }),
      ]);

      const me = (await meRes.json()) as { user?: { role?: string; sub?: string } };
      setRole(me.user?.role ?? "");
      setMeUserId(me.user?.sub ?? "");

      const leavesJson = (await leavesRes.json()) as { ok?: boolean; leaves?: LeaveRow[] };
      const attendanceJson = (await attendanceRes.json()) as { ok?: boolean; attendance?: AttendanceRow[] };
      const salaryJson = (await salaryRes.json()) as { ok?: boolean; salaries?: SalaryRow[] };
      const usersJson = (await usersRes.json()) as { ok?: boolean; users?: { id: string; name: string }[] };

      if (leavesJson.ok && Array.isArray(leavesJson.leaves)) setLeaveRows(leavesJson.leaves);
      if (attendanceJson.ok && Array.isArray(attendanceJson.attendance)) setAttendanceRows(attendanceJson.attendance);
      if (salaryJson.ok && Array.isArray(salaryJson.salaries)) setSalaryRows(salaryJson.salaries);
      if (usersJson.ok && Array.isArray(usersJson.users)) {
        const rows = usersJson.users.map((u) => ({ id: u.id, name: u.name }));
        setEmployees(rows);
        if (rows.length > 0 && !salaryUserId) setSalaryUserId(rows[0].id);
      }
    } catch {
      setError("Could not load HR data.");
    } finally {
      setLoading(false);
    }
  }, [salaryUserId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function applyLeave() {
    setError(null);
    const res = await apiFetch("/api/hr/leave/apply", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromDate: leaveFrom,
        toDate: leaveTo,
        reason: leaveReason,
      }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not apply leave");
      return;
    }
    setLeaveReason("");
    await loadAll();
  }

  async function setLeaveStatus(id: string, status: "APPROVED" | "REJECTED") {
    const res = await apiFetch("/api/hr/leave/status", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not update leave");
      return;
    }
    await loadAll();
  }

  async function checkIn() {
    const res = await apiFetch("/api/hr/attendance/checkin", { method: "POST", credentials: "include" });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Check-in failed");
      return;
    }
    await loadAll();
  }

  async function checkOut() {
    const res = await apiFetch("/api/hr/attendance/checkout", { method: "POST", credentials: "include" });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Check-out failed");
      return;
    }
    await loadAll();
  }

  async function saveSalary() {
    const n = Number(salaryAmount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter valid salary amount.");
      return;
    }
    const res = await apiFetch("/api/hr/salary/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: salaryUserId, amount: n, month: salaryMonth }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not save salary");
      return;
    }
    setSalaryAmount("");
    await loadAll();
  }

  const today = new Date().toISOString().slice(0, 10);
  const myTodayAttendance = attendanceRows.find(
    (r) => r.userId === meUserId && r.date.slice(0, 10) === today,
  );

  return (
    <IceconnectWorkspaceView
      title="HR Management"
      subtitle={isManagerView ? "Leave approvals, attendance visibility, and salary management." : "Apply leave and track attendance."}
      loading={loading}
      error={error}
      onRetry={() => void loadAll()}
    >
      <div className="grid gap-6">
        <IcPanel title="Employee actions">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-700">Apply leave</p>
              <div className="mt-2 grid gap-2">
                <label className="text-xs text-gray-500">
                  From
                  <input type="date" className={inputClass} value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} />
                </label>
                <label className="text-xs text-gray-500">
                  To
                  <input type="date" className={inputClass} value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} />
                </label>
                <label className="text-xs text-gray-500">
                  Reason
                  <textarea className={inputClass} rows={3} value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
                </label>
                <button type="button" className="rounded-lg bg-[color:var(--ice-primary)] px-3 py-2 text-sm font-semibold text-white" onClick={() => void applyLeave()}>
                  Apply leave
                </button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Attendance</p>
              <p className="mt-1 text-xs text-gray-500">
                Today: {myTodayAttendance?.checkIn ? "Checked in" : "Not checked in"}
                {myTodayAttendance?.checkOut ? " · Checked out" : ""}
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void checkIn()} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  Check-in
                </button>
                <button type="button" onClick={() => void checkOut()} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  Check-out
                </button>
              </div>
            </div>
          </div>
        </IcPanel>

        <IcPanel title="Leave status">
          <div className="space-y-2">
            {leaveRows.length === 0 ? <p className="text-sm text-gray-500">No leave records.</p> : null}
            {leaveRows.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-900">{r.userName} · {r.status}</p>
                <p className="text-gray-500">{r.fromDate.slice(0, 10)} to {r.toDate.slice(0, 10)}</p>
                <p className="text-gray-600">{r.reason}</p>
                {isManagerView && r.status === "PENDING" ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700" onClick={() => void setLeaveStatus(r.id, "APPROVED")}>
                      Approve
                    </button>
                    <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => void setLeaveStatus(r.id, "REJECTED")}>
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </IcPanel>

        {isManagerView ? (
          <>
            <IcPanel title="Attendance list">
              <div className="space-y-2">
                {attendanceRows.map((r) => (
                  <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <p className="font-medium text-gray-900">{r.userName} · {r.date.slice(0, 10)}</p>
                    <p className="text-gray-600">
                      In: {r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "-"} · Out: {r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "-"}
                    </p>
                  </div>
                ))}
              </div>
            </IcPanel>

            <IcPanel title="Salary management">
              <div className="grid gap-2 sm:grid-cols-4 sm:items-end">
                <label className="text-xs text-gray-500 sm:col-span-2">
                  Employee
                  <select className={inputClass} value={salaryUserId} onChange={(e) => setSalaryUserId(e.target.value)}>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-gray-500">
                  Month
                  <input type="month" className={inputClass} value={salaryMonth} onChange={(e) => setSalaryMonth(e.target.value)} />
                </label>
                <label className="text-xs text-gray-500">
                  Amount
                  <input className={inputClass} value={salaryAmount} onChange={(e) => setSalaryAmount(e.target.value)} />
                </label>
              </div>
              <button type="button" className="mt-3 rounded-lg bg-[color:var(--ice-primary)] px-3 py-2 text-sm font-semibold text-white" onClick={() => void saveSalary()}>
                Save salary
              </button>
              <div className="mt-4 space-y-2">
                {salaryRows.map((r) => (
                  <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                    <p className="font-medium text-gray-900">{r.userName} · {r.month}</p>
                    <p className="text-gray-600">{formatInr(r.amount)}</p>
                  </div>
                ))}
              </div>
            </IcPanel>
          </>
        ) : null}
      </div>
    </IceconnectWorkspaceView>
  );
}
