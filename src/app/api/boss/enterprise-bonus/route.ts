import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { processEnterpriseBonus } from "@/lib/bdm-commission-engine";
import { prisma } from "@/lib/prisma";

const payloadSchema = z.object({
  clientCompanyId: z.string().trim().min(1),
  bdmUserId: z.string().trim().min(1),
  amount: z.number().int().positive(),
  type: z.enum(["DIRECT", "RECURRING"]),
  notes: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (session.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;

  const [bdmMembership, company] = await Promise.all([
    prisma.userCompany.findFirst({
      where: {
        userId: payload.bdmUserId,
        companyId: session.companyId,
        jobRole: UserRole.BDM,
      },
      select: { userId: true },
    }),
    prisma.company.findUnique({
      where: { id: payload.clientCompanyId },
      select: { id: true, name: true },
    }),
  ]);

  if (!bdmMembership) {
    return NextResponse.json({ error: "BDM not found in your company." }, { status: 404 });
  }
  if (!company) {
    return NextResponse.json({ error: "Client company not found." }, { status: 404 });
  }

  await processEnterpriseBonus({
    clientCompanyId: payload.clientCompanyId,
    bdmUserId: payload.bdmUserId,
    amount: payload.amount,
    type: payload.type,
    notes: payload.notes,
    approvedBy: session.sub,
  });

  return NextResponse.json({
    ok: true,
    company: {
      id: company.id,
      name: company.name,
    },
  });
}
