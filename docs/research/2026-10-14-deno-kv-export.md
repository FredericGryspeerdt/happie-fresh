# Exporting production Deno KV before Deploy shuts down

Checked 14 October 2026. Primary sources only. Nothing was run against
production KV and no credentials were used. Answers
[#147](https://github.com/FredericGryspeerdt/happie-fresh/issues/147).

## Which platform and database Happie uses

Happie reaches production KV through KV Connect at
`https://api.deno.com/v2/databases/<DB_ID>/connect` with an organization token
(`ddo_…`), as documented in
[`docs/running-migrations.md`](../running-migrations.md) and
[`migrate-prod-kv.yml`](../../.github/workflows/migrate-prod-kv.yml). That
`/v2/` URL is the **new** Deno Deploy format
([Deno KV on Deploy](https://docs.deno.com/deploy/reference/deno_kv/)). Deploy
Classic used `/databases/<id>/connect`
([Classic KV docs](https://docs.deno.com/deploy/classic/kv_on_deploy/)) and was
shut down on 20 July 2026
([migration guide](https://docs.deno.com/deploy/migration_guide/)).

[`database/db.ts`](../../database/db.ts) opens the default KV when
`DENO_DEPLOYMENT_ID` is set. Otherwise it opens `KV_PATH`, which may be a file
or an `https://` KV Connect URL. Every script that uses `getKv()` can therefore
already read production from a local machine or from GitHub Actions.

Existing tooling: `deno task db:view`
([`scripts/db-viewer.ts`](../../scripts/db-viewer.ts)) lists every entry
(`kv.list({ prefix: [] })`) and prints it with `console.log`. That is a viewer,
not an export, because its output cannot be parsed back without loss. Neither
`scripts/` nor the `deno.json` tasks contain an export or restore script.

## Deadline

[Deno's 9 October announcement](https://deno.com/blog/cloudflare) says Deploy
"will continue operating for six months before shutting down". It offers
migration support to Workers for paying customers only. It gives no calendar
date and says nothing about KV, data retention, export, or a read-only phase.
Six months from 9 October 2026 is about **9 April 2027**. That date is my
inference and Deno has not published it.

The docs have not caught up. The migration guide (last updated 18 June 2026)
still sends Classic users to the new console, as reported in
[denoland/docs#3491](https://github.com/denoland/docs/issues/3491), which was
open with no staff reply when checked. No source promises that KV Connect keeps
working until the last day, and none says what happens to stored data at
shutdown.

## Supported export routes

### 1. KV Connect + `kv.list()` (documented, works today)

The [Deno KV on Deploy](https://docs.deno.com/deploy/reference/deno_kv/) page
documents opening a managed database from the local CLI with
`Deno.openKv("https://api.deno.com/v2/databases/<id>/connect")` and a personal
or organization token in `DENO_KV_ACCESS_TOKEN`. Once the database is open, the
normal [`Deno.Kv`](https://docs.deno.com/api/deno/~/Deno.Kv) API applies, so a
`list({ prefix: [] })` over all keys is a full export. Happie already uses this
route for migrations.

Limits and caveats from the sources:

- **No snapshot across the whole list.** `list()` reads in batches, and
  "Data within a batch is read in a single snapshot read … Across batches, data
  is not consistent" ([Operations](https://docs.deno.com/deploy/kv/operations/)).
  The API reference gives a default `batchSize` of 100 (or `limit`) and a
  maximum of 500 ([Deno.Kv](https://docs.deno.com/api/deno/~/Deno.Kv)). The
  Operations page says the default is 500. The docs disagree on the default but
  agree on the cap.
- **Reads are strongly consistent by default**
  ([Deno.Kv](https://docs.deno.com/api/deno/~/Deno.Kv)). The
  [KV Connect protocol](https://raw.githubusercontent.com/denoland/denokv/main/proto/kv-connect.md)
  sends strongly consistent snapshot reads to the primary. Do not pass
  `consistency: "eventual"` during an export.
- **Value types.** A value can be any structured-serialisable value or a
  `Deno.KvU64`. Values are capped at 64 KiB and keys at 2048 bytes
  ([Deno.Kv](https://docs.deno.com/api/deno/~/Deno.Kv)). Plain
  `JSON.stringify` loses information. Happie stores `Date` objects in sessions
  (`expiresAt` and `absoluteExpiresAt` in
  [`models/session/session.interface.ts`](../../models/session/session.interface.ts)),
  and those would become strings. An export must tag the types JSON cannot hold
  (Date, Uint8Array, bigint, KvU64) or use a structured format.
- **TTL is not exported.** Sessions and shopping-list move receipts are written
  with `expireIn` ([`session.repo.ts`](../../database/session.repo.ts),
  [`shopping-list-move.repo.ts`](../../database/shopping-list-move.repo.ts)).
  A list entry exposes only its key, value and versionstamp
  ([Deno.KvEntry](https://docs.deno.com/api/deno/~/Deno.KvEntry)). Both kinds of
  data can be dropped anyway, because the map already accepts a new URL and
  logging in again.
- **Queues are not part of KV Connect**
  ([denokv README](https://github.com/denoland/denokv)). Happie does not call
  `enqueue`, so nothing is lost.
- The sources state **no rate limit, size limit or SLA** for KV Connect reads.
  The protocol only says clients should back off and retry on errors.

### 2. Continuous S3 backup + `denokv pitr` (documented, unverified on new Deploy)

The [Backups](https://docs.deno.com/deploy/kv/backup/) page (last modified 19
March 2026) says hosted KV can be continuously backed up to your own
S3-compatible bucket: AWS S3, or Google Cloud Storage through HMAC keys. It
says this enables "point-in-time-recovery" and "a consistent snapshot of your
data at any point in time in the past". The
[denokv README](https://github.com/denoland/denokv) documents
`denokv --sqlite-path <path> pitr sync|list|checkout <point>` and
`serve --sync-from-s3`, which turn that bucket into a local SQLite KV.

What the sources do **not** say:

- The setup steps say to open "the 'KV' tab in your project", which is Classic
  dashboard vocabulary.
- The new [Deno KV on Deploy](https://docs.deno.com/deploy/reference/deno_kv/)
  page (Databases, timelines) mentions backups only once, telling you to back
  up your data before deleting.
- Whether the new console still offers this setting could not be confirmed
  without logging in.
- This note did not check whether S3 or GCS free tiers cover the backup or
  whether a bucket needs a credit card.

### 3. Dashboard tools and Deno support

No source documents a data browser, download or export button in the new
console. The migration guide says Classic KV data was "not automatically
migrated" and points to support@deno.com. The Cloudflare post offers migration
help only to **paying** customers. Happie cannot count on either route.

## Consistency during a short cutover window

With route 1, a single export through `list()` cannot be one snapshot. It can
still be consistent if writes stop first. The docs give one way to stop them:
after the app's database assignment is removed, "the app will no longer be able
to access that database", while "the database itself and its data will remain
intact" ([Deno KV on Deploy](https://docs.deno.com/deploy/reference/deno_kv/)).
Once the app cannot write, a strongly consistent full `list()` returns a stable
copy. Do **not** click "Delete" on the instance, because that deletes every KV
database in that entry.

The docs do not say whether KV Connect still works for a database with no app
assigned, so rehearse that first. If it does not, the fallback is an app-level
maintenance mode, deployed before the export, that returns 503 from every
mutating API route.

To prove that no write slipped in, run the export twice and compare the key
sets and `versionstamp`s. If the two passes match, nothing changed between them.
This check is my own reasoning and no source describes it. Route 2, if
available, gives a true point-in-time snapshot without a freeze.

Happie's data covers a single household's documents (shopping lists, to-dos,
menus, loyalty cards). This note did not measure its size. At 500 keys per
batch, even tens of thousands of entries take only a few hundred reads, which
should fit easily in a one-hour window. Time a rehearsal before relying on that.

## Recommendation

1. **Build `scripts/export-kv.ts`** (`deno task db:export`) on top of
   `getKv()`. It should:
   - list every key with strong consistency;
   - write NDJSON that encodes keys and values with type tags for Date,
     Uint8Array, bigint and KvU64, and record versionstamps and a final count;
   - take a `--verify` flag that lists again and compares versionstamps.

   Run it from a `workflow_dispatch` GitHub Action modelled on
   `migrate-prod-kv.yml`, with the same `production` environment and secrets,
   and upload the file as an artifact. It can also run locally with the same
   environment variables.
2. **Rehearse now and repeat monthly.** Export production, import it into a
   local file KV (`KV_PATH=./data/restore.db`), and run the app or `db:view`
   against the copy. Keep each export as a backup until cutover.
3. **Optionally** check the console for an S3 backup option on the new Deploy.
   If it is free to turn on, it adds a point-in-time safety net, but do not
   depend on it.
4. **At cutover**, un-assign the database (or switch on maintenance mode), run
   the export with `--verify`, import the result into the new relational
   database, and then switch over.

**Latest safe date to rely on KV Connect: 28 February 2027**, which is the
map's cutover deadline. The only published bound is "six months" from 9 October
2026 (about 9 April 2027). Deno gives no exact date, no SLA, and no promise
about KV during the wind-down. Do not plan anything that needs the old KV after
February. A verified full export should exist well before then, and the first
rehearsal is due as soon as the export script is merged.
