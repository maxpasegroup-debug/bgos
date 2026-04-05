import "server-only";
import jwt from "jsonwebtoken";
import { AUTH_JWT_ISSUER } from "./auth-config";
import { getServerEnv } from "./env";

export function requireJwtSecret(): string {
  const secret = getServerEnv().JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  if (secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
  }
  return secret;
}

export function signAccessToken(
  payload: Record<string, unknown>,
  expiresIn: jwt.SignOptions["expiresIn"] = "7d",
): string {
  const secret = requireJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: AUTH_JWT_ISSUER,
    algorithm: "HS256",
  });
}

export type VerifyTokenFailureCode = "TOKEN_EXPIRED" | "TOKEN_INVALID";

/**
 * Verify JWT and distinguish expiry vs other failures (for `/api/auth/me`, etc.).
 */
export function verifyAccessTokenResult(token: string):
  | { ok: true; payload: jwt.JwtPayload }
  | { ok: false; code: VerifyTokenFailureCode } {
  let secret: string;
  try {
    secret = requireJwtSecret();
  } catch {
    return { ok: false, code: "TOKEN_INVALID" };
  }
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: AUTH_JWT_ISSUER,
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    return { ok: true, payload: decoded };
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) {
      return { ok: false, code: "TOKEN_EXPIRED" };
    }
    return { ok: false, code: "TOKEN_INVALID" };
  }
}

export function verifyAccessToken<T extends jwt.JwtPayload = jwt.JwtPayload>(
  token: string,
): T {
  const r = verifyAccessTokenResult(token);
  if (!r.ok) {
    const err =
      r.code === "TOKEN_EXPIRED" ? new jwt.TokenExpiredError("jwt expired", new Date()) : new jwt.JsonWebTokenError("invalid token");
    throw err;
  }
  return r.payload as T;
}
