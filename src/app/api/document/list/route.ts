import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { getLeadIdsAssignedToUser, resolveDocumentVaultScope } from "@/lib/document-access-control";
import { formatDocumentUploaderRole } from "@/lib/document-role-label";
import {
  type PublicUploaderFilterOption,
  serializeDocument,
} from "@/lib/document-serialize";
import { documentTypeSchema } from "@/lib/document-types";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  leadId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  type: documentTypeSchema.optional(),
  uploadedByUserId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const sp = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    leadId: sp.get("leadId")?.trim() || undefined,
    customerId: sp.get("customerId")?.trim() || undefined,
    type: sp.get("type")?.trim() || undefined,
    uploadedByUserId: sp.get("uploadedByUserId")?.trim() || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid filters", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const vaultScope = await resolveDocumentVaultScope(session);
  const filters: Record<string, unknown> = {};

  if (parsed.data.leadId) filters.leadId = parsed.data.leadId;
  if (parsed.data.customerId) filters.customerId = parsed.data.customerId;
  if (parsed.data.type) filters.type = parsed.data.type;
  if (parsed.data.uploadedByUserId) filters.uploadedByUserId = parsed.data.uploadedByUserId;

  let employeeAccess: Prisma.DocumentWhereInput | undefined;

  if (vaultScope === "mine") {
    const assignedLeadIds = await getLeadIdsAssignedToUser(session.companyId, session.sub);
    const assignedSet = new Set(assignedLeadIds);

    if (parsed.data.leadId && !assignedSet.has(parsed.data.leadId)) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "You can only view documents for leads assigned to you.",
          code: "FORBIDDEN" as const,
        },
        { status: 403 },
      );
    }
    if (parsed.data.customerId && !assignedSet.has(parsed.data.customerId)) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "You can only view documents for customers linked to your leads.",
          code: "FORBIDDEN" as const,
        },
        { status: 403 },
      );
    }
    if (
      parsed.data.uploadedByUserId &&
      parsed.data.uploadedByUserId !== session.sub
    ) {
      return NextResponse.json(
        {
          ok: false as const,
          error: "You cannot filter by another team member's uploads.",
          code: "FORBIDDEN" as const,
        },
        { status: 403 },
      );
    }

    const or: Prisma.DocumentWhereInput[] = [{ uploadedByUserId: session.sub }];
    if (assignedLeadIds.length > 0) {
      or.push({ leadId: { in: assignedLeadIds } });
      or.push({ customerId: { in: assignedLeadIds } } as Prisma.DocumentWhereInput);
    }
    employeeAccess = { OR: or };
  }

  const filterInput =
    Object.keys(filters).length > 0 ? (filters as Prisma.DocumentWhereInput) : null;

  const where: Prisma.DocumentWhereInput =
    vaultScope === "all"
      ? { companyId: session.companyId, ...(filterInput ?? {}) }
      : {
          companyId: session.companyId,
          AND: [
            employeeAccess as Prisma.DocumentWhereInput,
            ...(filterInput ? [filterInput] : []),
          ],
        };

  const uploadersWhereBase: Prisma.DocumentWhereInput =
    vaultScope === "all"
      ? { companyId: session.companyId, uploadedByUserId: { not: null } }
      : where;

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
      where: uploadersWhereBase,
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
        where: {
          AND: [
            uploadersWhereBase,
            { uploadedByUserId: { in: uploaderIds } },
          ],
        },
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
    vaultScope,
    documents: rows.map(serializeDocument),
    uploaders,
  });
}
