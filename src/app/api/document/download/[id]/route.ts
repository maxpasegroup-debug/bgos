import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { requireAuthWithCompany } from "@/lib/auth";
import {
  employeeCanViewDocument,
  getLeadIdsAssignedToUser,
  resolveDocumentVaultScope,
} from "@/lib/document-access-control";
import { absoluteDocumentPath, mimeForDocumentFileName } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: id.trim(), companyId: session.companyId },
    select: {
      id: true,
      companyId: true,
      leadId: true,
      customerId: true,
      fileUrl: true,
      fileName: true,
      uploadedByUserId: true,
    },
  });
  if (!doc) {
    return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
  }

  const vaultScope = await resolveDocumentVaultScope(session);
  if (vaultScope === "mine") {
    const assignedIds = await getLeadIdsAssignedToUser(session.companyId, session.sub);
    const assignedSet = new Set(assignedIds);
    if (!employeeCanViewDocument(doc, session.sub, assignedSet)) {
      return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
    }
  }

  let abs: string;
  try {
    abs = absoluteDocumentPath(doc.fileUrl);
  } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid file" }, { status: 500 });
  }

  if (!existsSync(abs)) {
    return NextResponse.json({ ok: false as const, error: "File missing" }, { status: 404 });
  }

  let size: number;
  try {
    size = (await stat(abs)).size;
  } catch {
    return NextResponse.json({ ok: false as const, error: "File unreadable" }, { status: 500 });
  }

  const mime = mimeForDocumentFileName(doc.fileName);
  const safe = doc.fileName.replace(/[^\x20-\x7E]/g, "_").slice(0, 180) || "download";
  const inline =
    request.nextUrl.searchParams.get("inline") === "1" ||
    request.nextUrl.searchParams.get("inline") === "true";

  const stream = createReadStream(abs);
  const web = Readable.toWeb(stream);

  const disposition = inline
    ? `inline; filename="${safe}"`
    : `attachment; filename="${safe}"`;

  return new Response(web as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Content-Disposition": disposition,
      "Cache-Control": "private, no-store",
    },
  });
}
