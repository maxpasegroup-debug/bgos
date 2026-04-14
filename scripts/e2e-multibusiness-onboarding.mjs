/**
 * E2E: signup → first business → activate → BGOS APIs → employee + lead →
 * second business → switch companies → data isolation → ICECONNECT tenant.
 *
 * Run: E2E_BASE_URL=http://localhost:3000 node scripts/e2e-multibusiness-onboarding.mjs
 * Requires: dev server, DATABASE_URL, JWT_SECRET (≥32 chars).
 */
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

async function req(path, { method = "GET", jar = "", body } = {}) {
  const headers = { ...(body ? { "Content-Type": "application/json" } : {}) };
  if (jar) headers.cookie = jar;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text };
  }
  return { res, json };
}

function fail(step, msg, extra) {
  console.error(`FAIL (${step}): ${msg}`, extra != null ? extra : "");
  process.exit(1);
}

async function main() {
  const t = Date.now();
  const bossEmail = `e2e-mb-boss-${t}@example.com`;
  const empEmail = `e2e-mb-tel-${t}@example.com`;
  const mobileDigits = `8${String(t).slice(-9)}`.padEnd(10, "0").slice(0, 10);
  const password = "e2e-test-pass-8chars";
  const leadNameA = `E2E Lead A ${t}`;
  const leadNameB = `E2E Lead B ${t}`;

  let bossJar = "";
  let companyAId = "";
  let companyBId = "";
  let empId = "";
  let leadAId = "";

  // 1) Signup
  {
    const { res, json } = await req("/api/auth/signup", {
      method: "POST",
      body: { name: "E2E MB Boss", email: bossEmail, password },
    });
    if (!res.ok || !json.ok) fail("signup", `status ${res.status}`, json);
    bossJar = mergeCookieJar("", res);
    if (!bossJar.includes("token=")) fail("signup", "no session cookie");
  }

  // 2) First business
  {
    const { res, json } = await req("/api/company/create", {
      method: "POST",
      jar: bossJar,
      body: { name: `E2E Company A ${t}`, industry: "SOLAR" },
    });
    if (!res.ok || !json.ok) fail("company/create (A)", `status ${res.status}`, json);
    companyAId = json.companyId;
    if (!companyAId) fail("company/create (A)", "missing companyId", json);
    bossJar = mergeCookieJar(bossJar, res);
  }

  // 3) Activate (NEXA)
  {
    const { res, json } = await req("/api/onboarding/activate", {
      method: "POST",
      jar: bossJar,
    });
    if (!res.ok || !json.ok) fail("onboarding/activate", `status ${res.status}`, json);
    bossJar = mergeCookieJar(bossJar, res);
  }

  // 4) BGOS dashboard
  {
    const { res, json } = await req("/api/dashboard", { jar: bossJar });
    if (!res.ok) fail("dashboard (after activate)", `status ${res.status}`, json);
    if (typeof json.leads !== "number") fail("dashboard", "missing leads count", json);
  }

  

  // 5) Add employee
  {
    const { res, json } = await req("/api/users/create", {
      method: "POST",
      jar: bossJar,
      body: {
        name: "E2E MB Telecaller",
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

  // 6) Lead in company A (assign to telecaller for ICECONNECT)
  {
    const { res, json } = await req("/api/leads/create", {
      method: "POST",
      jar: bossJar,
      body: {
        name: leadNameA,
        phone: `+91 ${mobileDigits.slice(0, 5)} ${mobileDigits.slice(5)}`,
        assignedToUserId: empId,
      },
    });
    if (!res.ok || !json.ok) fail("leads/create (A)", `status ${res.status}`, json);
    leadAId = json.lead?.id;
    if (!leadAId) fail("leads/create (A)", "missing lead id", json);
  }

  // 7) Company list (one business so far)
  {
    const { res, json } = await req("/api/company/list", { jar: bossJar });
    if (!res.ok || !json.ok) fail("company/list", `status ${res.status}`, json);
    if (!Array.isArray(json.companies) || json.companies.length !== 1) {
      fail("company/list", "expected 1 company before second create", json.companies?.length);
    }
  }

  // 8) Second business
  {
    const { res, json } = await req("/api/company/create", {
      method: "POST",
      jar: bossJar,
      body: { name: `E2E Company B ${t}`, industry: "SOLAR" },
    });
    if (!res.ok || !json.ok) fail("company/create (B)", `status ${res.status}`, json);
    companyBId = json.companyId;
    if (!companyBId || companyBId === companyAId) fail("company/create (B)", "bad companyId", json);
    bossJar = mergeCookieJar(bossJar, res);
  }

  // Active context should be B: no lead from A in list
  {
    const { res, json } = await req("/api/leads", { jar: bossJar });
    if (!res.ok || !json.ok) fail("leads (default B)", `status ${res.status}`, json);
    const names = (json.leads || []).map((l) => l.name);
    if (names.includes(leadNameA)) fail("isolation", "company B leaked lead from A", names);
  }

  // Lead in B
  {
    const { res, json } = await req("/api/leads/create", {
      method: "POST",
      jar: bossJar,
      body: {
        name: leadNameB,
        phone: `+91 77777 ${String(t).slice(-5)}`,
      },
    });
    if (!res.ok || !json.ok) fail("leads/create (B)", `status ${res.status}`, json);
    const lid = json.lead?.id;
    if (!lid) fail("leads/create (B)", "missing lead id", json);
  }

  // 9) Switch to A — see A only
  {
    const { res, json } = await req("/api/company/switch", {
      method: "POST",
      jar: bossJar,
      body: { companyId: companyAId },
    });
    if (!res.ok || !json.ok) fail("company/switch → A", `status ${res.status}`, json);
    bossJar = mergeCookieJar(bossJar, res);
  }

  {
    const { res, json } = await req("/api/leads", { jar: bossJar });
    if (!res.ok || !json.ok) fail("leads (A)", `status ${res.status}`, json);
    const names = (json.leads || []).map((l) => l.name);
    if (!names.includes(leadNameA)) fail("isolation", "company A missing its lead", names);
    if (names.includes(leadNameB)) fail("isolation", "company A leaked lead from B", names);
    const { json: djson } = await req("/api/dashboard", { jar: bossJar });
    if ((djson.leads ?? 0) < 1) fail("dashboard (A)", "expected at least one lead count", djson);
  }

  // 10) Switch to B — see B only
  {
    const { res, json } = await req("/api/company/switch", {
      method: "POST",
      jar: bossJar,
      body: { companyId: companyBId },
    });
    if (!res.ok || !json.ok) fail("company/switch → B", `status ${res.status}`, json);
    bossJar = mergeCookieJar(bossJar, res);
  }

  {
    const { res, json } = await req("/api/leads", { jar: bossJar });
    if (!res.ok || !json.ok) fail("leads (B)", `status ${res.status}`, json);
    const names = (json.leads || []).map((l) => l.name);
    if (!names.includes(leadNameB)) fail("isolation", "company B missing its lead", names);
    if (names.includes(leadNameA)) fail("isolation", "company B leaked lead from A", names);
  }

  // 11) Company list — two memberships
  {
    const { res, json } = await req("/api/company/list", { jar: bossJar });
    if (!res.ok || !json.ok) fail("company/list (2)", `status ${res.status}`, json);
    const ids = new Set((json.companies || []).map((c) => c.companyId));
    if (ids.size !== 2 || !ids.has(companyAId) || !ids.has(companyBId)) {
      fail("company/list (2)", "expected both companies", [...ids]);
    }
  }

  // 12) ICECONNECT: telecaller session = company A only
  let empJar = "";
  {
    const { res, json } = await req("/api/auth/login", {
      method: "POST",
      body: { email: empEmail, password, respondWithJson: true },
    });
    if (!res.ok || !json.ok) fail("login telecaller", `status ${res.status}`, json);
    empJar = mergeCookieJar("", res);
    if (!empJar.includes("token=")) fail("login telecaller", "no session");
  }

  {
    const { res, json } = await req("/api/iceconnect/sales/data", { jar: empJar });
    if (!res.ok || !json.ok) fail("iceconnect/sales/data", `status ${res.status}`, json);
    const leads = Array.isArray(json.leads) ? json.leads : [];
    const ids = new Set(leads.map((l) => l.id));
    if (!ids.has(leadAId)) fail("iceconnect", "telecaller should see lead A", { leadAId, n: leads.length });
    const hasB = leads.some((l) => l.name === leadNameB);
    if (hasB) fail("iceconnect", "telecaller must not see company B lead", leads.map((l) => l.name));
  }

  console.log("OK: multibusiness onboarding + isolation + ICECONNECT tenant checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
