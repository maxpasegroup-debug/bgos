import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";
import { ACTIVE_COMPANY_COOKIE_NAME, AUTH_COOKIE_NAME } from "@/lib/auth-config";
import { hostTenantFromHeader } from "@/lib/host-routing";
import { verifyAccessTokenResult } from "@/lib/jwt";
import { getRoleHome, SUPER_BOSS_HOME_PATH } from "@/lib/role-routing";
import { isSuperBossEmail } from "@/lib/super-boss";
import { BGOS_ONBOARDING_ENTRY, isSystemReadyFromJwtPayload } from "@/lib/system-readiness";

export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  const tenant = hostTenantFromHeader(host);

  if (tenant === "bgos") {
    const jar = await cookies();
    const token = jar.get(AUTH_COOKIE_NAME)?.value?.trim();
    if (token) {
      const verified = verifyAccessTokenResult(token);
      if (verified.ok) {
        const p = verified.payload as Record<string, unknown>;
        const em = typeof p.email === "string" ? p.email : "";
        const role = typeof p.role === "string" ? p.role : "";
        if (isSuperBossEmail(em)) {
          redirect(SUPER_BOSS_HOME_PATH);
        }
        const activeCo = jar.get(ACTIVE_COMPANY_COOKIE_NAME)?.value;
        if (isSystemReadyFromJwtPayload(p, activeCo ?? undefined)) {
          redirect(getRoleHome(role));
        }
        redirect(BGOS_ONBOARDING_ENTRY);
      }
    }
  }

  return <Landing />;
}
