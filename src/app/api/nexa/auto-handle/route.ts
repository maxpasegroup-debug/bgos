import { NextResponse } from "next/server";
import { jsonSuccess } from "@/lib/api-response";
import { requireAuthWithCompany } from "@/lib/auth";
import { runNexaAutoActions } from "@/lib/nexa-engine";
import { handleApiError } from "@/lib/route-error";

export async function POST(request: Request) {
  const user = await requireAuthWithCompany(request);
  if (user instanceof NextResponse) return user;

  try {
    const created = await runNexaAutoActions(user.companyId, user.sub);
    return jsonSuccess({ created });
  } catch (e) {
    return handleApiError("POST /api/nexa/auto-handle", e);
  }
}
