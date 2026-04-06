import { z } from "zod";

export const moneyLineItemSchema = z.object({
  name: z.string().trim().min(1),
  price: z.number().finite().nonnegative(),
  qty: z.number().finite().positive(),
});

export const moneyItemsSchema = z.array(moneyLineItemSchema).min(1);

export type MoneyLineItem = z.infer<typeof moneyLineItemSchema>;

export type NormalizedMoneyLineItem = MoneyLineItem & { lineTotal: number };

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeMoneyItems(items: MoneyLineItem[]): NormalizedMoneyLineItem[] {
  return items.map((it) => {
    const lineTotal = roundMoney(it.price * it.qty);
    return {
      name: it.name.trim(),
      price: it.price,
      qty: it.qty,
      lineTotal,
    };
  });
}

export function totalFromNormalized(items: NormalizedMoneyLineItem[]): number {
  return roundMoney(items.reduce((s, it) => s + it.lineTotal, 0));
}

export const QUOTATION_STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "PARTIAL", "OVERDUE"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Derive display/settle status from amounts, due date, and workflow flag. */
export function resolveInvoiceStatus(input: {
  status: string;
  paidAmount: number;
  totalAmount: number;
  dueDate: Date | null;
}): InvoiceStatus {
  const { paidAmount: p, totalAmount: t, dueDate } = input;
  if (p >= t - 1e-9) return "PAID";
  if (p > 1e-9) return "PARTIAL";
  if (input.status === "DRAFT") return "DRAFT";
  if (dueDate) {
    const end = new Date(dueDate);
    end.setHours(23, 59, 59, 999);
    if (Date.now() > end.getTime()) return "OVERDUE";
  }
  return "SENT";
}

/** Simplified bucket for invoices UI (badges, progress messaging). */
export type InvoicePaymentBucket = "PAID" | "PARTIAL" | "PENDING";

export function invoicePaymentBucket(status: InvoiceStatus): InvoicePaymentBucket {
  if (status === "PAID") return "PAID";
  if (status === "PARTIAL") return "PARTIAL";
  return "PENDING";
}

export function parseItemsJson(raw: unknown): NormalizedMoneyLineItem[] | null {
  const parsed = moneyItemsSchema.safeParse(raw);
  if (!parsed.success) return null;
  return normalizeMoneyItems(parsed.data);
}
