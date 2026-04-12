/**
 * Extended API validation: boss onboarding → employee → lead assign → ICECONNECT data,
 * document upload + list, dashboard range query, logout + session cleared.
 *
 * Run: npm run dev   (in another terminal)
 *      npm run e2e:validate
 *
 * Env: E2E_BASE_URL (default http://localhost:3000), DATABASE_URL, JWT_SECRET via .env
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

const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

function mergeCookieJar(prev, res) {
  const cookies = new Map();
  const parsePart = (part) => {
    const i = part.indexOf("=");
    if (i > 0) cookies.set(part.slice(0, i), part.slice(i + 1));
  };
  if (prev) {
    for (const c of prev.split(/;\s*/)) {
      if (c) parsePart(c);
    }
  }
  const list = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const line of list) {
    const first = line.split(";")[0];
    if (first) parsePart(first);
  }
  if (list.length === 0) {
    const single = res.headers.get("set-cookie");
    if (single) {
      for (const seg of single.split(/,(?=[^;]+?=)/)) {
        const first = seg.trim().split(";")[0];
        if (first) parsePart(first);
      }
    }
  }
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(path, { method = "GET", jar = "", body, formData } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (jar) headers.cookie = jar;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: formData !== undefined ? formData : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _parseError: true, _raw: text?.slice?.(0, 500) ?? String(text) };
  }
  return { res, json, _text: text };
}

function fail(step, msg, extra) {
  console.error(`FAIL: ${step}: ${msg}`);
  if (extra !== undefined && extra !== null && String(extra) !== "{}") {
    console.error(JSON.stringify(extra, null, 2));
  }
  process.exit(1);
}

