import { NextResponse } from "next/server";
import { EMAIL_ALREADY_IN_USE_MESSAGE } from "@/lib/user-identity-messages";

/** Machine-readable codes for auth failures (API + middleware). */
export const AUTH_ERROR_CODES = {
  NO_TOKEN: "NO_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  /** Email not found (login only). */
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  /** Password does not match (login only). */
  INVALID_PASSWORD: "INVALID_PASSWORD",
  /** Account exists but is disabled — show “contact admin”, not wrong password. */
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
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
  ACCOUNT_NOT_FOUND: "No account registered with this email.",
  INVALID_PASSWORD: "Incorrect password.",
  ACCOUNT_DISABLED: "Your account is inactive. Contact your administrator.",
  EMAIL_IN_USE: EMAIL_ALREADY_IN_USE_MESSAGE,
  EMAIL_TAKEN: EMAIL_ALREADY_IN_USE_MESSAGE,
};

export function getAuthErrorMessage(code: AuthErrorCode): string {
  return MESSAGES[code];
}

export function authErrorResponse(
  code: AuthErrorCode,
  status = 401,
): NextResponse {
  return NextResponse.json(
    {
      success: false as const,
      ok: false as const,
      error: MESSAGES[code],
      code,
    },
    { status },
  );
}
