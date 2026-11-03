# Firestore backup options for "recover to yesterday"

Checked 3 November 2026 for #167 (part of #142). Primary sources only: Google
Cloud Firestore and Cloud Storage docs and pricing pages, Cloudflare R2 docs,
GitHub Actions docs. Nothing was enabled, deployed or restored. Prices are the
list prices in USD; re-check them before committing.

Assumptions: one Firebase project on Blaze, Firestore `(default)` database
(Standard edition) in `europe-west1`, about 600 documents. The estimates below
use **1 MiB ≈ 0.001 GiB** as a generous upper bound for the billable size
(documents plus index and metadata overhead).

## Short answer

- **Point-in-time recovery (PITR)** is the most precise "recover to yesterday":
  any whole minute in the last 7 days, cloned into a new database. It costs
  about **$0.0002 a month** at this size.
- **A daily scheduled backup** gives one restore point per day, kept up to
  14 weeks, for about **$0.0002 to $0.003 a month**.
- Both stay **inside the same project and region**. They do not protect against
  losing the project or the billing account. An **off-site copy** (scheduled
  export, encrypted, pushed to Cloudflare R2 from GitHub Actions) covers that
  for **under $0.01 a month**. It needs one static R2 secret, because R2 does
  not take Google's Workload Identity Federation.
- **Cloud Storage's Always Free tier does not apply in `europe-west1`**. It
  doesn't matter here, because a month of daily 1 MiB exports costs fractions
  of a cent.
- None of these options has a fixed monthly fee. The only minimum charge found
  is up to one day of PITR storage if you disable PITR within a day of turning
  it on.

## Prices that apply (europe-west1, Standard edition)

