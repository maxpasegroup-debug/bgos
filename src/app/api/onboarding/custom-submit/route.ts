import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveCompanyMembership } from "@/lib/auth";
import { estimateBuildDays, generateSdeBrief, type OnboardingSubmissionData } from "@/lib/onboarding-brief-generator";
import { prisma } from "@/lib/prisma";

const roleSchema = z.object({
  department: z.string().trim().min(1),
  roleName: z.string().trim().min(1),
  count: z.number().int().min(1),
  features: z.array(z.string().trim().min(1)).min(1),
});

const employeeSchema = z.object({
  roleName: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1),
});

const bodySchema = z.object({
  companyId: z.string().trim().min(1),
  businessDescription: z.string().trim().min(1),
  teamSize: z.number().int().min(1).max(500),
  departments: z.array(z.string().trim().min(1)).min(1),
  roles: z.array(roleSchema).min(1),
  employees: z.array(employeeSchema),
  bossDashboardFeatures: z.array(z.string().trim().min(1)).min(1),
});

function dashboardConfigRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

export async function POST(request: NextRequest) {
  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false as const, error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  if (session.companyId !== parsed.data.companyId) {
    return NextResponse.json({ success: false as const, error: "Company mismatch" }, { status: 403 });
  }

  const company = await prisma.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { id: true, name: true, industry: true, dashboardConfig: true },
  });
  if (!company) {
    return NextResponse.json({ success: false as const, error: "Company not found" }, { status: 404 });
  }

  const payload: OnboardingSubmissionData = parsed.data;
  const brief = generateSdeBrief(payload, { name: company.name, industry: String(company.industry) });
  const estimatedDays = estimateBuildDays(payload);

  const techRequest = await prisma.techRequest.create({
    data: {
      roleName: "ONBOARDING_BUILD",
      description: JSON.stringify({
        type: "CUSTOM_ONBOARDING",
        companyName: company.name,
        industry: company.industry,
        businessDescription: parsed.data.businessDescription,
        teamSize: parsed.data.teamSize,
        departments: parsed.data.departments,
        roles: parsed.data.roles,
        employees: parsed.data.employees,
        bossDashboardFeatures: parsed.data.bossDashboardFeatures,
        brief,
        submittedBy: session.email,
        submittedAt: new Date().toISOString(),
      }),
      companyId: parsed.data.companyId,
      status: "PENDING",
      priority: "HIGH",
      requestedBy: session.sub,
    },
    select: { id: true },
  });

  await prisma.onboardingConversation.upsert({
    where: { companyId: parsed.data.companyId },
    create: {
      companyId: parsed.data.companyId,
      bossUserId: session.sub,
      stage: 8,
      companyProfile: {
        businessDescription: parsed.data.businessDescription,
        teamSize: parsed.data.teamSize,
      },
      departments: parsed.data.departments,
      roles: parsed.data.roles,
      employees: parsed.data.employees,
      bossDashboardNeeds: parsed.data.bossDashboardFeatures,
      completed: true,
      submittedAt: new Date(),
      techRequestId: techRequest.id,
    },
    update: {
      stage: 8,
      companyProfile: {
        businessDescription: parsed.data.businessDescription,
        teamSize: parsed.data.teamSize,
      },
      departments: parsed.data.departments,
      roles: parsed.data.roles,
      employees: parsed.data.employees,
      bossDashboardNeeds: parsed.data.bossDashboardFeatures,
      completed: true,
      submittedAt: new Date(),
      techRequestId: techRequest.id,
    },
  });

  const existingConfig = dashboardConfigRecord(company.dashboardConfig);
  await prisma.company.update({
    where: { id: parsed.data.companyId },
    data: {
      dashboardConfig: {
        ...existingConfig,
        onboardingStatus: "under_review",
        estimatedDays,
        customSpec: parsed.data,
        customTechRequestId: techRequest.id,
      },
    },
  });

  const existingLead = await prisma.lead.findFirst({
    where: { companyId: parsed.data.companyId, assignedTo: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { assignedTo: true },
  });
  const assignedPartnerId = existingLead?.assignedTo ?? null;

  if (assignedPartnerId) {
    await prisma.internalInAppNotification.create({
      data: {
        companyId: parsed.data.companyId,
        userId: assignedPartnerId,
        title: "New Custom Setup Submitted",
        body: `${company.name} needs ${parsed.data.roles.length + 1} dashboards`,
        type: "TECH_REQUEST_DONE",
      },
    });
  }

  return NextResponse.json({
    success: true as const,
    techRequestId: techRequest.id,
    estimatedDays,
  });
}
