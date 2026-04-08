"use client";

import { LeadStatus } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { fadeUp } from "./motion";
import { BGOS_MAIN_PAD } from "./layoutTokens";

type SerializedLead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  statusLabel: string;
  value: number | null;
  assignedTo: string | null;
  assignee: { id: string; name: string; email: string } | null;
};

type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

const selectClass =
  "mt-0.5 w-full max-w-[14rem] rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-[#FFC300]/40 disabled:cursor-not-allowed disabled:opacity-50";

export function BgosLeadsAssignmentPanel({
  isAdmin,
  canUseMoney,
}: {
  isAdmin: boolean;
  canUseMoney: boolean;
}) {
  const { refetch, syncGeneration, trialReadOnly } = useBgosDashboardContext();
  const [leads, setLeads] = useState<SerializedLead[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [quotationTipByLead, setQuotationTipByLead] = useState<
    Record<string, { id: string; status: string; quotationNumber: string }>
  >({});
  const [invoiceTipByLead, setInvoiceTipByLead] = useState<
    Record<string, { id: string; paymentBucket: string; invoiceNumber: string }>
  >({});
  const tableInitialLoad = useRef(true);

  const loadLeads = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/leads?limit=100&offset=0", { credentials: "include" });
      const data = (await res.json()) as {
        ok?: boolean;
        leads?: SerializedLead[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(typeof data.error === "string" ? data.error : "Could not load leads");
        setLeads([]);
        return;
      }
      setLeads(Array.isArray(data.leads) ? data.leads : []);
    } catch {
      setLoadError("Network error loading leads");
      setLeads([]);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; users?: PublicUser[] };
      if (!res.ok || !Array.isArray(data.users)) {
        setUsers([]);
        return;
      }
      setUsers(data.users.filter((u) => u.isActive));
    } catch {
      setUsers([]);
    }
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    if (tableInitialLoad.current) {
      setLoading(true);
    }
    void (async () => {
      await Promise.all([loadLeads(), loadUsers()]);
      tableInitialLoad.current = false;
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLeads, loadUsers, syncGeneration]);

  useEffect(() => {
    if (!canUseMoney) {
      setQuotationTipByLead({});
      setInvoiceTipByLead({});
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [qRes, iRes] = await Promise.all([
          fetch("/api/quotation/list", { credentials: "include" }),
          fetch("/api/invoice/list", { credentials: "include" }),
        ]);
        const qData = (await qRes.json()) as {
          ok?: boolean;
          quotations?: { id: string; leadId: string | null; status: string; quotationNumber: string }[];
        };
        const iData = (await iRes.json()) as {
          ok?: boolean;
          invoices?: {
            id: string;
            leadId: string | null;
            paymentBucket: string;
            invoiceNumber: string;
          }[];
        };
        if (cancelled) return;
        if (!qRes.ok || !qData.ok || !Array.isArray(qData.quotations)) {
          setQuotationTipByLead({});
        } else {
          const qt: Record<string, { id: string; status: string; quotationNumber: string }> = {};
          for (const q of qData.quotations) {
            if (q.leadId && !qt[q.leadId]) {
              qt[q.leadId] = { id: q.id, status: q.status, quotationNumber: q.quotationNumber };
            }
          }
          setQuotationTipByLead(qt);
        }
        if (!iRes.ok || !iData.ok || !Array.isArray(iData.invoices)) {
          setInvoiceTipByLead({});
        } else {
          const inv: Record<string, { id: string; paymentBucket: string; invoiceNumber: string }> =
            {};
          for (const invRow of iData.invoices) {
            if (invRow.leadId && !inv[invRow.leadId]) {
              inv[invRow.leadId] = {
                id: invRow.id,
                paymentBucket: invRow.paymentBucket,
                invoiceNumber: invRow.invoiceNumber,
              };
            }
          }
          setInvoiceTipByLead(inv);
        }
      } catch {
        if (!cancelled) {
          setQuotationTipByLead({});
          setInvoiceTipByLead({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canUseMoney, syncGeneration]);

  async function handleAssignChange(lead: SerializedLead, rawValue: string) {
    if (trialReadOnly) {
      setLoadError("Your free trial has expired. Upgrade to assign leads.");
      window.setTimeout(() => setLoadError(null), 5000);
      return;
    }
    if (!isAdmin) return;
    const assignedToUserId = rawValue === "" ? null : rawValue;
    if (assignedToUserId === lead.assignedTo) return;

    const prevLeads = leads;
    const picked =
      assignedToUserId === null
        ? null
        : users.find((u) => u.id === assignedToUserId) ?? lead.assignee;

    const optimisticAssignee =
      assignedToUserId === null
        ? null
        : picked
          ? { id: picked.id, name: picked.name, email: picked.email }
          : null;

    setLeads((ls) =>
      ls.map((l) =>
        l.id === lead.id
          ? { ...l, assignedTo: assignedToUserId, assignee: optimisticAssignee }
          : l,
      ),
    );
    setAssigningId(lead.id);

    try {
      const res = await fetch("/api/leads/update-status", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          assignedToUserId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        lead?: SerializedLead;
        error?: string;
        code?: string;
      };

      if (!res.ok || !data.ok) {
        setLeads(prevLeads);
        setLoadError(
          data.code === "TRIAL_EXPIRED"
            ? typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Your free trial has expired. Upgrade to continue."
            : typeof data.error === "string"
              ? data.error
              : "Assignment failed",
        );
        window.setTimeout(() => setLoadError(null), 5000);
        return;
      }

      if (data.lead) {
        setLeads((ls) => ls.map((l) => (l.id === lead.id ? { ...l, ...data.lead! } : l)));
      }
      void refetch();
    } catch {
      setLeads(prevLeads);
      setLoadError("Network error — try again");
      window.setTimeout(() => setLoadError(null), 5000);
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <motion.section
      id="leads-assign"
      variants={fadeUp}
      className="col-span-full"
      style={{ scrollMarginTop: "5.5rem" }}
    >
      <DashboardSurface tilt={false} className={`overflow-x-auto p-5 sm:p-6 ${BGOS_MAIN_PAD}`}>
        <h2 className="text-sm font-semibold text-white sm:text-base">Leads & assignment</h2>
        <p className="mt-1 text-xs text-white/45">
          {isAdmin
            ? "Assign owners so telecallers see leads in ICECONNECT."
            : "Who owns each open lead. Only admins can change assignment."}
        </p>

        {loadError && !loading ? (
          <p className="mt-3 text-sm text-amber-200/90" role="alert">
            {loadError}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <p className="mt-4 text-sm text-white/45">No leads yet — use Add Lead to create one.</p>
        ) : (
          <div className="mt-4 min-w-[min(100%,36rem)]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  <th className="pb-2 pr-3">Lead</th>
                  <th className="pb-2 pr-3">Phone</th>
                  <th className="pb-2 pr-3">Stage</th>
                  <th className="pb-2 pr-3">Assignee</th>
                  {canUseMoney ? <th className="pb-2 pr-3">Money</th> : null}
                  {isAdmin ? (
                    <th className="pb-2">Assign to</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/[0.06]">
                    <td className="py-2.5 pr-3 font-medium text-white">
                      <Link
                        href={`/bgos/leads/${encodeURIComponent(lead.id)}`}
                        className="text-white transition hover:text-[#FFC300]"
                      >
                        {lead.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-white/60">{lead.phone}</td>
                    <td className="py-2.5 pr-3 text-white/70">{lead.statusLabel}</td>
                    <td className="py-2.5 pr-3 text-white/70">
                      {lead.assignee?.name ?? "—"}
                    </td>
                    {canUseMoney ? (
                      <td className="py-2.5 pr-3 align-top">
                        <div className="flex max-w-[12rem] flex-col gap-1">
                          {!trialReadOnly &&
                          (lead.status === LeadStatus.PROPOSAL_SENT ||
                            lead.status === LeadStatus.NEGOTIATION) &&
                          !(quotationTipByLead[lead.id] && quotationTipByLead[lead.id].status !== "REJECTED") ? (
                            <Link
                              href={`/bgos/money/quotation/create?leadId=${encodeURIComponent(lead.id)}`}
                              className="text-[11px] font-semibold text-[#FFC300] transition hover:text-[#FFE066]"
                            >
                              Create quote
                            </Link>
                          ) : null}
                          {quotationTipByLead[lead.id] &&
                          quotationTipByLead[lead.id].status !== "REJECTED" ? (
                            <p className="text-[10px] text-white/45">
                              {quotationTipByLead[lead.id].quotationNumber} ·{" "}
                              {quotationTipByLead[lead.id].status}
                            </p>
                          ) : null}
                          {!trialReadOnly &&
                          quotationTipByLead[lead.id]?.status === "APPROVED" &&
                          !invoiceTipByLead[lead.id] ? (
                            <Link
                              href={`/bgos/money/invoices?quotationId=${encodeURIComponent(quotationTipByLead[lead.id].id)}`}
                              className="text-[11px] font-semibold text-emerald-200/90 transition hover:text-emerald-100"
                            >
                              Generate invoice
                            </Link>
                          ) : null}
                          {invoiceTipByLead[lead.id] ? (
                            <Link
                              href={`/bgos/money/invoices/${invoiceTipByLead[lead.id].id}`}
                              className="text-[10px] font-medium text-emerald-200/85 hover:text-emerald-100"
                            >
                              View invoice ({invoiceTipByLead[lead.id].paymentBucket})
                            </Link>
                          ) : null}
                          <Link
                            href={`/bgos/money?tab=quotations&leadId=${encodeURIComponent(lead.id)}`}
                            className="text-[10px] text-white/40 underline-offset-2 hover:text-white/60 hover:underline"
                          >
                            Open money
                          </Link>
                        </div>
                      </td>
                    ) : null}
                    {isAdmin ? (
                      <td className="py-2 align-middle">
                        <label className="sr-only" htmlFor={`assign-${lead.id}`}>
                          Assign {lead.name}
                        </label>
                        <select
                          id={`assign-${lead.id}`}
                          className={selectClass}
                          value={lead.assignedTo ?? ""}
                          disabled={assigningId === lead.id || trialReadOnly}
                          onChange={(e) => void handleAssignChange(lead, e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                        </select>
                        {users.length === 0 ? (
                          <p className="mt-1 text-[10px] text-amber-200/80">
                            Add employees to assign leads to your team.
                          </p>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSurface>
    </motion.section>
  );
}
