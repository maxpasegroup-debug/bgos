import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hostTenantFromHeader } from "@/lib/host-routing";
import { parseJsonBodyZod } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getOrCreateInternalSalesCompanyId } from "@/lib/internal-sales-org";

export const runtime = "nodejs";

const bodySchema = z.object({
  businessName: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(32),
  email: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().email().max(254).optional()),
  location: z.string().trim().max(200).optional(),
  country: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(120),
  category: z.enum(["SOLAR", "MULTI_BUSINESS", "CUSTOM"]),
  experience: z.string().trim().max(2000).optional(),
  ref: z.string().trim().min(1).max(64).optional(),
});

const ALLOWED_REF_ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MANAGER,
  UserRole.SALES_HEAD,
];

export async function POST(request: NextRequest) {
  if (hostTenantFromHeader(request.headers.get("host")) === "ice") {
    return NextResponse.json(
      { ok: false as const, error: "Apply only on bgos.online", code: "WRONG_HOST" as const },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const { name, phone, experience, country, state, category, businessName } = parsed.data;
  const location = `${state}, ${country}`;
  const email =
    typeof parsed.data.email === "string" && parsed.data.email.trim().length > 0
      ? parsed.data.email.trim().toLowerCase()
      : null;

  let referredById: string | null = null;
  const ref = parsed.data.ref?.trim();
  if (ref) {
    const internal = await getOrCreateInternalSalesCompanyId();
    if (!("error" in internal)) {
      const m = await prisma.userCompany.findFirst({
        where: {
          userId: ref,
          companyId: internal.companyId,
          jobRole: { in: ALLOWED_REF_ROLES },
        },
        select: { userId: true },
      });
      if (m) referredById = m.userId;
    }
  }

  try {
    const row = await prisma.microFranchiseApplication.create({
      data: {
        name,
        phone: phone.replace(/\s/g, ""),
        email,
        location: location?.trim() || null,
        experience: experience?.trim() || null,
        referredById,
        status: "APPLICATION",
        notes: [
          {
            type: "meta",
            at: new Date().toISOString(),
            businessName,
            country,
            state,
            category,
          },
        ],
      },
      select: { id: true },
    });
    return NextResponse.json({
      ok: true as const,
      applicationId: row.id,
      message: "Application received. Our team will review shortly.",
    });
  } catch (e) {
    console.error("POST /api/micro-franchise/apply", e);
    return NextResponse.json(
      { ok: false as const, error: "Could not save application", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
