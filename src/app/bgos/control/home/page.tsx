import { redirect } from "next/navigation";

/** Legacy URL — Nexa Command Center lives at `/bgos/control/v4`. */
export default function ControlHomePage() {
  redirect("/bgos/control/v4");
}
