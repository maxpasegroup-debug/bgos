import { CompanyIndustry, Prisma, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { forbidden, requireActiveCompanyMembership } from "@/lib/auth";
import { applyIndustryTemplate } from "@/lib/industry-templates";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  companyId: z.string().trim().min(1),
  category: z.string().trim().min(1),
  custom: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;
  if (session.role !== UserRole.ADMIN && session.role !== UserRole.MANAGER) return forbidden();
  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.companyId !== session.companyId) {
    return NextResponse.json({ success: false as const, message: "Company mismatch" }, { status: 403 });
  }

  try {
    const category = parsed.data.category.toUpperCase();
    if (category === CompanyIndustry.SOLAR) {
      await applyIndustryTemplate(parsed.data.companyId, "SOLAR");
    }
    if (category === "CUSTOM" && parsed.data.custom != null) {
      const company = await prisma.company.findUnique({
        where: { id: parsed.data.companyId },
        select: { dashboardConfig: true },
      });
      const prev =
        company?.dashboardConfig && typeof company.dashboardConfig === "object" && !Array.isArray(company.dashboardConfig)
          ? (company.dashboardConfig as Record<string, unknown>)
          : {};
      const merged: Prisma.InputJsonValue = {
        ...prev,
        nexaOnboardBoss: {
          customSpec: parsed.data.custom,
          updatedAt: new Date().toISOString(),
        },
        onboardingStatus: "under_review",
      };
      await prisma.company.update({
        where: { id: parsed.data.companyId },
        data: { dashboardConfig: merged },
      });
    }
    return NextResponse.json({
      success: true as const,
      data: {
        companyId: parsed.data.companyId,
        initialized: true,
        reused: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("POST /api/system/init failed", message, error);
    if (stack) console.error("POST /api/system/init stack", stack);
    return NextResponse.json(
      {
        success: false as const,
        message: message || "System initialization failed",
        error: message || "System initialization failed",
      },
      { status: 500 },
    );
  }
}
