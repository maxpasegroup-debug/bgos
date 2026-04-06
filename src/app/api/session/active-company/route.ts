import type { NextRequest } from "next/server";
import { switchActiveCompanyPost } from "@/lib/company-switch";

/** @deprecated Prefer `POST /api/company/switch` */
export async function POST(request: NextRequest) {
  return switchActiveCompanyPost(request);
}
