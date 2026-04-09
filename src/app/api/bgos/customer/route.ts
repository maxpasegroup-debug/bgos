import { LeadStatus, ServiceTicketStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type FilterKey = "all" | "active" | "pending_service";

function statusLabel(pending: number): "Active" | "Service Pending" {
  return pending > 0 ? "Service Pending" : "Active";
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  const companyId = session.companyId;
  const filter = (request.nextUrl.searchParams.get("filter")?.toLowerCase() ?? "all") as FilterKey;
  const leadId = request.nextUrl.searchParams.get("leadId")?.trim() ?? "";

  const customerWhere: { companyId: string; status: { in: LeadStatus[] } } = {
    companyId,
    status: { in: [LeadStatus.WON, LeadStatus.PROPOSAL_WON, LeadStatus.NEGOTIATION] },
  };

  const [leads, pendingServiceCount, complaintsCount] = await Promise.all([
    prisma.lead.findMany({
      where: customerWhere,
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, phone: true, source: true, createdAt: true },
    }),
    (prisma as any).serviceTicket.count({
      where: { companyId, status: ServiceTicketStatus.OPEN },
    }),
    (prisma as any).customerComplaint.count({
      where: { companyId, status: "PENDING" },
    }),
  ]);

  const serviceRows = await (prisma as any).serviceTicket.findMany({
    where: { companyId, leadId: { in: leads.map((l) => l.id) } },
    select: { leadId: true, status: true },
  });
  const pendingByLead = new Map<string, number>();
  for (const s of serviceRows as Array<{ leadId: string; status: ServiceTicketStatus }>) {
    if (s.status !== ServiceTicketStatus.OPEN) continue;
    pendingByLead.set(s.leadId, (pendingByLead.get(s.leadId) ?? 0) + 1);
  }

  let customers = leads.map((l) => {
    const pending = pendingByLead.get(l.id) ?? 0;
    return {
      id: l.id,
      name: l.name,
      phone: l.phone,
      location: l.source ?? "",
      status: statusLabel(pending),
      pendingServiceCount: pending,
      createdAt: l.createdAt.toISOString(),
    };
  });
  if (filter === "active") customers = customers.filter((c) => c.pendingServiceCount === 0);
  if (filter === "pending_service") customers = customers.filter((c) => c.pendingServiceCount > 0);

  let detail: unknown = null;
  if (leadId) {
    const [lead, install, loan, docs, services, complaints] = await Promise.all([
      prisma.lead.findFirst({
        where: { id: leadId, companyId },
        select: { id: true, name: true, phone: true, source: true },
      }),
      (prisma as any).installation.findFirst({
        where: { companyId, leadId },
        select: { status: true, completedAt: true },
      }),
      (prisma as any).lcoLoan.findFirst({
        where: { companyId, leadId },
        orderBy: { createdAt: "desc" },
        select: { status: true, loanAmount: true, notes: true },
      }),
      prisma.document.findMany({
        where: { companyId, leadId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, fileName: true, type: true, createdAt: true },
      }),
      (prisma as any).serviceTicket.findMany({
        where: { companyId, leadId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, issue: true, title: true, status: true, createdAt: true },
      }),
      (prisma as any).customerComplaint.findMany({
        where: { companyId, leadId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, description: true, status: true, createdAt: true },
      }),
    ]);
    if (lead) {
      detail = {
        customer: {
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          address: lead.source ?? "",
        },
        installation: install
          ? {
              status: install.status as string,
              completedAt: install.completedAt ? new Date(install.completedAt).toISOString() : null,
            }
          : null,
        loan: loan ?? null,
        documents: docs.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          type: d.type,
          createdAt: d.createdAt.toISOString(),
          downloadUrl: `/api/document/download/${d.id}`,
        })),
        services: services.map((s: any) => ({
          id: s.id,
          issue: s.issue ?? s.title ?? "Service request",
          status: s.status,
          createdAt: new Date(s.createdAt).toISOString(),
        })),
        complaints: complaints.map((c: any) => ({
          id: c.id,
          description: c.description,
          status: c.status,
          createdAt: new Date(c.createdAt).toISOString(),
        })),
      };
    }
  }

  return jsonSuccess({
    overview: {
      totalCustomers: leads.length,
      activeCustomers: customers.filter((c) => c.pendingServiceCount === 0).length,
      pendingServiceRequests: pendingServiceCount,
      complaints: complaintsCount,
    },
    customers,
    detail,
    insights: {
      insights: [`${pendingServiceCount} service requests pending`, `${complaintsCount} complaints unresolved`],
      suggestions: ["Resolve pending issues", "Follow up customer"],
    },
  });
}
