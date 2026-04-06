import type { NextRequest } from "next/server";
import { switchActiveCompanyPost } from "@/lib/company-switch";

/** Switch active business context (validates membership, sets `activeCompanyId` cookie). */
export async function POST(request: NextRequest) {
  return switchActiveCompanyPost(request);
}
