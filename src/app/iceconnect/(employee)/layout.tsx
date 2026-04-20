import { redirect } from "next/navigation";
import { getAuthUserFromHeaders } from "@/lib/auth";

/**
 * ICECONNECT workforce routes (mobile shell) — session required.
 * Fine-grained access: middleware + {@link User.employeeSystem} on JWT.
 */
export default async function IceconnectEmployeeGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUserFromHeaders();
  if (!user) {
    redirect("/iceconnect/login");
  }
  return <>{children}</>;
}
