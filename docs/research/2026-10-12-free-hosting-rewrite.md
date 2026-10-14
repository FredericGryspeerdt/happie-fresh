# Free hosting for an Angular / TypeScript API / SQL rewrite

Checked 12 October 2026. Primary sources only (vendor pricing pages, docs,
changelogs); nothing deployed or measured. Free tiers change often; re-check
before committing.

## What the runtime has to support

Taken from the current app, not from the rewrite plan:

- Cookie session auth with sliding expiry, handled in
  [`routes/_middleware.ts`](../../routes/_middleware.ts). This needs ordinary
  HTTP plus a transactional store, and nothing host-specific.
- A **scheduled sweep every 5 minutes** (`*/5 * * * *` in
  [`main.ts`](../../main.ts)) that sends VAPID web pushes through `web-push`
  ([`services/notification-sweep.ts`](../../services/notification-sweep.ts),
  [`routes/api/push/`](../../routes/api/push/)). It must run when nobody has
  the app open, and it depends on an atomic "already sent" claim.
- The app icon badge is set client-side (see
  [`static/push-sw.js`](../../static/push-sw.js)). It only needs push delivery.

Hard filter: the host must offer **long-term free use, not a trial or
expiring credit**, and a way to trigger the API about every 5 minutes.

## API hosting

