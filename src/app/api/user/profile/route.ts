import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ProfilePayload = {
  displayName: string;
  email: string;
  companyName: string | null;
  companyId: string | null;
  avatarInitials: string;
};

function capitalizeFirst(v: string): string {
  const t = v.trim();
  if (!t) return "";
  return t[0].toUpperCase() + t.slice(1);
}

function emailLocalPart(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.trim();
}

function buildAvatarInitials(displayName: string): string {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  const raw = (parts[0] ?? "").slice(0, 2).toUpperCase();
  return raw || "U";
}

export async function GET(request: NextRequest) {
  const session = getAuthUser(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      name: true,
      email: true,
      memberships: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          companyId: true,
          company: { select: { name: true } },
        },
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fallbackLocal = emailLocalPart(profile.email);
  const fromName = profile.name?.trim() ?? "";
  const baseDisplayName = fromName || fallbackLocal;
  const displayName = capitalizeFirst(baseDisplayName) || "User";

  const preferredMembership =
    profile.memberships.find((m) => m.companyId === session.companyId) ?? profile.memberships[0];
  const companyId = session.companyId ?? preferredMembership?.companyId ?? null;
  const companyName = preferredMembership?.company.name?.trim() || companyId || null;

  const body: ProfilePayload = {
    displayName,
    email: profile.email,
    companyName,
    companyId,
    avatarInitials: buildAvatarInitials(displayName),
  };

  const res = NextResponse.json(body);
  res.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=60");
  return res;
}
