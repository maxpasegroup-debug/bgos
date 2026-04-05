import "server-only";
import { z } from "zod";

/**
 * Validated server-side environment variables.
 * Import only from Server Components, Route Handlers, or server utilities.
 */
const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .optional()
      .default("development"),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required (PostgreSQL connection string)"),
    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET must be at least 32 characters when set")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && !data.JWT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET is required in production (min 32 characters, strong random value)",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  cached = serverEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET?.trim() || undefined,
  });
  return cached;
}
