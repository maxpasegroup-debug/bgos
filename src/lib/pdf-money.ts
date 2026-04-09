import "server-only";

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

import type { CompanyCurrentApiRow } from "./company-db-select";
import type { NormalizedMoneyLineItem } from "./money-items";
import { roundMoney, totalFromNormalized } from "./money-items";

type PdfDoc = InstanceType<typeof PDFDocument>;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const TABLE_X = MARGIN;
const ROW_H = 20;
const HEADER_ROW_H = 24;
const PAGE_SAFE_BOTTOM = 740;
const FOOTER_MIN_Y = 680;

const COL_ITEM = 0.46;
const COL_QTY = 0.1;
const COL_PRICE = 0.22;
const COL_TOTAL = 0.22;

const TERMS_TEXT =
  "Payment is due by the date indicated. Prices are in Indian Rupees (INR). " +
  "Delayed payments may incur interest as permitted by law. " +
  "Goods and services remain the property of the seller until paid in full.";

function formatInr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

function accentColor(company: CompanyCurrentApiRow): string {
  const p = company.primaryColor?.trim();
  if (p && /^#[0-9A-Fa-f]{6}$/.test(p)) return p;
  return "#0f172a";
}

function columnXs(tableWidth: number): { item: number; qty: number; price: number; total: number; widths: number[] } {
  const wItem = Math.floor(tableWidth * COL_ITEM);
  const wQty = Math.floor(tableWidth * COL_QTY);
  const wPrice = Math.floor(tableWidth * COL_PRICE);
  const wTotal = tableWidth - wItem - wQty - wPrice;
  const item = TABLE_X;
  const qty = item + wItem;
  const price = qty + wQty;
  const total = price + wPrice;
  return { item, qty, price, total, widths: [wItem, wQty, wPrice, wTotal] };
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

async function tryEmbedLogo(doc: PdfDoc, logoUrl: string | null, x: number, y: number, maxH: number): Promise<number> {
  if (!logoUrl?.trim()) return 0;
  const u = logoUrl.trim();
  try {
    let buf: Buffer | null = null;
    if (u.startsWith("http://") || u.startsWith("https://")) {
      const res = await fetch(u);
      if (!res.ok) return 0;
      buf = Buffer.from(await res.arrayBuffer());
    } else {
      const rel = u.replace(/^\//, "");
      const full = path.join(process.cwd(), "public", rel);
      if (fs.existsSync(full)) {
        buf = fs.readFileSync(full);
      }
    }
    if (!buf) return 0;
    doc.image(buf, x, y, { fit: [132, maxH] });
    return maxH + 10;
  } catch {
    return 0;
  }
}

function underlineAccent(doc: PdfDoc, y: number, accent: string) {
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(2).strokeColor(accent).stroke();
}

function drawWrappedText(
  doc: PdfDoc,
  text: string,
  x: number,
  y: number,
  width: number,
  options: { size?: number; color?: string; lineGap?: number },
): number {
  const size = options.size ?? 9;
  const color = options.color ?? "#334155";
  const gap = options.lineGap ?? 2;
  doc.fontSize(size).fillColor(color);
  const h = doc.heightOfString(text, { width, lineGap: gap });
  doc.text(text, x, y, { width, lineGap: gap });
  return y + h + 4;
}

/** Sanitized download name: QUOTATION-0001.pdf / INVOICE-0001.pdf */
export function pdfAttachmentFilename(kind: "quotation" | "invoice", documentNumber: string): string {
  const raw = documentNumber.replace(/[/\\?%*:|"<>]/g, "-").trim() || "document";
  const stripped = raw.replace(/^(Q|QUO|QUOTE|INV|INVOICE)[-_\s]*/i, "").replace(/^[-_\s]+/, "") || raw;
  const safe = stripped.replace(/[^a-zA-Z0-9-]/g, "-");
  return kind === "quotation" ? `QUOTATION-${safe}.pdf` : `INVOICE-${safe}.pdf`;
}

async function drawCompanyHeader(doc: PdfDoc, company: CompanyCurrentApiRow, accent: string): Promise<number> {
  const y = MARGIN;
  const logoBottom = await tryEmbedLogo(doc, company.logoUrl, MARGIN, y, 52);

  const textLeft = logoBottom > 0 ? MARGIN + 148 : MARGIN;
  const textW = Math.min(340, PAGE_W - MARGIN - 200);

  doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a").text(company.name, textLeft, y, { width: textW });

  let lineY = y + 22;
  doc.font("Helvetica").fontSize(8.5).fillColor("#475569");
  if (company.billingAddress?.trim()) {
    const h = doc.heightOfString(company.billingAddress.trim(), { width: textW, lineGap: 1 });
    doc.text(company.billingAddress.trim(), textLeft, lineY, { width: textW, lineGap: 1 });
    lineY += h + 4;
  }
  const lines: string[] = [];
  if (company.companyPhone?.trim()) lines.push(`Phone: ${company.companyPhone.trim()}`);
  if (company.companyEmail?.trim()) lines.push(`Email: ${company.companyEmail.trim()}`);
  if (lines.length) {
    doc.text(lines.join("  ·  "), textLeft, lineY, { width: textW });
    lineY += 12;
  }
  if (company.gstNumber?.trim()) {
    doc.fillColor("#334155").text(`GSTIN: ${company.gstNumber.trim()}`, textLeft, lineY, { width: textW });
    lineY += 12;
  }

  const metaX = PAGE_W - MARGIN - 180;
  const headerBlockBottom = Math.max(lineY, y + logoBottom);
  underlineAccent(doc, headerBlockBottom + 10, accent);
  return headerBlockBottom + 22;
}

function drawDocumentBanner(
  doc: PdfDoc,
  kind: "QUOTATION" | "INVOICE",
  docNumber: string,
  docDate: Date,
  dueDate: Date | null,
  accent: string,
  y: number,
): number {
  doc.roundedRect(MARGIN, y, CONTENT_W, 52, 4).fillAndStroke("#f8fafc", accent);
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(18).text(kind, MARGIN + 14, y + 14, { width: 200 });
  doc.font("Helvetica").fontSize(9).fillColor("#475569");
  const metaW = 200;
  const metaX = PAGE_W - MARGIN - metaW - 14;
  doc.font("Helvetica-Bold").fillColor("#0f172a").text("Document no.", metaX, y + 10, { width: metaW, align: "right" });
  doc.font("Helvetica").fillColor("#334155").text(docNumber, metaX, y + 22, { width: metaW, align: "right" });
  let my = y + 34;
  doc.text(
    `Date: ${docDate.toLocaleDateString("en-IN", { dateStyle: "long" })}`,
    metaX,
    my,
    { width: metaW, align: "right" },
  );
  my += 12;
  if (dueDate && kind === "INVOICE") {
    doc.text(
      `Due: ${dueDate.toLocaleDateString("en-IN", { dateStyle: "long" })}`,
      metaX,
      my,
      { width: metaW, align: "right" },
    );
    my += 12;
  }
  return y + 60;
}

function drawCustomerBlock(
  doc: PdfDoc,
  name: string | null | undefined,
  phone: string | null | undefined,
  address: string | null | undefined,
  y: number,
): number {
  const cn = name?.trim();
  const cp = phone?.trim();
  const ca = address?.trim();
  const showName = cn && cn !== "—";
  const showPhone = cp && cp !== "—";
  if (!showName && !showPhone && !ca) return y;

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("CUSTOMER", MARGIN, y);
  const innerX = MARGIN + 14;
  const innerW = CONTENT_W - 28;
  const boxTop = y + 14;

  let textH = 12;
  if (showName) textH += 14;
  if (showPhone) textH += 13;
  if (ca) {
    doc.font("Helvetica").fontSize(9);
    textH += doc.heightOfString(ca, { width: innerW, lineGap: 1 }) + 4;
  }
  const boxH = Math.max(56, textH + 12);

  doc.roundedRect(MARGIN, boxTop, CONTENT_W, boxH, 3).fill("#ffffff").stroke("#e2e8f0");

  let innerY = boxTop + 12;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a");
  if (showName) {
    doc.text(cn!, innerX, innerY, { width: innerW });
    innerY += 14;
  }
  doc.font("Helvetica").fontSize(9).fillColor("#475569");
  if (showPhone) {
    doc.text(cp!, innerX, innerY, { width: innerW });
    innerY += 13;
  }
  if (ca) {
    doc.text(ca, innerX, innerY, { width: innerW, lineGap: 1 });
  }

  return boxTop + boxH + 16;
}

function drawTableHeaderRow(doc: PdfDoc, y: number, cols: ReturnType<typeof columnXs>): number {
  const [wItem, wQty, wPrice, wTotal] = cols.widths;
  doc.rect(TABLE_X, y, CONTENT_W, HEADER_ROW_H).fill("#e2e8f0").stroke("#cbd5e1");
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5);
  doc.text("Item name", cols.item + 6, y + 8, { width: wItem - 12 });
  doc.text("Qty", cols.qty, y + 8, { width: wQty, align: "right" });
  doc.text("Price", cols.price, y + 8, { width: wPrice - 6, align: "right" });
  doc.text("Total", cols.total, y + 8, { width: wTotal - 6, align: "right" });
  return y + HEADER_ROW_H;
}

function drawItemsTable(doc: PdfDoc, items: NormalizedMoneyLineItem[], startY: number): number {
  const cols = columnXs(CONTENT_W);
  let y = drawTableHeaderRow(doc, startY, cols);
  const [wItem, wQty, wPrice, wTotal] = cols.widths;

  doc.font("Helvetica").fontSize(9).fillColor("#1e293b");
  for (const it of items) {
    const nameH = doc.heightOfString(it.name, { width: wItem - 12, lineGap: 1 });
    const rowH = Math.max(ROW_H, nameH + 10);
    if (y + rowH > PAGE_SAFE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
      y = drawTableHeaderRow(doc, y, cols);
      doc.font("Helvetica").fontSize(9).fillColor("#1e293b");
    }
    doc.rect(TABLE_X, y, CONTENT_W, rowH).stroke("#e2e8f0");
    // vertical rules
    doc.moveTo(cols.qty, y).lineTo(cols.qty, y + rowH).strokeColor("#e2e8f0").lineWidth(0.35).stroke();
    doc.moveTo(cols.price, y).lineTo(cols.price, y + rowH).strokeColor("#e2e8f0").lineWidth(0.35).stroke();
    doc.moveTo(cols.total, y).lineTo(cols.total, y + rowH).strokeColor("#e2e8f0").lineWidth(0.35).stroke();

    doc.text(it.name, cols.item + 6, y + 6, { width: wItem - 12, lineGap: 1 });
    doc.text(String(it.qty), cols.qty, y + 6, { width: wQty - 4, align: "right" });
    doc.text(formatInr(it.price), cols.price, y + 6, { width: wPrice - 8, align: "right" });
    doc.text(formatInr(it.lineTotal), cols.total, y + 6, { width: wTotal - 8, align: "right" });
    y += rowH;
  }
  return y + 8;
}

function drawTotalsBlock(
  doc: PdfDoc,
  options: {
    subtotal: number;
    hasGst: boolean;
    grandTotal: number;
    accent: string;
    paidAmount?: number;
    balance?: number;
    statusLabel?: string;
  },
  y: number,
): number {
  const boxW = 248;
  const boxX = PAGE_W - MARGIN - boxW;
  const pad = 12;
  const bandH = 26;
  let boxH = pad + 16 + 18 + bandH + 10 + pad;
  if (options.paidAmount != null) boxH += 16;
  if (options.balance != null) boxH += 16;
  if (options.statusLabel) boxH += 14;

  const ty = y;
  doc.roundedRect(boxX, ty, boxW, boxH, 4).fill("#f8fafc").stroke("#e2e8f0");

  let ly = ty + pad;
  doc.font("Helvetica").fontSize(9).fillColor("#334155");
  doc.text("Subtotal", boxX + pad, ly, { width: 120 });
  doc.fillColor("#0f172a").text(formatInr(options.subtotal), boxX + pad, ly, {
    width: boxW - pad * 2,
    align: "right",
  });
  ly += 16;

  doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#64748b");
  doc.text(options.hasGst ? "Tax (GST)" : "Tax", boxX + pad, ly, { width: 120 });
  doc.font("Helvetica").fillColor("#475569").text(
    options.hasGst ? "Included / as applicable" : "—",
    boxX + pad,
    ly,
    { width: boxW - pad * 2, align: "right" },
  );
  ly += 18;

  doc.rect(boxX, ly - 2, boxW, bandH).fill(options.accent);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
  doc.text("Grand total", boxX + pad, ly + 6, { width: 120 });
  doc.text(formatInr(options.grandTotal), boxX + pad, ly + 6, { width: boxW - pad * 2, align: "right" });
  ly += bandH + 10;

  if (options.paidAmount != null) {
    doc.font("Helvetica").fontSize(9).fillColor("#334155");
    doc.text("Amount paid", boxX + pad, ly, { width: 120 });
    doc.fillColor("#0f172a").text(formatInr(options.paidAmount), boxX + pad, ly, {
      width: boxW - pad * 2,
      align: "right",
    });
    ly += 16;
  }
  if (options.balance != null) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#334155");
    doc.text("Balance due", boxX + pad, ly, { width: 120 });
    doc.fillColor("#0f172a").text(formatInr(options.balance), boxX + pad, ly, {
      width: boxW - pad * 2,
      align: "right",
    });
    ly += 16;
  }
  if (options.statusLabel) {
    doc.font("Helvetica").fontSize(8).fillColor("#64748b");
    doc.text(`Status: ${options.statusLabel}`, boxX + pad, ly + 2, { width: boxW - pad * 2 });
  }

  return ty + boxH + 16;
}

function ensureFooterSpace(doc: PdfDoc, y: number): number {
  if (y > FOOTER_MIN_Y) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function drawPaymentDetailsBlock(doc: PdfDoc, bankDetails: string | null | undefined, y: number): number {
  const text = bankDetails?.trim();
  if (!text) return y;

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("Payment details", MARGIN, y);
  y += 12;
  const innerX = MARGIN + 4;
  const innerW = CONTENT_W - 8;
  const bodyH = doc.heightOfString(text, { width: innerW, lineGap: 2 }) + 20;
  const boxH = Math.max(48, bodyH);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 3).fill("#fafafa").stroke("#e2e8f0");
  doc.font("Helvetica").fontSize(8.5).fillColor("#334155");
  doc.text(text, innerX, y + 12, { width: innerW, lineGap: 2 });
  return y + boxH + 18;
}

function drawNotesAndFooter(doc: PdfDoc, notes: string | null, y: number) {
  y = ensureFooterSpace(doc, y);
  let ny = y;
  if (notes?.trim()) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("Notes", MARGIN, ny);
    ny += 12;
    ny = drawWrappedText(doc, notes.trim(), MARGIN, ny, CONTENT_W, { size: 8.5, color: "#475569" });
    ny += 8;
  }

  if (ny > PAGE_SAFE_BOTTOM - 100) {
    doc.addPage();
    ny = MARGIN;
  }

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("Terms & conditions", MARGIN, ny);
  ny += 12;
  ny = drawWrappedText(doc, TERMS_TEXT, MARGIN, ny, CONTENT_W, { size: 8, color: "#64748b" });
  ny += 20;

  const pageH = doc.page.height ?? PAGE_H;
  const bottomMax = pageH - MARGIN - 8;
  if (ny > bottomMax - 20) {
    doc.addPage();
    ny = MARGIN + 8;
  }
  doc.font("Helvetica").fontSize(7.5).fillColor("#94a3b8").text("Powered by BGOS", MARGIN, Math.min(ny, bottomMax), {
    width: CONTENT_W,
    align: "center",
  });
}

export async function buildQuotationPdf(options: {
  company: CompanyCurrentApiRow;
  docNumber: string;
  docDate: Date;
  items: NormalizedMoneyLineItem[];
  totalAmount: number;
  notes: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
}): Promise<Buffer> {
  const {
    company,
    docNumber,
    docDate,
    items,
    totalAmount,
    notes,
    customerName,
    customerPhone,
    customerAddress,
  } = options;
  const doc = new PDFDocument({ margin: MARGIN, size: "A4" }) as PdfDoc;
  const accent = accentColor(company);

  let y = await drawCompanyHeader(doc, company, accent);
  y = drawDocumentBanner(doc, "QUOTATION", docNumber, docDate, null, accent, y);
  y = drawCustomerBlock(doc, customerName, customerPhone, customerAddress, y);
  y = drawItemsTable(doc, items, y);

  const subtotal = roundMoney(totalFromNormalized(items));
  const grand = roundMoney(totalAmount);
  y = drawTotalsBlock(
    doc,
    {
      subtotal,
      hasGst: Boolean(company.gstNumber?.trim()),
      grandTotal: grand,
      accent,
    },
    y,
  );

  drawNotesAndFooter(doc, notes, y);

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
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
}): Promise<Buffer> {
  const {
    company,
    docNumber,
    docDate,
    dueDate,
    items,
    totalAmount,
    paidAmount,
    status,
    customerName,
    customerPhone,
    customerAddress,
  } = options;
  const doc = new PDFDocument({ margin: MARGIN, size: "A4" }) as PdfDoc;
  const accent = accentColor(company);

  let y = await drawCompanyHeader(doc, company, accent);
  y = drawDocumentBanner(doc, "INVOICE", docNumber, docDate, dueDate, accent, y);
  y = drawCustomerBlock(doc, customerName, customerPhone, customerAddress, y);
  y = drawItemsTable(doc, items, y);

  const subtotal = roundMoney(totalFromNormalized(items));
  const grand = roundMoney(totalAmount);
  const balance = roundMoney(Math.max(0, totalAmount - paidAmount));
  y = drawTotalsBlock(
    doc,
    {
      subtotal,
      hasGst: Boolean(company.gstNumber?.trim()),
      grandTotal: grand,
      accent,
      paidAmount: roundMoney(paidAmount),
      balance,
      statusLabel: status,
    },
    y,
  );

  y = ensureFooterSpace(doc, y);
  y = drawPaymentDetailsBlock(doc, company.bankDetails, y);
  drawNotesAndFooter(doc, null, y);

  return pdfToBuffer(doc);
}
