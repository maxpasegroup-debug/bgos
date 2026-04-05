import { getAuthUserFromHeaders } from "@/lib/auth";
import { getRoleHome } from "@/lib/role-routing";
import { redirect } from "next/navigation";

/** Fallback if middleware layout chain ever renders without a prior redirect. */
export default async function IceconnectRootPage() {
  const user = await getAuthUserFromHeaders();
  if (!user) redirect("/iceconnect/login?from=/iceconnect");
  redirect(getRoleHome(user.role));
}
