import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { SdeDashboard } from "@/components/iceconnect/SdeDashboard";

const ALLOWED_ROLES = new Set(["TECH_EXECUTIVE", "TECH_HEAD", "ADMIN"]);

export default async function SdePage() {
  const user = await getAuthUserFromHeaders();
  if (!user) {
    redirect("/login");
  }
  if (!ALLOWED_ROLES.has(user.role)) {
    redirect("/login");
  }
  return <SdeDashboard user={user} />;
}
