import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const count = await prisma.onboardingConversation.count();
  console.log("✅ OnboardingConversation table exists,", count, "records");
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("❌ Table missing:", message);
} finally {
  await prisma.$disconnect();
}
