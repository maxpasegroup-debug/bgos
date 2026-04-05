"use client";

import { ServiceTicketStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
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
  return (
    <li className="rounded-lg border border-white/10 bg-black/20 p-4">
      <p className="font-medium text-white">{t.title}</p>
      {t.description ? (
        <p className="mt-1 text-sm text-white/60">{t.description}</p>
      ) : null}
      <p className="mt-2 text-xs text-white/40">{subtitle}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onResolve(t.id)}
        className="mt-3 rounded-lg bg-violet-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
      >
        Resolve
      </button>
    </li>
  );
}

export function IceconnectServiceDashboard() {
  const [view, setView] = useState<"field" | "supervisor" | null>(null);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [poolTickets, setPoolTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/iceconnect/service/tickets", { credentials: "include" });
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
    } catch {
      setErr("Network error — check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(ticketId: string) {
    setBusy(ticketId);
    try {
      const res = await fetch("/api/iceconnect/service/resolve", {
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
    >
      {view === "field" ? (
        <>
          <IcPanel title="Assigned to you">
            {myTickets.length === 0 ? (
              <p className="text-sm text-white/45">No open tickets assigned to you.</p>
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
              <p className="text-sm text-white/45">No unassigned open tickets.</p>
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
            <p className="text-sm text-white/45">No open tickets.</p>
          ) : (
            <ul className="space-y-4">
              {openSupervisor.map((t) => (
                <li key={t.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <p className="font-medium text-white">{t.title}</p>
                  {t.description ? (
                    <p className="mt-1 text-sm text-white/60">{t.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-white/40">
                    {t.assignee
                      ? `Assigned: ${t.assignee.name ?? t.assignee.email}`
                      : "Unassigned"}
                  </p>
                  <button
                    type="button"
                    disabled={busy === t.id}
                    onClick={() => void resolve(t.id)}
                    className="mt-3 rounded-lg bg-violet-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
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
