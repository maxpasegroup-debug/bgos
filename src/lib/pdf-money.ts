import "server-only";

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

import type { CompanyCurrentApiRow } from "./company-db-select";
import type { NormalizedMoneyLineItem } from "./money-items";

type PdfDoc = InstanceType<typeof PDFDocument>;

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

async function tryEmbedLogo(
  doc: PdfDoc,
  logoUrl: string | null,
  x: number,
  y: number,
  w: number,
): Promise<void> {
  if (!logoUrl?.trim()) return;
  const u = logoUrl.trim();
  try {
    if (u.startsWith("http://") || u.startsWith("https://")) {
      const res = await fetch(u);
      if (!res.ok) return;
      const buf = Buffer.from(await res.arrayBuffer());
      doc.image(buf, x, y, { width: w });
      return;
    }
    const rel = u.replace(/^\//, "");
    const full = path.join(process.cwd(), "public", rel);
    if (fs.existsSync(full)) {
      doc.image(full, x, y, { width: w });
    }
  } catch {
    /* optional logo */
  }
}

async function drawCompanyHeader(doc: PdfDoc, company: CompanyCurrentApiRow): Promise<void> {
  await tryEmbedLogo(doc, company.logoUrl, 50, 45, 72);
  const left = company.logoUrl ? 140 : 50;
  doc.fontSize(18).fillColor("#111").text(company.name, left, 48, { width: 400 });
  let yAddr = 78;
  doc.fontSize(9).fillColor("#444");
  if (company.billingAddress) {
    doc.text(company.billingAddress, left, yAddr, { width: 400 });
    yAddr += doc.heightOfString(company.billingAddress, { width: 400 }) + 6;
  }
  const contactBits = [company.companyPhone, company.companyEmail].filter(Boolean).join(" · ");
  if (contactBits) {
    doc.text(contactBits, left, yAddr, { width: 400 });
    yAddr += 14;
  }
  if (company.gstNumber) {
    doc.text(`GST: ${company.gstNumber}`, left, yAddr, { width: 400 });
  }
}

function drawItemsTable(doc: PdfDoc, items: NormalizedMoneyLineItem[], startY: number): number {
  let y = startY;
  doc.fontSize(9).fillColor("#111");
  doc.text("Item", 50, y, { width: 220 });
  doc.text("Qty", 280, y, { width: 40, align: "right" });
  doc.text("Price", 330, y, { width: 70, align: "right" });
  doc.text("Total", 410, y, { width: 120, align: "right" });
  y += 16;
  doc.moveTo(50, y).lineTo(545, y).strokeColor("#ccc").lineWidth(0.5).stroke();
  y += 8;
  for (const it of items) {
    doc.fillColor("#111");
    doc.text(it.name, 50, y, { width: 220 });
    doc.text(String(it.qty), 280, y, { width: 40, align: "right" });
    doc.text(formatInr(it.price), 330, y, { width: 70, align: "right" });
    doc.text(formatInr(it.lineTotal), 410, y, { width: 120, align: "right" });
    y += Math.max(18, doc.heightOfString(it.name, { width: 220 }) + 4);
  }
  return y;
}

function pdfToBuffer(doc: PdfDoc): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.end();
  return done;
}

export async function buildQuotationPdf(options: {
  company: CompanyCurrentApiRow;
  docTitle: string;
  docNumber: string;
  docDate: Date;
  items: NormalizedMoneyLineItem[];
  totalAmount: number;
  notes: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
}): Promise<Buffer> {
  const { company, docTitle, docNumber, docDate, items, totalAmount, notes, customerName, customerPhone } =
    options;
  const doc = new PDFDocument({ margin: 48, size: "A4" }) as PdfDoc;

  await drawCompanyHeader(doc, company);

  doc.fontSize(20).fillColor("#111").text(docTitle, 50, 160, { align: "right", width: 495 });
  doc.fontSize(10).fillColor("#555").text(`${docNumber}`, 50, 188, { align: "right", width: 495 });
  doc.text(
    `Date: ${docDate.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
    50,
    202,
    { align: "right", width: 495 },
  );

  let y = 218;
  const cn = customerName?.trim();
  const cp = customerPhone?.trim();
  if (cn || cp) {
    doc.fontSize(10).fillColor("#333").text("Bill to", 50, y);
    y += 14;
    doc.fontSize(10).fillColor("#111");
    if (cn) {
      doc.text(cn, 50, y, { width: 260 });
      y += doc.heightOfString(cn, { width: 260 }) + 4;
    }
    if (cp) {
      doc.text(cp, 50, y, { width: 260 });
      y += doc.heightOfString(cp, { width: 260 }) + 12;
    }
  }

  y = Math.max(y, 240);
  y = drawItemsTable(doc, items, y) + 16;
  doc.fontSize(11).fillColor("#111").text(`Total: ${formatInr(totalAmount)}`, 50, y, {
    align: "right",
    width: 495,
  });
  y += 28;
  if (notes?.trim()) {
    doc.fontSize(10).fillColor("#333").text("Notes", 50, y);
    y += 14;
    doc.fontSize(9).fillColor("#555").text(notes.trim(), 50, y, { width: 495 });
  }

  return pdfToBuffer(doc);
}

export async function buildInvoicePdf(options: {
  company: CompanyCurrentApiRow;
  docNumber: string;
  docDate: Date;
  dueDate: Date | null;
  items: NormalizedMoneyLineItem[];
  totalAmount: number;
  paidAmount: number;
  status: string;
}): Promise<Buffer> {
  const { company, docNumber, docDate, dueDate, items, totalAmount, paidAmount, status } = options;
  const doc = new PDFDocument({ margin: 48, size: "A4" }) as PdfDoc;

  await drawCompanyHeader(doc, company);

  doc.fontSize(20).fillColor("#111").text("Tax Invoice", 50, 160, { align: "right", width: 495 });
  doc.fontSize(10).fillColor("#555").text(docNumber, 50, 188, { align: "right", width: 495 });
  doc.text(
    `Issued: ${docDate.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
    50,
    202,
    { align: "right", width: 495 },
  );
  if (dueDate) {
    doc.text(
      `Due: ${dueDate.toLocaleDateString("en-IN", { dateStyle: "medium" })}`,
      50,
      216,
      { align: "right", width: 495 },
    );
  }

  let y = dueDate ? 248 : 234;
  y = drawItemsTable(doc, items, y) + 16;
  doc.fontSize(11).fillColor("#111");
  doc.text(`Total: ${formatInr(totalAmount)}`, 50, y, { align: "right", width: 495 });
  y += 18;
  doc.text(`Paid: ${formatInr(paidAmount)}`, 50, y, { align: "right", width: 495 });
  y += 18;
  doc.text(`Balance: ${formatInr(Math.max(0, totalAmount - paidAmount))}`, 50, y, {
    align: "right",
    width: 495,
  });
  y += 18;
  doc.fontSize(9).fillColor("#666").text(`Status: ${status}`, 50, y, { align: "right", width: 495 });

  return pdfToBuffer(doc);
}
