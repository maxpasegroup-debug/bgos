"use client";

import { ServiceTicketStatus } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { IcPanel } from "./IcPanel";

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: ServiceTicketStatus;
  createdAt: string;
  assignedTo: string | null;
};

export function IceconnectServiceDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/iceconnect/service/tickets", { credentials: "include" });
    if (!res.ok) {
      setErr("Could not load tickets");
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { tickets: Ticket[] };
    setTickets(data.tickets);
    setErr(null);
    setLoading(false);
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
        setErr("Could not resolve ticket");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-white/50">Loading tickets…</p>;
  }

  const open = tickets.filter((t) => t.status === ServiceTicketStatus.OPEN);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Service</h1>
        <p className="mt-1 text-sm text-white/50">Your queue and unassigned open tickets.</p>
      </div>
      {err ? (
        <p className="text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <IcPanel title="Tickets">
        {open.length === 0 ? (
          <p className="text-sm text-white/45">No open tickets in your queue.</p>
        ) : (
          <ul className="space-y-4">
            {open.map((t) => (
              <li key={t.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <p className="font-medium text-white">{t.title}</p>
                {t.description ? (
                  <p className="mt-1 text-sm text-white/60">{t.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-white/40">
                  {t.assignedTo ? "Assigned to you" : "Unassigned — you can resolve"}
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
    </div>
  );
}
