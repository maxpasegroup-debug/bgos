import "server-only";

import type { NextResponse } from "next/server";
import type { ApiErrorBody } from "@/lib/api-response";
import {
  internalServerErrorResponse,
  prismaKnownErrorResponse,
} from "@/lib/api-response";
import { createLogger } from "@/lib/logger";

/**
 * Map Prisma / known errors to JSON; otherwise log and return 503.
 */
export function handleApiError(scope: string, err: unknown): NextResponse<ApiErrorBody> {
  const p = prismaKnownErrorResponse(err);
  if (p) return p;
  createLogger(scope).error("Unhandled route error", err);
  return internalServerErrorResponse();
}
