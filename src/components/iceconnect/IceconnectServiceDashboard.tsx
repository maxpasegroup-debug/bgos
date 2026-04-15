"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { ServiceTicketStatus } from "@prisma/client";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useCompanyBranding } from "@/contexts/company-branding-context";
import { IceconnectWorkspaceView } from "./IceconnectWorkspaceView";
import { IcPanel } from "./IcPanel";

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: ServiceTicketStatus;
  createdAt: string;
  assignedTo: string | null;
  assignee: { id: string; name: string; email: string } | null;
};

function TicketCard({
  t,
  busy,
  subtitle,
  onResolve,
}: {
  t: Ticket;
  busy: boolean;
  subtitle: string;
  onResolve: (id: string) => void;
}) {
  const resolveStyle = {
    background: "linear-gradient(90deg, var(--ice-primary), var(--ice-secondary))",
  } as CSSProperties;

  return (
    <li className="rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm">
      <p className="font-medium text-gray-900">{t.title}</p>
      {t.description ? <p className="mt-1 text-sm text-gray-600">{t.description}</p> : null}
      <p className="mt-2 text-xs text-gray-500">{subtitle}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onResolve(t.id)}
        className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
        style={resolveStyle}
      >
        Resolve
      </button>
    </li>
  );
}

export function IceconnectServiceDashboard() {
  const { company } = useCompanyBranding();
  const [view, setView] = useState<"field" | "supervisor" | null>(null);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [poolTickets, setPoolTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const resolveStyle = {
    background: "linear-gradient(90deg, var(--ice-primary), var(--ice-secondary))",
  } as CSSProperties;

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/iceconnect/service/tickets", { credentials: "include" });
      if (!res.ok) {
        let msg = "Could not load tickets.";
        try {
          const j = (await res.json()) as { error?: string };
          if (typeof j.error === "string" && j.error.trim()) msg = j.error;
        } catch {
          /* ignore */
        }
        setErr(msg);
        return;
      }
      const data = (await res.json()) as
        | { ok: true; view: "field"; myTickets: Ticket[]; poolTickets: Ticket[] }
        | { ok: true; view: "supervisor"; tickets: Ticket[] };
      if (data.view === "field") {
        setView("field");
        setMyTickets(Array.isArray(data.myTickets) ? data.myTickets : []);
        setPoolTickets(Array.isArray(data.poolTickets) ? data.poolTickets : []);
        setAllTickets([]);
      } else {
        setView("supervisor");
        setAllTickets(Array.isArray(data.tickets) ? data.tickets : []);
        setMyTickets([]);
        setPoolTickets([]);
      }
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function resolve(ticketId: string) {
    setBusy(ticketId);
    try {
      const res = await apiFetch("/api/iceconnect/service/resolve", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      if (!res.ok) {
        setErr("Could not resolve ticket.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  const openSupervisor = allTickets.filter((t) => t.status === ServiceTicketStatus.OPEN);
  const cn = company?.name?.trim() ?? "your company";

  const hero = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-gray-200/90 bg-white/85 p-5 shadow-sm backdrop-blur-md"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--ice-primary)]">
        Service · {cn}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-gray-900">Tickets & resolutions</h2>
      <p className="mt-1 text-sm text-gray-500">
        Resolve customer issues fast — your queue is scoped to what you’re allowed to see.
      </p>
    </motion.div>
  );

  return (
    <IceconnectWorkspaceView
      title="Service"
      subtitle={
        view === "supervisor"
          ? "Company tickets — you can see assignees. Field staff only see their queue and the unassigned pool."
          : "Assigned to you and unassigned pool only — tickets owned by other agents are hidden."
      }
      loading={loading}
      error={err}
      onRetry={() => void load()}
      hero={hero}
    >
      {view === "field" ? (
        <>
          <IcPanel title="Your queue">
            <p className="text-sm text-gray-600">
              Work assigned tickets first, then pull from the unassigned pool when you have capacity.
            </p>
          </IcPanel>
          <IcPanel title="Assigned to you">
            {myTickets.length === 0 ? (
              <p className="text-sm text-gray-500">No open tickets assigned to you.</p>
            ) : (
              <ul className="space-y-4">
                {myTickets.map((t) => (
                  <TicketCard
                    key={t.id}
                    t={t}
                    busy={busy === t.id}
                    subtitle="Assigned to you"
                    onResolve={resolve}
                  />
                ))}
              </ul>
            )}
          </IcPanel>

          <IcPanel title="Unassigned pool">
            {poolTickets.length === 0 ? (
              <p className="text-sm text-gray-500">No unassigned open tickets.</p>
            ) : (
              <ul className="space-y-4">
                {poolTickets.map((t) => (
                  <TicketCard
                    key={t.id}
                    t={t}
                    busy={busy === t.id}
                    subtitle="Unassigned — resolving will attach this ticket to you"
                    onResolve={resolve}
                  />
                ))}
              </ul>
            )}
          </IcPanel>
        </>
      ) : view === "supervisor" ? (
        <IcPanel title="Open tickets">
          {openSupervisor.length === 0 ? (
            <p className="text-sm text-gray-500">No open tickets.</p>
          ) : (
            <ul className="space-y-4">
              {openSupervisor.map((t) => (
                <li key={t.id} className="rounded-lg border border-gray-200 bg-white/90 p-4 shadow-sm">
                  <p className="font-medium text-gray-900">{t.title}</p>
                  {t.description ? (
                    <p className="mt-1 text-sm text-gray-600">{t.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-gray-500">
                    {t.assignee ? `Assigned: ${t.assignee.name ?? t.assignee.email}` : "Unassigned"}
                  </p>
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void resolve(t.id)}
                    className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
                    style={resolveStyle}
                  >
                    Resolve
                  </button>
                </li>
              ))}
            </ul>
          )}
        </IcPanel>
      ) : null}
    </IceconnectWorkspaceView>
  );
}
