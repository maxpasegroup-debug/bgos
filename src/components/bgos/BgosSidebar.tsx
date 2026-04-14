"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useBgosDashboardContext } from "./BgosDataProvider";
import { useBgosTheme } from "./BgosThemeContext";

type NavDef = {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  booster?: boolean;
};

const primaryNav: NavDef[] = [
  { id: "home", label: "Home", href: "/bgos/dashboard", icon: HomeIcon },
  { id: "sales", label: "Sales", href: "/bgos/sales", icon: SalesIcon },
  { id: "operations", label: "Operations", href: "/bgos/operations", icon: OpsIcon },
  { id: "team", label: "Team", href: "/bgos/hr", icon: TeamIcon },
  { id: "accounts", label: "Accounts", href: "/bgos/accounts", icon: RevenueIcon },
  { id: "inventory", label: "Inventory", href: "/bgos/inventory", icon: InventoryIcon },
  { id: "customer", label: "Customer", href: "/bgos/customer", icon: CustomerIcon },
  { id: "documents", label: "Documents", href: "/bgos/documents", icon: DocsIcon },
  { id: "sales-booster", label: "Sales Booster", href: "/sales-booster", icon: LightningIcon, booster: true },
  { id: "settings", label: "Settings", href: "/bgos/settings", icon: SettingsIcon },
];

const moreNav: NavDef[] = [
  { id: "billing", label: "Billing", href: "/bgos/billing", icon: BillingIcon },
  { id: "subscription", label: "Plans", href: "/bgos/subscription", icon: PricingIcon },
  { id: "automation", label: "Automation", href: "/bgos/automation", icon: NexaIcon },
  { id: "revenue", label: "Revenue", href: "/bgos/revenue", icon: RevenueIcon },
  { id: "risks", label: "Risks", href: "/bgos/risks", icon: RisksIcon },
  { id: "nexa", label: "Nexa", href: "/bgos/nexa", icon: NexaIcon },
];

