import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { z, ZodTypeAny } from "zod";

export type ApiSuccessBody<T> = {
  success: true;
  ok: true;
  data: T;
};

export type ApiErrorBody = {
  success: false;
  ok: false;
  message: string;
  error: string;
  code: string;
  details?: unknown;
};

export function jsonSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessBody<T>> {
  const expanded = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return NextResponse.json({ success: true, ok: true, data, ...expanded }, { status });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = { success: false, ok: false, message, error: message, code };
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

/** Structured server logging for route handlers (never swallow errors silently). */
export function logCaughtError(scope: string, error: unknown): void {
  console.error(`ERROR:${scope}`, error);
}

/** JSON error body with `success: false`, user-facing `error`, and `details` from the caught value. */
export function jsonCaughtError(
  scope: string,
  error: unknown,
  status = 500,
  publicMessage = "Something failed",
): NextResponse<ApiErrorBody> {
  logCaughtError(scope, error);
  const details = error instanceof Error ? error.message : String(error);
  return jsonError(status, "SERVER_ERROR", publicMessage, details);
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
  } catch (e) {
    console.error("[api] Invalid JSON body", e);
    return { ok: false, response: jsonError(400, "BAD_REQUEST", "Invalid JSON body") };
  }
}

/** Empty body → `{}` (for optional JSON payloads). */
export async function parseJsonBodyOptional(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse<ApiErrorBody> }> {
  try {
    const text = await request.text();
    if (!text.trim()) {
      return { ok: true, data: {} };
    }
    const data = JSON.parse(text) as unknown;
    return { ok: true, data };
  } catch (e) {
    console.error("[api] Invalid JSON body (optional)", e);
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

/**
 * Parse JSON body then validate with Zod (empty body → 400).
 */
export async function parseJsonBodyZod<T extends ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: NextResponse<ApiErrorBody> }
> {
  const raw = await parseJsonBody(request);
  if (!raw.ok) return raw;
  const parsed = schema.safeParse(raw.data);
  if (!parsed.success) {
    return { ok: false, response: zodValidationErrorResponse(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}
