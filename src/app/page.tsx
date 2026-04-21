import { headers } from "next/headers";
import { LandingRouter } from "@/components/landing/LandingRouter";
import { IceconnectLanding } from "@/components/iceconnect/IceconnectLanding";
import { isIceconnectInHost } from "@/lib/host-routing";

export default async function HomePage() {
  const host = (await headers()).get("host") ?? "";
  if (isIceconnectInHost(host)) {
    return <IceconnectLanding />;
  }

  return <LandingRouter />;
}
