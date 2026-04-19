"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { apiFetch, readApiJson } from "@/lib/api-fetch";
import { internalShell, glassCard, subtleText, accent } from "@/components/internal/internalUi";

type InternalContext = {
  ok: true;
  display_role: string;
  user: { name: string | null; email: string };
  sales_network_role: string | null;
  is_super_boss: boolean;
};

const NAV = [
  { href: "/internal/control", label: "Control" },
  { href: "/internal/sales", label: "Sales" },
  { href: "/internal/team", label: "Team" },
  { href: "/internal/tech", label: "Tech" },
  { href: "/internal/competitions", label: "Competitions" },
  { href: "/internal/announcements", label: "Announcements" },
  { href: "/internal/onboard-company", label: "Onboard" },
] as const;

export function InternalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [ctx, setCtx] = useState<InternalContext | null>(null);
  const [nexaOpen, setNexaOpen] = useState(false);
  const [nexaPreview, setNexaPreview] = useState<string | null>(null);

  const loadCtx = useCallback(async () => {
    try {
      const res = await apiFetch("/api/internal/context", { credentials: "include" });
      const j = (await readApiJson(res, "internal-context")) as InternalContext & { ok?: boolean };
      if (res.ok && j.ok) setCtx(j);
    } catch {
      setCtx(null);
    }
  }, []);

  const loadNexaPreview = useCallback(async () => {
    try {
      const res = await apiFetch("/api/internal/nexa/daily-plan", { credentials: "include" });
      const j = (await readApiJson(res, "internal-nexa-prev")) as {
        ok?: boolean;
        nexa_messages?: { text?: string }[];
        tasks?: string[];
      };
      const msg = j.nexa_messages?.[0]?.text ?? j.tasks?.[0] ?? null;
      setNexaPreview(msg);
    } catch {
      setNexaPreview(null);
    }
  }, []);

  useEffect(() => {
    void loadCtx();
    void loadNexaPreview();
  }, [loadCtx, loadNexaPreview]);

  const displayName = ctx?.user?.name?.trim() || ctx?.user?.email?.split("@")[0] || "Member";
  const role = ctx?.is_super_boss ? "Super Boss" : ctx?.display_role?.replace(/_/g, " ") || "Internal";

  return (
    <div id="bgos_internal_dashboards_final_v1" className={internalShell}>
      <div className="flex min-h-screen">
        <aside className="fixed bottom-0 left-0 top-0 z-50 hidden w-60 flex-col border-r border-white/[0.07] bg-[#0b0f19]/95 px-3 py-6 backdrop-blur-xl md:flex">
          <div className="px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/90">BGOS</p>
            <p className="mt-1 text-lg font-semibold text-white">Internal</p>
            <p className={`${subtleText} mt-1 text-xs`}>Platform control</p>
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-[#4FD1FF]/15 to-[#7C5CFF]/10 text-white shadow-inner shadow-cyan-500/10"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col md:pl-60">
          <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070a12]/85 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
              <div>
                <p className={`${subtleText} text-xs`}>Signed in</p>
                <p className="text-sm font-semibold text-white">{displayName}</p>
                <p className={`${subtleText} text-xs`}>
                  Role: <span className={accent}>{role}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="hidden rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-100/90 sm:inline"
                  title="Notifications stream is wired to Nexa tasks"
                >
                  Nexa alerts
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNexaOpen((v) => !v);
                    if (!nexaPreview) void loadNexaPreview();
                  }}
                  className="relative rounded-xl border border-[#4FD1FF]/30 bg-[#4FD1FF]/10 px-4 py-2 text-xs font-semibold text-[#4FD1FF] transition hover:bg-[#4FD1FF]/20"
                >
                  Nexa
                </button>
              </div>
            </div>
            {nexaOpen ? (
              <div className="border-t border-white/[0.06] px-4 py-3 md:px-8">
                <div className={`${glassCard} p-4`}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Quick plan</p>
                  <p className="mt-2 text-sm text-white/85">{nexaPreview ?? "Loading Nexa…"}</p>
                  <Link
                    href="/internal/sales"
                    className={`${accent} mt-3 inline-block text-xs font-medium hover:underline`}
                    onClick={() => setNexaOpen(false)}
                  >
                    Open full dashboard
                  </Link>
                </div>
              </div>
            ) : null}
          </header>

          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-white/[0.08] bg-[#0b0f19]/95 px-2 py-2 backdrop-blur-xl md:hidden">
        {NAV.slice(0, 5).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 rounded-lg py-2 text-center text-[11px] font-medium ${
                active ? "text-[#4FD1FF]" : "text-white/55"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
