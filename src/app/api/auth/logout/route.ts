import { jsonSuccess } from "@/lib/api-response";
import { clearActiveCompanyCookie, clearSessionCookie } from "@/lib/session-cookie";

/**
 * Clears the HTTP-only session cookie. Safe to call when already logged out.
 */
export async function POST() {
  const res = jsonSuccess({ loggedOut: true });
  clearSessionCookie(res);
  clearActiveCompanyCookie(res);
  return res;
}
