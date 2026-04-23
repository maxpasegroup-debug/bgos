import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const user = await prisma.user.findFirst({
  where: { email: "boss@bgos.online" },
  include: {
    memberships: {
      include: {
        company: true,
      },
    },
  },
});

if (!user) {
  console.log("ERROR: User not found");
  process.exit(1);
}

console.log("=== BOSS USER AUDIT ===");
console.log("ID:", user.id);
console.log("Email:", user.email);
console.log("employeeDomain:", user.employeeDomain);
console.log("workspaceActivatedAt:", user.workspaceActivatedAt);
console.log("Password hashed:", user.password?.startsWith("$2"));
console.log("Memberships count:", user.memberships.length);

user.memberships.forEach((m, i) => {
  console.log(`\nMembership ${i + 1}:`);
  console.log("  jobRole:", m.jobRole);
  console.log("  status:", m.status);
  console.log("  company:", m.company?.name);
  console.log("  workspaceDomain:", m.company?.workspaceDomain);
  console.log("  plan:", m.company?.plan);
});

await prisma.$disconnect();
