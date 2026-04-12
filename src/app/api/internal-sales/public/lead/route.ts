import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-response";

/**
 * Public lead capture is disabled: internal CRM leads are created only by authenticated sales users.
 */
export async function POST(_request: NextRequest) {
  return jsonError(
    403,
    "PUBLIC_CAPTURE_DISABLED",
    "Leads are created by the internal sales team only. Public onboarding and anonymous capture are disabled.",
  );
}
