import "server-only";

import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const CUSTOMER_AUTH_COOKIE = "bgos_customer_auth";
const CUSTOMER_ISSUER = "bgos.customer";
const CUSTOMER_AUDIENCE = "bgos-customer-portal";

export type CustomerTokenPayload = {
  leadId: string;
  companyId: string;
  mobile: string;
};

function secretBytes(): Uint8Array {
  const s = process.env.JWT_SECRET?.trim();
  if (!s || s.length < 32) throw new Error("JWT secret missing");
  return new TextEncoder().encode(s);
}

export async function signCustomerToken(payload: CustomerTokenPayload): Promise<string> {
  return new SignJWT({
    leadId: payload.leadId,
    companyId: payload.companyId,
    mobile: payload.mobile,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(CUSTOMER_ISSUER)
    .setAudience(CUSTOMER_AUDIENCE)
    .setSubject(payload.leadId)
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(secretBytes());
}

export async function verifyCustomerToken(token: string): Promise<CustomerTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretBytes(), {
      issuer: CUSTOMER_ISSUER,
      audience: CUSTOMER_AUDIENCE,
      algorithms: ["HS256"],
    });
    const leadId = payload.leadId;
    const companyId = payload.companyId;
    const mobile = payload.mobile;
    if (typeof leadId !== "string" || !leadId) return null;
    if (typeof companyId !== "string" || !companyId) return null;
    if (typeof mobile !== "string" || !mobile) return null;
    return { leadId, companyId, mobile };
  } catch {
    return null;
  }
}

export function setCustomerSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(CUSTOMER_AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function clearCustomerSessionCookie(res: NextResponse): void {
  res.cookies.set(CUSTOMER_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCustomerFromCookie(): Promise<CustomerTokenPayload | null> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyCustomerToken(token);
}
