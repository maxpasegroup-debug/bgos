import { CompanyIndustry, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { applyIndustryTemplate } from "@/lib/industry-templates";

const bodySchema = z.object({
  companyId: z.string().trim().min(1),
  category: z.string().trim().min(1),
  custom: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithRoles(request, [UserRole.ADMIN, UserRole.MANAGER]);
  if (session instanceof NextResponse) return session;
  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const category = parsed.data.category.toUpperCase();
    if (category === CompanyIndustry.SOLAR) {
      await applyIndustryTemplate(parsed.data.companyId, "SOLAR");
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
    console.error("POST /api/system/init", error);
    return NextResponse.json(
      { success: false as const, message: "System initialization failed" },
      { status: 500 },
    );
  }
}
