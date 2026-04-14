"use client";


import { apiFetch } from "@/lib/api-fetch";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  CompanyBrandingProvider,
  useCompanyBranding,
} from "@/contexts/company-branding-context";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Boss",
  MANAGER: "Manager",
  SALES_HEAD: "Sales Head",
  SALES_EXECUTIVE: "Sales Executive",
  TELECALLER: "Telecaller",
  CHANNEL_PARTNER: "Channel Partner",
  OPERATIONS_HEAD: "Operations Head",
  SITE_ENGINEER: "Site Engineer",
  PRO: "PRO",
  INSTALLATION_TEAM: "Installation Team",
  SERVICE_TEAM: "Service Team",
  INVENTORY_MANAGER: "Inventory Manager",
  ACCOUNTANT: "Accountant",
  LCO: "Loan Compliance Officer",
  HR_MANAGER: "HR Manager",
  TECH_HEAD: "Tech Head",
  TECH_EXECUTIVE: "Tech Executive",
  MICRO_FRANCHISE: "Micro Franchise Partner",
};

export type IceconnectNavItem = { seg: string; label: string; href: string };

type ShellInnerProps = {
  employeeName: string;
  email: string;
  role: string;
  companyCount: number;
  /** Classic ICECONNECT top nav (other modules). */
  nav: IceconnectNavItem[];
  /** When set, replaces layout with internal sales hub sidebar + minimal header. */
  salesHubNav?: IceconnectNavItem[] | null;
  salesHubTitle?: string;
  children: ReactNode;
};

function SystemLoading({ subtle }: { subtle?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] bg-gradient-to-br from-white via-[#F8FAFC] to-[#EEF2F7] px-6">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200"
        style={
          {
            borderTopColor: "var(--ice-primary, #ef4444)",
          } as CSSProperties
        }
        aria-hidden
      />
      <p className="mt-5 text-center text-sm font-medium text-gray-600">
        {subtle ? "Loading workspace…" : "System loading…"}
      </p>
      {!subtle ? <p className="mt-1 text-center text-xs text-gray-400">Securing your workspace</p> : null}
    </div>
  );
}

function HeaderLogo({
  logoUrl,
}: {
  logoUrl: string | null | undefined;
}) {
  const [fallback, setFallback] = useState(false);
  const src = fallback ? "/bgos-logo-placeholder.svg" : (logoUrl || "/logo.jpg");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={logoUrl || "default-logo"}
      src={src}
      alt=""
      className="h-full w-full object-contain p-0.5"
      onError={() => setFallback(true)}
      onLoad={() => setFallback(false)}
    />
  );
}

function IceconnectSalesHubChrome({
  employeeName,
  email,
  role,
  companyCount,
  salesHubNav,
  salesHubTitle,
  children,
}: Omit<ShellInnerProps, "nav"> & { salesHubNav: IceconnectNavItem[] }) {
  const pathname = usePathname();
  const { ready } = useCompanyBranding();
  const roleDisplay = ROLE_LABEL[role] ?? role;
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch("/api/nexa/next-action", { credentials: "include" });
        if (!res.ok) return;
        const j = (await res.json()) as { ok?: boolean; badgeCount?: number };
        if (cancelled || j.ok !== true) return;
        setBadgeCount(typeof j.badgeCount === "number" ? Math.max(0, j.badgeCount) : 0);
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 25000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!ready) {
    return <SystemLoading subtle />;
  }

  return (
    <div className="relative min-h-screen bg-[#F6F7FB] text-gray-900 antialiased">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-gray-200/90 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">ICECONNECT</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{salesHubTitle ?? "Sales"}</p>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {salesHubNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.seg}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-[color-mix(in_srgb,var(--ice-primary,#4f46e5)_12%,transparent)] text-[color:var(--ice-primary,#4f46e5)]"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-end gap-3 border-b border-gray-200/90 bg-white/95 px-4 backdrop-blur-sm">
            {badgeCount > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Nexa {badgeCount}
              </span>
            ) : null}
            {companyCount > 1 ? (
              <Link
                href="/iceconnect/select-company"
                className="text-xs font-medium text-gray-600 hover:text-gray-900"
              >
                Switch company
              </Link>
            ) : null}
            <div className="text-right text-xs">
              <p className="font-medium text-gray-900">{employeeName}</p>
              <p className="text-gray-500">
                {roleDisplay} · <span className="tabular-nums text-gray-400">{email}</span>
              </p>
            </div>
          </header>

          <motion.main
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex-1 px-4 py-8 sm:px-8"
          >
            <div className="mx-auto max-w-3xl">{children}</div>
          </motion.main>
        </div>
      </div>
    </div>
  );
}

