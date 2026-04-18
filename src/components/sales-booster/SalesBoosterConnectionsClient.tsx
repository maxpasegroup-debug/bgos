"use client";

import type { ReactNode } from "react";
import { apiFetch } from "@/lib/api-fetch";
import { SalesBoosterConnectionState, SalesBoosterOmnichannel } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { SalesBoosterModuleChrome } from "@/components/sales-booster/SalesBoosterModuleChrome";
import { SB_CARD } from "@/components/sales-booster/salesBoosterUi";

type Conn = {
  id: string;
  channel: SalesBoosterOmnichannel;
  status: SalesBoosterConnectionState;
  hasCredentials: boolean;
};

const CHANNEL_META: Record<
  SalesBoosterOmnichannel,
  { title: string; accent: string; icon: ReactNode }
> = {
  [SalesBoosterOmnichannel.WHATSAPP]: {
    title: "WhatsApp",
    accent: "text-[#25D366]",
    icon: <span className="text-[#25D366]">●</span>,
  },
  [SalesBoosterOmnichannel.INSTAGRAM]: {
    title: "Instagram",
    accent: "bg-gradient-to-br from-[#f58529] to-[#8134af] bg-clip-text text-transparent",
    icon: <span className="bg-gradient-to-br from-[#f58529] to-[#8134af] bg-clip-text text-transparent">●</span>,
  },
  [SalesBoosterOmnichannel.FACEBOOK]: {
    title: "Facebook",
    accent: "text-[#1877F2]",
    icon: <span className="text-[#1877F2]">●</span>,
  },
  [SalesBoosterOmnichannel.EMAIL]: {
    title: "Email",
    accent: "text-slate-200",
    icon: <span className="text-slate-200">●</span>,
  },
  [SalesBoosterOmnichannel.SMS]: {
    title: "SMS",
    accent: "text-cyan-300",
    icon: <span className="text-cyan-300">●</span>,
  },
};

export function SalesBoosterConnectionsClient() {
  const [list, setList] = useState<Conn[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [modal, setModal] = useState<SalesBoosterOmnichannel | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-booster/omni/connections", { credentials: "include" });
      const j = (await res.json()) as { data?: { connections?: Conn[] }; connections?: Conn[] };
      if (!res.ok) {
        setErr("Could not load connections.");
        return;
      }
      setList(j.data?.connections ?? j.connections ?? []);
    } catch {
      setErr("Could not load connections.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openModal = (c: SalesBoosterOmnichannel) => {
    setModal(c);
    setApiKey("");
  };

  const save = async () => {
    if (!modal) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-booster/omni/connections", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: modal,
          status: SalesBoosterConnectionState.CONNECTED,
          credentials: { apiKey: apiKey.trim() || "stored" },
        }),
      });
      if (!res.ok) {
        setErr("Could not save connection.");
        setSaving(false);
        return;
      }
      setModal(null);
      await load();
    } catch {
      setErr("Could not save connection.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SalesBoosterModuleChrome title="Connections" subtitle="Link channels with an API key — OAuth coming soon.">
      {err ? <p className="mb-4 text-sm text-red-300">{err}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((c) => {
          const meta = CHANNEL_META[c.channel];
          const connected = c.status === SalesBoosterConnectionState.CONNECTED;
          return (
            <div
              key={c.id}
              className={`${SB_CARD} flex flex-col justify-between hover:scale-[1.01]`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {meta.icon}
                  <h2 className={`text-lg font-semibold ${meta.accent}`}>{meta.title}</h2>
                </div>
                <p className="mt-2 text-sm text-white/50">
                  Status:{" "}
                  <span className={connected ? "text-emerald-400" : "text-amber-200"}>
                    {connected ? "Connected" : "Not connected"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => openModal(c.channel)}
                className="mt-4 rounded-xl border border-white/15 bg-white/[0.06] py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Connect
              </button>
            </div>
          );
        })}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">Connect {CHANNEL_META[modal].title}</h3>
            <p className="mt-1 text-sm text-white/50">Paste your API key or token. Stored encrypted at rest (server).</p>
            <label className="mt-4 block text-xs text-white/45">
              API key
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                placeholder="••••••••"
              />
            </label>
            <p className="mt-2 text-[10px] text-white/35">OAuth-based sign-in will appear here in a future update.</p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setModal(null)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SalesBoosterModuleChrome>
  );
}
