/**
 * Client-side helper (import only from Client Components).
 */
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
