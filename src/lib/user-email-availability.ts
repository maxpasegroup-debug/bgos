import "server-only";

import type { Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { EMAIL_ALREADY_IN_USE_MESSAGE } from "@/lib/user-identity-messages";

/**
 * Case-insensitive check against {@link User.email} (unique in DB).
 */
export async function isUserEmailAlreadyRegistered(normalizedEmail: string): Promise<boolean> {
  const e = normalizedEmail.trim().toLowerCase();
  if (!e) return false;
  const row = await prisma.user.findFirst({
    where: { email: { equals: e, mode: "insensitive" } },
    select: { id: true },
  });
  return row != null;
}

/** Map Prisma unique constraint on `User` to a stable API error (email or mobile). */
export function jsonErrorForUserUniqueViolation(
  e: Prisma.PrismaClientKnownRequestError,
): ReturnType<typeof jsonError> | null {
  if (e.code !== "P2002") return null;
  const raw = e.meta?.target;
  const target = Array.isArray(raw) ? raw.map(String) : raw != null ? [String(raw)] : [];
  if (target.includes("email")) {
    return jsonError(409, "EMAIL_IN_USE", EMAIL_ALREADY_IN_USE_MESSAGE);
  }
  if (target.includes("mobile")) {
    return jsonError(
      409,
      "DUPLICATE_MOBILE",
      "That mobile number is already registered. Use another number or leave blank.",
    );
  }
  return null;
}
