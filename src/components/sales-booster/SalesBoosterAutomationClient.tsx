"use client";

import { apiFetch } from "@/lib/api-fetch";
import { useCallback, useEffect, useState } from "react";
import {
  IconGrip,
  IconPlus,
  IconToggleOff,
  IconToggleOn,
} from "@/components/sales-booster/SalesBoosterIcons";
import { SalesBoosterModuleChrome } from "@/components/sales-booster/SalesBoosterModuleChrome";

type FlowNode = {
  id: string;
  type: string;
  label?: string;
  body?: string;
  field?: string;
  action?: string;
};

type JsonFlow = {
  version?: number;
  nodes: FlowNode[];
  edges?: { from: string; to: string }[];
};

const BLOCK_TYPES = [
  { type: "message", label: "Message" },
  { type: "question", label: "Question" },
  { type: "condition", label: "Condition" },
  { type: "action", label: "Action" },
] as const;

const TEMPLATES = [
  { title: "Welcome", body: "Thanks for messaging us — a teammate will reply shortly." },
  { title: "Hours", body: "We’re available Mon–Sat, 9am–7pm." },
  { title: "Callback", body: "Share your number and preferred time — we’ll call you." },
];

export function SalesBoosterAutomationClient() {
  const [flow, setFlow] = useState<JsonFlow | null>(null);
  const [autoReply, setAutoReply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-booster/omni/automation", { credentials: "include" });
      const j = (await res.json()) as {
        data?: { jsonFlow?: JsonFlow; autoReplyEnabled?: boolean };
        jsonFlow?: JsonFlow;
        autoReplyEnabled?: boolean;
      };
      if (!res.ok) {
        setErr("Could not load automation.");
        return;
      }
      const jsonFlow = j.data?.jsonFlow ?? j.jsonFlow;
      const ar = j.data?.autoReplyEnabled ?? j.autoReplyEnabled;
      if (jsonFlow) setFlow(jsonFlow);
      if (typeof ar === "boolean") setAutoReply(ar);
    } catch {
      setErr("Could not load automation.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveFlow = async (next: JsonFlow) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-booster/omni/automation", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonFlow: next }),
      });
      if (!res.ok) {
        setErr("Could not save flow.");
        return;
      }
      setFlow(next);
    } catch {
      setErr("Could not save flow.");
    } finally {
      setBusy(false);
    }
  };

  const saveAutoReply = async (enabled: boolean) => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/sales-booster/omni/automation", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoReplyEnabled: enabled }),
      });
      if (!res.ok) {
        setErr("Could not update auto-reply.");
        return;
      }
      setAutoReply(enabled);
    } catch {
      setErr("Could not update auto-reply.");
    } finally {
      setBusy(false);
    }
  };

  const addBlock = (type: string) => {
    if (!flow) return;
    const id = `n-${Date.now()}`;
    const label =
      type === "message"
        ? "Message"
        : type === "question"
          ? "Question"
          : type === "condition"
            ? "Condition"
            : "Action";
    const node: FlowNode = { id, type, label };
    if (type === "message") node.body = "Hello!";
    if (type === "question") node.field = "name";
    if (type === "action") node.action = "notify_team";
    const nodes = [...flow.nodes, node];
    const lastEdge = flow.edges?.[flow.edges.length - 1];
    const edges = [...(flow.edges ?? [])];
    if (lastEdge) {
      edges.push({ from: lastEdge.to, to: id });
    } else if (flow.nodes.length > 0) {
      const lastNode = flow.nodes[flow.nodes.length - 1]!;
      edges.push({ from: lastNode.id, to: id });
    }
    void saveFlow({ ...flow, nodes, edges });
  };

  const moveNode = (index: number, dir: -1 | 1) => {
    if (!flow) return;
    const target = index + dir;
    if (target < 0 || target >= flow.nodes.length) return;
    const nodes = [...flow.nodes];
    const tmp = nodes[index]!;
    nodes[index] = nodes[target]!;
    nodes[target] = tmp;
    void saveFlow({ ...flow, nodes });
  };

  const nodes = flow?.nodes ?? [];

  return (
    <SalesBoosterModuleChrome
      title="Automation"
      subtitle="Simple flow — drag-free builder with clear blocks."
    >
      {err ? <p className="mb-4 text-sm text-red-300">{err}</p> : null}

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0f172a]/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Auto reply</p>
          <p className="text-xs text-white/45">When on, your flow can greet new chats (lightweight).</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveAutoReply(!autoReply)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          {autoReply ? <IconToggleOn className="h-6 w-12" /> : <IconToggleOff className="h-6 w-12" />}
          {autoReply ? "On" : "Off"}
        </button>
      </div>

      <div className="mb-6">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Default reply templates</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(t.body);
              }}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-white/80 transition hover:border-cyan-400/30"
            >
              <span className="font-medium text-cyan-200">{t.title}</span>
              <span className="mt-1 block line-clamp-2 text-white/45">{t.body}</span>
              <span className="mt-1 text-[10px] text-white/35">Click to copy</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Add block</p>
          <div className="space-y-2">
            {BLOCK_TYPES.map((b) => (
              <button
                key={b.type}
                type="button"
                disabled={busy || !flow}
                onClick={() => addBlock(b.type)}
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white/85 transition hover:border-cyan-400/25 disabled:opacity-40"
              >
                <IconPlus className="h-4 w-4 text-cyan-300" />
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">Flow</p>
          {nodes.length === 0 ? (
            <p className="text-sm text-white/45">Loading flow…</p>
          ) : (
            <ul className="space-y-2">
              {nodes.map((n, i) => (
                <li
                  key={n.id}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0f172a] px-3 py-2 text-sm"
                >
                  <IconGrip className="h-4 w-4 shrink-0 text-white/25" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-white">{n.label ?? n.type}</span>
                    <span className="ml-2 text-[10px] uppercase text-white/35">{n.type}</span>
                    {n.body ? <p className="truncate text-xs text-white/50">{n.body}</p> : null}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-[10px] text-white/45 hover:bg-white/10"
                      onClick={() => moveNode(i, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 text-[10px] text-white/45 hover:bg-white/10"
                      onClick={() => moveNode(i, 1)}
                    >
                      Down
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-white/35">
            Example: Start → Greeting → Ask Name → Save Lead → Notify Team. Reorder with Up/Down.
          </p>
        </div>
      </div>
    </SalesBoosterModuleChrome>
  );
}
