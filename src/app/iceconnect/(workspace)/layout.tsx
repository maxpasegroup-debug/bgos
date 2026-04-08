import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IceconnectWorkspaceShell } from "@/components/iceconnect/IceconnectWorkspaceShell";
import { getAuthUserFromCookies, getAuthUserFromHeaders, membershipCompanyIds } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  "sales-head": "Sales Head",
  partner: "Channel Partner",
  operations: "Operations Head",
  site: "Site Engineer",
  pro: "PRO",
  install: "Installation Team",
  service: "Service Team",
  inventory: "Inventory Manager",
  accounts: "Accountant",
  loan: "Loan Compliance Officer",
  hr: "HR Manager",
  documents: "Documents",
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

  const cookieUser = await getAuthUserFromCookies();
  const companyIds = cookieUser ? membershipCompanyIds(cookieUser) : [];
  const companyCount = companyIds.length;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { name: true },
  });
  const employeeName =
    dbUser?.name?.trim() || user.email.split("@")[0]?.trim() || user.email;

  const nav = Object.keys(ICECONNECT_DASHBOARD_ROLES)
    .filter((seg) => canAccessIceconnectDashboard(seg, user.role))
    .map((seg) => ({
      seg,
      label: SEGMENT_LABEL[seg] ?? seg,
      href: `/iceconnect/${seg}`,
    }));

  return (
    <IceconnectWorkspaceShell
      employeeName={employeeName}
      email={user.email}
      role={user.role}
      companyCount={companyCount}
      nav={nav}
    >
      {children}
    </IceconnectWorkspaceShell>
  );
}
