"use client";

import { UserRole } from "@prisma/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  EMAIL_ALREADY_IN_USE_MESSAGE,
  NAME_SIMILARITY_EMAIL_UNIQUE_HINT,
} from "@/lib/user-identity-messages";
import {
  INTERNAL_ORG_EMPLOYEE_ROLE_OPTIONS,
  SOLAR_FIELD_EMPLOYEE_ROLE_OPTIONS,
} from "@/lib/internal-hr-roles";
import { useBgosDashboardContext } from "./BgosDataProvider";

const addEmployeeClientSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function firstValidationMessage(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const fe = (details as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors;
  if (!fe) return null;
  for (const key of ["name", "email", "mobile", "password", "role"] as const) {
    const arr = fe[key];
    if (Array.isArray(arr) && typeof arr[0] === "string" && arr[0]) return arr[0];
  }
  const form = (details as { formErrors?: string[] }).formErrors;
  if (Array.isArray(form) && form[0]) return form[0];
  return null;
}

export function BgosAddEmployeeForm() {
  const { refetch, trialReadOnly } = useBgosDashboardContext();
  const [internalOrg, setInternalOrg] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.SALES_EXECUTIVE);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [seatGateOpen, setSeatGateOpen] = useState(false);

  const employeeRoles = useMemo(
    () => (internalOrg ? INTERNAL_ORG_EMPLOYEE_ROLE_OPTIONS : SOLAR_FIELD_EMPLOYEE_ROLE_OPTIONS),
    [internalOrg],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/company/current", { credentials: "include" });
        const j = (await res.json()) as { ok?: boolean; company?: { internalSalesOrg?: boolean } };
        if (!cancelled && res.ok && j.ok && j.company?.internalSalesOrg) setInternalOrg(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const allowed = employeeRoles.some((r) => r.value === role);
    if (!allowed && employeeRoles[0]) setRole(employeeRoles[0].value);
  }, [employeeRoles, role]);

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
      const mobileTrim = mobile.trim();
      const parsedFields = addEmployeeClientSchema.safeParse({
        name,
        email,
        password,
      });
      if (!parsedFields.success) {
        const fe = parsedFields.error.flatten().fieldErrors;
        setMsg(
          fe.name?.[0] ?? fe.email?.[0] ?? fe.password?.[0] ?? "Check the form and try again.",
        );
        return;
      }
      const body: {
        name: string;
        email: string;
        password: string;
        role: UserRole;
        mobile?: string;
      } = {
        name: parsedFields.data.name,
        email: parsedFields.data.email,
        password: parsedFields.data.password,
        role,
      };
      if (mobileTrim) body.mobile = mobileTrim;

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
        if (j.code === "PLAN_SEAT_LIMIT") {
          setSeatGateOpen(true);
          setMsg(
            typeof j.error === "string" && j.error.trim()
              ? j.error
              : "Upgrade to add more team members.",
          );
          return;
        }
        if (j.code === "VALIDATION_ERROR" && j.details) {
          const line = firstValidationMessage(j.details);
          setMsg(line ?? (typeof j.error === "string" ? j.error : "Check the form and try again."));
          return;
        }
        if (
          j.code === "EMAIL_IN_USE" ||
          j.code === "DUPLICATE_EMAIL" ||
          j.code === "EMAIL_TAKEN"
        ) {
          setMsg(EMAIL_ALREADY_IN_USE_MESSAGE);
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
      setMsg("Success — employee added. They can sign in with email and password.");
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
        <p className="mt-0.5 text-[10px] text-white/40">{NAME_SIMILARITY_EMAIL_UNIQUE_HINT}</p>
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Email <span className="text-[#FF3B3B]">*</span>
        </label>
        <input
          type="email"
          required
          disabled={trialReadOnly}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="name@company.com"
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Mobile <span className="text-white/35">(optional)</span>
        </label>
        <input
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
          Role <span className="text-[#FF3B3B]">*</span>
        </label>
        <select
          disabled={trialReadOnly}
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className={inputClass}
        >
          {employeeRoles.map((r) => (
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

      {seatGateOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="seat-gate-title"
        >
          <div className="max-w-md rounded-2xl border border-white/12 bg-slate-950 px-5 py-5 shadow-2xl sm:px-6">
            <h2 id="seat-gate-title" className="text-base font-semibold text-white">
              Team limit reached
            </h2>
            <p className="mt-2 text-sm text-white/70">
              Basic includes up to five workspace members. Upgrade to Pro for unlimited seats and full
              automation.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSeatGateOpen(false)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/[0.06]"
              >
                Close
              </button>
              <Link
                href="/bgos/subscription"
                onClick={() => setSeatGateOpen(false)}
                className="inline-flex items-center justify-center rounded-xl bg-[#FFC300]/90 px-4 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-[#FFC300]"
              >
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
