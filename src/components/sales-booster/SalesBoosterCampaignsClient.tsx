"use client";

import { apiFetch } from "@/lib/api-fetch";
import { SalesBoosterOmnichannel } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { SalesBoosterModuleChrome } from "@/components/sales-booster/SalesBoosterModuleChrome";

type Campaign = {
  id: string;
  name: string | null;
  channel: SalesBoosterOmnichannel;
  status: string;
  sentCount: number;
  deliveredCount: number;
  responseCount: number;
  createdAt: string;
};

const PREBUILT = [
  {
    key: "offer",
    title: "Offer template",
    body: "Hi {name}, here’s a limited offer we think you’ll love: …",
  },
  {
    key: "followup",
    title: "Follow-up template",
    body: "Just checking in — did you get a chance to review our last message?",
  },
  {
    key: "reminder",
    title: "Reminder template",
    body: "Friendly reminder: your appointment / offer expires soon.",
  },
];

function channelLabel(c: SalesBoosterOmnichannel): string {
  switch (c) {
    case SalesBoosterOmnichannel.WHATSAPP:
      return "WhatsApp";
    case SalesBoosterOmnichannel.EMAIL:
      return "Email";
    case SalesBoosterOmnichannel.SMS:
      return "SMS";
    default:
      return c;
  }
}

export function SalesBoosterCampaignsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<SalesBoosterOmnichannel>(SalesBoosterOmnichannel.WHATSAPP);
  const [contactsText, setContactsText] = useState("");
  const [manual, setManual] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-booster/omni/campaigns", { credentials: "include" });
      const j = (await res.json()) as { data?: { campaigns?: Campaign[] }; campaigns?: Campaign[] };
      if (!res.ok) {
        setErr("Could not load campaigns.");
        return;
      }
      setCampaigns(j.data?.campaigns ?? j.campaigns ?? []);
    } catch {
      setErr("Could not load campaigns.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const parsedContacts = contactsText
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const createCampaign = async () => {
    if (!name.trim()) {
      setErr("Name your campaign.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch("/api/sales-booster/omni/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), channel }),
      });
      if (!res.ok) {
        setErr("Could not create campaign.");
        setBusy(false);
        return;
      }
      setName("");
      setContactsText("");
      setManual("");
      await load();
    } catch {
      setErr("Could not create campaign.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SalesBoosterModuleChrome title="Campaigns" subtitle="Create drafts, pick a channel, track delivery.">
      {err ? <p className="mb-4 text-sm text-red-300">{err}</p> : null}

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#0f172a]/80 p-5">
          <h2 className="text-sm font-semibold text-white">Create campaign</h2>
          <label className="mt-4 block text-xs text-white/45">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <label className="mt-3 block text-xs text-white/45">
            Channel
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as SalesBoosterOmnichannel)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
            >
              <option value={SalesBoosterOmnichannel.WHATSAPP}>WhatsApp</option>
              <option value={SalesBoosterOmnichannel.EMAIL}>Email</option>
              <option value={SalesBoosterOmnichannel.SMS}>SMS</option>
            </select>
          </label>
          <label className="mt-3 block text-xs text-white/45">
            Upload contacts (paste CSV lines or numbers)
            <textarea
              value={contactsText}
              onChange={(e) => setContactsText(e.target.value)}
              rows={4}
              placeholder="+91..., email@..., one per line"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
            />
          </label>
          <p className="mt-1 text-[10px] text-white/35">{parsedContacts.length} contacts detected (local preview)</p>
          <label className="mt-3 block text-xs text-white/45">
            Manual add
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Single email or phone"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createCampaign()}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/15 disabled:opacity-50"
          >
            Save draft campaign
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f172a]/80 p-5">
          <h2 className="text-sm font-semibold text-white">Templates</h2>
          <ul className="mt-4 space-y-3">
            {PREBUILT.map((t) => (
              <li key={t.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-sm font-medium text-cyan-200">{t.title}</p>
                <p className="mt-1 text-xs text-white/55">{t.body}</p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(t.body)}
                  className="mt-2 text-[10px] font-medium text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
                >
                  Copy text
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0f172a]/80 p-5">
        <h2 className="text-sm font-semibold text-white">Campaign list</h2>
        {campaigns.length === 0 ? (
          <p className="mt-4 text-sm text-white/45">No campaigns yet — create a draft above.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">Channel</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Sent</th>
                  <th className="pb-2 pr-3">Delivered</th>
                  <th className="pb-2">Responses</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 text-white/80">
                    <td className="py-2 pr-3 font-medium text-white">{c.name ?? "—"}</td>
                    <td className="py-2 pr-3">{channelLabel(c.channel)}</td>
                    <td className="py-2 pr-3">{c.status}</td>
                    <td className="py-2 pr-3">{c.sentCount}</td>
                    <td className="py-2 pr-3">{c.deliveredCount}</td>
                    <td className="py-2">{c.responseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SalesBoosterModuleChrome>
  );
}
