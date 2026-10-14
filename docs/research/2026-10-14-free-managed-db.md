# Free managed Postgres / MySQL that keeps household data safe

Checked 14 October 2026. Primary sources only (vendor pricing pages, docs,
changelogs); nothing provisioned or measured. Builds on
`2026-10-12-free-hosting-rewrite.md` (same folder, on `main`, uncommitted at
time of writing). Free tiers change often; re-check before committing.

Answers [#145](https://github.com/FredericGryspeerdt/happie-fresh/issues/145)
for map [#142](https://github.com/FredericGryspeerdt/happie-fresh/issues/142).

## What "safe long-term" means here

From the map's constraints: €0/month on a free tier that is not a trial; a
card on file is fine; daily backups with **recovery to yesterday** are enough;
data should stay in the EU if possible. The app also runs a **reminder sweep
every 5 minutes** that reads the database, so the database is never idle for
more than ~5 minutes. That matters for both "pause on inactivity" rules (good)
and compute-hour budgets (bad).

## Per service

**Neon (Postgres).** "Permanent (not a trial); no credit card required"
([pricing](https://neon.com/pricing)). Free: 100 CU-hours per project per
month, 1 GB per project, scale-to-zero after **5 min inactivity, cannot
disable**, and a **6-hour history window** (capped at 1 GB) for instant restore
([plans](https://neon.com/docs/introduction/plans),
[history window](https://neon.com/docs/postgres/backup-restore/history-window)).
One manual snapshot per project; scheduled snapshots are not on Free
([pricing](https://neon.com/pricing)). AWS Frankfurt (`aws-eu-central-1`) is
available ([regions](https://neon.com/docs/introduction/regions)). Pooler allows
up to 10,000 client connections; direct `max_connections` at 0.25 CU is 104
([pooling](https://neon.com/docs/connect/connection-pooling)).

- **Inactivity deletion:** "projects on Free plans that have been inactive for
  90 days or more are subject to deletion" as of 5 October 2026. The
  [Azure deprecation page](https://neon.com/docs/import/azure-regions-deprecation)
  words this for Free plans generally, but the same page says "Only projects in
  these Azure regions are affected". **The sources do not settle whether AWS
  projects are covered.** The
  [free-plan FAQ](https://neon.com/faqs/free-plan-limits-and-quotas) does not
  mention project deletion at all. A live app with a 5-minute sweep is never
  90 days inactive, so this is mostly a risk for a forgotten staging project.
- **Compute budget (derived, not documented):** the plans page says 100 CU-hours
  is enough for 0.25 CU running about 400 hours. A sweep every 5 minutes against
  a 5-minute suspend timeout keeps compute awake ~730 h/month, i.e. ~182 CU-hours.
  The budget would run out around day 16, and then "existing connections drop
  and new ones can't open" ([FAQ](https://neon.com/faqs/free-plan-limits-and-quotas)).
  This is the deciding problem for Neon.
- **Recover to yesterday:** not natively (6 h window). Needs our own dump.

**Supabase (Postgres).** Free: 2 active projects, 500 MB database, shared CPU,
"Free projects are paused after 1 week of inactivity", **no automatic backups,
no PITR** ([pricing](https://supabase.com/pricing)). The backups docs list daily
backups only for Pro/Team/Enterprise and say free projects should "regularly
export their data" with `supabase db dump`
([backups](https://supabase.com/docs/guides/platform/backups)). Paused projects
have "a 1-year window to restore", after which you can download the backup file
([upgrading](https://supabase.com/docs/guides/platform/upgrading)). Frankfurt is
a region ([regions](https://supabase.com/docs/guides/platform/regions)). Nano
(free) compute: 60 direct connections, 200 pooler clients
([compute](https://supabase.com/docs/guides/platform/compute-and-disk)).

- The docs I read do **not define "inactivity"**; I could not find a page that
  says whether database queries from an external API count. The troubleshooting
  URL I tried returned 404. The 5-minute sweep probably counts, but this is
  unverified.
- The pricing page does not say whether a card is required.
- **Recover to yesterday:** only via our own dump.

**TiDB Cloud Starter (MySQL-compatible).** Free quota on the first 5 instances
per organisation: 5 GiB row storage, 5 GiB columnar, 50M RUs per month; when
exhausted "the instance will automatically be throttled" until next month. A
card is only needed for a 6th instance
([pricing details](https://www.pingcap.com/tidb-cloud-starter-pricing-details/)).
Frankfurt (`eu-central-1`) is in the price tables, but the page does not say
whether the free quota applies there. No inactivity pause or deletion is
mentioned on the pricing, backup or limitations pages.

- **Backups on Free:** daily at a fixed random time, **1-day retention**, no PITR,
  no manual backups; restore goes to a **new** instance
  ([backup docs](https://docs.pingcap.com/tidbcloud/backup-and-restore-serverless/)).
  So "yesterday" is natively reachable, but there is exactly one snapshot.
  If a problem is noticed a day late, it is gone.
- **Export:** SQL/CSV/Parquet to local, S3, GCS, Azure Blob or OSS, scriptable
  with `ticloud serverless export create/download`; local exports expire after
  two days ([export](https://docs.pingcap.com/tidbcloud/serverless-export/)).
  The page does not say whether export is free on a zero spending limit, only
  that speed is then "up to 25 MiB/s".
- **Connections:** up to 400 concurrent; connections open over 30 minutes may
  be dropped (set a max lifetime, the docs suggest 5 min); public endpoints on
  AWS idle out after 340 s
  ([limitations](https://docs.pingcap.com/tidbcloud/serverless-limitations/)).
  This needs a pool with short lifetimes, but it is manageable.

**Aiven (Postgres or MySQL).** "You don't need a credit card" and "Free services
do not have any time limitations", but you **cannot choose cloud or region**,
and services with no ongoing activity may be powered off after a notice
([free plan](https://aiven.io/docs/platform/concepts/free-plan)). Free is 1 GB
storage, 1 CPU, 1 GB RAM, no connection pooling
([pricing](https://aiven.io/pricing)). The MySQL page lists "a single backup
only for disaster recovery" and DigitalOcean/UpCloud as the clouds
([MySQL pricing](https://aiven.io/pricing/mysql)). The table layout makes the
exact retention ambiguous. **EU residency cannot be guaranteed.**

**Prisma Postgres.** "Free forever. No credit card required": 50 databases,
1.01 GB, **200,000 operations/month**, 10 pooled + 10 direct connections, and
**no backups on Free** ([pricing](https://www.prisma.io/pricing)). Frankfurt and
Paris exist ([FAQ](https://www.prisma.io/docs/postgres/faq)). When the allowance
is used up, the database "stops accepting read and write requests" (same FAQ).
The sweep alone is ~8,640 runs/month (derived). Whether each sweep counts as one
operation or several is not documented, so the cap is a real risk.

**Oracle MySQL HeatWave Always Free.** One per tenancy in the home region,
50 GiB fixed storage, "Automatic backup with 1 day retention", "Manual backup
and point-in-time recovery are not available", no SLA
([features](https://docs.oracle.com/en-us/iaas/mysql-database/doc/features-mysql-heatwave-service.html)).
Inactivity rules and reachability from outside OCI are **not stated** on that
page. Realistic only together with the Oracle VM fallback.

**No lasting free tier (excluded):** Xata Cloud is a "14-day free trial"
([pricing](https://xata.io/pricing)). The CockroachDB pricing page now shows
only a "30-day free trial with $400 in credit" and no Basic free tier
([pricing](https://www.cockroachlabs.com/pricing/)). PlanetScale, Render and
Koyeb were already excluded in the earlier note.

## Our own scheduled dump ("recover to yesterday")

This is feasible on any candidate above, and it is the only way to get more than
one restore point for free.

- **Scheduler:** GitHub Actions `schedule` runs as often as every 5 minutes but
  "can be delayed during periods of high loads". In a **public** repository,
  scheduled workflows "are automatically disabled when no repository activity
  has occurred in 60 days"
  ([events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
  A private repo on GitHub Free gets 2,000 minutes and 500 MB artifact storage
  per month ([billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)).
  A daily dump of a tiny database uses a few dozen minutes a month (derived).
- **Do not use this repo.** `happie-fresh` is public, and artifact download needs
  only "read access to the repository"
  ([download](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)).
  For a public repo that is everyone (inference). Use a separate **private**
  repo, and encrypt the dump (e.g. `age`) before it leaves the runner.
- **Store:** Cloudflare R2 Free gives 10 GB-month, 1M Class A ops and free
  egress ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)), enough
  for months of daily dumps with a lifecycle rule. Actions artifacts also work,
  with 90-day default retention
  ([artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/remove-workflow-artifacts)),
  within the 500 MB quota.
- **Tooling gotcha:** `pg_dump` "cannot dump from PostgreSQL servers newer than
  its own major version" ([pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)),
  so the workflow must install a client that matches the provider's major
  version. For TiDB, use `ticloud serverless export` or a MySQL client dump
  (`mysqldump` compatibility with TiDB was not checked here).
- **Restore drill:** a backup is only proven by restoring it. Add a periodic
  restore into a scratch database (a second free instance or project).

## Ranked shortlist

1. **TiDB Cloud Starter + nightly own export.** No documented inactivity pause
   or deletion, no card needed, generous quota for a household, 400 connections,
   and a native daily snapshot as a second line of defence. Trade-offs:
   MySQL-*compatible* (TiDB), not MySQL; EU free quota unconfirmed; 30-minute
   connection drops and 340 s idle timeouts need pool tuning; only one native
   restore point.
2. **Supabase Free + nightly `pg_dump`.** Real Postgres in Frankfurt, 200 pooled
   connections. Trade-offs: no backups at all on Free; the 1-week pause rule
   has an undefined notion of "activity" (the sweep probably prevents it);
   500 MB cap; card requirement not stated.
3. **Neon Free + nightly `pg_dump`.** Best native safety net (6 h instant
   restore), Frankfurt, no card. Trade-off: the 5-minute sweep would likely
   burn the 100 CU-hours by mid-month (derived), and the 90-day deletion rule's
   AWS scope is unclear. Viable only if the sweep could avoid waking the
   database every 5 minutes.
4. **Oracle HeatWave Always Free.** Only if the Oracle VM fallback is chosen
   anyway. 1-day backup only; outside reachability is undocumented.

Not recommended: Aiven (no region choice, power-off on inactivity), Prisma
Postgres (no backups, hard 200k-operation cap), Xata and CockroachDB (trials
only).

**Whatever is chosen, "recover to yesterday" should come from our own daily,
encrypted dump in a private GitHub repo to R2, not from the free tier.** None of
the free tiers offers more than one day of restore history.
