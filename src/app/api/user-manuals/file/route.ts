import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { UserManualCategory } from "@prisma/client";
import { jsonError } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { absoluteDocumentPath, mimeForDocumentFileName } from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const cat = request.nextUrl.searchParams.get("category")?.trim();
  if (!cat || !(Object.values(UserManualCategory) as string[]).includes(cat)) {
    return jsonError(400, "VALIDATION", "Invalid category");
  }

  const manual = await prisma.userManual.findUnique({
    where: {
      companyId_category: { companyId: session.companyId, category: cat as UserManualCategory },
    },
    select: { fileUrl: true, title: true },
  });
  if (!manual) {
    return jsonError(404, "NOT_FOUND", "No manual for this category");
  }

  let abs: string;
  try {
    abs = absoluteDocumentPath(manual.fileUrl);
  } catch {
    return jsonError(500, "STORAGE", "Invalid file path");
  }

  if (!existsSync(abs)) {
    return jsonError(404, "NOT_FOUND", "File missing");
  }

  let buf: Buffer;
  try {
    buf = await readFile(abs);
  } catch {
    return jsonError(500, "STORAGE", "File unreadable");
  }

  const nameFromKey = manual.fileUrl.split("/").pop() ?? "manual.pdf";
  const mime = mimeForDocumentFileName(nameFromKey);

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      "Content-Disposition": `inline; filename="${manual.title.replace(/[^\x20-\x7E]/g, "_").slice(0, 120)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
