/**
 * Long-timeout fetch for E2E scripts (avoids UND_ERR_HEADERS_TIMEOUT on cold Next dev / slow DB).
 * Env: E2E_FETCH_CONNECT_MS, E2E_FETCH_HEADERS_MS, E2E_FETCH_BODY_MS (milliseconds).
 */
import { Agent, fetch as undiciFetch } from "undici";

const connectTimeout = Number(process.env.E2E_FETCH_CONNECT_MS ?? 120_000);
const headersTimeout = Number(process.env.E2E_FETCH_HEADERS_MS ?? 600_000);
const bodyTimeout = Number(process.env.E2E_FETCH_BODY_MS ?? 600_000);

export const e2eAgent = new Agent({
  connectTimeout,
  headersTimeout,
  bodyTimeout,
});

export function e2eFetch(input, init = {}) {
  return undiciFetch(input, { ...init, dispatcher: init.dispatcher ?? e2eAgent });
}

/**
 * Poll until `/api/auth/me` responds (200). Use after `npm run dev` while Turbopack warms up.
 * Env: E2E_SERVER_WAIT_MS (default 300000), E2E_SERVER_POLL_MS (default 2000).
 */
export async function waitForDevServer(baseUrl, { path = "/api/auth/me" } = {}) {
  const base = baseUrl.replace(/\/+$/, "");
  const totalMs = Number(process.env.E2E_SERVER_WAIT_MS ?? 300_000);
  const pollMs = Number(process.env.E2E_SERVER_POLL_MS ?? 2_000);
  const deadline = Date.now() + totalMs;
  let lastErr = "";
  while (Date.now() < deadline) {
    try {
      const res = await e2eFetch(`${base}${path}`, { method: "GET" });
      await res.text();
      if (res.status === 200) return;
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e?.cause?.code ? `${e.message} (${e.cause.code})` : e?.message ?? String(e);
    }
    process.stderr.write(`[e2e] waiting for ${base} … ${lastErr}\n`);
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `Dev server not reachable at ${base} within ${totalMs}ms. Run: npm run dev\nLast error: ${lastErr}`,
  );
}