**Cloudflare Workers (Free).** Limits are 100,000 requests/day and **10 ms CPU
per request and per Cron Trigger**, with 5 Cron Triggers per account and
128 MB memory
([pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[limits](https://developers.cloudflare.com/workers/platform/limits/)). Cron
Triggers accept per-minute expressions, and changes can take up to 15 minutes
to propagate
([cron docs](https://developers.cloudflare.com/workers/configuration/cron-triggers/)).
There is no sleep; isolates start on demand. Hono documents a Worker with
`fetch: app.fetch` and a `scheduled` handler side by side
([Hono guide](https://hono.dev/docs/getting-started/cloudflare-workers)).
As of compatibility date 2026-08-04, `nodejs_compat` is on by default
([changelog](https://developers.cloudflare.com/changelog/post/2026-08-04-nodejs-compat-default/)).
`node:http` `createServer` plus `httpServerHandler` is supported, which
"integrates Node.js HTTP servers with the Cloudflare Workers request model"
([node:http](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/)).
Neither Cloudflare nor NestJS documents NestJS on Workers: a search of both
doc sites found no guide. Some Node shims throw when called
([Node compat](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)).
NestJS's bootstrap (reflect-metadata, DI graph) inside 10 ms CPU is
**unverified**. So are password hashing and push encryption, as the
[previous note](2026-10-10-deno-cloudflare.md) already flags.

**Render (Free web service).** It spins down after 15 minutes without inbound
traffic and takes "about one minute" to spin back up. The allowance is 750
instance hours per workspace per month, and services are suspended once those
hours run out. There are no persistent disks
([free docs](https://render.com/docs/free)). Cron Jobs have a "$1 per month"
minimum per service ([cron docs](https://render.com/docs/cronjobs)), so they
are **not free**. Frankfurt is a Render region, but the regions page does not
say whether Free instances can use it
([regions](https://render.com/docs/regions)). Free Postgres expires 30 days
after creation (see Database), so do not use it.

**Koyeb (Free instance).** One per organisation: 512 MB, 0.1 vCPU, 2 GB SSD,
**Frankfurt** or Washington only. It scales to zero after 1 hour without
traffic ([instances](https://www.koyeb.com/docs/reference/instances)). It
"will never be charged", but signup **requires a credit card** with a $29
pre-authorisation hold ([pricing FAQ](https://www.koyeb.com/docs/faqs/pricing)).
I found no free cron; an external trigger would be needed.

**Fly.io: no free tier.** "New organizations don't have a free tier or a
monthly free usage allowance". The trial is 2 machine-hours or 7 days, and
only plans discontinued in October 2024 keep their old allowances
([pricing](https://docs.fly.io/about/pricing)).

**Railway: effectively not free.** A 30-day trial with a one-time $5 grant,
then $1 of credit per month that does not roll over
([free trial](https://docs.railway.com/reference/pricing/free-trial)). An
always-on Node API on $1/month is not plausible. Not measured.

**Google Cloud Run.** The Free Tier gives 2M requests, 180,000 vCPU-s and
360,000 GB-s per month, and "a Google Cloud billing account is required"
([free features](https://docs.cloud.google.com/free/docs/free-cloud-features)).
The Cloud Run and Cloud Scheduler pricing pages **could not be fetched**
(truncated), so this note does not confirm which regions qualify for the free
tier or how many Scheduler jobs are free. The always-free e2-micro VM is
**US regions only** (same page).

**Vercel Hobby.** Functions are included (1M invocations, 4 active-CPU hours).
Hobby is "non-commercial, personal use only"
([Hobby](https://vercel.com/docs/plans/hobby)), which suits Happie. However,
Hobby cron is **once per day with ±59 min precision**; more frequent
expressions "will fail deployment"
([cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)). That
rules out the 5-minute sweep.

**Netlify Free.** You get 300 credits per month as a hard limit. Function
compute costs 10 credits per GB-hour, scheduled functions included, and a
production deploy costs 15 credits
([credit pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)).
When credits run out, "all of your web projects … are paused"
([how credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)).
That makes it workable but fragile: frequent deploys eat the budget.

**Oracle Cloud Always Free VM (self-host).** Ampere A1 gives the equivalent of
2 OCPU and 12 GB, or you can use two AMD micro VMs with 1 GB each. Storage is
200 GB block plus 5 volume backups, outbound transfer is 10 TB/month, and all
of it applies in the **home region only**
([Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)).
**Caveat for a tiny app:** Oracle may reclaim instances that are idle for
7 days, meaning p95 CPU below 20%, network below 20% and (A1 only) memory below
20% (same page). A family app will look idle. Creation can also fail with "out
of host capacity" (same page). The marketing page
[oracle.com/cloud/free](https://www.oracle.com/cloud/free/) returned **403**,
so the credit-card requirement is not confirmed here. The docs do not say
whether upgrading to Pay As You Go exempts an account from idle reclamation.
They only say Always Free resources stay free after upgrading.

## Database

**Cloudflare D1 (SQLite).** Free plan: 5M rows read and 100k written per day,
500 MB per database, 10 databases, 5 GB per account. Once a limit is hit,
queries error until 00:00 UTC
([pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[limits](https://developers.cloudflare.com/d1/platform/limits/)). **Time
Travel PITR is 7 days on Free** (limits page). An `eu` jurisdiction is
available, but only at creation
([data location](https://developers.cloudflare.com/d1/configuration/data-location/)).
The location page mentions no plan restriction. There is no inactivity
deletion in the docs I read, but they also do not say inactivity never matters.

**TiDB Cloud Starter (MySQL-compatible).** Up to 5 free instances per
organisation, each with 5 GiB row storage, 5 GiB columnar and 50M RUs per month.
No card is needed for those 5. The instance is throttled once the monthly quota
is used
([pricing details](https://www.pingcap.com/tidb-cloud-starter-pricing-details/)).
Frankfurt appears in the price tables, but the page does not say the free quota
applies there. **Backups on Free: daily, 1-day retention, no PITR**
([backup docs](https://docs.pingcap.com/tidbcloud/backup-and-restore-serverless/)).
Client connections may be dropped after 30 minutes
([limitations](https://docs.pingcap.com/tidbcloud/serverless-limitations/)).
None of these pages mentions an inactivity pause or deletion.

**Neon (Postgres).** Permanent and "no credit card required": 100 CU-hours per
project per month, 1 GB per project, scale-to-zero after 5 minutes (cannot be
disabled), and 6 hours of restore history
([pricing](https://neon.com/pricing),
[plans](https://neon.com/docs/introduction/plans)). Regions include **AWS
Frankfurt**. Inactive Free projects (90+ days) are "subject to deletion as of
October 5, 2026"; the
[regions page](https://neon.com/docs/introduction/regions) states this in its
deprecated-Azure context, and it does not say whether AWS Free projects are
covered. Verify before relying on it. A 5-minute sweep keeps waking compute:
CU-hour fit is unmeasured.

**Supabase (Postgres).** Two active projects with 500 MB each, **paused after
1 week of inactivity**, and no automatic backups on Free
([pricing](https://supabase.com/pricing)). Paused projects can be restored for
a window the docs give as 1 year, while a screenshot shows "90 Days Remaining"
([upgrading](https://supabase.com/docs/guides/platform/upgrading)). Frankfurt is
available ([regions](https://supabase.com/docs/guides/platform/regions)). A
5-minute sweep would likely count as activity, but the docs do not define
activity.

**Turso (libSQL/SQLite).** 100 databases, 5 GB, 500M rows read and 10M written
per month, 1-day PITR, "no credit card required"
([pricing](https://turso.tech/pricing)). Regions and inactivity rules are not
stated on that page.

**Aiven.** Free MySQL and PostgreSQL exist, with "no credit card" and no time
limit. However, you **cannot choose cloud or region**, and Aiven may power off
services with no "continuative activity"
([free plan docs](https://aiven.io/docs/platform/concepts/free-plan),
[pricing](https://aiven.io/pricing)). The free-tier backup policy is not stated.

**Oracle.** The Always Free Autonomous DB (Oracle SQL, not MySQL) is stopped
after 7 days inactive, "may be" deleted after 90 days stopped, and has **no
backups or restore** on Always Free
([ADB Always Free](https://docs.oracle.com/en-us/iaas/autonomous-database-serverless/doc/autonomous-always-free.html)).
Every tenancy also gets an Always Free **MySQL HeatWave** system in the home
region, with 50 GB of storage plus 50 GB of backup storage
([Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)).
That page does not state HeatWave inactivity rules or connectivity from outside
OCI.

**PlanetScale: no free tier listed.** The cheapest options are Vitess/MySQL
PS-10 at $39/month and a single-node Postgres PS-5 at $5/month
([pricing](https://planetscale.com/pricing)).

**Ruled out:** Render Free Postgres expires 30 days after creation
([free docs](https://render.com/docs/free)). Koyeb Free Postgres is "limited to
5 hours of active time", and the FAQ does not say per what period
([pricing FAQ](https://www.koyeb.com/docs/faqs/pricing)).

## Static hosting for the Angular PWA

- **Cloudflare Workers static assets:** "Requests to static assets are free
  and unlimited". Only `run_worker_first` routes count against Worker limits
  ([billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)).
  This is the strongest free option, and the API can sit on the same origin,
  which keeps session cookies first-party.
- **GitHub Pages:** 1 GB site and a 100 GB/month soft limit, and not for
  commercial SaaS
  ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)).
  The page says nothing on custom headers, and the API would be cross-origin,
  so cookies would need SameSite=None.
- **Netlify / Vercel:** both are viable for static files, within the credit
  and non-commercial limits above.

## Recommended combinations

**1. All-Cloudflare: Workers + Hono + D1 (+ static assets).**
One account and one origin. Cron Triggers handle the 5-minute sweep, D1 has
7-day PITR on Free, data can stay in the EU, and nothing sleeps. Trade-offs:
this is **not NestJS** (Hono instead) and **not MySQL** (SQLite dialect; an ORM
such as Drizzle could ease a later move). The 10 ms CPU cap must be measured
for password hashing and `web-push` encryption, which is the open risk from the
previous note. This option is the most likely to stay €0 for years.

**2. NestJS + MySQL on one Oracle Always Free VM, frontend on Cloudflare.**
This keeps both preferences intact: real Node, `@nestjs/schedule` in-process,
and MySQL on the VM or HeatWave Always Free. The capacity is ample. Trade-offs:
you run the server yourself (OS patches, TLS, backups to block-volume backups).
Idle reclamation is a real risk at family-scale load, and its exemption on Pay
As You Go is not documented. VM creation may fail on capacity, and the
card requirement is unconfirmed (403).

**3. NestJS on Koyeb Free (Frankfurt) + TiDB Starter, frontend and cron on
Cloudflare.**
A Cloudflare Cron Trigger calls a protected `/push/sweep` endpoint every 5
minutes, which also keeps Koyeb's 1-hour scale-to-zero from firing. This
keeps NestJS and MySQL wire compatibility without self-hosting. Trade-offs:
there are three vendors, Koyeb needs a credit card, and the instance has
0.1 vCPU and 512 MB (NestJS fit not measured). TiDB Free keeps only 1-day
backups with no PITR, so add your own `mysqldump` export. Render Free could
replace Koyeb, but the always-on pings would use about 744 of its 750 monthly
hours (derived, not documented). Neon is a Postgres alternative to TiDB, with
6-hour history and the inactivity question noted above.

Not recommended for this app: Vercel Hobby (daily-only cron), Fly.io and
Railway (no lasting free tier), PlanetScale (paid only), and Supabase Free (no
backups, pause rules) as the primary database.
