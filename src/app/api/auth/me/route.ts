import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMeSessionFromToken, verifyToken } from "@/lib/auth";

export async function GET() {
  const jar = await cookies();
  const token = jar.get("token")?.value;

  if (!token) {
    return NextResponse.json({ user: null });
  }

  const result = getMeSessionFromToken(token);

  if (result.status === "none") {
    return NextResponse.json({ user: null });
  }

  if (result.status === "expired") {
    return NextResponse.json({
      user: null,
      requiresRelogin: true,
      reason: "session_expired" as const,
    });
  }

  if (result.status === "invalid") {
    const decoded = verifyToken(token);
    const version =
      decoded && typeof decoded === "object"
        ? (decoded as { jwtVersion?: unknown }).jwtVersion
        : undefined;
    if (typeof version !== "number" || version < 2) {
      return NextResponse.json({
        user: null,
        requiresRelogin: true,
        reason: "old_session" as const,
      });
    }
    return NextResponse.json({
      user: null,
      requiresRelogin: true,
      reason: "session_invalid" as const,
    });
  }

  return NextResponse.json({ user: result.user });
}
