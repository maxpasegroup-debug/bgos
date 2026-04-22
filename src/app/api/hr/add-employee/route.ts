import bcrypt from "bcrypt";
import { EmployeeDomain, UserRole } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthWithCompany } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PASSWORD = "123456789";

const bodySchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  role: z.enum(["BDM", "TECH_EXECUTIVE", "MANAGER"]),
  displayRole: z.string().trim().min(1),
  department: z.string().trim().optional(),
  joinDate: z.string().trim().optional(),
});

function canManage(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export async function POST(request: NextRequest) {
  const session = await requireAuthWithCompany(request);
  if (session instanceof NextResponse) return session;
  if (!canManage(session.role)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const email = payload.email.toLowerCase();
  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { workspaceDomain: true },
  });
  if (!company) {
    return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });
  }

  let user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!user) {
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        name: payload.name,
        email,
        mobile: payload.phone?.trim() || null,
        password: hashedPassword,
        employeeDomain: company.workspaceDomain === EmployeeDomain.SOLAR ? EmployeeDomain.SOLAR : EmployeeDomain.BGOS,
      },
    });
  }

  const existingMembership = await prisma.userCompany.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: session.companyId } },
  });

  if (!existingMembership) {
    await prisma.userCompany.create({
      data: {
        userId: user.id,
        companyId: session.companyId,
        role: payload.role,
        jobRole: payload.role as UserRole,
        dashboardAssigned: payload.displayRole,
        status: "READY",
      },
    });
  } else {
    await prisma.userCompany.update({
      where: { userId_companyId: { userId: user.id, companyId: session.companyId } },
      data: {
        role: payload.role,
        jobRole: payload.role as UserRole,
        dashboardAssigned: payload.displayRole,
        status: "READY",
        archivedAt: null,
      },
    });
  }

  await prisma.internalInAppNotification.create({
    data: {
      userId: user.id,
      companyId: session.companyId,
      type: "WELCOME",
      title: "Welcome to the team!",
      body: "Your account has been created. Login with your email and password: 123456789. Please change your password after first login.",
    },
  });

  return NextResponse.json({
    success: true,
    employee: { id: user.id, name: user.name, email: user.email, role: payload.role },
    credentials: { email: user.email, defaultPassword: DEFAULT_PASSWORD },
  });
}