export function BgosSidebar() {
  const pathname = usePathname() ?? "";
  const { hasProPlan, planLockedToBasic, bossBillingBypass, controlShell } =
    useBgosDashboardContext();
  const { theme } = useBgosTheme();
  const light = theme === "light";
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  function resolveHref(item: NavDef): string {
    if (
      item.id === "sales-booster" &&
      (bossBillingBypass || (!planLockedToBasic && hasProPlan))
    ) {
      return "/sales-booster/dashboard";
    }
    return item.href;
  }

  function isActive(item: NavDef): boolean {
    if (item.id === "sales-booster") {
      return pathname === "/sales-booster" || pathname.startsWith("/sales-booster/");
    }
    if (item.href.startsWith("/bgos/control#")) {
      return pathname === "/bgos/control";
    }
    if (item.href === "/bgos/dashboard")
      return pathname === "/bgos/dashboard" || pathname === "/bgos";
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const shell = light
    ? "border-slate-200/90 bg-white/90 shadow-[4px_0_24px_-8px_rgba(15,23,42,0.08)]"
    : "border-[var(--bgos-border)]/90 bg-[#121821]/90 shadow-[4px_0_40px_-12px_rgba(0,0,0,0.45)]";

  if (controlShell) {
    return (
      <aside
        className={`fixed bottom-0 left-0 top-0 z-40 flex w-16 flex-col border-r backdrop-blur-xl md:w-[240px] ${shell}`}
      >
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 py-3 md:px-2">
          {superBossControlNav.map((item) => (
            <SidebarLink
              key={item.id}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActive(item)}
              light={light}
            />
          ))}
        </nav>
        <div className="border-t border-inherit px-1.5 py-2 md:px-2" />
      </aside>
    );
  }

  return (
    <aside
      className={`fixed bottom-0 left-0 top-0 z-40 flex w-16 flex-col border-r backdrop-blur-xl md:w-[240px] ${shell}`}
    >
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 py-3 md:px-2">
        {primaryNav.map((item) => (
          <SidebarLink
            key={item.id}
            href={resolveHref(item)}
            label={item.label}
            icon={item.icon}
            active={isActive(item)}
            booster={item.booster === true}
            light={light}
          />
        ))}
      </nav>

      <div ref={moreRef} className="border-t border-inherit px-1.5 py-2 md:px-2">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={
            light
              ? "flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 md:justify-start"
              : "flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-medium text-white/55 transition hover:bg-white/[0.06] md:justify-start"
          }
          aria-expanded={moreOpen}
        >
          <MoreIcon className="h-[1.15rem] w-[1.15rem] shrink-0" />
          <span className="hidden md:inline">More</span>
        </button>
        {moreOpen ? (
          <div className="mt-1 space-y-0.5 pb-1">
            {(bossBillingBypass
              ? moreNav.filter((item) => item.id !== "billing" && item.id !== "subscription")
              : moreNav
            ).map((item) => (
              <SidebarLink
                key={item.id}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(item)}
                light={light}
                compact
              />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  booster,
  light,
  compact,
  onBeforeNavigate,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  booster?: boolean;
  light?: boolean;
  compact?: boolean;
  onBeforeNavigate?: () => void;
}) {
  const base =
    light
      ? "border-slate-200/80 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/80 hover:text-indigo-900"
      : "border-white/[0.07] bg-white/[0.03] text-white/55 hover:border-white/12 hover:bg-white/[0.06] hover:text-white";

  const activeCls = booster
    ? light
      ? "border-indigo-400/50 bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-indigo-900 shadow-[0_0_24px_-8px_rgba(99,102,241,0.35)]"
      : "border-indigo-400/35 bg-gradient-to-r from-indigo-500/20 to-violet-600/15 text-white shadow-[0_0_28px_-6px_rgba(99,102,241,0.45)]"
    : light
      ? "border-indigo-200 bg-indigo-50/90 text-indigo-950 shadow-sm"
      : "border-white/15 bg-white/[0.09] text-white shadow-[0_0_20px_-8px_rgba(99,102,241,0.2)]";

  return (
    <div className="group relative flex w-full justify-center md:block">
      <Link
        href={href}
        title={label}
        className="relative w-full"
        onClick={() => {
          onBeforeNavigate?.();
        }}
      >
        <motion.span
          className={`flex min-h-[2.5rem] w-full items-center justify-center gap-3 rounded-xl border px-2 py-2 transition-colors duration-200 md:justify-start md:px-3 ${
            active ? activeCls : base
          } ${compact ? "min-h-[2.25rem] py-1.5 text-[11px]" : ""}`}
          whileHover={{
            scale: 1.01,
            transition: { duration: 0.2 },
          }}
          whileTap={{ scale: 0.98 }}
        >
          <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" />
          <span className="hidden max-w-[11rem] truncate font-medium md:inline">{label}</span>
          {booster ? (
            <span className="hidden text-amber-400 md:inline" aria-hidden>
              ⚡
            </span>
          ) : null}
        </motion.span>
      </Link>
      <span
        className={`pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border px-2 py-1 text-[11px] font-medium opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100 md:hidden ${
          light
            ? "border-slate-200 bg-white text-slate-800"
            : "border-white/10 bg-black/90 text-white"
        }`}
        role="tooltip"
      >
        {label}
      </span>
    </div>
  );
}

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.85}
        d="M13 3L4 14h7l-1 7 9-11h-7l1-7z"
      />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function SalesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  );
}

function BillingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 12h6m-6 4h6M9 8h2m5-6H8a3 3 0 00-3 3v12a3 3 0 003 3h10a3 3 0 003-3V8M9 4h8v4H9V4z"
      />
    </svg>
  );
}

function PricingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function OpsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function DocsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M13 3v6h6"
      />
    </svg>
  );
}

function InventoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function CustomerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function RevenueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function RisksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function NexaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

const superBossControlNav: NavDef[] = [
  { id: "sb-clients", label: "Clients", href: "/bgos/control/clients", icon: BuildingIcon },
  { id: "sb-team", label: "My Team", href: "/bgos/control/team", icon: TeamIcon },
  { id: "sb-sales", label: "Sales", href: "/bgos/control/sales", icon: SalesIcon },
  { id: "sb-partners", label: "Channel Partners", href: "/bgos/control/sales/channel-partners", icon: CustomerIcon },
  { id: "sb-mf", label: "Micro Franchise", href: "/bgos/control/micro-franchise", icon: NexaIcon },
  { id: "sb-tech", label: "Technical Dept", href: "/bgos/control/technical", icon: OpsIcon },
  { id: "sb-accounts", label: "Accounts", href: "/bgos/control/accounts", icon: BillingIcon },
  { id: "sb-vision", label: "Vision & Targets", href: "/bgos/control/vision", icon: PricingIcon },
  { id: "sb-booster", label: "Sales Booster", href: "/bgos/control/sales-booster", icon: LightningIcon },
];
