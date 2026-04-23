import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateBuildDays } from "@/lib/onboarding-brief-generator";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export async function GET(request: NextRequest) {
  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;

  const [company, assignedLead, conversation, bossUser] = await Promise.all([
    prisma.company.findUnique({
      where: { id: session.companyId },
      select: {
        id: true,
        name: true,
        dashboardConfig: true,
      },
    }),
    prisma.lead.findFirst({
      where: {
        companyId: session.companyId,
        assignedTo: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: {
        assignee: {
          select: {
            name: true,
            email: true,
            mobile: true,
          },
        },
      },
    }),
    prisma.onboardingConversation.findUnique({
      where: { companyId: session.companyId },
      select: {
        companyProfile: true,
        roles: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: session.sub },
      select: { email: true },
    }),
  ]);

  if (!company) {
    return NextResponse.json({ success: false as const, error: "Company not found" }, { status: 404 });
  }

  const config = asRecord(company.dashboardConfig);
  const customSpec = asRecord(config.customSpec);
  const roleList = Array.isArray(customSpec.roles)
    ? customSpec.roles
    : Array.isArray(conversation?.roles)
      ? conversation.roles
      : [];
  const estimatedDays =
    typeof config.estimatedDays === "string" && config.estimatedDays.trim()
      ? config.estimatedDays
      : estimateBuildDays({
          roles: Array.isArray(roleList) ? (roleList as any[]) : [],
          employees: Array.isArray(customSpec.employees) ? (customSpec.employees as any[]) : [],
        });

  return NextResponse.json({
    success: true as const,
    companyName: company.name,
    onboardingStatus: typeof config.onboardingStatus === "string" ? config.onboardingStatus : "",
    estimatedDays,
    bossEmail: bossUser?.email ?? session.email,
    partner: assignedLead?.assignee
      ? {
          name: assignedLead.assignee.name,
          email: assignedLead.assignee.email,
          phone: assignedLead.assignee.mobile,
        }
      : null,
  });
}
