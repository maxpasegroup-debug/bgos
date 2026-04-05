import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma instance for Node.js runtime (API routes, Server Actions, seed).
 * Prevents connection exhaustion during Next.js hot reload in development.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
