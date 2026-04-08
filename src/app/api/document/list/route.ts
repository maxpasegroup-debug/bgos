import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { formatDocumentUploaderRole } from "@/lib/document-role-label";
import {
  type PublicUploaderFilterOption,
  serializeDocument,
} from "@/lib/document-serialize";
import { documentTypeSchema } from "@/lib/document-types";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  leadId: z.string().cuid().optional(),
  type: documentTypeSchema.optional(),
  uploadedByUserId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const sp = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    leadId: sp.get("leadId")?.trim() || undefined,
    type: sp.get("type")?.trim() || undefined,
    uploadedByUserId: sp.get("uploadedByUserId")?.trim() || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid filters", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const where: {
    companyId: string;
    leadId?: string | null;
    type?: string;
    uploadedByUserId?: string;
  } = { companyId: session.companyId };

  if (parsed.data.leadId) where.leadId = parsed.data.leadId;
  if (parsed.data.type) where.type = parsed.data.type;
  if (parsed.data.uploadedByUserId) where.uploadedByUserId = parsed.data.uploadedByUserId;

  const [rows, distinctUploaders] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        uploader: { select: { id: true, name: true } },
      },
    }),
    prisma.document.findMany({
      where: { companyId: session.companyId, uploadedByUserId: { not: null } },
      distinct: ["uploadedByUserId"],
      select: { uploadedByUserId: true },
    }),
  ]);

  const uploaderIds = distinctUploaders
    .map((d) => d.uploadedByUserId)
    .filter((id): id is string => typeof id === "string");

  let uploaders: PublicUploaderFilterOption[] = [];
  if (uploaderIds.length > 0) {
    const [users, recentDocs] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: uploaderIds } },
        select: { id: true, name: true },
      }),
      prisma.document.findMany({
        where: { companyId: session.companyId, uploadedByUserId: { in: uploaderIds } },
        select: { uploadedByUserId: true, uploadedByRole: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const roleByUser = new Map<string, string>();
    for (const d of recentDocs) {
      if (d.uploadedByUserId && !roleByUser.has(d.uploadedByUserId)) {
        roleByUser.set(d.uploadedByUserId, d.uploadedByRole ?? "");
      }
    }
    const userById = new Map(users.map((u) => [u.id, u]));
    uploaders = uploaderIds
      .map((userId) => {
        const u = userById.get(userId);
        const role = roleByUser.get(userId) ?? "";
        return {
          userId,
          name: u?.name?.trim() || "Unknown",
          roleLabel: formatDocumentUploaderRole(role),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return NextResponse.json({
    ok: true as const,
    documents: rows.map(serializeDocument),
    uploaders,
  });
}
