import "server-only";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

/** IP → timestamps (ms) of login POSTs in the sliding window */
const attemptsByIp = new Map<string, number[]>();

function pruneStale(ip: string, now: number): number[] {
  const list = attemptsByIp.get(ip) ?? [];
  const recent = list.filter((t) => now - t < WINDOW_MS);
  if (recent.length === 0) attemptsByIp.delete(ip);
  else attemptsByIp.set(ip, recent);
  return recent;
}

/**
 * Client IP for rate limiting (trust proxy headers set by your host).
 */
export function getClientIpForRateLimit(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "unknown";
}

export type LoginRateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/**
 * Sliding window: max {@link MAX_ATTEMPTS} login POSTs per {@link WINDOW_MS} per IP.
 * Call once per request before processing credentials.
 */
export function checkLoginRateLimit(ip: string): LoginRateLimitResult {
  const now = Date.now();
  const recent = pruneStale(ip, now);

  if (recent.length >= MAX_ATTEMPTS) {
    const oldest = recent[0]!;
    const retryAfterMs = Math.max(0, WINDOW_MS - (now - oldest));
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recent.push(now);
  attemptsByIp.set(ip, recent);
  return { ok: true };
}
