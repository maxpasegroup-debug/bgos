import "server-only";

type InvoiceCustomerSource = {
  lead: { name: string; phone: string } | null;
  quotation: { customerName: string | null; customerPhone: string | null } | null;
};

export function resolveInvoiceCustomer(inv: InvoiceCustomerSource): {
  customerName: string;
  customerPhone: string;
} {
  const q = inv.quotation;
  const l = inv.lead;
  const qName = q?.customerName?.trim() ?? "";
  const qPhone = q?.customerPhone?.trim() ?? "";
  const lName = l?.name?.trim() ?? "";
  const lPhone = l?.phone?.trim() ?? "";
  return {
    customerName: qName || lName || "—",
    customerPhone: qPhone || lPhone || "—",
  };
}
