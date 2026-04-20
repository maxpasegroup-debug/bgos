import { OwnershipClaimStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  leadId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const parsed = await parseJsonBodyZod(request, createSchema);
  if (!parsed.ok) return parsed.response;

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, companyId: session.companyId },
    select: { id: true, ownerUserId: true },
  });
  if (!lead) return NextResponse.json({ ok: false as const, error: "Lead not found" }, { status: 404 });
  if (lead.ownerUserId === session.sub) {
    return NextResponse.json({ ok: false as const, error: "You already own this lead" }, { status: 409 });
  }

  const existingPending = await prisma.ownershipClaim.findFirst({
    where: { companyId: session.companyId, leadId: lead.id, status: OwnershipClaimStatus.PENDING },
    select: { id: true },
  });
  if (existingPending) {
    return NextResponse.json({ ok: false as const, error: "Ownership request already pending" }, { status: 409 });
  }

  const claim = await prisma.ownershipClaim.create({
    data: {
      companyId: session.companyId,
      leadId: lead.id,
      requestedBy: session.sub,
      currentOwnerId: lead.ownerUserId,
      status: OwnershipClaimStatus.PENDING,
    },
    select: { id: true, status: true, createdAt: true },
  });

  return NextResponse.json({
    ok: true as const,
    claim: { id: claim.id, status: claim.status.toLowerCase(), created_at: claim.createdAt.toISOString() },
    notify: "RSM notified",
  });
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const scope = request.nextUrl.searchParams.get("scope") ?? "mine";
  const where =
    scope === "pending" && session.iceconnectEmployeeRole === "RSM"
      ? { companyId: session.companyId, status: OwnershipClaimStatus.PENDING }
      : { companyId: session.companyId, requestedBy: session.sub };

  const rows = await prisma.ownershipClaim.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      lead: { select: { id: true, name: true, ownerRole: true } },
      requester: { select: { id: true, name: true, email: true } },
      currentOwner: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json({
    ok: true as const,
    claims: rows.map((r) => ({
      id: r.id,
      lead_id: r.leadId,
      lead_name: r.lead?.name ?? null,
      requested_by: r.requester,
      current_owner: r.currentOwner,
      status: r.status.toLowerCase(),
      created_at: r.createdAt.toISOString(),
    })),
  });
}
