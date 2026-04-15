import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

const bodySchema = z.object({
  roleName: z.string().trim().min(1),
  companyId: z.string().trim().min(1),
  requestedBy: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthWithRoles(request, ALLOWED);
    if (session instanceof NextResponse) return session;

    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    const row = await prisma.techRequest.create({
      data: {
        roleName: parsed.data.roleName,
        companyId: parsed.data.companyId,
        requestedBy: parsed.data.requestedBy,
        priority: "HIGH",
        status: "pending",
      },
      select: { id: true, roleName: true, status: true, priority: true, createdAt: true },
    });
    return NextResponse.json({ ok: true as const, request: row });
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Something went wrong", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
