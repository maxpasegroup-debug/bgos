import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createLeadSchema = z.object({
  companyName: z.string().trim().min(1),
  industry: z.string().trim().min(1),
  contactName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  source: z.string().trim().optional().or(z.literal("")),
});

type LeadFilterKey = "NEW" | "CONTACTED" | "QUALIFIED" | "ONBOARDING" | "DELIVERED" | "LOST";
const NEXT_ACTION_PREFIX = "[NEXT_ACTION]";

function parseLeadNotes(raw: string | null): { nextAction: string; notes: string | null } {
  if (!raw) return { nextAction: "", notes: null };
  const lines = raw.split("\n");
  const nextActionLine = lines.find((line) => line.startsWith(NEXT_ACTION_PREFIX));
  const nextAction = nextActionLine ? nextActionLine.replace(NEXT_ACTION_PREFIX, "").trim() : "";
  const noteLines = lines.filter((line) => !line.startsWith(NEXT_ACTION_PREFIX));
  const notes = noteLines.join("\n").trim() || null;
  return { nextAction, notes };
}

function toFilterKey(status: LeadStatus, stage: string | null): LeadFilterKey {
  if (status === LeadStatus.LOST) return "LOST";
  if (status === LeadStatus.WON || stage === "DELIVERED" || stage === "CLIENT_LIVE") return "DELIVERED";
  if (stage === "ONBOARDING_FORM_FILLED" || stage === "BOSS_APPROVAL_PENDING" || stage === "SENT_TO_TECH") {
    return "ONBOARDING";
  }
  if (status === LeadStatus.QUALIFIED) return "QUALIFIED";
  if (status === LeadStatus.CONTACTED) return "CONTACTED";
  return "NEW";
}

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.companyId) {
    return NextResponse.json({ error: "No active company in session." }, { status: 400 });
  }

  const leads = await prisma.lead.findMany({
    where: {
      OR: [{ assignedTo: user.sub }, { companyId: user.companyId }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      leadCompanyName: true,
      businessType: true,
      source: true,
      internalSalesNotes: true,
      internalSalesStage: true,
      lastActivityAt: true,
      nextActionDue: true,
    },
  });

  return NextResponse.json({
    leads: leads.map((lead) => {
      const parsedNotes = parseLeadNotes(lead.internalSalesNotes);
      return {
      id: lead.id,
      companyName: lead.leadCompanyName || lead.name,
      contactName: lead.name,
      phone: lead.phone,
      email: lead.email,
      industry: lead.businessType,
      status: lead.status,
      statusKey: toFilterKey(lead.status, lead.internalSalesStage),
      assignedDate: lead.createdAt.toISOString(),
      lastActivityDate: (lead.lastActivityAt ?? lead.updatedAt).toISOString(),
      nextAction: parsedNotes.nextAction,
      notes: parsedNotes.notes,
      source: lead.source,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.companyId) {
    return NextResponse.json({ error: "No active company in session." }, { status: 400 });
  }

  const raw = await request.json();
  const parsed = createLeadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const lead = await prisma.lead.create({
    data: {
      name: payload.contactName,
      phone: payload.phone,
      email: payload.email || null,
      source: payload.source || null,
      companyId: user.companyId,
      assignedTo: user.sub,
      createdByUserId: user.sub,
      leadCompanyName: payload.companyName,
      businessType: payload.industry,
      internalSalesNotes: payload.notes || null,
      status: LeadStatus.NEW,
    },
  });

  return NextResponse.json({ lead });
}
