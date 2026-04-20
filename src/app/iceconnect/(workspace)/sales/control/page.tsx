import { redirect } from "next/navigation";
import { getAuthUserFromCookies } from "@/lib/auth";
import { IceconnectSalesControlClient } from "@/components/iceconnect/IceconnectSalesControlClient";
import { AccessMismatchError } from "@/components/auth/AccessMismatchError";

export default async function IceconnectSalesControlPage() {
  const user = await getAuthUserFromCookies();
  if (!user) {
    redirect("/iceconnect/login?from=/iceconnect/sales/control");
  }
  if (user.employeeSystem !== "ICECONNECT") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-white">
        <AccessMismatchError />
      </div>
    );
  }
  const r = user.iceconnectEmployeeRole;
  if (r !== "RSM" && r !== "BDM" && r !== "BDE") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-white">
        <AccessMismatchError />
      </div>
    );
  }
  return <IceconnectSalesControlClient />;
}
