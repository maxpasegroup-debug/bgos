import { CompanyPlan, UserRole } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";
import { jsonSuccess, jsonError } from "@/lib/api-response";
import { nextBillingDateIso, planAmountLabel } from "@/lib/billing-plan-summary";
import { requireAuth } from "@/lib/auth";
import { resolveInvoiceCustomer } from "@/lib/invoice-customer";
import {
  invoicePaymentBucket,
  resolveInvoiceStatus,
  roundMoney,
} from "@/lib/money-items";
import { prisma } from "@/lib/prisma";
import { syncCompanySubscriptionStatus } from "@/lib/subscription-status";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

function planDisplayName(plan: CompanyPlan): string {
  switch (plan) {
    case CompanyPlan.BASIC:
      return "Basic";
    case CompanyPlan.PRO:
      return "Pro";
    case CompanyPlan.ENTERPRISE:
      return "Enterprise";
    default:
      return plan;
  }
}

export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  if (!session.companyId) {
    return jsonError(400, "NEEDS_COMPANY", "Create a company to view billing.");
  }

  const companyId = session.companyId;
  const subscriptionStatus = await syncCompanySubscriptionStatus(companyId);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      plan: true,
      trialEndDate: true,
      subscriptionStatus: true,
    },
  });
  if (!company) {
    return jsonError(404, "NOT_FOUND", "Company not found.");
  }

  const nextBilling = nextBillingDateIso({
    plan: company.plan,
    subscriptionStatus,
    trialEndDate: company.trialEndDate,
  });

  const planSummary = {
    planName: planDisplayName(company.plan),
    amount: planAmountLabel(company.plan, subscriptionStatus),
    subscriptionStatus,
    nextBillingDate: nextBilling,
  };

  const canViewInvoices = USER_ADMIN_ROLES.includes(session.role as UserRole);

  if (!canViewInvoices) {
    return jsonSuccess({
      planSummary,
      invoices: [] as const,
      canViewInvoices: false as const,
    });
  }

  const rows = await prisma.invoice.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      lead: { select: { name: true, phone: true } },
      quotation: { select: { customerName: true, customerPhone: true } },
    },
  });

  const invoices = rows.map((inv) => {
    const displayStatus = resolveInvoiceStatus({
      status: inv.status,
      paidAmount: inv.paidAmount,
      totalAmount: inv.totalAmount,
      dueDate: inv.dueDate,
    });
    const { customerName } = resolveInvoiceCustomer(inv);
    const balance = roundMoney(Math.max(0, inv.totalAmount - inv.paidAmount));
    return {
      id: inv.id,
      invoiceId: inv.invoiceNumber,
      date: inv.createdAt.toISOString(),
      amount: inv.totalAmount,
      status: displayStatus,
      paymentBucket: invoicePaymentBucket(displayStatus),
      balance,
      customerName,
    };
  });

  return jsonSuccess({
    planSummary,
    invoices,
    canViewInvoices: true as const,
  });
}
