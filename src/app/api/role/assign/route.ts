import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { forbidden, requireActiveCompanyMembership } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  companyId: z.string().trim().min(1),
  role: z.enum(["boss", "sales_manager", "sales_executive", "technical"]),
});

function mapRole(input: z.infer<typeof bodySchema>["role"]): UserRole {
  if (input === "boss") return UserRole.ADMIN;
  if (input === "sales_manager") return UserRole.MANAGER;
  if (input === "technical") return UserRole.TECH_EXECUTIVE;
  return UserRole.SALES_EXECUTIVE;
}

export async function POST(request: NextRequest) {
  /** Allow immediately after company mint while `workspaceReady` is still false. */
  const session = await requireActiveCompanyMembership(request);
  if (session instanceof NextResponse) return session;
  if (session.role !== UserRole.ADMIN && session.role !== UserRole.MANAGER) return forbidden();
  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const role = mapRole(parsed.data.role);
  const existing = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: session.sub, companyId: parsed.data.companyId } },
    select: { id: true, jobRole: true },
  });
  if (existing?.jobRole === role) {
    return NextResponse.json({ success: true as const, data: { already_assigned: true } });
  }
  if (existing) {
    await prisma.userCompany.update({
      where: { id: existing.id },
      data: { jobRole: role, role: role === UserRole.ADMIN ? "ADMIN" : "EMPLOYEE" },
    });
    return NextResponse.json({ success: true as const, data: { assigned: true } });
  }
  await prisma.userCompany.create({
    data: {
      userId: session.sub,
      companyId: parsed.data.companyId,
      jobRole: role,
      role: role === UserRole.ADMIN ? "ADMIN" : "EMPLOYEE",
      status: "READY",
    },
  });
  return NextResponse.json({ success: true as const, data: { assigned: true } });
}
