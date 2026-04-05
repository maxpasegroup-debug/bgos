import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import {
  canAccessIceconnectDashboard,
  ICECONNECT_DASHBOARD_ROLES,
} from "@/lib/role-routing";

export const metadata: Metadata = {
  title: "ICECONNECT",
  description: "ICECONNECT — field and operations workspace.",
};

const SEGMENT_LABEL: Record<string, string> = {
  sales: "Sales",
  site: "Engineer",
  install: "Installer",
  accounts: "Accounts",
  service: "Service",
};

export default async function IceconnectWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUserFromHeaders();
  if (!user) {
    redirect("/iceconnect/login?from=/iceconnect");
  }

  const nav = Object.keys(ICECONNECT_DASHBOARD_ROLES).filter((seg) =>
    canAccessIceconnectDashboard(seg, user.role),
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-white antialiased">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-cyan-400/90">
              ICECONNECT
            </p>
            <p className="text-sm text-white/50">
              {user.email} · {user.role}
            </p>
          </div>
          {nav.length > 0 ? (
            <nav className="flex flex-wrap gap-2">
              {nav.map((seg) => (
                <Link
                  key={seg}
                  href={`/iceconnect/${seg}`}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-cyan-500/30 hover:text-white"
                >
                  {SEGMENT_LABEL[seg] ?? seg}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
