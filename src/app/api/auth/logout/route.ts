import { NextResponse } from "next/server";
import { clearActiveCompanyCookie, clearSessionCookie } from "@/lib/session-cookie";

export async function POST() {
  const res = NextResponse.json({ ok: true, loggedOut: true });

  res.cookies.set("token", "", {
    path: "/",
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  await clearSessionCookie(res);
  await clearActiveCompanyCookie(res);
  return res;
}
