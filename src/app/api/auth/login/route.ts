import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    include: {
      memberships: {
        include: { company: { select: { workspaceDomain: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid" }, { status: 401 });
  }

  let valid = false;

  if (user.password.startsWith("$2")) {
    valid = await bcrypt.compare(password, user.password);
  } else {
    valid = password === user.password;
  }

  if (!valid) {
    return NextResponse.json({ error: "Invalid" }, { status: 401 });
  }

  const primaryMembership = user.memberships[0];
  const role = primaryMembership?.jobRole ?? "ADMIN";
  const companyType =
    primaryMembership?.company?.workspaceDomain ?? user.employeeDomain ?? "BGOS";

  const token = signToken({
    userId: user.id,
    role,
    companyType,
  });

  const res = NextResponse.json({ success: true });

  res.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
