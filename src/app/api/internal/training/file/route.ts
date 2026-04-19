/**
 * GET /api/internal/training/file?key=...
 *
 * Serves a stored training file from disk (authenticated, internal only).
 * Security: validates the storage key is within the training uploads root,
 * prevents path traversal.
 */

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "@/lib/auth";
import { requireInternalSalesSession } from "@/lib/internal-sales-access";

function uploadsTrainingRoot() {
  return path.join(process.cwd(), "uploads", "training");
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;

  const session = await requireInternalSalesSession(user);
  if (session instanceof NextResponse) return session;

  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  if (!key) {
    return NextResponse.json({ ok: false as const, error: "Missing key" }, { status: 400 });
  }

  const root = uploadsTrainingRoot();
  const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalized || normalized.includes("..") || normalized.split("/").some((p) => p === "" || p === ".")) {
    return NextResponse.json({ ok: false as const, error: "Invalid path" }, { status: 400 });
  }

  const abs = path.resolve(root, ...normalized.split("/"));
  if (!abs.startsWith(path.resolve(root))) {
    return NextResponse.json({ ok: false as const, error: "Forbidden" }, { status: 403 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(abs);
  } catch {
    return NextResponse.json({ ok: false as const, error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(abs).toLowerCase();
  const contentType =
    ext === ".pdf"  ? "application/pdf" :
    ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
    ext === ".doc"  ? "application/msword" :
    "text/plain";

  const fileName = path.basename(abs);

  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
