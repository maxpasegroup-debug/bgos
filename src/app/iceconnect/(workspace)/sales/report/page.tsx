import { redirect } from "next/navigation";
import { getAuthUserFromCookies } from "@/lib/auth";
import { IceconnectSalesReportClient } from "@/components/iceconnect/IceconnectSalesReportClient";
import { AccessMismatchError } from "@/components/auth/AccessMismatchError";

export default async function IceconnectSalesReportPage() {
  const user = await getAuthUserFromCookies();
  if (!user) {
    redirect("/iceconnect/login?from=/iceconnect/sales/report");
  }
  if (user.employeeSystem !== "ICECONNECT") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-white">
        <AccessMismatchError />
      </div>
    );
  }
  const r = user.iceconnectEmployeeRole;
  if (r !== "RSM" && r !== "BDM") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-white">
        <AccessMismatchError />
      </div>
    );
  }
  return <IceconnectSalesReportClient />;
}
