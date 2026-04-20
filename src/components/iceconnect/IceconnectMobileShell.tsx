"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type TabKey = "home" | "leads" | "action" | "wallet" | "profile";

const NAV: { key: TabKey; label: string; href: (base: string) => string; icon: string }[] = [
  { key: "home",    label: "Home",    href: (b) => b,                  icon: "⌂" },
  { key: "leads",   label: "Leads",   href: (b) => `${b}/leads`,       icon: "◎" },
  { key: "action",  label: "Action",  href: (b) => `${b}?action=1`,   icon: "+" },
  { key: "wallet",  label: "Wallet",  href: (b) => `${b}/wallet`,      icon: "◈" },
  { key: "profile", label: "Profile", href: (b) => `${b}/profile`,     icon: "○" },
];

export function IceconnectMobileShell({
  title,
  basePath,
  children,
}: {
  title: string;
  /** e.g. /iceconnect/bde */
  basePath: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const base = basePath.replace(/\/$/, "");

  function activeTab(): TabKey {
    if (pathname === base || pathname === `${base}/`) return "home";
    if (pathname.startsWith(`${base}/leads`)) return "leads";
    if (pathname.startsWith(`${base}/wallet`)) return "wallet";
    if (pathname.startsWith(`${base}/profile`)) return "profile";
    return "home";
  }

  const tab = activeTab();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05070A",
        color: "rgba(255,255,255,0.9)",
        fontFamily: "var(--font-inter, system-ui, sans-serif)",
        paddingBottom: 88,
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          padding: "14px 18px",
          background: "rgba(5,7,10,0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.25)",
            textTransform: "uppercase",
            margin: "0 0 4px",
          }}
        >
          ICECONNECT
        </p>
        <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, letterSpacing: "-0.3px" }}>
          {title}
        </h1>
      </header>

      <main style={{ padding: "16px 14px 24px" }}>{children}</main>

      <nav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          padding: "10px 10px calc(10px + env(safe-area-inset-bottom, 0px))",
          background: "rgba(8,10,14,0.94)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "flex-end",
        }}
      >
        {NAV.map((n) => {
          const href = n.href(base);
          const active = n.key === tab;
          const isAction = n.key === "action";
          if (isAction) {
            return (
              <Link
                key={n.key}
                href={href}
                style={{
                  marginTop: -28,
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #4FD1FF 0%, #7C5CFF 100%)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#05070A",
                  fontSize: 26,
                  fontWeight: 300,
                  textDecoration: "none",
                  boxShadow: "0 8px 28px -8px rgba(79,209,255,0.45)",
                }}
              >
                {n.icon}
              </Link>
            );
          }
          return (
            <Link
              key={n.key}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                textDecoration: "none",
                color: active ? "#4FD1FF" : "rgba(255,255,255,0.28)",
                fontSize: 10,
                fontWeight: 600,
                minWidth: 52,
              }}
            >
              <span style={{ fontSize: 16, opacity: active ? 1 : 0.65 }}>{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
