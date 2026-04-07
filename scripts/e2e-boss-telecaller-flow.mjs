/**
 * End-to-end API smoke test: signup → employee → lead → assign → telecaller data → task complete.
 * Run: E2E_BASE_URL=http://localhost:3000 node scripts/e2e-boss-telecaller-flow.mjs
 * Requires: dev server + DATABASE_URL + JWT_SECRET (same as app).
 */
const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

/** Merge Set-Cookie lines into a single Cookie header value (session + activeCompanyId). */
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
  console.error(`FAIL: ${step}: ${msg}`, extra ?? "");
  process.exit(1);
}

async function main() {
  const t = Date.now();
  const bossEmail = `e2e-boss-${t}@example.com`;
  const empEmail = `e2e-tel-${t}@example.com`;
  const mobileDigits = `9${String(t).slice(-9)}`.padEnd(10, "0").slice(0, 10);
  const password = "e2e-test-pass-8chars";
  const leadName = `E2E Lead ${t}`;

  let bossJar = "";

  // 1) Signup boss (owner only — no company yet)
  {
    const { res, json } = await req("/api/auth/signup", {
      method: "POST",
      body: {
        name: "E2E Boss",
        email: bossEmail,
        password,
      },
    });
    if (!res.ok || !json.ok) fail("signup", `status ${res.status}`, json);
    bossJar = mergeCookieJar("", res);
    if (!bossJar || !bossJar.includes("bgos_session=")) fail("signup", "no session cookie");
  }

  // 2) Onboarding: create company
  {
    const { res, json } = await req("/api/company/create", {
      method: "POST",
      jar: bossJar,
      body: {
        name: `E2E Co ${t}`,
        industry: "SOLAR",
      },
    });
    if (!res.ok || !json.ok) fail("company/create", `status ${res.status}`, json);
    if (!json.companyId) fail("company/create", "missing companyId", json);
    bossJar = mergeCookieJar(bossJar, res);
  }

  // 2b) NEXA activation (step 2) — required before tenant APIs
  {
    const { res, json } = await req("/api/onboarding/activate", {
      method: "POST",
      jar: bossJar,
    });
    if (!res.ok || !json.ok) fail("onboarding/activate", `status ${res.status}`, json);
    bossJar = mergeCookieJar(bossJar, res);
  }

  // 3) Add employee (telecaller)
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

  // 4) Add lead (assigned to boss first)
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

  // 5) Assign lead to telecaller
  {
    const { res, json } = await req("/api/leads/update-status", {
      method: "PATCH",
      jar: bossJar,
      body: { leadId, assignedToUserId: empId },
    });
    if (!res.ok || !json.ok) fail("leads/update-status assign", `status ${res.status}`, json);
  }

  // 6) Employee login (same cookie jar name — separate session)
  let empJar = "";
  {
    const { res, json } = await req("/api/auth/login", {
      method: "POST",
      body: { mobile: mobileDigits, password, respondWithJson: true },
    });
    if (!res.ok || !json.ok) fail("login telecaller", `status ${res.status}`, json);
    empJar = mergeCookieJar("", res);
    if (!empJar || !empJar.includes("bgos_session=")) fail("login telecaller", "no session cookie");
  }

  // 7) Employee sees lead + tasks
  let taskId = "";
  {
    const { res, json } = await req("/api/iceconnect/sales/data", { jar: empJar });
    if (!res.ok || !json.ok) fail("iceconnect/sales/data", `status ${res.status}`, json);
    const leads = Array.isArray(json.leads) ? json.leads : [];
    const found = leads.some((l) => l.id === leadId);
    if (!found) fail("iceconnect/sales/data", "assigned lead not visible", { leadId, leadsLen: leads.length });
    const tasks = Array.isArray(json.tasks) ? json.tasks : [];
    const pending = tasks.filter((x) => x.status === "PENDING");
    if (pending.length === 0) fail("iceconnect/sales/data", "no pending tasks", { tasksLen: tasks.length });
    taskId = pending[0].id;
  }

  // 8) Complete task
  {
    const { res, json } = await req("/api/tasks/complete", {
      method: "PATCH",
      jar: empJar,
      body: { taskId },
    });
    if (!res.ok || !json.ok) fail("tasks/complete", `status ${res.status}`, json);
  }

  // 9) BGOS dashboard still loads for boss (metrics / team)
  {
    const { res, json } = await req("/api/dashboard", { jar: bossJar });
    if (!res.ok) fail("dashboard", `status ${res.status}`, json);
    if (typeof json.leads !== "number") fail("dashboard", "missing leads count", json);
    if (!Array.isArray(json.team)) fail("dashboard", "missing team array", json);
  }

  console.log("OK: e2e boss → telecaller flow passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
