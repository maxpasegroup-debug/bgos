import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTechRequestStatus, parseTechRequestDescription } from "@/lib/sde-tech-request-payload";

const ALLOWED_ROLES = new Set<UserRole>([UserRole.ADMIN, UserRole.MANAGER]);
const FALLBACK = "Nexa AI briefing unavailable. Check your OpenAI API key.";
const CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = { expiresAt: number; summary: string };
const cache = new Map<string, CacheEntry>();

export async function GET(request: NextRequest) {
  const user = requireAuth(request);
  if (user instanceof NextResponse) return user;
  if (!ALLOWED_ROLES.has(user.role as UserRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!user.companyId) {
    return NextResponse.json({ summary: FALLBACK });
  }

  const cached = cache.get(user.companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ summary: cached.summary, cached: true });
  }

  const [newSignups, activeOnboardings, techRows, bdmCount, sdeCount] = await Promise.all([
    prisma.lead.count({
      where: { companyId: user.companyId, source: "WEBSITE", status: "NEW" },
    }),
    prisma.lead.count({
      where: { companyId: user.companyId, status: { notIn: ["NEW", "LOST", "WON"] } },
    }),
    prisma.techRequest.findMany({
      where: { companyId: user.companyId },
      select: { status: true, description: true },
    }),
    prisma.userCompany.count({
      where: { companyId: user.companyId, jobRole: UserRole.BDM },
    }),
    prisma.userCompany.count({
      where: { companyId: user.companyId, jobRole: { in: [UserRole.TECH_EXECUTIVE, UserRole.TECH_HEAD] } },
    }),
  ]);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let activeBuilds = 0;
  let delivered = 0;
  for (const row of techRows) {
    const status = normalizeTechRequestStatus(row.status);
    if (status !== "DONE") {
      activeBuilds += 1;
      continue;
    }
    const desc = parseTechRequestDescription(row.description);
    const completed = desc.completedAt ? new Date(desc.completedAt) : null;
    if (completed && !Number.isNaN(completed.getTime()) && completed >= monthStart) {
      delivered += 1;
    }
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return NextResponse.json({ summary: FALLBACK });

  const prompt = `You are Nexa, the AI CEO assistant for BGOS.
Generate a brief 3-sentence daily briefing for the boss based on this data:

New signups waiting: ${newSignups}
Active onboardings: ${activeOnboardings}
Builds in progress: ${activeBuilds}
Delivered this month: ${delivered}
BDM team size: ${bdmCount}
SDE team size: ${sdeCount}

Be direct, professional, and actionable.
Focus on what needs attention today.
Format: plain text, no bullet points.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ summary: FALLBACK });
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const summary = json.choices?.[0]?.message?.content?.trim() || FALLBACK;
    cache.set(user.companyId, { summary, expiresAt: Date.now() + CACHE_TTL_MS });
    return NextResponse.json({ summary, cached: false });
  } catch {
    return NextResponse.json({ summary: FALLBACK });
  }
}
