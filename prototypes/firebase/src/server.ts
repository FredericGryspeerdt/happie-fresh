// THROWAWAY: runtime probes for Hono on Node 24 / Cloud Run behind Firebase
// Hosting, with Firestore (default). Ports the checks of the Cloudflare spike.
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { pbkdf2Sync, timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { db } from "./firestore.ts";
import { probeStorage } from "./storage.ts";
import { verifyPassword } from "./security.ts";

const env = (name: string) => process.env[name] ?? "";
// performance.timeOrigin is process start: covers module loading too.
const moduleLoadedMs = performance.now();
let firstRequest = true;
let lastCold = false;

async function measure<T>(name: string, run: () => Promise<T> | T) {
  const start = performance.now();
  try {
    const result = await run();
    const report = { name, ok: true, wallMs: performance.now() - start, result };
    console.info(JSON.stringify(report));
    return report;
  } catch (cause) {
    const report = {
      name,
      ok: false,
      wallMs: performance.now() - start,
      error: cause instanceof Error ? cause.message : String(cause),
    };
    console.info(JSON.stringify(report));
    return report;
  }
}

async function push(scheduledTime: number) {
  const subscriptions = await (await db()).collection("prototype_subscriptions").get();
  if (subscriptions.empty) return { skipped: "no device subscribed" };
  webpush.setVapidDetails(
    "https://example.com/happie-prototype",
    env("VAPID_PUBLIC_KEY"),
    env("VAPID_PRIVATE_KEY"),
  );
  // Same five-minute slot → same claim id, so overlapping sweeps send once.
  const slot = Math.floor(scheduledTime / 300_000);
  let claimed = 0;
  let sent = 0;
  for (const doc of subscriptions.docs) {
    const subscription = JSON.parse(doc.get("subscription"));
    try {
      await (await db()).collection("prototype_claims").doc(`push-${slot}-${doc.id}`)
        .create({ at: new Date() });
    } catch {
      continue;
    }
    claimed++;
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: "Happie-prototype",
        body: "Geplande melding via Cloud Run",
        tag: "happie-prototype",
        url: "/",
      }),
    );
    sent++;
  }
  return { claimed, sent };
}

const app = new Hono();

app.use("/api/*", async (c, next) => {
  const cold = firstRequest;
  firstRequest = false;
  lastCold = cold;
  await next();
  // Hosting's CDN would otherwise be allowed to cache API responses.
  c.header("Cache-Control", "private, no-store");
  c.header("X-Prototype-Cold", String(cold));
});

// Public: cold-start evidence without secrets.
app.get("/api/health", (c) =>
  c.json({
    revision: env("K_REVISION") || "local",
    uptimeMs: Math.round(performance.now()),
    moduleLoadMs: Math.round(moduleLoadedMs),
    cold: lastCold,
  }));

// Public: shows which cookies survive the Hosting rewrite.
app.get("/api/cookies", (c) =>
  c.json({ received: Object.keys(getCookie(c)).sort() }));

// Session round trip through the rewrite. Only `__session` is forwarded.
app.post("/api/session/login", async (c) => {
  const { password } = await c.req.json();
  const ok = await verifyPassword(password, env("PROTOTYPE_PASSWORD_HASH"));
  if (!ok) return c.json({ ok: false }, 401);
  const id = crypto.randomUUID();
  await (await db()).collection("prototype_sessions").doc(id).set({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 86_400_000),
  });
  const cookie = { httpOnly: true, secure: true, sameSite: "Lax", path: "/" } as const;
  setCookie(c, "__session", id, { ...cookie, maxAge: 30 * 86_400 });
  setCookie(c, "other", "stripped-by-hosting", cookie);
  return c.json({ ok: true });
});

