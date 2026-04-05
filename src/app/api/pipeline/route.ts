import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prismaKnownErrorResponse } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/route-error";
import { getPipelineStages } from "@/lib/dashboard-pipeline";

/** @deprecated Prefer `GET /api/dashboard` which includes `pipeline`. */
export async function GET(request: NextRequest) {
  const session = requireAuth(request);
  if (session instanceof NextResponse) return session;

  try {
    const pipeline = await getPipelineStages(session.companyId);
    return NextResponse.json(pipeline);
  } catch (e) {
    const p = prismaKnownErrorResponse(e);
    if (p) return p;
    return handleApiError("GET /api/pipeline", e);
  }
}
