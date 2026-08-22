# Push delivery is a claim-based cron sweep

To-do notifications are delivered by a `Deno.cron` job that runs every five
minutes, scans for fire-points whose moment has passed, and **atomically claims a
marker key before sending**. Nothing is ever scheduled or queued at the moment a
due date is set.

Markers live in their own keyspace, `["todo_notifications", householdId, todoId,
firePointId]`, not as a field on the to-do.

## Why a sweep rather than a delayed job

The obvious design — enqueue a delayed job when a due date is set — is
**unavailable on this platform**. Deno KV queues (`kv.enqueue` /
`kv.listenQueue`) are not supported on the new Deno Deploy, which this project
targets (see the CI migration work around commit `73e8091`). `Deno.cron` is
supported and behaves identically to the old platform.

That constraint is invisible in the code, which is the main reason this ADR
exists: a future reader will reach for a queue and needs to know it was not an
oversight.

The sweep turns out to be the better shape anyway. Because nothing is scheduled,
editing a due date, ticking a to-do off, or deleting it requires **no queue
cleanup** — the sweep simply never finds it. A queued job would have to be
cancelled or invalidated on every one of those paths, and a missed cancellation
means a notification about something already done.

## Why claims, not a flag on the to-do

`Deno.cron` retries a failed handler when given a `backoffSchedule`, and a
partial failure part-way through a batch is exactly when a retry happens. So
"have I already sent this?" must be a **claim**, not a read-then-write.

A dedicated key makes that one atomic operation:
`kv.atomic().check({ key, versionstamp: null }).set(key, …).commit()` succeeds
only if nothing has claimed it, so a double run sends once.

The same guarantee is unavailable from a field on the to-do. Appending to an
array there means compare-and-swap on the **whole to-do record**, which contends
with a member editing that to-do's title at the same moment through a
`TodoRepo.update` that is already a non-atomic read-modify-write. Delivery
bookkeeping would be racing user edits over one record, and the loser silently
drops either the edit or the notification.

Keeping markers out of `TodoInterface` also stops the domain record growing a
field that exists only because of how push happens to work.

## Consequences

**The `firePointId` includes the instant**, e.g. `due@2026-08-06T07:00:00.000Z`,
not just `due`. Keyed on the kind alone, rescheduling a to-do after it had already
notified would never notify again — but a member who moves a to-do to next week
plainly does want reminding next week. Including the instant means a reschedule
mints a new fire-point and a new claim, while re-running against the same instant
still sends once.

**Markers cascade with the to-do.** Deleting a to-do prefix-scans and deletes its
markers, so they cannot accumulate indefinitely.

**A moment that passes while nothing is running is not sent late.** The sweep only
delivers fire-points from the last hour; anything older is claimed *without*
sending, so it is recorded as handled and can never fire spuriously afterwards.
The to-do still shows as **Overdue** in the app, which is the honest place for
that information.

**Discovery is an in-memory scan**, not an index. At this scale — one household,
tens of to-dos — a five-minutely scan is a handful of reads, and an index would
have to be maintained across create, reschedule, tick-off and delete. When volume
justifies it the index should be over **fire-points** keyed on the instant, since
reminders multiply fire-points per to-do; that decision belongs with real numbers.
