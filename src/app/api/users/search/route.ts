import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const q = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ success: true as const, data: [] as unknown[] });
  }

  try {
    const users = await prisma.user.findMany({
      where: { email: { contains: q, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        email: true,
        memberships: {
          select: {
            company: { select: { name: true } },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      success: true as const,
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        company: u.memberships[0]?.company?.name ?? null,
      })),
    });
  } catch (error) {
    console.error("GET /api/users/search", error);
    return NextResponse.json(
      { success: false as const, message: "Failed to search users" },
      { status: 500 },
    );
  }
}
