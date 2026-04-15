"use client";

import type { UserManualCategory } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type Cat = { id: UserManualCategory; label: string };

export function UserManualsAdminClient({ categories }: { categories: Cat[] }) {
  const [rows, setRows] = useState<
    { id: string; category: UserManualCategory; title: string; updatedAt: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<UserManualCategory | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch("/api/user-manuals");
      const j = (await res.json()) as {
        ok?: boolean;
        manuals?: { id: string; category: UserManualCategory; title: string; updatedAt: string }[];
        error?: string;
      };
      if (!res.ok) {
        setErr(
          typeof j.error === "string" && j.error.trim()
            ? `${j.error} (HTTP ${res.status})`
            : `Load failed (HTTP ${res.status})`,
        );
        setRows([]);
        return;
      }
      setRows(Array.isArray(j.manuals) ? j.manuals : []);
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Could not reach user manuals API"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function upload(category: UserManualCategory, file: File | null, title: string) {
    if (!file) return;
    setBusy(category);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("category", category);
      fd.set("title", title.trim() || file.name);
      const res = await apiFetch("/api/user-manuals", { method: "POST", body: fd });
      const j = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok) {
        setErr(j.error ?? j.message ?? "Upload failed");
        return;
      }
      await load();
    } catch (e) {
      console.error("API ERROR:", e);
      setErr(formatFetchFailure(e, "Could not upload manual"));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-white/50">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      {err ? <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-100">{err}</p> : null}
      {categories.map((c) => {
        const existing = rows.find((r) => r.category === c.id);
        return (
          <div key={c.id} className="border-b border-white/10 pb-6 last:border-0 last:pb-0">
            <p className="text-sm font-semibold text-white">{c.label}</p>
            {existing ? (
              <p className="mt-1 text-xs text-white/45">
                Current: {existing.title} · updated {new Date(existing.updatedAt).toLocaleString()}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-200/70">No manual yet — dashboard “View Guide” stays hidden.</p>
            )}
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const file = fd.get("file");
                const title = String(fd.get("title") ?? "");
                if (file instanceof File) void upload(c.id, file, title);
              }}
            >
              <label className="block min-w-[200px] flex-1 text-xs text-white/60">
                Title
                <input
                  name="title"
                  defaultValue={existing?.title ?? `${c.label} guide`}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block min-w-[200px] flex-1 text-xs text-white/60">
                PDF or image
                <input
                  name="file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  className="mt-1 w-full text-sm text-white/80 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={busy === c.id}
                className="rounded-xl bg-[#FFC300]/90 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                {busy === c.id ? "Uploading…" : existing ? "Replace" : "Upload"}
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
