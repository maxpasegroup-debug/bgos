import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

export async function GET() {
  const jar = await cookies();
  const token = jar.get("token")?.value;

  if (!token) {
    return NextResponse.json({ user: null });
  }

  const data = verifyToken(token);

  return NextResponse.json({ user: data || null });
}
