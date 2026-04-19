import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logCaughtError } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewUserNexaPlan } from "@/lib/nexa-ceo/access";
import {
  NEXA_COLD_LEAD_STATUSES,
  NEXA_HOT_LEAD_STATUSES,
  NEXA_MEDIUM_LEAD_STATUSES,
} from "@/lib/nexa-ceo/lead-tiers";

type LeadSuggestion = {
  lead_id: string;
  name: string;
  status: string;
  suggestion: string;
};

function suggestForBucket(
  _status: string,
  bucket: "hot" | "medium" | "cold",
): string {
  if (bucket === "hot") return "Call now. Lock a next step before you end the call.";
  if (bucket === "medium") return "Follow up within two hours. Log the outcome in CRM.";
  return "Send a concise value note. Propose one specific time to talk.";
}

/**
 * Hot / medium / cold leads for the user with short Nexa suggestions.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithCompany(request);
    if (session instanceof NextResponse) return session;

    const companyId = session.companyId;
    const q = request.nextUrl.searchParams.get("user_id");
    const targetUserId = q && q.length > 0 ? q : session.sub;

    const allowed = await canViewUserNexaPlan(prisma, companyId, session.sub, targetUserId);
    if (!allowed) {
      return NextResponse.json(
        { ok: false as const, error: "Not allowed", code: "FORBIDDEN" as const },
        { status: 403 },
      );
    }

    const [hot, medium, cold] = await Promise.all([
      prisma.lead.findMany({
        where: {
          companyId,
          assignedTo: targetUserId,
          status: { in: NEXA_HOT_LEAD_STATUSES },
        },
        take: 25,
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, status: true },
      }),
      prisma.lead.findMany({
        where: {
          companyId,
          assignedTo: targetUserId,
          status: { in: NEXA_MEDIUM_LEAD_STATUSES },
        },
        take: 25,
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, status: true },
      }),
      prisma.lead.findMany({
        where: {
          companyId,
          assignedTo: targetUserId,
          status: { in: NEXA_COLD_LEAD_STATUSES },
        },
        take: 25,
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, status: true },
      }),
    ]);

    const mapRow = (rows: typeof hot, bucket: "hot" | "medium" | "cold"): LeadSuggestion[] =>
      rows.map((r) => ({
        lead_id: r.id,
        name: r.name,
        status: r.status,
        suggestion: suggestForBucket(r.status, bucket),
      }));

    return NextResponse.json({
      ok: true as const,
      user_id: targetUserId,
      hot_leads: mapRow(hot, "hot"),
      medium_leads: mapRow(medium, "medium"),
      cold_leads: mapRow(cold, "cold"),
    });
  } catch (e) {
    logCaughtError("nexa-lead-priority", e);
    return NextResponse.json(
      { ok: false as const, error: "Failed to load lead priority", code: "INTERNAL" as const },
      { status: 500 },
    );
  }
}
