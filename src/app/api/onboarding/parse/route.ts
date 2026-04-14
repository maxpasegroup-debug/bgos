import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import {
  buildOnboardingPlan,
  detectUnknownRoles,
  mapRoles,
  parseTeamInput,
  suggestMissingRoles,
} from "@/lib/nexa-intelligence";
import {
  generateOnboardingSummary,
  generateTechContext,
  parseTeamWithAI,
  suggestOrgImprovements,
} from "@/lib/nexa-ai";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  sessionId: z.string().trim().min(1),
  rawTeamInput: z.string().trim().min(1),
});

const ALLOWED: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
];

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthWithRoles(request, ALLOWED);
    if (session instanceof NextResponse) return session;
    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    console.log("NEXA INPUT:", parsed.data.rawTeamInput);
    let mappedMembers = [];
    try {
      mappedMembers = await parseTeamWithAI(parsed.data.rawTeamInput);
    } catch {
      const parsedMembers = parseTeamInput(parsed.data.rawTeamInput);
      console.log("PARSED:", parsedMembers);
      mappedMembers = mapRoles(parsedMembers);
    }
    console.log("MAPPED:", mappedMembers);
    const unknownRoles = detectUnknownRoles(mappedMembers);
    const plan = buildOnboardingPlan({
      companyName: "Session Company",
      industry: "SOLAR",
      team: mappedMembers,
    });
    const aiSummary = await generateOnboardingSummary({
      company: { name: "Session Company", industry: "SOLAR" },
      team: mappedMembers,
    }).catch(() => "");
    const aiSuggestions = await suggestOrgImprovements({ team: mappedMembers }).catch(() =>
      suggestMissingRoles(mappedMembers),
    );
    const techContext = await generateTechContext({
      company: { name: "Session Company", industry: "SOLAR" },
      unknownRoles,
      team: mappedMembers,
    }).catch(() => "");
    const row = await prisma.onboardingSession.update({
      where: { id: parsed.data.sessionId },
      data: {
        rawTeamInput: parsed.data.rawTeamInput,
        parsedTeam: mappedMembers,
        unknownRoles,
        status: "ready",
      },
      select: { id: true },
    });
    return NextResponse.json({
      ok: true as const,
      sessionId: row.id,
      parsedTeam: mappedMembers,
      unknownRoles,
      aiSummary,
      techContext,
      suggestions: aiSuggestions.length > 0 ? aiSuggestions : plan.suggestions,
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      {
        ok: false as const,
        error: error instanceof Error ? error.message : "Internal server error",
        code: "SERVER_ERROR" as const,
      },
      { status: 500 },
    );
  }
}