function IceconnectClassicChrome({
  employeeName,
  email,
  role,
  companyCount,
  nav,
  children,
}: Omit<ShellInnerProps, "salesHubNav">) {
  const { company, ready, primaryColor, secondaryColor } = useCompanyBranding();
  const displayCompany = company?.name?.trim() || "Your company";
  const roleDisplay = ROLE_LABEL[role] ?? role;
  const [nextAction, setNextAction] = useState("Review your assigned queue.");
  const [badgeCount, setBadgeCount] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastShownOnce, setToastShownOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch("/api/nexa/next-action", { credentials: "include" });
        if (!res.ok) return;
        const j = (await res.json()) as { ok?: boolean; nextAction?: string; badgeCount?: number };
        if (cancelled || j.ok !== true) return;
        if (typeof j.nextAction === "string" && j.nextAction.trim()) setNextAction(j.nextAction.trim());
        setBadgeCount(typeof j.badgeCount === "number" ? Math.max(0, j.badgeCount) : 0);
        if ((j.badgeCount ?? 0) > 0 && !toastShownOnce) {
          setShowToast(true);
          setToastShownOnce(true);
        }
      } catch {
        /* ignore */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 20000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [toastShownOnce]);

  if (!ready) {
    return <SystemLoading />;
  }

  return (
    <div className="relative min-h-screen bg-[#F8FAFC] bg-gradient-to-br from-white via-[#F8FAFC] to-[#EEF2F7] text-gray-900 antialiased">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 h-72 w-72 rounded-full bg-yellow-200/15 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-red-200/15 blur-3xl" />
      </div>

      <header className="relative z-20 border-b border-gray-200/90 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm">
              <HeaderLogo logoUrl={company?.logoUrl} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-gray-900">{displayCompany}</p>
                <span
                  className="hidden rounded-full px-2 py-0.5 text-[10px] font-medium text-white sm:inline"
                  style={{
                    background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
                  }}
                >
                  You are working for {displayCompany}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">ICECONNECT · Secure workspace</p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                Next Action: <span className="font-medium text-gray-700">{nextAction}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{employeeName}</p>
              <p className="text-xs text-gray-500">
                {roleDisplay} · <span className="tabular-nums text-gray-400">{email}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {companyCount > 1 ? (
                <Link
                  href="/iceconnect/select-company"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-gray-300 hover:shadow"
                >
                  Switch company
                </Link>
              ) : null}
              {nav.length > 0 ? (
                <nav className="flex flex-wrap justify-end gap-1.5">
                  {nav.map((item) => (
                    <Link
                      key={item.seg}
                      href={item.href}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-[color:var(--ice-primary)] hover:text-[color:var(--ice-primary)]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              ) : null}
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                Alerts {badgeCount}
              </span>
            </div>
          </div>
        </div>
      </header>
      {showToast ? (
        <div className="fixed right-4 top-4 z-50 max-w-xs rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow">
          <div className="flex items-start justify-between gap-3">
            <p>NEXA alert: {nextAction}</p>
            <button type="button" className="font-semibold" onClick={() => setShowToast(false)}>
              x
            </button>
          </div>
        </div>
      ) : null}

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto max-w-5xl px-6 py-8"
      >
        {children}
      </motion.main>

      <footer className="relative z-10 border-t border-gray-200/80 bg-white/60 py-4 text-center text-[11px] text-gray-400 backdrop-blur-sm">
        Powered by BGOS — Customized for {displayCompany}
      </footer>
    </div>
  );
}

function IceconnectWorkspaceChrome(props: ShellInnerProps) {
  const { salesHubNav, salesHubTitle, nav, ...rest } = props;
  if (salesHubNav && salesHubNav.length > 0) {
    return (
      <IceconnectSalesHubChrome {...rest} salesHubNav={salesHubNav} salesHubTitle={salesHubTitle} />
    );
  }
  return <IceconnectClassicChrome {...rest} nav={nav} />;
}

export function IceconnectWorkspaceShell(props: ShellInnerProps) {
  return (
    <CompanyBrandingProvider>
      <IceconnectWorkspaceChrome {...props} />
    </CompanyBrandingProvider>
  );
}
