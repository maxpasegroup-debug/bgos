import { CompanyPlan, CompanySubscriptionStatus, EmployeeDomain, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

const user = await prisma.user.findFirst({
  where: { email: "boss@bgos.online" },
});

if (!user) {
  console.log("User not found");
  process.exit(1);
}

let company = await prisma.company.findFirst({
  where: { workspaceDomain: EmployeeDomain.BGOS },
});

if (!company) {
  company = await prisma.company.create({
    data: {
      name: "BGOS Internal",
      ownerId: user.id,
      workspaceDomain: EmployeeDomain.BGOS,
      plan: CompanyPlan.ENTERPRISE,
      subscriptionStatus: CompanySubscriptionStatus.ACTIVE,
      isTrialActive: false,
      internalSalesOrg: true,
    },
  });
  console.log("Created BGOS company:", company.id);
}

const existing = await prisma.userCompany.findFirst({
  where: { userId: user.id, companyId: company.id },
});

if (!existing) {
  await prisma.userCompany.create({
    data: {
      userId: user.id,
      companyId: company.id,
      role: "ADMIN",
      jobRole: UserRole.ADMIN,
      status: "READY",
    },
  });
  console.log("Membership created");
}

await prisma.user.update({
  where: { id: user.id },
  data: { workspaceActivatedAt: new Date() },
});

console.log("Done. boss@bgos.online is now ADMIN of BGOS Internal");
await prisma.$disconnect();
