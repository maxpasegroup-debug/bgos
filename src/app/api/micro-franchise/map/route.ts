import { NextResponse } from "next/server";
import { requireSuperBossApi } from "@/lib/require-super-boss";
import { prisma } from "@/lib/prisma";

type NotesMeta = { state?: string; country?: string };

function readMeta(notes: unknown): NotesMeta {
  if (!notes || typeof notes !== "object") return {};
  return notes as NotesMeta;
}

export async function GET(request: Request) {
  const session = requireSuperBossApi(request);
  if (session instanceof NextResponse) return session;

  const apps = await prisma.microFranchiseApplication.findMany({
    select: { notes: true, status: true },
  });
  const partners = await prisma.microFranchisePartner.findMany({
    select: {
      id: true,
      application: { select: { notes: true } },
      commissionTransactions: { select: { amount: true } },
      companies: { select: { id: true } },
    },
  });

  const buckets = new Map<string, { state: string; applications: number; live: number; revenue: number; clients: number }>();
  for (const a of apps) {
    const state = (readMeta(a.notes).state ?? "Unknown").trim() || "Unknown";
    if (!buckets.has(state)) {
      buckets.set(state, { state, applications: 0, live: 0, revenue: 0, clients: 0 });
    }
    buckets.get(state)!.applications += 1;
  }
  for (const p of partners) {
    const state = (readMeta(p.application?.notes).state ?? "Unknown").trim() || "Unknown";
    if (!buckets.has(state)) {
      buckets.set(state, { state, applications: 0, live: 0, revenue: 0, clients: 0 });
    }
    const b = buckets.get(state)!;
    b.live += 1;
    b.revenue += p.commissionTransactions.reduce((s, t) => s + t.amount, 0);
    b.clients += p.companies.length;
  }

  const items = [...buckets.values()]
    .map((b) => ({
      ...b,
      revenue: Math.round(b.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.live - a.live);

  return NextResponse.json({ ok: true, items });
}
