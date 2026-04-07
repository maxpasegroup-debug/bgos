import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { serializeDocument } from "@/lib/document-serialize";
import { documentTypeSchema } from "@/lib/document-types";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  leadId: z.string().cuid().optional(),
  type: documentTypeSchema.optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;

  const sp = request.nextUrl.searchParams;
  const rawLead = sp.get("leadId")?.trim();
  const rawType = sp.get("type")?.trim();

  const parsed = querySchema.safeParse({
    leadId: rawLead && rawLead.length > 0 ? rawLead : undefined,
    type: rawType && rawType.length > 0 ? rawType : undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false as const, error: "Invalid filters", code: "VALIDATION" as const },
      { status: 400 },
    );
  }

  const where: { companyId: string; leadId?: string; type?: string } = {
    companyId: session.companyId,
  };
  if (parsed.data.leadId) where.leadId = parsed.data.leadId;
  if (parsed.data.type) where.type = parsed.data.type;

  const rows = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    ok: true as const,
    documents: rows.map(serializeDocument),
  });
}
