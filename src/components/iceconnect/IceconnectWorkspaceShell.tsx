"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  CompanyBrandingProvider,
  useCompanyBranding,
} from "@/contexts/company-branding-context";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  TELECALLER: "Telecaller",
  ENGINEER: "Engineer",
  INSTALLER: "Installer",
  ACCOUNTS: "Accounts",
  SERVICE: "Service",
};

export type IceconnectNavItem = { seg: string; label: string; href: string };

type ShellInnerProps = {
  employeeName: string;
  email: string;
  role: string;
  companyCount: number;
  nav: IceconnectNavItem[];
  children: ReactNode;
};

function SystemLoading({ companyName }: { companyName: string }) {
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
        {companyName} system loading…
      </p>
      <p className="mt-1 text-center text-xs text-gray-400">Securing your workspace</p>
    </div>
  );
}

function HeaderLogo({
  logoUrl,
}: {
  logoUrl: string | null | undefined;
}) {
  const [src, setSrc] = useState(logoUrl || "/logo.jpg");
  useEffect(() => {
    setSrc(logoUrl || "/logo.jpg");
  }, [logoUrl]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full object-contain p-0.5"
      onError={() => setSrc("/bgos-logo-placeholder.svg")}
    />
  );
}

function IceconnectWorkspaceChrome({
  employeeName,
  email,
  role,
  companyCount,
  nav,
  children,
}: ShellInnerProps) {
  const { company, ready, primaryColor, secondaryColor } = useCompanyBranding();
  const displayCompany = company?.name?.trim() || "Your company";
  const roleDisplay = ROLE_LABEL[role] ?? role;

  if (!ready) {
    return <SystemLoading companyName={displayCompany} />;
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
            </div>
          </div>
        </div>
      </header>

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

export function IceconnectWorkspaceShell(props: ShellInnerProps) {
  return (
    <CompanyBrandingProvider>
      <IceconnectWorkspaceChrome {...props} />
    </CompanyBrandingProvider>
  );
}
