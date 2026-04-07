import process from "node:process";
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx < 1) continue;
    const key = t.slice(0, idx).trim();
    const val = t.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) process.env[key] = val;
  }
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

const required = ["DATABASE_URL", "JWT_SECRET"];
for (const k of required) {
  const v = process.env[k];
  if (!v || !v.trim()) fail(`${k} is missing`);
  else ok(`${k} is set`);
}

const jwt = process.env.JWT_SECRET ?? "";
if (jwt && jwt.length < 32) {
  fail("JWT_SECRET must be at least 32 characters");
} else if (jwt) {
  ok("JWT_SECRET length is strong enough");
}

const db = process.env.DATABASE_URL ?? "";
if (db && !/^postgres(ql)?:\/\//i.test(db)) {
  fail("DATABASE_URL must be a PostgreSQL URL");
} else if (db) {
  ok("DATABASE_URL format looks valid");
}

if (process.exitCode && process.exitCode !== 0) {
  console.error("Preflight failed.");
} else {
  console.log("Preflight passed.");
}
