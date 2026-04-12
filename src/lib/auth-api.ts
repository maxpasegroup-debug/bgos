import { NextResponse } from "next/server";
import { EMAIL_ALREADY_IN_USE_MESSAGE } from "@/lib/user-identity-messages";

/** Machine-readable codes for auth failures (API + middleware). */
export const AUTH_ERROR_CODES = {
  NO_TOKEN: "NO_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  /** Preferred code when email is already registered. */
  EMAIL_IN_USE: "EMAIL_IN_USE",
  /** @deprecated Use {@link AUTH_ERROR_CODES.EMAIL_IN_USE}. */
  EMAIL_TAKEN: "EMAIL_TAKEN",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

const MESSAGES: Record<AuthErrorCode, string> = {
  NO_TOKEN: "Authentication required",
  TOKEN_EXPIRED: "Session expired — please sign in again",
  TOKEN_INVALID: "Invalid or expired session",
  INVALID_CREDENTIALS: "Invalid email or password",
  EMAIL_IN_USE: EMAIL_ALREADY_IN_USE_MESSAGE,
  EMAIL_TAKEN: EMAIL_ALREADY_IN_USE_MESSAGE,
};

export function authErrorResponse(
  code: AuthErrorCode,
  status = 401,
): NextResponse {
  return NextResponse.json(
    {
      ok: false as const,
      error: MESSAGES[code],
      code,
    },
    { status },
  );
}
