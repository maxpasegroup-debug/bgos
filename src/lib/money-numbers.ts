import "server-only";

import { prisma } from "./prisma";

function nextPaddedId(numbers: string[], pattern: RegExp, prefix: string): string {
  let max = 0;
  for (const num of numbers) {
    const m = pattern.exec(num.trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export async function nextQuotationNumber(companyId: string): Promise<string> {
  const rows = await prisma.quotation.findMany({
    where: { companyId },
    select: { quotationNumber: true },
  });
  return nextPaddedId(
    rows.map((r) => r.quotationNumber),
    /^Q-(\d+)$/i,
    "Q",
  );
}

export async function nextInvoiceNumber(companyId: string): Promise<string> {
  const rows = await prisma.invoice.findMany({
    where: { companyId },
    select: { invoiceNumber: true },
  });
  return nextPaddedId(
    rows.map((r) => r.invoiceNumber),
    /^INV-(\d+)$/i,
    "INV",
  );
}
