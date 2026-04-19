"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SalesNetworkRole, TrainingMaterialType, TrainingRoleScope } from "@prisma/client";
import { apiFetch } from "@/lib/api-fetch";
import { useInternalSession } from "./InternalSessionContext";
import { glassPanel, glassPanelHover, ds } from "@/styles/design-system";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Material = {
  id: string;
  title: string;
  description: string | null;
  type: TrainingMaterialType;
  fileUrl: string;
  fileName: string | null;
  roleScope: TrainingRoleScope;
  uploadedBy: string;
  uploaderName: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fadeUp(i = 0) {
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: i * 0.05 },
  };
}

const TYPE_META: Record<TrainingMaterialType, { label: string; icon: string; color: string; bg: string; border: string }> = {
  PDF:    { label: "PDF",    icon: "📄", color: "text-red-400",   bg: "bg-red-500/10",    border: "border-red-500/20"    },
  VIDEO:  { label: "Video",  icon: "🎬", color: "text-violet-400",bg: "bg-violet-500/10", border: "border-violet-500/20" },
  SCRIPT: { label: "Script", icon: "📝", color: "text-cyan-400",  bg: "bg-cyan-500/10",   border: "border-cyan-500/20"   },
};

const SCOPE_META: Record<TrainingRoleScope, { label: string; color: string }> = {
  ALL: { label: "Everyone",  color: "text-emerald-400" },
  BDE: { label: "BDE",       color: "text-amber-400"   },
  BDM: { label: "BDM",       color: "text-[#4FD1FF]"   },
  RSM: { label: "RSM",       color: "text-violet-400"  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Upload form (RSM / BOSS only)
// ---------------------------------------------------------------------------

function UploadForm({ onUploaded }: { onUploaded: (m: Material) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TrainingMaterialType>(TrainingMaterialType.PDF);
  const [roleScope, setRoleScope] = useState<TrainingRoleScope>(TrainingRoleScope.ALL);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError("Title is required."); return; }
    if (type === TrainingMaterialType.VIDEO && !url.trim()) { setError("URL is required for video."); return; }
    if (type !== TrainingMaterialType.VIDEO && !file) { setError("Choose a file to upload."); return; }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("description", description.trim());
      form.append("type", type);
      form.append("role_scope", roleScope);
      if (type === TrainingMaterialType.VIDEO) {
        form.append("url", url.trim());
      } else if (file) {
        form.append("file", file);
      }

      const res = await apiFetch("/api/internal/training", { method: "POST", body: form });
      const data = await res.json() as { ok: boolean; material?: Material; error?: string };
      if (!data.ok) { setError(data.error ?? "Upload failed."); return; }
      onUploaded(data.material!);
      setTitle(""); setDescription(""); setUrl(""); setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError("Network error. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. BGOS Sales Script v3"
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#4FD1FF]/50 focus:outline-none focus:ring-0"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TrainingMaterialType)}
            className="w-full rounded-xl border border-white/10 bg-[#0e1117] px-3.5 py-2.5 text-sm text-white focus:border-[#4FD1FF]/50 focus:outline-none"
          >
            <option value="PDF">PDF Document</option>
            <option value="VIDEO">Video Link</option>
            <option value="SCRIPT">Sales Script</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Assign To</label>
          <select
            value={roleScope}
            onChange={(e) => setRoleScope(e.target.value as TrainingRoleScope)}
            className="w-full rounded-xl border border-white/10 bg-[#0e1117] px-3.5 py-2.5 text-sm text-white focus:border-[#4FD1FF]/50 focus:outline-none"
          >
            <option value="ALL">Everyone</option>
            <option value="BDE">BDE only</option>
            <option value="BDM">BDM only</option>
            <option value="RSM">RSM only</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#4FD1FF]/50 focus:outline-none"
          />
        </div>
      </div>

      {type === TrainingMaterialType.VIDEO ? (
        <div>
          <label className="block text-xs text-white/50 mb-1.5">Video URL *</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtu.be/..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:border-[#4FD1FF]/50 focus:outline-none"
          />
        </div>
      ) : (
        <div>
          <label className="block text-xs text-white/50 mb-1.5">File * (PDF, DOC, TXT · max 25 MB)</label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-white/70 focus:outline-none"
          />
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-xs text-red-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={uploading}
          className="rounded-xl bg-[#4FD1FF]/15 border border-[#4FD1FF]/25 px-5 py-2.5 text-sm font-semibold text-[#4FD1FF] hover:bg-[#4FD1FF]/25 disabled:opacity-40 transition-colors"
        >
          {uploading ? "Uploading…" : "Upload Material"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Material card
// ---------------------------------------------------------------------------

function MaterialCard({
  material,
  canDelete,
  onDelete,
}: {
  material: Material;
  canDelete: boolean;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const t = TYPE_META[material.type];
  const s = SCOPE_META[material.roleScope];

  async function handleDelete() {
    if (!confirm(`Delete "${material.title}"?`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/internal/training/${material.id}`, { method: "DELETE" });
      const data = await res.json() as { ok: boolean };
      if (data.ok) onDelete(material.id);
    } catch { /* silent */ }
    setDeleting(false);
  }

  const isVideo = material.type === TrainingMaterialType.VIDEO;

  return (
    <div className={`${glassPanel} ${glassPanelHover} flex flex-col gap-3 p-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.bg} border ${t.border} text-lg`}>
            {t.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white leading-tight">{material.title}</p>
            <p className="mt-0.5 text-[10px] text-white/30">{fmtDate(material.createdAt)} · {material.uploaderName ?? "Unknown"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border ${t.border} ${t.bg} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${t.color}`}>
            {t.label}
          </span>
          <span className={`text-[10px] font-medium ${s.color}`}>{s.label}</span>
        </div>
      </div>

      {/* Description */}
      {material.description && (
        <p className="text-xs leading-relaxed text-white/40">{material.description}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
        {isVideo ? (
          <a
            href={material.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[#4FD1FF] hover:underline"
          >
            Open Video →
          </a>
        ) : (
          <a
            href={`/api/internal/training/file?key=${encodeURIComponent(material.fileUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[#4FD1FF] hover:underline"
          >
            Download {material.fileName ?? "file"} →
          </a>
        )}
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-400/60 hover:text-red-400 disabled:opacity-30 transition-colors"
          >
            {deleting ? "…" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ canUpload }: { canUpload: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl">📚</span>
      <p className="mt-4 text-base font-semibold text-white/60">No materials yet</p>
      {canUpload ? (
        <p className="mt-1.5 text-sm text-white/30">Upload PDFs, scripts, or video links for your team.</p>
      ) : (
        <p className="mt-1.5 text-sm text-white/30">Your RSM hasn&apos;t uploaded materials yet.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Training Center
// ---------------------------------------------------------------------------

export function TrainingCenter() {
  const { salesNetworkRole } = useInternalSession();

  const canUpload =
    salesNetworkRole === SalesNetworkRole.RSM ||
    salesNetworkRole === SalesNetworkRole.BOSS;

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [filter, setFilter] = useState<TrainingMaterialType | "ALL">("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/internal/training");
      const data = await res.json() as { ok: boolean; items?: Material[] };
      if (data.ok) setMaterials(data.items ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleUploaded(m: Material) {
    setMaterials((prev) => [m, ...prev]);
    setShowUpload(false);
  }

  function handleDeleted(id: string) {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }

  const filtered = filter === "ALL"
    ? materials
    : materials.filter((m) => m.type === filter);

  return (
    <div
      className="min-h-full pb-20 pt-6"
      style={{ background: `linear-gradient(180deg, ${ds.colors.bgPrimary} 0%, ${ds.colors.bgSecondary} 60%)` }}
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 space-y-8">

        {/* Header */}
        <motion.div {...fadeUp(0)} className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4FD1FF]">Training Center</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Materials</h1>
            <p className="mt-1 text-sm text-white/40">
              {canUpload ? "Upload and manage training materials for your team." : "View materials shared with you."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/[0.07] disabled:opacity-40 transition-colors"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
            {canUpload && (
              <button
                onClick={() => setShowUpload((v) => !v)}
                className="rounded-xl bg-[#4FD1FF]/15 border border-[#4FD1FF]/25 px-4 py-2 text-xs font-semibold text-[#4FD1FF] hover:bg-[#4FD1FF]/25 transition-colors"
              >
                {showUpload ? "Cancel" : "+ Upload"}
              </button>
            )}
          </div>
        </motion.div>

        {/* Upload panel */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              key="upload-form"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`${glassPanel} p-6`}
            >
              <p className="mb-5 text-sm font-semibold text-white">Upload New Material</p>
              <UploadForm onUploaded={handleUploaded} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        <motion.div {...fadeUp(1)} className="flex items-center gap-2 flex-wrap">
          {(["ALL", "PDF", "VIDEO", "SCRIPT"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-xl border px-4 py-1.5 text-xs font-semibold transition-colors ${
                filter === t
                  ? "border-[#4FD1FF]/30 bg-[#4FD1FF]/15 text-[#4FD1FF]"
                  : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white/70"
              }`}
            >
              {t === "ALL" ? "All" : TYPE_META[t].label}
            </button>
          ))}
          <span className="ml-auto text-xs text-white/30">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</span>
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`${glassPanel} h-36 animate-pulse`} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div {...fadeUp(2)}>
            <EmptyState canUpload={canUpload} />
          </motion.div>
        ) : (
          <motion.div {...fadeUp(2)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((m, i) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                >
                  <MaterialCard
                    material={m}
                    canDelete={canUpload}
                    onDelete={handleDeleted}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
