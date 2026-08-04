# To-dos are one-off; chores are a separate module

A to-do is something the household needs to do **once** — "book the venue",
"renew the passport". Routine work that recurs on a schedule — the bins, the
monthly bills, the yearly dentist appointment — is a **chore**, a different
concept that Happie will model in its own module. Recurrence has therefore left
the to-dos roadmap entirely, and to-dos will never grow a recurrence field.

This **reverses** the decision taken when the module was designed, which treated
a to-do as one concept with recurrence as an optional attribute, on the reasoning
that "a chore is a to-do that repeats".

## Why the reversal

The original decision was made from examples — bills, bins, appointments — that
turned out to be chores rather than to-dos. Once that was noticed, the two
concepts separated cleanly on something more fundamental than whether a date
repeats:

A **to-do exists because it would otherwise be forgotten.** Its whole purpose is
remembering, which is why due dates and reminders are the features that make the
module work at all.

A **chore is driven by its schedule, not by anyone's memory.** Nobody forgets
that bins happen weekly; the questions a chore raises are *whose turn is it* and
*was it done since Tuesday* — rotation and history. It also never finishes, so
"done" means something different: a completion event in a series, not an end.

Those are different aggregates with different fields, different lifecycles and
different screens. Modelling them as one type means a `recurrence` field that is
null for most records, a "done" that means two things, and rotation and points
logic sitting unused on every one-off.

## Consequences

To-dos stay simple: a title, notes, a due moment, and a completion moment.

Because a done to-do is finished forever rather than one occurrence in a series,
its completion record has little ongoing value — which is what makes windowing
the Done section to the last seven days cheap rather than lossy.

The first rejection argument in [ADR 0001](./0001-one-household-backlog-no-todo-lists.md)
relied on the recurring examples and has been retired; that ADR carries an update
note. Its conclusion still stands.

Chores are unbuilt and unscheduled. When they are built, they get their own
aggregate — not a flag on `TodoInterface`.
