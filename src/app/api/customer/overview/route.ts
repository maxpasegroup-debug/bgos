import { jsonError, jsonSuccess } from "@/lib/api-response";
import { getCustomerFromCookie } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await getCustomerFromCookie();
  if (!auth) return jsonError(401, "UNAUTHORIZED", "Login required");

  const leadId = auth.leadId;
  const companyId = auth.companyId;

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
      select: { id: true, title: true, issue: true, status: true, createdAt: true, resolvedAt: true },
    }),
    (prisma as any).customerComplaint.findMany({
      where: { companyId, leadId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, description: true, status: true, createdAt: true },
    }),
  ]);
  if (!lead) return jsonError(404, "NOT_FOUND", "Customer not found");

  return jsonSuccess({
    customer: lead,
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
      downloadUrl: `/api/customer/document/download/${d.id}`,
    })),
    services: services.map((s: any) => ({
      id: s.id,
      title: s.title ?? s.issue ?? "Service request",
      status: s.status,
      createdAt: new Date(s.createdAt).toISOString(),
      resolvedAt: s.resolvedAt ? new Date(s.resolvedAt).toISOString() : null,
    })),
    complaints: complaints.map((c: any) => ({
      id: c.id,
      description: c.description,
      status: c.status,
      createdAt: new Date(c.createdAt).toISOString(),
    })),
  });
}
