import "server-only";

import { Prisma } from "@prisma/client";

const RETRYABLE_PRISMA_CODES = new Set([
  "P1001",
  "P1002",
  "P1017",
]);

function isRetryablePrismaError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(e.code);
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (e instanceof Prisma.PrismaClientRustPanicError) {
    return true;
  }
  return false;
}

/**
 * Retry transient DB connection errors (cold start, pool timeouts, brief network blips).
 */
export async function withDbRetry<T>(label: string, op: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await op();
    } catch (e) {
      last = e;
      const canRetry = isRetryablePrismaError(e) && i < maxAttempts - 1;
      console.error(`[db-retry:${label}] attempt ${i + 1}/${maxAttempts} failed`, e);
      if (!canRetry) throw e;
      await new Promise((r) => setTimeout(r, 200 * 2 ** i));
    }
  }
  throw last;
}
