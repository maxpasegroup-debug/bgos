"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { WorkflowTemplateSections } from "@/lib/onboarding-workflow-types";

type DetailJson = {
  ok?: boolean;
  role?: string;
  submission?: {
    id: string;
    status: string;
    planTier: string;
    category: string;
    completionPercent: number;
    data: Record<string, string>;
    deliveryPdfPath: string | null;
    clientAccessToken: string;
    lead: { id: string; name: string } | null;
    customBuild?: { clientContactUnlocked: boolean } | null;
  };
  sections?: WorkflowTemplateSections;
  messages?: {
    id: string;
    message: string;
    fieldKey: string | null;
    createdAt: string;
    sender: { name: string; email: string } | null;
  }[];
  error?: string;
};

export function WorkflowManageClient() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : "";
  const [d, setD] = useState<DetailJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, string>>({});
  const [needMsg, setNeedMsg] = useState("");
  const [needField, setNeedField] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch(`/api/onboarding/workflow/submissions/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        router.replace(`/login?from=${encodeURIComponent(`/onboarding/manage/${id}`)}`);
        return;
      }
      const j = (await res.json()) as DetailJson;
      if (!res.ok || !j.ok) {
        setErr(j.error ?? "Could not load");
        return;
      }
      setD(j);
      setData((j.submission?.data ?? {}) as Record<string, string>);
    } catch {
      setErr("Network error");
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchData() {
    setBusy("save");
    try {
      const res = await fetch(`/api/onboarding/workflow/submissions/${encodeURIComponent(id)}/data`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErr(j.error ?? "Save failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function submitSales() {
    setBusy("submit");
    try {
      const res = await fetch(`/api/onboarding/workflow/submissions/${encodeURIComponent(id)}/submit`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErr(j.error ?? "Submit failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function techAction(
    body: Record<string, unknown>,
  ) {
    setBusy("tech");
    try {
      const res = await fetch(`/api/onboarding/workflow/submissions/${encodeURIComponent(id)}/tech`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErr(j.error ?? "Action failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function deliver() {
    setBusy("deliver");
    try {
      const res = await fetch(`/api/onboarding/workflow/submissions/${encodeURIComponent(id)}/deliver`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErr(j.error ?? "Deliver failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (err && !d) {
    return <p className="p-8 text-center text-red-600">{err}</p>;
  }
  if (!d?.submission || !d.sections) {
    return <p className="p-8 text-center text-gray-500">Loading…</p>;
  }

  const sub = d.submission;
  const role = d.role ?? "none";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/onboarding/fill/${sub.clientAccessToken}`;
  const isTech = role === "tech" || role === "manager";
  const isSales = role === "sales" || role === "manager";

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage onboarding</h1>
        <p className="mt-1 text-sm text-gray-500">
          Status: <strong>{sub.status}</strong> · {sub.completionPercent}% · {sub.planTier} {sub.category}
        </p>
        {sub.lead ? (
          <p className="mt-1 text-xs text-gray-500">
            Lead: {sub.lead.name} ({sub.lead.id})
          </p>
        ) : null}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
        <p className="font-semibold text-gray-800">Share link</p>
        <p className="mt-2 break-all text-gray-600">{shareUrl}</p>
        <button
          type="button"
          className="mt-2 text-xs font-medium text-indigo-600 underline"
          onClick={() => void navigator.clipboard.writeText(shareUrl)}
        >
          Copy link
        </button>
      </section>

      {isSales &&
      (sub.status === "DRAFT" || sub.status === "NEEDS_INFO") ? (
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">Edit responses</h2>
          {d.sections.sections.map((sec) => (
            <div key={sec.id} className="space-y-3">
              <p className="text-xs font-medium uppercase text-gray-500">{sec.title}</p>
              {sec.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-gray-600">{f.label}</label>
                  <textarea
                    value={data[f.key] ?? ""}
                    onChange={(e) => setData((s) => ({ ...s, [f.key]: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void patchData()}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white"
            >
              Save draft
            </button>
            {(sub.status === "DRAFT" || sub.status === "NEEDS_INFO") ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void submitSales()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
              >
                Submit to tech
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {isTech ? (
        <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
          <h2 className="text-sm font-semibold text-indigo-900">Tech actions</h2>
          {sub.customBuild && !sub.customBuild.clientContactUnlocked ? (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950">
              Custom build — final client payment not confirmed. Internal planning and clarifications only; no
              client contact. Sales unlocks delivery after the deal closes (
              <code className="text-[11px]">POST /api/onboarding/workflow/custom/unlock-client-contact</code>
              ).
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {sub.status === "SUBMITTED" ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void techAction({ action: "start" })}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Mark in progress
              </button>
            ) : null}
            {sub.status === "IN_REVIEW" || sub.status === "SUBMITTED" ? (
              <button
                type="button"
                disabled={
                  busy !== null ||
                  Boolean(sub.customBuild && !sub.customBuild.clientContactUnlocked)
                }
                title={
                  sub.customBuild && !sub.customBuild.clientContactUnlocked
                    ? "Blocked until sales confirms final payment"
                    : undefined
                }
                onClick={() => void techAction({ action: "mark_ready" })}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                Mark ready (generate delivery PDF)
              </button>
            ) : null}
          </div>
          <div className="mt-4 space-y-2 border-t border-indigo-100 pt-4">
            <label className="text-xs font-medium text-indigo-900">Ask for more info (optional field key)</label>
            <input
              value={needField}
              onChange={(e) => setNeedField(e.target.value)}
              placeholder="e.g. leadSources"
              className="w-full rounded border border-indigo-200 px-2 py-1 text-sm"
            />
            <textarea
              value={needMsg}
              onChange={(e) => setNeedMsg(e.target.value)}
              placeholder="Message to sales / client"
              rows={2}
              className="w-full rounded border border-indigo-200 px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={busy !== null || !needMsg.trim()}
              onClick={() =>
                void techAction({
                  action: "need_info",
                  message: needMsg.trim(),
                  fieldKey: needField.trim() || undefined,
                })
              }
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Send clarification
            </button>
          </div>
        </section>
      ) : null}

      {sub.deliveryPdfPath ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-800">Delivery document</p>
          <a
            href={sub.deliveryPdfPath}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-indigo-600 underline"
          >
            Open PDF
          </a>
          {isSales && sub.status === "READY" ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void deliver()}
              className="mt-3 block rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Deliver to client (marks lead client live)
            </button>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-800">Messages</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(d.messages ?? []).map((m) => (
            <li key={m.id} className="rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-xs text-gray-400">{m.createdAt.slice(0, 16)}</span>
              {m.fieldKey ? (
                <span className="ml-2 text-xs font-medium text-amber-700">Field: {m.fieldKey}</span>
              ) : null}
              <p className="mt-1 text-gray-800">{m.message}</p>
              {m.sender ? (
                <p className="text-xs text-gray-500">
                  — {m.sender.name} ({m.sender.email})
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-xs text-gray-400">
        <Link href="/iceconnect/tech/onboarding" className="underline">
          Tech queue (ICECONNECT)
        </Link>
      </p>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
    </div>
  );
}
