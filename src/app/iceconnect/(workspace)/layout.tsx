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

const SALES_HUB_ORDER = [
  "my-journey",
  "leads",
  "onboarding",
  "customers",
  "wallet",
  "notifications",
  "profile",
] as const;

const SALES_HUB_SIDEBAR_SEGMENTS = new Set<string>(SALES_HUB_ORDER);
const TECH_HUB_NAV = [
  { seg: "my-tasks", label: "My Tasks", href: "/iceconnect/tech#my-tasks" },
  { seg: "onboarding-queue", label: "Onboarding Queue", href: "/iceconnect/tech#onboarding-queue" },
  { seg: "config", label: "Config", href: "/iceconnect/tech#config" },
  { seg: "testing", label: "Testing", href: "/iceconnect/tech#testing" },
  { seg: "completed", label: "Completed", href: "/iceconnect/tech#completed" },
] as const;

const SALES_HUB_LABEL: Record<string, string> = {
  "my-journey": "My Journey",
  leads: "Leads",
  onboarding: "Onboarding",
  customers: "Customers",
  wallet: "Wallet",
  notifications: "Notifications",
  profile: "Profile",
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
  "internal-sales": "Internal Sales",
  "internal-tech": "Internal Tech",
  "internal-onboarding": "Internal Onboarding",
  "tech-onboarding": "Tech · Onboarding",
  "micro-franchise": "Micro Franchise",
  manager: "Manager",
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

  let salesHubNav: { seg: string; label: string; href: string }[] | null = null;
  let salesHubTitle: string | undefined;
  if (user.companyId) {
    const co = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { internalSalesOrg: true },
    });
    const hubRoles = new Set(["SALES_EXECUTIVE", "TELECALLER", "TECH_HEAD", "TECH_EXECUTIVE"]);
    if (co?.internalSalesOrg === true && hubRoles.has(user.role)) {
      if (user.role === "TECH_EXECUTIVE") {
        salesHubNav = [...TECH_HUB_NAV];
        salesHubTitle = "Tech";
      } else {
        salesHubNav = SALES_HUB_ORDER.filter((seg) =>
          canAccessIceconnectDashboard(seg, user.role),
        ).map((seg) => ({
          seg,
          label: SALES_HUB_LABEL[seg] ?? seg,
          href: `/iceconnect/${seg}`,
        }));
      }
    }
  }

  const nav = Object.keys(ICECONNECT_DASHBOARD_ROLES)
    .filter((seg) => !SALES_HUB_SIDEBAR_SEGMENTS.has(seg))
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
      salesHubNav={salesHubNav}
      salesHubTitle={salesHubTitle}
    >
      {children}
    </IceconnectWorkspaceShell>
  );
}
