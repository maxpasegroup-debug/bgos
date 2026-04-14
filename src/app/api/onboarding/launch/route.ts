import { UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBodyZod } from "@/lib/api-response";
import { requireAuthWithRoles } from "@/lib/auth";
import {
  credentialsWorkbookBase64,
  generateEmail,
  generatePassword,
  industryToBusinessType,
  industryToPlan,
} from "@/lib/company-launch-engine";
import { publicBgosOrigin, publicIceconnectOrigin } from "@/lib/host-routing";
import { buildOnboardingPlan, mapRoles, parseTeamInput, type NexaMappedMember } from "@/lib/nexa-intelligence";
import { hashPassword } from "@/lib/password";
import { normalizeMicroFranchisePhone } from "@/lib/micro-franchise-phone";
import { prisma } from "@/lib/prisma";
import { companyMembershipClass } from "@/lib/user-company";

const ALLOWED: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.SALES_EXECUTIVE,
  UserRole.TELECALLER,
];

const bodySchema = z.object({
  sessionId: z.string().trim().optional(),
  companyName: z.string().trim().min(1),
  industry: z.enum(["SOLAR", "CUSTOM"]),
  rawTeamInput: z.string().trim().optional(),
  parsedTeam: z.array(
    z.object({
      name: z.string(),
      roleRaw: z.string(),
      department: z.enum(["SALES", "ADMIN", "TECH", "OTHER"]),
      dashboard: z.enum(["SALES_DASHBOARD", "ADMIN_DASHBOARD", "TECH_DASHBOARD", "GENERAL_DASHBOARD"]).optional(),
      userRole: z.nativeEnum(UserRole),
      email: z.string().email().optional(),
    }),
  ).optional(),
  referralPhone: z.string().trim().optional(),
});

function loginUrlForRole(role: UserRole): string {
  if (role === UserRole.ADMIN) return `${publicBgosOrigin()}/login`;
  return `${publicIceconnectOrigin()}/iceconnect/login`;
}

