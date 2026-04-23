import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

function loadEnvFileIntoProcess() {
  if (process.env.DATABASE_URL?.trim()) return;

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const file = readFileSync(envPath, "utf8");
  for (const rawLine of file.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFileIntoProcess();

export default defineConfig({
  schema: "prisma/schema.prisma",
});
