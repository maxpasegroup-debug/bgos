"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/document-types";

type PublicDocumentRow = {
  id: string;
  leadId: string | null;
  type: string;
  typeLabel: string;
  fileName: string;
  downloadUrl: string;
  createdAt: string;
};

type LeadOption = { id: string; name: string };

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#FFC300]/45";
const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#FFC300]/45 bg-[#FFC300]/18 px-4 text-sm font-bold text-[#FFC300] transition hover:bg-[#FFC300]/24 disabled:opacity-50";
const btnGhost =
  "inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/12 px-3 text-xs font-semibold text-white/90 transition hover:border-[#FFC300]/35";

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function FileTypeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function extensionBadge(fileName: string) {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "FILE";
  return fileName.slice(i + 1).toUpperCase().slice(0, 4);
}

export function BgosDocumentsClient({
  embeddedLeadId,
  compact,
}: {
  /** When set, lists and uploads are tied to this lead (lead detail page). */
  embeddedLeadId?: string;
  compact?: boolean;
}) {
  const [documents, setDocuments] = useState<PublicDocumentRow[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [filterType, setFilterType] = useState<string>("");
  const [filterLeadId, setFilterLeadId] = useState("");

  const [uploadType, setUploadType] = useState<DocumentType>("OTHER");
  const [uploadLeadId, setUploadLeadId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const effectiveListLeadId = embeddedLeadId ?? (filterLeadId.trim() || undefined);

  const loadDocuments = useCallback(async () => {
    setError(null);
    try {
      const p = new URLSearchParams();
      if (effectiveListLeadId) p.set("leadId", effectiveListLeadId);
      if (filterType.trim()) p.set("type", filterType.trim());
      const res = await fetch(`/api/document/list?${p}`, { credentials: "include" });
      const data = (await res.json()) as { ok?: boolean; documents?: PublicDocumentRow[]; error?: string };
      if (!res.ok || !data.ok || !Array.isArray(data.documents)) {
        setError(typeof data.error === "string" ? data.error : "Could not load documents");
        setDocuments([]);
        return;
      }
      setDocuments(data.documents);
    } catch {
      setError("Network error");
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveListLeadId, filterType]);

  const loadLeads = useCallback(async () => {
    if (embeddedLeadId) return;
    try {
      const res = await fetch("/api/leads?limit=100", { credentials: "include" });
      const data = (await res.json()) as {
        ok?: boolean;
        leads?: { id: string; name: string }[];
      };
      if (!res.ok || !data.ok || !Array.isArray(data.leads)) return;
      setLeads(data.leads.map((l) => ({ id: l.id, name: l.name })));
    } catch {
      /* optional */
    }
  }, [embeddedLeadId]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const uploadTargetLeadId = embeddedLeadId ?? (uploadLeadId.trim() || "");

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file (PDF, JPG, or PNG).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("type", uploadType);
      if (uploadTargetLeadId) fd.set("leadId", uploadTargetLeadId);

      const res = await fetch("/api/document/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : "Upload failed");
        return;
      }
      setFile(null);
      const input = document.getElementById(
        embeddedLeadId ? `doc-file-${embeddedLeadId}` : "doc-file-hub",
      ) as HTMLInputElement | null;
      if (input) input.value = "";
      await loadDocuments();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const leadNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of leads) m.set(l.id, l.name);
    return m;
  }, [leads]);

  return (
    <div className={compact ? "space-y-4" : "mx-auto max-w-5xl space-y-8 px-4 sm:px-6"}>
      {!embeddedLeadId && !compact ? (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Documents</h1>
          <p className="mt-1 text-sm text-white/55">
            Agreements, KSEB approvals, site reports, and customer files — stored per company.
          </p>
        </div>
      ) : null}

      {embeddedLeadId ? (
        <h2 className="text-sm font-semibold text-white">Documents</h2>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-500/35 bg-red-950/25 px-3 py-2 text-sm text-red-100" role="alert">
          {error}
        </p>
      ) : null}

      <DashboardSurface tilt={false} className="p-4 sm:p-6">
        <h3 className={`font-semibold text-white ${compact ? "text-sm" : "text-base"}`}>Upload</h3>
        <p className="mt-1 text-xs text-white/45">PDF, JPG, or PNG — up to {MAX_MB} MB per file.</p>
        <form className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end" onSubmit={(e) => void onUpload(e)}>
          <label className="w-full sm:w-auto sm:min-w-[200px]">
            <span className="text-[11px] font-medium text-white/50">Type</span>
            <select
              className={inputClass}
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value as DocumentType)}
              disabled={busy}
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {!embeddedLeadId ? (
            <label className="w-full sm:flex-1 sm:min-w-[220px]">
              <span className="text-[11px] font-medium text-white/50">Lead (optional)</span>
              <select
                className={inputClass}
                value={uploadLeadId}
                onChange={(e) => setUploadLeadId(e.target.value)}
                disabled={busy}
              >
                <option value="">Company-wide (no lead)</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="w-full sm:min-w-[220px] sm:flex-1">
            <span className="text-[11px] font-medium text-white/50">File</span>
            <input
              id={embeddedLeadId ? `doc-file-${embeddedLeadId}` : "doc-file-hub"}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className={`${inputClass} py-2`}
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setError(null);
                if (f && f.size > MAX_BYTES) {
                  setFile(null);
                  e.target.value = "";
                  setError(`File too large (max ${MAX_MB} MB).`);
                  return;
                }
                if (f) {
                  const name = f.name.toLowerCase();
                  const ok =
                    name.endsWith(".pdf") ||
                    name.endsWith(".jpg") ||
                    name.endsWith(".jpeg") ||
                    name.endsWith(".png");
                  if (!ok) {
                    setFile(null);
                    e.target.value = "";
                    setError("Only PDF, JPG, and PNG files are allowed.");
                    return;
                  }
                }
                setFile(f);
              }}
            />
          </label>
          <button type="submit" className={btnPrimary} disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload"}
          </button>
        </form>
      </DashboardSurface>

      <DashboardSurface tilt={false} className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className={`font-semibold text-white ${compact ? "text-sm" : "text-base"}`}>Library</h3>
            <p className="mt-1 text-xs text-white/45">Filter by type {embeddedLeadId ? "" : "or lead"}.</p>
          </div>
          {!embeddedLeadId ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="sm:w-44">
                <span className="text-[10px] font-medium text-white/45">Type</span>
                <select
                  className={inputClass}
                  value={filterType}
                  onChange={(e) => {
                    setLoading(true);
                    setFilterType(e.target.value);
                  }}
                >
                  <option value="">All types</option>
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DOCUMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sm:min-w-[200px]">
                <span className="text-[10px] font-medium text-white/45">Lead</span>
                <select
                  className={inputClass}
                  value={filterLeadId}
                  onChange={(e) => {
                    setLoading(true);
                    setFilterLeadId(e.target.value);
                  }}
                >
                  <option value="">All leads</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <label className="sm:w-44">
              <span className="text-[10px] font-medium text-white/45">Type</span>
              <select
                className={inputClass}
                value={filterType}
                onChange={(e) => {
                  setLoading(true);
                  setFilterType(e.target.value);
                }}
              >
                <option value="">All types</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-white/45">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="mt-8 text-sm text-white/45">No documents yet.</p>
        ) : (
          <ul className="mt-6 space-y-2">
            {documents.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/25 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#FFC300]/25 bg-[#FFC300]/10 text-[#FFC300]">
                    <div className="relative flex flex-col items-center">
                      <FileTypeIcon className="h-6 w-6" />
                      <span className="absolute -bottom-1 rounded bg-black/80 px-0.5 text-[7px] font-bold text-white/90">
                        {extensionBadge(d.fileName)}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white" title={d.fileName}>
                      {d.fileName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/45">
                      {d.typeLabel}
                      {" · "}
                      {new Date(d.createdAt).toLocaleString()}
                      {d.leadId && !embeddedLeadId ? (
                        <>
                          {" · "}
                          <Link
                            href={`/bgos/leads/${d.leadId}`}
                            className="text-[#FFC300]/90 hover:underline"
                          >
                            {leadNameById.get(d.leadId) ?? `Lead ${d.leadId.slice(0, 8)}…`}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                <a
                  href={d.downloadUrl}
                  className={`${btnGhost} shrink-0`}
                  download={d.fileName}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </DashboardSurface>
    </div>
  );
}