From [Firestore pricing](https://cloud.google.com/firestore/pricing). The page
renders per-location tables. The `europe-west1` monthly figures below were read
from the page's embedded table data. They are 10% above `us-central1`, which is
what the default table shows ($0.15, $0.03 and $0.20).

| Item | Price | Free quota |
| --- | --- | --- |
| Stored data | $0.165 / GiB-month | 1 GiB (the free database only) |
| PITR data | $0.165 / GiB-month | none |
| Backup data | $0.033 / GiB-month | none |
| Restore operation | $0.22 / GiB of backup | none |
| Clone operation | $0.2202 / GiB | none |
| Document reads | $0.033 / 100,000 | 50,000 a day |
| Document writes | $0.099 / 100,000 | 20,000 a day |

The pricing page says that PITR data, backup data, restore operations and clone
operations "do not include free usage". It also says named (non-default)
databases get no free quota at all. That matters for test restores, which
always land in a new named database.

[Cloud Storage pricing](https://cloud.google.com/storage/pricing): Standard
storage in `europe-west1` is $0.020/GB-month (read from the embedded table
data, so confirm in the console). Class A operations cost $0.005 per 1,000 and
Class B $0.0004 per 1,000 for single-region buckets. Data transfer out to the
internet costs $0.12/GiB for the first 10 TiB. The
[free tier](https://cloud.google.com/free/docs/free-cloud-features#storage)
gives 5 GB-months, 5,000 Class A and 50,000 Class B operations, but "apply only
to usage in the us-east1, us-west1, and us-central1 regions". **There's no free
tier in `europe-west1`.**

## Option 1: native scheduled backups

What the [backups docs](https://cloud.google.com/firestore/docs/backups) say:

- Each database can have **at most one daily and one weekly schedule**. For the
  weekly one, you choose the day of the week.
- Retention can be set **up to 14 weeks** (`--retention=14w`, or `8467200s` in
  Terraform).
- A backup is a consistent point-in-time copy that includes data and index
  configuration, and it "resides in the same location as the source database".
- It excludes **TTL policies and Security Rules**, so you reapply both after a
  restore.
- Deleting the source database does not delete its backups. Deleting the
  project does, because backups live in it.
- A restore always writes to a **new database ID** in the same location
  (`gcloud firestore databases restore --source-backup=... --destination-database=<new-id>`).
  You can't use an ID that is already in use.

Set up with
`gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=7d`.
This can be done once by hand or in Terraform
(`google_firestore_backup_schedule`).

**Cost.** Backup storage is billed on the database size at backup time,
prorated by days retained
([pricing](https://cloud.google.com/firestore/pricing)):

- Daily backups kept 7 days: about 7 × 0.001 GiB × $0.033 ≈ **$0.0002 a
  month**.
- Daily backups kept 14 weeks: 98 × 0.001 GiB × $0.033 ≈ **$0.003 a month**.
- Each restore costs 0.001 GiB × $0.22 ≈ **$0.0002**.

**Recover to yesterday.** You get yesterday's daily backup, so you may lose up
to 24 hours of writes.

**Test restore.** List backups with
`gcloud firestore backups list --location=europe-west1`, then restore into
`restore-test`. Wait for `gcloud firestore operations describe` to report
success, spot-check documents in the console, and delete `restore-test` with
`gcloud firestore databases delete`. The cost is one restore (about $0.0002)
plus a few reads on a named database, which has no free quota.

## Option 2: point-in-time recovery (PITR)

What the [PITR overview](https://cloud.google.com/firestore/docs/pitr) and
[Use PITR](https://cloud.google.com/firestore/docs/use-pitr) pages say:

- PITR is off by default. Once enabled, it keeps **one version per minute for
  7 days**. The full 7 days builds up after you enable it; it isn't available
  straight away.
- Without PITR you can still read (but not export) any timestamp from the past
  hour.
- There are three ways to recover:
  - Make a **stale read** at a whole-minute timestamp and write the result back
    into the live database. This is a surgical fix for a few documents.
  - **Clone** the database at a timestamp into a new database in the same
    location. The clone includes data and indexes.
  - Run a **PITR export** with `gcloud firestore export --snapshot-time=...` to
    Cloud Storage, then import it.
- Enable it with
  `gcloud firestore databases update --database='(default)' --enable-pitr`.

**Cost.** PITR storage is billed like database storage: 0.001 GiB × $0.165 ≈
**$0.0002 a month**. A clone costs about $0.0002. Stale reads and PITR exports
pay normal read prices. The only **minimum charge** in this whole comparison is
here: "You may be charged up to 1 day of PITR storage cost even if you disable
PITR within a day after enablement"
([PITR overview](https://cloud.google.com/firestore/docs/pitr)).

**Recover to yesterday.** You can return to any minute within the last 7 days,
which is the closest match to the requirement. Like backups, PITR lives in the
same project, and its window ends at 7 days.

**Test restore.** In the console, go to Databases and choose **Clone** for
`(default)`. Pick yesterday's timestamp and an unused database ID, wait, check
the data, then delete the clone. A cheaper check is a stale read of one known
document at a timestamp from yesterday.

## Option 3: scheduled managed export to Cloud Storage

What the [export and import docs](https://cloud.google.com/firestore/docs/manage-data/export-import)
say:

- Exports require Blaze/billing and a bucket near the database. Requester Pays
  and Rapid buckets are not supported.
- The Firestore service agent needs access to the bucket. A bucket in the same
  project works by default.
- The caller needs the Datastore Import Export Admin role plus Storage Admin
  (or Owner).
- An export "is not an exact database snapshot taken at the export start time";
  with PITR enabled, `--snapshot-time` makes it consistent.
- An import keeps the original document IDs, overwrites matching documents and
  leaves other documents alone. It does not trigger Cloud Functions.
- Billing: "Export operations incur one read operation per document exported.
  Import operations incur one write operation per document imported." Output
  files count as Cloud Storage storage.

There is no built-in export schedule. You trigger it from somewhere: GitHub
Actions (which this project already uses with WIF), Cloud Scheduler, or a
function.

**Cost of a daily export with 30 exports kept in `europe-west1` Standard
storage.** Each export reads about 600 documents, or 18,000 reads a month:

| Item | Monthly cost |
| --- | --- |
| Reads, if billed (see Uncertain) | ≈ $0.006 |
| Storage (30 × 1 MiB ≈ 0.03 GiB × $0.020) | ≈ $0.0006 |
| Class A writes (a few objects per export, ≈ 150 × $0.005/1,000) | ≈ $0.0008 |
| **Total** | **under $0.01 a month** |

Add a bucket lifecycle rule to delete exports older than N days.

**Test restore.** Create a scratch database with
`gcloud firestore databases create --database=restore-test --location=europe-west1`.
Run `gcloud firestore import gs://BUCKET/PREFIX/ --database=restore-test`,
check the data, then delete the database. The import costs 600 writes on a
named database with no free quota, about $0.0006.

## Option 4: off-site copy in Cloudflare R2 via GitHub Actions

The flow is a scheduled workflow:

1. Authenticate to GCP keyless with WIF (`google-github-actions/auth`).
2. Run `gcloud firestore export gs://BUCKET/$(date +%F)` and wait for the
   operation.
3. Copy the export folder to the runner with `gcloud storage cp -r`.
4. Tar it and encrypt it (for example with `age` and a public key; the private
   key stays offline).
5. Upload it to R2 through R2's S3-compatible API.

Feasibility and constraints:

- **The GCP side is keyless.** The WIF service account needs the Datastore
  Import Export Admin role plus object read/write on the export bucket (from
  the export docs above).
- **The R2 side can't use GCP's WIF.** R2's S3 API uses an Access Key ID and
  Secret from an R2 API token
  ([R2 API tokens](https://developers.cloudflare.com/r2/api/tokens/)), which
  must be stored as a GitHub secret. A token can be scoped to one bucket with
  **Object Read & Write**, but there is no write-only permission. The same page
  describes short-lived temporary credentials derived from a parent token, but
  the parent token is still a stored secret.
- **Retention and tamper-resistance.** R2 lifecycle rules can expire objects
  after N days ([object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/)).
  [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)
  prevent deletion or overwrite for a set period and take precedence over
  lifecycle rules. Together they limit what a leaked token could destroy.
- **R2 needs a subscription.** You enable R2 by completing "the checkout flow
  to add an R2 subscription"
  ([get started](https://developers.cloudflare.com/r2/get-started/)), even on
  the free allowance.
- **Scheduling is best-effort.** GitHub's `schedule` event "can be delayed
  during periods of high loads", and "in a public repository, scheduled
  workflows are automatically disabled when no repository activity has occurred
  in 60 days"
  ([GitHub docs](https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows)).
  `happie-fresh` is public, so a quiet repo silently stops backing up. Add a
  failure or staleness alert.

**Cost.** [R2 pricing](https://developers.cloudflare.com/r2/pricing/): the
free tier gives 10 GB-month of Standard storage, 1 million Class A and
10 million Class B requests a month, with free egress. There is no minimum
duration on Standard storage. Infrequent Access has a 30-day minimum and is
outside the free tier, so use Standard. On the Google side you pay the
Option 3 costs plus internet egress to the runner: 30 × 1 MiB ≈ 0.03 GiB ×
$0.12 ≈ $0.004. The total is still **under $0.01 a month**, and R2 itself is
$0.

**Test restore.** Download a dated object from R2, decrypt it, untar it, and
upload the folder to a GCS bucket. Then import into a scratch named database
as in Option 3. The export files are only usable through Firestore import, so a
restore always goes back through a Cloud Storage bucket. This also works into a
**different project**, which is the point of the off-site copy: the service
agent of the target project needs access to the bucket.

## Comparison

| | Restore points | Retention | Restores into | Survives project loss | Approx. monthly cost |
| --- | --- | --- | --- | --- | --- |
| Scheduled backup (daily) | 1 a day | up to 14 weeks | new DB, same project and region | no | $0.0002 (7 days) to $0.003 (14 weeks) |
| PITR | every minute | 7 days | clone to new DB, stale read, or PITR export | no | $0.0002 (1-day minimum) |
| Export to GCS (daily) | 1 a day, not snapshot-consistent without PITR | your lifecycle rule | import into any DB or project | only if the bucket is elsewhere | < $0.01 |
| Export to R2 (daily) | 1 a day | lifecycle rule plus optional bucket lock | via GCS, then import, into any project | yes | < $0.01 (R2 $0) |

**Fit with #142.** Turning on **PITR plus a daily backup (7 to 14 days)** costs
under a cent a month and meets "recover to yesterday" with no code. Add the
**R2 off-site export** if project or billing-account loss is in scope. It is the
only option that needs a stored secret and a monitored scheduled job.

## Uncertain or unverified

- **Whether export reads count against the 50,000/day free read quota.** The
  docs only say exports are charged "for document reads ... at the rates
  listed". At 600 documents this is at most about $0.006 a month either way.
- **The `europe-west1` price figures** were read from the pricing pages'
  embedded per-location data, not from a rendered table. They match the usual
  +10% over `us-central1`. Confirm in the Cloud console pricing calculator.
- **The real billable size** of the database, including index overhead, was not
  measured. 0.001 GiB is an assumption. Costs scale linearly, so even 10× is
  still cents.
- **Whether R2 checkout asks for a payment method** is not stated on the
  get-started page. It only says a subscription is added through checkout.
- **Restoring over `(default)` in place** was not tested. The restore docs
  require an unused database ID. Getting data back into `(default)` means
  either pointing the app at the restored database ID or exporting from the
  restored database and importing into `(default)`.
