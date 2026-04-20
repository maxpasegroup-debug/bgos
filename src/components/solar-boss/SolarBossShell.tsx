"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV: { href: string; label: string; short: string }[] = [
  { href: "/solar-boss", label: "Dashboard", short: "Home" },
  { href: "/solar-boss/sales", label: "Sales", short: "Sales" },
  { href: "/solar-boss/operations", label: "Operations", short: "Ops" },
  { href: "/solar-boss/services", label: "Services", short: "Svc" },
  { href: "/solar-boss/inventory", label: "Inventory", short: "Stock" },
  { href: "/solar-boss/accounts", label: "Accounts", short: "₹" },
  { href: "/solar-boss/expenses", label: "Expenses", short: "Exp" },
  { href: "/solar-boss/hr", label: "HR", short: "HR" },
];

export function SolarBossShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/solar-boss" ? pathname === "/solar-boss" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(165deg, #05070c 0%, #0a1018 45%, #06090e 100%)",
        color: "rgba(255,255,255,0.92)",
        fontFamily: "var(--font-inter, system-ui, sans-serif)",
      }}
    >
      {/* Desktop sidebar */}
      <aside
        style={{
          display: "none",
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: 232,
          padding: "24px 16px",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(8,11,18,0.85)",
          backdropFilter: "blur(16px)",
          zIndex: 40,
        }}
        className="solar-boss-sidebar"
      >
        <div style={{ marginBottom: 28, paddingLeft: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "-0.02em" }}>SOLAR</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.28)", marginLeft: 6 }}>BOSS</span>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: active(n.href) ? 700 : 500,
                color: active(n.href) ? "#4FD1FF" : "rgba(255,255,255,0.55)",
                background: active(n.href) ? "rgba(79,209,255,0.1)" : "transparent",
                border: active(n.href) ? "1px solid rgba(79,209,255,0.18)" : "1px solid transparent",
                textDecoration: "none",
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      <style>{`
        @media (min-width: 900px) {
          .solar-boss-sidebar { display: block !important; }
          .solar-boss-main { margin-left: 232px !important; padding-bottom: 32px !important; }
          .solar-boss-bottom { display: none !important; }
        }
      `}</style>

      <main
        className="solar-boss-main"
        style={{
          padding: "20px 18px 88px",
          maxWidth: 1100,
          margin: "0 auto",
          boxSizing: "border-box",
        }}
      >
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="solar-boss-bottom"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "8px 4px calc(8px + env(safe-area-inset-bottom))",
          background: "rgba(6,9,14,0.92)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            style={{
              flex: "1 1 0",
              textAlign: "center",
              fontSize: 10,
              fontWeight: active(n.href) ? 700 : 500,
              color: active(n.href) ? "#4FD1FF" : "rgba(255,255,255,0.4)",
              textDecoration: "none",
              padding: "6px 2px",
            }}
          >
            <span style={{ display: "block", fontSize: 11, marginBottom: 2 }}>{n.short}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
