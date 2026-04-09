import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { resolveInvoiceCustomer } from "@/lib/invoice-customer";
import { invoicePaymentBucket, resolveInvoiceStatus, roundMoney } from "@/lib/money-items";
import { prisma } from "@/lib/prisma";
import { USER_ADMIN_ROLES } from "@/lib/user-company";

function rangeBounds(raw: string | null): { from: Date; to: Date; label: string } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (raw === "today") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
      to: end,
      label: "Today",
    };
  }
  if (raw === "3_months") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0),
      to: end,
      label: "3 Months",
    };
  }
  if (raw === "1_year") {
    return {
      from: new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0),
      to: end,
      label: "Year",
    };
  }
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0),
    to: end,
    label: "This Month",
  };
}

export async function GET(request: NextRequest) {
  const session = await requireAuthWithRoles(request, USER_ADMIN_ROLES);
  if (session instanceof NextResponse) return session;
  const companyId = session.companyId;
  if (!companyId) return jsonError(400, "NEEDS_COMPANY", "Create a company first.");

  const range = rangeBounds(request.nextUrl.searchParams.get("range"));
  const monthly = request.nextUrl.searchParams.get("expenseMonth")?.trim() ?? "";
  const category = request.nextUrl.searchParams.get("expenseCategory")?.trim() ?? "";

  const expenseWhere: {
    companyId: string;
    date?: { gte: Date; lte: Date };
    category?: string;
  } = { companyId };
  if (/^\d{4}-\d{2}$/.test(monthly)) {
    const [y, m] = monthly.split("-").map((v) => Number(v));
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    expenseWhere.date = { gte: start, lte: end };
  } else {
    expenseWhere.date = { gte: range.from, lte: range.to };
  }
  if (category) expenseWhere.category = category;

  const [paymentsAgg, expensesAgg, pendingInvoices, invoices, payments, expenses, lco, trendMonths] =
    await Promise.all([
      prisma.invoicePayment.aggregate({
        where: { companyId, date: { gte: range.from, lte: range.to } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { companyId, date: { gte: range.from, lte: range.to } },
        _sum: { amount: true },
      }),
      prisma.invoice.findMany({
        where: { companyId },
        select: { totalAmount: true, paidAmount: true },
      }),
      prisma.invoice.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          lead: { select: { name: true, phone: true } },
          quotation: { select: { customerName: true, customerPhone: true } },
        },
      }),
      prisma.invoicePayment.findMany({
        where: { companyId, date: { gte: range.from, lte: range.to } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 120,
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 120,
      }),
      (prisma as any).lcoLoan.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 120,
        include: { lead: { select: { id: true, name: true } } },
      }),
      prisma.expense.findMany({
        where: {
          companyId,
          date: { gte: new Date(range.to.getFullYear(), range.to.getMonth() - 5, 1, 0, 0, 0, 0), lte: range.to },
        },
        select: { amount: true, date: true },
      }),
    ]);

  const totalRevenue = roundMoney(invoices.reduce((sum, i) => sum + i.totalAmount, 0));
  const collectedAmount = roundMoney(paymentsAgg._sum.amount ?? 0);
  const pendingPayments = roundMoney(
    pendingInvoices.reduce((sum, i) => sum + Math.max(0, i.totalAmount - i.paidAmount), 0),
  );
  const totalExpenses = roundMoney(expensesAgg._sum.amount ?? 0);
  const netProfit = roundMoney(collectedAmount - totalExpenses);

  const expenseMap = new Map<string, number>();
  for (const e of trendMonths) {
    const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, "0")}`;
    expenseMap.set(key, roundMoney((expenseMap.get(key) ?? 0) + e.amount));
  }
  const payRows = await prisma.invoicePayment.findMany({
    where: {
      companyId,
      date: { gte: new Date(range.to.getFullYear(), range.to.getMonth() - 5, 1, 0, 0, 0, 0), lte: range.to },
    },
    select: { amount: true, date: true },
  });
  const revMap = new Map<string, number>();
  for (const p of payRows) {
    const key = `${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, "0")}`;
    revMap.set(key, roundMoney((revMap.get(key) ?? 0) + p.amount));
  }
  const trend: { month: string; revenue: number; expenses: number; profit: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(range.to.getFullYear(), range.to.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const revenue = revMap.get(key) ?? 0;
    const exp = expenseMap.get(key) ?? 0;
    trend.push({
      month: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      revenue,
      expenses: exp,
      profit: roundMoney(revenue - exp),
    });
  }

  return jsonSuccess({
    range: { label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
    overview: {
      totalRevenue,
      collectedAmount,
      pendingPayments,
      totalExpenses,
      netProfit,
    },
    invoices: invoices.map((inv) => {
      const displayStatus = resolveInvoiceStatus({
        status: inv.status,
        paidAmount: inv.paidAmount,
        totalAmount: inv.totalAmount,
        dueDate: inv.dueDate,
      });
      const c = resolveInvoiceCustomer(inv);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customer: c.customerName,
        amount: inv.totalAmount,
        paid: inv.paidAmount,
        balance: roundMoney(Math.max(0, inv.totalAmount - inv.paidAmount)),
        status: displayStatus,
        paymentBucket: invoicePaymentBucket(displayStatus),
        createdAt: inv.createdAt.toISOString(),
      };
    }),
    payments: payments.map((p) => ({
      id: p.id,
      invoiceId: p.invoiceId,
      amount: p.amount,
      method: p.method,
      date: p.date.toISOString(),
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      category: e.category,
      date: e.date.toISOString(),
    })),
    lcoLoans: (lco as any[]).map((l) => ({
      id: l.id,
      customerName: l.lead?.name ?? "Customer",
      leadId: l.leadId,
      loanAmount: l.loanAmount,
      status: l.status,
      notes: l.notes ?? "",
    })),
    trend,
    insights: {
      insightLines: [
        `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(pendingPayments)} pending payments`,
        totalExpenses > 0 ? "Expenses increased" : "No expense trend yet",
      ],
      suggestionLines: ["Follow up invoices", "Reduce expenses"],
    },
  });
}
