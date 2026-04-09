"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  automationAction: z.enum(["assign", "whatsapp", "both"]).optional(),
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
  const { refetch, trialReadOnly } = useBgosDashboardContext();
  const titleId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [valueStr, setValueStr] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [automationAction, setAutomationAction] = useState<"assign" | "whatsapp" | "both">("both");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [usersNote, setUsersNote] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const assignDefaultLabel =
    currentUser?.role === "ADMIN" ? "My Leads (Boss)" : "My leads";

  const assigneeChoices = useMemo(() => {
    if (!currentUser?.id) return users.filter((u) => u.isActive);
    return users.filter((u) => u.isActive && u.id !== currentUser.id);
  }, [users, currentUser?.id]);

  const loadSessionAndUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersNote(null);
    try {
      const [meRes, usersRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch("/api/users", { credentials: "include" }),
      ]);

      let meId: string | null = null;
      let meRole: string | null = null;
      try {
        const meJson = (await meRes.json()) as {
          authenticated?: boolean;
          user?: { id: string; role: string };
        };
        if (meRes.ok && meJson.authenticated && meJson.user) {
          meId = meJson.user.id;
          meRole = meJson.user.role;
        }
      } catch {
        /* ignore */
      }
      setCurrentUser(meId && meRole ? { id: meId, role: meRole } : null);

      const data = (await usersRes.json()) as {
        ok?: boolean;
        users?: PublicUser[];
        error?: string;
      };
      if (!usersRes.ok) {
        setUsers([]);
        setUsersNote(
          typeof data.error === "string"
            ? data.error
            : "Team list unavailable — assignment defaults to you.",
        );
        return;
      }
      const list = Array.isArray(data.users) ? data.users.filter((u) => u.isActive) : [];
      setUsers(list);
    } catch {
      setUsers([]);
      setCurrentUser(null);
      setUsersNote("Could not load team — assignment defaults to you.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setCurrentUser(null);
    void loadSessionAndUsers();
    setFieldErrors({});
    setSubmitError(null);
    setSuccess(null);
    setAssignedToUserId("");
    setAutomationAction("both");
    const t = window.setTimeout(() => nameInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open, loadSessionAndUsers]);

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
    if (trialReadOnly) {
      setSubmitError("Your free trial has expired. Upgrade to continue.");
      return;
    }
    setFieldErrors({});
    setSubmitError(null);
    setSuccess(null);

    const parsed = formSchema.safeParse({
      name,
      phone,
      valueStr: valueStr.trim() || undefined,
      assignedToUserId: assignedToUserId || undefined,
      automationAction,
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
      automationAction?: "assign" | "whatsapp" | "both";
    } = {
      name: parsed.data.name,
      phone: parsed.data.phone,
    };
    if (value !== undefined) body.value = value;
    if (parsed.data.assignedToUserId?.trim()) {
      body.assignedToUserId = parsed.data.assignedToUserId.trim();
    }
    if (parsed.data.automationAction) body.automationAction = parsed.data.automationAction;

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
        if (data.code === "TRIAL_EXPIRED") {
          setSubmitError(
            typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Your free trial has expired. Upgrade to continue.",
          );
          return;
        }
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden p-5 sm:p-6"
      role="presentation"
    >
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 my-auto w-full max-w-[500px] max-h-[min(90dvh,calc(100vh-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#0f141d] p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold text-white">
          Add lead
        </h2>
        <p className="mt-1 text-xs text-white/45">
          New leads start in <span className="text-white/70">New</span> and get a follow-up task.
        </p>
        {trialReadOnly ? (
          <p className="mt-3 rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-2 text-xs text-amber-100/90">
            Your trial has expired. Upgrade to add leads.
          </p>
        ) : null}

        <form className="mt-5 space-y-4 pb-1" onSubmit={(e) => void onSubmit(e)} noValidate>
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
              <option value="">{loadingUsers ? "Loading…" : assignDefaultLabel}</option>
              {assigneeChoices.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name.trim() || u.email}
                </option>
              ))}
            </select>
            {usersNote ? (
              <p className="mt-1 text-xs text-amber-200/80">{usersNote}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor="add-lead-automation" className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              What should Nexa do?
            </label>
            <select
              id="add-lead-automation"
              name="automationAction"
              value={automationAction}
              onChange={(e) => setAutomationAction(e.target.value as "assign" | "whatsapp" | "both")}
              className={inputClass}
            >
              <option value="assign">Assign to employee</option>
              <option value="whatsapp">Send WhatsApp intro</option>
              <option value="both">Do both</option>
            </select>
          </div>

          {submitError ? (
            <p className="text-sm text-red-300" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
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
              disabled={submitting || trialReadOnly}
              className="rounded-xl bg-[#FFC300]/90 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FFC300] disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Create lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
