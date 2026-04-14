import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_READ: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
  UserRole.TECH_HEAD,
  UserRole.TECH_EXECUTIVE,
];

const bodySchema = z.object({
  roleName: z.string().trim().min(1),
  description: z.string().trim().optional(),
  companyId: z.string().trim().optional(),
});

const patchSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(["pending", "in_progress", "done"]),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthWithRoles(request, ALLOWED_READ);
    if (session instanceof NextResponse) return session;
    const rows = await prisma.techRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        roleName: true,
        description: true,
        companyId: true,
        status: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    });
    return NextResponse.json({
      ok: true as const,
      requests: rows.map((r) => ({
        ...r,
        companyName: r.company?.name ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      { ok: false as const, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthWithRoles(request, ALLOWED_READ);
    if (session instanceof NextResponse) return session;
    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const row = await prisma.techRequest.create({
      data: {
        roleName: parsed.data.roleName,
        description: parsed.data.description?.trim() || null,
        companyId: parsed.data.companyId?.trim() || null,
        status: "pending",
      },
      select: { id: true, roleName: true, status: true, createdAt: true },
    });
    return NextResponse.json({ ok: true as const, request: { ...row, createdAt: row.createdAt.toISOString() } });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      { ok: false as const, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuthWithRoles(request, [
      UserRole.ADMIN,
      UserRole.MANAGER,
      UserRole.TECH_HEAD,
      UserRole.TECH_EXECUTIVE,
    ]);
    if (session instanceof NextResponse) return session;
    const parsed = await parseJsonBodyZod(request, patchSchema);
    if (!parsed.ok) return parsed.response;
    const row = await prisma.techRequest.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
      select: { id: true, status: true },
    });
    return NextResponse.json({ ok: true as const, request: row });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      { ok: false as const, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
