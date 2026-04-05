import "server-only";
import jwt from "jsonwebtoken";
import { AUTH_JWT_ISSUER } from "./auth-config";
import { getServerEnv } from "./env";

export function requireJwtSecret(): string {
  const secret = getServerEnv().JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
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

export function verifyAccessToken<T extends jwt.JwtPayload = jwt.JwtPayload>(
  token: string,
): T {
  const secret = requireJwtSecret();
  const decoded = jwt.verify(token, secret, {
    issuer: AUTH_JWT_ISSUER,
    algorithms: ["HS256"],
  });
  return decoded as T;
}
