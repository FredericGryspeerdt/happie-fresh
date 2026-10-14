# Deno / Cloudflare migration evidence

Checked 10 October 2026. Primary sources only; no migration or deployment
tested.

## Announcement boundary

[Deno's 9 October announcement](https://deno.com/blog/cloudflare) says the team
joins Cloudflare, Deno receives monthly bug/security releases for another year,
then the team's runtime development ends. Deploy operates for six more months
before shutdown; paying customers receive migration support to Workers. JSR
continues with infrastructure moving to Cloudflare. These periods imply roughly
April/October 2027, not separately confirmed shutdown dates.

The announcement does **not** name Fresh, announce its retirement, or specify
managed KV retention, export procedures, a KV compatibility layer, or automatic
data migration. Do not infer those promises from the acquisition.

## Fresh portability: documented, application untested

Fresh's current
[Workers guide](https://usefresh.dev/docs/deployment/cloudflare-workers)
documents `@cloudflare/vite-plugin`, Wrangler, and a Worker wrapper forwarding
`fetch` to `_fresh/server.js`. Keeping Fresh/Preact/islands is therefore a
documented option; framework replacement is not inherently required.

Fresh's [Docker guide](https://usefresh.dev/docs/deployment/docker) documents
building and serving with Deno on container hosts. This offers a nearer-term
exit with less application change, but retains runtime maintenance
responsibility. Its recommendation to set a changing `DENO_DEPLOYMENT_ID`
conflicts with Happie's use of that variable to select hosted KV in
[`database/db.ts`](../../database/db.ts): storage selection must be made
explicit before using that recipe.

## Storage choices

The CLI supports explicit persistent file paths and uses SQLite locally
([Deno KV quick start](https://docs.deno.com/deploy/kv/)). A single persistent
Deno instance could preserve Happie's KV API, but disk durability, backups,
restore, concurrency and uptime remain deployment work.

The official [self-hosted denokv backend](https://github.com/denoland/denokv)
documents SQLite, KV Connect, atomic checks, expiration and watch; remote queues
are excluded. It requires persistent storage without independent database
autoscaling. This is a documented multi-client alternative, not a verified
production destination for Happie.

[D1](https://developers.cloudflare.com/d1/) provides managed SQLite SQL
semantics.
[Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)
provide private transactional, strongly consistent storage, including a KV API
on SQLite-backed objects. Both require repository/data migration; neither
documentation establishes drop-in `Deno.Kv` compatibility. A household object is
a plausible transaction boundary, but global authentication and reminder sweeps
need explicit design.

[Workers KV](https://developers.cloudflare.com/kv/concepts/how-kv-works/) is
eventually consistent and unsuitable for atomic transactions. It cannot directly
preserve shopping-list move/undo checks, session touch/logout checks, and atomic
notification claims in Happie's repositories.

## Scheduling and dependency work

[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
use UTC schedules and a Worker `scheduled()` handler: replace the module-scope
`Deno.cron` registration in [`main.ts`](../../main.ts), preserving claim/retry
behavior.
[Durable Object alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)
offer per-object scheduling but would change the sweep design.

[Workers Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
is partial; some shims import successfully but throw when called. Happie's
externalized CommonJS `web-push` path needs an actual bundle/send test.
Environment access and any runtime Deno APIs also need auditing.

## Recommendation

### Agreed migration constraints

The planning interview established: target €0/month, prefer managed hosting,
evaluate Cloudflare first, and consider a small server if free managed hosting
cannot meet the requirements. Revisit spending only when a concrete limitation
requires it. Preserve existing features and UI; allow a planned maintenance
window of up to one hour. Occasional slow starts are acceptable, but scheduled
reminders must run independently of anyone opening the app. Hosting and storage
are not yet selected.

Happie remains a personal app. A new URL is acceptable, including reinstalling
the PWA and enabling notifications again. Daily backups with recovery to the
previous day's data are acceptable after migration; cutover must preserve all
data through the final transfer.

### Proposed feasibility prototype

Use an isolated prototype and disposable data to test the existing Fresh UI,
password verification, one representative transactional storage operation, and
scheduled web-push delivery on Cloudflare's free plan. Measure deployed CPU
usage rather than treating a successful local run as proof of free-plan fit.
Preserve current password verification strength. Evaluate D1 first for its
SQL-based storage; consider Durable Objects if the transaction or execution
model calls for them. Storage selection remains open until these tests provide
evidence. Do not change production data or cut over during the prototype.

The result should be a go/no-go recommendation for free Cloudflare hosting, with
the remaining migration work identified. If it fails, revisit a small server or
a paid option against the agreed constraints. The prototype proposal awaits
confirmation at the end of the interview.

### Next investigation

The [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
currently give Free HTTP requests and Cron Triggers 10 ms of CPU time each.
Waiting for network or database responses does not count. Measure Fresh SSR,
existing password verification and encrypted push delivery before claiming the
free plan fits. No runtime measurements have been performed.

First secure an export and rehearsed restore of production KV. Prototype Fresh
on Workers with transactional storage before choosing D1 versus Durable Objects.
Keep a persistent Deno/container plus local KV or denokv as an interim escape
route if that prototype cannot meet the hosting deadline. Separate the hosting
exit from any later framework rewrite; none of these application paths has yet
been validated.
