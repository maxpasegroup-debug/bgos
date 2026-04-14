import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL?.trim()) {
  console.warn(
    "[prisma] DATABASE_URL is not set — configure it for PostgreSQL (e.g. in Railway or .env).",
  );
}

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
