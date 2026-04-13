/**
 * Domain tenants for production split (Edge + client safe — no Node APIs).
 * `host` should be the raw `Host` header (may include port).
 * Uses exact host or subdomain (avoids `evilbgos.online` matching `bgos.online`).
 */
function hostnameOnly(host: string): string {
  return (host.split(":")[0] ?? "").toLowerCase();
}

export function isBgosOnlineHost(host: string): boolean {
  const h = hostnameOnly(host);
  return h === "bgos.online" || h.endsWith(".bgos.online");
}

export function isIceconnectInHost(host: string): boolean {
  const h = hostnameOnly(host);
  return h === "iceconnect.in" || h.endsWith(".iceconnect.in");
}

export type HostTenant = "bgos" | "ice" | "any";

export function hostTenantFromHeader(hostHeader: string | null): HostTenant {
  const host = hostHeader ?? "";
  if (isBgosOnlineHost(host)) return "bgos";
  if (isIceconnectInHost(host)) return "ice";
  return "any";
}

export const DEFAULT_BGOS_ORIGIN = "https://bgos.online";
export const DEFAULT_ICECONNECT_ORIGIN = "https://iceconnect.in";

export function publicBgosOrigin(): string {
  const u =
    process.env.NEXT_PUBLIC_BGOS_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  return u && u.length > 0 ? u.replace(/\/+$/, "") : DEFAULT_BGOS_ORIGIN;
}

export function publicIceconnectOrigin(): string {
  const u =
    process.env.NEXT_PUBLIC_ICECONNECT_URL?.trim() ||
    process.env.ICECONNECT_URL?.trim();
  return u && u.length > 0 ? u.replace(/\/+$/, "") : DEFAULT_ICECONNECT_ORIGIN;
}

/**
 * Role home paths are relative: on production split hosts, `/iceconnect/*` must open on ICECONNECT
 * and `/bgos` on BGOS — never the wrong origin (avoids infinite redirect loops).
 */
export function absoluteRoleHomeUrl(
  tenant: HostTenant,
  homePath: string,
  requestUrl: string,
): URL {
  if (tenant === "bgos" && (homePath === "/iceconnect" || homePath.startsWith("/iceconnect/"))) {
    return new URL(homePath, publicIceconnectOrigin());
  }
  if (tenant === "ice" && (homePath === "/bgos" || homePath.startsWith("/bgos/"))) {
    return new URL(homePath, publicBgosOrigin());
  }
  return new URL(homePath, requestUrl);
}
