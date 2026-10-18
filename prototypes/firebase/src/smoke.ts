// THROWAWAY: run the probes against a base URL and save evidence (no secrets).
// Usage: node --env-file=.env.spike src/smoke.ts <hosting-url> [--cold]
import { writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:8080";
const coldOnly = process.argv.some((a) => a.startsWith("--cold"));
// --cold=session: first request is a Firestore session lookup, like a real page.
const coldSession = process.argv.includes("--cold=session");
const token = process.env.PROTOTYPE_TOKEN;
const reports: Record<string, unknown>[] = [];
let passed = true;
const check = (name: string, ok: boolean, extra: Record<string, unknown> = {}) => {
  reports.push({ name, passed: ok, ...extra });
  passed &&= ok;
};
const json = async (r: Response) => {
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { status: r.status, text: text.slice(0, 200) }; }
};
const timed = async (url: string, init?: RequestInit) => {
  const start = performance.now();
  const response = await fetch(url, init);
  const body = await response.text();
  return { response, body, ms: Math.round(performance.now() - start) };
};

// Cold start: run after ≥15 min idle. The first request is the measurement.
if (coldSession) {
  const s = await timed(`${base}/api/session/me`, {
    headers: { cookie: `__session=${crypto.randomUUID()}` },
  });
  check("cold-start-session", s.response.status === 401 && s.ms <= 2000, {
    clientMs: s.ms,
    status: s.response.status,
    serverCold: s.response.headers.get("x-prototype-cold"),
  });
}
const first = await timed(`${base}/api/health`);
const health = JSON.parse(first.body);
check("cold-start", coldSession || !health.cold || first.ms <= 2000, {
  clientMs: first.ms,
  serverCold: health.cold,
  serverUptimeMs: health.uptimeMs,
  moduleLoadMs: health.moduleLoadMs,
  revision: health.revision,
});
const warm = await timed(`${base}/api/health`);
reports.push({ name: "warm-health", clientMs: warm.ms });

if (!coldOnly) {
  const unauthorized = await fetch(`${base}/api/prototype/results`);
  check("probe-auth", unauthorized.status === 401);

  const probe = async (route: string, body: unknown) => {
    const { response, body: text, ms } = await timed(`${base}/api/prototype/${route}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { ok: false, error: text.slice(0, 200) }; }
    return { status: response.status, clientMs: ms, ...parsed };
  };
  for (const password of ["prototype-password", "wrong-password"]) {
    for (const route of ["login", "login-node"]) {
      const r = await probe(route, { password });
      check(`${route}:${password === "prototype-password" ? "right" : "wrong"}`,
        r.ok && r.result === (password === "prototype-password"),
        { serverMs: Math.round(r.wallMs), clientMs: r.clientMs });
    }
  }
  const storage = await probe("storage", {});
  check("firestore-transactions", storage.ok && storage.result?.passed, {
    result: storage.result ?? storage.error,
    serverMs: Math.round(storage.wallMs),
  });
  const enc = await probe("push-encryption", {});
  check("push-encryption", enc.ok && enc.result?.bodyBytes > 0 && enc.result.hasAuthorization);

  // Session through the Hosting rewrite: only __session should arrive back.
  const login = await fetch(`${base}/api/session/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "prototype-password" }),
  });
  const setCookies = login.headers.getSetCookie();
  const jar = setCookies.map((c) => c.split(";")[0]).join("; ");
  const me = await fetch(`${base}/api/session/me`, { headers: { cookie: jar } });
  const meBody = await json(me);
  const echo = await json(await fetch(`${base}/api/cookies`, { headers: { cookie: jar } }));
  check("session-cookie", login.ok && me.ok && meBody.authenticated === true, {
    setCookieNames: setCookies.map((c) => c.split("=")[0]),
    cookiesReceivedByApi: echo.received,
    apiCacheControl: me.headers.get("cache-control"),
  });
  const forged = await fetch(`${base}/api/session/me`, {
    headers: { cookie: `__session=${crypto.randomUUID()}` },
  });
  check("session-unknown-rejected", forged.status === 401);

  const runs = await fetch(`${base}/api/prototype/results`, {
    headers: { authorization: `Bearer ${token}` },
  });
  reports.push({ name: "scheduled-runs", data: await json(runs) });
}

const local = new URL(base).hostname === "localhost";
const evidence = {
  checkedAt: new Date().toISOString(),
  base: local ? base : "<hosting-url>",
  functionalProbesPassed: passed,
  note: "ms values are wall-clock; Cloud Run billing is per vCPU-second of instance time",
  reports,
};
const file = local ? "local-results.json" : coldOnly ? `cold-${coldSession ? "session-" : ""}${Date.now()}.json` : "deployed-results.json";
writeFileSync(new URL(`../results/${file}`, import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
console.info(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
