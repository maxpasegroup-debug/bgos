import { redirect } from "next/navigation";
import { publicBgosOrigin } from "@/lib/host-routing";

/** Sales-led boss onboarding runs only on BGOS (Nexa). */
export default function IceconnectOnboardingRedirectPage() {
  redirect(new URL("/onboarding/nexa?source=sales", publicBgosOrigin()).toString());
}
