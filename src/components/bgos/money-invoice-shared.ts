import type { InvoicePaymentBucket } from "@/lib/money-items";

/** Shared API shape for invoice list/detail clients. */
export type InvoiceApiRow = {
  id: string;
  customerName: string;
  customerPhone: string;
  invoiceNumber: string;
  status: string;
  paymentBucket: InvoicePaymentBucket;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate: string | null;
  createdAt: string;
};

export type InvoicePaymentRow = {
  id: string;
  amount: number;
  method: string;
  date: string;
  createdAt: string;
};

export type InvoiceDetailApi = InvoiceApiRow & {
  workflowStatus: string;
  items: unknown;
  payments: InvoicePaymentRow[];
};

export function formatInrMoney(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function statusBadgeClass(bucket: InvoicePaymentBucket): string {
  switch (bucket) {
    case "PAID":
      return "border-emerald-500/40 bg-emerald-950/35 text-emerald-200 ring-1 ring-emerald-500/20";
    case "PARTIAL":
      return "border-amber-500/40 bg-amber-950/30 text-amber-100 ring-1 ring-amber-500/20";
    default:
      return "border-red-500/35 bg-red-950/25 text-red-100 ring-1 ring-red-500/15";
  }
}

export function progressTone(bucket: InvoicePaymentBucket): string {
  switch (bucket) {
    case "PAID":
      return "from-emerald-500 to-emerald-400";
    case "PARTIAL":
      return "from-amber-500 to-[#FFC300]";
    default:
      return "from-red-500 to-red-400";
  }
}
