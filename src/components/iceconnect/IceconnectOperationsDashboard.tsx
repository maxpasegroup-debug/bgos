"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IceconnectWorkspaceView } from "@/components/iceconnect/IceconnectWorkspaceView";
import { IcPanel } from "@/components/iceconnect/IcPanel";

type Module = "site" | "approval" | "install" | "service";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[color:var(--ice-primary)]";

export function IceconnectOperationsDashboard({ module }: { module: Module }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leadId, setLeadId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [id, setId] = useState("");

  const cfg = useMemo(() => {
    if (module === "site") {
      return {
        title: "Site Operations",
        list: "/api/operations/site/list",
        create: "/api/operations/site/create",
        update: "/api/operations/site/update",
        createBody: () => ({ leadId, assignedTo }),
        updateBody: () => ({ id, status, report: notes ? { notes } : undefined }),
        statusOptions: ["SCHEDULED", "COMPLETED"],
      };
    }
    if (module === "approval") {
      return {
        title: "Approvals (KSEB / PRO)",
        list: "/api/operations/approval/list",
        create: "/api/operations/approval/create",
        update: "/api/operations/approval/update",
        createBody: () => ({ leadId, notes }),
        updateBody: () => ({ id, status, notes }),
        statusOptions: ["PENDING", "APPROVED", "REJECTED"],
      };
    }
    if (module === "install") {
      return {
        title: "Installation Operations",
        list: "/api/operations/install/list",
        create: "/api/operations/install/create",
        update: "/api/operations/install/update",
        createBody: () => ({ leadId, assignedTo: assignedTo || undefined, notes }),
        updateBody: () => ({ id, status, notes }),
        statusOptions: ["PENDING", "IN_PROGRESS", "COMPLETED"],
      };
    }
    return {
      title: "Service Operations",
      list: "/api/operations/service/list",
      create: "/api/operations/service/create",
      update: "/api/operations/service/update",
      createBody: () => ({ leadId, issue: notes, assignedTo: assignedTo || undefined }),
      updateBody: () => ({ id, status, notes }),
      statusOptions: ["OPEN", "IN_PROGRESS", "CLOSED"],
    };
  }, [module, leadId, assignedTo, id, status, notes]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(cfg.list);
      const j = (await res.json()) as any;
      if (!res.ok || !j.ok) {
        setError(j.error ?? "Could not load operations data");
        setRows([]);
        return;
      }
      const key =
        module === "site"
          ? "siteVisits"
          : module === "approval"
            ? "approvals"
            : module === "install"
              ? "installations"
              : "serviceTickets";
      setRows(Array.isArray(j[key]) ? j[key] : []);
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Request failed"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [cfg.list, module]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createItem() {
    const res = await apiFetch(cfg.create, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg.createBody()),
    });
    const j = (await res.json()) as any;
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not create");
      return;
    }
    setLeadId("");
    setAssignedTo("");
    setNotes("");
    await load();
  }

  async function updateItem() {
    const res = await apiFetch(cfg.update, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg.updateBody()),
    });
    const j = (await res.json()) as any;
    if (!res.ok || !j.ok) {
      setError(j.error ?? "Could not update");
      return;
    }
    setId("");
    setNotes("");
    await load();
  }

  return (
    <IceconnectWorkspaceView
      title={cfg.title}
      subtitle="Assigned tasks, status updates, and reports/notes."
      loading={loading}
      error={error}
      onRetry={() => void load()}
    >
      <div className="grid gap-6">
        <IcPanel title="Create">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-gray-500">
              Lead ID
              <input className={inputClass} value={leadId} onChange={(e) => setLeadId(e.target.value)} />
            </label>
            {module !== "approval" ? (
              <label className="text-xs text-gray-500">
                Assigned To (userId)
                <input className={inputClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
              </label>
            ) : null}
            <label className="text-xs text-gray-500">
              {module === "service" ? "Issue" : "Notes/Report"}
              <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <button type="button" className="mt-3 rounded-lg bg-[color:var(--ice-primary)] px-3 py-2 text-sm font-semibold text-white" onClick={() => void createItem()}>
            Create
          </button>
        </IcPanel>

        <IcPanel title="Update status">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-gray-500">
              Record ID
              <input className={inputClass} value={id} onChange={(e) => setId(e.target.value)} />
            </label>
            <label className="text-xs text-gray-500">
              Status
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Select</option>
                {cfg.statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Notes
              <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <button type="button" className="mt-3 rounded-lg border border-gray-300 px-3 py-2 text-sm" onClick={() => void updateItem()}>
            Update
          </button>
        </IcPanel>

        <IcPanel title="Assigned tasks">
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-900">
                  {r.lead?.name ?? r.leadName ?? "Lead"} · {r.status ?? r.uiStatus}
                </p>
                <p className="text-gray-600">{r.id}</p>
              </div>
            ))}
          </div>
        </IcPanel>
      </div>
    </IceconnectWorkspaceView>
  );
}
