import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = await parseJsonBodyZod(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const row = await prisma.user.findFirst({
      where: { email: { equals: parsed.data.email.trim(), mode: "insensitive" } },
      select: { id: true, name: true, email: true },
    });
    if (!row) return NextResponse.json({ ok: true as const, exists: false as const });
    return NextResponse.json({
      ok: true as const,
      exists: true as const,
      boss: { id: row.id, name: row.name, email: row.email },
    });
  } catch {
    return NextResponse.json(
      { ok: false as const, error: "Could not lookup boss account", code: "SERVER_ERROR" as const },
      { status: 500 },
    );
  }
}
