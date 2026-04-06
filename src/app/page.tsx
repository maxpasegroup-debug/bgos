import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";
import { AUTH_COOKIE_NAME } from "@/lib/auth-config";
import { hostTenantFromHeader } from "@/lib/host-routing";
import { verifyAccessTokenResult } from "@/lib/jwt";

export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  const tenant = hostTenantFromHeader(host);

  if (tenant === "bgos") {
    const jar = await cookies();
    const token = jar.get(AUTH_COOKIE_NAME)?.value?.trim();
    if (token) {
      const verified = verifyAccessTokenResult(token);
      if (verified.ok) {
        redirect("/bgos");
      }
    }
  }

  return <Landing />;
}
