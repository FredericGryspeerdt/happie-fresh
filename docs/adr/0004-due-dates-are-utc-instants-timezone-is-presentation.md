# Due dates are UTC instants; timezone is presentation only

A to-do's due moment is stored as a single full ISO timestamp in UTC —
`dueAt: string | null` — not as a calendar date, and not as a date plus a
separate optional time. Timezone is never stored anywhere: entry and display use
the **viewer's device timezone**, and nothing on the server needs to know it.

## Why an instant rather than a date

A date-only field (`"2026-08-07"`) is the tempting choice for household work,
which is day-grained in conversation, and it makes timezone ambiguity
structurally impossible.

It was rejected because **notifications and reminders are the point of the
feature.** A notification fires at a moment, so a bare date would have to be
given a notional time anyway — and midnight, the obvious default, is the worst
possible one. Reminders make it sharper still: "one week before" is computed
*from* the due moment, so the due moment has to be a moment.

A date plus an optional time was also rejected: two fields for one concept means
every display site branches on which it is, and every comparator has to decide
how an all-day to-do orders against a timed one on the same day. Instead the time
is always present, defaulted to 09:00 when the user doesn't care, and always
shown — once notifications exist the time is not decoration, it is when the phone
will buzz, so hiding it would be dishonest.

## Why timezone is presentation only

Storing the instant means the *stored* value is unambiguous, so the timezone
question reduces to how it is parsed on the way in and formatted on the way out.
The device's zone answers both, for free and correctly: everyone in a household
is in the same house, and `<input type="datetime-local">` resolves local
wall-clock time natively.

Crucially this keeps notifications correct regardless: whoever sets "18:00" does
so in their own zone, the instant is absolute, and `Deno.cron` runs in UTC — so
the future sweep compares instants and needs no timezone knowledge at all.

A per-household timezone setting is a reasonable later refinement for the
travelling-member case. Because storage is UTC it changes rendering only, needs no
migration, and is therefore exactly the kind of decision worth deferring.

## Consequences

"Today", "this week" and "overdue" are computed against the **viewer's** clock, so
two members in different countries can briefly disagree about which section a
to-do sits under. The set of to-dos and their order are identical either way.

For the same reason, grouping cannot be computed on the server, which does not
know the viewer's zone. The repository emits a timezone-independent order and a
pure `groupOpenTodos(todos, now)` function buckets it — the same function on both
sides, differing only in `now`. Server-rendered and hydrated markup can therefore
disagree for to-dos due within hours of a boundary, until hydration settles it.
