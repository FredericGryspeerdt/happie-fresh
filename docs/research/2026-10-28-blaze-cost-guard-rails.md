# Cost guard-rails for the Blaze project

Checked 28 October 2026 for issue #162. Primary sources only (Google Cloud and
Firebase docs and pricing pages). Nothing was deployed or tested. Billing
features change often, and spend caps launched only in July 2026, so re-check
these pages before relying on them.

## The setup being guarded

- Firebase Hosting rewrites `/api/**` to a Hono API on Cloud Run
  (europe-west1, `min-instances=0`, `max-instances=20` in the spike).
- One Cloud Scheduler job every 5 minutes calls the push sweep.
- Firestore `(default)` database, accessed only through the Admin SDK.
- Spike baseline: €0.00 billed for a week. Every free tier was at ≤1.8%. The
  only billable line was EU egress, about $0.006/month. The spike used a €1
  alerts-only budget.

The goal is no fixed fee and a few cents of usage per month, even if traffic
or a bug spikes.

## 1. Budgets notify. One new kind of budget can pause Cloud Run

**Ordinary (alerts-only) budgets never stop spend.** "Setting an alerts-only
budget doesn't automatically cap Google Cloud or Google Maps Platform usage or
spending"
([budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets)).
Firebase says the same thing: "Budget alerts do not pause services"
([avoid surprise bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)).
Threshold rules can use actual spend or forecasted spend. The defaults are 50%,
90% and 100% of actual spend. A monthly budget keeps tracking costs "for the
first two days of the next month" (same page).

**Spend cap budgets can actually pause a service, and Cloud Run is one of the
services they cover.** Spend caps were announced in July 2026 for a short list
of services: Gemini API, Agent Platform (formerly Vertex AI), **Cloud Run
(`run.googleapis.com`)** and Cloud Run functions. Firestore, Firebase Hosting
and Cloud Scheduler are not on the list
([spend caps](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)).
The rules:

- **Scope.** One project and one service per cap, monthly period only. You
  can't convert an existing alerts-only budget into a spend cap. You must
  create a new one.
- **Trigger.** The cap is enforced when "gross, estimated usage costs exceed
  100% of your budget amount." Then "all new usage for the specific service in
  the specified project is paused." In-flight requests finish and are billed.
  Alert emails go out at 50%, 80% and 100%.
- **Data.** "resources or data aren't deleted. Only usage of specific services
  is paused when the cap triggers."
- **Lifting.** The cap lifts automatically at the start of the next budget
  period. You can also lift it by hand with "Lift spend cap". After that it
  "won't trigger again for the rest of the budget period" unless you raise the
  amount. Services "might take up to one hour" to fully recover.
- **Speed.** Caps use estimated costs, so they trigger "much faster than the
  actual costs are processed". Enforcement "isn't instant and any cost
  overages are billed as normal." The page gives no figure in minutes.
- **Permissions.** You need `billing.resourcebudgets.configureSpendCap` on the
  project, or `billing.budgets.configureSpendCap` on the billing account.
  First-party (non-reseller) accounts only.
- The Firebase pricing-plans page "strongly" recommends spend caps for its own
  eligible products
  ([pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)).

