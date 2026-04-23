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
  CHANNEL_PARTNER: "Micro Franchise Partner",
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
  email: _email,
  role,
  companyCount,
  salesHubNav,
  salesHubTitle,
  children,
}: Omit<ShellInnerProps, "nav"> & { salesHubNav: IceconnectNavItem[] }) {
  const pathname = usePathname();
  const { ready, company } = useCompanyBranding();
  const roleDisplay = ROLE_LABEL[role] ?? role;
  const [badgeCount, setBadgeCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch("/api/nexa/next-action", { credentials: "include" });
        if (!res.ok) {
          setBadgeCount(0);
          return;
        }
        const j = (await res.json()) as { ok?: boolean; badgeCount?: number };
        if (cancelled || j.ok !== true) return;
        setBadgeCount(typeof j.badgeCount === "number" ? Math.max(0, j.badgeCount) : 0);
      } catch {
        setBadgeCount(0);
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

  const displayCompany = company?.name?.trim() || "Your company";
  const nexaHint =
    badgeCount > 1 ? `${badgeCount} leads need attention` : badgeCount === 1 ? "1 onboarding pending" : "Workflow healthy";

  return (
    <div className="relative h-screen overflow-hidden bg-[linear-gradient(135deg,#020617_0%,#0f172a_45%,#111827_100%)] text-slate-100 antialiased">
      <div className="pointer-events-none absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-12 bottom-0 h-80 w-80 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative flex h-screen">
        <aside className="group/sidebar sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-white/10 bg-[#0b1220]/95 backdrop-blur-xl transition-all duration-300 ease-out hover:w-[220px]">
          <div className="border-b border-white/10 px-3 py-4">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300/90 opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
              {salesHubTitle ?? "Sales"}
            </p>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {salesHubNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.seg}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    active
                      ? "bg-sky-500/15 text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.25)]"
                      : "text-slate-300/80 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold">
                    {item.label.charAt(0)}
                  </span>
                  <span className="truncate opacity-0 transition-opacity duration-200 group-hover/sidebar:opacity-100">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#0b1220]/85 px-4 backdrop-blur-xl sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                {displayCompany} Sales • {roleDisplay}
              </p>
              <p className="truncate text-xs text-slate-400">{employeeName}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="group relative">
                <motion.div
                  className="h-9 w-9 rounded-full bg-[radial-gradient(circle_at_35%_30%,#dbeafe_0%,#60a5fa_45%,#7c3aed_100%)] shadow-[0_0_20px_rgba(99,102,241,0.45)]"
                  animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
                  transition={{ duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                />
                <div className="pointer-events-none absolute right-0 top-10 hidden min-w-52 rounded-lg border border-white/10 bg-[#0b1220] px-3 py-2 text-xs text-slate-200 shadow-xl group-hover:block">
                  Nexa is monitoring your workflow. {nexaHint}.
                </div>
              </div>
              {badgeCount > 0 ? (
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Nexa {badgeCount}
                </span>
              ) : null}
            </div>
          </header>
          <div className="flex h-0 min-h-0 flex-1 flex-col">
            {companyCount > 1 ? (
              <Link
                href="/iceconnect/select-company"
                className="self-end px-4 pt-2 text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Switch company
              </Link>
            ) : null}
            <motion.main
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-4"
            >
              <div className="h-full w-full">{children}</div>
            </motion.main>
          </div>
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
  const [nextActionCta, setNextActionCta] = useState<{ label: string; href: string } | null>(null);
  const [badgeCount, setBadgeCount] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [toastShownOnce, setToastShownOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiFetch("/api/nexa/next-action", { credentials: "include" });
        if (!res.ok) {
          setNextAction("Nexa is syncing. Review your assigned queue.");
          setNextActionCta({ label: "Open Leads", href: "/iceconnect/leads" });
          setBadgeCount(0);
          return;
        }
        const j = (await res.json()) as {
          ok?: boolean;
          nextAction?: string;
          badgeCount?: number;
          actions?: Array<{ ctaLabel?: string; ctaHref?: string }>;
        };
        if (cancelled || j.ok !== true) return;
        if (typeof j.nextAction === "string" && j.nextAction.trim()) setNextAction(j.nextAction.trim());
        const top = Array.isArray(j.actions) ? j.actions[0] : null;
        if (top?.ctaLabel && top?.ctaHref) {
          setNextActionCta({ label: top.ctaLabel, href: top.ctaHref });
        } else {
          setNextActionCta(null);
        }
        setBadgeCount(typeof j.badgeCount === "number" ? Math.max(0, j.badgeCount) : 0);
        if ((j.badgeCount ?? 0) > 0 && !toastShownOnce) {
          setShowToast(true);
          setToastShownOnce(true);
        }
      } catch {
        setNextAction("Nexa is syncing. Review your assigned queue.");
        setNextActionCta({ label: "Open Leads", href: "/iceconnect/leads" });
        setBadgeCount(0);
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
            <div>
              <p>NEXA alert: {nextAction}</p>
              {nextActionCta ? (
                <Link href={nextActionCta.href} className="mt-1 inline-block font-semibold underline">
                  {nextActionCta.label}
                </Link>
              ) : null}
            </div>
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
