import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const user = await prisma.user.findFirst({
  where: { email: "boss@bgos.online" },
  include: {
    memberships: {
      include: { company: true },
    },
  },
});

console.log("User found:", JSON.stringify(user, null, 2));
await prisma.$disconnect();
