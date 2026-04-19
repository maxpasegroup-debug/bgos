import { redirect } from "next/navigation";
import { BGOS_BOSS_READY_HOME } from "@/lib/system-readiness";

export default function BgosControlIndexPage() {
  redirect(BGOS_BOSS_READY_HOME);
}
