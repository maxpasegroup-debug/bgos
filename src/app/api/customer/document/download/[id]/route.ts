import { existsSync, createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCustomerFromCookie } from "@/lib/customer-auth";
import { absoluteDocumentPath, mimeForDocumentFileName } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await getCustomerFromCookie();
  if (!auth) return NextResponse.json({ ok: false as const, error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const doc = await prisma.document.findFirst({
    where: { id, companyId: auth.companyId, leadId: auth.leadId },
  });
  if (!doc) return NextResponse.json({ ok: false as const, error: "Not found" }, { status: 404 });

  let abs: string;
  try {
    abs = absoluteDocumentPath(doc.fileUrl);
  } catch {
    return NextResponse.json({ ok: false as const, error: "Invalid file" }, { status: 500 });
  }
  if (!existsSync(abs)) return NextResponse.json({ ok: false as const, error: "File missing" }, { status: 404 });
  const size = (await stat(abs)).size;
  const mime = mimeForDocumentFileName(doc.fileName);
  const safe = doc.fileName.replace(/[^\x20-\x7E]/g, "_").slice(0, 180) || "download";
  const stream = createReadStream(abs);
  const web = Readable.toWeb(stream);

  const requestUrl = new URL(request.url);
  const inline =
    requestUrl.searchParams.get("inline") === "1" ||
    requestUrl.searchParams.get("inline") === "true";

  return new Response(web as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Content-Disposition": inline ? `inline; filename="${safe}"` : `attachment; filename="${safe}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
