/**
 * Razorpay test-mode checklist: verifies env + documents order + webhook paths.
 * Full payment+webhook needs valid signatures and Razorpay API; run with dev server + RAZORPAY_* set.
 *
 * Optional: POST /api/payment/razorpay/order with boss session (not automated without saved cookies).
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
    const val = t.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    if (!(key in process.env)) process.env[key] = val;
  }
}

const keyId = process.env.RAZORPAY_KEY_ID?.trim();
const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

if (!keyId?.startsWith("rzp_test_")) {
  console.log("FAIL: RAZORPAY_KEY_ID must be set to rzp_test_* for this smoke checklist");
  process.exit(1);
}
if (!keySecret) {
  console.log("FAIL: RAZORPAY_KEY_SECRET missing");
  process.exit(1);
}

console.log("PASS: Razorpay test keys present");
console.log("INFO: Create order → POST /api/payment/razorpay/order (auth cookie, body { plan: basic|pro|enterprise })");
console.log("INFO: Webhook → POST /api/payment/razorpay/webhook (raw JSON body + x-razorpay-signature HMAC of body with RAZORPAY_WEBHOOK_SECRET or KEY_SECRET)");
console.log("INFO: Client verify → POST /api/payment/razorpay/verify with order id, payment id, signature");
