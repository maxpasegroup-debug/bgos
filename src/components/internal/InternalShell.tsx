"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SalesNetworkRole } from "@prisma/client";
import { useInternalSession } from "./InternalSessionContext";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function IconGrid({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function IconSales({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}
function IconTeam({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconTech({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}
function IconWallet({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h.01M11 15h2m-8-5V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2v-4z" />
    </svg>
  );
}
function IconTrophy({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 21h8m-4-4v4M7 3H4a1 1 0 00-1 1v2c0 2.209 1.791 4 4 4h.118M17 3h3a1 1 0 011 1v2c0 2.209-1.791 4-4 4h-.118M7 3h10v7.118A5 5 0 0112 15a5 5 0 01-5-4.882V3z" />
    </svg>
  );
}
function IconMega({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  );
}
function IconBook({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
function IconBuilding({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-5 w-5"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M9 16h1m5 0h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
    </svg>
  );
}
function IconChevron({ c }: { c?: string }) {
  return (
    <svg className={c ?? "h-4 w-4"} fill="none" viewBox="0 0 24 24">
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Nav item type + role-gated nav definitions
// ---------------------------------------------------------------------------

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: SalesNetworkRole[] | "all";
};

const ALL_ROLES: SalesNetworkRole[] = [
  SalesNetworkRole.BOSS,
  SalesNetworkRole.RSM,
  SalesNetworkRole.BDM,
  SalesNetworkRole.BDE,
  SalesNetworkRole.TECH_EXEC,
];

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/internal/sales",
    icon: <IconGrid />,
    roles: [SalesNetworkRole.BOSS, SalesNetworkRole.RSM, SalesNetworkRole.BDM, SalesNetworkRole.BDE],
  },
  {
    id: "control",
    label: "Control",
    href: "/internal/control",
    icon: <IconGrid />,
    roles: [SalesNetworkRole.BOSS],
  },
  {
    id: "tech",
    label: "Tech",
    href: "/internal/tech",
    icon: <IconTech />,
    roles: [SalesNetworkRole.BOSS, SalesNetworkRole.TECH_EXEC],
  },
  {
    id: "sales",
    label: "Sales",
    href: "/internal/sales",
    icon: <IconSales />,
    roles: [SalesNetworkRole.RSM, SalesNetworkRole.BDM, SalesNetworkRole.BDE],
  },
  {
    id: "team",
    label: "Team",
    href: "/internal/team",
    icon: <IconTeam />,
    roles: "all",
  },
  {
    id: "wallet",
    label: "Wallet",
    href: "/internal/wallet",
    icon: <IconWallet />,
    roles: "all",
  },
  {
    id: "onboard",
    label: "Onboard Co.",
    href: "/internal/onboard-company",
    icon: <IconBuilding />,
    roles: [SalesNetworkRole.BOSS, SalesNetworkRole.RSM],
  },
  {
    id: "rewards",
    label: "Rewards",
    href: "/internal/rewards",
    icon: <IconTrophy />,
    roles: "all",
  },
  {
    id: "competitions",
    label: "Competitions",
    href: "/internal/competitions",
    icon: <IconTrophy />,
    roles: "all",
  },
  {
    id: "training",
    label: "Training",
    href: "/internal/training",
    icon: <IconBook />,
    roles: "all",
  },
  {
    id: "announcements",
    label: "Announcements",
    href: "/internal/announcements",
    icon: <IconMega />,
    roles: "all",
  },
];

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname() ?? "";
  const { salesNetworkRole, roleLabel } = useInternalSession();

  const visible = NAV_ITEMS.filter(
    (item) => item.roles === "all" || item.roles.includes(salesNetworkRole),
  );

  const roleBadgeColor: Record<SalesNetworkRole, string> = {
    BOSS: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    RSM: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    BDM: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    BDE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    TECH_EXEC: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed top-0 left-0 z-40 flex h-full w-[240px] flex-col border-r border-white/[0.07] bg-[#05070A]/95 backdrop-blur-xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-5">
          <span className="bg-gradient-to-r from-[#4FD1FF] to-[#7C5CFF] bg-clip-text text-sm font-bold tracking-[0.15em] text-transparent">
            BGOS
          </span>
          <span className="text-xs text-white/30">Internal</span>
        </div>

        {/* Role badge */}
        <div className="px-5 pt-4 pb-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${roleBadgeColor[salesNetworkRole]}`}
          >
            {roleLabel.replace("internal_", "")}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-0.5">
            {visible.map((item) => {
              const active =
                item.href === "/internal/sales"
                  ? pathname.startsWith("/internal/sales")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={[
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-white/[0.08] text-white shadow-[0_0_20px_-4px_rgba(79,209,255,0.2)]"
                        : "text-white/50 hover:bg-white/[0.04] hover:text-white/80",
                    ].join(" ")}
                  >
                    <span className={active ? "text-[#4FD1FF]" : "text-white/40 group-hover:text-white/60"}>
                      {item.icon}
                    </span>
                    {item.label}
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#4FD1FF]" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/[0.07] px-5 py-4">
          <Link
            href="/api/auth/logout"
            className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </Link>
        </div>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shell (exported)
// ---------------------------------------------------------------------------

export function InternalShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { email, roleLabel } = useInternalSession();

  return (
    <div className="flex min-h-screen bg-[#05070A] text-white antialiased">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-[240px]">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-4 border-b border-white/[0.07] bg-[#05070A]/90 px-4 backdrop-blur-xl sm:px-6">
          <button
            aria-label="Open menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <IconGrid />
          </button>
          <div className="flex-1" />
          <span className="hidden text-xs text-white/30 sm:block">{email}</span>
          <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white/50">
            {roleLabel.replace("internal_", "")}
          </span>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
