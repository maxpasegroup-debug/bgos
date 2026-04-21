import { LeadStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const employeeSchema = z.object({
  name: z.string().trim().optional().default(""),
  role: z.string().trim().optional().default(""),
  department: z.string().trim().optional().default(""),
  responsibilities: z.string().trim().optional().default(""),
  featuresNeeded: z.array(z.string()).optional().default([]),
});

const createTechRequestSchema = z.object({
  leadId: z.string().trim().min(1).optional(),
  companyName: z.string().trim().min(1),
  industry: z.string().trim().min(1),
  employeeCount: z.number().int().nonnegative(),
  employees: z.array(employeeSchema),
  priority: z.string().trim().min(1).default("Normal"),
  notes: z.string().trim().optional().default(""),
  estimatedDelivery: z.string().trim().optional().default(""),
  type: z.enum(["ONBOARDING", "SUPPORT", "ADDITION"]).optional().default("ONBOARDING"),
  companyProfile: z.unknown().optional(),
  bossDetails: z.unknown().optional(),
});

type StoredPayload = {
  leadId: string | null;
  companyName: string;
  industry: string;
  employeeCount: number;
  employees: Array<z.infer<typeof employeeSchema>>;
  priority: string;
  notes: string;
  estimatedDelivery: string;
  type: "ONBOARDING" | "SUPPORT" | "ADDITION";
  submittedByUserId: string;
  sdeNotes?: string;
  sdeAssigned?: string;
  companyProfile?: unknown;
  bossDetails?: unknown;
};

function normalizeStatus(status: string): "PENDING" | "IN_PROGRESS" | "REVIEW" | "DONE" {
  const s = status.trim().toUpperCase();
  if (s === "IN_PROGRESS" || s === "REVIEW" || s === "DONE") return s;
  return "PENDING";
}

export async function POST(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.companyId) return NextResponse.json({ error: "No active company in session." }, { status: 400 });

  const raw = await request.json();
  const parsed = createTechRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const storedPayload: StoredPayload = {
    leadId: payload.leadId ?? null,
    companyName: payload.companyName,
    industry: payload.industry,
    employeeCount: payload.employeeCount,
    employees: payload.employees,
    priority: payload.priority,
    notes: payload.notes,
    estimatedDelivery: payload.estimatedDelivery,
    type: payload.type,
    submittedByUserId: user.sub,
    companyProfile: payload.companyProfile,
    bossDetails: payload.bossDetails,
  };

  const techRequest = await prisma.techRequest.create({
    data: {
      roleName: payload.type === "SUPPORT" ? "SUPPORT_REQUEST" : payload.type === "ADDITION" ? "ADD_EMPLOYEE" : "ONBOARDING_BUILD",
      description: JSON.stringify(storedPayload),
      companyId: user.companyId,
      status: "PENDING",
      priority: payload.priority.toUpperCase() === "URGENT" ? "URGENT" : "NORMAL",
      requestedBy: user.sub,
    },
  });

  if (payload.leadId) {
    await prisma.lead.updateMany({
      where: { id: payload.leadId, companyId: user.companyId },
      data: {
        internalSalesStage: "SENT_TO_TECH",
        status: LeadStatus.QUALIFIED,
        internalSalesNotes: payload.notes || undefined,
        lastActivityAt: new Date(),
      },
    });
  }

  return NextResponse.json({ techRequest });
}

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!user.companyId) return NextResponse.json({ error: "No active company in session." }, { status: 400 });

  const rows = await prisma.techRequest.findMany({
    where: {
      companyId: user.companyId,
      requestedBy: user.sub,
    },
    orderBy: { createdAt: "desc" },
  });

  const techRequests = rows.map((row) => {
    let payload: StoredPayload | null = null;
    try {
      payload = row.description ? (JSON.parse(row.description) as StoredPayload) : null;
    } catch {
      payload = null;
    }
    return {
      id: row.id,
      companyName: payload?.companyName ?? "Unknown Company",
      submittedDate: row.createdAt.toISOString(),
      employeeCount: payload?.employeeCount ?? 0,
      priority: (payload?.priority ?? row.priority).toUpperCase(),
      status: normalizeStatus(row.status),
      sdeNotes: payload?.sdeNotes ?? "",
      estimatedDelivery: payload?.estimatedDelivery ?? null,
      sdeAssigned: payload?.sdeAssigned ?? null,
      nextActionNeeded: normalizeStatus(row.status) === "DONE" ? "Delivery and client training" : "Await SDE update",
      type: payload?.type ?? "ONBOARDING",
      leadId: payload?.leadId ?? null,
    };
  });

  return NextResponse.json({ techRequests });
}
