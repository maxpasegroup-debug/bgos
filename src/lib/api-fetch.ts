/**
 * Browser fetch for same-origin `/api/*` — always sends session cookies (httpOnly `token`).
 * Use from Client Components instead of raw `fetch` to avoid missing `credentials: "include"`.
 *
 * On **401**, logs `AUTH ERROR` (optional redirect via `authRedirectOn401`).
 */

export type ApiFetchInit = RequestInit & {
  /** If true, redirect to `/login` when the response status is 401 (browser only). */
  authRedirectOn401?: boolean;
};

export function apiFetch(input: RequestInfo | URL, init?: ApiFetchInit): Promise<Response> {
  const { authRedirectOn401, ...rest } = init ?? {};
  return fetch(input, {
    ...rest,
    credentials: rest.credentials ?? "include",
  }).then((res) => {
    const isAuthMeRequest =
      typeof input === "string"
        ? input.startsWith("/api/auth/me")
        : input instanceof URL
          ? input.pathname.startsWith("/api/auth/me")
          : false;
    if (isAuthMeRequest && typeof window !== "undefined") {
      void res
        .clone()
        .json()
        .then((j: unknown) => {
          const requiresRelogin =
            typeof j === "object" &&
            j !== null &&
            (j as { requiresRelogin?: unknown }).requiresRelogin === true;
          if (requiresRelogin) {
            const here = `${window.location.pathname}${window.location.search}`;
            window.location.assign(`/login?from=${encodeURIComponent(here)}`);
          }
        })
        .catch(() => {
          /* non-JSON body; ignore */
        });
    }
    if (res.status === 401 && typeof window !== "undefined") {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : "(Request)";
      console.warn("AUTH ERROR", { url: urlStr, status: res.status });
      if (authRedirectOn401) {
        const here = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login?from=${encodeURIComponent(here)}`);
      }
    }
    return res;
  });
}

export type FormatFetchFailureMeta = {
  /** HTTP status when the failure is tied to a response */
  status?: number;
  /** API body message (e.g. JSON `error` / `message`) */
  message?: string;
};

const HTTP_STATUS_LABEL: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

function statusLabel(status: number): string | undefined {
  return HTTP_STATUS_LABEL[status];
}

/**
 * User-visible error string: fallback + optional (status) + detail from API, thrown Error, or standard status label.
 *
 * @example formatFetchFailure(err, "Request failed", { status: 401, message: "Session expired" })
 * // "Request failed (401): Session expired"
 * @example formatFetchFailure(null, "Request failed", { status: 401 })
 * // "Request failed (401): Unauthorized"
 */
export function formatFetchFailure(
  err: unknown,
  fallback = "Request failed",
  meta?: FormatFetchFailureMeta,
): string {
  const statusPart = meta?.status != null ? ` (${meta.status})` : "";
  const apiMsg = meta?.message?.trim() ?? "";
  const errMsg = err instanceof Error && err.message.trim() ? err.message.trim() : "";
  const fromStatus =
    meta?.status != null && !apiMsg && !errMsg ? statusLabel(meta.status) : undefined;
  const detail = apiMsg || errMsg || fromStatus;
  if (detail) return `${fallback}${statusPart}: ${detail}`;
  return `${fallback}${statusPart}`;
}

/**
 * Best-effort message + HTTP status for failed API responses (JSON `error` / `message` or body text).
 */
export async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { error?: unknown; message?: unknown; code?: unknown };
    const err =
      (typeof j.error === "string" && j.error.trim()) ||
      (typeof j.message === "string" && j.message.trim()) ||
      (typeof j.code === "string" && j.code.trim());
    if (err) return formatFetchFailure(null, "Request failed", { status: res.status, message: err });
  } catch {
    /* not JSON */
  }
  const trimmed = text.trim();
  if (trimmed.length > 0 && trimmed.length < 200) {
    return formatFetchFailure(null, "Request failed", { status: res.status, message: trimmed });
  }
  return formatFetchFailure(null, fallback, { status: res.status });
}

/**
 * Safe JSON parse for API responses (handles empty/non-JSON bodies).
 */
export async function readApiJson<T = unknown>(
  res: Response,
  context = "api",
): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error("API JSON PARSE ERROR:", { context, status: res.status, body: text, error: e });
    return null;
  }
}
