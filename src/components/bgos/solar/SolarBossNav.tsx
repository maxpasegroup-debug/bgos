"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/solar-boss", icon: "🏠" },
  { label: "Sales", href: "/bgos/sales", icon: "📊" },
  { label: "Operations", href: "/bgos/operations", icon: "⚙️" },
  { label: "Finance", href: "/bgos/money", icon: "💰" },
  { label: "HR", href: "/bgos/hr", icon: "👥" },
  { label: "Inventory", href: "/bgos/inventory", icon: "📦" },
  { label: "Service", href: "/bgos/customer", icon: "🔧" },
  { label: "Settings", href: "/bgos/settings", icon: "🛠️" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SolarBossNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <aside
        className="hidden md:fixed md:inset-y-0 md:left-0 md:block md:w-64"
        style={{
          borderRight: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(180deg, rgba(6,10,16,0.98), rgba(7,12,20,0.96))",
          backdropFilter: "blur(10px)",
          zIndex: 40,
        }}
      >
        <div className="px-4 py-5">
          <p className="text-sm font-bold tracking-wide text-cyan-200">SOLAR BOSS</p>
          <p className="mt-1 text-xs text-white/45">Module Navigation</p>
        </div>
        <nav className="grid gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition"
                style={{
                  color: active ? "#9CE7FF" : "rgba(255,255,255,0.78)",
                  background: active ? "rgba(79,209,255,0.14)" : "transparent",
                  border: active ? "1px solid rgba(79,209,255,0.35)" : "1px solid transparent",
                }}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="sticky top-0 z-40 border-b border-white/10 bg-[#060B12]/90 px-3 py-2 backdrop-blur md:hidden">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-cyan-200">Solar Boss</p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-white/20 bg-white/5 px-2 py-1 text-xs text-white/85"
          >
            {open ? "Close" : "Modules"}
          </button>
        </div>
        {open ? (
          <nav className="mt-2 grid gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm"
                  style={{
                    color: active ? "#9CE7FF" : "rgba(255,255,255,0.8)",
                    background: active ? "rgba(79,209,255,0.16)" : "rgba(255,255,255,0.03)",
                  }}
                >
                  <span aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </>
  );
}
