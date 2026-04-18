import { redirect } from "next/navigation";

/** Legacy URL — omnichannel hub lives at `/sales-booster`. */
export default function SalesBoosterDashboardRedirectPage() {
  redirect("/sales-booster");
}
