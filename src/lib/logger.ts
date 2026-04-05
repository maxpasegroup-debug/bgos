import "server-only";

type LogMeta = Record<string, unknown> | undefined;

function redactMeta(meta: LogMeta): LogMeta {
  if (!meta) return meta;
  const keys = new Set(["password", "token", "authorization", "cookie", "set-cookie"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = keys.has(k.toLowerCase()) ? "[redacted]" : v;
  }
  return out;
}

function formatError(err: unknown): Record<string, string> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message };
  }
  return { message: String(err) };
}

/**
 * Structured server logging (Route Handlers, lib). Avoids logging secrets in `meta` keys.
 */
export function createLogger(scope: string) {
  const prefix = `[${scope}]`;
  return {
    debug: (msg: string, meta?: LogMeta) => {
      if (process.env.NODE_ENV === "development") {
        console.debug(prefix, msg, redactMeta(meta) ?? "");
      }
    },
    info: (msg: string, meta?: LogMeta) => {
      console.info(prefix, msg, redactMeta(meta) ?? "");
    },
    warn: (msg: string, meta?: LogMeta) => {
      console.warn(prefix, msg, redactMeta(meta) ?? "");
    },
    error: (msg: string, err?: unknown, meta?: LogMeta) => {
      console.error(prefix, msg, err !== undefined ? formatError(err) : "", redactMeta(meta) ?? "");
    },
  };
}
