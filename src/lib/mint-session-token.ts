import "server-only";

import { signAccessToken } from "@/lib/jwt";
import { loadMembershipsForJwt } from "@/lib/memberships-for-jwt";
import { prisma } from "@/lib/prisma";

export type MintSessionTokenErrorCode = "NO_USER" | "NO_MEMBERSHIP";

export class MintSessionTokenError extends Error {
  readonly code: MintSessionTokenErrorCode;

  constructor(code: MintSessionTokenErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

/**
 * Issue a JWT whose `memberships[].plan` values are loaded from {@link Company.plan}
 * (subscription is per company). Top-level `companyId` / `companyPlan` / `role` match
 * the active company row.
 */
export async function mintSessionAccessToken(input: {
  userId: string;
  email: string;
  activeCompanyId: string;
}): Promise<string> {
  const [mems, user] = await Promise.all([
    loadMembershipsForJwt(input.userId),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { workspaceActivatedAt: true },
    }),
  ]);

  if (!user) {
    throw new MintSessionTokenError("NO_USER");
  }

  const row = mems.find((m) => m.companyId === input.activeCompanyId);
  if (!row) {
    throw new MintSessionTokenError("NO_MEMBERSHIP");
  }

  const workspaceReady = Boolean(user.workspaceActivatedAt);

  return signAccessToken({
    sub: input.userId,
    email: input.email,
    role: row.jobRole,
    companyId: row.companyId,
    companyPlan: row.plan,
    workspaceReady,
    memberships: mems,
  });
}
