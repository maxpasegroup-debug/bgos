import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { serializeDocument } from "@/lib/document-serialize";
import { documentTypeSchema } from "@/lib/document-types";
import { assertAllowedDocumentFile, deleteStoredDocumentFile, saveCompanyDocument } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Invalid form data", code: "BAD_REQUEST" as const },
      { status: 400 },
    );
  }

  const fileRaw = form.get("file");
  const typeRaw = form.get("type");
  const leadRaw = form.get("leadId");
  const customerRaw = form.get("customerId");

  if (!(fileRaw instanceof File)) {
    return NextResponse.json(
      { ok: false as const, error: "Missing file", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const validFile = assertAllowedDocumentFile(fileRaw);
  if (!validFile.ok) {
    return NextResponse.json(
      { ok: false as const, error: validFile.error, code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const typeParsed = documentTypeSchema.safeParse(
    typeof typeRaw === "string" ? typeRaw.trim() : "",
  );
  if (!typeParsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid document type", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  let leadId: string | null = null;
  let customerId: string | null = null;
  if (leadRaw != null && String(leadRaw).trim() !== "") {
    const id = z.string().cuid().safeParse(String(leadRaw).trim());
    if (!id.success) {
      return NextResponse.json(
        { ok: false as const, error: "Invalid lead", code: "VALIDATION" as const },
        { status: 400 },
      );
    }
    const lead = await prisma.lead.findFirst({
      where: { id: id.data, companyId: session.companyId },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json(
        { ok: false as const, error: "Lead not found", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }
    leadId = lead.id;
  }
  if (customerRaw != null && String(customerRaw).trim() !== "") {
    const id = z.string().cuid().safeParse(String(customerRaw).trim());
    if (!id.success) {
      return NextResponse.json(
        { ok: false as const, error: "Invalid customer", code: "VALIDATION" as const },
        { status: 400 },
      );
    }
    const customerLead = await prisma.lead.findFirst({
      where: { id: id.data, companyId: session.companyId },
      select: { id: true },
    });
    if (!customerLead) {
      return NextResponse.json(
        { ok: false as const, error: "Customer not found", code: "NOT_FOUND" as const },
        { status: 404 },
      );
    }
    customerId = customerLead.id;
    if (!leadId) leadId = customerLead.id;
  }

  const displayName = fileRaw.name?.trim() || "document";
  let storageKey: string;
  try {
    ({ storageKey } = await saveCompanyDocument(session.companyId, fileRaw));
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Could not save file", code: "STORAGE" as const },
      { status: 500 },
    );
  }

  try {
    const row = await (prisma as any).document.create({
      data: {
        companyId: session.companyId,
        leadId,
        customerId,
        type: typeParsed.data,
        fileUrl: storageKey,
        fileName: displayName.slice(0, 500),
        uploadedByUserId: session.sub,
        uploadedByRole: session.role,
      },
      include: {
        uploader: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json({
      ok: true as const,
      document: serializeDocument(row),
    });
  } catch {
    await deleteStoredDocumentFile(storageKey);
    return NextResponse.json(
      { ok: false as const, error: "Could not save record", code: "DB_ERROR" as const },
      { status: 500 },
    );
  }
}
