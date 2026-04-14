"use client";


import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";
import { useCallback, useEffect, useState } from "react";
import { IceconnectWorkspaceView } from "@/components/iceconnect/IceconnectWorkspaceView";

type SiteRow = {
  id: string;
  status: string;
  lead?: { name?: string; phone?: string };
  assignee?: { name?: string };
};

type InstallRow = {
  id: string;
  status: string;
  notes?: string | null;
  lead?: { name?: string; phone?: string };
};

type ServiceRow = {
  id: string;
  status?: string;
  uiStatus?: string;
  issue?: string | null;
  title?: string | null;
  lead?: { name?: string; phone?: string };
};

type ApprovalRow = {
  id: string;
  status: string;
  lead?: { name?: string; phone?: string };
};

async function readJson<T>(res: Response): Promise<{ ok: boolean; data: T; error?: string }> {
  const j = (await res.json().catch(() => ({}))) as T & {
    ok?: boolean;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, data: j as T, error: typeof j.error === "string" ? j.error : "Request failed" };
  }
  if (j.ok === false) {
    return { ok: false, data: j as T, error: typeof j.error === "string" ? j.error : "Request failed" };
  }
  return { ok: true, data: j as T };
}

export function IceconnectOperationsHub() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [installs, setInstalls] = useState<InstallRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [sectionErr, setSectionErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setSectionErr({});
    setLoading(true);
    try {
      const [sr, ir, tr, ar] = await Promise.all([
        apiFetch("/api/operations/site/list", { credentials: "include" }),
        apiFetch("/api/operations/install/list", { credentials: "include" }),
        apiFetch("/api/operations/service/list", { credentials: "include" }),
        apiFetch("/api/operations/approval/list", { credentials: "include" }),
      ]);

      const siteJ = await readJson<{ siteVisits?: SiteRow[] }>(sr);
      if (siteJ.ok) setSites(Array.isArray(siteJ.data.siteVisits) ? siteJ.data.siteVisits : []);
      else setSectionErr((s) => ({ ...s, sites: siteJ.error ?? "Could not load site visits" }));

      const instJ = await readJson<{ installations?: InstallRow[] }>(ir);
      if (instJ.ok) setInstalls(Array.isArray(instJ.data.installations) ? instJ.data.installations : []);
      else setSectionErr((s) => ({ ...s, installs: instJ.error ?? "Could not load installations" }));

      const svcJ = await readJson<{ serviceTickets?: ServiceRow[] }>(tr);
      if (svcJ.ok) setServices(Array.isArray(svcJ.data.serviceTickets) ? svcJ.data.serviceTickets : []);
      else setSectionErr((s) => ({ ...s, services: svcJ.error ?? "Could not load service tickets" }));

      const appJ = await readJson<{ approvals?: ApprovalRow[] }>(ar);
      if (appJ.ok) setApprovals(Array.isArray(appJ.data.approvals) ? appJ.data.approvals : []);
      else setSectionErr((s) => ({ ...s, approvals: appJ.error ?? "Could not load approvals" }));
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Request failed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchInstall(id: string, status: "PENDING" | "IN_PROGRESS" | "COMPLETED") {
    setBusy(`i:${id}`);
    try {
      const res = await apiFetch("/api/operations/install/update", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const j = await readJson(res);
      if (!j.ok) {
        setErr(j.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function patchService(id: string, status: "OPEN" | "IN_PROGRESS" | "CLOSED") {
    setBusy(`s:${id}`);
    try {
      const res = await apiFetch("/api/operations/service/update", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const j = await readJson(res);
      if (!j.ok) {
        setErr(j.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function patchSite(id: string, status: "SCHEDULED" | "COMPLETED") {
    setBusy(`v:${id}`);
    try {
      const res = await apiFetch("/api/operations/site/update", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const j = await readJson(res);
      if (!j.ok) {
        setErr(j.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function patchApproval(id: string, status: "PENDING" | "APPROVED" | "REJECTED") {
    setBusy(`a:${id}`);
    try {
      const res = await apiFetch("/api/operations/approval/update", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const j = await readJson(res);
      if (!j.ok) {
        setErr(j.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <IceconnectWorkspaceView
      title="Operations"
      subtitle="Site visits, installations, service requests, and approvals for your company."
      loading={loading}
      error={err}
      onRetry={() => void load()}
    >
      <div className="space-y-10">
        {sectionErr.sites ? (
          <p className="text-sm text-amber-800">{sectionErr.sites}</p>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-gray-800 uppercase">Site visits</h2>
            {sites.length === 0 ? (
              <p className="text-sm text-gray-500">No site visits.</p>
            ) : (
              <ul className="space-y-3">
                {sites.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{r.lead?.name ?? "Lead"}</p>
                      <p className="text-xs text-gray-500">{r.lead?.phone ?? ""}</p>
                      <p className="mt-1 text-xs text-gray-600">Status: {r.status}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                        defaultValue={r.status === "COMPLETED" ? "COMPLETED" : "SCHEDULED"}
                        disabled={busy === `v:${r.id}`}
                        onChange={(e) => {
                          const v = e.target.value as "SCHEDULED" | "COMPLETED";
                          void patchSite(r.id, v);
                        }}
                      >
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {sectionErr.installs ? (
          <p className="text-sm text-amber-800">{sectionErr.installs}</p>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-gray-800 uppercase">Installations</h2>
            {installs.length === 0 ? (
              <p className="text-sm text-gray-500">No installation jobs.</p>
            ) : (
              <ul className="space-y-3">
                {installs.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{r.lead?.name ?? "Lead"}</p>
                      <p className="text-xs text-gray-500">{r.lead?.phone ?? ""}</p>
                      <p className="mt-1 text-xs text-gray-600">Status: {r.status}</p>
                    </div>
                    <select
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      defaultValue={r.status}
                      disabled={busy === `i:${r.id}`}
                      onChange={(e) => {
                        const v = e.target.value as "PENDING" | "IN_PROGRESS" | "COMPLETED";
                        void patchInstall(r.id, v);
                      }}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {sectionErr.services ? (
          <p className="text-sm text-amber-800">{sectionErr.services}</p>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-gray-800 uppercase">Service requests</h2>
            {services.length === 0 ? (
              <p className="text-sm text-gray-500">No service tickets.</p>
            ) : (
              <ul className="space-y-3">
                {services.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{r.lead?.name ?? "Customer"}</p>
                      <p className="text-xs text-gray-600">{r.issue ?? r.title ?? "—"}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Status: {r.uiStatus ?? r.status ?? "OPEN"}
                      </p>
                    </div>
                    <select
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      defaultValue={r.uiStatus === "CLOSED" || r.status === "RESOLVED" ? "CLOSED" : "OPEN"}
                      disabled={busy === `s:${r.id}`}
                      onChange={(e) => {
                        const v = e.target.value as "OPEN" | "IN_PROGRESS" | "CLOSED";
                        void patchService(r.id, v);
                      }}
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {sectionErr.approvals ? (
          <p className="text-sm text-amber-800">{sectionErr.approvals}</p>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-gray-800 uppercase">Approvals</h2>
            {approvals.length === 0 ? (
              <p className="text-sm text-gray-500">No approval records.</p>
            ) : (
              <ul className="space-y-3">
                {approvals.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{r.lead?.name ?? "Lead"}</p>
                      <p className="mt-1 text-xs text-gray-600">Status: {r.status}</p>
                    </div>
                    <select
                      className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                      defaultValue={r.status}
                      disabled={busy === `a:${r.id}`}
                      onChange={(e) => {
                        const v = e.target.value as "PENDING" | "APPROVED" | "REJECTED";
                        void patchApproval(r.id, v);
                      }}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </IceconnectWorkspaceView>
  );
}
