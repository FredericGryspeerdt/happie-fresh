# Free always-on API hosts with a 5-minute schedule (EU)

Checked 14 October 2026. Primary sources only (vendor pricing pages, docs);
nothing deployed or measured. Builds on `2026-10-12-free-hosting-rewrite.md`
(untracked on main when this was written) and answers
[#144](https://github.com/FredericGryspeerdt/happie-fresh/issues/144).
Cloudflare Workers as the API host is already ruled out by
[#143](https://github.com/FredericGryspeerdt/happie-fresh/issues/143)
(PBKDF2 > 100k iterations, 10 ms CPU).

## What "always-on" has to mean here

The API itself may sleep between requests, as long as **something outside it
calls `/push/sweep` every 5 minutes** and the sweep finishes inside that call
(ADR 0005: claim-based sweep, `*/5 * * * *`). So each option is really a pair:
a host for the API plus a scheduler. Outbound HTTPS for web push was not
restricted on any host checked below, except where noted.

## Hosts

**Google Cloud Run (request-based billing).** Free tier per month: 180,000
vCPU-s, 360,000 GiB-s and 2 million requests. It is "aggregated across projects
by billing account" and "applied as a spending based discount using Tier 1
pricing" ([pricing](https://cloud.google.com/run/pricing)). EU Tier 1 regions
include **europe-west1 (Belgium)**, europe-west4 (Netherlands), europe-north1,
europe-southwest1 and europe-west9 (Paris). Frankfurt (europe-west3) and London
are **Tier 2** (same page). With request-based billing (the default), instances
"are only charged when they process requests, when they start, and when they
shut down" and "CPU is only allocated during request processing"
([billing settings](https://docs.cloud.google.com/run/docs/configuring/billing-settings)).
So the sweep must do its work before returning the response, not in the
background. Idle instances that are not minimum instances "are not charged"
([pricing](https://cloud.google.com/run/pricing)). Derived, not measured: 8,640
sweeps a month at 2 s on 1 vCPU is about 17,000 vCPU-s, under 10% of the free
CPU. Caveats:
- A billing account (card) is required
  ([free features](https://docs.cloud.google.com/free/docs/free-cloud-features)).
- The outbound data free tier is "1GiB free data transfer within North
  America per month" ([pricing](https://cloud.google.com/run/pricing)).
  Egress from Belgium is therefore billed from the first byte. I did not check
  the per-GiB rate; push payloads are small, so expect cents at most, not €0
  guaranteed.
- Instance-based (always-allocated CPU) has a larger free tier (240,000
  vCPU-s), but one instance running for a month is about 2.6 million seconds,
  so even 0.1 vCPU would exceed it (derived). Do not use it.
- The pricing page does not state cold-start times or any inactivity deletion.

**Google Cloud Scheduler (pairs with Cloud Run).** "Each Google billing
account gets 3 jobs per month free", measured "at the account level not the
project level". A job is billed per job, not per execution, at $0.10 per job per
31 days beyond that ([pricing](https://cloud.google.com/scheduler/pricing)).
One `*/5` job is free regardless of how often it fires. Available in
europe-west1 and other EU regions
([locations](https://docs.cloud.google.com/scheduler/docs/locations)).

**Koyeb (Free instance).** 512 MB RAM, 0.1 vCPU, 2 GB SSD; "Each
organization is limited to one Free Instance"; Frankfurt or Washington only;
no Volumes; it scales "down to zero when they don't receive any traffic for 1
hour" ([instances](https://www.koyeb.com/docs/reference/instances)). A card
is required with a $29 pre-authorisation hold, and "You will never be charged
when using the `free` web Service"
([pricing FAQ](https://www.koyeb.com/docs/faqs/pricing)). Neither page mentions
cron, cold-start time, or inactivity deletion. A 5-minute external ping
keeps it from ever scaling to zero. The instances page describes the Free
instance as a preview, not for production.

**Render (Free web service).** It spins down after 15 minutes without inbound
traffic and takes "about one minute" to spin up. It gets 750 instance hours per
workspace per month, with suspension until month end when they run out. It
cannot send on SMTP ports 25/465/587, which does not affect web push over 443.
Render "may suspend" a service with unusually high outbound traffic
([free docs](https://render.com/docs/free)). Cron Jobs are paid
([cron docs](https://render.com/docs/cronjobs), per the earlier note). Derived:
a 5-minute ping keeps it awake all month at about 720–744 of the 750 hours,
which leaves no margin for a second service. The
[pricing page](https://render.com/pricing) did not render its plan table, so
Free CPU/RAM, card requirement and Free-tier region choice are **unconfirmed**.

**Northflank (Developer Sandbox).** "2× free services", "2× free cron jobs",
"1× free database" and "Always-on-compute – no sleeping"
([pricing](https://northflank.com/pricing)). "All users must add a payment
method to start creating resources", and the free tier "should not be used for
production applications"
([billing docs](https://northflank.com/docs/v1/application/billing/pricing-on-northflank)).
"Free jobs allow one active run at a time"
([plans and quotas](https://northflank.com/docs/v1/application/billing/resource-plans-and-quotas)).
**Not stated anywhere I could load:** free CPU/RAM per service, which regions
the Sandbox may use (the pricing selector lists an "EU West"), the minimum cron
interval, and inactivity rules. On paper it is the only host with a native free
cron next to an always-on service, but every number that matters is missing.

**Azure Container Apps (consumption).** The free grant is 180,000 vCPU-s,
360,000 GiB-s and 2 million requests "per subscription per month"
([pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/)).
Scheduled jobs take standard 5-field cron in UTC, and `*/5 * * * *` is the
documented example ([jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs)).
The jobs page does not say whether job executions draw from the same grant.
Container Apps is not on the
[always-free list](https://azure.microsoft.com/en-us/pricing/free-services).
Free-account users "must move to pay as you go within 30 days" to keep the
12-month offers (same page). Card requirement, scale-to-zero cold start, and
the cost of the Log Analytics workspace an environment usually needs were **not
checked**. This option has the most unknowns among the big clouds.

**Netlify Functions (Free).** Scheduled Functions are "available on all
pricing plans", with a 30 s limit; the docs list nothing finer than `@hourly`
and do not say whether `*/5` is allowed
([scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)).
Free has 300 credits per month as a **hard limit**. When they run out, "all of
your web projects (sites/apps) are paused"
([credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)).
Functions default to `cmh` (Ohio), and choosing a region is Pro/Enterprise only
([function config](https://docs.netlify.com/build/functions/optional-configuration/)),
so the API cannot sit in the EU on Free. Not recommended.

**alwaysdata (Free, French PaaS).** "0 € /month … For personal needs",
1 GB SSD, 256 MB RAM, ¼ CPU, 3 days of backups
([pricing](https://www.alwaysdata.com/en/pricing/)). Scheduled tasks can run a
command or request a URL "every 10 minutes" (the example given). The page names
no minimum and says Public Cloud use "should remain reasonable"
([tasks](https://help.alwaysdata.com/en/docs/web-hosting/tasks/)). Node.js is
documented ([Node.js](https://help.alwaysdata.com/en/docs/web-hosting/languages/nodejs/)).
The free-plan help page I tried returned 404. Data-centre location, card,
inactivity rules and whether 5-minute tasks are allowed are **unconfirmed**.
Worth a closer look as an EU-native shared host, but it is closer to classic
hosting than to a container platform.

**Checked and dropped:** Zeabur Free only manages "one self-managed server"
you bring yourself ([pricing](https://zeabur.com/pricing)). Leapcell Hobby
names "US, Asia and other regions" but no EU region and no cron
([pricing](https://leapcell.io/pricing)). Fly.io, Railway and Vercel Hobby were
already ruled out in the earlier note.

## External schedulers (for hosts without free cron)

- **Cloudflare Workers Cron Trigger as a pinger.** It is fine for this job
  even though #143 rules Workers out as the API: "Waiting on network requests
  (such as `fetch()` calls …) does not count toward CPU time". Scheduled Workers
  get up to 15 minutes of wall time
  ([limits](https://developers.cloudflare.com/workers/platform/limits/)).
  Per-minute cron, 5 triggers per account (earlier note). This is the most
  dependable free option.
- **Google Cloud Scheduler:** 3 free jobs per billing account (above). It
  needs GCP but can call any URL.
- **cron-job.org:** "entirely free of charge", up to every minute, 30 s
  timeout. It may auto-disable a job "when it subsequently fails more than 25
  times" ([FAQ](https://cron-job.org/en/faq/)). Hosting location not stated.
  Good as a backup, not as the only trigger.
- **GitHub Actions `schedule`:** minimum 5 minutes, "can be delayed during
  periods of high loads", "some queued jobs may be dropped", and it is disabled
  in public repos after 60 days without activity
  ([events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)).
  **Not reliable enough** for reminders.

## Ranked shortlist

1. **Cloud Run (europe-west1, request-based) + Cloud Scheduler.** One vendor,
   Belgian region, native cron, scales to zero without losing the sweep, and
   real Node with any framework. Usage is far below the free tier (derived).
   Trade-offs: card on file, a pay-as-you-go account (set a budget alert,
   which does not cap spend), and EU egress is not covered by the free tier
   (expect cents). Cold starts on user requests after idle periods are not
   documented on the pages checked. Pairs with any external database.
2. **Koyeb Free (Frankfurt) + Cloudflare Cron Trigger.** It is a plain
   container with nothing to tune, and the ping keeps it warm. Trade-offs:
   0.1 vCPU / 512 MB (a NestJS and PBKDF2-310k fit is not measured; hashing
   on 0.1 vCPU may be slow), one free instance per organisation, a $29 card
   hold, two vendors, and "not for production" wording.
3. **Northflank Sandbox.** It is always on with a native free cron, but CPU/RAM,
   regions and cron granularity are undocumented on the pages loaded, a card
   is required, and it is "not for production". Prototype before relying on it.
4. **Render Free + Cloudflare pinger.** It works, but uses almost the entire
   750-hour allowance, needs one-minute spin-ups if the ping ever lapses,
   and has unconfirmed region and specs.
5. **Azure Container Apps / alwaysdata.** Both are plausible on paper, but too
   many unchecked items (Azure: grant applying to jobs, Log Analytics cost;
   alwaysdata: 5-minute tasks, location, free plan terms) to rank higher.

Before committing to #1, measure: PBKDF2-310k and one `web-push` send on a
Cloud Run instance at 1 vCPU / 512 MiB, and look up the EU egress rate on
Google's network pricing page.
