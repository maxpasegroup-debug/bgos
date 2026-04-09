import { LeadStatus, ServiceTicketStatus } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess, parseJsonBody, zodValidationErrorResponse } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function autoConsumeInventoryForInstallation(companyId: string, installationId: string): Promise<void> {
  const stocks = await (prisma as any).stock.findMany({
    where: {
      companyId,
      quantity: { gt: 0 },
      product: { category: { in: ["Panel", "Inverter", "Battery"] } },
    },
    include: { product: { select: { id: true } } },
    take: 20,
  });
  if (stocks.length === 0) return;
  await prisma.$transaction(
    stocks.map((s: any) =>
      (prisma as any).stock.update({
        where: { id: s.id },
        data: { quantity: Number(s.quantity) - 1 },
      }),
    ),
  );
  await prisma.$transaction(
    stocks.map((s: any) =>
      (prisma as any).stockLog.create({
        data: {
          companyId,
          productId: s.productId,
          type: "OUT",
          quantity: 1,
          reference: `INSTALLATION_AUTO:${installationId}`,
        },
      }),
    ),
  );
}

const bodySchema = z.object({
  source: z.enum(["site_visit", "approval", "installation", "service_ticket"]),
  sourceId: z.string().cuid(),
  targetStage: z.enum([
    "SITE_VISIT_SCHEDULED",
    "SITE_VISIT_COMPLETED",
    "APPROVAL",
    "INSTALLATION_SCHEDULED",
    "INSTALLATION_IN_PROGRESS",
    "COMPLETED",
    "SERVICE_OPEN",
    "SERVICE_IN_PROGRESS",
    "SERVICE_CLOSED",
  ]),
  notes: z.string().max(4000).optional(),
  approvalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw.response;
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  const { source, sourceId, targetStage, notes, approvalStatus } = parsed.data;
  const companyId = session.companyId;

  if (source === "site_visit") {
    const row = await (prisma as any).siteVisit.findFirst({ where: { id: sourceId, companyId } });
    if (!row) return jsonError(404, "NOT_FOUND", "Site visit not found");
    if (targetStage === "SITE_VISIT_COMPLETED") {
      await (prisma as any).siteVisit.update({
        where: { id: row.id },
        data: { status: "COMPLETED", ...(notes ? { report: { notes } } : {}) },
      });
      await prisma.lead.update({ where: { id: row.leadId }, data: { status: LeadStatus.SITE_VISIT_COMPLETED } });
      await (prisma as any).approval.upsert({
        where: { companyId_leadId: { companyId, leadId: row.leadId } },
        update: {},
        create: { companyId, leadId: row.leadId, status: "PENDING" },
      });
      return jsonSuccess({ ok: true });
    }
    if (targetStage === "SITE_VISIT_SCHEDULED") {
      await (prisma as any).siteVisit.update({
        where: { id: row.id },
        data: { status: "SCHEDULED", ...(notes ? { report: { notes } } : {}) },
      });
      await prisma.lead.update({ where: { id: row.leadId }, data: { status: LeadStatus.SITE_VISIT_SCHEDULED } });
      return jsonSuccess({ ok: true });
    }
    return jsonError(400, "INVALID_STAGE", "Invalid stage for site visit");
  }

  if (source === "approval") {
    const row = await (prisma as any).approval.findFirst({ where: { id: sourceId, companyId } });
    if (!row) return jsonError(404, "NOT_FOUND", "Approval not found");
    if (targetStage === "APPROVAL") {
      const status = approvalStatus ?? row.status ?? "PENDING";
      await (prisma as any).approval.update({
        where: { id: row.id },
        data: { status, ...(notes !== undefined ? { notes } : {}) },
      });
      return jsonSuccess({ ok: true });
    }
    if (targetStage === "INSTALLATION_SCHEDULED" || targetStage === "INSTALLATION_IN_PROGRESS" || targetStage === "COMPLETED") {
      await (prisma as any).approval.update({
        where: { id: row.id },
        data: { status: "APPROVED", ...(notes !== undefined ? { notes } : {}) },
      });
      const installStatus =
        targetStage === "INSTALLATION_IN_PROGRESS"
          ? "IN_PROGRESS"
          : targetStage === "COMPLETED"
            ? "COMPLETED"
            : "PENDING";
      const installation = await (prisma as any).installation.upsert({
        where: { companyId_leadId: { companyId, leadId: row.leadId } },
        update: { status: installStatus, ...(targetStage === "COMPLETED" ? { completedAt: new Date() } : {}) },
        create: {
          companyId,
          leadId: row.leadId,
          assignedTo: null,
          status: installStatus,
          ...(targetStage === "COMPLETED" ? { completedAt: new Date() } : {}),
        },
      });
      if (installation.status === "COMPLETED" && row.leadId) {
        await prisma.lead.update({ where: { id: row.leadId }, data: { status: LeadStatus.WON } });
        await autoConsumeInventoryForInstallation(companyId, installation.id);
      }
      return jsonSuccess({ ok: true });
    }
    return jsonError(400, "INVALID_STAGE", "Invalid stage for approval");
  }

  if (source === "installation") {
    const row = await (prisma as any).installation.findFirst({ where: { id: sourceId, companyId } });
    if (!row) return jsonError(404, "NOT_FOUND", "Installation not found");
    const status =
      targetStage === "INSTALLATION_SCHEDULED"
        ? "PENDING"
        : targetStage === "INSTALLATION_IN_PROGRESS"
          ? "IN_PROGRESS"
          : targetStage === "COMPLETED"
            ? "COMPLETED"
            : null;
    if (!status) return jsonError(400, "INVALID_STAGE", "Invalid stage for installation");
    await (prisma as any).installation.update({
      where: { id: row.id },
      data: {
        status,
        ...(targetStage === "COMPLETED" ? { completedAt: new Date() } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    if (targetStage === "COMPLETED" && row.leadId) {
      await prisma.lead.update({ where: { id: row.leadId }, data: { status: LeadStatus.WON } });
      await autoConsumeInventoryForInstallation(companyId, row.id);
    }
    return jsonSuccess({ ok: true });
  }

  const ticket = await (prisma as any).serviceTicket.findFirst({ where: { id: sourceId, companyId } });
  if (!ticket) return jsonError(404, "NOT_FOUND", "Service ticket not found");
  if (!targetStage.startsWith("SERVICE_")) {
    return jsonError(400, "INVALID_STAGE", "Invalid stage for service ticket");
  }
  const ui = targetStage.replace("SERVICE_", "");
  const status = ui === "CLOSED" ? ServiceTicketStatus.RESOLVED : ServiceTicketStatus.OPEN;
  const priorityTag = (ticket.description as string | null)?.match(/\[PRIORITY:(LOW|MEDIUM|HIGH)\]/)?.[0] ?? "";
  const stateTag = ui === "IN_PROGRESS" ? "[IN_PROGRESS]" : "";
  const suffix = notes !== undefined ? notes : ticket.issue ?? ticket.title ?? "";
  const description = `${priorityTag} ${stateTag} ${suffix}`.trim();
  await (prisma as any).serviceTicket.update({
    where: { id: ticket.id },
    data: {
      status,
      description,
      ...(ui === "CLOSED" ? { resolvedAt: new Date() } : {}),
    },
  });
  return jsonSuccess({ ok: true });
}
