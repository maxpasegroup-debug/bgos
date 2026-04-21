/**
 * Server-side commission accrual check (run from repo root: npx tsx scripts/e2e-mf-accrue-commission.ts).
 * Env: E2E_MF_COMPANY_ID (required), E2E_MF_PAYMENT_REF (optional), E2E_MF_AMOUNT_PAISE (default 1200000).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx < 1) continue;
    const key = t.slice(0, idx).trim();
    if (!key) continue;
    const val = t.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  const baseUrl = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const companyId = process.env.E2E_MF_COMPANY_ID?.trim();
  if (!companyId) {
    console.error("FAIL: set E2E_MF_COMPANY_ID");
    process.exit(1);
  }
  const paymentRef = (process.env.E2E_MF_PAYMENT_REF?.trim() || `e2e-mf-${Date.now()}`).slice(0, 200);
  const amountPaise = Number(process.env.E2E_MF_AMOUNT_PAISE || "1200000");

  const res = await fetch(`${baseUrl}/api/dev/trigger-commission`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      companyId,
      amount: 10000,
      amountPaise,
      paymentRef,
    }),
  });
  const text = await res.text();
  let json: unknown = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text };
  }
  if (!res.ok || !json || typeof json !== "object" || (json as { ok?: boolean }).ok !== true) {
    console.error("FAIL: trigger-commission API failed", { status: res.status, json });
    process.exit(1);
  }
  const out = json as {
    credited?: boolean;
    wallet?: { pending?: number; totalEarned?: number } | null;
    transaction?: { id?: string; amount?: number; status?: string } | null;
  };
  const credited = out.credited;
  const tx1 = out.transaction;
  const w1 = out.wallet;

  if (!tx1) {
    console.error("FAIL: no commission row (check plan / linkage)", { credited, w1, paymentRef });
    process.exit(1);
  }
  if (!w1 || typeof w1.pending !== "number" || w1.pending <= 0) {
    console.error("FAIL: commission not reflected in wallet", { wallet: w1, tx: tx1, credited });
    process.exit(1);
  }

  console.log("PASS: commission accrual", {
    companyId,
    credited,
    walletPending: w1?.pending,
    transaction: tx1,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
