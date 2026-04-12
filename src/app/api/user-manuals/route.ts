import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { UserManualCategory, UserRole } from "@prisma/client";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany, requireAuthWithRoles } from "@/lib/auth";
import {
  assertAllowedDocumentFile,
  deleteStoredDocumentFile,
  saveCompanyDocument,
} from "@/lib/document-storage";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const cat = request.nextUrl.searchParams.get("category")?.trim();
  const where = { companyId: session.companyId };
  if (cat && (Object.values(UserManualCategory) as string[]).includes(cat)) {
    const row = await prisma.userManual.findUnique({
      where: {
        companyId_category: { companyId: session.companyId, category: cat as UserManualCategory },
      },
      select: { id: true, category: true, title: true, fileUrl: true, updatedAt: true },
    });
    return jsonSuccess({ manual: row });
  }

  const manuals = await prisma.userManual.findMany({
    where,
    select: { id: true, category: true, title: true, fileUrl: true, updatedAt: true },
    orderBy: { category: "asc" },
  });
  return jsonSuccess({ manuals });
}

export async function POST(request: NextRequest) {
  const session = await requireAuthWithRoles(request, [UserRole.ADMIN, UserRole.MANAGER]);
  if (session instanceof NextResponse) return session;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "BAD_REQUEST", "Invalid form data");
  }

  const fileRaw = form.get("file");
  const categoryRaw = form.get("category");
  const titleRaw = form.get("title");

  if (!(fileRaw instanceof File)) {
    return jsonError(400, "VALIDATION", "Missing file");
  }

  const valid = assertAllowedDocumentFile(fileRaw);
  if (!valid.ok) {
    return jsonError(400, "VALIDATION", valid.error);
  }

  const category =
    typeof categoryRaw === "string" && (Object.values(UserManualCategory) as string[]).includes(categoryRaw)
      ? (categoryRaw as UserManualCategory)
      : null;
  if (!category) {
    return jsonError(400, "VALIDATION", "Invalid category");
  }

  const title =
    typeof titleRaw === "string" && titleRaw.trim().length > 0
      ? titleRaw.trim().slice(0, 200)
      : fileRaw.name?.trim() || "Manual";

  const { storageKey } = await saveCompanyDocument(session.companyId, fileRaw);

  const existing = await prisma.userManual.findUnique({
    where: { companyId_category: { companyId: session.companyId, category } },
    select: { id: true, fileUrl: true },
  });

  if (existing?.fileUrl) {
    await deleteStoredDocumentFile(existing.fileUrl);
  }

  const row = await prisma.userManual.upsert({
    where: { companyId_category: { companyId: session.companyId, category } },
    create: {
      companyId: session.companyId,
      category,
      title,
      fileUrl: storageKey,
    },
    update: { title, fileUrl: storageKey },
    select: { id: true, category: true, title: true, updatedAt: true },
  });

  return jsonSuccess({ manual: row }, 201);
}
