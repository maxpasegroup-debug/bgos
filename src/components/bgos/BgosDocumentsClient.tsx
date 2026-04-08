"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardSurface } from "@/components/dashboard/DashboardSurface";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/document-types";
import type { PublicDocumentRow, PublicUploaderFilterOption } from "@/lib/document-serialize";
import { useBgosTrialReadOnly } from "@/components/bgos/BgosDataProvider";

type LeadOption = { id: string; name: string };

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/12 bg-black/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#FFC300]/45";
const btnPrimary =
  "inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#FFC300]/45 bg-[#FFC300]/18 px-4 text-sm font-bold text-[#FFC300] transition hover:bg-[#FFC300]/24 disabled:opacity-50";
const btnGhost =
  "inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/12 px-3 text-xs font-semibold text-white/90 transition hover:border-[#FFC300]/35";

const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;
const POLL_MS = 5000;

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

function isImageFileName(name: string) {
  const n = name.toLowerCase();
  return n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png");
}

function isPdfFileName(name: string) {
  return name.toLowerCase().endsWith(".pdf");
}

export function BgosDocumentsClient({
  embeddedLeadId,
  compact,
  /** Boss hub vs ICECONNECT vault (affects lead links). */
  vaultContext = "bgos",
}: {
  embeddedLeadId?: string;
  compact?: boolean;
  vaultContext?: "bgos" | "iceconnect";
}) {
  const trialReadOnly = useBgosTrialReadOnly();
  const [documents, setDocuments] = useState<PublicDocumentRow[]>([]);
  const [uploaders, setUploaders] = useState<PublicUploaderFilterOption[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PublicDocumentRow | null>(null);

  const [filterType, setFilterType] = useState<string>("");
  const [filterLeadId, setFilterLeadId] = useState("");
  const [filterUploadedBy, setFilterUploadedBy] = useState("");

  const [uploadType, setUploadType] = useState<DocumentType>("OTHER");
  const [uploadLeadId, setUploadLeadId] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const effectiveListLeadId = embeddedLeadId ?? (filterLeadId.trim() || undefined);

  const loadDocuments = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setError(null);
      try {
        const p = new URLSearchParams();
        if (effectiveListLeadId) p.set("leadId", effectiveListLeadId);
        if (filterType.trim()) p.set("type", filterType.trim());
        if (filterUploadedBy.trim()) p.set("uploadedByUserId", filterUploadedBy.trim());
        const res = await fetch(`/api/document/list?${p}`, { credentials: "include" });
        const data = (await res.json()) as {
          ok?: boolean;
          documents?: PublicDocumentRow[];
          uploaders?: PublicUploaderFilterOption[];
          error?: string;
        };
        if (!res.ok || !data.ok || !Array.isArray(data.documents)) {
          if (!opts?.silent) {
            setError(typeof data.error === "string" ? data.error : "Could not load documents");
            setDocuments([]);
          }
          return;
        }
        setDocuments(data.documents);
        if (Array.isArray(data.uploaders)) setUploaders(data.uploaders);
      } catch {
        if (!opts?.silent) {
          setError("Network error");
          setDocuments([]);
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [effectiveListLeadId, filterType, filterUploadedBy],
  );

  const loadLeads = useCallback(async () => {
    if (embeddedLeadId) return;
    try {
      const res = await fetch("/api/leads?limit=200", { credentials: "include" });
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
    setLoading(true);
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const id = window.setInterval(() => void loadDocuments({ silent: true }), POLL_MS);
    return () => window.clearInterval(id);
  }, [loadDocuments]);

  const uploadTargetLeadId = embeddedLeadId ?? (uploadLeadId.trim() || "");

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (trialReadOnly) {
      setError("Your free trial has expired. Upgrade to upload documents.");
      return;
    }
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
      const data = (await res.json()) as { ok?: boolean; error?: string; code?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.code === "TRIAL_EXPIRED"
            ? typeof data.error === "string" && data.error.trim()
              ? data.error
              : "Your free trial has expired. Upgrade to continue."
            : typeof data.error === "string"
              ? data.error
              : "Upload failed",
        );
        return;
      }
      setFile(null);
      const input = document.getElementById(
        embeddedLeadId ? `doc-file-${embeddedLeadId}` : "doc-file-hub",
      ) as HTMLInputElement | null;
      if (input) input.value = "";
      await loadDocuments({ silent: true });
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

  function leadLink(leadId: string) {
    if (vaultContext === "iceconnect") return null;
    return (
      <Link href={`/bgos/leads/${leadId}`} className="text-[#FFC300]/90 hover:underline">
        {leadNameById.get(leadId) ?? `Lead ${leadId.slice(0, 8)}…`}
      </Link>
    );
  }

  const showUploaderFilter = !embeddedLeadId && uploaders.length > 0;

  return (
    <div className={compact ? "space-y-4" : "mx-auto max-w-7xl space-y-8 px-4 sm:px-6"}>
      {!embeddedLeadId && !compact ? (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Documents</h1>
          <p className="mt-1 text-sm text-white/55">
            Company vault — agreements, approvals, site reports, and customer files. Refreshes every
            few seconds.
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
              disabled={busy || trialReadOnly}
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
                disabled={busy || trialReadOnly}
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
              disabled={busy || trialReadOnly}
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
          <button
            type="submit"
            className={btnPrimary}
            disabled={busy || !file || trialReadOnly}
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
        </form>
      </DashboardSurface>

      <DashboardSurface tilt={false} className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className={`font-semibold text-white ${compact ? "text-sm" : "text-base"}`}>Library</h3>
            <p className="mt-1 text-xs text-white/45">Filter by type, lead, or who uploaded.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
            {!embeddedLeadId ? (
              <label className="sm:min-w-[200px] sm:flex-1">
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
            ) : null}
            {showUploaderFilter ? (
              <label className="sm:min-w-[200px] sm:flex-1">
                <span className="text-[10px] font-medium text-white/45">Uploaded by</span>
                <select
                  className={inputClass}
                  value={filterUploadedBy}
                  onChange={(e) => {
                    setLoading(true);
                    setFilterUploadedBy(e.target.value);
                  }}
                >
                  <option value="">Everyone</option>
                  {uploaders.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.name} ({u.roleLabel})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-white/45">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="mt-8 text-sm text-white/45">No documents yet.</p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((d) => {
              const canPreview = isImageFileName(d.fileName) || isPdfFileName(d.fileName);
              return (
                <article
                  key={d.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-lg shadow-black/20"
                >
                  <button
                    type="button"
                    onClick={() => (canPreview ? setPreview(d) : undefined)}
                    className={`relative flex h-36 items-center justify-center bg-gradient-to-br from-white/[0.07] to-black/40 ${
                      canPreview ? "cursor-pointer transition hover:from-white/[0.11]" : "cursor-default"
                    }`}
                    aria-label={canPreview ? `Preview ${d.fileName}` : undefined}
                    disabled={!canPreview}
                  >
                    {isImageFileName(d.fileName) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.previewUrl}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-[#FFC300]/90">
                        <FileTypeIcon className="h-12 w-12" />
                        <span className="mt-1 rounded bg-black/50 px-1.5 text-[10px] font-semibold text-white/80">
                          {extensionBadge(d.fileName)}
                        </span>
                      </div>
                    )}
                    {canPreview ? (
                      <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white/90">
                        Preview
                      </span>
                    ) : null}
                  </button>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="line-clamp-2 text-sm font-medium text-white" title={d.fileName}>
                      {d.fileName}
                    </p>
                    <p className="text-[11px] text-white/50">{d.typeLabel}</p>
                    <p className="text-[11px] text-white/45">
                      {new Date(d.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="text-[11px] text-white/55">
                      <span className="text-white/35">Uploaded by</span>{" "}
                      {d.uploadedByName ?? "—"}
                      {d.uploadedByRoleLabel ? (
                        <>
                          {" "}
                          <span className="text-white/35">·</span> {d.uploadedByRoleLabel}
                        </>
                      ) : null}
                    </p>
                    {d.leadId && !embeddedLeadId ? (
                      <p className="text-[11px] text-white/45">
                        <span className="text-white/35">Lead</span>{" "}
                        {vaultContext === "iceconnect" ? (
                          <span>{leadNameById.get(d.leadId) ?? d.leadId.slice(0, 8)}</span>
                        ) : (
                          leadLink(d.leadId)
                        )}
                      </p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      {canPreview ? (
                        <button type="button" className={btnGhost} onClick={() => setPreview(d)}>
                          Open preview
                        </button>
                      ) : null}
                      <a href={d.downloadUrl} className={btnGhost} download={d.fileName}>
                        Download
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </DashboardSurface>

      {preview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Document preview"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0f141d] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <p className="min-w-0 truncate text-sm font-medium text-white" title={preview.fileName}>
                {preview.fileName}
              </p>
              <div className="flex shrink-0 gap-2">
                <a
                  href={preview.downloadUrl}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/90 hover:border-[#FFC300]/40"
                  download={preview.fileName}
                >
                  Download
                </a>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/90 hover:border-white/25"
                  onClick={() => setPreview(null)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-black/40 p-2">
              {isImageFileName(preview.fileName) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.previewUrl}
                  alt=""
                  className="mx-auto max-h-[min(75vh,1200px)] w-auto max-w-full object-contain"
                />
              ) : (
                <iframe
                  title={preview.fileName}
                  src={preview.previewUrl}
                  className="h-[min(75vh,900px)] w-full rounded-lg bg-white"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
