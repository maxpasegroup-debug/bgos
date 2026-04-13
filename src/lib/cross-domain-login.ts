import { postLoginDestination } from "@/lib/role-routing";
import {
  isBgosOnlineHost,
  publicIceconnectOrigin,
} from "@/lib/host-routing";

const FIELD_ROLES = new Set([
  "SALES_HEAD",
  "SALES_EXECUTIVE",
  "TELECALLER",
  "TECH_HEAD",
  "TECH_EXECUTIVE",
  "CHANNEL_PARTNER",
  "OPERATIONS_HEAD",
  "SITE_ENGINEER",
  "PRO",
  "INSTALLATION_TEAM",
  "INVENTORY_MANAGER",
  "ACCOUNTANT",
  "LCO",
  "HR_MANAGER",
  "SERVICE_TEAM",
]);

export type AfterLoginNavigation =
  | { kind: "internal"; path: string }
  | { kind: "external"; url: string };

/**
 * After JWT is set on the current host: if the user's home app is on the other
 * production domain, send them there (cookie is host-specific — they sign in again).
 */
export function resolveAfterLoginNavigation(input: {
  role: string;
  from: string | null;
  hostname: string;
}): AfterLoginNavigation {
  const path = postLoginDestination(input.role, input.from);

  if (isBgosOnlineHost(input.hostname) && FIELD_ROLES.has(input.role)) {
    const base = publicIceconnectOrigin();
    const q = new URLSearchParams();
    if (input.from) q.set("from", input.from);
    q.set("hostHint", "ice");
    const qs = q.toString();
    return { kind: "external", url: `${base}/iceconnect/login${qs ? `?${qs}` : ""}` };
  }

  return { kind: "internal", path };
}
