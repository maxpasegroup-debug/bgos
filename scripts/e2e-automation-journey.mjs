/**
 * Validates the automation journey: signup → Basic (auto call task) → PRO (Nexa + Sales Booster + auto-handle).
 *
 * Prerequisites:
 *   - Dev server: `npm run dev` (use development so `BGOS_PLAN_LOCK_BASIC` defaults off)
 *   - Or production mode with `BGOS_PLAN_LOCK_BASIC=off` in .env
 *   - DATABASE_URL in .env (to bump Company.plan and rely on refresh-session)
 *
 * Run:
 *   npm run e2e:automation
 *
 * Env: E2E_BASE_URL (default http://localhost:3000)
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

function planLockedToBasic() {
  const v = process.env.BGOS_PLAN_LOCK_BASIC?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  if (v === "1" || v === "true" || v === "on") return true;
  return process.env.NODE_ENV === "production";
}

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
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
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
    json = { _parseError: true, _raw: text?.slice?.(0, 500) ?? String(text) };
  }
  return { res, json };
}

function fail(step, msg, extra) {
  console.error(`FAIL: ${step}: ${msg}`);
  if (extra !== undefined && extra !== null && String(extra) !== "{}") {
    console.error(JSON.stringify(extra, null, 2));
  }
  process.exit(1);
}

async function main() {
  const t = Date.now();
  const bossEmail = `e2e-auto-${t}@example.com`;
  const mobileDigits = `8${String(t).slice(-9)}`.padEnd(10, "0").slice(0, 10);
  const password = "e2e-test-pass-8chars";
  const leadName = `Auto Lead ${t}`;
  const leadNamePro = `Auto Lead Pro ${t}`;

  let jar = "";

  {
    const { res, json } = await req("/api/auth/signup", {
      method: "POST",
      body: { name: "E2E Auto Boss", email: bossEmail, password },
    });
    if (!res.ok || !json.ok) fail("signup", `status ${res.status}`, json);
    jar = mergeCookieJar("", res);
    if (!jar.includes("token=")) fail("signup", "no session cookie");
  }

  {
    const { res, json } = await req("/api/company/create", {
      method: "POST",
      jar,
      body: { name: `E2E Auto Co ${t}`, industry: "SOLAR" },
    });
    if (!res.ok || !json.ok) fail("company/create", `status ${res.status}`, json);
    jar = mergeCookieJar(jar, res);
  }

  {
    const { res, json } = await req("/api/onboarding/activate", { method: "POST", jar });
    if (!res.ok || !json.ok) fail("onboarding/activate", `status ${res.status}`, json);
    jar = mergeCookieJar(jar, res);
  }

  let companyId = "";
  {
    const { res, json } = await req("/api/auth/me", { jar });
    if (!res.ok || json.authenticated !== true) fail("auth/me", `status ${res.status}`, json);
    companyId = json.user?.companyId;
    if (!companyId) fail("auth/me", "missing companyId", json);
    if (json.basicTrialExpired === true) fail("auth/me", "expected trial active (not expired)", json);
  }

  let leadId = "";
  {
    const { res, json } = await req("/api/leads/create", {
      method: "POST",
      jar,
      body: {
        name: leadName,
        phone: `+91 ${mobileDigits.slice(0, 5)} ${mobileDigits.slice(5)}`,
      },
    });
    if (!res.ok || !json.ok) fail("leads/create (basic)", `status ${res.status}`, json);
    leadId = json.lead?.id;
    if (!leadId) fail("leads/create", "missing lead id", json);
  }

  {
    const { res, json } = await req(`/api/tasks?leadId=${encodeURIComponent(leadId)}`, { jar });
    if (!res.ok || !json.ok) fail("tasks list", `status ${res.status}`, json);
    const tasks = Array.isArray(json.tasks) ? json.tasks : [];
    const hasCall = tasks.some(
      (x) => typeof x.title === "string" && x.title.toLowerCase().includes("call lead"),
    );
    if (!hasCall) fail("basic automation", "expected Call lead task", { tasks: tasks.map((x) => x.title) });
  }

  {
    const { res, json } = await req("/api/dashboard", { jar });
    if (!res.ok) fail("dashboard (basic)", `status ${res.status}`, json);
    if (!Array.isArray(json.insights) || json.insights.length !== 0) {
      fail("dashboard (basic)", "expected empty insights on Basic", { n: json.insights?.length });
    }
    if (json.automationCenter != null) {
      fail("dashboard (basic)", "expected automationCenter null/absent on Basic", json.automationCenter);
    }
    if (json.salesBooster?.featuresUnlocked === true) {
      fail("dashboard (basic)", "expected Sales Booster locked on Basic", json.salesBooster);
    }
    const nx = json.nexa;
    if (!nx || typeof nx.pendingFollowUps !== "number") {
      fail("dashboard (basic)", "expected nexa snapshot object", json.nexa);
    }
  }

  if (planLockedToBasic()) {
    console.log("OK: Basic automation checks passed. SKIP: plan locked to Basic — set BGOS_PLAN_LOCK_BASIC=off to test PRO path.");
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { plan: "PRO" },
    });
  } finally {
    await prisma.$disconnect();
  }

  {
    const { res, json } = await req("/api/auth/refresh-session", { method: "POST", jar });
    if (!res.ok || !json.ok) fail("refresh-session", `status ${res.status}`, json);
    jar = mergeCookieJar(jar, res);
  }

  let leadIdPro = "";
  {
    const { res, json } = await req("/api/leads/create", {
      method: "POST",
      jar,
      body: {
        name: leadNamePro,
        phone: `+91 9${mobileDigits.slice(1, 5)} ${mobileDigits.slice(5)}`,
      },
    });
    if (!res.ok || !json.ok) fail("leads/create (pro)", `status ${res.status}`, json);
    leadIdPro = json.lead?.id;
    if (!leadIdPro) fail("leads/create pro", "missing lead id", json);
  }

  {
    const { res, json } = await req(`/api/tasks?leadId=${encodeURIComponent(leadIdPro)}`, { jar });
    if (!res.ok || !json.ok) fail("tasks (pro lead)", `status ${res.status}`, json);
    const tasks = Array.isArray(json.tasks) ? json.tasks : [];
    const hasNexa = tasks.some(
      (x) => typeof x.title === "string" && x.title.includes("NEXA"),
    );
    if (!hasNexa) {
      fail("nexa on lead create", "expected NEXA task for Pro", { titles: tasks.map((x) => x.title) });
    }
    const hasBooster = tasks.some(
      (x) => typeof x.title === "string" && x.title.includes("Sales Booster"),
    );
    if (!hasBooster) {
      fail("sales booster", "expected Sales Booster scheduled task(s)", {
        titles: tasks.map((x) => x.title),
      });
    }
  }

  {
    const { res, json } = await req("/api/dashboard", { jar });
    if (!res.ok) fail("dashboard (pro)", `status ${res.status}`, json);
    if (json.salesBooster?.featuresUnlocked !== true) {
      fail("dashboard (pro)", "expected Sales Booster unlocked", json.salesBooster);
    }
    if (!json.automationCenter || typeof json.automationCenter.enabled !== "boolean") {
      fail("dashboard (pro)", "expected automationCenter with enabled", json.automationCenter);
    }
    if (!Array.isArray(json.insights) || json.insights.length < 1) {
      fail(
        "dashboard (pro)",
        "expected at least one Nexa-style insight (e.g. follow-up backlog)",
        json.insights,
      );
    }
    if (!Array.isArray(json.nexaController)) {
      fail("dashboard (pro)", "expected nexaController array", json);
    }
  }

  {
    const { res, json } = await req("/api/nexa/auto-handle", { method: "POST", jar });
    if (!res.ok || !json.ok) fail("nexa/auto-handle", `status ${res.status}`, json);
    if (typeof json.created !== "number") fail("nexa/auto-handle", "missing created count", json);
  }

  console.log(
    "OK: automation journey — Basic call task, dashboard gates, PRO Nexa + Sales Booster + auto-handle.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
