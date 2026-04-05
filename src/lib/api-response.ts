import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z } from "zod";

export type ApiErrorBody = {
  ok: false;
  error: string;
  code: string;
  details?: unknown;
};

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { ok: false, error: message, code };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

export function zodValidationErrorResponse(error: z.ZodError): NextResponse<ApiErrorBody> {
  return jsonError(400, "VALIDATION_ERROR", "Invalid request", error.flatten());
}

/**
 * Safe JSON body parse for Route Handlers (empty body → 400).
 */
export async function parseJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse<ApiErrorBody> }> {
  try {
    const text = await request.text();
    if (!text.trim()) {
      return { ok: false, response: jsonError(400, "BAD_REQUEST", "Request body is required") };
    }
    const data = JSON.parse(text) as unknown;
    return { ok: true, data };
  } catch {
    return { ok: false, response: jsonError(400, "BAD_REQUEST", "Invalid JSON body") };
  }
}

export function prismaKnownErrorResponse(err: unknown): NextResponse<ApiErrorBody> | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        return jsonError(409, "CONFLICT", "A record with this value already exists");
      case "P2025":
        return jsonError(404, "NOT_FOUND", "Record not found");
      default:
        break;
    }
  }
  return null;
}

export function internalServerErrorResponse(): NextResponse<ApiErrorBody> {
  return jsonError(503, "SERVICE_UNAVAILABLE", "Could not complete the request");
}
