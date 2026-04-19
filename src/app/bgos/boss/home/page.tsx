import { CommandCenterV4Client } from "@/components/bgos/v4/CommandCenterV4Client";

export const dynamic = "force-dynamic";

/** Client company boss home — tenant workspace (not `/internal/*`). */
export default function BgosBossHomePage() {
  return <CommandCenterV4Client variant="client" />;
}
