import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { requireAuthWithCompany } from "@/lib/auth";
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
  });
  if (!doc) {
    return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });
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

  const stream = createReadStream(abs);
  const web = Readable.toWeb(stream);

  return new Response(web as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${safe}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
