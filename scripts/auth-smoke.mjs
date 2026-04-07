const base = "http://localhost:3000";
const id = Date.now();
const email = `boss${id}@example.com`;
const password = "Passw0rd!123";
let cookie = "";

function saveCookie(res) {
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
}

async function main() {
  let r = await fetch(`${base}/api/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Boss One", email, password }),
  });
  let j = await r.json();
  saveCookie(r);
  console.log("signup", r.status, Boolean(j.ok ?? j.success), Boolean(cookie));
  if (r.status >= 400) process.exit(1);

  r = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
  j = await r.json();
  console.log("me_after_signup", r.status, Boolean(j.authenticated), j.user?.email ?? "");
  if (!j.authenticated) process.exit(1);

  r = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { cookie } });
  saveCookie(r);
  console.log("logout", r.status);

  r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, respondWithJson: true }),
  });
  j = await r.json();
  saveCookie(r);
  console.log("login", r.status, Boolean(j.ok ?? j.success), Boolean(cookie));
  if (r.status >= 400) process.exit(1);

  r = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
  j = await r.json();
  console.log("me_after_login", r.status, Boolean(j.authenticated), j.user?.email ?? "");
  if (!j.authenticated) process.exit(1);

  r = await fetch(`${base}/bgos`, { headers: { cookie }, redirect: "manual" });
  console.log("bgos", r.status, r.headers.get("location") ?? "ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
