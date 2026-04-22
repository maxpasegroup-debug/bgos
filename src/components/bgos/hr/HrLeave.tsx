"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

type LeaveRow = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  createdAt: string;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/20 text-amber-200",
  APPROVED: "bg-emerald-500/20 text-emerald-200",
  REJECTED: "bg-rose-500/20 text-rose-200",
};

export function HrLeave({ onChanged }: { onChanged: () => void }) {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [filter, setFilter] = useState<"all" | "PENDING" | "APPROVED" | "REJECTED">("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/hr/leave/list");
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        leaves?: LeaveRow[];
        error?: string;
      };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Failed to load leave requests");
      setRows(Array.isArray(body.leaves) ? body.leaves : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    setActionMsg(null);
    try {
      const res = await apiFetch("/api/hr/leave/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Update failed");
      setActionMsg({ id, text: `${status === "APPROVED" ? "Approved" : "Rejected"}`, ok: true });
      await load();
      onChanged();
    } catch (e) {
      setActionMsg({ id, text: e instanceof Error ? e.message : "Update failed", ok: false });
    } finally {
      setBusyId(null);
    }
  }

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["all", "PENDING", "APPROVED", "REJECTED"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs ${filter === f ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-300/40" : "bg-white/5 text-white/65"}`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-white/50">Loading…</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex flex-wrap items-start justify-between gap-3"
            >
              <div>
                <p className="font-medium">{r.userName}</p>
                <p className="text-xs text-white/50">{r.userEmail}</p>
                <p className="mt-1 text-sm text-white/70">
                  {fmtDate(r.fromDate)} → {fmtDate(r.toDate)}
                </p>
                <p className="mt-0.5 text-xs text-white/50">{r.reason || "No reason given"}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[r.status] ?? "bg-white/10 text-white/60"}`}>
                  {r.status}
                </span>
                {actionMsg?.id === r.id && (
                  <span className={`text-xs ${actionMsg.ok ? "text-emerald-300" : "text-rose-300"}`}>
                    {actionMsg.text}
                  </span>
                )}
                {r.status === "PENDING" && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void setStatus(r.id, "APPROVED")}
                      className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void setStatus(r.id, "REJECTED")}
                      className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-white/40">No leave requests found.</p>
          )}
        </div>
      )}
    </div>
  );
}
