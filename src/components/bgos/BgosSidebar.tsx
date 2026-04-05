"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

const navItems = [
  { id: "home", label: "Home", href: "/bgos", icon: HomeIcon },
  { id: "sales", label: "Sales", href: "/bgos/sales", icon: SalesIcon },
  { id: "operations", label: "Operations", href: "/bgos/operations", icon: OpsIcon },
  { id: "team", label: "Team", href: "/bgos/team", icon: TeamIcon },
  { id: "revenue", label: "Revenue", href: "/bgos/revenue", icon: RevenueIcon },
  { id: "risks", label: "Risks", href: "/bgos/risks", icon: RisksIcon },
  { id: "nexa", label: "Nexa", href: "/bgos/nexa", icon: NexaIcon },
] as const;

export function BgosSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-40 flex w-16 flex-col border-r border-white/10 bg-black/30 py-4 backdrop-blur-md">
      <nav className="flex flex-1 flex-col items-center gap-1 px-1.5">
        {navItems.map((item) => {
          const active =
            item.href === "/bgos"
              ? pathname === "/bgos"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <SidebarLink
              key={item.id}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={active}
            />
          );
        })}
      </nav>
    </aside>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <div className="group relative flex w-full justify-center">
      <Link
        href={href}
        title={label}
        className="relative flex w-full justify-center py-0.5"
      >
        <motion.span
          className={`relative flex h-10 w-10 items-center justify-center rounded-lg border transition-colors duration-300 ${
            active
              ? "border-[#FFC300]/45 bg-white/[0.08] text-[#FFC300] shadow-[0_0_20px_rgba(255,195,0,0.25),0_0_32px_rgba(255,59,59,0.12)]"
              : "border-transparent text-white/50 hover:border-white/10 hover:text-white"
          }`}
          whileHover={{
            scale: 1.05,
            boxShadow: active
              ? "0 0 26px rgba(255, 195, 0, 0.32)"
              : "0 0 18px rgba(255, 59, 59, 0.22), 0 0 28px rgba(255, 195, 0, 0.12)",
          }}
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <Icon className="h-[1.15rem] w-[1.15rem]" />
        </motion.span>
      </Link>
      <span
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2.5 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-black/90 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100 sm:block"
        role="tooltip"
      >
        {label}
      </span>
    </div>
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
