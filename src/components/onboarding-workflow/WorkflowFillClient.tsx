"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowTemplateSections } from "@/lib/onboarding-workflow-types";

type LoadJson = {
  ok?: boolean;
  sections?: WorkflowTemplateSections;
  data?: Record<string, string>;
  completionPercent?: number;
  status?: string;
  editable?: boolean;
  readOnly?: boolean;
  category?: string;
  planTier?: string;
  error?: string;
};

export function WorkflowFillClient() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : "";

  const [load, setLoad] = useState<LoadJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchForm = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch(`/api/onboarding/workflow/public/${encodeURIComponent(token)}`);
      const j = (await res.json()) as LoadJson;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load form");
        return;
      }
      setLoad(j);
      setData((j.data ?? {}) as Record<string, string>);
    } catch {
      setErr("Network error");
    }
  }, [token]);

  useEffect(() => {
    void fetchForm();
  }, [fetchForm]);

  const savePatch = useCallback(
    async (next: Record<string, string>) => {
      if (!token || !load?.editable) return;
      setSaving(true);
      try {
        await fetch(`/api/onboarding/workflow/public/${encodeURIComponent(token)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: next }),
        });
      } catch {
        /* ignore */
      } finally {
        setSaving(false);
      }
    },
    [token, load?.editable],
  );

  const scheduleSave = useMemo(() => {
    return (next: Record<string, string>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void savePatch(next), 2200);
    };
  }, [savePatch]);

  function updateField(key: string, value: string) {
    const next = { ...data, [key]: value };
    setData(next);
    if (load?.editable) scheduleSave(next);
  }

  async function submit() {
    setSubmitting(true);
    setErr(null);
    try {
      await savePatch(data);
      const res = await fetch(
        `/api/onboarding/workflow/public/${encodeURIComponent(token)}/submit`,
        { method: "POST" },
      );
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Submit failed");
        return;
      }
      await fetchForm();
    } catch {
      setErr("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (err && !load) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {err}
      </div>
    );
  }

  if (!load?.sections) {
    return <p className="text-center text-sm text-gray-500">Loading…</p>;
  }

  const pct = load.completionPercent ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
        <p className="mt-1 text-sm text-gray-500">
          {load.category} · {load.planTier} — all fields optional. Progress {pct}%
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {saving ? <p className="mt-1 text-xs text-gray-400">Saving draft…</p> : null}
      </header>

      {load.readOnly ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This form is read-only (submitted or locked). If tech requested more info, you can edit again when
          status shows &quot;Needs info&quot;.
        </p>
      ) : null}

      <div className="space-y-8">
        {load.sections.sections.map((sec) => (
          <section key={sec.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{sec.title}</h2>
            <div className="mt-4 space-y-4">
              {sec.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600">{f.label}</label>
                  <textarea
                    value={data[f.key] ?? ""}
                    disabled={!load.editable}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-50"
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={submitting || load.status === "DELIVERED"}
          onClick={() => void submit()}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit to tech team"}
        </button>
      </div>

      {err && load ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
