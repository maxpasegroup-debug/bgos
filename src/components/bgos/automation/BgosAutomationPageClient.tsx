"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { BGOS_MAIN_PAD } from "@/components/bgos/layoutTokens";
import { apiFetch, formatFetchFailure } from "@/lib/api-fetch";

type StatusData = {
  plan: "BASIC" | "PRO" | "ENTERPRISE";
  automation: string;
  channels: string[];
  message: string;
};

export function BgosAutomationPageClient() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [followUpsPending, setFollowUpsPending] = useState<number>(0);
  const [activeAutomations, setActiveAutomations] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, settingsRes, tasksRes] = await Promise.all([
        apiFetch("/api/automation/status"),
        apiFetch("/api/automation/settings"),
        apiFetch("/api/tasks?status=PENDING&limit=1"),
      ]);
      if (!statusRes.ok) {
        setError(`Automation is available only on Pro and Enterprise. (HTTP ${statusRes.status})`);
        setStatus(null);
        return;
      }
      const s = (await statusRes.json()) as StatusData;
      setStatus(s);

      const cfg = (await settingsRes.json()) as { data?: { enabled?: boolean } };
      setEnabled(Boolean(cfg.data?.enabled ?? true));

      const t = (await tasksRes.json()) as { count?: number; meta?: { count?: number } };
      const pending = Number(t.count ?? t.meta?.count ?? 0);
      setFollowUpsPending(Number.isFinite(pending) ? pending : 0);
      setActiveAutomations(3);
    } catch (e) {
      console.error("API ERROR:", e);
      setError(formatFetchFailure(e, "Could not reach automation API"));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function toggle(next: boolean) {
    setEnabled(next);
    const res = await apiFetch("/api/automation/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    if (!res.ok) setEnabled(!next);
  }

  return (
    <div className={`${BGOS_MAIN_PAD} pb-12 pt-6`}>
      <div className="mx-auto w-full max-w-[1200px] space-y-8">
        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h1 className="text-xl font-semibold text-white">Automation</h1>
          <p className="mt-1 text-sm text-white/65">Nexa automations and follow-up workflows</p>
        </section>

        {loading ? <p className="text-sm text-white/60">Loading automation...</p> : null}
        {error ? <p className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-3 text-sm text-amber-100">{error}</p> : null}

        {!status ? null : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <Card title="Automation">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/80">{enabled ? "ON" : "OFF"}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => void toggle(!enabled)}
                    className={`relative h-8 w-14 rounded-full border ${enabled ? "border-emerald-500/45 bg-emerald-500/20" : "border-white/15 bg-white/[0.06]"}`}
                  >
                    <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${enabled ? "left-7" : "left-1"}`} />
                  </button>
                </div>
              </Card>
              <Card title="Active automations">
                <p className="text-2xl font-semibold text-[#FFC300]">{activeAutomations}</p>
              </Card>
              <Card title="Follow-ups pending">
                <p className="text-2xl font-semibold text-white">{followUpsPending}</p>
              </Card>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-wide text-white/55">Status</p>
              <p className="mt-2 text-sm text-white/85">{status.message}</p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <p className="text-xs uppercase tracking-wide text-white/55">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
