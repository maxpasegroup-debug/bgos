import { NextResponse } from "next/server";

/** Machine-readable codes for auth failures (API + middleware). */
export const AUTH_ERROR_CODES = {
  NO_TOKEN: "NO_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  EMAIL_TAKEN: "EMAIL_TAKEN",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

const MESSAGES: Record<AuthErrorCode, string> = {
  NO_TOKEN: "Authentication required",
  TOKEN_EXPIRED: "Session expired — please sign in again",
  TOKEN_INVALID: "Invalid or expired session",
  INVALID_CREDENTIALS: "Invalid email or password",
  EMAIL_TAKEN: "An account with this email already exists",
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