async function uniqueEmail(baseEmail: string): Promise<string> {
  let candidate = baseEmail.toLowerCase();
  let i = 1;
  while (true) {
    const exists = await prisma.user.findFirst({
      where: { email: { equals: candidate, mode: "insensitive" } },
      select: { id: true },
    });
    if (!exists) return candidate;
    const [left, right] = baseEmail.split("@");
    candidate = `${left}.${i}@${right}`;
    i += 1;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthWithRoles(request, ALLOWED);
    if (session instanceof NextResponse) return session;
    const parsed = await parseJsonBodyZod(request, bodySchema);
    if (!parsed.ok) return parsed.response;

    console.log("NEXA INPUT:", parsed.data.rawTeamInput ?? "(parsedTeam provided)");
    const teamFromRaw = parsed.data.rawTeamInput ? mapRoles(parseTeamInput(parsed.data.rawTeamInput)) : [];
    const incomingTeam = parsed.data.parsedTeam && parsed.data.parsedTeam.length > 0 ? parsed.data.parsedTeam : teamFromRaw;
    const team = incomingTeam as NexaMappedMember[];
    console.log("MAPPED:", team);
    const onboardingPlan = buildOnboardingPlan({
      companyName: parsed.data.companyName,
      industry: parsed.data.industry,
      team,
    });

    const bossName = `${parsed.data.companyName.trim()} Boss`;
    const bossEmail = await uniqueEmail(generateEmail(parsed.data.companyName, bossName));
    const bossPassword = generatePassword(parsed.data.companyName, bossName);

    const owner = await prisma.user.create({
      data: {
        name: bossName,
        email: bossEmail,
        password: await hashPassword(bossPassword),
        isActive: true,
        workspaceActivatedAt: new Date(),
        firstLogin: true,
      },
      select: { id: true, name: true, email: true },
    });

    let launchChannelPartnerId: string | null = null;
    let microFranchisePartnerId: string | null = null;
    const referralPhone = parsed.data.referralPhone?.trim() || null;
    const phoneDigits = referralPhone ? normalizeMicroFranchisePhone(referralPhone) : "";
    if (referralPhone && phoneDigits) {
      const mf = await prisma.microFranchisePartner.findUnique({
        where: { phone: phoneDigits },
        select: { id: true },
      });
      if (mf) {
        microFranchisePartnerId = mf.id;
      } else {
        const partner = await prisma.launchChannelPartner.upsert({
          where: { phone: referralPhone },
          create: { phone: referralPhone },
          update: {},
          select: { id: true },
        });
        launchChannelPartnerId = partner.id;
      }
    }

    const company = await prisma.company.create({
      data: {
        name: parsed.data.companyName.trim(),
        ownerId: owner.id,
        industry: parsed.data.industry === "CUSTOM" ? "SOLAR" : "SOLAR",
        businessType: industryToBusinessType(parsed.data.industry),
        plan: industryToPlan(parsed.data.industry),
        referralPhone,
        launchChannelPartnerId,
        microFranchisePartnerId,
      },
      select: { id: true, name: true },
    });

    await prisma.userCompany.create({
      data: {
        userId: owner.id,
        companyId: company.id,
        role: companyMembershipClass(UserRole.ADMIN),
        jobRole: UserRole.ADMIN,
      },
    });

    const credentials: {
      name: string;
      role: string;
      email: string;
      password: string;
      loginUrl: string;
    }[] = [
      {
        name: owner.name,
        role: UserRole.ADMIN,
        email: owner.email,
        password: bossPassword,
        loginUrl: loginUrlForRole(UserRole.ADMIN),
      },
    ];

    for (const member of onboardingPlan.employees) {
      const role = member.userRole;
      const email = await uniqueEmail(member.email || generateEmail(parsed.data.companyName, member.name));
      const plain = generatePassword(parsed.data.companyName, member.name);
      const user = await prisma.user.create({
        data: {
          name: member.name,
          email,
          password: await hashPassword(plain),
          isActive: true,
          workspaceActivatedAt: new Date(),
          firstLogin: true,
        },
        select: { id: true, name: true, email: true },
      });
      await prisma.userCompany.create({
        data: {
          userId: user.id,
          companyId: company.id,
          role: companyMembershipClass(role),
          jobRole: role,
        },
      });
      credentials.push({
        name: user.name,
        role,
        email: user.email,
        password: plain,
        loginUrl: loginUrlForRole(role),
      });
    }

    if (launchChannelPartnerId) {
      await prisma.launchChannelPartner.update({
        where: { id: launchChannelPartnerId },
        data: {
          conversions: { increment: 1 },
        },
      });
    }

    if (onboardingPlan.requiresTech) {
      for (const roleName of onboardingPlan.unknownRoles) {
        await prisma.techRequest.create({
          data: {
            roleName,
            companyId: company.id,
            status: "pending",
            description: `Unknown role from launch: ${roleName}`,
          },
        });
      }
    }

    if (parsed.data.sessionId) {
      await prisma.onboardingSession.updateMany({
        where: { id: parsed.data.sessionId },
        data: { status: "launched" },
      });
    }

    const credentialsFileBase64 = credentialsWorkbookBase64(credentials);
    return NextResponse.json({
      ok: true as const,
      success: true as const,
      companyId: company.id,
      credentials,
      credentialsFile: {
        filename: `${company.name.replace(/\s+/g, "_")}_credentials.xlsx`,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: credentialsFileBase64,
      },
      pipeline: parsed.data.industry === "SOLAR"
        ? ["New", "Intro", "Demo", "Account", "Onboarding", "Live"]
        : [],
      onboardingPlan,
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      {
        ok: false as const,
        success: false as const,
        error: error instanceof Error ? error.message : "Internal server error",
        code: "SERVER_ERROR" as const,
      },
      { status: 500 },
    );
  }
}
