import { redirect } from "next/navigation";
import { BGOS_BOSS_READY_HOME } from "@/lib/system-readiness";

/** Legacy URL — client boss home is `/bgos/boss/home` (platform uses `/internal/control`). */
export default function ControlHomePage() {
  redirect(BGOS_BOSS_READY_HOME);
}
