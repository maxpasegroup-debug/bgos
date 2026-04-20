import { LeadOwnershipRole, OwnershipClaimStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (session.iceconnectEmployeeRole !== "RSM") {
    return NextResponse.json({ ok: false as const, error: "RSM only action" }, { status: 403 });
  }
  const parsed = await parseJsonBodyZod(request, patchSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await context.params;

  const claim = await prisma.ownershipClaim.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true, status: true, leadId: true, requestedBy: true },
  });
  if (!claim) return NextResponse.json({ ok: false as const, error: "Claim not found" }, { status: 404 });
  if (claim.status !== OwnershipClaimStatus.PENDING) {
    return NextResponse.json({ ok: false as const, error: "Claim already resolved" }, { status: 409 });
  }

  if (parsed.data.action === "reject") {
    await prisma.ownershipClaim.update({
      where: { id: claim.id },
      data: { status: OwnershipClaimStatus.REJECTED },
    });
    return NextResponse.json({ ok: true as const, status: "rejected" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.ownershipClaim.update({
      where: { id: claim.id },
      data: { status: OwnershipClaimStatus.APPROVED },
    });
    if (claim.leadId) {
      await tx.lead.update({
        where: { id: claim.leadId },
        data: {
          ownerUserId: claim.requestedBy,
          ownerRole: LeadOwnershipRole.BDE,
        },
      });
    }
  });

  return NextResponse.json({ ok: true as const, status: "approved" });
}
