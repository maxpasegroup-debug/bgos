/**
 * Client-side helper (import only from Client Components).
 */

export type SalesBoosterClientConfig = {
  onLeadCreated: "assign" | "whatsapp" | "both";
  followUpScheduleEnabled: boolean;
};

function readConfigFromApiJson(j: unknown): SalesBoosterClientConfig | undefined {
  if (!j || typeof j !== "object") return undefined;
  const o = j as { config?: SalesBoosterClientConfig; data?: { config?: SalesBoosterClientConfig } };
  return o.config ?? o.data?.config;
}

export async function fetchSalesBoosterConfig(): Promise<{
  ok: boolean;
  config?: SalesBoosterClientConfig;
  message?: string;
}> {
  const res = await fetch("/api/sales-booster/config", { credentials: "include" });
  const j = (await res.json()) as {
    ok?: boolean;
    message?: string;
    error?: string;
  };
  const config = readConfigFromApiJson(j);
  const msg = typeof j.message === "string" ? j.message : typeof j.error === "string" ? j.error : "";
  return {
    ok: res.ok && j.ok === true && !!config,
    config,
    message: msg,
  };
}

export async function patchSalesBoosterConfig(
  patch: Partial<Pick<SalesBoosterClientConfig, "onLeadCreated" | "followUpScheduleEnabled">>,
): Promise<{ ok: boolean; config?: SalesBoosterClientConfig; message?: string }> {
  const res = await fetch("/api/sales-booster/config", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = (await res.json()) as {
    ok?: boolean;
    message?: string;
    error?: string;
  };
  const config = readConfigFromApiJson(j);
  const msg = typeof j.message === "string" ? j.message : typeof j.error === "string" ? j.error : "";
  return {
    ok: res.ok && j.ok === true && !!config,
    config,
    message: msg,
  };
}

export async function postSalesBoosterUpgradeRequest(note?: string): Promise<{
  ok: boolean;
  message: string;
}> {
  const res = await fetch("/api/sales-booster/upgrade-request", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note ? { note } : {}),
  });
  const j = (await res.json()) as {
    ok?: boolean;
    message?: string;
    error?: string | Record<string, unknown>;
  };
  const msg =
    typeof j.message === "string"
      ? j.message
      : typeof j.error === "string"
        ? j.error
        : "Request could not be sent.";
  return { ok: res.ok && j.ok === true, message: msg };
}
