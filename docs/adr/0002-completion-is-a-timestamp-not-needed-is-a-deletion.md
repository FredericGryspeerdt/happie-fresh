# Completion is a timestamp; "not needed" is a deletion

A to-do leaves the backlog two ways, and they are opposites. **Done** means the
household carried it out, recorded as `completedAt: string | null` — the
timestamp *is* the state, and the to-do stays in the backlog. **Not needed**
means it never had to happen, and is a hard delete leaving no trace. There is
deliberately no bulk "clear done" action, and no third `dropped` state.

## Why

This departs from the shopping module twice over, so both halves are worth
recording.

`ShoppingListItemInterface.checked` is a bare `boolean` with no `checkedAt` or
`checkedBy`. That is fine for a shopping list — one person is in the shop, and
nobody cares at 7pm who ticked off the milk. Household chores are the opposite
case: *when* something was done is the information that prevents duplicated work,
and it is the only way to answer "has anyone taken the bins out since Tuesday?",
which is what recurrence will need. A nullable timestamp as the single state
carrier also avoids the drift bug that a `done` boolean beside a `completedAt`
invites, where one write path updates one and not the other.

Shopping's bulk `clearChecked` is a hard delete, and copying it would apply the
*"this was never needed"* action to precisely the to-dos that **were** needed and
**were** done — destroying the record `completedAt` exists to keep. For a
shopping list that is harmless; a milk carton's job ends at the till. For
household work, "what we got done" is the point.

## Consequences

Done to-dos accumulate indefinitely. This is a **render** problem, not a
deletion problem: the fix is to show a window (done today / this week) once due
dates arrive, never to destroy rows.

`completedBy` is deliberately absent for now. A household currently holds exactly
one user, so it would carry no information — and the thing that will eventually
complete a to-do is a **member** (see issue #17), not a user, so storing a userId
today would only buy a migration.

Deleting an individual done to-do stays possible, as an escape hatch for a
mistyped or accidentally ticked to-do. It is an escape hatch, not a workflow, and
gets no separate concept.
