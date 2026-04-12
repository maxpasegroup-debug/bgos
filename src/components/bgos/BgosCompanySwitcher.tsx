"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { prepareAddBusinessNavigation } from "@/lib/bgos-add-business-intent";
import { useBgosDashboardContext } from "./BgosDataProvider";

type CompanyRow = {
  companyId: string;
  name: string;
};

type MeJson = {
  ok?: boolean;
  authenticated?: boolean;
  user?: {
    companyId?: string | null;
    activeCompanyIdCookie?: string | null;
    workspaceReady?: boolean;
  };
};

export function BgosCompanySwitcher({ light = false }: { light?: boolean }) {
  const router = useRouter();
  const { refetch } = useBgosDashboardContext();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [listRes, meRes] = await Promise.all([
      fetch("/api/company/list", { credentials: "include" }),
      fetch("/api/auth/me", { credentials: "include" }),
    ]);

    if (!listRes.ok || !meRes.ok) {
      setLoading(false);
      return;
    }

    const listJson = (await listRes.json()) as {
      ok?: boolean;
      companies?: CompanyRow[];
    };
    const meJson = (await meRes.json()) as MeJson;

    if (listJson.ok && Array.isArray(listJson.companies)) {
      setCompanies(
        listJson.companies.map((c) => ({
          companyId: c.companyId,
          name: c.name,
        })),
      );
    }

    if (meJson.authenticated && meJson.user) {
      const u = meJson.user;
      const id =
        (typeof u.activeCompanyIdCookie === "string" && u.activeCompanyIdCookie) ||
        (typeof u.companyId === "string" && u.companyId) ||
        null;
      setActiveCompanyId(id);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeName =
    companies.find((c) => c.companyId === activeCompanyId)?.name ??
    (loading ? "…" : companies[0]?.name ?? "Business");

  const switchTo = async (companyId: string) => {
    if (companyId === activeCompanyId) {
      setOpen(false);
      return;
    }
    setSwitchingId(companyId);
    setActiveCompanyId(companyId);
    try {
      const res = await fetch("/api/company/switch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) {
        await load();
        return;
      }
      const j = (await res.json()) as { ok?: boolean; redirectPath?: string };
      setOpen(false);
      refetch();
      if (typeof j.redirectPath === "string" && j.redirectPath.startsWith("/")) {
        window.location.assign(j.redirectPath);
        return;
      }
      router.refresh();
    } finally {
      setSwitchingId(null);
    }
  };

  if (!loading && companies.length === 0) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative min-w-0 shrink">
      <button
        type="button"
        className={
          light
            ? "flex max-w-full min-w-0 items-center gap-1 rounded-md border border-slate-200 bg-white py-1 pl-2.5 pr-2 text-left text-xs font-medium text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:text-sm"
            : "flex max-w-full min-w-0 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] py-1 pl-2.5 pr-2 text-left text-xs font-medium text-white/90 transition hover:border-white/15 hover:bg-white/[0.07] sm:text-sm"
        }
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        disabled={loading || switchingId !== null}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 truncate">{activeName}</span>
        <span
          className={`shrink-0 transition ${open ? "rotate-180" : ""} ${light ? "text-slate-400" : "text-white/45"}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="listbox"
          className={
            light
              ? "absolute left-0 top-[calc(100%+4px)] z-50 min-w-[12rem] max-w-[min(20rem,calc(100vw-3rem))] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
              : "absolute left-0 top-[calc(100%+4px)] z-50 min-w-[12rem] max-w-[min(20rem,calc(100vw-3rem))] overflow-hidden rounded-lg border border-white/10 bg-[#121821]/98 py-1 shadow-xl backdrop-blur-md"
          }
        >
          <ul className="max-h-60 overflow-y-auto py-0.5">
            {companies.map((c) => {
              const selected = c.companyId === activeCompanyId;
              return (
                <li key={c.companyId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`flex w-full items-center px-3 py-2 text-left text-xs sm:text-sm ${
                      light
                        ? selected
                          ? "bg-indigo-50 text-indigo-900"
                          : "text-slate-700 hover:bg-slate-50"
                        : selected
                          ? "bg-white/[0.08] text-white"
                          : "text-white/85 hover:bg-white/[0.06]"
                    }`}
                    disabled={switchingId !== null}
                    onClick={() => void switchTo(c.companyId)}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                    {selected ? (
                      <span className="ml-2 shrink-0 text-[10px] font-medium text-cyan-400/90">
                        Active
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className={light ? "border-t border-slate-200" : "border-t border-white/10"}>
            <button
              type="button"
              className={
                light
                  ? "w-full px-3 py-2.5 text-left text-xs font-semibold text-indigo-600 hover:bg-slate-50 sm:text-sm"
                  : "w-full px-3 py-2.5 text-left text-xs font-semibold text-[#FFC300]/95 hover:bg-white/[0.05] sm:text-sm"
              }
              onClick={() => {
                setOpen(false);
                prepareAddBusinessNavigation();
                router.push("/onboarding");
              }}
            >
              Add New Business
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