/** 1×1 transparent PNG */
const MIN_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
  const t = Date.now();
  const bossEmail = `e2e-boss-${t}@example.com`;
  const empEmail = `e2e-tel-${t}@example.com`;
  const mobileDigits = `9${String(t).slice(-9)}`.padEnd(10, "0").slice(0, 10);
  const password = "e2e-test-pass-8chars";
  const leadName = `E2E Lead ${t}`;

  let bossJar = "";

  {
    const { res, json } = await req("/api/auth/signup", {
      method: "POST",
      body: { name: "E2E Boss", email: bossEmail, password },
    });
    if (!res.ok || !json.ok) fail("signup", `status ${res.status}`, json);
    bossJar = mergeCookieJar("", res);
    if (!bossJar || !bossJar.includes("bgos_session=")) fail("signup", "no session cookie");
  }

  {
    const { res, json } = await req("/api/company/create", {
      method: "POST",
      jar: bossJar,
      body: { name: `E2E Co ${t}`, industry: "SOLAR" },
    });
    if (!res.ok || !json.ok) fail("company/create", `status ${res.status}`, json);
    bossJar = mergeCookieJar(bossJar, res);
  }

  {
    const { res, json } = await req("/api/onboarding/activate", { method: "POST", jar: bossJar });
    if (!res.ok || !json.ok) fail("onboarding/activate", `status ${res.status}`, json);
    bossJar = mergeCookieJar(bossJar, res);
  }

  let empId = "";
  {
    const { res, json } = await req("/api/users/create", {
      method: "POST",
      jar: bossJar,
      body: {
        name: "E2E Telecaller",
        mobile: mobileDigits,
        email: empEmail,
        password,
        role: "SALES_EXECUTIVE",
      },
    });
    if (!res.ok || !json.ok) fail("users/create", `status ${res.status}`, json);
    empId = json.user?.id;
    if (!empId) fail("users/create", "missing user id", json);
  }

  let leadId = "";
  {
    const { res, json } = await req("/api/leads/create", {
      method: "POST",
      jar: bossJar,
      body: {
        name: leadName,
        phone: `+91 ${mobileDigits.slice(0, 5)} ${mobileDigits.slice(5)}`,
      },
    });
    if (!res.ok || !json.ok) fail("leads/create", `status ${res.status}`, json);
    leadId = json.lead?.id;
    if (!leadId) fail("leads/create", "missing lead id", json);
  }

  {
    const { res, json } = await req("/api/leads/update-status", {
      method: "PATCH",
      jar: bossJar,
      body: { leadId, assignedToUserId: empId },
    });
    if (!res.ok || !json.ok) fail("leads/update-status assign", `status ${res.status}`, json);
  }

  let empJar = "";
  {
    const { res, json } = await req("/api/auth/login", {
      method: "POST",
      body: { email: empEmail, password, respondWithJson: true },
    });
    if (!res.ok || !json.ok) fail("login telecaller", `status ${res.status}`, json);
    empJar = mergeCookieJar("", res);
    if (!empJar || !empJar.includes("bgos_session=")) fail("login telecaller", "no session cookie");
  }

  {
    const { res, json } = await req("/api/iceconnect/sales/data", { jar: empJar });
    if (!res.ok || !json.ok) fail("iceconnect/sales/data", `status ${res.status}`, json);
    const leads = Array.isArray(json.leads) ? json.leads : [];
    const found = leads.some((l) => l.id === leadId);
    if (!found) fail("iceconnect/sales/data", "assigned lead not visible", { leadId, leadsLen: leads.length });
  }

  /* Document vault: upload tied to lead, list shows it */
  {
    const buf = Buffer.from(MIN_PNG_B64, "base64");
    const file = new File([buf], `e2e-upload-${t}.png`, { type: "image/png" });
    const form = new FormData();
    form.set("file", file);
    form.set("type", "OTHER");
    form.set("leadId", leadId);
    const { res, json } = await req("/api/document/upload", {
      method: "POST",
      jar: bossJar,
      formData: form,
    });
    if (!res.ok || !json.ok) fail("document/upload", `status ${res.status}`, json);
    const docId = json.document?.id;
    if (!docId) fail("document/upload", "missing document id", json);

    const { res: r2, json: j2 } = await req(`/api/document/list?leadId=${encodeURIComponent(leadId)}`, {
      jar: bossJar,
    });
    if (!r2.ok || !j2.ok) fail("document/list", `status ${r2.status}`, j2);
    const docs = Array.isArray(j2.documents) ? j2.documents : [];
    const seen = docs.some((d) => d.id === docId);
    if (!seen) fail("document/list", "uploaded doc not in library", { docId, count: docs.length });
  }

  /* Analytics range: preset reflected in payload */
  {
    const { res, json } = await req("/api/dashboard?range=today", { jar: bossJar });
    if (!res.ok) fail("dashboard range=today", `status ${res.status}`, json);
    if (json.analyticsRange?.preset !== "today") {
      fail("dashboard range=today", "unexpected preset", json.analyticsRange);
    }
    const { res: r2, json: j2 } = await req("/api/dashboard?range=last_month", { jar: bossJar });
    if (!r2.ok) fail("dashboard range=last_month", `status ${r2.status}`, j2);
    if (j2.analyticsRange?.preset !== "last_month") {
      fail("dashboard range=last_month", "unexpected preset", j2.analyticsRange);
    }
  }

  {
    const { res, json } = await req("/api/dashboard", { jar: bossJar });
    if (!res.ok) fail("dashboard", `status ${res.status}`, json);
    if (typeof json.leads !== "number") fail("dashboard", "missing leads count", json);
    if (!Array.isArray(json.team)) fail("dashboard", "missing team array", json);
  }

  /* Logout clears session */
  {
    const { res } = await req("/api/auth/logout", { method: "POST", jar: bossJar });
    if (!res.ok) fail("logout", `status ${res.status}`);
    const clearedJar = mergeCookieJar(bossJar, res);
    const { res: r2, json: j2 } = await req("/api/auth/me", { jar: clearedJar });
    if (!r2.ok && r2.status !== 200) fail("auth/me after logout", `status ${r2.status}`, j2);
    if (j2.authenticated !== false) fail("auth/me after logout", "expected authenticated false", j2);
  }

  console.log("OK: full validation (API) passed — boss, ICECONNECT, documents, dashboard range, logout.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
