import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod, prismaKnownErrorResponse } from "@/lib/api-response";
import { requireIceconnectRole } from "@/lib/iceconnect-route-guard";
import { prisma } from "@/lib/prisma";
import { assertIceconnectInternalSalesOrg } from "@/lib/require-iceconnect-internal-org";

const ROLES: UserRole[] = [
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.MANAGER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

const bodySchema = z.object({
  sessionId: z.string().trim().optional(),
  leadId: z.string().trim().min(1),
  source: z.enum(["SALES", "FRANCHISE", "DIRECT"]).optional(),
  currentStep: z.string().trim().optional(),
  partnerId: z.string().trim().optional(),
  companyName: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["draft", "in_progress", "ready", "launched"]).default("draft"),
});

export async function GET(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;
  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId")?.trim();
  if (!leadId) return NextResponse.json({ ok: false, error: "leadId is required" }, { status: 400 });

  try {
    const row = await prisma.onboardingSession.findFirst({
      where: { leadId, createdByUserId: session.sub } as any,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        source: true,
        currentStep: true,
        leadId: true,
        companyId: true,
        companyName: true,
        industry: true,
        status: true,
        data: true,
        createdAt: true,
      } as any,
    });
    return NextResponse.json({ ok: true as const, session: row ?? null });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return NextResponse.json({ ok: false, error: "Could not load session" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireIceconnectRole(request, ROLES);
  if (session instanceof NextResponse) return session;
  const gate = await assertIceconnectInternalSalesOrg(session.companyId);
  if (gate) return gate;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const input = parsed.data;
    const lead = await prisma.lead.findFirst({
      where: { id: input.leadId, companyId: session.companyId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const row = input.sessionId
      ? await prisma.onboardingSession.update({
          where: { id: input.sessionId },
          data: {
            leadId: input.leadId,
            source: input.source,
            currentStep: input.currentStep ?? null,
            partnerId: input.partnerId ?? null,
            companyName: input.companyName ?? null,
            industry: input.industry ?? null,
            data: input.data as object,
            status: input.status,
          } as any,
          select: { id: true },
        })
      : await prisma.onboardingSession.create({
          data: {
            leadId: input.leadId,
            source: input.source,
            currentStep: input.currentStep ?? null,
            partnerId: input.partnerId ?? null,
            companyName: input.companyName ?? null,
            industry: input.industry ?? null,
            rawTeamInput: null,
            parsedTeam: {} as object,
            unknownRoles: [] as object,
            data: input.data as object,
            status: input.status,
            createdByUserId: session.sub,
          } as any,
          select: { id: true },
        });

    return NextResponse.json({ ok: true as const, sessionId: row.id });
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return NextResponse.json({ ok: false, error: "Could not save session" }, { status: 500 });
  }
}