app.get("/api/session/me", async (c) => {
  const id = getCookie(c, "__session");
  if (!id) return c.json({ authenticated: false, reason: "no __session" }, 401);
  const ref = (await db()).collection("prototype_sessions").doc(id);
  const session = await ref.get();
  if (!session.exists) return c.json({ authenticated: false }, 401);
  // Sliding renewal that must not recreate a deleted session.
  await ref.update({ expiresAt: new Date(Date.now() + 30 * 86_400_000) });
  return c.json({ authenticated: true, cookies: Object.keys(getCookie(c)) });
});

// Cloud Scheduler target. Hosting is not involved: Scheduler calls the run.app
// URL with the sweep token. The work finishes before the response.
app.post("/api/sweep", async (c) => {
  if (c.req.header("x-sweep-token") !== env("SWEEP_TOKEN")) {
    return c.text("Unauthorized", 401);
  }
  const report = await measure("scheduled-push", () => push(Date.now()));
  await (await db()).collection("prototype_runs").add({
    createdAt: new Date(),
    kind: "scheduled",
    result: JSON.stringify(report),
  });
  return c.json(report, report.ok ? 200 : 500);
});

const probes = new Hono();
probes.use(async (c, next) => {
  if (!env("PROTOTYPE_TOKEN")) return c.text("Set a prototype token first", 503);
  if (c.req.header("authorization") !== `Bearer ${env("PROTOTYPE_TOKEN")}`) {
    return c.text("Unauthorized", 401);
  }
  await next();
});
probes.get("/config", (c) => c.json({ publicKey: env("VAPID_PUBLIC_KEY") }));
probes.get("/results", async (c) => {
  const runs = await (await db()).collection("prototype_runs")
    .orderBy("createdAt", "desc").limit(20).get();
  return c.json(runs.docs.map((d) => d.data()));
});
probes.post("/login", async (c) => {
  const { password } = await c.req.json();
  return c.json(
    await measure(
      "password-verification",
      () => verifyPassword(password, env("PROTOTYPE_PASSWORD_HASH")),
    ),
  );
});
// Same hash through node:crypto (blocks the event loop), for comparison.
probes.post("/login-node", async (c) => {
  const { password } = await c.req.json();
  return c.json(
    await measure("password-verification-node", () => {
      const [, , iterations, salt, hash] = env("PROTOTYPE_PASSWORD_HASH").split("$");
      const expected = Buffer.from(hash, "base64url");
      const derived = pbkdf2Sync(
        password,
        Buffer.from(salt, "base64url"),
        Number(iterations),
        expected.length,
        "sha256",
      );
      return timingSafeEqual(derived, expected);
    }),
  );
});
probes.post("/storage", async (c) =>
  c.json(await measure("firestore-transactions", async () => probeStorage(await db()))));
probes.post("/push", async (c) =>
  c.json(await measure("push", () => push(Date.now()))));
probes.post("/push-encryption", async (c) =>
  c.json(
    await measure("push-encryption", () => {
      const { publicKey } = webpush.generateVAPIDKeys();
      const details = webpush.generateRequestDetails(
        {
          endpoint: "https://example.com/disposable-push-endpoint",
          keys: {
            p256dh: publicKey,
            auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16)))
              .toString("base64url"),
          },
        },
        "Happie-prototype",
        {
          vapidDetails: {
            subject: "https://example.com/happie-prototype",
            publicKey: env("VAPID_PUBLIC_KEY"),
            privateKey: env("VAPID_PRIVATE_KEY"),
          },
        },
      );
      return {
        bodyBytes: details.body?.length ?? 0,
        hasAuthorization: "Authorization" in details.headers,
        networkSendTested: false,
      };
    }),
  ));
probes.post("/subscribe", async (c) => {
  // One manually enrolled test device; no production subscriptions.
  await (await db()).collection("prototype_subscriptions").doc("device").set({
    subscription: JSON.stringify(await c.req.json()),
  });
  return c.json({ subscribed: true });
});
app.route("/api/prototype", probes);

const port = Number(env("PORT") || 8080);
serve({ fetch: app.fetch, port }, () =>
  console.info(JSON.stringify({ listening: port, startupMs: Math.round(performance.now()) })));
