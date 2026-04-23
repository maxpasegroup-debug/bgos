"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-fetch";

const ROLE_OPTIONS: { label: string; role: "BDM" | "TECH_EXECUTIVE" | "MANAGER" }[] = [
  { label: "Micro Franchise Partner", role: "BDM" },
  { label: "Micro Franchise Partner", role: "BDM" },
  { label: "Operations Manager", role: "MANAGER" },
  { label: "Site Engineer", role: "TECH_EXECUTIVE" },
  { label: "Installation Team", role: "TECH_EXECUTIVE" },
  { label: "Service Team", role: "TECH_EXECUTIVE" },
  { label: "Inventory Manager", role: "MANAGER" },
  { label: "Accountant", role: "MANAGER" },
  { label: "HR Manager", role: "MANAGER" },
  { label: "Custom (specify)", role: "MANAGER" },
];

type CreatedEmployee = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type SuccessPayload = {
  employee: CreatedEmployee;
  credentials: { email: string; defaultPassword: string };
};

function SuccessModal({
  payload,
  onAddAnother,
}: {
  payload: SuccessPayload;
  onAddAnother: () => void;
}) {
  const text = `Name: ${payload.employee.name}\nEmail: ${payload.credentials.email}\nPassword: ${payload.credentials.defaultPassword}`;

  function copy() {
    void navigator.clipboard.writeText(text);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-emerald-400/30 bg-[#0f1f17] p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2 text-emerald-300">
          <span className="text-xl">✅</span>
          <h2 className="text-lg font-semibold">
            {payload.employee.role === "BDM" ? "Franchise Partner Added" : "Employee Added Successfully"}
          </h2>
        </div>

        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm">
          <Row label="Name" value={payload.employee.name} />
          <Row label="Email" value={payload.credentials.email} />
          <Row
            label="Temp Password"
            value={payload.credentials.defaultPassword}
            highlight
          />
        </div>

        <p className="mt-3 text-xs text-white/50">
          Share these credentials with the employee. They can login at{" "}
          <span className="text-cyan-300">iceconnect.in</span>
          {payload.employee.role === "BDM" ? " as a Micro Franchise Partner." : "."}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="flex-1 rounded-lg border border-white/20 bg-white/5 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Copy Credentials
          </button>
          <button
            type="button"
            onClick={onAddAnother}
            className="flex-1 rounded-lg bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Add Another
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}:</span>
      <span className={highlight ? "font-mono font-bold text-amber-300" : "text-white/90"}>
        {value}
      </span>
    </div>
  );
}

export function HrAddEmployee({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedOption, setSelectedOption] = useState(0);
  const [customRole, setCustomRole] = useState("");
  const [department, setDepartment] = useState("");
  const [joinDate, setJoinDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessPayload | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setSelectedOption(0);
    setCustomRole("");
    setDepartment("");
    setJoinDate("");
    setError(null);
    setSuccess(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const option = ROLE_OPTIONS[selectedOption]!;
    const displayRole = option.label === "Custom (specify)" ? customRole.trim() || "Employee" : option.label;

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/hr/add-employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          role: option.role,
          displayRole,
          department: department.trim() || undefined,
          joinDate: joinDate || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as
        | ({ success: true } & SuccessPayload)
        | { success: false; error?: string };
      if (!res.ok || !body.success) {
        throw new Error((body as { error?: string }).error ?? "Failed to add employee");
      }
      const payload = body as SuccessPayload & { success: true };
      setSuccess({ employee: payload.employee, credentials: payload.credentials });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add employee");
    } finally {
      setSubmitting(false);
    }
  }

  const isCustom = ROLE_OPTIONS[selectedOption]?.label === "Custom (specify)";

  return (
    <>
      {success && (
        <SuccessModal
          payload={success}
          onAddAnother={reset}
        />
      )}

      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="mb-1 text-lg font-semibold">
          {ROLE_OPTIONS[selectedOption]?.role === "BDM" ? "Add Franchise Partner" : "Add Employee"}
        </h2>
        <p className="mb-5 text-sm text-white/50">
          A welcome notification with login credentials will be sent automatically.
        </p>

        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <Field label="Full Name *">
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className={inputCls}
            />
          </Field>

          <Field label="Email * (login email)">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rahul@example.com"
              className={inputCls}
            />
          </Field>

          <Field label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 9876543210"
              className={inputCls}
            />
          </Field>

          <Field label="Role *">
            <select
              value={selectedOption}
              onChange={(e) => setSelectedOption(Number(e.target.value))}
              className={inputCls}
            >
              {ROLE_OPTIONS.map((opt, i) => (
                <option key={opt.label} value={i}>
                  {opt.label} → {opt.role === "BDM" ? "Franchise" : opt.role === "TECH_EXECUTIVE" ? "Technical" : "Management"}
                </option>
              ))}
            </select>
          </Field>

          {isCustom && (
            <Field label="Custom Role Title">
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="e.g. Procurement Head"
                className={inputCls}
              />
            </Field>
          )}

          <Field label="Department">
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Sales, Operations"
              className={inputCls}
            />
          </Field>

          <Field label="Join Date">
            <input
              type="date"
              value={joinDate}
              onChange={(e) => setJoinDate(e.target.value)}
              className={inputCls}
            />
          </Field>

          {error && (
            <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Default password: <span className="font-mono font-bold">123456789</span> — employee should change after first login.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {submitting ? "Adding employee…" : `${ROLE_OPTIONS[selectedOption]?.role === "BDM" ? "Add Franchise Partner" : "Add Employee"}`}
          </button>
        </form>
      </div>
    </>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-cyan-400/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
