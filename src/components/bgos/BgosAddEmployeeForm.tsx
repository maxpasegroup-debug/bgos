"use client";

import { UserRole } from "@prisma/client";
import { useState } from "react";
import { useBgosDashboardContext } from "./BgosDataProvider";

const EMPLOYEE_ROLES: { value: UserRole; label: string }[] = [
  { value: UserRole.SALES_HEAD, label: "Sales Head" },
  { value: UserRole.SALES_EXECUTIVE, label: "Sales Executive" },
  { value: UserRole.TELECALLER, label: "Telecaller" },
  { value: UserRole.OPERATIONS_HEAD, label: "Operations Head" },
  { value: UserRole.SITE_ENGINEER, label: "Engineer" },
  { value: UserRole.INSTALLATION_TEAM, label: "Installer" },
  { value: UserRole.ACCOUNTANT, label: "Accounts" },
  { value: UserRole.HR_MANAGER, label: "HR Manager" },
];

function firstValidationMessage(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const fe = (details as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors;
  if (!fe) return null;
  for (const key of ["name", "mobile", "email", "password", "role"] as const) {
    const arr = fe[key];
    if (Array.isArray(arr) && typeof arr[0] === "string" && arr[0]) return arr[0];
  }
  const form = (details as { formErrors?: string[] }).formErrors;
  if (Array.isArray(form) && form[0]) return form[0];
  return null;
}

export function BgosAddEmployeeForm() {
  const { refetch, trialReadOnly } = useBgosDashboardContext();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.SALES_EXECUTIVE);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (trialReadOnly) {
      setMsg("Your free trial has expired. Upgrade to add employees.");
      return;
    }
    setMsg(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const body: {
        name: string;
        mobile: string;
        password: string;
        role: UserRole;
        email?: string;
      } = { name: name.trim(), mobile: mobile.trim(), password, role };
      const emailTrim = email.trim();
      if (emailTrim) body.email = emailTrim;

      const res = await fetch("/api/users/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        details?: unknown;
      };
      if (!res.ok) {
        if (j.code === "TRIAL_EXPIRED") {
          setMsg(
            typeof j.error === "string" && j.error.trim()
              ? j.error
              : "Your free trial has expired. Upgrade to continue.",
          );
          return;
        }
        if (j.code === "VALIDATION_ERROR" && j.details) {
          const line = firstValidationMessage(j.details);
          setMsg(line ?? (typeof j.error === "string" ? j.error : "Check the form and try again."));
          return;
        }
        setMsg(typeof j.error === "string" ? j.error : "Could not create employee — try again.");
        return;
      }
      setName("");
      setMobile("");
      setEmail("");
      setPassword("");
      setRole(UserRole.SALES_EXECUTIVE);
      setSuccess(true);
      setMsg("Success — employee added. They can sign in to ICECONNECT with mobile and password.");
      refetch();
    } catch {
      setMsg("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]/40";

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Full name <span className="text-[#FF3B3B]">*</span>
        </label>
        <input
          required
          disabled={trialReadOnly}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Mobile <span className="text-[#FF3B3B]">*</span>
        </label>
        <input
          required
          disabled={trialReadOnly}
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="10–15 digits"
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Email <span className="text-white/35">(optional)</span>
        </label>
        <input
          type="email"
          disabled={trialReadOnly}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
          placeholder="Leave blank to auto-generate"
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Role <span className="text-[#FF3B3B]">*</span>
        </label>
        <select
          disabled={trialReadOnly}
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className={inputClass}
        >
          {EMPLOYEE_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Initial password <span className="text-[#FF3B3B]">*</span>{" "}
          <span className="font-normal normal-case text-white/35">(min. 8 characters)</span>
        </label>
        <input
          required
          disabled={trialReadOnly}
          type="password"
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      {msg ? (
        <p
          className={`sm:col-span-2 lg:col-span-3 text-sm ${
            success ? "text-emerald-300/90" : "text-red-300/90"
          }`}
          role="status"
        >
          {msg}
        </p>
      ) : null}
      <div className="sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={submitting || trialReadOnly}
          className="rounded-xl bg-[#FFC300]/90 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FFC300] disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create employee"}
        </button>
      </div>
    </form>
  );
}
