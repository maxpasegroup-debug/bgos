"use client";

import { UserRole } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBgosTheme } from "@/components/bgos/BgosThemeContext";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { INTERNAL_ORG_EMPLOYEE_ROLE_OPTIONS } from "@/lib/internal-hr-roles";

type Member = { userId: string; name: string; email: string; role: string };

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

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/bgos/control/team", { credentials: "include" });
      const j = (await res.json()) as TeamJson;
      if (!res.ok || !j.ok || !j.departments) {
        setError("Could not load team.");
        return;
      }
      setData(j.departments);
    } catch {
      setError("Network error.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const members = useMemo(() => {
    if (!data || !dept) return [];
    return dept === "sales" ? data.sales : data.tech;
  }, [data, dept]);

  const cardShell = light
    ? "rounded-2xl border border-slate-200/90 bg-white/90 p-6 shadow-sm"
    : "rounded-2xl border border-white/[0.08] bg-[#121821]/80 p-6";
  const muted = light ? "text-sm text-slate-600" : "text-sm text-white/65";

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    setSaving(true);
    try {
      const res = await fetch("/api/bgos/control/team/employees", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setFormMsg(j.error ?? "Could not create employee");
        return;
      }
      setFormMsg("Created — employee can log in on ICECONNECT with this email.");
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch {
      setFormMsg("Network error");
    } finally {
      setSaving(false);
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
          onClick={() => setFormOpen((v) => !v)}
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
            <p className={light ? "text-xs text-emerald-700" : "text-xs text-emerald-400"}>{formMsg}</p>
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
          <div className="flex flex-wrap justify-center gap-6 py-8">
            {members.length === 0 ? (
              <p className={muted}>No employees in this department yet.</p>
            ) : (
              members.map((m) => (
                <div key={m.userId} className="flex w-28 flex-col items-center gap-2 text-center">
                  <div
                    className={
                      light
                        ? "flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-900"
                        : "flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/20 text-lg font-bold text-cyan-100"
                    }
                  >
                    {initials(m.name)}
                  </div>
                  <p className={light ? "text-xs font-semibold text-slate-900" : "text-xs font-semibold text-white"}>
                    {m.name}
                  </p>
                  <p className={light ? "text-[10px] text-slate-500" : "text-[10px] text-white/50"}>{m.role}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
