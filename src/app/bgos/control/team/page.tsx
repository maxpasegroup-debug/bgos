"use client";

import { UserRole } from "@prisma/client";
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
      const j = (await res.json()) as { ok?: boolean; error?: string };
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
      const j = (await res.json()) as { ok?: boolean; error?: string };
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

  return (
    <div className={`mx-auto max-w-5xl pb-16 pt-6 ${BGOS_MAIN_PAD}`}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={light ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-white"}>My Team</h1>
          <p className={muted + " mt-1"}>Internal org — Sales and Tech. ICECONNECT access is created automatically.</p>
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
                  onClick={() => setSelected(m)}
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
                Recycle Bin
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
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/65 p-4">
          <div className={cardShell + " w-full max-w-xl"}>
            <div className="flex items-center justify-between">
              <p className={light ? "text-lg font-semibold text-slate-900" : "text-lg font-semibold text-white"}>
                Employee Control Panel
              </p>
              <button type="button" onClick={() => setSelected(null)} className={muted}>
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p className={muted}>Name: {selected.name}</p>
              <p className={muted}>Role: {selected.role}</p>
              <p className={muted}>Email: {selected.email}</p>
              <p className={muted}>Assigned clients: {selected.assignedClients ?? 0}</p>
              <p className={muted}>Performance score: {Math.max(35, 100 - (selected.pendingTasks ?? 0) * 8)}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={panelBusy}
                onClick={() =>
                  void patchMember(selected.userId, {
                    role:
                      selected.role === UserRole.SALES_EXECUTIVE
                        ? UserRole.MANAGER
                        : UserRole.SALES_EXECUTIVE,
                  })
                }
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white"
              >
                Change role
              </button>
              <button
                type="button"
                disabled={panelBusy}
                onClick={() =>
                  void patchMember(selected.userId, {
                    isActive: selected.isActive === false,
                  })
                }
                className="rounded-lg border border-sky-300/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200"
              >
                {selected.isActive === false ? "Restore employee" : "Archive employee"}
              </button>
            </div>
            <div className="mt-3">
              <input
                type="password"
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8)"
                className={
                  light
                    ? "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    : "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                }
              />
              <button
                type="button"
                disabled={panelBusy}
                onClick={() => void resetMemberPassword(selected.userId)}
                className="mt-2 rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
              >
                Reset password
              </button>
            </div>
            {panelMsg ? <p className={muted + " mt-3"}>{panelMsg}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
