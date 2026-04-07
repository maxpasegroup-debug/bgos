"use client";

import { UserRole } from "@prisma/client";
import { useState } from "react";
import { useBgosDashboardContext } from "./BgosDataProvider";

const ROLE_OPTIONS: UserRole[] = [
  UserRole.SALES_HEAD,
  UserRole.SALES_EXECUTIVE,
  UserRole.CHANNEL_PARTNER,
  UserRole.OPERATIONS_HEAD,
  UserRole.SITE_ENGINEER,
  UserRole.PRO,
  UserRole.INSTALLATION_TEAM,
  UserRole.SERVICE_TEAM,
  UserRole.INVENTORY_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.LCO,
  UserRole.HR_MANAGER,
];

function roleLabel(r: UserRole) {
  const labels: Partial<Record<UserRole, string>> = {
    SALES_HEAD: "Sales Head",
    SALES_EXECUTIVE: "Sales Executive",
    CHANNEL_PARTNER: "Channel Partner",
    OPERATIONS_HEAD: "Operations Head",
    SITE_ENGINEER: "Site Engineer",
    PRO: "PRO (Approvals / KSEB)",
    INSTALLATION_TEAM: "Installation Team",
    SERVICE_TEAM: "Service Team",
    INVENTORY_MANAGER: "Inventory Manager",
    ACCOUNTANT: "Accountant",
    LCO: "Loan Compliance Officer",
    HR_MANAGER: "HR Manager",
  };
  return labels[r] ?? (r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, " "));
}

export function BgosAddEmployeeForm() {
  const { refetch } = useBgosDashboardContext();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.SALES_EXECUTIVE);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile, email, password, role }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: unknown };
      if (!res.ok) {
        const err =
          typeof j.error === "string"
            ? j.error
            : "Could not create user — check fields and try again.";
        setMsg(err);
        return;
      }
      setName("");
      setMobile("");
      setEmail("");
      setPassword("");
      setRole(UserRole.SALES_EXECUTIVE);
      setMsg("Employee added. Dashboard will refresh.");
      refetch();
    } catch {
      setMsg("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Full name
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]/40"
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Mobile
        </label>
        <input
          required
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]/40"
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Email
        </label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]/40"
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]/40"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Initial password (min 8 characters)
        </label>
        <input
          required
          type="password"
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]/40"
        />
      </div>
      {msg ? (
        <p
          className={`sm:col-span-2 lg:col-span-3 text-sm ${
            msg.includes("added") ? "text-emerald-300/90" : "text-red-300/90"
          }`}
          role="status"
        >
          {msg}
        </p>
      ) : null}
      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-[#FFC300]/90 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FFC300] disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create employee"}
        </button>
      </div>
    </form>
  );
}
