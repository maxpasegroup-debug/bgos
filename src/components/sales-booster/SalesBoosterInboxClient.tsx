"use client";

import { apiFetch } from "@/lib/api-fetch";
import { SalesBoosterOmnichannel } from "@prisma/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconPaperclip,
  IconSend,
  IconTag,
  IconUserPlus,
} from "@/components/sales-booster/SalesBoosterIcons";
import { SalesBoosterModuleChrome } from "@/components/sales-booster/SalesBoosterModuleChrome";

type Msg = {
  id: string;
  channel: SalesBoosterOmnichannel;
  sender: string;
  content: string;
  leadId: string | null;
  createdAt: string;
  readAt: string | null;
};

const FILTER_CHANNELS: SalesBoosterOmnichannel[] = [
  SalesBoosterOmnichannel.WHATSAPP,
  SalesBoosterOmnichannel.INSTAGRAM,
  SalesBoosterOmnichannel.FACEBOOK,
  SalesBoosterOmnichannel.EMAIL,
];

function threadKey(m: Msg): string {
  return `${m.channel}|${m.leadId ?? m.sender}`;
}

function channelLabel(c: SalesBoosterOmnichannel): string {
  switch (c) {
    case SalesBoosterOmnichannel.WHATSAPP:
      return "WhatsApp";
    case SalesBoosterOmnichannel.INSTAGRAM:
      return "Instagram";
    case SalesBoosterOmnichannel.FACEBOOK:
      return "Facebook";
    case SalesBoosterOmnichannel.EMAIL:
      return "Email";
    case SalesBoosterOmnichannel.SMS:
      return "SMS";
    default:
      return c;
  }
}

export function SalesBoosterInboxClient() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [filter, setFilter] = useState<SalesBoosterOmnichannel | "ALL">("ALL");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [tag, setTag] = useState("");
  const [assign, setAssign] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState("You");

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-booster/omni/messages", { credentials: "include" });
      const j = (await res.json()) as { data?: { messages?: Msg[] }; messages?: Msg[] };
      if (!res.ok) {
        setErr("Could not load inbox.");
        return;
      }
      const rows = j.data?.messages ?? j.messages ?? [];
      setMessages(rows);
    } catch {
      setErr("Could not load inbox.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiFetch("/api/auth/me", { credentials: "include" });
        const j = (await res.json()) as { user?: { name?: string } };
        const n = j.user?.name?.trim();
        if (n) setUserLabel(n.split(" ")[0] ?? "You");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "ALL") return messages;
    return messages.filter((m) => m.channel === filter);
  }, [messages, filter]);

  const threads = useMemo(() => {
    const map = new Map<string, Msg[]>();
    for (const m of filtered) {
      const k = threadKey(m);
      const arr = map.get(k) ?? [];
      arr.push(m);
      map.set(k, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    }
    const list = [...map.entries()].sort((a, b) => {
      const ta = a[1][a[1].length - 1]!;
      const tb = b[1][b[1].length - 1]!;
      return Date.parse(tb.createdAt) - Date.parse(ta.createdAt);
    });
    return list;
  }, [filtered]);

  const activeThread = useMemo(() => {
    if (!selectedKey) return null;
    const t = threads.find(([k]) => k === selectedKey);
    return t?.[1] ?? null;
  }, [threads, selectedKey]);

  const firstInThread = activeThread?.[0];

  useEffect(() => {
    const first = threads[0]?.[0] ?? null;
    setSelectedKey((prev) => {
      if (!prev) return first;
      if (threads.some(([k]) => k === prev)) return prev;
      return first;
    });
  }, [threads, filter]);

  const markThreadRead = useCallback(
    async (thread: Msg[] | null) => {
      if (!thread?.length) return;
      const unread = thread.filter((m) => !m.readAt).map((m) => m.id);
      if (unread.length === 0) return;
      await apiFetch("/api/sales-booster/omni/messages", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: unread }),
      });
      void load();
    },
    [load],
  );

  useEffect(() => {
    if (activeThread) void markThreadRead(activeThread);
  }, [selectedKey, activeThread, markThreadRead]);

  const sendReply = async () => {
    if (!firstInThread || !reply.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-booster/omni/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: firstInThread.channel,
          sender: userLabel,
          content: reply.trim(),
          leadId: firstInThread.leadId ?? undefined,
        }),
      });
      if (!res.ok) {
        setErr("Could not send reply.");
        setBusy(false);
        return;
      }
      setReply("");
      await load();
    } catch {
      setErr("Could not send reply.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SalesBoosterModuleChrome title="Unified Inbox" subtitle="Filter by channel, reply in one place.">
      <div className="grid min-h-[480px] gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
        <div className="flex flex-col rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur">
          <div className="border-b border-white/10 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">Filters</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilter("ALL")}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  filter === "ALL"
                    ? "bg-cyan-500/25 text-cyan-100"
                    : "bg-white/[0.06] text-white/55 hover:bg-white/10"
                }`}
              >
                All
              </button>
              {FILTER_CHANNELS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    filter === c
                      ? "bg-cyan-500/25 text-cyan-100"
                      : "bg-white/[0.06] text-white/55 hover:bg-white/10"
                  }`}
                >
                  {channelLabel(c)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {threads.length === 0 ? (
              <p className="p-3 text-sm text-white/45">No conversations yet.</p>
            ) : (
              <ul className="space-y-1">
                {threads.map(([key, msgs]) => {
                  const last = msgs[msgs.length - 1]!;
                  const active = key === selectedKey;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          active
                            ? "bg-cyan-500/15 text-white ring-1 ring-cyan-400/30"
                            : "text-white/75 hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{last.sender}</span>
                          <span className="text-[10px] text-white/40">{channelLabel(last.channel)}</span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-white/45">{last.content}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur">
          <div className="flex-1 overflow-y-auto p-4">
            {err ? <p className="mb-3 text-sm text-red-300">{err}</p> : null}
            {!activeThread ? (
              <p className="text-sm text-white/45">Select a conversation.</p>
            ) : (
              <div className="space-y-3">
                {activeThread.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm ${
                      m.sender === userLabel
                        ? "ml-auto border-cyan-500/25 bg-cyan-500/10 text-white"
                        : "border-white/10 bg-white/[0.04] text-white/90"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-white/45">
                      <span>{m.sender}</span>
                      <span>{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              <label className="flex flex-1 min-w-[140px] items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white/60">
                <IconTag className="h-3.5 w-3.5 shrink-0" />
                <input
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Tag lead"
                  className="w-full bg-transparent text-white outline-none placeholder:text-white/35"
                />
              </label>
              <label className="flex flex-1 min-w-[140px] items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white/60">
                <IconUserPlus className="h-3.5 w-3.5 shrink-0" />
                <input
                  value={assign}
                  onChange={(e) => setAssign(e.target.value)}
                  placeholder="Assign to"
                  className="w-full bg-transparent text-white outline-none placeholder:text-white/35"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled
                  title="Attachments — connect storage to enable"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/35"
                >
                  <IconPaperclip className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() => void sendReply()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 disabled:opacity-40"
                >
                  <IconSend className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SalesBoosterModuleChrome>
  );
}