**Uncertain: does the cap count free-tier usage?** Caps "don't include savings
and credits". On some services they use "gross, estimated costs, excluding
savings", and on others they use "actual costs, inclusive of all savings". The
page doesn't say which services fall into which group. The Cloud Run free tier
"is applied as a spending based discount"
([Cloud Run pricing](https://cloud.google.com/run/pricing)), so a cap on Cloud
Run may count gross usage *before* the free tier. In that case the cap would
see roughly $0.1–0.5/month of baseline, not €0.00 (estimate in §5). It is also
undocumented whether Cloud Run internet egress counts toward the
`run.googleapis.com` cap.

### Automatic kill-switch: disabling billing through Pub/Sub

Google documents a Cloud Run function that listens to a budget's Pub/Sub topic
and detaches the billing account when cost ≥ budget
([disable billing with notifications](https://docs.cloud.google.com/billing/docs/how-to/disable-billing-with-notifications)).
It needs the Cloud Billing API, a budget scoped to the project, a Pub/Sub topic
and a service account with billing permissions. The example uses
`roles/billing.admin`. The function is itself Cloud Run, and Cloud Run is
eventually shut down by the action it takes. What it costs you:

- Disabling billing will "terminate all Google Cloud services in the project",
  including free-tier services, and "Resources might be irretrievably deleted"
  (same page).
- "some of your Google Cloud resources might be removed and become
  non-recoverable." When you re-enable billing, "it might take up to 24 hours
  for the resources to start up again" and "Some services might need to be
  restarted manually"
  ([modify project billing](https://docs.cloud.google.com/billing/docs/how-to/modify-project)).
  No retention period is stated.
- On Firebase, the project drops to Spark. It "loses access to any paid Google
  Cloud services", with Cloud Run named as an example. Non-default Storage and
  RTDB data is kept but becomes inaccessible
  ([pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)).
  The page says nothing about Hosting, the default Firestore database or
  Cloud Scheduler after a downgrade. **Uncertain:** Firestore `(default)`
  probably keeps working within Spark quotas, but no source confirms this. The
  general Cloud warning about possible deletion still applies.
- "There's a delay between incurring costs and receiving budget
  notifications", so the kill-switch also fires late.

**Verdict.** The kill-switch is too destructive for a household app whose
whole value is its Firestore data. Using the Cloud Run spend cap is safer than
writing a kill-switch: it pauses only Cloud Run and keeps all data.

### Milder automatic responses

- **Disable Cloud Run.** Run `gcloud run services update SERVICE --scaling=0`
  (manual scaling to 0). After that, "any further requests to the service URL
  will fail with a Service unavailable or Service disabled error", and
  in-flight requests complete. The same docs point out that this does not
  stop Cloud Scheduler jobs
  ([manual scaling](https://docs.cloud.google.com/run/docs/configuring/services/manual-scaling)).
  A Pub/Sub budget function could make this call, but the built-in spend cap
  already does the same job without custom code.
- **No equivalent exists for Firestore.** It has no spend cap and no
  documented "pause" switch.

## 2. Hard limits per product

**Cloud Run: max-instances is a scaling limit, not a spend cap.** The docs
call it "a cost-safety limit". They suggest starting at 3 and setting it at
the service level, where it applies immediately. The limit "can be exceeded
for a brief period due to circumstances such as traffic spikes", and the
default is 100 per revision
([max instances](https://docs.cloud.google.com/run/docs/configuring/max-instances)).
Concurrency, CPU, memory and request timeout set the cost of each
instance-second, but none of them caps the bill. Taken together they cap the
worst-case *rate*:

- At list price, 1 vCPU/512 MiB costs $0.000024 per vCPU-s plus $0.0000025 per
  GiB-s ([Cloud Run pricing](https://cloud.google.com/run/pricing)). That is
  about $0.09 per instance-hour while busy.
- With max 20, the worst case is about $1.8/hour or about $43/day.
- With max 2, it is about $0.18/hour or about $4.3/day, before egress.

**Firestore has no spend cap and no documented daily usage limit on Blaze.**
The quotas page lists only the free daily quotas: 50k reads, 20k writes, 20k
deletes, 1 GiB stored, 10 GiB/month egress. They "reset around midnight
Pacific time". The page states "Budgets won't limit your usage"
([Firestore quotas](https://firebase.google.com/docs/firestore/quotas)).
Google's generic "capping API usage" guide lets you lower request-per-day and
request-per-minute quotas on billable APIs, but it never mentions Firestore. It
says some APIs have no quotas defined, enforcement "has a latency period", and
caps "regulate individual API volumes rather than overall spending"
([capping API usage](https://docs.cloud.google.com/apis/docs/capping-api-usage)).
**Uncertain:** whether `firestore.googleapis.com` exposes a request quota you
can lower. Check IAM & Admin > Quotas in the project before relying on it. The
Admin SDK calls the same API with one service account, so a per-user quota
would not separate households.

In practice, the Firestore bill is bounded by what Cloud Run can do. All
access goes through the Admin SDK from Cloud Run, and security rules don't
apply to the Admin SDK. Capping or pausing Cloud Run therefore also caps
Firestore operations. The exception is a bug that is cheap in Cloud Run time
but expensive in reads, such as an unbounded query; Firebase names "Forgetting
to add a limit to a database query with millions of results" as a classic
cause
([avoid surprise bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)).

**Firebase Hosting** has no cap. On Blaze you get 10 GB storage and 360 MB/day
transfer at no cost, then $0.026/GB and $0.15/GB
([Firebase pricing](https://firebase.google.com/pricing)).

**Cloud Scheduler.** "Each Google billing account gets 3 jobs per month free",
counted at the billing-account level. After that it is $0.10 per job per month
([Scheduler pricing](https://cloud.google.com/scheduler/pricing)). One job is
free, provided the billing account has no more than 3 jobs in total.

## 3. How fast costs reach a budget

- "Typically, your cost details are available within a day, but can sometimes
  take more than 24 hours. … These system delays also impact budget alerts,
  anomaly detection, and billing data exported to BigQuery". Late usage can
  roll into the next month's invoice
  ([billing reports](https://docs.cloud.google.com/billing/docs/how-to/reports)).
- Pub/Sub budget notifications arrive "multiple times per day". "It may take
  several hours before you receive the first Pub/Sub notification", and
  budgets use estimated data "subject to change until your invoice is
  finalized"
  ([programmatic notifications](https://docs.cloud.google.com/billing/docs/how-to/notify)).
- Firebase: "Cloud Firestore and Cloud Storage usage are calculated daily"
  ([avoid surprise bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)).
- Spend caps use near-real-time "live costs", but only "for limited SKUs from
  eligible services"
  ([live costs](https://docs.cloud.google.com/billing/docs/how-to/reports/live-costs)).

**What this means for egress and Firestore.** Cloud Run egress and Firestore
overage reach an alerts-only budget roughly **a day late**, and sometimes
later. A runaway Cloud Run at max 20 could run up about $40 before the first
email arrives. Firestore can't be capped by billing at all. **Cloud Monitoring
metrics are far faster than billing data.** For example,
`firestore.googleapis.com/document/read_count` and `write_count` are "Sampled
every 60 seconds" and visible within 240 s
([GCP metrics list](https://docs.cloud.google.com/monitoring/api/metrics_gcp_d_h)).
Alerting policies are free until 1 September 2027. After that they cost $0.35
per metric reference per month plus $0.50 per million points queried
([Monitoring pricing](https://cloud.google.com/stackdriver/pricing)).

## 4. Recommended guard-rail set

The settings are listed in the order that matters.

1. **Cloud Run `max-instances=2`, service level, set when deploying.** This
   cuts the worst-case Cloud Run burn from about $43/day to about $4/day. A
   household API with concurrency 80 does not need 20 instances.
   - Keep `min-instances=0` and request-based billing.
   - Choose the smallest CPU and memory that work, for example 1 vCPU and
     512 MiB, or less if a cold start allows.
   - Use a short request timeout, for example 30–60 s, so a hung request
     can't bill for the 5-minute default.
   - Trade-off: a real spike above about 160 concurrent requests gets 429 or
     "no available instances" errors instead of a bill.
2. **A Cloud Run spend cap budget: project + `run.googleapis.com`, €5/month.**
   This is the only automatic stop available, and it keeps the data.
   - €5 sits well above the possible gross, free-tier-excluded baseline of
     about $0.1–0.5/month (§5), so it shouldn't trip during normal use.
   - Trade-off: once tripped, the API (and therefore the whole app beyond the
     static shell, and the push sweep) is down until the 1st of next month or
     a manual lift. Recovery takes up to an hour after a lift.
   - Before trusting it, watch the cap's spend amount for a week. If it shows
     more than a few cents, gross pricing is being counted; raise it.
3. **A project-wide alerts-only budget of €1/month** with thresholds:
   - actual: 10% (€0.10), 50% (€0.50), 100% (€1.00)
   - forecasted: 100%

   The baseline is about €0.006/month, so even the 10% line means something
   is roughly 15× normal. Leave "savings/credits" at the default so the
   free tiers count. The forecasted rule catches a slow leak early in the
   month. This is the only guard that sees Firestore, Hosting and Scheduler.
   It is roughly a day late.
4. **Two Cloud Monitoring alert policies, the fast early warning (free until
   September 2027).**
   - Firestore `document/read_count` sum over 1 h > 20,000, plus writes and
     deletes > 5,000/h. That is about 40% and 25% of the daily free tier in an
     hour, against a baseline of about 1.8% per day.
   - Cloud Run `run.googleapis.com/request_count` > 1,000 per 10 min, or
     `container/billable_instance_time` above a few minutes per hour. The
     Scheduler alone produces 2 requests per 10 min.

   These fire within minutes, so you can act by hand, for example with
   `gcloud run services update … --scaling=0`, long before billing data
   arrives.
5. **Don't install the disable-billing kill-switch.** Google warns that
   resources "might be irretrievably deleted". Its effect on Firestore
   `(default)` after a downgrade to Spark is undocumented. Re-enabling can
   take up to 24 h. The spend cap in item 2 already covers the part that can
   scale.
6. **Code-level hygiene, because Firestore is uncappable.**
   - Put `.limit()` on every query.
   - Make the sweep idempotent and bounded. This already holds by design; see
     [ADR 0005](../adr/0005-push-delivery-is-a-claim-based-cron-sweep.md).
   - Keep the Scheduler job count at 1–3 for the whole billing account so it
     stays free.

Residual risk with all of this in place:

- A Cloud Run runaway is limited to about €5 by the cap, or about €4/day by
  max-instances, whichever comes first.
- A Firestore-heavy bug is limited only by Cloud Run time × read rate, and by
  how fast you react to the Monitoring alert.
- A Hosting bandwidth spike costs $0.15/GB past 360 MB/day, with no cap. Only
  the budget email catches it, about a day late.

## 5. Rough gross baseline (for sizing the spend cap)

This is an estimate, not a measurement. The Scheduler makes 8,640 calls a
month. At about 1 s billable each (cold start plus work, 1 vCPU, 512 MiB),
that is:

- 8,640 vCPU-s × $0.000024 ≈ $0.21
- 4,320 GiB-s × $0.0000025 ≈ $0.01
- requests ≈ $0.004

So roughly $0.25/month at list price before the free tier, plus user traffic
in the same order of magnitude. Replace this with the spike's real
`billable_instance_time` before you finalise the cap amount.
