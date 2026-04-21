import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";
import { getRoleHome } from "@/lib/role-routing";

export default async function IceconnectIndexPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) {
    redirect("/login");
  }
  const home = getRoleHome(user.role);
  redirect(home || "/login");
}
