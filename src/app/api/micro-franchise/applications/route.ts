import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperBossApi } from "@/lib/require-super-boss";

function getMeta(notes: unknown): {
  businessName?: string;
  country?: string;
  state?: string;
  category?: string;
} {
  if (!Array.isArray(notes)) return {};
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    const row = notes[i];
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    if (rec.type !== "meta") continue;
    return {
      businessName: typeof rec.businessName === "string" ? rec.businessName : undefined,
      country: typeof rec.country === "string" ? rec.country : undefined,
      state: typeof rec.state === "string" ? rec.state : undefined,
      category: typeof rec.category === "string" ? rec.category : undefined,
    };
  }
  return {};
}

export async function GET(request: NextRequest) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const q = request.nextUrl.searchParams;
  const status = (q.get("status") || "").trim().toUpperCase();
  const country = (q.get("country") || "").trim().toLowerCase();
  const state = (q.get("state") || "").trim().toLowerCase();
  const category = (q.get("category") || "").trim().toUpperCase();
  const search = (q.get("q") || "").trim().toLowerCase();

  const rows = await prisma.microFranchiseApplication.findMany({
    orderBy: { createdAt: "desc" },
    take: 600,
    include: {
      referredBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      partner: { select: { id: true } },
    },
  });

  const applications = rows
    .map((a) => {
      const meta = getMeta(a.notes);
      return {
        id: a.id,
        businessName: meta.businessName || a.name,
        name: a.name,
        phone: a.phone,
        email: a.email,
        location: a.location,
        country: meta.country || "",
        state: meta.state || "",
        category: meta.category || "SOLAR",
        experience: a.experience,
        status: a.status,
        referredBy: a.referredBy
          ? { id: a.referredBy.id, name: a.referredBy.name, email: a.referredBy.email }
          : null,
        assignedTo: a.assignedTo
          ? { id: a.assignedTo.id, name: a.assignedTo.name, email: a.assignedTo.email }
          : null,
        hasPartner: Boolean(a.partner),
        createdAt: a.createdAt.toISOString(),
        notes: a.notes,
      };
    })
    .filter((a) => (status ? a.status === status : true))
    .filter((a) => (country ? a.country.toLowerCase() === country : true))
    .filter((a) => (state ? a.state.toLowerCase() === state : true))
    .filter((a) => (category ? a.category.toUpperCase() === category : true))
    .filter((a) =>
      search
        ? [a.businessName, a.name, a.phone].some((x) => (x || "").toLowerCase().includes(search))
        : true,
    );

  return NextResponse.json({ ok: true as const, applications });
}
