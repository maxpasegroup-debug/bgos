"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

type AttendanceRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function HrAttendance() {
  const [date, setDate] = useState(() => toYMD(new Date()));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(d: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/hr/attendance/list?date=${d}`);
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        attendance?: AttendanceRow[];
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed to load attendance");
      setRows(Array.isArray(body.attendance) ? body.attendance : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(date);
  }, [date]);

  const present = rows.filter((r) => r.checkIn).length;
  const absent = rows.length - present;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
        />
        {!loading && rows.length > 0 && (
          <div className="flex gap-3 text-sm">
            <span className="text-emerald-300">{present} present</span>
            <span className="text-rose-300">{absent} absent</span>
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-white/50">Loading…</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && !error && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/50 uppercase tracking-wide">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Check-out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.userName}</p>
                    <p className="text-xs text-white/50">{r.userEmail}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.checkIn
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-rose-500/20 text-rose-200"
                      }`}
                    >
                      {r.checkIn ? "Present" : "Absent"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">{fmtTime(r.checkIn)}</td>
                  <td className="px-4 py-3 text-white/70">{fmtTime(r.checkOut)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-white/40">
                    No attendance records for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
