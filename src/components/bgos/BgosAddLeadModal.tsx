"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { useBgosDashboardContext } from "./BgosDataProvider";

const inputClass =
  "mt-1 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-sm text-white outline-none focus:border-[#FFC300]/40";

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone is required")
  .max(32, "Phone is too long")
  .refine((s) => {
    const digits = s.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }, "Use 10–15 digits (spaces or + allowed)");

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  phone: phoneSchema,
  valueStr: z.string().optional(),
  assignedToUserId: z.string().optional(),
});

type PublicUser = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  role: string;
  isActive: boolean;
};

type FieldErrors = Partial<Record<"name" | "phone" | "valueStr" | "assignedToUserId", string>>;

export function BgosAddLeadModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { refetch } = useBgosDashboardContext();
  const titleId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [valueStr, setValueStr] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [usersNote, setUsersNote] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersNote(null);
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      const data = (await res.json()) as {
        ok?: boolean;
        users?: PublicUser[];
        error?: string;
      };
      if (!res.ok) {
        setUsers([]);
        setUsersNote(
          typeof data.error === "string"
            ? data.error
            : "Team list unavailable — lead will be assigned to you.",
        );
        return;
      }
      const list = Array.isArray(data.users) ? data.users.filter((u) => u.isActive) : [];
      setUsers(list);
    } catch {
      setUsers([]);
      setUsersNote("Could not load team — lead will be assigned to you.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadUsers();
    setFieldErrors({});
    setSubmitError(null);
    setSuccess(null);
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, loadUsers]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function resetForm() {
    setName("");
    setPhone("");
    setValueStr("");
    setAssignedToUserId("");
    setFieldErrors({});
    setSubmitError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);
    setSuccess(null);

    const parsed = formSchema.safeParse({
      name,
      phone,
      valueStr: valueStr.trim() || undefined,
      assignedToUserId: assignedToUserId || undefined,
    });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        name: fe.name?.[0],
        phone: fe.phone?.[0],
        valueStr: fe.valueStr?.[0],
        assignedToUserId: fe.assignedToUserId?.[0],
      });
      return;
    }

    let value: number | undefined;
    if (parsed.data.valueStr?.trim()) {
      const raw = parsed.data.valueStr.trim().replace(/,/g, "");
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        setFieldErrors({ valueStr: "Enter a valid amount (0 or more)" });
        return;
      }
      value = n;
    }

    const body: {
      name: string;
      phone: string;
      value?: number;
      assignedToUserId?: string;
    } = {
      name: parsed.data.name,
      phone: parsed.data.phone,
    };
    if (value !== undefined) body.value = value;
    if (parsed.data.assignedToUserId?.trim()) {
      body.assignedToUserId = parsed.data.assignedToUserId.trim();
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: unknown;
        code?: string;
      };

      if (!res.ok) {
        if (data.code === "VALIDATION_ERROR" && data.error && typeof data.error === "object") {
          setSubmitError("Check the form and try again.");
        } else {
          setSubmitError(
            typeof data.error === "string" ? data.error : "Could not create lead.",
          );
        }
        return;
      }

      resetForm();
      onClose();
      setSuccess(`Lead “${parsed.data.name}” added.`);
      void refetch();
      window.setTimeout(() => setSuccess(null), 5000);
    } catch {
      setSubmitError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return success ? (
      <div
        className="pointer-events-none fixed bottom-6 left-1/2 z-[60] max-w-md -translate-x-1/2 px-4"
        role="status"
      >
        <div className="pointer-events-auto rounded-xl border border-emerald-500/40 bg-emerald-950/95 px-4 py-3 text-center text-sm text-emerald-100 shadow-lg backdrop-blur">
          {success}
        </div>
      </div>
    ) : null;
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="presentation"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141d] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id={titleId} className="text-lg font-semibold text-white">
            Add lead
          </h2>
          <p className="mt-1 text-xs text-white/45">
            New leads start in <span className="text-white/70">New</span> and get a follow-up task.
          </p>

          <form className="mt-5 space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
            <div>
              <label htmlFor="add-lead-name" className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Name <span className="text-[#FF3B3B]">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="add-lead-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "add-lead-name-err" : undefined}
              />
              {fieldErrors.name ? (
                <p id="add-lead-name-err" className="mt-1 text-xs text-red-300" role="alert">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="add-lead-phone" className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Phone <span className="text-[#FF3B3B]">*</span>
              </label>
              <input
                id="add-lead-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="e.g. 9876543210 or +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                aria-invalid={Boolean(fieldErrors.phone)}
              />
              {fieldErrors.phone ? (
                <p className="mt-1 text-xs text-red-300" role="alert">
                  {fieldErrors.phone}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="add-lead-value" className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Deal value (₹, optional)
              </label>
              <input
                id="add-lead-value"
                name="value"
                inputMode="decimal"
                placeholder="e.g. 250000"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                className={inputClass}
              />
              {fieldErrors.valueStr ? (
                <p className="mt-1 text-xs text-red-300" role="alert">
                  {fieldErrors.valueStr}
                </p>
              ) : null}
            </div>

            <div>
              <label htmlFor="add-lead-assign" className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Assign to
              </label>
              <select
                id="add-lead-assign"
                name="assignedToUserId"
                value={assignedToUserId}
                onChange={(e) => setAssignedToUserId(e.target.value)}
                disabled={loadingUsers}
                className={inputClass}
              >
                <option value="">You (default)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.role}
                  </option>
                ))}
              </select>
              {usersNote ? (
                <p className="mt-1 text-xs text-amber-200/80">{usersNote}</p>
              ) : null}
            </div>

            {submitError ? (
              <p className="text-sm text-red-300" role="alert">
                {submitError}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white/25"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[#FFC300]/90 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FFC300] disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Create lead"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
