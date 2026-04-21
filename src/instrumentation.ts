/**
 * Runtime startup preflight. Build can still succeed without secrets,
 * but production runtime must fail fast when JWT secret is misconfigured.
 */
export async function register() {
  const jwtSecret = process.env.JWT_SECRET?.trim() ?? "";
  if (process.env.NODE_ENV === "production") {
    if (jwtSecret.length < 32) {
      throw new Error(
        "[bgos] FATAL: JWT_SECRET is required in production (min 32 chars). Set it in Railway environment variables.",
      );
    }
    return;
  }
  if (!jwtSecret) {
    console.warn(
      "[bgos] JWT_SECRET is not set. Set it in the deployment environment or login will fail.",
    );
  }
}
