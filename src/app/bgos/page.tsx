import { redirect } from "next/navigation";

/** Single entry for the command-center UI — avoids duplicate mounts at `/bgos` vs `/bgos/dashboard`. */
export default function BgosHomePage() {
  redirect("/bgos/dashboard");
}
